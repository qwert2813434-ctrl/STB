import type { Project, Cut, RundownBlock, ShootDay, RefItem, Milestone, BlockType } from "./model";
import { normalizeGroups, newId, BLOCK_TYPES } from "./model";

// 日期加減（YYYY-MM-DD ± 天數），甘特拖曳用
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 極簡 store：整份 Project 存快照做 undo/redo（Project 是輕量 value type，
// 整份複製成本很低，比逐欄位記錄變化簡單且不易兜不攏——沿用 ALIGN 的做法）。

type Listener = () => void;

const MAX_HISTORY = 50;

export class Store {
  private project: Project;
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private listeners: Listener[] = [];
  selectedId: string | null = null;
  selectedIds: string[] = []; // 多選（⌘/Shift 點擊）；單選時＝[selectedId]
  touchSelect = false; // iPad 長按進入的多選模式：點卡片＝加選/取消（觸控沒有 ⌘ 鍵）
  currentDayId: string;
  currentChapter = "storyboard"; // PPM 章節 id（預設進分鏡）
  portraitDense = true; // 直式分鏡格密度：true＝6 欄 12／頁（密）、false＝4 欄 4／頁（大）。純檢視偏好，不存檔。

  constructor(initial: Project) {
    this.project = initial;
    this.currentDayId = initial.days[0]?.id ?? "";
    this.currentFilmId = initial.films?.[0]?.id ?? "";
  }

  currentDay(): ShootDay | undefined {
    return this.project.days.find((d) => d.id === this.currentDayId);
  }

  // ---- 多路腳本（films）----
  currentFilmId = "";

  currentFilm() {
    return this.project.films.find((f) => f.id === this.currentFilmId) ?? this.project.films[0];
  }

  setFilm(id: string) {
    if (this.currentFilmId === id) return; // 同路不重繪（點路名編輯時游標不掉）
    this.currentFilmId = id;
    this.selectedId = null;
    this.selectedIds = [];
    this.touchSelect = false;
    this.emit();
  }

  addFilm() {
    this.commit((p) => {
      const f = { id: newId("f"), name: `${String.fromCharCode(65 + p.films.length)}路` };
      p.films.push(f);
      this.currentFilmId = f.id;
    });
  }

  renameFilm(id: string, name: string) {
    const f = this.project.films.find((x) => x.id === id);
    if (!f || f.name === name || !name.trim()) { this.emit(); return; }
    this.commit(() => { f.name = name.trim(); });
  }

  // 刪除一路：該路分鏡連同 Rundown 指派、對照 cut 引用一併清（至少留一路）
  deleteFilm(id: string) {
    if (this.project.films.length <= 1) return;
    this.commit((p) => {
      const dead = new Set(p.cuts.filter((c) => c.filmId === id).map((c) => c.id));
      p.cuts = p.cuts.filter((c) => !dead.has(c.id));
      p.films = p.films.filter((f) => f.id !== id);
      for (const d of p.days) for (const b of d.rundown) b.cutIds = b.cutIds.filter((cid) => !dead.has(cid));
      for (const items of Object.values(p.refPages)) {
        for (const it of items) if (it.cutRefs) it.cutRefs = it.cutRefs.filter((cid) => !dead.has(cid));
      }
      if (this.currentFilmId === id) this.currentFilmId = p.films[0].id;
      this.selectedId = null;
      this.selectedIds = [];
    });
  }

  // 開啟案子：整份替換，清空歷史與選取；通告排表案直接落在 SCHEDULE 章
  replaceProject(p: Project) {
    this.project = p;
    this.undoStack = [];
    this.redoStack = [];
    this.selectedId = null;
    this.selectedIds = [];
    this.currentDayId = p.days[0]?.id ?? "";
    this.currentFilmId = p.films[0]?.id ?? "";
    if (p.mode === "schedule") this.currentChapter = "schedule";
    this.emit();
  }

