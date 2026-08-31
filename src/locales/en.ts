// 英文語言包：key＝繁中原文（與程式碼內字串逐字相同），value＝英文。
// 術語唯一權威＝開發文件《07_在地化對照表.html》：cut→shot、Rundown→Shooting Schedule、
// 通告單→Call Sheet、Tone & Manner→Look & Feel、VO/SUPER 原樣（英語原生詞）。
export const en: Record<string, string> = {
  // ---- 工具列 ----
  "▶ 預覽": "▶ Preview",
  "匯出…": "Export…",
  "專案…": "Projects…",
  "儲存專案": "Save Project",
  "另存新檔…": "Save As…",
  "深色": "Dark",
  "淺色": "Light",
  "切換日／夜": "Toggle light / dark",
  "使用說明與版本資訊": "Help & version info",
  "說明": "Help",
  "點擊修改案名": "Click to rename",
  "案名": "Project name",
  "・未存變更": "・Unsaved changes",
  "・已存檔": "・Saved",
  "未存檔（按「儲存專案」選資料夾）": "Not saved yet (click “Save Project” to pick a folder)",
  "存檔失敗：{err}": "Save failed: {err}",
  "{name}・已從外部更新": "{name}・updated externally",

  // ---- 章節／狀態列 ----
  "分鏡": "Storyboard",
  "目錄": "Agenda",
  "調性": "Look & Feel",
  "參考節奏": "Rhythm",
  "參考資料": "References",
  "演員": "Talent",
  "服裝": "Wardrobe",
  "美術道具": "Art & Set",
  "場景": "Locations",
  "製作時程": "Schedule",
  "{n} 章": "{n} chapters",
  "點左側章節開始，或點目錄項目": "Pick a chapter on the left, or click an agenda item",
  "{n} 顆 cut": "{n} shots",
  "頁數": "Pages",
  "把手 ⠿ 拖曳重排 · 點文字直接編輯 · 長按卡片＝多選 · 復原鈕在右上": "Drag ⠿ to reorder · tap text to edit · long-press for multi-select · Undo lives top right",
  "把手 ⠿ 拖曳重排 · 點文字直接編輯 · ⌘/Shift 點擊多選": "Drag ⠿ to reorder · click text to edit · ⌘/Shift-click to multi-select",
  "拍攝日": "Shoot day",
  "（未定）": "(TBD)",
  "集合": "Call",
  "收工": "Wrap",
  "通告單在前 · 該日 Rundown 在後": "Call sheet first · that day’s shooting schedule below",
  "項目": "Items",
  "貼參考圖＋說明，向客戶對齊調性": "Drop reference images + notes to align the client on look & feel",
  "拍攝日程（通告單＋Rundown）": "Shoot Days (Call Sheet + Shooting Schedule)",
  "同一個案子檔，隨時可切換": "Same project file — switch anytime",
  "⇱ 展開完整 PPM": "⇱ Expand to full PPM",
  "⇲ 通告排表模式": "⇲ Schedule-only mode",

  // ---- 分鏡卡／分鏡章 ----
  "CUT {label}": "SHOT {label}",
  "新增 cut（插在後面）": "Add shot (after)",
  "＋ 新增 cut": "+ Add shot",
  "在選取的 cut 之後新增一顆（沒選＝加在最後）": "Add a shot after the selected one (none selected = at the end)",
  "＋ 連續鏡": "+ Link shots",
  "拆除群組": "Unlink group",
  "連續鏡：拖任一子鏡整組同行 · 拆除＝整組拆散": "Linked shots: drag any one and the group moves together · unlink to split",
  "組成連續鏡": "Link as one group",
  "+ VO": "+ VO",
  "+ Super": "+ Super",
  "VO": "VO",
  "SUPER": "SUPER",
  "畫面描述": "Description",
  "旁白 / 台詞": "VO / dialogue",
  "疊印字卡": "Supers / on-screen text",
  "塗鴉": "Sketch",
  "Apple Pencil／滑鼠塗鴉分鏡（Pencil 直接點縮圖也可）": "Sketch with Apple Pencil or mouse (Pencil can tap the frame directly)",
  "塗鴉分鏡（Apple Pencil／滑鼠）": "Sketch this shot (Apple Pencil / mouse)",
  "複製": "Duplicate",
  "刪除": "Delete",
  "刪除選取": "Delete selected",
  "已選 {n} 顆": "{n} selected",
  "完成": "Done",
  "點卡片＝加選/取消 · 按「完成」結束": "Tap cards to select/deselect · press “Done” to finish",
  "⌘ 點擊加選 · Shift 點擊連選": "⌘-click to add · Shift-click for a range",
  "⇒ 指派到時段": "⇒ Assign to block",
  "拖曳移動整張卡": "Drag to move this card",
  "隱藏這顆（預覽/匯出看不見、不佔編號；點灰格顯示回來）": "Hide this shot (invisible in preview/export, keeps no number; click the gray slot to bring it back)",
  "隱藏": "Hide",
  "隱藏 {n} 顆{scout}——點一下顯示回來": "{n} hidden{scout} — click to show",
  "（含場勘）": " (incl. scout)",
  "頁 {a} / {b}": "Page {a} / {b}",
  // 景別／秒數欄（2026-07-28；日文版預設開，zh/en 預設關）
  "欄位": "Fields",
  "景別": "Size",
  "秒數": "Duration",
  "秒": "s",
  "每顆 cut 顯示景別（W／M／CU）": "Show shot size (W / M / CU) on every shot",
  "每顆 cut 顯示秒數，頁尾自動合計": "Show duration on every shot, totalled at the foot of the page",
  "合計 {n} 秒": "{n}s total",
  "・{n} 顆未填": " · {n} not set",
  // VO 稿面板（2026-08-03；朋友許願「VO 要能獨立預覽」＋純文字稿給配音/演員）
  "VO稿": "VO Script",
  "VO 稿": "VO Script",
  "整路旁白攤開連著讀（點行跳到那顆 cut）": "Read the whole narration in one flow (click a line to jump to that shot)",
  "跳到這顆 cut": "Jump to this shot",
  "複製全文": "Copy All",
  "純文字複製——傳給配音、演員的乾淨 VO 稿": "Copy as plain text — a clean VO script for voice talent",
  "已複製": "Copied",
  "還沒有任何 VO": "No VO yet",
  "{n} 句・{m} 字・唸稿估 ≈ {s} 秒": "{n} lines · {m} words · ≈ {s}s read aloud",
  "・畫面合計 {t} 秒": " · boards total {t}s",

  "分鏡格": "Grid",
  "4 欄・4 格一頁，閱讀舒服": "4 columns · 4 per page, easy reading",
  "大": "Large",
  "6 欄・12 格一頁，一次看更多": "6 columns · 12 per page, see more at once",
  "密": "Dense",
  "顯示": "Show",
  "導演的分鏡圖": "Director’s storyboard frames",
  "攝影師 STB Camera 帶回的現場鏡位圖": "On-location framing photos from STB Camera",
  "場勘": "Scout",
  "＋ 分鏡圖": "+ Frame",
  "＋ 場勘圖": "+ Scout photo",
  "把這張分鏡圖存成檔案": "Save this frame as a file",
  "存這張場勘圖": "Save this scout photo",
  "刪除這張場勘圖（分鏡不動）": "Delete this scout photo (frames untouched)",
  "刪除這張場勘圖？分鏡圖不受影響（可 ⌘Z 復原）。": "Delete this scout photo? Frames are untouched (⌘Z to undo).",
  "刪除本案全部場勘圖（分鏡不動，⌘Z 可復原）": "Delete all scout photos in this project (frames untouched, ⌘Z to undo)",
  "刪除本案全部 {n} 張場勘圖？分鏡圖不受影響（⌘Z 可復原）。": "Delete all {n} scout photos? Frames are untouched (⌘Z to undo).",
  "全幅": "Full",

  // ---- 多路腳本 ----
  "{x}路": "Version {x}",
  "＋ 一路": "+ Version",
  "路名": "Version name",
  "點名字直接改": "Click the name to edit",
  "切換到這一路": "Switch to this version",
  "刪除此路（含其分鏡）": "Delete this version (and its shots)",
  "一份 PPM 多支片：每路獨立 CUT 01 起跳": "One PPM, multiple films: each version numbers from SHOT 01",
  "刪除「{name}」？此路的 {n} 顆分鏡（含 Rundown 指派）會一併刪除。": "Delete “{name}”? Its {n} shots (incl. schedule assignments) will be removed.",

  // ---- 匯入分鏡圖 ----
  "＋ 匯入分鏡圖": "+ Import frames",
  "選其他軟體輸出的分鏡圖檔（可多選），每張自動變成一顆 cut": "Pick frames exported from other tools (multi-select) — each image becomes a shot",
  "外部軟體做的分鏡：多選圖檔一次帶入，拖曳排序、⌘/Shift 多選組連續鏡或指派到時段": "Boards made elsewhere: bring in multiple images at once, drag to sort, ⌘/Shift-select to link or assign",
  "這個案子還沒有分鏡。": "No shots in this project yet.",
  "按左下「＋ 匯入分鏡圖」，把其他軟體輸出的分鏡圖（可多選）一次帶進來。": "Use “+ Import frames” (bottom left) to bring in frames exported from other tools.",
  "選擇場勘照片": "Choose scout photos",
  "圖片": "Images",
  "圖片或影片": "Images or video",
  "選擇圖片或影片": "Choose an image or video",
  "選擇影片檔": "Choose a video file",
  "影片": "Video",
  "正在準備照片…（在 iCloud 的原檔會先下載）": "Preparing photos… (originals still in iCloud will download first)",
  "無法解碼（{err}）": "Could not decode ({err})",
  "格式不支援": "Unsupported format",
  "超過繪圖上限（畫布為空）": "Over the drawing limit (canvas is empty)",
  "這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次。": "Couldn’t read this photo — if the original is still in iCloud, wait a few seconds and try again.",
  "這張照片讀不進來——等幾秒再試一次。": "Couldn’t read this photo — wait a few seconds and try again.",
  "這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次；全景/超大圖請先裁切。": "Couldn’t read this photo — if it’s still in iCloud, wait and retry; crop panoramas/huge images first.",
  "剛剛的點選已經讓 iCloud 開始下載這幾張了——\n等個幾秒，再按一次「＋ 匯入分鏡圖」選同樣的照片，通常第二次就會成功。\n（一直失敗的話：設定 → 照片 → 改「下載並保留原始檔」可根治）": "Your tap just told iCloud to start downloading these.\nWait a few seconds, then press “+ Import frames” and pick the same photos — the second try usually works.\n(If it keeps failing: Settings → Photos → “Download and Keep Originals” fixes it for good.)",
  "☁️ {n} 張的原始檔還在 iCloud：\n{names}\n\n{hint}\n": "☁️ {n} originals are still in iCloud:\n{names}\n\n{hint}\n",
  "\n⚠️ {n} 張讀取失敗（尺寸/格式超過系統上限，全景照與超大圖常見）：\n{names}\n\n可在「照片」App 裁切或縮小後再加入。": "\n⚠️ {n} failed to load (size/format over the system limit — common with panoramas and huge images):\n{names}\n\nCrop or downsize them in Photos, then add again.",

  // ---- 裁切器 ----
  "拖曳定位・滑桿縮放": "Drag to position · slider to zoom",
  "黑白": "B&W",
  "換一張圖": "Replace image",
  "套用": "Apply",
  "清除": "Clear",
  "確定": "OK",
  "取消": "Cancel",
  "關閉": "Close",

  // ---- 對照 cut ----
  "對照分鏡 — 勾選對應的 cut": "Match to shots — tick the corresponding ones",
  "對照分鏡": "Match shots",
  "對照 cut": "Matched shots",
  "對照 {refs}": "Ref {refs}",
  "對照 CUT": "REF SHOT",

  // ---- 指派到時段 ----
  "指派到時段 — 這批 cut 要在哪個場次拍": "Assign to block — where do these shots get filmed",
  "（未命名時段）": "(untitled block)",
  "{n} 顆": "{n} shots",
  "這天還沒有時段——先到 Rundown 新增時段。": "No blocks on this day yet — add one in the shooting schedule first.",

  // ---- Rundown（Shooting Schedule）----
  "Rundown · 拍攝日程 · A5 橫": "Shooting Schedule · A5 landscape",
  "點擊切換類型": "Click to cycle type",
  "時段名稱": "Block title",
  "地點": "Location",
  "停車": "Parking",
  "停車資訊": "Parking info",
  "道具": "Props",
  "道具準備": "Props to prepare",
  "停車位置": "Parking spot",
  "＋ 停車圖": "+ Parking photo",
  "把停車圖存成檔案": "Save parking photo as a file",
  "移除停車圖": "Remove parking photo",
  "減 5 分": "Minus 5 min",
  "{n} 分": "{n} min",
  "加 5 分": "Plus 5 min",
  "刪除時段": "Delete block",
  "＋ 新增時段": "+ Add block",
  "新時段": "New block",
  "拖曳排序": "Drag to reorder",
  // BlockType 顯示名（BLOCK_TYPE_LABELS 值）
  "拍攝": "Shoot",
  "移動": "Move",
  "場佈": "Setup",
  "用餐": "Meal",
  "其他": "Other",

  // ---- 通告單（Call Sheet）----
  "通告單 · A5 橫": "Call Sheet · A5 landscape",
  "拍攝通告單": "CALL SHEET",
  "拍攝通告": "Call Sheet",
  "片名": "Title",
  "預計收工": "Est. wrap",
  "製作": "Production",
  "製作公司": "Production company",
  "統編": "Tax ID",
  "公司統編": "Company tax ID",
  "聯絡人": "Contacts",
  "職位": "Role",
  "還沒有人。按「補上標準八條」帶入台灣廣告最常列的八個職務，或自己一個一個加。": "No one yet. Tap “Add the standard eight” for the roles Taiwanese commercials list most often, or add people one by one.",
  "通告": "Call",
  "上通告單（現場要打電話找的人）": "Put on the call sheet (people to reach on set)",
  "從專案刪除這個人": "Delete this person from the project",
  "從通告單移除": "Remove from call sheet",
  "從通告單移除（人留在工作人員名單）": "Remove from call sheet (stays in the crew list)",
  "標「通告」的人才會出現在通告單上": "Only people marked Call appear on the call sheet",
  "工作人員": "Crew",
  "人數": "People",
  "放進簡報與匯出": "Include in deck & export",
  "客戶會看到這一頁": "Clients will see this page",
  "目前只在編輯器裡，客戶看不到": "Editor only — clients won't see it",
  "補上標準八條": "Add the standard eight",
  "匯出 credits.json": "Export credits.json",
  "＋ 新增人員": "+ Add person",
  "跟通告單共用同一份名單 · 這裡不顯示電話": "Same list as the call sheet · phone numbers hidden here",
  "IG 帳號": "IG",
  "姓名": "Name",
  "製片": "Producer",
  "監製": "Executive Producer",
  "導演": "Director",
  "刪除聯絡人": "Delete contact",
  "新增聯絡人": "Add contact",
  "大組通告時間": "General call times",
  "組別／演員": "Dept / Talent",
  "集合地點": "Call location",
  "刪除組別": "Delete group",
  "＋ 新增組別": "+ Add group",
  // ---- 車輛／注意事項（通告章，1.6.3 新增）----
  "車輛": "Vehicles",
  "演員車": "Talent van",
  "車牌": "Plate",
  "司機": "Driver",
  "乘客（逗號分隔）": "Passengers (comma-separated)",
  "刪除車輛": "Delete vehicle",
  "＋ 新增車輛": "+ Add vehicle",
  "注意事項": "Notes",
  "寫一條注意事項": "Write a note",
  "刪除注意事項": "Delete note",
  "＋ 新增注意事項": "+ Add note",
  "Day {n}": "Day {n}",
  "確定刪除 Day {n}？": "Delete Day {n}?",
  "刪除此拍攝日": "Delete this shoot day",
  "＋ 新增拍攝日": "+ Add shoot day",
  "確定刪除 Day {day}？此拍攝日的通告與 Rundown 會一併刪除。": "Delete Day {day}? Its call sheet and shooting schedule will be removed too.",
  "通告單 · Day {n}": "Call Sheet · Day {n}",
  "未命名通告": "Untitled call sheet",

  // ---- 甘特 ----
  "Schedule · 製作時程 · A5 橫": "Schedule · Production Calendar · A5 landscape",
  "上移": "Move up",
  "下移": "Move down",
  "選顏色": "Pick color",
  "顏色": "Color",
  "事項": "Item",
  "拖曳移動；拉左右緣改起訖日": "Drag to move; pull the edges to change dates",
  "調整起始日": "Adjust start date",
  "調整結束日": "Adjust end date",
  "未設日期": "No date",
  "刪除事項": "Delete item",
  "＋ 新增事項": "+ Add item",
  "新事項": "New item",

  // ---- 匯出對話框 ----
  "匯出": "Export",
  "封面＋章節標題頁": "Cover + chapter title pages",
  "深色版面": "Dark layout",
  "深色＝黑底白字的螢幕版；亮色＝米白印刷版。預設跟著你現在的主題。只作用於 PDF 與預覽——PPTX 可編輯版恆為亮色。": "Dark = black-background screen version; light = off-white print version. Follows your current theme by default. Applies to PDF and preview only — editable PPTX is always light.",
  "頁面小標": "Page headers",
  "匯出 PDF": "Export PDF",
  "匯出 PPTX（可編輯）": "Export PPTX (editable)",
  "整個專案（含影片素材）壓成一個 .stb 檔——對方的 STB 開啟即還原完整專案": "Zips the whole project (incl. video assets) into one .stb — opens as the full project in their STB",
  "打包專案匯出": "Package project",
  "只含分鏡章的輕量 .stb——AirDrop 給手機 STB Camera 場勘用": "Lightweight .stb with just the storyboard — AirDrop to STB Camera for scouting",
  "匯出分鏡 for STBC": "Export shots for STBC",
  "勾選要匯出的章節。PDF＝與縮圖完全一致的成品；PPTX＝可編輯重排版——文字可改、圖片可換、本機影片嵌入（Keynote／PowerPoint 可播）、影片連結可點。打包專案＝整案（含素材）壓成一個 .stb 檔，傳給另一台 Mac／iPad 的 STB 直接開；匯出分鏡 for STBC＝輕量分鏡包給手機場勘。": "Tick the chapters to export. PDF = exactly what you see; PPTX = fully editable — change text, swap images, local videos embedded (plays in Keynote/PowerPoint), video links clickable. Package project = the whole project (incl. assets) as one .stb that opens directly in STB on another Mac/iPad; Export for STBC = a lightweight shot pack for scouting on the phone.",
  "擷取頁面中…": "Capturing pages…",
  "擷取頁面中… {done} / {total}": "Capturing pages… {done} / {total}",
  "沒有可匯出的內容——先在各章加入內容。": "Nothing to export — add content to the chapters first.",
  "首頁＋封面": "Logo + cover",
  "沒有選取任何頁面。": "No pages selected.",
  "組裝 {kind}…": "Assembling {kind}…",
  "開啟分享…": "Opening share sheet…",
  "匯出失敗：{msg}": "Export failed: {msg}",
  "案子還沒儲存——先按「儲存專案」，打包才有東西可包。": "The project isn’t saved yet — press “Save Project” first so there’s something to package.",
  "STB 打包案子": "STB packaged project",
  "打包失敗：{err}": "Packaging failed: {err}",
  "擷取失敗：{msg}": "Capture failed: {msg}",

  // ---- PPTX 匯出 ----
  "未命名案子": "Untitled project",
  "PPM ・ 前製會議": "PPM — Pre-Production Meeting",
  "組裝 PPTX…{label}": "Assembling PPTX… {label}",
  "處理影片…{name}（大檔自動轉 720p，可能需要一點時間）": "Processing video… {name} (large files auto-convert to 720p, this can take a while)",
  "嵌入影片…{name}": "Embedding video… {name}",
  "播放影片": "Play video",
  "▶ 影片連結": "▶ Video link",
  "頁 {p}/{total}": "Page {p}/{total}",

  // ---- 簡報模式 ----
  "上一頁": "Previous",
  "下一頁": "Next",
  "章節": "Chapters",
  "離開預覽": "Exit preview",
  "Esc 離開": "Esc to exit",
  "切回米白（印刷版面）": "Switch to cream (print layout)",
  "切成黑底簡報": "Switch to dark presentation",
  "給客戶看的章節（空章自動跳過）": "Chapters the client sees (empty ones auto-skip)",
  "各章都還沒有內容": "No content in any chapter yet",
  "A5 橫": "A5 landscape",
  "COVER · 首頁": "COVER",
  "AGENDA · 目錄 · A5 橫": "AGENDA · A5 landscape",
  "點擊替換 LOGO": "Click to replace logo",
  "點 LOGO 替換（建議透明 PNG）": "Click the logo to replace it (transparent PNG recommended)",
  "還原預設": "Reset to default",

  // ---- 參考頁 ----
  "此章尚無內容。按「＋ 新增項目」貼上參考圖與說明。": "Nothing here yet. Press “+ Add item” to drop in references and notes.",
  "＋ 加入檔案（圖片／影片）": "+ Add file (image / video)",
  "＋ 圖片": "+ Image",
  "播放／開啟": "Play / open",
  "把這張圖存成檔案": "Save this image as a file",
  "標題": "Title",
  "說明／備註": "Notes",
  "影片連結（YouTube／Vimeo／雲端）": "Video link (YouTube / Vimeo / cloud)",
  "連結（地圖／網頁／雲端）": "Link (map / web / cloud)",
  "＋ 影片連結": "+ Video link",
  "＋ 連結": "+ Link",
  "＋ 本機影片": "+ Local video",
  "拖曳調整順序": "Drag to reorder",
  "刪除項目": "Delete item",
  "＋ 新增項目": "+ Add item",
  "停止播放": "Stop playback",
  "影片載入失敗：{err}": "Video failed to load: {err}",
  "▶ 預覽片段": "▶ Preview clip",
  "不裁切": "No trim",
  "起點": "In",
  "終點": "Out",
  "{start} – {end}　（全長 {dur}）": "{start} – {end}　(full length {dur})",

  // ---- 專案 hub ----
  "專案": "Projects",
  "案子": "Projects",
  "最近案子": "Recent projects",
  "載入中…": "Loading…",
  "＋ 創建新專案": "+ New Project",
  "製片版：分鏡整理＋甘特／通告單／Rundown 的輕量排表案；隨時可展開成完整 PPM": "Producer mode: shot sorting + Gantt / call sheet / shooting schedule, expandable to a full PPM anytime",
  "＋ 排表流程": "+ Schedule-only",
  "從 iCloud 雲碟／檔案 App 選打包案子（.stb），複製進來解開": "Pick a packaged project (.stb) from iCloud Drive / Files and unpack a copy here",
  "匯入案子…": "Import project…",
  "開啟舊專案…": "Open project…",
  "開啟收到的 .stb 分鏡包（解開成專案）": "Open a received .stb pack (unpacks into a project)",
  "匯入分鏡…": "Import shots…",
  "匯入 STB Camera 的場勘包／自建分鏡包——照片按 cut 對位": "Import an STB Camera scout pack / field-made board — photos auto-match by shot",
  "匯入 STBC 項目…": "Import STBC package…",
  "打包": "Packed",
  "目前": "Current",
  "打包案子——點一下解開成資料夾並開啟": "Packaged project — click to unpack and open",
  "檔案 App ▸ STB ▸ {name}": "Files ▸ STB ▸ {name}",
  "從清單移除（不會刪除案子本身）": "Remove from list (doesn’t delete the project)",
  "案子放在「檔案」App ▸ 我的 iPad ▸ <b>STB</b>，一案一資料夾。備份／改名／刪除請在檔案 App 對<b>整個資料夾</b>操作。收到別人傳的 <b>.stb 打包案子</b>：存進同一個 STB 資料夾，回這裡點一下即解開。": "Projects live in Files ▸ On My iPad ▸ <b>STB</b>, one folder per project. Back up / rename / delete by acting on the <b>whole folder</b> in Files. Received a <b>.stb packaged project</b>? Save it into the same STB folder, come back here and tap it to unpack.",
  "案子＝一個資料夾（project.json＋assets 影片素材）。<b>請勿單獨移動或刪除資料夾內的檔案</b>；備份＝複製整個資料夾。要傳給別人＝「匯出…」→ 打包案子（.stb 單檔）。": "A project = one folder (project.json + assets). <b>Don’t move or delete files inside it individually</b>; back up by copying the whole folder. To send it to someone: “Export…” → package project (a single .stb).",
  "還沒有案子——按「＋ 新增案子」開始。": "No projects yet — press “+ New Project” to start.",
  "還沒有案子——按「＋ 新增案子」開始，或開啟既有的案子資料夾。": "No projects yet — press “+ New Project”, or open an existing project folder.",
  "開不了這個案子——資料夾可能在檔案 App 被移動或刪除了。": "Couldn’t open this project — the folder may have been moved or deleted in Files.",
  "開不了這個案子——資料夾可能被移動或刪除了。已從清單移除。": "Couldn’t open this project — the folder may have been moved or deleted. Removed from the list.",
  "目前的內容尚未儲存成案子，切換後會消失。確定繼續？": "Current content isn’t saved as a project and will be lost if you switch. Continue?",
  "示範案（唯讀概念：改了不會存，除非另存新檔）": "Sample project (read-only: changes aren’t saved unless you Save As)",

  // ---- 檔案對話框／persistence ----
  "選擇打包案子（.stb）": "Choose a packaged project (.stb)",
  "開啟案子：選 project.json 或打包案子（.stb）": "Open project: pick project.json or a packaged .stb",
  "STB 案子（project.json／.stb）": "STB project (project.json / .stb)",
  "輸入案名（案子會存在「檔案」App ▸ STB）": "Name the project (it will live in Files ▸ STB)",
  "輸入案名（會以案名建立案子資料夾）": "Name the project (a folder is created with this name)",
  "另存新檔：輸入新案名（整個案子會複製一份）": "Save As: enter a new name (the whole project is copied)",
  "另存新檔：輸入新案名（整個案子會複製過去）": "Save As: enter a new name (the whole project is copied over)",
  "{name} 副本": "{name} copy",
  "存圖片": "Save image",
  "尚未開啟案子": "No project open",
  "選擇案子資料夾（影片與 project.json 將存在這裡）": "Choose the project folder (videos and project.json live here)",
  "這個資料夾已經有案子檔（project.json）。請先按頂欄「開啟案子…」載入它，再加入影片，避免覆蓋原內容。": "This folder already has a project (project.json). Open it first via “Open project…”, then add videos, to avoid overwriting.",
  "同名資料夾太多，清一下再解": "Too many folders with this name — clean up and unpack again",
  "已經有同名的案子——換個名字。": "A project with this name already exists — pick another.",
  "開不了這個檔案——請選案子資料夾裡的 project.json。\n（{err}）": "Couldn’t open this file — pick the project.json inside the project folder.\n({err})",
  "匯入失敗：{err}\n（備援路線：把 .stb 存進 檔案 App ▸ 我的 iPad ▸ STB，回專案頁點一下即可解開）": "Import failed: {err}\n(Fallback: save the .stb into Files ▸ On My iPad ▸ STB, then tap it on the Projects page to unpack)",
  "解不開這個打包案子：{err}": "Couldn’t unpack this project: {err}",
  "另存失敗：{err}": "Save As failed: {err}",
  "不是有效的 .stb 檔": "Not a valid .stb file",
  "zip 目錄損壞": "Corrupted zip directory",
  "包裡沒有 project.json": "No project.json in the pack",

  // ---- 場勘匯入（scoutImport／matchBoard）----
  "匯入場勘要在 STB 應用程式內使用。": "Scout import works inside the STB app only.",
  "選擇場勘包（STB Camera 匯出的 .stb）": "Choose a scout pack (.stb exported by STB Camera)",
  "場勘包（.stb）": "Scout pack (.stb)",
  "這個包裡沒有任何 cut。": "This pack contains no shots.",
  "場勘包：{scouts} 顆場勘照，對上本案 {matched} 顆": "Scout pack: {scouts} scout photos, {matched} matched to this project",
  "（{n} 顆已有場勘，會被新的覆蓋）": "({n} already have scout photos — they’ll be replaced)",
  "。\n\n只寫入場勘圖，分鏡圖不會動。匯入？": ".\n\nOnly scout photos are written; frames stay untouched. Import?",
  "包裡有 {n} 顆本案沒有的 cut——像是現場新增的。\n\n要一併加入嗎？會插在對應位置並設為「隱藏」（細灰格）——照片在場勘圖、分鏡編號完全不變。\n確定＝加入；取消＝略過這些。": "The pack has {n} shots this project doesn’t — likely added on location.\n\nAdd them too? They’ll be inserted in place and set to “hidden” (thin gray slots) — photos go to scout, shot numbers stay unchanged.\nOK = add; Cancel = skip them.",
  "另外 {n} 顆屬於整路都對不上的路。要加為新的一路嗎？": "{n} more shots belong to a version that doesn’t match at all. Add them as a new version?",
  "已另加 {films} 路、{cuts} 顆 cut。": "Added {films} version(s), {cuts} shots.",
  "完成：場勘對位 {matched} 顆，插入新 cut {added} 顆。": "Done: {matched} scout photos matched, {added} new shots inserted.",
  "已加入 {films} 路、共 {cuts} 顆 cut——已切到新的一路。": "Added {films} version(s) with {cuts} shots — switched to the new one.",
  "匯入場勘失敗：{err}": "Scout import failed: {err}",
  "這個包對不上本案的 cut": "This pack doesn’t match this project’s shots",
  "{c} 顆 cut、已拍 {s} 張照片——像是 STBC 自建或其他專案的分鏡包。要怎麼用？": "{c} shots, {s} photos taken — looks like a field-made or other-project pack. How should it be used?",
  "當新的一路": "As a new version",
  "整包加成新的一路（B路/C路…），照片＝該路分鏡圖": "Add the whole pack as a new version (B/C/…) with photos as its frames",
  "當場勘圖（手動對位）": "As scout photos (match manually)",
  "開配對板，把照片對到本案既有的分鏡格": "Open the match board and pair photos to existing shots",
  "配對板": "Match board",
  "點左邊照片 → 點右邊分鏡格＝連上（照片會遞補消失）；點已配的格＝退回；配錯按「復原」。": "Tap a photo on the left → tap a shot on the right to pair (photos slide up as they’re used); tap a paired slot to return it; mis-paired? press “Undo”.",
  "照片 #1 對第 1 格、#2 對第 2 格…（拍攝順序＝分鏡順序時一鍵完成）": "Photo #1 to slot 1, #2 to slot 2… (one tap when shoot order = board order)",
  "照順序自動配": "Auto-pair in order",
  "捲到下一個還沒配到照片的分鏡格（保證不漏格）": "Scroll to the next unpaired slot (nothing gets missed)",
  "下一個未配格": "Next unpaired",
  "退掉上一步配對（照片回到左欄）": "Undo the last pairing (photo returns to the left)",
  "復原": "Undo",
  "重做": "Redo",
  "清空": "Clear all",
  "匯入": "Import",
  "照片都配完了——檢查右邊再按「匯入」。": "All photos paired — check the right side, then press “Import”.",
  "（點一下退回照片）": "(tap to return the photo)",
  "無分鏡圖": "No frame",
  "已有場勘": "Has scout",
  "匯入 {n} 組": "Import {n} pairs",
  "每一格都配到了。": "Every slot is paired.",
  "{n} 格已有場勘會被新照片覆蓋，繼續？": "{n} slots already have scout photos and will be replaced. Continue?",
  "已匯入 {n} 組{skipped}。": "Imported {n} pairs{skipped}.",
  "；{k} 張未配對略過": "; {k} unpaired photos skipped",
  "匯入 STB Camera 拍回來的場勘包（.stb）——照片按 cut 自動對位，分鏡圖不會動": "Import the scout pack (.stb) from STB Camera — photos auto-match by shot, frames stay untouched",
  "匯入場勘": "Import scout",

  // ---- 新案／比例選擇 ----
  "預設 LOGO": "Default logo",
  "選擇圖片…": "Choose image…",
  "新案子的封面會用這張；個別案子仍可自己換": "Used on new project covers; each project can still override it",
  "分鏡比例": "Frame aspect",
  "整片的分鏡格方向，之後所有分鏡都照這個比例。": "The whole film’s frame orientation — every shot follows this ratio.",
  "橫式 16:9": "Landscape 16:9",
  "一般影片・簡報": "Standard video · decks",
  "標準 4:3": "Classic 4:3",
  "紀錄片・資料帶・社群好裁": "Docs · archive · social-safe",
  "全幅 3:2": "Full-frame 3:2",
  "平面・相機原生": "Stills · native camera",
  "寬銀幕 21:9": "Widescreen 21:9",
  "電影感・Scope": "Cinematic · scope",
  "直式 9:16": "Portrait 9:16",
  "Reels・限動・直式廣告": "Reels · Stories · vertical ads",

  // ---- STBC 匯出 ----
  "匯出分鏡 for STBC（輕量 .stb，只含分鏡章）": "Export shots for STBC (lightweight .stb, storyboard only)",
  "STB 分鏡包": "STB shot pack",
  "已匯出分鏡包（{n} 顆，{size} MB）——AirDrop 給手機的 STB Camera 開始場勘。": "Shot pack exported ({n} shots, {size} MB) — AirDrop it to STB Camera on the phone to start scouting.",

  // ---- 說明視窗／更新 ----
  "使用說明": "User Guide",
  "關於與更新": "About & Updates",
  "STB — 為腳本與前製會議而生的 Mac App。<br>資料全在本機：一個案子＝一個資料夾＋一份 project.json，無帳號、無雲端。": "STB — a Mac app built for scripts and pre-production meetings.<br>All data stays local: one project = one folder + one project.json. No account, no cloud.",
  "原始碼與最新版下載（GitHub）↗": "Source code & latest download (GitHub) ↗",
  "有新版 {version}": "New version {version}",
  "前往下載": "Download",
  "這個版本不再提醒": "Don’t remind me about this version",
  "略過": "Skip",

  // ---- 分鏡導航／其他 ----
  "↩︎ 上一步": "↩︎ Undo",
  "↪︎ 下一步": "↪︎ Redo",
  // ---- 2026-07-28 iPad 完整度掃修新增 ----
  "選擇分鏡包（.stb）": "Choose a board package (.stb)",
  "分鏡包（.stb）": "Board package (.stb)",
  "存圖": "Save image",
  "刪場勘": "Delete scout",
  "這是 STB Camera 的自建分鏡包——照片在場勘欄、分鏡欄是空的。\n\n要把照片當成分鏡圖嗎？\n確定＝照片變分鏡（建議）；取消＝維持場勘欄。":
    "This is a board built in STB Camera — photos are in the scout slot and the board slot is empty.\n\nUse the photos as board frames?\nOK = photos become the board (recommended); Cancel = keep them as scout photos.",
  "開成新專案": "Open as new project",
  "跟本案無關——另開一個獨立專案，照片＝分鏡圖": "Not related to this project — open standalone, photos become the board",
  "開不了這個分鏡包：{err}": "Can't open this board package: {err}",
  "刪除選取的 {n} 張場勘圖？分鏡圖不受影響（可復原）。": "Delete {n} selected scout photos? Board frames are untouched (undoable).",
  "已存入相簿": "Saved to Photos",

  // ---- 更新紀錄（releaseNotes.ts；新版發版時把新條目也翻進來）----
  "新增「工作人員」章（CONTACTS）：通告單上那份名單，現在可以獨立成一頁給客戶看——不印電話，職務旁自動帶英文／日文對照，可以匯出 credits.json 給片尾名單用。預設不進簡報，要給客戶看才自己打開":
    "New CONTACTS chapter: the call-sheet crew list can now stand as its own page for the client — no phone numbers, with English/Japanese role names alongside, and an export to credits.json for end credits. Off by default in decks; switch it on when you want the client to see it.",
  "通告單與名單是兩份人：名單上每個人有一顆「通告」開關，沒開的人不會出現在通告單上（現場不用打電話找的人不用擠在那裡）。名單上的 ✕＝從專案刪除，通告單上的 ✕＝只從通告單移除":
    "The call sheet and the crew list are two different lists: each person has a Call toggle, and anyone with it off stays off the call sheet (no need to crowd it with people you never phone on set). ✕ on the crew list deletes from the project; ✕ on the call sheet only removes them from the call sheet.",
  "「補上標準八條」：一鍵帶入台灣廣告最常列的八個職務（依 10,049 支真實片尾名單統計）":
    "Add the standard eight: one tap fills in the eight roles most commonly credited in Taiwanese commercials (from a survey of 10,049 real end-credit lists).",
  "新增畫幅 4:3：紀錄片、資料帶、以及要裁成 IG 方形／4:5 的案子都合用（STB Camera 同步支援）":
    "New 4:3 aspect: suits documentaries, archive footage, and anything you will crop to square or 4:5 for social (STB Camera supports it too).",
  "預設 LOGO 改成自己設定：「?」→ 關於 → 預設 LOGO 放一次，之後新案子的封面都用它；個別案子仍可自己換":
    "Set your own default logo: “?” → About → Default logo. Drop it in once and every new project cover uses it; individual projects can still override it.",
  "修正：3:2 與 4:3 的案子匯出 PPTX 時，分鏡描述可能壓到下一排":
    "Fixed: in 3:2 and 4:3 projects, shot descriptions could overlap the row below when exporting to PPTX.",
  "舊專案完全相容：沒用到新功能的檔案，開了存回去一個位元組都不變":
    "Fully backward compatible: a file that does not use the new features is byte-for-byte identical after opening and saving.",
  "塗鴉筆刷補完：新增「鉛筆」（真鉛筆質感——紙紋、筆壓深淺、軟邊）與「墨筆」（兩端收尖）；原本的筆／麥克筆與新筆收成一顆「筆刷」選單，每支筆前面是真的筆觸縮圖":
    "Sketch brushes completed: added Pencil (real pencil feel — paper tooth, pressure shading, soft edges) and Ink (tapered at both ends). The original pen and marker now live with them in a single Brush menu, each shown with a real stroke thumbnail.",
  "筆刷、粗細、顏色跟著案子記住——重開編輯器、換案子都不用重選（每支筆各自記粗細）":
    "Brush, thickness and colour are remembered per project — reopening the editor or switching projects no longer means picking them again (each brush keeps its own thickness).",
  "Apple Pencil 筆壓自動貼合你的手：畫幾筆就校準完成，輕手也畫得出完整濃淡；感測雜訊造成的突黑點與斷線一併修掉":
    "Apple Pencil pressure adapts to your hand: a few strokes and it is calibrated, so a light touch still gives you the full range of tone. Sudden dark blobs and dropped strokes caused by sensor noise are fixed too.",
  "匯出新增「深色版面」：黑底簡報版 PDF，預設跟著目前主題（PPTX 可編輯版恆為亮色）":
    "New Dark layout export: a black-background presentation PDF, defaulting to your current theme (the editable PPTX stays light).",
  "修正：深色主題匯出 PDF 半黑半白、深色首頁 LOGO 看不見、擷取中切換勾選會互相干擾":
    "Fixed: PDFs exported in the dark theme came out half black and half white; the cover logo was invisible in dark mode; toggling checkboxes mid-capture interfered with each other.",
  "塗鴉效能：連畫大量筆畫、擦除、換圖層、復原全面加速（60 筆連畫的最大卡頓 0.08 秒 → 0.02 秒）":
    "Sketch performance: long stroke runs, erasing, layer switching and undo are all faster (worst-case hitch over 60 continuous strokes: 0.08s → 0.02s).",
  "舊專案完全相容：沒用到新筆刷的檔案，開了存回去一個位元組都不變":
    "Fully backward compatible: a file that does not use the new brushes is byte-for-byte identical after opening and saving.",
  "塗鴉分鏡大升級：筆刷粗細改成拉桿（筆／麥克筆各自記住）；顏色開放自訂——16 色速選＋色相/飽和/明度滑桿，按過「使用這個顏色」的色存進「我的顏色」（最多 6 顆，長按色塊可刪除）":
    "Sketch overhaul: brush thickness is now a slider (pen and marker remember their own). Colour is fully customisable — 16 quick swatches plus hue/saturation/brightness sliders, and any colour you confirm with “Use this colour” is saved to My colours (up to 6; long-press a swatch to delete).",
  "塗鴉加圖層：場景／人物之外可加自訂圖層（最多 4 層），⠿ 拖曳調整順序、可暫時隱藏；複製 cut 只改其中一層的工作流更順":
    "Sketch layers: beyond Background and Character you can add your own layers (up to 4), reorder them by dragging the ⠿ handle, and hide them temporarily — which makes “duplicate the cut and redraw one layer” much smoother.",
  "塗鴉加選取：圈起來整批拖移、拉角落等比縮放——畫好的線不用擦掉重畫":
    "Sketch selection: lasso strokes to move them together, or drag a corner to scale proportionally — no need to erase and redraw what you have already drawn.",
  "雙指輕點復原／三指重做改成只在塗鴉內生效；主畫面改用頂欄的復原／重做鈕（觸控裝置才顯示），編輯欄位不再被手勢誤觸":
    "Two-finger tap to undo and three-finger to redo now work only inside the sketch editor. The main screen uses Undo/Redo buttons in the top bar instead (shown on touch devices), so text fields are no longer disturbed by stray gestures.",
  "塗鴉效能整治：連畫多層不再發燙卡頓；快速換卡、調完顏色馬上下筆都跟得上":
    "Sketch performance work: drawing across many layers no longer heats up and stutters; switching cards quickly, or drawing right after changing colour, keeps up.",
  "參考章（演員／服裝／場景等）項目多時，預覽／簡報／PDF 照版型自動分頁（跟匯出的 PPTX 一致），不再整章擠成一頁":
    "When a reference chapter (cast, wardrobe, locations…) has many items, preview, presentation and PDF now paginate to the layout automatically — the same as the exported PPTX — instead of cramming the whole chapter onto one page.",
  "通告單加「車輛」：一列一台車，填車名、車牌、司機與電話；乘客欄貼名單就好——逗號、頓號、空白都能分隔，離開欄位自動整理成一排":
    "Vehicles on the call sheet: one row per vehicle with name, plate, driver and phone. For passengers just paste a list — commas, ideographic commas or spaces all work as separators, and it tidies into one line when you leave the field.",
  "通告單加「注意事項」：一句一條，印在通告單上給全組看（時段各自的備註仍在 Rundown 裡，兩者不互相干擾）":
    "Notes on the call sheet: one line per note, printed for the whole crew to see (per-block notes still live in the rundown; the two do not interfere).",
  "沒填車輛或注意事項的案子，檔案內容完全不變——舊案子開了再存回去，一個位元組都不會動":
    "Projects with no vehicles or notes are unchanged on disk — open an old project, save it back, and not a byte moves.",
  "修正：預覽與列印時，通告單上的刪除鈕與拖曳把手不再印出來":
    "Fixed: delete buttons and drag handles on the call sheet no longer appear in preview and print.",
  "Rundown 自動分頁：拍攝日程排長了不會再全部擠成一頁——照時段實際高度切頁（頁標帶「頁 1 / 2」），簡報、PDF、列印都跟著分頁，比例不再被越壓越小":
    "Rundown pagination: a long shooting day is no longer squeezed onto one page — it breaks by the real height of each block (page label shows “Page 1 / 2”), and presentation, PDF and print all follow, so nothing gets scaled down further and further.",
  "直式案的 Rundown 分鏡縮圖放大到與橫式同寬（約 1.5 倍），現場看得清畫面":
    "In portrait projects, rundown shot thumbnails are now as wide as landscape ones (about 1.5×), so they are readable on set.",
  "通告單加「統編」欄：資訊條「製作」後面多一格，沒填就不會出現在簡報與列印":
    "Company tax ID on the call sheet: an extra field after “Production” in the info bar; leave it blank and it will not appear in presentation or print.",
  "VO 稿獨立預覽：分鏡章「欄位」列開「VO稿」，整路旁白攤開連著讀——行帶編號、點行跳到那顆 cut、沒旁白的段落畫一條細線；附句數／字數／唸稿估秒，「複製全文」就是給配音與演員的純文字稿":
    "VO script view: turn on “VO script” in the storyboard Fields row to read a whole film’s narration end to end — numbered lines, click a line to jump to that shot, and a thin rule where there is no narration. It shows sentence count, character count and an estimated read time, and “Copy all” gives you a plain-text script for the voice talent.",
  "日本語介面：說明視窗（?）→ 語言可切 日本語——整套介面、日本 CM 示範案與日文使用手冊；日文系統首次開啟自動進日文版":
    "Japanese interface: “?” → Language → 日本語 gives you the full interface, a Japanese CM sample project and a Japanese manual. Systems set to Japanese start in Japanese on first launch.",
  "景別／秒數欄：分鏡章「欄位」列可開，每顆 cut 顯示景別與秒數、頁尾自動合計並對 15／30／60 秒標差額（日文版預設開啟）":
    "Shot size and duration fields: switch them on in the storyboard Fields row to show both on every shot; the page footer totals them and shows the difference against 15/30/60 seconds (on by default in Japanese).",
  "場勘整合：手機用 STB Camera 拍完的鏡位照可以匯入，照 cut 自動對位；分鏡章上方切「分鏡／場勘」對照看，單顆或整案都能清除":
    "Scout integration: import the framing photos you took with STB Camera on your phone and they line up with the shots automatically. Switch between Storyboard and Scout above the storyboard to compare, and clear them one shot at a time or all at once.",
  "手動配對板：對不上的照片改用點選配對——點照片再點格子，配過的自動遞補，可復原、可照順序自動配":
    "Manual matching board: for photos that do not line up, tap a photo then tap a slot. Matched pairs advance automatically, you can undo, and there is an auto-match in order.",
  "匯入 STBC 項目：自己在現場用手機建的分鏡表帶回來時，可選「當新的一路」「只當場勘」或「手動配對」":
    "Import an STBC project: when you bring back a storyboard you built on your phone on set, choose “as a new film”, “as scout photos only”, or “manual matching”.",
  "隱藏 cut：不想出現在簡報／匯出的 cut 可以收起來，卡片之間留一條細線，點一下就叫回來（不佔編號）":
    "Hidden shots: tuck away any shot you do not want in the presentation or export. A thin rule is left between the cards, one tap brings it back, and it does not take up a number.",
  "新增畫幅：全幅 3:2、寬銀幕 21:9（原本只有 16:9 與直式 9:16）":
    "New aspects: full-frame 3:2 and widescreen 21:9 (previously only 16:9 and portrait 9:16).",
  "匯出分鏡 for STBC：輕量分鏡包，給攝影師手機用":
    "Export shots for STBC: a lightweight storyboard pack for the cinematographer’s phone.",
  "深色主題：編輯模式頂欄可切日／夜；簡報預覽預設黑底白字（VO 亮藍、SUPER 橘）。匯出的 PDF／PPTX 一律維持米白印刷版面":
    "Dark theme: switch day/night from the editor top bar. Presentation preview defaults to white on black (VO in bright blue, SUPER in orange). Exported PDF and PPTX always keep the off-white print layout.",
  "專案選單重整：創建新專案／排表流程／開啟舊專案／匯入分鏡／匯入 STBC 項目":
    "Reorganised project menu: new project / call-sheet workflow / open existing / import storyboard / import STBC project.",
  "英文介面：說明視窗（?）→ 語言可切 English，整套介面與英文示範案":
    "English interface: “?” → Language → English gives you the full interface and an English sample project.",
  "iPad 全面補課：匯入 STBC 項目、匯出分鏡、存圖進相簿（含場勘圖的調整介面）、長按選取刪場勘、長按「場勘」清全部——觸控都摸得到了":
    "iPad catch-up: importing STBC projects, exporting shots, saving images to Photos (including the scout-photo adjustment view), long-press to select and delete a scout photo, long-press “Scout” to clear them all — all reachable by touch now.",
  "修正拖曳入圖的意外：把圖片拖進 App 但沒對準分鏡格／參考格時，整個畫面會被那張圖佔滿、又回不去——現在沒對準就單純不動作，腳本完全不受影響":
    "Fixed a drag-and-drop accident: dropping an image on the app but not on a shot or reference slot filled the whole screen with it, with no way back. Now an off-target drop simply does nothing and your script is untouched.",
  "對準分鏡格／參考格的拖曳入圖行為不變":
    "Dropping onto a shot or reference slot behaves exactly as before.",
  "拖曳入圖：從 Finder 直接把圖拖進分鏡格或參考頁區塊（場景／演員／服裝／道具…），拖到哪一格就進哪一格":
    "Drag images in: drop straight from Finder onto a shot or a reference block (locations, cast, wardrobe, props…) — it lands in whichever slot you dropped it on.",
  "每張圖都能單獨存檔：圖片左下的 ⬇，分鏡、場景、演員、停車位置照都適用；檔名自動帶案名與章節":
    "Save any image on its own: the ⬇ at the bottom-left of the image works for storyboard, locations, cast and parking photos alike, and the filename carries the project and chapter automatically.",
  "文字可以手動換行：shift+Enter 分段（原本會被靜默吃掉，這次修好了）":
    "Manual line breaks in text: Shift+Enter starts a new line (it used to be silently swallowed; now fixed).",
  "場景等參考頁可以排序：抓左上的 ⠿ 拖曳調整區塊順序，跟分鏡卡同一套手感":
    "Reference pages can be reordered: grab the ⠿ at the top-left and drag blocks around, with the same feel as the storyboard cards.",
  "有新版會提醒：開 App 時安靜檢查一次，有新版才在右下浮一條；離線完全不打擾":
    "Update notice: the app checks quietly once at launch and only floats a small bar at the bottom-right if there is a new version. Offline, it stays out of your way entirely.",
  "修正 iPad 塗鴉分鏡的筆觸偏移：筆尖與墨跡對不上，離畫布左上角越遠偏越多（直式最嚴重）——現在筆畫會準確落在筆尖下":
    "Fixed stroke offset in iPad sketching: the ink did not sit under the nib, drifting further the farther you got from the top-left of the canvas (worst in portrait). Strokes now land exactly under the pen tip.",
  "起因是 iPadOS 更新後改變了畫面縮放的計算方式，App 原本的換算多修了一次；已改成每次下筆自動校準，新舊 iPadOS 都正確":
    "The cause was an iPadOS update changing how screen zoom is calculated, so the app was correcting for it twice. It now calibrates on every stroke and is correct on both old and new iPadOS.",
  "Mac 版不受此問題影響，行為完全不變":
    "The Mac version was never affected and behaves exactly as before.",
  "直式 9:16 支援：新建案時選「橫式／直式」——直式案的分鏡格站起來，一排放更多；頂端可切「大／密」兩種格子大小":
    "Portrait 9:16 support: choose landscape or portrait when creating a project. Portrait projects stand the shot cards up and fit more per row, and you can switch between Large and Dense card sizes at the top.",
  "各章跟著直：Rundown 指派的分鏡、Tone 調性跟隨整片比例；參考資料／參考節奏依你丟進來的素材方向自動直橫混排":
    "Chapters follow suit: shots assigned in the rundown and the Tone chapter follow the film’s aspect, while References and Reference rhythm mix portrait and landscape automatically according to the material you drop in.",
  "匯出也直了：PDF／PPTX 頁面維持 16:9，但分鏡格與照片改成直式呈現——直式廣告提案不再被壓成橫的":
    "Exports go portrait too: PDF and PPTX pages stay 16:9, but the shot cards and photos are laid out vertically — a vertical-ad pitch is no longer squashed into landscape.",
  "橫式舊案完全不受影響（沒選直式就跟以前一模一樣）":
    "Existing landscape projects are completely unaffected (if you did not choose portrait, nothing changes).",
  "塗鴉分鏡：直接畫在分鏡格裡——筆／麥克筆／橡皮擦（擦到哪消到哪）＋復原重做；場景/人物雙層，複製 cut 只重畫表演；勘景照半透明墊底沿描。Mac 滑鼠可畫；iPad 版 Apple Pencil 點縮圖即進（壓感筆鋒＋防手掌）":
    "Sketch storyboards: draw straight into the shot frame — pen, marker and eraser (erasing exactly where you rub) plus undo/redo. Background and character sit on separate layers so you can duplicate a shot and redraw only the performance, and a scout photo can sit underneath at low opacity to trace over. Draw with the mouse on Mac; on iPad, tap a thumbnail with Apple Pencil to go straight in (pressure-tapered strokes and palm rejection).",
  "打包案子（.stb）：匯出中心一鍵把整個案子（含影片素材）壓成單一檔案，另一台 Mac／iPad 的 STB 直接開啟——案子交接、跨機備份一個檔搞定":
    "Pack a project (.stb): one tap in the export centre compresses the whole project, video assets included, into a single file that STB on another Mac or iPad opens directly — handover and cross-machine backup in one file.",
  "拖曳手感升級：分鏡卡／Rundown 列／通告大組列拖動時跟著游標走，放空自動彈回原位":
    "Better drag feel: storyboard cards, rundown rows and call-sheet group rows follow the cursor as you drag, and spring back if you drop them nowhere.",
  "專案頁：目前開啟的案子掛「目前」標籤；開啟其他案子支援 .stb 打包檔":
    "Projects page: the project you have open is tagged “Current”, and Open other project accepts packed .stb files.",
  "iPad 版（App Store 同步上架）：檔案 App 案子管理、原生照片選擇器、長按多選、雙指輕點復原／三指重做、匯出走分享面板":
    "iPad version (released on the App Store at the same time): project management through the Files app, the native photo picker, long-press multi-select, two-finger tap to undo and three-finger to redo, and exporting through the share sheet.",
  "多路腳本：一份 PPM 同時做兩路/三路短片——分鏡章上方「＋ 一路」開新路，每路獨立 CUT 01 起跳":
    "Multi-film scripts: cover two or three films in one PPM — “+ Add film” above the storyboard starts a new one, each numbering from CUT 01 independently.",
  "跨路引用不打架：Rundown 縮圖、對照 cut 顯示「A-01、B-01」路前綴編號":
    "Cross-film references do not clash: rundown thumbnails and reference shots show film-prefixed numbers such as A-01 and B-01.",
  "路分頁可改名（點當前路的名字直接打）、可刪除（連同該路分鏡與指派）；簡報與匯出逐路出頁、頁標帶路名":
    "Film tabs can be renamed (click the current film’s name and type) and deleted (along with that film’s shots and assignments). Presentation and export produce pages per film, with the film name in the page label.",
  "匯入分鏡圖、新增 cut、指派到時段全部跟著「目前所在的路」":
    "Importing storyboard images, adding shots and assigning to time blocks all follow whichever film you are currently in.",
  "簡報「章節」勾選：這次不給客戶看的章一鍵藏起（存進案子，匯出也遵守；編輯器不受影響）":
    "Chapter checkboxes for presentations: hide the chapters you are not showing the client this time with one tap. The choice is saved in the project and respected by exports; the editor is unaffected.",
  "空章更聰明：只按過＋新增但沒填內容的章，簡報/匯出自動跳過；封面目錄只列會出場的章":
    "Smarter empty chapters: a chapter where you only pressed “+ Add” without filling anything in is skipped in presentation and export, and the cover contents list only shows chapters that actually appear.",
  "AI 編輯：project.json 被外部修改（ChatGPT/Claude/文字編輯器）2 秒內自動重載——搭配 repo 的《AI編輯指南_SCHEMA.md》即可自然語言寫腳本":
    "AI editing: if project.json is changed from outside (ChatGPT, Claude, a text editor) the app reloads it within two seconds — pair it with AI編輯指南_SCHEMA.md in the repo and you can write your script in natural language.",
  "通告排表模式（製片版）：專案頁「＋ 通告排表」＝分鏡整理＋甘特／通告單／Rundown 的輕量案；側欄底部可隨時切換完整 PPM ⇄ 通告排表，同一份檔案、資料一個不少":
    "Call-sheet mode (for producers): “+ Call sheet” on the projects page creates a lightweight project with shot organisation plus Gantt, call sheet and rundown. Switch between full PPM and call-sheet mode any time from the bottom of the sidebar — same file, nothing lost.",
  "匯入外部分鏡圖：分鏡章「＋ 匯入分鏡圖」（對照分鏡選擇器內也有）——腳本是別的軟體做的也沒關係，圖檔多選一次帶進來、每張自動變一顆卡片（依檔名排序、自動裁 16:9），可拖曳排序、組連續鏡、逐張標註":
    "Import external storyboard images: “+ Import storyboard” in the storyboard chapter (also inside the reference shot picker). It does not matter which software drew them — select many files at once and each becomes a card (sorted by filename, auto-cropped to 16:9), ready to reorder, group into continuous shots and annotate one by one.",
  "指派到時段（設定場次）：分鏡章 ⌘/Shift 多選卡片 →「⇒ 指派到時段」挑場次，一批 cut 一次進 Rundown":
    "Assign to a time block: multi-select cards in the storyboard with ⌘/Shift, then “⇒ Assign to block” and pick one — a whole batch of shots goes into the rundown at once.",
  "中文輸入友善：Enter 不再結束輸入框（選字確認不會被踢出去）——繼續打就對了；要離開按 Esc 或點別處":
    "Friendlier for CJK input: Enter no longer closes the field, so confirming a candidate does not kick you out — just keep typing. Press Esc or click elsewhere to leave.",
  "首個公開版本":
    "First public release.",
  "PPM 十章：目錄、調性、參考節奏、分鏡、REFERENCES、演員、服裝、美術、場景、製作時程":
    "Ten PPM chapters: contents, tone & manner, reference rhythm, storyboard, references, cast, wardrobe, art & props, locations, and schedule.",
  "分鏡連鎖重算：拖動 cut 自動重新編號，連續鏡群組整組同行":
    "Chained renumbering: drag a shot and everything renumbers automatically, with continuous-shot groups moving together on one row.",
  "通告單＋Rundown 時間鏈：改集合時間或時段長度，後面自動順延":
    "Call sheet and rundown time chain: change the call time or the length of a block and everything after it shifts automatically.",
  "甘特圖：拖曳條子改期程、可選色、可排序":
    "Gantt chart: drag the bars to change dates, choose colours, and reorder.",
  "參考影片：本機影片區塊內播放、首尾裁切、簡報自動播":
    "Reference videos: local video plays inside the block, can be trimmed at both ends, and plays automatically in presentation.",
  "簡報模式：一鍵進入，鍵盤換頁":
    "Presentation mode: one tap to enter, keyboard to change pages.",
  "匯出：PDF（16:9）＋可編輯 PPTX（文字可改、圖可換、影片自動轉檔與裁切嵌入）":
    "Export: PDF (16:9) and an editable PPTX — text stays editable, images can be swapped, and videos are transcoded, trimmed and embedded automatically.",
  "專案管理頁：最近案子條列（案名＋位置）、內建示範案入口，新增案子＝輸入案名即以案名建資料夾；開啟其他案子＝直接選 project.json；上方案名可直接點擊修改":
    "Projects page: a list of recent projects (name and location) and a link to the built-in sample. Creating a project means typing a name, and the folder takes that name; opening another means picking its project.json; and the project name at the top can be clicked and edited directly.",
  "存檔：案子＝資料夾（project.json＋assets 素材，勿單獨移動內部檔案），自動存檔、重開自動載回；另存新檔＝整案複製當版本備份":
    "Saving: a project is a folder (project.json plus an assets folder — do not move files inside it on their own). It saves automatically and reloads when you reopen, and Save As copies the whole project as a version backup.",
  "LOGO 首頁可替換；內建中性示範案":
    "The cover logo can be replaced, and a neutral sample project is built in.",
};