# STB × AI 編輯指南（給任何 AI 的 project.json 說明書）

> **這份文件是給 AI 看的。** 把它連同你的需求貼給 ChatGPT／Gemini／Claude，
> 或用 Claude Code 直接打開案子資料夾，AI 就能用自然語言幫你寫腳本、改通告。
> **STB 開著的時候，project.json 被外部修改會在 2 秒內自動重載**——AI 存檔，
> 畫面即時更新。

## 運作原理（30 秒版）

一個案子＝一個資料夾，唯一真相＝`{案子資料夾}/project.json`。
STB 的所有畫面都是從這份 JSON 算出來的——**改 JSON 就是改案子**。
AI 不需要操作介面，只需要產出／修改合法的 project.json。

```
使用者：「幫我把第 3 顆 cut 改成特寫，VO 改成『水來自自然』」
AI：讀 project.json → 找 cuts[2] → 改 shot 與 vo → 存檔
STB：自動重載，畫面更新 ✓
```

## Schema 總覽

```jsonc
{
  "meta": { "title": "案名", "client": "製作公司", "version": 1, "logo": null },
  "contacts": [ { "role": "製片", "name": "", "phone": "" } ],
  "films": [ { "id": "f1", "name": "A路 30秒" } ], // 多路腳本：一份 PPM 多支片，至少一路
  "cuts": [ /* 分鏡，見下；每顆有 filmId 歸屬某一路，各路獨立 CUT 01 起跳 */ ],
  "days": [ /* 拍攝日（通告＋Rundown），見下 */ ],
  "milestones": [ /* 甘特圖事項，見下 */ ],
  "refPages": { /* 圖文參考章，見下 */ },
  "hiddenChapters": [],  // 這次簡報不給客戶看的章 id，例 ["actor"]
  "mode": "ppm",         // ppm＝完整十章；schedule＝通告排表（製片版）
  "aspect": "9:16"       // 分鏡比例：直式廣告用 "9:16"。⚠️ 省略＝橫式 16:9（預設）。
                         // 整片一次定案；影響分鏡格方向、匯入裁切、塗鴉畫布。
}
```

### cuts（分鏡）——最常編輯的區塊

```jsonc
{
  "id": "c1",            // 唯一字串 id；新增時用不重複的新值
  "filmId": "f1",        // 屬於哪一路（films 的 id）；多路時編號顯示 A-01、B-01
  "groupId": "g1",       // 相同 groupId＝連續鏡群組（編號變 05-1/05-2）。
                         // ⚠️ 同群組的 cut 在陣列中必須相鄰
  "shot": "特寫",         // 景別：大景/中景/特寫＋俯拍/平拍 等自由組合
  "desc": "手指劃過水面",  // 畫面描述（建議含構圖邏輯：固定/手持/跟拍）
  "vo": "水來自自然",      // 旁白（無則空字串）
  "sup": "",             // SUPER 疊印字卡（無則空字串）
  "imageRef": null,      // 分鏡圖。⚠️ AI 不要動這欄（data URL，動了圖就沒了）
  "sketch": null,        // 塗鴉分鏡筆跡（App 內 Apple Pencil／滑鼠畫的）。
                         // ⚠️ AI 不要動：{scene, figure} 為筆畫點陣資料、
                         // underlay 為墊底照片；imageRef 是它壓平的輸出
  "prompt": "", "props": "", "note": ""
}
```

### days（拍攝日：通告＋Rundown）

```jsonc
{
  "id": "d1",
  "date": "2026-07-20",          // YYYY-MM-DD
  "callTime": "08:00",           // HH:MM——整天 Rundown 的起點
  "callGroups": [ { "label": "A組演員", "time": "07:30", "loc": "現場" } ],
  "rundown": [
    {
      "id": "b1",
      "durMin": 30,              // 分鐘，5 的倍數；起訖時間由 App 自動連鎖計算
      "type": "拍攝",            // 集合｜拍攝｜移動｜場佈｜用餐｜其他
      "title": "場景A 外景日戲",
      "loc": "", "mapUrl": "", "park": "", "props": "", "note": "",
      "parkImage": null,         // ⚠️ AI 不要動（data URL）
      "cutIds": ["c1", "c2"]     // 這個時段要拍哪幾顆 cut（引用 cuts 的 id）
    }
  ]
}
```

### milestones（製作時程甘特圖）

```jsonc
{ "id": "m1", "label": "拍攝", "start": "2026-07-20", "end": "2026-07-20", "color": "#185fa5" }
```

### refPages（圖文參考章）

key＝章節 id：`tone` 調性｜`rhythm` 參考節奏｜`references` 參考資料｜
`actor` 演員｜`wardrobe` 服裝｜`setting` 美術道具｜`location` 場景

```jsonc
"tone": [
  {
    "id": "t1",
    "title": "自然光生活感",
    "note": "色調乾淨明亮",
    "imageRef": null,        // ⚠️ AI 不要動
    "videoUrl": "",          // 外部影片連結可以填
    "videoFile": null,       // ⚠️ AI 不要動（assets/ 檔案連結）
    "cutRefs": ["c3"],       // 對照的分鏡 cut id
    "portrait": true         // 直式縮圖（rhythm/references 章匯圖時自動判定）。
                             // ⚠️ AI 不要動：由 App 依素材方向設定。
  }
]
```

> 章節方向：`actor`/`wardrobe` 恆直式；`tone` 跟隨整片 `aspect`；
> `rhythm`/`references` 逐項依素材方向（`portrait` 旗標）；其餘橫式。

## AI 必守規則

1. **不要動任何 `imageRef`／`sketch`／`videoFile`／`parkImage`／`logo`**——它們是圖檔資料、筆跡資料或素材連結，改了內容就消失。改文字、改結構、增刪項目都安全。
2. **id 唯一**：新增項目給不重複的字串 id（如 `c9`、`b7`、`ai1`）。
3. **連續鏡相鄰**：相同 `groupId` 的 cut 必須在陣列裡緊鄰。
4. 時間 `HH:MM`、日期 `YYYY-MM-DD`、`durMin` 用 5 的倍數。
5. **保留你看不懂的欄位**，整份輸出、不要只輸出片段。
6. 不要動案子資料夾裡 `assets/` 的任何檔案。

App 端有防呆（缺欄位自動補預設、⌘Z 可復原），但守上面規則體驗最好。

## 常見指令範例

- 「照這個 schema 幫我生一支 30 秒飲料廣告的 project.json：8 顆 cut、水感調性」
- 「把 cuts 裡所有 VO 改成台語口語感」
- 「幫我排 7/20 的 Rundown：8 點集合、上午拍 c1–c4、午餐一小時、下午拍完收工」
- 「新增一個拍攝日 7/21，通告設定沿用 7/20」
