// 資料模型 + 連鎖引擎。schema 是唯一介面（紅線）。
// 這裡只放「真相結構」與「衍生機器欄」；渲染/操作在別處。

// 分鏡比例：整片層級一次定案。加新比例＝在 ASPECTS 表加一行（版面沿用橫/直兩套，不用改程式）。
export type Aspect = "16:9" | "9:16" | "3:2" | "21:9";

export interface AspectSpec {
  ar: number;                      // 寬/高
  label: string;                   // 選擇器顯示名
  board: { w: number; h: number }; // 裁切/塗鴉畫布尺寸
  portrait: boolean;               // 直式版面（卡片站立、6 欄）
}
export const ASPECTS: Record<Aspect, AspectSpec> = {
  "16:9": { ar: 16 / 9, label: "橫式 16:9", board: { w: 1280, h: 720 }, portrait: false },
  "3:2":  { ar: 3 / 2,  label: "全幅 3:2",  board: { w: 1200, h: 800 }, portrait: false },
  "21:9": { ar: 21 / 9, label: "寬銀幕 21:9", board: { w: 1344, h: 576 }, portrait: false },
  "9:16": { ar: 9 / 16, label: "直式 9:16", board: { w: 720, h: 1280 }, portrait: true },
};
export function aspectSpec(a?: string): AspectSpec {
  return ASPECTS[(a as Aspect) ?? "16:9"] ?? ASPECTS["16:9"];
}

export interface Meta {
  title: string;
  client: string;
  version: number;
  logo?: string | null; // 首頁 LOGO（data URL，透明 PNG 佳）；null＝內建預設（錄人）
}

// 多路腳本：一份 PPM 同時含多支片（兩路/三路），每路獨立 CUT 01 起跳。
// 跨路引用（Rundown/對照 cut）用「A-01」前綴顯示，編號不打架。
export interface Film { id: string; name: string; }

// 塗鴉分鏡（04 企劃⑤）：筆跡存資料、可再編輯；imageRef 存壓平 PNG
// （簡報/匯出走既有圖片管線，零改動）。pts＝[x, y, 壓力] 序列（1280×720 座標）。
export interface SketchStroke { tool: "pen" | "marker"; pts: number[][]; } // pts＝[x,y,壓力]（分鏡底圖座標，見 boardDims）
// 兩層固定圖層：場景（構圖，複製後通常不動）＋人物（表演/運鏡，擦掉重畫）。
// underlay＝勘景照描圖墊底（半透明顯示沿描；輸出壓平「不含」墊底）。
export interface CutSketch { scene: SketchStroke[]; figure: SketchStroke[]; underlay?: string | null; }

// cut = 真相。groupId 相同 = 連續鏡群組（05-1/05-2），移動時整組同行。
export interface Cut {
  id: string;
  groupId: string;
  filmId: string;    // 屬於哪一路（films 的 id）
  shot: string;      // 景別 W/M/CU
  // 秒數（選配）：2026-07-07 從繁中版拿掉、schema 留選配位；2026-07-28 日文版啟用
  // （日本絵コンテ每 cut 必填秒數＋頁尾合計對齊 15/30 秒）。缺欄＝舊行為，舊檔 byte-identical。
  sec?: number;
  desc: string;      // 畫面描述（人欄）
  vo: string;        // VO（人欄）
  sup: string;       // Super 疊印字卡（人欄）
  imageRef: string | null; // 分鏡圖 assets 檔名
  sketch?: CutSketch | null; // 塗鴉筆跡（有＝imageRef 是它壓平的，點縮圖回編輯器）
  prompt: string;
  props: string;
  note: string;
  // STB Camera 場勘：攝影師在現場拍的鏡位圖（data URL，與 imageRef 同存法）。
  // imageRef＝導演的分鏡（永不被場勘覆蓋）；scoutRef＝現場實拍，分鏡章可切換顯示。
  // 缺欄＝沒場勘（舊檔序列化後 byte-identical）。
  scoutRef?: string | null;
  scoutMeta?: { system: "ff" | "s35"; focal: number; takenAt: string } | null; // 拍攝資訊：機身/標示焦距/ISO 時間
  // 隱藏 cut（Keynote 跳過投影片邏輯）：編輯器顯示細灰格、預覽/匯出看不見、不佔編號。
  // 場勘溢出（現場新增的 cut）匯入時預設隱藏＝照片有地方住、分鏡編號完全不動。
  hidden?: boolean;
}

