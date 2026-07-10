// 資料模型 + 連鎖引擎。schema 是唯一介面（紅線）。
// 這裡只放「真相結構」與「衍生機器欄」；渲染/操作在別處。

export interface Meta {
  title: string;
  client: string;
  version: number;
  logo?: string | null; // 首頁 LOGO（data URL，透明 PNG 佳）；null＝內建預設（錄人）
}

// cut = 真相。groupId 相同 = 連續鏡群組（05-1/05-2），移動時整組同行。
export interface Cut {
  id: string;
  groupId: string;
  shot: string;      // 景別 W/M/CU
  desc: string;      // 畫面描述（人欄）
  vo: string;        // VO（人欄）
  sup: string;       // Super 疊印字卡（人欄）
  imageRef: string | null; // 分鏡圖 assets 檔名
  prompt: string;
  props: string;
  note: string;
}

export interface Project {
  meta: Meta;          // 整片層級：片名、客戶、版次
  contacts: Contact[]; // 通告單聯絡人（製片／監製／導演＋電話，整片層級）
  cuts: Cut[];         // STORYBOARD 章：整支片的分鏡（不分天）
  days: ShootDay[];    // SCHEDULE 子項「拍攝日程」：各拍攝日（通告＋該日 Rundown）
  milestones: Milestone[]; // SCHEDULE 大項「製作時程」甘特圖
  refPages: Record<string, RefItem[]>; // 通用圖文章節，key = 章節 id
  hiddenChapters?: string[]; // 這次不給客戶看的章（簡報/匯出跳過；編輯器照常）
  // 案子類型：ppm＝完整十章；schedule＝通告排表（製片版——側欄只剩
  // 甘特/通告單/Rundown）。同一種檔案，隨時可切換＝「整合回 STB」天然成立。
  mode?: "ppm" | "schedule";
}

export interface Contact { role: string; name: string; phone: string; }

// PPM AGENDA 章節（固定十章）
export type ChapterKind = "agenda" | "refpage" | "storyboard" | "schedule";
export interface Chapter { id: string; label: string; en: string; kind: ChapterKind; }
export const CHAPTERS: Chapter[] = [
  { id: "agenda", label: "目錄", en: "AGENDA", kind: "agenda" },
  { id: "tone", label: "調性", en: "TONE & MANNER", kind: "refpage" },
  { id: "rhythm", label: "參考節奏", en: "REFERENCE RHYTHM", kind: "refpage" },
  { id: "storyboard", label: "分鏡", en: "STORYBOARD", kind: "storyboard" },
  { id: "references", label: "參考資料", en: "REFERENCES", kind: "refpage" },
  { id: "actor", label: "演員", en: "ACTOR", kind: "refpage" },
  { id: "wardrobe", label: "服裝", en: "WARDROBE", kind: "refpage" },
  { id: "setting", label: "美術道具", en: "SETTING", kind: "refpage" },
  { id: "location", label: "場景", en: "LOCATION", kind: "refpage" },
  { id: "schedule", label: "製作時程", en: "SCHEDULE", kind: "schedule" },
];

// 通用圖文參考項目（TONE/REFERENCE/ACTOR/WARDROBE/SETTING/LOCATION… 共用）
export interface RefItem {
  id: string;
  imageRef: string | null; // 首圖／封面（列印用靜態圖）
  title: string;
  note: string;
  videoUrl?: string;    // 外部影片連結（YouTube／Vimeo／雲端），▶ 系統瀏覽器開
  videoFile?: string;   // 本機影片檔（案子 assets/ 相對路徑），區塊內播放
  trimStart?: number;   // 首尾裁切（秒）：不重新編碼，播放時從起點播、到終點停
  trimEnd?: number;
  cutRefs?: string[];   // 對照的分鏡 cut id（表明此參考的招式／動態對應哪幾顆 cut）
}

// 人是直立的：這兩章的參考圖用 9:16 直式
export const PORTRAIT_CHAPTERS = new Set(["actor", "wardrobe"]);

// 製作時程里程碑（SCHEDULE 大項＝甘特圖：拍攝 → A copy → 客戶回饋 → B copy → … → Final）
export interface Milestone { id: string; label: string; start: string; end: string; color?: string; } // "YYYY-MM-DD"

