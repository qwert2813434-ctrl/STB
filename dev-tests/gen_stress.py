#!/usr/bin/env python3
"""產生 STB 壓力測試專案：真實 schema、真圖（data URL 內嵌）、多路多日。"""
import base64, io, json, sys
from PIL import Image, ImageDraw

SHOTS = ["W", "M", "CU", "MS", "ECU", "OTS"]
DESCS = ["陽光穿過樹葉的縫隙", "主角在流理台前洗碗盤", "水滴從碗盤滑落", "遠景：城市清晨的街道",
         "手指劃過玻璃上的霧氣", "腳步走過濕潤的地面", "特寫：眼神望向窗外", "俯瞰：桌面上散落的紙張"]
VOS = ["水，來自自然。", "每當聽見水的聲音", "能感受到它在流動", "它帶來養分，也帶走塵埃",
       "在城市裡，我們忘了它的樣子", "直到重新遇見", "", "安靜，但一直都在"]
PALETTE = [(122,140,120), (150,130,110), (110,125,150), (160,140,150), (130,150,145), (145,120,120)]


def make_image(idx, w, h):
    """生一張帶漸層、色塊與編號的假分鏡圖（每張都不同＝不能被去重）。"""
    base = PALETTE[idx % len(PALETTE)]
    img = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        k = y / h
        d.rectangle([0, y, w, y + 4], fill=(int(base[0]*(1-k*.45)), int(base[1]*(1-k*.45)), int(base[2]*(1-k*.45))))
    for i in range(6):
        x = (idx * 37 + i * 91) % w
        y = (idx * 53 + i * 67) % h
        r = 30 + (idx + i * 13) % 90
        c = PALETTE[(idx + i) % len(PALETTE)]
        d.ellipse([x-r, y-r, x+r, y+r], outline=(min(c[0]+40,255), min(c[1]+40,255), min(c[2]+40,255)), width=3)
    d.rectangle([12, 12, 190, 74], fill=(255, 255, 255))
    d.text((28, 34), f"CUT {idx+1:03d}", fill=(40, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build(n_cuts, n_films, n_days, n_ref_per_chapter, img_w, img_h, title):
    films = [{"id": f"f{i+1}", "name": f"{chr(65+i)}路"} for i in range(n_films)]
    cuts = []
    for i in range(n_cuts):
        gid = f"g{i//3+1}"
        cuts.append({
            "id": f"c{i+1}", "groupId": gid, "filmId": films[i % n_films]["id"],
            "shot": SHOTS[i % len(SHOTS)],
            "desc": f"{DESCS[i % len(DESCS)]}（第 {i+1} 顆）",
            "vo": VOS[i % len(VOS)],
            "sup": f"疊印字卡 {i+1:03d}" if i % 4 == 0 else "",
            "imageRef": make_image(i, img_w, img_h),
            "prompt": f"cinematic, natural light, shot {SHOTS[i % len(SHOTS)]}, frame {i+1}",
            "props": "水杯、毛巾" if i % 5 == 0 else "",
            "note": f"壓測用第 {i+1} 顆——滑動時請注意縮圖是否即時出現、拖曳是否跟手。" if i % 7 == 0 else "",
        })

    days = []
    for dnum in range(n_days):
        blocks = []
        per = max(1, n_cuts // (n_days * 4))
        for b in range(8):
            s = (dnum * 8 + b) * per
            blocks.append({
                "id": f"d{dnum+1}b{b+1}", "durMin": [30, 45, 60, 90][b % 4],
                "type": ["call", "setup", "shoot", "shoot", "meal", "move", "shoot", "other"][b],
                "title": ["集合整備", "場佈打光", "主場拍攝", "續拍", "午餐", "移動至下一場", "傍晚時段", "收工整理"][b],
                "loc": f"示意地點 {dnum+1}-{b+1}", "mapUrl": "", "park": "路邊停車格（示意）",
                "props": "反光板、腳架" if b % 3 == 0 else "",
                "cutIds": [c["id"] for c in cuts[s:s+per]] if b in (2, 3, 6) else [],
                "note": "",
            })
        days.append({
            "id": f"day{dnum+1}", "date": f"2026-09-{(dnum % 28)+1:02d}", "callTime": "07:30",
            "callGroups": [{"label": g, "time": "07:00", "loc": f"集合點 {dnum+1}"} for g in ["製片組", "妝髮組", "導演組", "攝影・燈光・收音"]],
            "rundown": blocks,
            "vehicles": [{"id": f"v{dnum+1}", "label": "製片車", "plate": "ABC-0000", "driver": "示意司機", "driverPhone": "0900-000-000", "passengers": ["示意乘客A", "示意乘客B"]}],
            "notes": ["現場請注意用電安全", "雨備方案見附件"],
        })

    ref_chapters = ["tone", "rhythm", "references", "actor", "wardrobe", "setting", "location"]
    ref_pages = {}
    n = n_cuts
    for ch in ref_chapters:
        items = []
        for j in range(n_ref_per_chapter):
            n += 1
            portrait = ch in ("actor", "wardrobe")
            items.append({
                "id": f"{ch}{j+1}",
                "imageRef": make_image(n, img_h if portrait else img_w, img_w if portrait else img_h),
                "title": f"{ch} 參考 {j+1}",
                "note": "壓測用參考項目，檢查滑動與縮圖載入。",
                "cutRefs": [cuts[(j * 3) % len(cuts)]["id"]] if j % 3 == 0 else [],
                **({"portrait": True} if portrait else {}),
            })
        ref_pages[ch] = items

    return {
        "meta": {"title": title, "client": "壓力測試（Windows 版）", "version": 1, "logo": None},
        "contacts": [{"role": "製片", "name": "示意製片", "phone": "0900-000-000"},
                     {"role": "監製", "name": "示意監製", "phone": "0900-000-000"},
                     {"role": "導演", "name": "高偉鳴", "phone": "0900-000-000"}],
        "films": films, "cuts": cuts, "days": days,
        "milestones": [{"id": f"m{i+1}", "label": lb, "start": f"2026-09-{i*3+1:02d}", "end": f"2026-09-{i*3+3:02d}"}
                       for i, lb in enumerate(["拍攝", "A copy", "客戶回饋", "B copy", "調光", "Final"])],
        "refPages": ref_pages, "mode": "ppm", "aspect": "16:9",
    }


if __name__ == "__main__":
    name, n_cuts, n_films, n_days, n_ref, w, h, title = sys.argv[1:9]
    p = build(int(n_cuts), int(n_films), int(n_days), int(n_ref), int(w), int(h), title)
    with open(name, "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False)
    import os
    print(f"{name}: {os.path.getsize(name)/1024/1024:.1f} MB | cuts={len(p['cuts'])} films={len(p['films'])} days={len(p['days'])}")