export interface Project {
  meta: Meta;          // 整片層級：片名、客戶、版次
  contacts: Contact[]; // 通告單聯絡人（製片／監製／導演＋電話，整片層級）
  films: Film[];       // 多路腳本：至少一路；cut 以 filmId 歸屬
  cuts: Cut[];         // STORYBOARD 章：全部路的分鏡（依 filmId 分路顯示/編號）
  days: ShootDay[];    // SCHEDULE 子項「拍攝日程」：各拍攝日（通告＋該日 Rundown）
  milestones: Milestone[]; // SCHEDULE 大項「製作時程」甘特圖
  refPages: Record<string, RefItem[]>; // 通用圖文章節，key = 章節 id
  hiddenChapters?: string[]; // 這次不給客戶看的章（簡報/匯出跳過；編輯器照常）
  // 案子類型：ppm＝完整十章；schedule＝通告排表（製片版——側欄只剩
  // 甘特/通告單/Rundown）。同一種檔案，隨時可切換＝「整合回 STB」天然成立。
  mode?: "ppm" | "schedule";
  // 分鏡比例：橫式 16:9（預設）／直式 9:16。缺欄＝16:9（舊案不動、序列化零改動）。
  aspect?: Aspect;
}

export interface Contact { role: string; name: string; phone: string; }

// PPM AGENDA 章節（固定十章）
export type ChapterKind = "agenda" | "refpage" | "storyboard" | "schedule";
// en＝現行 deck 標題（台灣圈慣用英文，zh 語系沿用不變）；
// enIntl＝英語市場修正版（LOOK & FEEL 等，依 07_在地化對照表）；ja＝日文 deck 標題。
// 消費端在 en/ja 語系才改用 enIntl/ja（階段 1/2 接線），zh 行為零變。
export interface Chapter { id: string; label: string; en: string; enIntl: string; ja: string; kind: ChapterKind; }
export const CHAPTERS: Chapter[] = [
  { id: "agenda", label: "目錄", en: "AGENDA", enIntl: "AGENDA", ja: "目次", kind: "agenda" },
  { id: "tone", label: "調性", en: "TONE & MANNER", enIntl: "LOOK & FEEL", ja: "トーン&マナー", kind: "refpage" },
  { id: "rhythm", label: "參考節奏", en: "REFERENCE RHYTHM", enIntl: "RHYTHM REFERENCES", ja: "リズム参考", kind: "refpage" },
  { id: "storyboard", label: "分鏡", en: "STORYBOARD", enIntl: "STORYBOARD", ja: "絵コンテ", kind: "storyboard" },
  { id: "references", label: "參考資料", en: "REFERENCES", enIntl: "REFERENCES", ja: "リファレンス", kind: "refpage" },
  { id: "actor", label: "演員", en: "ACTOR", enIntl: "TALENT", ja: "キャスト", kind: "refpage" },
  { id: "wardrobe", label: "服裝", en: "WARDROBE", enIntl: "WARDROBE", ja: "衣装・ヘアメイク", kind: "refpage" },
  { id: "setting", label: "美術道具", en: "SETTING", enIntl: "ART & SET DESIGN", ja: "美術・セット", kind: "refpage" },
  { id: "location", label: "場景", en: "LOCATION", enIntl: "LOCATIONS", ja: "ロケ地", kind: "refpage" },
  { id: "schedule", label: "製作時程", en: "SCHEDULE", enIntl: "SCHEDULE", ja: "スケジュール", kind: "schedule" },
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
  portrait?: boolean;   // 直式縮圖（參考/節奏章：依匯入素材方向自動判定；缺＝橫式）
}

// 人是直立的：這兩章的參考圖用 9:16 直式
export const PORTRAIT_CHAPTERS = new Set(["actor", "wardrobe"]);

// 製作時程里程碑（SCHEDULE 大項＝甘特圖：拍攝 → A copy → 客戶回饋 → B copy → … → Final）
export interface Milestone { id: string; label: string; start: string; end: string; color?: string; } // "YYYY-MM-DD"

// 甘特條顏色盤（配合米白視覺的低彩度；第一個＝預設黑條）
export const GANTT_COLORS = ["#2b2a27", "#185fa5", "#3b6d11", "#b07d2b", "#a33a2f", "#6a4b8a", "#8f8d87"];

// 拍攝日程區塊＝真實時間段（不是影片秒數）
// type 存英文 key（1.6.0 起）；顯示文字一律查 BLOCK_TYPE_LABELS，勿直接渲染 type。
export type BlockType = "call" | "shoot" | "move" | "setup" | "meal" | "other";
export const BLOCK_TYPES: BlockType[] = ["call", "shoot", "move", "setup", "meal", "other"];
export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  call: "集合", shoot: "拍攝", move: "移動", setup: "場佈", meal: "用餐", other: "其他",
};
// 1.5.x 以前 type 直接存中文——載入時在 normalizeProject 遷移成 key
const LEGACY_BLOCK_TYPES: Record<string, BlockType> = {
  "集合": "call", "拍攝": "shoot", "移動": "move", "場佈": "setup", "用餐": "meal", "其他": "other",
};
export function toBlockType(v: unknown): BlockType {
  if (typeof v === "string") {
    if ((BLOCK_TYPES as string[]).includes(v)) return v as BlockType;
    if (LEGACY_BLOCK_TYPES[v]) return LEGACY_BLOCK_TYPES[v];
  }
  return "other";
}

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

