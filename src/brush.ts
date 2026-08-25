// 程序式筆刷（鉛筆／墨筆）的型別安全外殼。核心演算法在 brushCore（逐字搬自樣本間）。
//
// 與 pen／marker 的差別是**畫法不同**、不是參數不同：pen/marker 用 perfect-freehand
// 算封閉外形一次填滿；這兩支是逐點蓋章＋模糊融合＋紙紋鏤空。
//
// 舊檔安全：pen／marker 的程式碼一行未動；新筆畫用新的 tool 值並帶 v（配方版本），
// 之後調預設值時舊筆畫仍照當時的配方畫。

import { S, ensure, drawSoftStroke, drawSoftStrokeLive, liveEnd, drawLayered, streamline, speedPress, warmGrain, seedOfPoint } from "./brushCore";

export { liveEnd, seedOfPoint };

/** 開編輯器後閒時呼叫：先把這個尺寸的紙紋烤好，第一筆鉛筆才不會凍 ~80ms。 */
export function warmPencil(W: number, H: number): void {
  ensure(W, H);
  warmGrain(PENCIL);
}

export type ProcTool = "pencil" | "ink";
export const BRUSH_V = 1;
export const isProc = (t: string): t is ProcTool => t === "pencil" || t === "ink";

// 定案配方（2026-08-25 樣本間第 7 格；改配方先回樣本間試，別在這裡調）
const PENCIL = { dot: .085, fuzz: .30, dens: .45, grain: .92, dabA: .80, strokeA: .96, tooth: .85, ts: 7, tip: 1.6 };
const INKL = [
  { kind: "fill",  w: 1.1, alpha: 1, taper: true, grainW: .35 },
  { kind: "stamp", w: 1,   alpha: 1, stamp: { perWidth: 1.5, count: 1, r: .12, spread: .9, aMin: .2, aMax: .6 }, seed: 8 },
];

// 基準粗細（畫布 1280×720 座標）：pen 是 7、marker 24，這兩支落在中間。
export const BASE_W: Record<ProcTool, number> = { pencil: 11, ink: 9 };

// ── 筆壓校準：用「這隻手的常用力道」，不是「歷史最大力道」──────────────
// 2026-08-25 從 Armin iPad 上的真實筆畫量出來（效能壓力測試20／CUT 22，3231 點那筆）：
//   中位數 0.086、p90 0.128、**但偶爾出現孤立的 0.5 尖峰**，另外 5–10% 的點掉到 0.03 以下。
// 這解釋了他回報的兩個症狀：
//   ① 「偶爾幾個點特別大力」＝那些 0.5 尖峰（感測雜訊／落筆瞬間，不是他真的用力）
//   ② 「斷筆」＝那些接近 0 的點，映射後淡到看不見（線在那裡斷開）
// 而且第一版拿「歷史最大值」當滿力，等於被一顆尖峰綁架，整支筆從此都很淡。
// 三道處理：中位數濾波去孤立尖峰／掉點 → p90 的 EMA 當滿力 → 給一個最低可見度。
const medFilt = (a: number[], w = 2): number[] =>
  a.map((_, i) => {
    const s = a.slice(Math.max(0, i - w), i + w + 1).sort((x, y) => x - y);
    return s[s.length >> 1];
  });
let CAL = 0;
try { CAL = parseFloat(localStorage.getItem("stbPenCal") || "0") || 0; } catch { CAL = 0; }

