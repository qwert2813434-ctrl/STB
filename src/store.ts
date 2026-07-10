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
  currentDayId: string;
  currentChapter = "storyboard"; // PPM 章節 id（預設進分鏡）

  constructor(initial: Project) {
    this.project = initial;
    this.currentDayId = initial.days[0]?.id ?? "";
  }

  currentDay(): ShootDay | undefined {
    return this.project.days.find((d) => d.id === this.currentDayId);
  }

  // 開啟案子：整份替換，清空歷史與選取；通告排表案直接落在 SCHEDULE 章
  replaceProject(p: Project) {
    this.project = p;
    this.undoStack = [];
    this.redoStack = [];
    this.selectedId = null;
    this.selectedIds = [];
    this.currentDayId = p.days[0]?.id ?? "";
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
    return JSON.parse(JSON.stringify(p));
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
      const gid = newId("g");
      const cut: Cut = {
        id: newId(), groupId: gid, shot: "", desc: "", vo: "", sup: "",
        imageRef: null, prompt: "", props: "", note: "",
      };
      const idx = id ? p.cuts.findIndex((c) => c.id === id) : p.cuts.length - 1;
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
        id: newId(), groupId: src.groupId, shot: "", desc: "", vo: "", sup: "",
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
      for (const img of images) {
        const id = newId();
        ids.push(id);
        p.cuts.push({ id, groupId: newId("g"), shot: "", desc: "", vo: "", sup: "", imageRef: img, prompt: "", props: "", note: "" });
      }
    });
    return ids;
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

  setRefImage(chapterId: string, itemId: string, url: string | null) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (it) it.imageRef = url;
    });
  }

  setRefCuts(chapterId: string, itemId: string, cutIds: string[]) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (it) it.cutRefs = cutIds;
    });
  }

  setRefVideoFile(chapterId: string, itemId: string, path: string, poster: string | null, trimStart?: number, trimEnd?: number) {
    this.commit((p) => {
      const it = p.refPages[chapterId]?.find((x) => x.id === itemId);
      if (!it) return;
      it.videoFile = path;
      if (poster) it.imageRef = poster; // 抽出的首圖當封面
      it.trimStart = trimStart;         // undefined＝整段（JSON 序列化時自動略去）
      it.trimEnd = trimEnd;
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

  select(id: string | null) {
    this.selectedId = id;
    this.selectedIds = id ? [id] : [];
    this.emit();
  }

  // ⌘點擊：加選/取消（多選群組用）
  toggleSelect(id: string) {
    const i = this.selectedIds.indexOf(id);
    if (i >= 0) this.selectedIds.splice(i, 1);
    else this.selectedIds.push(id);
    this.selectedId = this.selectedIds[this.selectedIds.length - 1] ?? null;
    this.emit();
  }

  // Shift 點擊：從上一次選取連選到這顆（依分鏡順序）
  selectRange(id: string) {
    const a = this.project.cuts.findIndex((c) => c.id === this.selectedId);
    const b = this.project.cuts.findIndex((c) => c.id === id);
    if (a < 0 || b < 0) { this.select(id); return; }
    const [s, e] = a < b ? [a, b] : [b, a];
    this.selectedIds = this.project.cuts.slice(s, e + 1).map((c) => c.id);
    this.selectedId = id;
    this.emit();
  }

  isSelected(id: string): boolean {
    return this.selectedIds.length ? this.selectedIds.includes(id) : id === this.selectedId;
  }

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