// 甘特條顏色盤（配合米白視覺的低彩度；第一個＝預設黑條）
export const GANTT_COLORS = ["#2b2a27", "#185fa5", "#3b6d11", "#b07d2b", "#a33a2f", "#6a4b8a", "#8f8d87"];

// 拍攝日程區塊＝真實時間段（不是影片秒數）
export type BlockType = "集合" | "拍攝" | "移動" | "場佈" | "用餐" | "其他";
export const BLOCK_TYPES: BlockType[] = ["集合", "拍攝", "移動", "場佈", "用餐", "其他"];

export interface RundownBlock {
  id: string;
  durMin: number;      // 時長（分），±5 檔位調整
  type: BlockType;
  title: string;
  loc: string;         // 地點
  mapUrl: string;      // 地圖連結
  park: string;        // 停車
  parkImage?: string | null; // 停車位置照片（data URL，顯示比分鏡縮圖大約兩倍）
  props: string;       // 道具準備
  cutIds: string[];    // 指派的 cut（引用 Cut.id，拍攝類）
  note: string;
}

// 拍攝日：一天一份通告（callTime/callGroups）＋該日 Rundown（通告在 Rundown 前）
export interface CallGroup { label: string; time: string; loc: string; }
export interface ShootDay {
  id: string;
  date: string;
  callTime: string;      // 集合時間（Rundown 順延起點）
  callGroups: CallGroup[]; // 大組通告時間（組別/演員 → 集合時間＋地點）
  rundown: RundownBlock[];
}

export interface BlockTime { start: number; end: number; }

// 順延連鎖：第一塊由集合時間起，之後接續累加；改任一塊時長，後面全順推
export function chainRundown(blocks: RundownBlock[], firstStartMin: number): BlockTime[] {
  const out: BlockTime[] = [];
  let t = firstStartMin;
  for (const b of blocks) {
    out.push({ start: t, end: t + b.durMin });
    t += b.durMin;
  }
  return out;
}

export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// ---- 衍生機器欄（不存原始，即時算，存檔時才寫入 JSON）----

export interface CutNumber {
  main: string;          // "05"
  sub: number | null;    // 1,2… 或 null
  label: string;         // "05" 或 "05-1"
  groupSize: number;     // 所屬群組成員數
}

export const PER_PAGE = 8; // 4×2，檔位制可調

// 依出現順序給群組主號；群組成員 >1 則加子號
export function computeCutNumbers(cuts: Cut[]): Map<string, CutNumber> {
  const order: string[] = [];
  const members = new Map<string, string[]>();
  for (const c of cuts) {
    if (!members.has(c.groupId)) {
      members.set(c.groupId, []);
      order.push(c.groupId);
    }
    members.get(c.groupId)!.push(c.id);
  }
  const out = new Map<string, CutNumber>();
  order.forEach((gid, idx) => {
    const mem = members.get(gid)!;
    const main = String(idx + 1).padStart(2, "0");
    mem.forEach((cid, mi) => {
      const sub = mem.length > 1 ? mi + 1 : null;
      out.set(cid, {
        main,
        sub,
        label: main + (sub ? "-" + sub : ""),
        groupSize: mem.length,
      });
    });
  });
  return out;
}

// 頁面歸屬：第幾頁第幾格
export function pageOf(seqIndex: number): { page: number; slot: number } {
  return { page: Math.floor(seqIndex / PER_PAGE), slot: seqIndex % PER_PAGE };
}

export function pageCount(cutCount: number): number {
  return Math.max(1, Math.ceil(cutCount / PER_PAGE));
}

