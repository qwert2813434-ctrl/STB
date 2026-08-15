#!/usr/bin/env python3
# 塗鴉效能壓測案子生成器（2026-08-16，發燙事件的回歸工具）。
# 兩種規模：
#   python3 gen-stress-project.py            → 效能壓力測試（單卡怪獸：c1=700 筆六層 26 萬點、c2=160 筆對照）
#   python3 gen-stress-project.py --cuts 20  → 效能壓力測試20（20 張重卡×200 筆＋1 張怪獸卡，
#                                              操主畫面：縮圖牆、每次編輯的整案 structuredClone、autosave stringify）
# 有 PIL 就順便把筆畫畫成 PNG 縮圖塞 imageRef（主畫面才有真實的 <img> 負載）；沒 PIL 就留 None。
# 推上 iPad：xcrun devicectl device copy to --source <資料夾> \
#     --destination "Documents/<資料夾名>" --domain-type appDataContainer \
#     --domain-identifier com.arminkao.scriptapp --device <UDID>
#   ⚠️ 目的地要寫到「完整資料夾路徑」——只寫 Documents 會把內容物倒在根層。
import json, math, random, os, sys, base64, io

random.seed(42)
W, H = 1280, 720

def stroke(tool="pen", npts=400, size=None, color=None):
    x, y = random.uniform(40, W - 40), random.uniform(40, H - 40)
    a = random.uniform(0, 6.28)
    pts = []
    for _ in range(npts):
        a += random.uniform(-0.4, 0.4)
        x = max(0, min(W, x + math.cos(a) * 2.2))
        y = max(0, min(H, y + math.sin(a) * 2.2))
        pts.append([round(x, 1), round(y, 1), round(random.uniform(0.3, 0.8), 2)])
    s = {"tool": tool, "pts": pts}
    if size: s["size"] = size
    if color: s["color"] = color
    return s

def layer_strokes(n, lo=250, hi=500):
    out = []
    for i in range(n):
        out.append(stroke("marker" if i % 4 == 0 else "pen", random.randint(lo, hi),
                          random.choice([None, None, 0.6, 1.6]),
                          random.choice([None, None, None, "#b3341c", "#185fa5"])))
    return out

def flatten_png(sketch):
    """近似 App 的壓平：筆畫畫成折線 PNG → data URL。沒 PIL 回 None。"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    img = Image.new("RGB", (W, H), "#ffffff")
    d = ImageDraw.Draw(img)
    layers = [sketch["scene"], sketch["figure"]] + [e["strokes"] for e in sketch.get("extra", [])]
    for strokes in layers:
        for s in strokes:
            wpx = int((24 if s["tool"] == "marker" else 7) * s.get("size", 1) * 0.6) or 2
            col = s.get("color", "#141311")
            d.line([(p[0], p[1]) for p in s["pts"]], fill=col, width=wpx, joint="curve")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def cut(cid, desc, sketch):
    return {"id": cid, "groupId": "g" + cid, "filmId": "f1", "shot": "", "desc": desc,
            "vo": "", "sup": "", "imageRef": flatten_png(sketch), "sketch": sketch,
            "prompt": "", "props": "", "note": ""}

def monster_sketch():
    return {"scene": layer_strokes(150), "figure": layer_strokes(150),
            "extra": [{"name": n, "strokes": layer_strokes(100)}
                      for n in ["運鏡箭頭", "道具", "註記", "光位"]]}

def heavy_sketch():  # 「專業重度使用者」等級：200 筆四層
    return {"scene": layer_strokes(60, 200, 400), "figure": layer_strokes(60, 200, 400),
            "extra": [{"name": "運鏡箭頭", "strokes": layer_strokes(40, 200, 400)},
                      {"name": "註記", "strokes": layer_strokes(40, 200, 400)}]}

many = "--cuts" in sys.argv
n_cuts = int(sys.argv[sys.argv.index("--cuts") + 1]) if many else 0
title = f"效能壓力測試{n_cuts}" if many else "效能壓力測試"

cuts = []
if many:
    for i in range(n_cuts):
        cuts.append(cut(f"c{i+1}", f"重卡 {i+1}／{n_cuts}：200 筆四層", heavy_sketch()))
    cuts.append(cut("cm", "怪獸卡：700 筆六層", monster_sketch()))
else:
    cuts.append(cut("c1", "怪獸：700 筆六層（150+150+4×100），開圖層面板狂畫", monster_sketch()))
    cuts.append(cut("c2", "中量：160 筆三層，對照組",
                    {"scene": layer_strokes(60), "figure": layer_strokes(60),
                     "extra": [{"name": "註記", "strokes": layer_strokes(40)}]}))

project = {
    "meta": {"title": title, "client": "暴力測試用・測完即刪", "version": 1, "logo": None},
    "contacts": [{"role": "導演", "name": "高偉鳴", "phone": "0900-000-000"}],
    "films": [{"id": "f1", "name": "A路"}],
    "cuts": cuts,
    "days": [{"id": "d1", "date": "2026-08-16", "callTime": "08:00", "callGroups": [], "rundown": []}],
    "refPages": [],
}

out = os.path.join(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ".", title)
os.makedirs(out, exist_ok=True)
path = os.path.join(out, "project.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(project, f, ensure_ascii=False, separators=(",", ":"))
total_pts = sum(len(s["pts"]) for c in cuts for L in
                [c["sketch"]["scene"], c["sketch"]["figure"]] + [e["strokes"] for e in c["sketch"].get("extra", [])]
                for s in L)
print(f"{path}  {os.path.getsize(path)/1e6:.1f} MB／{len(cuts)} cuts／{total_pts:,} 點")
