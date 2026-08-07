#!/usr/bin/env python3
"""STB project.json → 單一 HTML 網頁通告單

用法：python3 stb_to_callsheet.py <案子資料夾或 project.json> [輸出.html] [選項]

選項：
  --date=YYYY-MM-DD  指定哪一個拍攝日（預設第一天）
  --artifact         輸出 Artifact 用格式（不含 html/body 外層，它會自己包）
  --no-compress      不要壓縮圖片（預設會壓，長邊 1200px JPEG q80）
  --maxpx=1200 --quality=80   微調壓縮強度

版面沿用一份實戰用過、多輪修出來的網頁通告單（無彩 zinc 亮色版），
本檔把它的結構改成資料驅動，直接吃 STB 的 project.json。

要點：
- 時間是連鎖算出來的（callTime 起，每段 +durMin），rundown 裡沒有存起訖時間
- callGroups 與 rundown 合併成同一條時間軸，同時刻併成一列（兩張並排）
- type 欄位 1.6.0 前存中文、之後存英文 key，兩種都吃
- 車輛／注意事項 STB schema 目前沒有，讀 days[].vehicles / days[].notes，沒有就不顯示
- 零外部連線：CSS/JS 內嵌、不載 webfont、圖片保持 data URL
"""
import json, sys, html, base64, io, re
from pathlib import Path


"""壓縮預設值：分鏡卡片實際顯示寬度只有 240–300px，1200px 已足夠在手機上捏放看細節。
50 張圖實測：不壓縮會爆掉 16MB／1600px 約 11MB／1200px 約 6.9MB。"""
MAXPX, QUALITY = 1200, 80


def _shrink_sips(raw, maxpx, q):
    """沒有 Pillow 時的備援：macOS 內建 sips（每台 Mac 都有，不用裝任何東西）"""
    import subprocess, tempfile, os
    fd, p = tempfile.mkstemp(suffix=".jpg"); os.close(fd)
    try:
        with open(p, "wb") as f: f.write(raw)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(q),
                        "-Z", str(maxpx), p], capture_output=True, check=True)
        with open(p, "rb") as f: return f.read()
    finally:
        os.unlink(p)


def shrink(url, maxpx=MAXPX, q=QUALITY):
    """把 data URL 圖片降到長邊 maxpx 的 JPEG。失敗就原樣回傳，絕不弄壞資料。"""
    if not isinstance(url, str) or not url.startswith("data:image"):
        return url
    raw = base64.b64decode(url.split(",", 1)[1])
    try:
        from PIL import Image
    except ImportError:          # 沒 Pillow → 走 sips
        try:
            out = "data:image/jpeg;base64," + base64.b64encode(_shrink_sips(raw, maxpx, q)).decode()
            return out if len(out) < len(url) else url
        except Exception:
            return url
    try:
        im = Image.open(io.BytesIO(raw))
        if max(im.size) > maxpx:
            im.thumbnail((maxpx, maxpx), Image.LANCZOS)
        if im.mode in ("RGBA", "LA", "P"):   # JPEG 沒有透明度，透明處填白
            bg = Image.new("RGB", im.size, "white")
            im = im.convert("RGBA")
            bg.paste(im, mask=im.split()[-1])
            im = bg
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "JPEG", quality=q, optimize=True)
        out = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        return out if len(out) < len(url) else url   # 壓不小就別換
    except Exception:
        return url


def compress_all(proj, maxpx=MAXPX, q=QUALITY):
    """就地壓縮專案裡所有內嵌圖片，回傳 (張數, 原大小, 新大小)"""
    n = before = after = 0
    def do(obj, key):
        nonlocal n, before, after
        v = obj.get(key)
        if isinstance(v, str) and v.startswith("data:image"):
            nv = shrink(v, maxpx, q)
            n += 1; before += len(v); after += len(nv)
            obj[key] = nv
    for c in proj.get("cuts") or []: do(c, "imageRef")
    for items in (proj.get("refPages") or {}).values():
        for i in items: do(i, "imageRef")
    for d in proj.get("days") or []:
        for b in d.get("rundown") or []: do(b, "parkImage")
    do(proj.get("meta") or {}, "logo")
    return n, before * 3 // 4, after * 3 // 4

TYPE_LABEL = {"call": "集合", "shoot": "拍攝", "move": "移動", "setup": "場佈",
              "meal": "用餐", "other": "其他", "集合": "集合", "拍攝": "拍攝",
              "移動": "移動", "場佈": "場佈", "用餐": "用餐", "其他": "其他"}
E = lambda s: html.escape(str(s or ""))
hhmm = lambda m: f"{m // 60 % 24:02d}:{m % 60:02d}"
to_min = lambda s: int(s.split(":")[0]) * 60 + int(s.split(":")[1])