// ---- 不變式：同群組的 cut 必須在陣列中相鄰（連續鏡不可被拆散）----
// 所有會改動順序的操作都要維持這條。這裡提供一個正規化函式當保險絲。
export function normalizeGroups(cuts: Cut[]): Cut[] {
  const seen = new Set<string>();
  const groupFirstIndex = new Map<string, number>();
  cuts.forEach((c, i) => {
    if (!groupFirstIndex.has(c.groupId)) groupFirstIndex.set(c.groupId, i);
  });
  // 依每個群組首次出現的順序，把同群組成員收攏在一起
  const order = [...groupFirstIndex.keys()];
  const byGroup = new Map<string, Cut[]>();
  for (const c of cuts) {
    if (!byGroup.has(c.groupId)) byGroup.set(c.groupId, []);
    byGroup.get(c.groupId)!.push(c);
  }
  const out: Cut[] = [];
  for (const gid of order) {
    if (seen.has(gid)) continue;
    seen.add(gid);
    out.push(...byGroup.get(gid)!);
  }
  return out;
}

let _uid = 0;
export function newId(prefix = "c"): string {
  _uid += 1;
  return `${prefix}${Date.now().toString(36)}${_uid}`;
}

// 載入外部 project.json 的防呆：缺欄位補預設值，舊檔/手改檔不會炸。
// （渲染端只認 schema——這裡是進門的守門員。）
export function normalizeProject(raw: unknown): Project {
  const r = (raw ?? {}) as Partial<Project> & Record<string, unknown>;
  const meta = (r.meta ?? {}) as Partial<Project["meta"]>;
  const cuts = Array.isArray(r.cuts) ? r.cuts : [];
  const days = Array.isArray(r.days) ? r.days : [];
  return {
    meta: {
      title: meta.title ?? "未命名案子",
      client: meta.client ?? "",
      version: meta.version ?? 1,
      logo: meta.logo ?? null,
    },
    // 聯絡人：舊檔沒有這欄 → 給預設三人（示意名與示意電話；導演預設高偉鳴）
    contacts: Array.isArray(r.contacts)
      ? (r.contacts as Partial<Contact>[]).map((c) => ({ role: c?.role ?? "", name: c?.name ?? "", phone: c?.phone ?? "" }))
      : [
          { role: "製片", name: "示意製片", phone: "0900-000-000" },
          { role: "監製", name: "示意監製", phone: "0900-000-000" },
          { role: "導演", name: "高偉鳴", phone: "0900-000-000" },
        ],
    cuts: cuts.map((c) => ({
      id: c?.id ?? newId(),
      groupId: c?.groupId ?? newId("g"),
      shot: c?.shot ?? "",
      desc: c?.desc ?? "",
      vo: c?.vo ?? "",
      sup: c?.sup ?? "",
      imageRef: c?.imageRef ?? null,
      prompt: c?.prompt ?? "",
      props: c?.props ?? "",
      note: c?.note ?? "",
    })),
    days: days.map((d) => ({
      id: d?.id ?? newId("d"),
      date: d?.date ?? "",
      callTime: d?.callTime ?? "08:00",
      callGroups: (Array.isArray(d?.callGroups) ? d.callGroups : []).map((g) => ({
        label: g?.label ?? "", time: g?.time ?? "", loc: g?.loc ?? "",
      })),
      rundown: (Array.isArray(d?.rundown) ? d.rundown : []).map((b) => ({
        id: b?.id ?? newId("b"),
        durMin: typeof b?.durMin === "number" && b.durMin >= 5 ? b.durMin : 30,
        type: b?.type ?? "其他",
        title: b?.title ?? "",
        loc: b?.loc ?? "",
        mapUrl: b?.mapUrl ?? "",
        park: b?.park ?? "",
        parkImage: b?.parkImage ?? null,
        props: b?.props ?? "",
        cutIds: Array.isArray(b?.cutIds) ? b.cutIds : [],
        note: b?.note ?? "",
      })),
    })),
    milestones: (Array.isArray(r.milestones) ? r.milestones : []).map((m) => ({
      id: m?.id ?? newId("m"),
      label: m?.label ?? "",
      start: m?.start ?? "",
      end: m?.end ?? m?.start ?? "",
      color: m?.color,
    })),
    refPages: (typeof r.refPages === "object" && r.refPages) ? (r.refPages as Project["refPages"]) : {},
    hiddenChapters: Array.isArray(r.hiddenChapters)
      ? (r.hiddenChapters as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    mode: r.mode === "schedule" ? "schedule" : "ppm",
  };
}