export const PER_PAGE = 8; // 橫式 4×2（匯出 pptxNative 仍走此值；直式用 perPage()）

// 分鏡底圖尺寸（匯入裁切、塗鴉畫布共用）：直式＝橫式轉 90°。
export function boardDims(aspect?: Aspect): { w: number; h: number } {
  return aspectSpec(aspect).board;
}

// 分鏡章每頁格數：橫式 4欄×2列＝8（原值不變）；直式 6欄×2列＝12。
export function perPage(aspect?: Aspect): number {
  return aspectSpec(aspect).portrait ? 12 : 8;
}

// 依出現順序給群組主號；群組成員 >1 則加子號。
// 多路（films.length>1）：每路獨立從 01 編，label 加路前綴（A-05、B-01…）
// ——跨路引用（Rundown/對照 cut）不打架；單路維持原樣（CUT 05）。
export function computeCutNumbers(cuts: Cut[], films?: Film[]): Map<string, CutNumber> {
  const out = new Map<string, CutNumber>();
  const filmOrder: string[] = films?.length ? films.map((f) => f.id) : [];
  for (const c of cuts) if (!filmOrder.includes(c.filmId)) filmOrder.push(c.filmId); // 防漏
  const multi = filmOrder.length > 1;

  filmOrder.forEach((fid, fi) => {
    const sub = cuts.filter((c) => c.filmId === fid && !c.hidden);
    // 隱藏的不佔號（Keynote 跳過邏輯）；標籤「隱藏」給引用處顯示
    for (const c of cuts) if (c.filmId === fid && c.hidden) out.set(c.id, { main: "—", sub: null, label: "隱藏", groupSize: 1 });
    const order: string[] = [];
    const members = new Map<string, string[]>();
    for (const c of sub) {
      if (!members.has(c.groupId)) {
        members.set(c.groupId, []);
        order.push(c.groupId);
      }
      members.get(c.groupId)!.push(c.id);
    }
    const prefix = multi ? String.fromCharCode(65 + fi) + "-" : "";
    order.forEach((gid, idx) => {
      const mem = members.get(gid)!;
      const main = String(idx + 1).padStart(2, "0");
      mem.forEach((cid, mi) => {
        const subNo = mem.length > 1 ? mi + 1 : null;
        out.set(cid, {
          main,
          sub: subNo,
          label: prefix + main + (subNo ? "-" + subNo : ""),
          groupSize: mem.length,
        });
      });
    });
  });
  return out;
}

// 頁面歸屬：第幾頁第幾格
export function pageOf(seqIndex: number): { page: number; slot: number } {
  return { page: Math.floor(seqIndex / PER_PAGE), slot: seqIndex % PER_PAGE };
}

export function pageCount(cutCount: number, aspect?: Aspect): number {
  return Math.max(1, Math.ceil(cutCount / perPage(aspect)));
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
  // 多路：舊檔沒有 films → 給一路（A路），所有 cut 歸它
  const films: Film[] = Array.isArray(r.films) && (r.films as unknown[]).length
    ? (r.films as Partial<Film>[]).map((f, i) => ({
        id: f?.id ?? newId("f"),
        name: f?.name ?? `${String.fromCharCode(65 + i)}路`,
      }))
    : [{ id: newId("f"), name: "A路" }];
  const filmIds = new Set(films.map((f) => f.id));
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
    films,
    cuts: cuts.map((c) => ({
      id: c?.id ?? newId(),
      groupId: c?.groupId ?? newId("g"),
      filmId: c?.filmId && filmIds.has(c.filmId) ? c.filmId : films[0].id,
      shot: c?.shot ?? "",
      desc: c?.desc ?? "",
      vo: c?.vo ?? "",
      sup: c?.sup ?? "",
      imageRef: c?.imageRef ?? null,
      sketch: c?.sketch ?? null, // 塗鴉筆跡——漏了這行＝重開 App 筆跡全滅（上架前抓到的資料毀損 bug）
      prompt: c?.prompt ?? "",
      props: c?.props ?? "",
      note: c?.note ?? "",
      // 秒數：同上，只在有值時才寫入（沒填秒數的舊檔 byte-identical）
      ...(typeof c?.sec === "number" && c.sec > 0 ? { sec: c.sec } : {}),
      // 場勘欄位：只在有值時才寫入（同 aspect 慣例）＝沒場勘的舊檔 byte-identical
      ...(c?.scoutRef ? { scoutRef: c.scoutRef } : {}),
      ...(c?.scoutMeta ? { scoutMeta: c.scoutMeta } : {}),
      ...(c?.hidden ? { hidden: true } : {}),
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
        type: toBlockType(b?.type),
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
    // 預設 16:9 不寫入欄位＝舊檔序列化後 byte-identical；其餘認得的比例照存
    ...(typeof r.aspect === "string" && r.aspect !== "16:9" && (r.aspect as Aspect) in ASPECTS
      ? { aspect: r.aspect as Aspect } : {}),
  };
}