CSS = """
/* 無彩中性 zinc・中密度・中對比：白底黑字，顏色只用在必要處，層次靠字級落差與留白 */
:root{--bg:#F4F4F5;--card:#fff;--ink:#18181B;--ink2:#3f3f46;--muted:#71717A;
 --faint:#a1a1aa;--line:#e4e4e7;--line2:#ededf0}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);line-height:1.7;-webkit-font-smoothing:antialiased;
 font-family:-apple-system,"Helvetica Neue","PingFang TC","Noto Sans TC",sans-serif}
a{color:inherit}
a:focus-visible,.veh-pax-toggle:focus-visible,.tab:focus-visible{outline:2px solid var(--ink);outline-offset:2px}

.tab-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px;background:var(--bg)}
.tab{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 8px;
 text-align:center;cursor:pointer;transition:.2s;font:inherit;color:var(--ink2)}
.tab b{display:block;font-size:14px;font-weight:700}
.tab span{display:block;font-size:10px;letter-spacing:2px;color:var(--muted);margin-top:2px}
.tab.on{background:var(--ink);border-color:var(--ink);color:#fff}
.tab.on span{color:rgba(255,255,255,.6)}
.page{display:none}.page.on{display:block}

.top-rule{height:2px;background:var(--ink);opacity:.85}
.hd{padding:36px 40px 28px;border-bottom:1px solid var(--line);display:flex;
 justify-content:space-between;align-items:flex-end;gap:28px}
.hd-badge{font-size:12px;font-weight:600;letter-spacing:2px;color:var(--muted);
 margin-bottom:14px;display:flex;align-items:center;gap:12px}
.hd-badge::before,.hd-badge::after{content:'';width:18px;height:1px;background:var(--line)}
.hd-title{font-size:clamp(30px,5vw,46px);font-weight:800;letter-spacing:1px;line-height:1.05;
 margin-bottom:10px;text-wrap:balance}
.hd-sub{font-size:14px;font-weight:500;letter-spacing:3px;color:var(--ink2)}
.hd-clock{text-align:right;flex-shrink:0}
.clock{font-size:clamp(28px,4.5vw,44px);font-weight:700;letter-spacing:1px;line-height:1;
 font-variant-numeric:tabular-nums}
.clock-sub{font-size:12px;font-weight:500;letter-spacing:2px;color:var(--muted);margin-top:8px}

.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
 border-bottom:1px solid var(--line)}
.mc{padding:18px 24px;border-right:1px solid var(--line)}
.mc:last-child{border-right:none}
.mc-lbl{font-size:12px;font-weight:600;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
.mc-val{font-size:15px;letter-spacing:.3px;line-height:1.5}
.mc-val.big{font-size:26px;font-weight:700;letter-spacing:1px;line-height:1;
 font-variant-numeric:tabular-nums}

.pg-body{display:grid;grid-template-columns:1fr 320px}
.sh{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.sh-num{font-size:12px;font-weight:600;letter-spacing:1px;color:var(--faint)}
.sh-line{flex:1;height:1px;background:var(--line)}
.sh-lbl{font-size:13px;font-weight:600;letter-spacing:2px;color:var(--ink2)}

.tl-sec{padding:36px 40px;border-right:1px solid var(--line)}
.tl-wrap{position:relative}
.tl-bg,.tl-fill{position:absolute;width:2px;pointer-events:none;z-index:1}
.tl-bg{background:var(--line2)}
.tl-fill{top:0;height:0;background:var(--ink);z-index:2;transition:height .7s ease}
.tl-cur{position:absolute;width:12px;height:12px;border-radius:50%;background:var(--ink);
 transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(24,24,27,.12);z-index:20;
 display:none;transition:top .7s ease;pointer-events:none}
.tl-cur::after{content:'';position:absolute;inset:-4px;border-radius:50%;
 border:1px solid rgba(24,24,27,.28);animation:ring 2s ease-in-out infinite}
@keyframes ring{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(2.2);opacity:0}}
@media(prefers-reduced-motion:reduce){.tl-cur::after{animation:none}
 .tl-fill,.tl-cur,.ev,.tl-dot,.tl-time{transition:none}}

.tl-row{display:grid;grid-template-columns:76px 30px 1fr;min-height:104px}
.tl-time{font-size:19px;font-weight:600;color:var(--faint);padding-top:22px;text-align:right;
 padding-right:12px;white-space:nowrap;font-variant-numeric:tabular-nums;transition:color .4s}
.tl-time.past{color:var(--muted)}
.tl-time.on{color:var(--ink);font-weight:700}
.tl-time small{display:block;font-size:11px;font-weight:400;color:var(--faint);letter-spacing:.5px}
.tl-dc{position:relative}
.tl-dot{position:absolute;top:22px;left:50%;width:9px;height:9px;border-radius:50%;
 border:1.5px solid var(--line);background:var(--bg);transform:translate(-50%,0);z-index:5;
 transition:all .45s ease}
.tl-dot.past{background:var(--muted);border-color:var(--muted)}
.tl-dot.on{background:var(--ink);border-color:var(--ink);box-shadow:0 0 0 4px rgba(24,24,27,.1)}
.tl-cards{padding:12px 0 22px 18px;display:flex;flex-direction:column;gap:10px}
.tl-cards.split{display:grid;grid-template-columns:1fr 1fr;gap:10px}

.ev{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--line);
 border-radius:0 8px 8px 0;padding:13px 16px;transition:border-left-color .4s,background .4s}
.ev.past{border-left-color:var(--muted)}
.ev.on{border-left-color:var(--ink);background:#fafafa}
.ev-type{font-size:11px;font-weight:600;letter-spacing:2px;color:var(--muted);margin-bottom:5px}
.ev-who{font-size:15px;font-weight:600;letter-spacing:.3px;line-height:1.6;margin-bottom:8px}
.ev.calltime .ev-who{font-size:18px;font-weight:800;letter-spacing:1px}
.ev-meta{display:flex;flex-direction:column;gap:5px}
.ev-note{font-size:14px;color:var(--ink2);line-height:1.5}
.ev-tag{font-size:13px;color:var(--muted)}
.ev-img{margin-top:10px;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.ev-img img{width:100%;display:block}
a.map-lnk{display:inline-flex;align-items:center;gap:5px;font-size:13px;text-decoration:underline;
 text-underline-offset:2px;padding:2px 0;transition:opacity .2s}
a.map-lnk::before{content:'◎';font-size:11px}
a.map-lnk:hover{opacity:.6}
.park-lnk{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);padding:2px 0}
.park-lnk::before{content:'P';border:1px solid currentColor;padding:1px 3px;font-size:10px}

.sidebar{padding:36px 28px;display:flex;flex-direction:column;gap:32px}
.veh{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:12px;overflow:hidden}
.veh-hd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;
 background:#fafafa;border-bottom:1px solid var(--line)}
.veh-name{font-size:18px;font-weight:800;letter-spacing:3px;margin-right:-3px}
.veh-plate{font-size:13px;color:var(--muted);letter-spacing:2px;font-variant-numeric:tabular-nums}
.veh-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.veh-contact{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 14px 12px}
.veh-contact-role{font-size:12px;font-weight:600;letter-spacing:1px;color:var(--muted);margin-bottom:5px}
.veh-contact-name{font-size:16px;font-weight:700;margin-bottom:5px}
.veh-contact-tel{display:block;font-size:15px;text-decoration:underline;text-underline-offset:2px;
 font-variant-numeric:tabular-nums}
.veh-pax-toggle{display:flex;justify-content:space-between;align-items:center;background:var(--bg);
 border:1px solid var(--line);border-radius:8px;padding:11px 14px;cursor:pointer;font-size:13px;
 color:var(--ink2);user-select:none;width:100%;text-align:left;font-family:inherit}
.veh-pax-arrow{color:var(--muted);font-size:15px;transition:transform .3s ease}
.veh.open .veh-pax-arrow{transform:rotate(90deg)}
.veh-pax-list{max-height:0;overflow:hidden;transition:max-height .32s ease;font-size:13px;
 color:var(--ink2);line-height:1.9;padding:0 4px}
.veh.open .veh-pax-list{max-height:200px;padding:8px 4px 0}
.note-row{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line2);
 font-size:13.5px;color:var(--ink2);line-height:1.7}
.note-row::before{content:'—';color:var(--faint);flex-shrink:0;margin-top:1px}

.loc-sec{grid-column:1/-1;padding:32px 40px 44px;border-top:1px solid var(--line)}
/* auto-fill（非 auto-fit）：只有一筆場地時圖片不會撐滿整個版面寬；
   本格線沒有底色，空軌看不見，所以留空軌沒有副作用 */
.loc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;margin-top:24px}
.loc-img-wrap{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--line2);
 border:1px solid var(--line);border-radius:8px}
.loc-img-wrap img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block}
.loc-img-wrap::after{content:attr(data-name);position:absolute;z-index:0;inset:0;display:flex;
 align-items:center;justify-content:center;font-size:13px;letter-spacing:3px;color:var(--faint);
 padding:0 16px;text-align:center}
.loc-cap{border-left:3px solid var(--line);padding:2px 0 2px 12px;margin-top:12px}
.loc-cap-name{font-size:14px;font-weight:600;line-height:1.5}
.loc-cap-addr{font-size:12.5px;color:var(--muted);margin-top:3px}

/* Rundown 分頁：比照 STB 的二分法——標題橫跨在上，左＝分鏡縮圖、右＝地點/停車/道具＋示意圖 */
.tbl-wrap{padding:36px 40px}
.rd-row{display:grid;grid-template-columns:112px 1fr;gap:20px;padding:18px 0;
 border-bottom:1px solid var(--line2)}
.rd-row:last-child{border-bottom:none}
.rd-time{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;
 padding-top:2px}
.rd-time span{display:block;font-size:12px;font-weight:400;color:var(--muted);margin-top:3px}
.rd-head{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}
.rd-type{font-size:11px;letter-spacing:2px;color:var(--muted);border:1px solid var(--line);
 padding:2px 8px;margin-right:-2px;white-space:nowrap}
.rd-title{font-size:16px;font-weight:600}
.rd-cols{display:grid;grid-template-columns:1fr 1fr;gap:2px 26px;align-items:start}
.rd-col-text{min-width:0}.rd-col-media{min-width:0}
.rd-cuts{display:flex;gap:8px;flex-wrap:wrap}
.rd-cut{width:96px}
.rd-cut-box{display:block;aspect-ratio:16/9;background:var(--line2);border-radius:4px;
 overflow:hidden;border:1px solid var(--line)}
.rd-cut-box.portrait{aspect-ratio:9/16}
.rd-cut-box img{width:100%;height:100%;object-fit:cover;display:block}
.rd-cut-no{display:block;font-size:11px;color:var(--muted);margin-top:4px;
 font-variant-numeric:tabular-nums}
.rd-sub{font-size:13.5px;line-height:1.8;display:flex;gap:10px}
.rd-k{color:var(--muted);flex-shrink:0;min-width:2.6em}
.rd-imgs{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.rd-shot{display:block;position:relative;width:160px}
.rd-shot img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:5px;display:block;
 border:1px solid var(--line)}
.rd-shot-tag{position:absolute;left:0;bottom:0;font-size:9px;letter-spacing:1px;color:#fff;
 background:rgba(0,0,0,.55);padding:1px 6px;border-radius:0 4px 0 5px}
@media(max-width:760px){
 .rd-row{grid-template-columns:1fr;gap:8px}
 .rd-cols{grid-template-columns:1fr;gap:12px}
}

/* 分鏡圖分頁 */
.cuts{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px;padding:36px 40px}
.cut{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;
 display:flex;flex-direction:column}
.cut-fr{position:relative;aspect-ratio:16/9;background:var(--line2);border-bottom:1px solid var(--line)}
.cut-fr img{width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1}
.cut-fr::after{content:attr(data-no);position:absolute;inset:0;z-index:0;display:flex;
 align-items:center;justify-content:center;font-size:26px;font-weight:800;color:var(--line)}
.cut-b{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.cut-no{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--muted)}
.cut-no b{color:var(--ink)}
.cut-desc{font-size:14px;line-height:1.6}
.cut-vo{font-size:13px;color:var(--ink2);border-left:2px solid var(--line);padding-left:9px}
.cut-sup{font-size:12px;color:var(--muted);letter-spacing:1px}

footer{padding:22px 40px 40px;border-top:1px solid var(--line);display:flex;
 justify-content:space-between;gap:16px;font-size:12px;color:var(--faint)}

@media(max-width:900px){
 .pg-body{grid-template-columns:1fr}
 .tl-sec{border-right:none;border-bottom:1px solid var(--line);padding:28px 18px}
 .sidebar{padding:28px 18px}
 .hd{padding:26px 18px 20px;flex-direction:column;align-items:flex-start;gap:14px}
 .hd-clock{text-align:left}
 .mc{padding:14px 18px;border-right:none;border-bottom:1px solid var(--line)}
 .loc-sec,.cuts,.tbl-wrap{padding:26px 18px 36px}
 .tl-row{grid-template-columns:62px 24px 1fr;min-height:92px}
 .tl-cards.split{grid-template-columns:1fr}
 footer{padding:20px 18px 32px}
}
@media print{
 :root{--bg:#fff;--line:#c9c4b6;--line2:#e5e5e5}
 .tab-bar,.tl-cur,.tl-fill{display:none}
 .page{display:block!important;break-before:page}
 .page:first-of-type{break-before:auto}
 .tl-row,.ev,.cut,.loc-item{break-inside:avoid}
 a{text-decoration:none}
}
"""

