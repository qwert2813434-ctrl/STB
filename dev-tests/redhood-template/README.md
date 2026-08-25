# 小紅帽手繪分鏡範本　產生器

64 卡（8 頁滿版橫式）的《小紅帽》PPM 範本產生器。分鏡不是圖片，是**向量筆跡**——
直接寫進 `cut.sketch` 的三個圖層，iPad 上點縮圖就能進塗鴉編輯器逐層改。

成品：iCloud `STB/小紅帽_手繪分鏡範本.stb`（iPad 用）與同名資料夾（Mac 用）。

## 圖層設計

| 圖層 | schema 位置 | 內容 |
|------|-------------|------|
| 背景 | `sketch.scene` | 森林／小屋／室內／地面／陰影 |
| 人物 | `sketch.figure` | 小紅帽、狼、外婆、獵人 |
| 物件 | `sketch.extra[0]`（名稱「物件」） | 籃子、花、椅子、速度線、落地陰影 |

`scene`／`figure` 是 STB 固定的兩層，`extra` 是自訂層（上限 4 層、可改名／顯隱／拖曳排序）。

## 檔案

| 檔 | 作用 |
|----|------|
| `draw.mjs` | 筆觸引擎：幾何形狀 →（曲線→弧長取樣→低頻抖動→壓力曲線）→ `SketchStroke` |
| `parts.mjs` | 造型零件：小紅帽／狼／人／樹／小屋／床／籃子／草石花 |
| `sets.mjs` | 場景組：森林、樹冠仰角、花叢、小屋外觀、室內、地面特寫 |
| `story.mjs` | 64 卡的景別／畫面描述／VO／備註／構圖 |
| `build.mjs` | 組 `project.json`（含通告單、甘特、七個參考章） |
| `one.html` | 單卡／單件渲染（給 headless Chrome 截圖用） |
| `contact.html` `sheet.html` | 接觸表／角色表（目視驗貨） |
| `layers.html` `verify.html` | 圖層分解圖／「筆跡重壓平 vs 存檔圖」逐像素比對 |

## 重跑

```bash
cp ../../node_modules/perfect-freehand/dist/esm/index.mjs ./pf.mjs   # 渲染頁面要用
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for i in $(seq 0 63); do "$CH" --headless --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=12000 --hide-scrollbars --screenshot=png/cut$(printf %02d $i).png \
  --window-size=1280,720 "file://$PWD/one.html?i=$i"; done
python3 -c "..."   # 32 色量化（13MB→3.7MB，肉眼無差）
node build.mjs && zip -j 小紅帽_手繪分鏡範本.stb out/*/project.json
```

## 踩過的雷（改之前先看）

1. **渲染參數必須跟 `sketchEditor.ts` 完全一致**，否則樣張跟 App 裡看到的不是同一張：
   `size=(marker?24:7)*size`、`thinning=marker?0:0.55`、`smoothing .5`、`streamline .3`、
   `simulatePressure=（壓力全相同時才 true）`、marker alpha `0.32`、白底、`scene→figure→extra` 順序。
2. **轉角要把控制點寫兩次**（`K()`）。Catmull-Rom 會把腿縫、下擺角、窗框全平滑成拱門——
   第一版的狼四條腿就是這樣變成一座橋。
3. **前景要能蓋住背景就得自己畫遮擋**：線稿沒有不透明度，用白色 `fillPoly()`
   （掃描線填色）先挖掉自己的形狀再畫輪廓。沒有這步，遠景的樹會穿過屋頂。
4. **填色筆畫的壓力要一高一低交錯**。`sketchEditor` 看到「壓力全相同」會改用速度模擬筆鋒，
   填色就出現粗細不均的縫。
5. **特寫的位置一定要從頭部錨點反算**（`placeHead`／`placeAt`），用猜的會整個人出框——
   第一版五顆特寫全是空白。
6. **線寬要跟主體一起縮放**（`scaleInk`）。特寫把角色放大十倍，線還是 7px 就變成髮絲。
7. **`groupId` 相同＝連續鏡群組**，編號會變 `21-1`／`21-2`。每顆各自成組才會是 CUT 01–64；
   本範本刻意留兩對連續鏡示範這個功能（狼靠近→歪頭、掀被→撲起）。
8. **座標精度直接決定檔案大小**：64 卡有 32 萬個點，小數留兩位是 27MB、留一位是 13MB。
9. **壓平圖用 32 色量化**：線稿只有黑紅灰白，量化後 13MB→3.7MB，全解析度目視無差。

## 驗證（改完重跑這三個）

- `node build.mjs` 後用 App 自己的 `normalizeProject` 跑一次（`esbuild src/model.ts --bundle`），
  確認卡數／頁數／編號／圖層／參考章都對。
- `verify.html?i=N` → 從**存檔裡的筆跡**重新壓平，跟嵌進去的 `imageRef` 逐像素比對，
  必須 0 差異（否則使用者一改圖層存回去，畫面就會跳）。
- `contact.html` 目視掃 64 格，特寫最容易出框。
