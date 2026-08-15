#!/usr/bin/env python3
# 塗鴉效能壓測案子生成器（2026-08-16，發燙事件的回歸工具）。
# 產出：效能壓力測試/project.json —— c1=700 筆六層（26 萬點）、c2=160 筆三層對照組。
# 用法：python3 gen-stress-project.py [輸出資料夾]
#   → 本機驗證：cp 到 dev-tests/stress-project.json 開 sk-stress-test.html
#   → 推上 iPad：xcrun devicectl device copy to --source <資料夾> \
#       --destination "Documents/效能壓力測試" --domain-type appDataContainer \
#       --domain-identifier com.arminkao.scriptapp --device <UDID>
#     ⚠️ 目的地要寫到「完整資料夾路徑」——只寫 Documents 會把內容物倒在根層。
import json, math, random, os, sys

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

def layer_strokes(n):
    out = []
    for i in range(n):
        out.append(stroke("marker" if i % 4 == 0 else "pen", random.randint(250, 500),
                          random.choice([None, None, 0.6, 1.6]),
                          random.choice([None, None, None, "#b3341c", "#185fa5"])))
    return out

def cut(cid, desc, sketch):
    return {"id": cid, "groupId": "g" + cid, "filmId": "f1", "shot": "", "desc": desc,
            "vo": "", "sup": "", "imageRef": None, "sketch": sketch,
            "prompt": "", "props": "", "note": ""}

monster = {"scene": layer_strokes(150), "figure": layer_strokes(150),
           "extra": [{"name": n, "strokes": layer_strokes(100)}
                     for n in ["運鏡箭頭", "道具", "註記", "光位"]]}
medium = {"scene": layer_strokes(60), "figure": layer_strokes(60),
          "extra": [{"name": "註記", "strokes": layer_strokes(40)}]}

project = {
    "meta": {"title": "效能壓力測試", "client": "暴力測試用・測完即刪", "version": 1, "logo": None},
    "contacts": [{"role": "導演", "name": "高偉鳴", "phone": "0900-000-000"}],
    "films": [{"id": "f1", "name": "A路"}],
    "cuts": [cut("c1", "怪獸：700 筆六層（150+150+4×100），開圖層面板狂畫", monster),
             cut("c2", "中量：160 筆三層，對照組", medium)],
    "days": [{"id": "d1", "date": "2026-08-16", "callTime": "08:00", "callGroups": [], "rundown": []}],
    "refPages": [],
}

out = os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".", "效能壓力測試")
os.makedirs(out, exist_ok=True)
path = os.path.join(out, "project.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(project, f, ensure_ascii=False, separators=(",", ":"))
print(f"{path}  {os.path.getsize(path)/1e6:.1f} MB")