JS = """
(function(){
 var tabs=document.querySelectorAll('.tab'),pages=document.querySelectorAll('.page');
 tabs.forEach(function(t,i){t.addEventListener('click',function(){
   tabs.forEach(function(x){x.classList.remove('on')});
   pages.forEach(function(x){x.classList.remove('on')});
   t.classList.add('on');pages[i].classList.add('on');window.scrollTo(0,0);});});

 document.querySelectorAll('.veh-pax-toggle').forEach(function(b){
   b.addEventListener('click',function(){b.closest('.veh').classList.toggle('open')});});

 var clk=document.getElementById('clk');
 function tick(){var d=new Date();clk.textContent=
   [d.getHours(),d.getMinutes(),d.getSeconds()].map(function(n){return n<10?'0'+n:''+n}).join(':');}
 tick();setInterval(tick,1000);

 // 時間軸游標：只在拍攝當天跑（不是當天就維持中性，不誤導）
 var rows=[].slice.call(document.querySelectorAll('.tl-row')),
     bg=document.querySelector('.tl-bg'),fill=document.querySelector('.tl-fill'),
     cur=document.querySelector('.tl-cur'),
     DATE=document.getElementById('cs-root').dataset.date;  // 日期掛在 #cs-root 而非 body：
                                                            // Artifact 模式的外層骨架不是我們產生的
 if(!rows.length)return;
 function y(r){return r.offsetTop+22+4;}        // 對齊 .tl-dot 圓心
 function layout(){var a=y(rows[0]),b=y(rows[rows.length-1]);
   bg.style.top=a+'px';bg.style.height=(b-a)+'px';bg.style.left='calc(76px + 15px)';
   fill.style.top=a+'px';fill.style.left='calc(76px + 15px)';
   cur.style.left='calc(76px + 15px + 1px)';}
 function paint(){
   layout();
   var d=new Date(),today=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
   if(today!==DATE){cur.style.display='none';fill.style.height='0';return;}
   var now=d.getHours()*60+d.getMinutes(),last=-1;
   rows.forEach(function(r,i){var m=+r.dataset.min,on=m<=now;
     r.querySelector('.tl-time').className='tl-time'+(on?(i===last+1?'':''):'');
     var cls=on?'past':'';
     r.querySelector('.tl-time').classList.add.apply(r.querySelector('.tl-time').classList,cls?[cls]:[]);
     r.querySelector('.tl-dot').className='tl-dot'+(on?' past':'');
     [].forEach.call(r.querySelectorAll('.ev'),function(e){e.className='ev'+(e.dataset.ct?' calltime':'')+(on?' past':'')});
     if(on)last=i;});
   if(last>=0){var r=rows[last];
     r.querySelector('.tl-time').classList.add('on');
     r.querySelector('.tl-dot').className='tl-dot on';
     [].forEach.call(r.querySelectorAll('.ev'),function(e){e.className='ev'+(e.dataset.ct?' calltime':'')+' on'});}
   var a=y(rows[0]),b=y(rows[rows.length-1]),
       f=+rows[0].dataset.min,l=+rows[rows.length-1].dataset.min,pos;
   if(now<=f)pos=a;else if(now>=l)pos=b;else{
     var i=0;while(i<rows.length-1&&+rows[i+1].dataset.min<=now)i++;
     var m0=+rows[i].dataset.min,m1=+rows[i+1].dataset.min,
         y0=y(rows[i]),y1=y(rows[i+1]);
     pos=y0+(y1-y0)*((now-m0)/(m1-m0||1));}
   cur.style.display='block';cur.style.top=pos+'px';fill.style.height=(pos-a)+'px';
 }
 paint();setInterval(paint,30000);window.addEventListener('resize',layout);
})();
"""