  // 案子類型切換（完整 PPM ⇄ 通告排表）：只是檢視範圍，資料一個不少
  setMode(mode: "ppm" | "schedule") {
    if ((this.project.mode ?? "ppm") === mode) return;
    this.snapshot();
    this.project.mode = mode;
    if (mode === "schedule") this.currentChapter = "schedule";
    this.emit();
    this.touched();
  }

  get(): Project {
    return this.project;
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  // 真相變更通知（自動存檔用）：只在資料真的改動時觸發，
  // 選取/切章這類純 UI 事件不算；inline 打字（editField）也會觸發。
  private mutateListeners: Listener[] = [];
  onMutate(fn: Listener) {
    this.mutateListeners.push(fn);
  }
  private touched() {
    for (const fn of this.mutateListeners) fn();
  }

  private clone(p: Project): Project {
    // structuredClone：字串（分鏡圖 data URL 等大宗）在拷貝間「共享」不複製——
    // JSON 往返會把所有圖片位元組每份快照都抄一遍，50 份快照＝數百 MB，
    // iPad 撞記憶體牆（實測「匯圖多次後開始失敗」的根因）；桌面同樣受惠。
    return structuredClone(p);
  }

  // 任何會改變真相的動作前呼叫，存一份快照
  private snapshot() {
    this.undoStack.push(this.clone(this.project));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  private commit(mutate: (p: Project) => void) {
    this.snapshot();
    mutate(this.project);
    this.project.cuts = normalizeGroups(this.project.cuts);
    this.emit();
    this.touched();
  }

  // ---- 操作 ----

  addCutAfter(id: string | null) {
    this.commit((p) => {
      const ref = id ? p.cuts.find((c) => c.id === id) : undefined;
      const filmId = ref?.filmId ?? (this.currentFilmId || p.films[0].id);
      const cut: Cut = {
        id: newId(), groupId: newId("g"), filmId, shot: "", desc: "", vo: "", sup: "",
        imageRef: null, prompt: "", props: "", note: "",
      };
      // 沒指定位置＝接在「本路」最後一顆後面（不是全案最後）
      let idx = id ? p.cuts.findIndex((c) => c.id === id) : -1;
      if (idx < 0) {
        idx = p.cuts.length - 1;
        for (let i = p.cuts.length - 1; i >= 0; i--) if (p.cuts[i].filmId === filmId) { idx = i; break; }
      }
      p.cuts.splice(idx + 1, 0, cut);
      this.selectedId = cut.id;
      this.selectedIds = [cut.id];
    });
  }

  duplicateCut(id: string) {
    this.commit((p) => {
      const idx = p.cuts.findIndex((c) => c.id === id);
      if (idx < 0) return;
      const src = p.cuts[idx];
      // 複製為獨立新 cut（新 groupId，不繼承連續鏡關係）
      const copy: Cut = { ...src, id: newId(), groupId: newId("g") };
      p.cuts.splice(idx + 1, 0, copy);
      this.selectedId = copy.id;
      this.selectedIds = [copy.id];
    });
  }

  deleteCut(id: string) {
    this.commit((p) => {
      if (p.cuts.length <= 1) return;
      const idx = p.cuts.findIndex((c) => c.id === id);
      if (idx < 0) return;
      p.cuts.splice(idx, 1);
      this.selectedId = null;
      this.selectedIds = [];
    });
  }

  // 多選刪除（至少留一顆 cut）
  deleteCuts(ids: string[]) {
    this.commit((p) => {
      const keep = p.cuts.filter((c) => !ids.includes(c.id));
      if (!keep.length) return;
      p.cuts = keep;
      this.selectedId = null;
      this.selectedIds = [];
    });
  }

  // ＋連續鏡：把選取 cut 變成群組（04 → 04-1），並在群組尾端加一個子鏡（04-2）
  addSubShot(id: string) {
    this.commit((p) => {
      const src = p.cuts.find((c) => c.id === id);
      if (!src) return;
      // 群組最後一個成員的 index，插在它後面
      let lastIdx = -1;
      p.cuts.forEach((c, i) => { if (c.groupId === src.groupId) lastIdx = i; });
      const sub: Cut = {
        id: newId(), groupId: src.groupId, filmId: src.filmId, shot: "", desc: "", vo: "", sup: "",
        imageRef: null, prompt: "", props: "", note: "",
      };
      p.cuts.splice(lastIdx + 1, 0, sub);
      this.selectedId = sub.id;
      this.selectedIds = [sub.id];
    });
  }

  // 組成連續鏡：把多選的 cut 綁成同一群組（給全新 groupId，
  // 不沿用既有 gid——避免把沒選到的舊群組成員一起吸進來）；
  // normalizeGroups 會自動把成員收攏相鄰、編號連鎖重排
  groupCuts(ids: string[]) {
    if (ids.length < 2) return;
    this.commit((p) => {
      const members = p.cuts.filter((c) => ids.includes(c.id));
      if (members.length < 2) return;
      const gid = newId("g");
      for (const c of members) c.groupId = gid;
    });
  }

  // 拆除群組：整組一次拆散，每顆變回獨立 cut（比逐顆拆直覺）
  dissolveGroup(id: string) {
    this.commit((p) => {
      const gid = p.cuts.find((c) => c.id === id)?.groupId;
      if (!gid) return;
      for (const c of p.cuts) if (c.groupId === gid) c.groupId = newId("g");
    });
  }

  // 拖曳重排：把 srcId 所屬「整個群組」移到 dstId 所屬群組之前/後
  moveGroup(srcId: string, dstId: string) {
    if (srcId === dstId) return;
    this.commit((p) => {
      const srcGid = p.cuts.find((c) => c.id === srcId)?.groupId;
      const dstGid = p.cuts.find((c) => c.id === dstId)?.groupId;
      if (!srcGid || !dstGid || srcGid === dstGid) return;
      // 雙向：src 在 dst 前面＝向後拖→落在 dst 群組之後；反之落在之前
      const srcIdx = p.cuts.findIndex((c) => c.groupId === srcGid);
      const dstIdx = p.cuts.findIndex((c) => c.groupId === dstGid);
      const after = srcIdx < dstIdx;
      const moving = p.cuts.filter((c) => c.groupId === srcGid);
      const rest = p.cuts.filter((c) => c.groupId !== srcGid);
      if (after) {
        let lastDst = -1;
        rest.forEach((c, i) => { if (c.groupId === dstGid) lastDst = i; });
        rest.splice(lastDst + 1, 0, ...moving);
      } else {
        rest.splice(rest.findIndex((c) => c.groupId === dstGid), 0, ...moving);
      }
      p.cuts = rest;
    });
  }

  // Rundown：對「當前拍攝日」的 rundown 操作；±5 分順延，收工由 chainRundown 算
  adjustBlockDuration(blockId: string, delta: number) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      const b = day?.rundown.find((x) => x.id === blockId);
      if (!b) return;
      b.durMin = Math.max(5, b.durMin + delta);
    });
  }

  addBlockAfter(blockId: string | null) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      if (!day) return;
      const block: RundownBlock = {
        id: newId("b"), durMin: 30, type: "拍攝", title: "新時段",
        loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "",
      };
      const idx = blockId ? day.rundown.findIndex((b) => b.id === blockId) : day.rundown.length - 1;
      day.rundown.splice(idx + 1, 0, block);
    });
  }

  deleteBlock(blockId: string) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      if (!day) return;
      const i = day.rundown.findIndex((b) => b.id === blockId);
      if (i >= 0) day.rundown.splice(i, 1);
    });
  }

  // Rundown 區塊文字 inline 編輯（打字時不 emit，避免游標跳；同 editField 模式）
  editBlockField(blockId: string, field: "title" | "loc" | "park" | "props" | "note", value: string) {
    const day = this.currentDay();
    const b = day?.rundown.find((x) => x.id === blockId);
    if (!b || b[field] === value) return;
    this.snapshot();
    b[field] = value;
    this.touched();
  }

  // 點類型標籤循環切換：集合→拍攝→移動→場佈→用餐→其他→…
  cycleBlockType(blockId: string) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      const b = day?.rundown.find((x) => x.id === blockId);
      if (!b) return;
      const t: BlockType = b.type;
      b.type = BLOCK_TYPES[(BLOCK_TYPES.indexOf(t) + 1) % BLOCK_TYPES.length];
    });
  }

  // ---- 通告單欄位 ----

  // 片名／製作公司（目錄頁與通告單都能改；blur 才呼叫，emit 安全）
  editMeta(field: "title" | "client", value: string) {
    if (this.project.meta[field] === value) return;
    this.snapshot();
    this.project.meta[field] = value;
    this.emit();
    this.touched();
  }

  // 批次匯入外部分鏡圖（製片排程用：腳本是別的軟體做的，把導演給的圖檔
  // 一次帶進來）：每張圖＝一顆新 cut，接在最後、自動編號。回傳新 cut id。
  addCutsFromImages(images: string[]): string[] {
    const ids: string[] = [];
    this.commit((p) => {
      const filmId = this.currentFilmId || p.films[0].id;
      for (const img of images) {
        const id = newId();
        ids.push(id);
        p.cuts.push({ id, groupId: newId("g"), filmId, shot: "", desc: "", vo: "", sup: "", imageRef: img, prompt: "", props: "", note: "" });
      }
    });
    return ids;
  }

  // 指派 cut 到 Rundown 時段（＝設定場次；分鏡章多選後反向指派）：
  // 併入既有名單去重，依分鏡順序排列
  assignCutsToBlock(blockId: string, cutIds: string[]) {
    this.commit((p) => {
      for (const d of p.days) {
        const b = d.rundown.find((x) => x.id === blockId);
        if (!b) continue;
        const set = new Set([...b.cutIds, ...cutIds]);
        b.cutIds = p.cuts.filter((c) => set.has(c.id)).map((c) => c.id);
        return;
      }
    });
  }

  // 章節顯示切換（簡報「章節」勾選）：藏起來的章簡報/匯出都跳過，編輯器照常
  toggleChapterHidden(id: string) {
    this.snapshot();
    const set = new Set(this.project.hiddenChapters ?? []);
    if (set.has(id)) set.delete(id); else set.add(id);
    this.project.hiddenChapters = [...set];
    this.emit();
    this.touched();
  }

  // 首頁 LOGO（data URL；null＝回到內建預設）
  setLogo(dataUrl: string | null) {
    if (this.project.meta.logo === dataUrl) return;
    this.snapshot();
    this.project.meta.logo = dataUrl;
    this.emit();
    this.touched();
  }

  setDayDate(value: string) {
    const day = this.currentDay();
    if (!day || day.date === value) { this.emit(); return; }
    this.commit((p) => {
      const d = p.days.find((x) => x.id === this.currentDayId);
      if (d) d.date = value;
    });
  }

  // 集合時間：驗證 HH:MM 才收（Rundown 順延鏈靠它起算）；不合法就重繪還原
  setDayCallTime(value: string) {
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    const day = this.currentDay();
    if (!day) return;
    if (!m || Number(m[2]) > 59 || Number(m[1]) > 23) { this.emit(); return; }
    const norm = m[1].padStart(2, "0") + ":" + m[2];
    if (day.callTime === norm) { this.emit(); return; }
    this.commit((p) => {
      const d = p.days.find((x) => x.id === this.currentDayId);
      if (d) d.callTime = norm;
    });
  }

  addCallGroup() {
    this.commit((p) => {
      const d = p.days.find((x) => x.id === this.currentDayId);
      d?.callGroups.push({ label: "", time: "", loc: "" });
    });
  }

  deleteCallGroup(index: number) {
    this.commit((p) => {
      const d = p.days.find((x) => x.id === this.currentDayId);
      if (d && index >= 0 && index < d.callGroups.length) d.callGroups.splice(index, 1);
    });
  }

  // 大組通告列拖曳置換
  moveCallGroup(src: number, dst: number) {
    if (src === dst) return;
    this.commit((p) => {
      const d = p.days.find((x) => x.id === this.currentDayId);
      if (!d || src < 0 || dst < 0 || src >= d.callGroups.length || dst >= d.callGroups.length) return;
      const [m] = d.callGroups.splice(src, 1);
      d.callGroups.splice(dst, 0, m);
    });
  }

  editCallGroup(index: number, field: "label" | "time" | "loc", value: string) {
    const day = this.currentDay();
    const g = day?.callGroups[index];
    if (!g || g[field] === value) return;
    this.snapshot();
    g[field] = value;
    this.touched();
  }

  // ---- 聯絡人（通告單右欄） ----
  addContact() {
    this.commit((p) => { p.contacts.push({ role: "", name: "", phone: "" }); });
  }

  deleteContact(index: number) {
    this.commit((p) => {
      if (index >= 0 && index < p.contacts.length) p.contacts.splice(index, 1);
    });
  }

  editContact(index: number, field: "role" | "name" | "phone", value: string) {
    const c = this.project.contacts[index];
    if (!c || c[field] === value) return;
    this.snapshot();
    c[field] = value;
    this.touched();
  }

  // Rundown 區塊：指派對照分鏡（cutPicker 多選）
  setBlockCuts(blockId: string, cutIds: string[]) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      const b = day?.rundown.find((x) => x.id === blockId);
      if (b) b.cutIds = cutIds;
    });
  }

  // Rundown 區塊：停車位置照片（null＝移除）
  setBlockParkImage(blockId: string, url: string | null) {
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      const b = day?.rundown.find((x) => x.id === blockId);
      if (b) b.parkImage = url;
    });
  }

  // 新增拍攝日：沿用第一天的通告設置（大組通告、集合時間、Rundown 時段結構），
  // 方便在既有基礎上改。日期清空、cut 指派與停車圖清掉（那是各日專屬）。
  addDay() {
    this.commit((p) => {
      const base = p.days[0];
      const day: ShootDay = base
        ? {
            id: newId("d"),
            date: "",
            callTime: base.callTime,
            callGroups: base.callGroups.map((g) => ({ ...g })),
            rundown: base.rundown.map((b) => ({
              ...b, id: newId("b"), cutIds: [], parkImage: null,
            })),
          }
        : {
            id: newId("d"), date: "", callTime: "08:00", callGroups: [],
            rundown: [
              { id: newId("b"), durMin: 30, type: "集合", title: "集合", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
            ],
          };
      p.days.push(day);
      this.currentDayId = day.id;
    });
  }

  setDay(id: string) {
    this.currentDayId = id;
    this.emit();
  }

  // 刪除拍攝日（至少留一天）；刪到當前日就切到第一天
  deleteDay(id: string) {
    this.commit((p) => {
      if (p.days.length <= 1) return;
      const i = p.days.findIndex((d) => d.id === id);
      if (i < 0) return;
      p.days.splice(i, 1);
      if (this.currentDayId === id) this.currentDayId = p.days[0].id;
    });
  }

  // 拖曳重排當前日的 Rundown 區塊
  moveBlock(srcId: string, dstId: string) {
    if (srcId === dstId) return;
    this.commit((p) => {
      const day = p.days.find((d) => d.id === this.currentDayId);
      if (!day) return;
      const from = day.rundown.findIndex((b) => b.id === srcId);
      const dstOrig = day.rundown.findIndex((b) => b.id === dstId);
      if (from < 0 || dstOrig < 0) return;
      const after = from < dstOrig; // 向後拖→落在目標之後
      const [moved] = day.rundown.splice(from, 1);
      const to = day.rundown.findIndex((b) => b.id === dstId);
      day.rundown.splice(after ? to + 1 : to, 0, moved);
    });
  }

  // 分鏡圖：存 data URL 到 cut（第一版；接 Tauri 檔案後改存 assets 路徑）
  setImage(cutId: string, dataUrl: string | null) {
    this.commit((p) => {
      const cut = p.cuts.find((c) => c.id === cutId);
      if (cut) cut.imageRef = dataUrl;
    });
  }

  // ---- PPM 章節 ----
  setChapter(id: string) {
    this.currentChapter = id;
    this.emit();
  }

  // 直式分鏡格密度切換（純檢視偏好，不動資料、不記 undo）
  setPortraitDense(dense: boolean) {
    if (this.portraitDense === dense) return;
    this.portraitDense = dense;
    this.emit();
  }

  addRefItem(chapterId: string) {
    this.commit((p) => {
      if (!p.refPages[chapterId]) p.refPages[chapterId] = [];
      p.refPages[chapterId].push({ id: newId("r"), imageRef: null, title: "", note: "" } as RefItem);
    });
  }

  deleteRefItem(chapterId: string, itemId: string) {
    this.commit((p) => {
      const arr = p.refPages[chapterId];
      if (!arr) return;
      const i = arr.findIndex((x) => x.id === itemId);
      if (i >= 0) arr.splice(i, 1);
    });
  }

  // portrait＝參考/節奏章依匯入素材方向判定的直式旗標（undefined＝不改動既有值）
  setRefImage(chapterId: string, itemId: string, url: string | null, portrait?: boolean) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (!it) return;
      it.imageRef = url;
      if (portrait !== undefined) it.portrait = portrait;
    });
  }

  setRefCuts(chapterId: string, itemId: string, cutIds: string[]) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (it) it.cutRefs = cutIds;
    });
  }

  setRefVideoFile(chapterId: string, itemId: string, path: string, poster: string | null, trimStart?: number, trimEnd?: number, portrait?: boolean) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (!it) return;
      it.videoFile = path;
      if (poster) it.imageRef = poster; // 抽出的首圖當封面
      it.trimStart = trimStart;         // undefined＝整段（JSON 序列化時自動略去）
      it.trimEnd = trimEnd;
      if (portrait !== undefined) it.portrait = portrait; // 參考/節奏章依首圖方向判定
    });
  }

  editRefField(chapterId: string, itemId: string, field: "title" | "note" | "videoUrl", value: string) {
    const it = this.project.refPages[chapterId]?.find((x) => x.id === itemId);
    if (!it || it[field] === value) return;
    this.snapshot();
    it[field] = value;
    this.touched();
  }

  // ---- 製作時程里程碑（甘特） ----
  addMilestone() {
    this.commit((p) => {
      const last = p.milestones[p.milestones.length - 1];
      const base = last?.end || p.days[0]?.date || "";
      p.milestones.push({ id: newId("m"), label: "新事項", start: base, end: base } as Milestone);
    });
  }

  deleteMilestone(id: string) {
    this.commit((p) => {
      const i = p.milestones.findIndex((m) => m.id === id);
      if (i >= 0) p.milestones.splice(i, 1);
    });
  }

  setMilestoneDate(id: string, field: "start" | "end", value: string) {
    this.commit((p) => {
      const m = p.milestones.find((x) => x.id === id);
      if (!m) return;
      m[field] = value;
      if (m.end && m.start && m.end < m.start) m.end = m.start;
    });
  }

  editMilestoneLabel(id: string, value: string) {
    const m = this.project.milestones.find((x) => x.id === id);
    if (!m || m.label === value) return;
    this.snapshot();
    m.label = value;
    this.touched();
  }

  // 甘特：上下移動（區塊化排序）
  moveMilestone(id: string, dir: -1 | 1) {
    this.commit((p) => {
      const i = p.milestones.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.milestones.length) return;
      [p.milestones[i], p.milestones[j]] = [p.milestones[j], p.milestones[i]];
    });
  }

  setMilestoneColor(id: string, color: string) {
    this.commit((p) => {
      const m = p.milestones.find((x) => x.id === id);
      if (m) m.color = color;
    });
  }

  // 甘特：拖曳整條移動（mode="move"，start/end 同步平移）、
  // 拉右緣改結束（mode="end"）、拉左緣改起始（mode="start"，可往前拉）
  shiftMilestone(id: string, days: number, mode: "move" | "end" | "start") {
    if (!days) return;
    this.commit((p) => {
      const m = p.milestones.find((x) => x.id === id);
      if (!m || !m.start || !m.end) return;
      if (mode === "move") {
        m.start = addDays(m.start, days);
        m.end = addDays(m.end, days);
      } else if (mode === "end") {
        m.end = addDays(m.end, days);
        if (m.end < m.start) m.end = m.start; // 不早於起點
      } else {
        m.start = addDays(m.start, days);
        if (m.start > m.end) m.start = m.end; // 不晚於終點
      }
    });
  }

  editField(id: string, field: "desc" | "vo" | "sup" | "shot", value: string) {
    // inline 打字：即時改，但只在真正變動時記一筆 undo
    const cut = this.project.cuts.find((c) => c.id === id);
    if (!cut || cut[field] === value) return;
    this.snapshot();
    cut[field] = value;
    this.touched();
    // 不 emit（避免打字時整頁重繪、游標跳掉）；由呼叫端決定何時重繪
  }

  // 塗鴉分鏡：筆跡（可再編輯）＋壓平 PNG 一次寫入；null/null＝清空這格
  setCutSketch(id: string, sketch: import("./model").CutSketch | null, png: string | null) {
    this.commit((p) => {
      const c = p.cuts.find((x) => x.id === id);
      if (!c) return;
      c.sketch = sketch;
      c.imageRef = png;
    });
  }

  select(id: string | null) {
    this.selectedId = id;
    this.selectedIds = id ? [id] : [];
    if (!id) this.touchSelect = false; // 清空選取＝離開觸控多選模式
    this.emit();
  }

  // ⌘點擊：加選/取消（多選群組用）；觸控多選模式的「點卡片」也走這裡。
  // silent＝不整頁重繪（觸控模式就地換妝：iPad zoom 下 WKWebView 整頁
  // 重繪會偷懶留殘影，且每點一下重建全頁也傷捲動位置）
  toggleSelect(id: string, silent = false) {
    const i = this.selectedIds.indexOf(id);
    if (i >= 0) this.selectedIds.splice(i, 1);
    else this.selectedIds.push(id);
    this.selectedId = this.selectedIds[this.selectedIds.length - 1] ?? null;
    if (!this.selectedIds.length) this.touchSelect = false; // 全取消＝自動離開模式
    if (!silent) this.emit();
  }

  // Shift 點擊：從上一次選取連選到這顆（依分鏡順序）
  selectRange(id: string) {
    const a = this.project.cuts.findIndex((c) => c.id === this.selectedId);
    const b = this.project.cuts.findIndex((c) => c.id === id);
    if (a < 0 || b < 0) { this.select(id); return; }
    const [s, e] = a < b ? [a, b] : [b, a];
    // 連選限同一路（畫面一次只顯示一路，跨路的中間 cut 不該被掃進來）
    const filmId = this.project.cuts[b].filmId;
    this.selectedIds = this.project.cuts.slice(s, e + 1).filter((c) => c.filmId === filmId).map((c) => c.id);
    this.selectedId = id;
    this.emit();
  }

  isSelected(id: string): boolean {
    return this.selectedIds.length ? this.selectedIds.includes(id) : id === this.selectedId;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.clone(this.project));
    this.project = prev;
    this.selectedId = null;
    this.selectedIds = [];
    this.emit();
    this.touched();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.clone(this.project));
    this.project = next;
    this.selectedId = null;
    this.selectedIds = [];
    this.emit();
    this.touched();
  }
}