// ⚠️ 校準值**只在收筆時**更新一次，而且每一筆把當下的值**烤進筆畫裡**（`SketchStroke.cal`）。
// 2026-08-25 二修的教訓（Armin：「密度會一直變化，我一直畫他會一直變化」）：
// 第一版在「每次重繪」都重算校準，而作畫中每一幀都會重繪整筆 →
//   ① 一筆畫到一半，前半段的濃度會跟著後半段的資料改變（畫著畫著整條線在變）
//   ② 更糟：**舊筆畫也會被新校準改掉**——同一份筆畫資料，畫面卻會隨後來畫了什麼而變。
// 那等於在動使用者已經畫好的東西，是紅線。現在：筆畫記自己的 cal，永遠照它自己的畫。
export const currentCap = (): number => Math.max(.08, Math.min(.9, (CAL > .02 ? CAL : .12) * 1.5));
/** 收筆時呼叫：把這一筆的 p90 併進校準（影響**之後**的筆畫，不動已經畫好的）。 */
export function noteStroke(pts: number[][]): void {
  if (pts.length < 8) return;
  if (pts.every((q) => q[2] === pts[0][2])) return;   // 滑鼠／沒回報筆壓＝不列入校準
  const f = medFilt(pts.map((q) => q[2] ?? 0)).sort((a, b) => a - b);
  const p90 = f[Math.floor(f.length * .9)];
  if (!(p90 > 0.02)) return;
  const next = CAL ? CAL * 0.75 + p90 * 0.25 : p90;
  if (Math.abs(next - CAL) < 0.002) return;
  CAL = next;
  try { localStorage.setItem("stbPenCal", String(CAL)); } catch { /* 私密瀏覽 */ }
}

/** 把 STB 的筆畫（[x,y,pressure][]）用程序式筆刷畫到 cx 上。W/H＝畫布尺寸。 */
export function paintProcStroke(
  cx: CanvasRenderingContext2D, pts0: number[][], tool: ProcTool,
  width: number, color: string, alpha: number, W: number, H: number,
  cal?: number,   // 這一筆自己的滿力值；沒給＝用目前校準（只有作畫中的預覽會這樣）
  liveKey?: string,   // 有給＝作畫中：走增量渲染（已定案那段不重畫）
  seed?: number,      // 裂筆帶原種子（見 brushCore.strokeSeed）
  off?: number,       // 裂筆帶原弧長起點
): void {
  if (pts0.length < 2) return;
  ensure(W, H);
  // 先丟掉幾乎重疊的點（Pencil 240Hz 在轉向處會連著吐好幾個同位置的點）：
  // 它們不帶形狀資訊，卻會讓「速度＝0」→ 速度模擬判定成用力按 → 局部變粗變黑（疙瘩）。
  const src: number[][] = [pts0[0]];
  for (let i = 1; i < pts0.length; i++) {
    const q = pts0[i], l = src[src.length - 1];
    if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= .35 || i === pts0.length - 1) src.push(q);
  }
  const pts = src;
  if (pts.length < 2) return;
  const p = streamline(pts.map((q) => ({ x: q[0], y: q[1] })), .55) as { x: number; y: number }[];
  const sp: number[] = speedPress(p, width);
  const n = pts.length - 1;
  const at = (i: number) => Math.min(n, Math.round((p.length > 1 ? i / (p.length - 1) : 0) * n));
  // 全部同壓＝滑鼠或沒回報筆壓 → 用速度模擬（與 pen 的 simulatePressure 同一個判斷）
  const pen = !pts.every((q) => q[2] === pts[0][2]);
  const prs: number[] = pen ? medFilt(pts.map((q) => q[2] ?? 0)) : [];   // 去孤立尖峰與掉點
  const cap = cal && cal > .02 ? cal : currentCap();
  const rm = (v: number) => Math.max(.06, Math.min(1, (v - .01) / Math.max(.05, cap - .01)));  // .06＝最低可見度，不讓線斷掉
  const u = p.map((_, i) => pen ? rm(prs[at(i)])
                                : Math.max(0, Math.min(1, .62 + ((sp[i] - .45) / .7 - .62) * .8)));
  const press = p.map((_, i) => pen
    ? (0.20 + 1.15 * u[i]) * (0.75 + 0.25 * Math.max(0, Math.min(1, (sp[i] - .45) / .7)))
    : 1 + (sp[i] - 1) * .8);
  const col = color.replace("#", "");
  if (tool === "ink") {
    S.opa = alpha;
    drawLayered(cx, p, press, width, col, INKL);
    S.opa = 1;
  } else {
    S.__a = alpha;
    const st = { pts: p, press, u, tilt: p.map(() => 0), az: p.map(() => 0), w: width, color: col,
                 ...(seed != null ? { seed } : {}), ...(off ? { off } : {}) };
    if (liveKey) drawSoftStrokeLive(cx, st, PENCIL, S, 1, 0, liveKey);
    else drawSoftStroke(cx, st, PENCIL, S, 1, 1e9, 0);
    S.__a = 1;
  }
}