def dedupe_images(html_str):
    """同一張圖會同時出現在 Rundown 與分鏡圖分頁，base64 字串等於存兩份。
    抽成一份 IMGS 表、由 JS 掛回 src——16 張圖的案子實測省掉四成。"""
    hits = re.findall(r'src="(data:image/[^"]+)"', html_str)
    if len(hits) == len(set(hits)):
        return html_str          # 沒有重複就別動，免得圖片平白依賴 JS 才顯示
    seen, order = {}, []
    def sub(m):
        url = m.group(1)
        if url not in seen:
            seen[url] = len(order); order.append(url)
        return 'data-i="%d"' % seen[url]
    out = re.sub(r'src="(data:image/[^"]+)"', sub, html_str)
    arr = ",".join(json.dumps(u) for u in order)
    return out + ("\n<script>(function(){var A=[" + arr + "];"
                  "document.querySelectorAll('img[data-i]').forEach(function(e){"
                  "e.src=A[+e.dataset.i]})})();</script>")


def cut_numbers(proj):
    """複製 STB model.ts 的 computeCutNumbers：連續鏡（同 groupId）共用主編號並加 -1/-2，
    多路腳本前綴 A-/B-，隱藏的 cut 不佔號。用陣列索引當編號會跟 App 對不起來。"""
    cuts = proj.get("cuts") or []
    films = proj.get("films") or []
    order = [f["id"] for f in films]
    for c in cuts:
        if c.get("filmId") not in order:
            order.append(c.get("filmId"))
    multi = len(order) > 1
    out = {}
    for fi, fid in enumerate(order):
        sub = [c for c in cuts if c.get("filmId") == fid and not c.get("hidden")]
        for c in cuts:
            if c.get("filmId") == fid and c.get("hidden"):
                out[c["id"]] = "隱藏"
        groups, members = [], {}
        for c in sub:
            g = c.get("groupId") or c["id"]
            if g not in members:
                members[g] = []; groups.append(g)
            members[g].append(c["id"])
        prefix = chr(65 + fi) + "-" if multi else ""
        for idx, g in enumerate(groups):
            mem = members[g]
            main = str(idx + 1).zfill(2)
            for mi, cid in enumerate(mem):
                out[cid] = prefix + main + (f"-{mi+1}" if len(mem) > 1 else "")
    return out


def build(proj, day, artifact=False):
    meta = proj.get("meta", {})
    blocks = day.get("rundown", [])
    starts, t = [], to_min(day.get("callTime") or "08:00")
    for b in blocks:
        starts.append(t); t += int(b.get("durMin") or 0)
    wrap_min = t

    # 第一顆「拍攝」＝開機
    first_shoot = next((i for i, b in enumerate(blocks)
                        if TYPE_LABEL.get(b.get("type")) == "拍攝"), None)

    # callGroups 與 rundown 併成同一條時間軸
    evs = []
    for g in day.get("callGroups", []):
        if not g.get("time"): continue
        evs.append((to_min(g["time"]), {
            "type": "集合通告", "who": E(g.get("label")),
            "meta": [f'<div class="ev-tag">{E(g.get("loc"))}</div>'] if g.get("loc") else []}))
    for i, (b, s) in enumerate(zip(blocks, starts)):
        lab = TYPE_LABEL.get(b.get("type"), "其他")
        m = []
        if b.get("loc"):
            loc = E(b["loc"])
            m.append(f'<a class="map-lnk" href="{E(b["mapUrl"])}" target="_blank" rel="noopener">{loc}</a>'
                     if b.get("mapUrl") else f'<div class="ev-tag">{loc}</div>')
        if b.get("park"): m.append(f'<div class="park-lnk">{E(b["park"])}</div>')
        if b.get("props"): m.append(f'<div class="ev-note">道具｜{E(b["props"])}</div>')
        if b.get("note"): m.append(f'<div class="ev-note">{E(b["note"])}</div>')
        if b.get("parkImage"):
            m.append(f'<div class="ev-img"><img alt="{E(b.get("loc"))}停車位置" src="{b["parkImage"]}"></div>')
        who = ("◀ 開機｜" if i == first_shoot else "") + E(b.get("title"))
        evs.append((s, {"type": lab, "who": who, "meta": m,
                        "ct": i == first_shoot,
                        "dur": f'{b.get("durMin",0)} 分'}))

    rows = []
    for mn in sorted({m for m, _ in evs}):
        group = [e for m, e in evs if m == mn]
        cards = ""
        for e in group:
            mh = '<div class="ev-meta">' + "".join(e["meta"]) + "</div>" if e["meta"] else ""
            ct = ' data-ct="1"' if e.get("ct") else ""
            cards += (f'<div class="ev"{ct}><div class="ev-type">{E(e["type"])}</div>'
                      f'<div class="ev-who">{e["who"]}</div>{mh}</div>')
        dur = next((e["dur"] for e in group if e.get("dur")), "")
        dursm = f"<small>{dur}</small>" if dur else ""
        split = " split" if len(group) == 2 else ""
        rows.append(f'<div class="tl-row" data-min="{mn}">'
                    f'<div class="tl-time">{hhmm(mn)}{dursm}</div>'
                    f'<div class="tl-dc"><div class="tl-dot"></div></div>'
                    f'<div class="tl-cards{split}">{cards}</div></div>')

    # 側欄：聯絡人＋（車輛／注意事項＝STB 尚無此欄，有才顯示）
    side = []
    if proj.get("contacts"):
        side.append('<div><div class="sh"><span class="sh-num">02</span>'
                    '<span class="sh-line"></span><span class="sh-lbl">CONTACTS · 聯絡人</span></div>'
                    + "".join(
                        f'<div class="veh-contact" style="margin-bottom:10px">'
                        f'<div class="veh-contact-role">{E(c.get("role"))}</div>'
                        f'<div class="veh-contact-name">{E(c.get("name"))}</div>'
                        f'<a class="veh-contact-tel" href="tel:{E(c.get("phone"))}">{E(c.get("phone"))}</a></div>'
                        for c in proj["contacts"]) + '</div>')
    if day.get("vehicles"):
        side.append('<div><div class="sh"><span class="sh-num">03</span>'
                    '<span class="sh-line"></span><span class="sh-lbl">VEHICLES · 車輛</span></div>'
                    + "".join(
                        f'<div class="veh"><div class="veh-hd"><span class="veh-name">{E(v.get("label"))}</span>'
                        f'<span class="veh-plate">{E(v.get("plate"))}</span></div><div class="veh-body">'
                        f'<div class="veh-contact"><div class="veh-contact-role">司機</div>'
                        f'<div class="veh-contact-name">{E(v.get("driver"))}</div>'
                        f'<a class="veh-contact-tel" href="tel:{E(v.get("driverPhone"))}">{E(v.get("driverPhone"))}</a></div>'
                        f'<button class="veh-pax-toggle" type="button">乘客名單（{len(v.get("passengers") or [])} 位）'
                        f'<span class="veh-pax-arrow">›</span></button>'
                        f'<div class="veh-pax-list">{E("、".join(v.get("passengers") or []))}</div>'
                        f'</div></div>' for v in day["vehicles"]) + '</div>')
    if day.get("notes"):
        side.append('<div><div class="sh"><span class="sh-num">04</span>'
                    '<span class="sh-line"></span><span class="sh-lbl">NOTES · 注意</span></div>'
                    + "".join(f'<div class="note-row">{E(n)}</div>' for n in day["notes"]) + '</div>')

    # 場地參考＝場景章
    locs = (proj.get("refPages") or {}).get("location") or []
    loc_html = ""
    if locs:
        items = ""
        for l in locs:
            ttl = E(l.get("title"))
            img = f'<img alt="{ttl}" src="{l["imageRef"]}">' if l.get("imageRef") else ""
            items += (f'<div class="loc-item"><div class="loc-img-wrap" data-name="{ttl}">{img}</div>'
                      f'<div class="loc-cap"><div class="loc-cap-name">{ttl}</div>'
                      f'<div class="loc-cap-addr">{E(l.get("note"))}</div></div></div>')
        loc_html = ('<section class="loc-sec"><div class="sh"><span class="sh-num">05</span>'
                    '<span class="sh-line"></span><span class="sh-lbl">LOCATIONS · 場地參考</span></div>'
                    f'<div class="loc-grid">{items}</div></section>')

    # Rundown 分頁（比照 STB：左媒體欄放分鏡縮圖、右文字欄放地點/停車/道具＋示意圖）
    nums = cut_numbers(proj)
    cut_by_id = {c["id"]: c for c in (proj.get("cuts") or [])}
    portrait = " portrait" if proj.get("aspect") == "9:16" else ""
    # 場地照：把 refPages.location 的標題跟區塊 loc 對起來（STB 的場景章沒有綁時段，用名稱比對）
    loc_pics = [(l.get("title") or "", l["imageRef"]) for l in locs if l.get("imageRef")]

    def match_loc(name):
        for t, img in loc_pics:
            if t and name and (t in name or name in t):
                return img
        return None

    rd = ""
    for b, s in zip(blocks, starts):
        thumbs = ""
        for cid in b.get("cutIds") or []:
            c = cut_by_id.get(cid)
            if not c: continue
            inner = f'<img alt="CUT {E(nums.get(cid,""))}" src="{c["imageRef"]}">' if c.get("imageRef") else ""
            thumbs += (f'<span class="rd-cut"><span class="rd-cut-box{portrait}">{inner}</span>'
                       f'<span class="rd-cut-no">{E(nums.get(cid, ""))}</span></span>')
        txt = ""
        for k, v in (("地點", b.get("loc")), ("停車", b.get("park")), ("道具", b.get("props"))):
            if v: txt += f'<div class="rd-sub"><span class="rd-k">{k}</span><span>{E(v)}</span></div>'
        if b.get("note"): txt += f'<div class="rd-sub"><span class="rd-k">備註</span><span>{E(b["note"])}</span></div>'
        shots = ""
        lp = match_loc(b.get("loc") or "")
        if lp: shots += f'<span class="rd-shot"><img alt="場地" src="{lp}"><span class="rd-shot-tag">場地</span></span>'
        if b.get("parkImage"):
            shots += f'<span class="rd-shot"><img alt="停車位置" src="{b["parkImage"]}"><span class="rd-shot-tag">停車</span></span>'
        if shots: txt += f'<div class="rd-imgs">{shots}</div>'
        rd += (f'<div class="rd-row"><div class="rd-time">{hhmm(s)}–{hhmm(s+int(b.get("durMin") or 0))}'
               f'<span>{b.get("durMin",0)} 分</span></div><div class="rd-main">'
               f'<div class="rd-head"><span class="rd-type">{E(TYPE_LABEL.get(b.get("type"),"其他"))}</span>'
               f'<span class="rd-title">{E(b.get("title"))}</span></div><div class="rd-cols">'
               f'<div class="rd-col-media">{f"<div class=rd-cuts>{thumbs}</div>" if thumbs else ""}</div>'
               f'<div class="rd-col-text">{txt}</div></div></div></div>')

    # 分鏡圖分頁
    cuts = proj.get("cuts") or []
    cut_html = ""
    for i, c in enumerate(cuts):
        no = nums.get(c.get("id"), f"{i+1:02d}")   # 用 STB 的編號，不是陣列索引
        img = f'<img alt="CUT {no}" src="{c["imageRef"]}">' if c.get("imageRef") else ""
        shot = "　" + E(c.get("shot")) if c.get("shot") else ""
        vo = f'<div class="cut-vo">VO｜{E(c.get("vo"))}</div>' if c.get("vo") else ""
        sup = f'<div class="cut-sup">SUPER｜{E(c.get("sup"))}</div>' if c.get("sup") else ""
        cut_html += (f'<div class="cut"><div class="cut-fr" data-no="{no}">{img}</div>'
                     f'<div class="cut-b"><div class="cut-no"><b>CUT {no}</b>{shot}</div>'
                     f'<div class="cut-desc">{E(c.get("desc"))}</div>{vo}{sup}</div></div>')

    lead = next((c for c in proj.get("contacts", []) if "製片" in (c.get("role") or "")),
                (proj.get("contacts") or [{}])[0])
    inner = f"""<title>{E(meta.get('title'))}｜{E(day.get('date'))} 拍攝通告</title>
<style>{CSS}</style>
<div id="cs-root" data-date="{E(day.get('date'))}">
<nav class="tab-bar">
  <button class="tab on" type="button"><b>通告單</b><span>CALLSHEET</span></button>
  <button class="tab" type="button"><b>Rundown</b><span>流程表</span></button>
  <button class="tab" type="button"><b>分鏡圖</b><span>STORYBOARD</span></button>
</nav>

<div class="page on"><div class="top-rule"></div>
<header class="hd">
  <div><div class="hd-badge">PRODUCTION CALL SHEET　通告單</div>
    <div class="hd-title">{E(meta.get('title'))}</div>
    <div class="hd-sub">{E(meta.get('client'))}</div></div>
  <div class="hd-clock"><div class="clock" id="clk">--:--:--</div>
    <div class="clock-sub">{E(day.get('date'))}</div></div>
</header>
<div class="meta">
  <div class="mc"><div class="mc-lbl">出品公司</div><div class="mc-val">{E(meta.get('client'))}</div></div>
  {f'<div class="mc"><div class="mc-lbl">統一編號</div><div class="mc-val">{E(meta.get("taxId"))}</div></div>' if meta.get('taxId') else ''}
  <div class="mc"><div class="mc-lbl">CALL TIME</div><div class="mc-val big">{E(day.get('callTime'))}</div></div>
  <div class="mc"><div class="mc-lbl">預計收工</div><div class="mc-val big">{hhmm(wrap_min)}</div></div>
  <div class="mc"><div class="mc-lbl">{E(lead.get('role') or '聯絡')}</div>
    <div class="mc-val">{E(lead.get('name'))}<br>{E(lead.get('phone'))}</div></div>
</div>
<div class="pg-body">
  <section class="tl-sec"><div class="sh"><span class="sh-num">01</span>
    <span class="sh-line"></span><span class="sh-lbl">SCHEDULE · 通告時間</span></div>
    <div class="tl-wrap"><div class="tl-bg"></div><div class="tl-fill"></div>
      <div class="tl-cur"></div>{''.join(rows)}</div></section>
  <aside class="sidebar">{''.join(side)}</aside>
  {loc_html}
</div>
<footer><span>{E(meta.get('title'))}　{E(day.get('date'))}</span><span>由 STB 產生</span></footer>
</div>

<div class="page"><div class="tbl-wrap">{rd}</div></div>

<div class="page"><div class="cuts">{cut_html or '<p style="color:var(--muted)">這個案子還沒有分鏡。</p>'}</div></div>
</div>
<script>{JS}</script>"""
    inner = dedupe_images(inner)
    if artifact:      # Artifact 會自己包 doctype/html/head/body，自帶會衝突
        return inner
    head, rest = inner.split('<div id="cs-root"', 1)   # title/style 進 head，其餘進 body
    return ('<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            + head + '</head><body>\n<div id="cs-root"' + rest + "\n</body></html>")


if __name__ == "__main__":
    argv = sys.argv[1:]
    a = [x for x in argv if not x.startswith("--")]
    flag = lambda n: any(x == "--" + n for x in argv)
    opt = lambda n, d: next((x.split("=", 1)[1] for x in argv if x.startswith("--%s=" % n)), d)
    if not a:
        sys.exit(__doc__)

    src = Path(a[0]); src = src / "project.json" if src.is_dir() else src
    proj = json.loads(src.read_text(encoding="utf-8"))
    days = proj.get("days") or []
    if not days:
        sys.exit("這個案子沒有拍攝日（days 是空的），沒有東西可以做成通告單。")
    want = opt("date", None)
    day = next((d for d in days if d.get("date") == want), days[0]) if want else days[0]

    # 預設就壓。腳本很容易破 40~50 張圖，不壓一定爆掉，也沒辦法用 LINE 傳給劇組。
    if not flag("no-compress"):
        n, b, aft = compress_all(proj, int(opt("maxpx", MAXPX)), int(opt("quality", QUALITY)))
        if n:
            print(f"▸ 壓縮 {n} 張圖：{b/1024/1024:.2f} MB → {aft/1024/1024:.2f} MB"
                  f"（省 {100-aft*100//max(b,1)}%，長邊 {opt('maxpx', MAXPX)}px）")

    artifact = flag("artifact")
    out = Path(a[1]) if len(a) > 1 else src.parent / f"通告單_{day['date']}.html"
    out.write_text(build(proj, day, artifact), encoding="utf-8")
    mb = out.stat().st_size / 1024 / 1024
    print(f"✅ {out}｜{day['date']}　{len(day.get('rundown',[]))} 個流程區塊、"
          f"{len(proj.get('cuts') or [])} 顆分鏡　{mb:.2f} MB"
          + ("（Artifact 用：無 html/body 外層）" if artifact else ""))
    hint = "拿掉 --no-compress" if flag("no-compress") else "調小 --maxpx（例如 --maxpx=1000）"
    if mb > 16:
        print(f"⚠️ 超過 Artifact 的 16MB 上限——{hint} 再跑一次")
    elif mb > 8:
        print(f"⚠️ 檔案偏大，用 LINE 傳給劇組會慢——建議{hint}")
