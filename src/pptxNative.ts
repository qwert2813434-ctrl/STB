import PptxGenJS from "pptxgenjs";
import type { Store } from "./store";
import type { Project, RefItem, ShootDay } from "./model";
import { PORTRAIT_CHAPTERS, computeCutNumbers, chainRundown, hhmmToMin, minToHHMM, PER_PAGE, GANTT_COLORS } from "./model";
import { cutRefLabel } from "./cutPicker";
import { chapterPlan } from "./pages";
import { isTauri, currentDir } from "./persistence";
import { projectLogo, rasterLogo } from "./logoAsset";
import { invoke } from "@tauri-apps/api/core";

// 可編輯 PPTX：不是把頁面截成圖，而是照 App 版面邏輯用「原生物件」重排——
// 文字＝真文字框（客戶可改人名/時間/地點/腳本字）、圖片＝獨立圖片物件（可換）、
// 本機影片＝嵌入 mp4（PowerPoint/Keynote 可播；≤64MB，海報圖當封面）、
// 外部影片連結＝可點超連結（Google 雲端看不了嵌入影片時的最低保障）。
// 版面是「接近版」非像素等同：PPTX 沒有網頁排版引擎，字體用 PingFang TC。

type Slide = ReturnType<PptxGenJS["addSlide"]>;

const W = 10, H = 5.625;      // 16:9 吋
const MX = 0.45;              // 左右邊界
const TOP = 0.72;             // 內容起點（頁首小標下方）
const INK = "2b2a27", INK2 = "55534e", MUTED = "8f8d87", LINE = "e3e1d9";
const BLUE = "185fa5", GREEN = "3b6d11";
const FONT = "PingFang TC";

export interface PptxOptions {
  ids: Set<string>;           // 要匯出的章節 id
  withTitles: boolean;        // 封面＋章節標題頁
  onProgress?: (msg: string) => void;
}

export async function buildEditablePptx(store: Store, opts: PptxOptions): Promise<string> {
  const p = store.get();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "STB";
  pptx.title = p.meta.title || "PPM";

  const plan = chapterPlan(p); // 與簡報/PDF 同一份出場名單（空章/隱藏章跳過）

  if (opts.withTitles) {
    await logoSlide(pptx, p);
    coverSlide(pptx, p);
  }

  for (let i = 0; i < plan.length; i++) {
    const ch = plan[i];
    if (!opts.ids.has(ch.id)) continue;
    if (opts.withTitles) titleSlide(pptx, ch.en, ch.label, i + 1);
    opts.onProgress?.(`組裝 PPTX…${ch.label}`);
    if (ch.kind === "storyboard") {
      stbSlides(pptx, p, ch.en, ch.label, store.portraitDense);
    } else if (ch.kind === "schedule") {
      ganttSlide(pptx, p, ch.en, ch.label);
      for (let d = 0; d < p.days.length; d++) {
        callSheetSlide(pptx, p, p.days[d], d, ch.en);
        rundownSlides(pptx, p, p.days[d], d, ch.en);
      }
    } else {
      await refSlides(pptx, p, ch.id, ch.en, ch.label, opts.onProgress);
    }
  }
  return (await pptx.write({ outputType: "base64" })) as string;
}

// ---- 共用小件 ----

function header(sl: Slide, en: string, zh: string) {
  sl.addText(`${en} · ${zh}`, {
    x: MX, y: 0.16, w: W - MX * 2, h: 0.3,
    fontFace: FONT, fontSize: 9.5, color: MUTED, charSpacing: 2,
  });
}

// 首頁：置中 LOGO（獨立圖片物件＝操作者在 Keynote/PowerPoint 也能換）。
// SVG 先在 canvas 轉透明 PNG（jsPDF/PowerPoint 對 SVG 支援不一）。
async function logoSlide(pptx: PptxGenJS, p: Project) {
  const raster = await rasterLogo(projectLogo(p));
  if (!raster) return;
  const sl = pptx.addSlide();
  const k = Math.min(3.6 / raster.w, 2.1 / raster.h);
  const w = raster.w * k, h = raster.h * k;
  sl.addImage({ data: raster.data, x: (W - w) / 2, y: (H - h) / 2, w, h });
}

function coverSlide(pptx: PptxGenJS, p: Project) {
  const sl = pptx.addSlide();
  sl.addText(p.meta.title || "未命名案子", { x: MX, y: 0.85, w: W - MX * 2, h: 0.75, fontFace: FONT, fontSize: 30, bold: true, color: INK });
  sl.addText(`${p.mode === "schedule" ? "拍攝通告" : "PPM ・ 前製會議"} ・ ${p.meta.client}`, { x: MX, y: 1.62, w: W - MX * 2, h: 0.35, fontFace: FONT, fontSize: 12.5, color: MUTED });
  const rows = chapterPlan(p); // 目錄只列會出場的章
  rows.forEach((c, i) => {
    sl.addText([
      { text: `${String(i + 1).padStart(2, "0")}   `, options: { fontSize: 10, color: MUTED, fontFace: "Courier New" } },
      { text: c.en, options: { fontSize: 12, color: INK, fontFace: FONT } },
      { text: `　${c.label}`, options: { fontSize: 11, color: MUTED, fontFace: FONT } },
    ], { x: MX, y: 2.25 + i * 0.34, w: 6.5, h: 0.32 });
  });
}

function titleSlide(pptx: PptxGenJS, en: string, zh: string, index: number) {
  const sl = pptx.addSlide();
  sl.addText(String(index).padStart(2, "0"), { x: 0, y: 1.85, w: W, h: 0.35, align: "center", fontFace: "Courier New", fontSize: 12, color: MUTED, charSpacing: 4 });
  sl.addText(en, { x: 0, y: 2.25, w: W, h: 0.75, align: "center", fontFace: FONT, fontSize: 34, bold: true, color: INK });
  sl.addText(zh, { x: 0, y: 3.05, w: W, h: 0.4, align: "center", fontFace: FONT, fontSize: 13, color: MUTED });
}

// 影片項目：嵌入 mp4（有海報當封面）。過大或 .mov 容器 → Rust 用 avconvert
// 轉 720p H.264 再嵌（Armin 實案 118MB .mov 直嵌會爆檔＝之前「都不能播放」的
// 根因：超限被靜默跳過只剩海報圖）。轉檔失敗才落海報圖；
// 有外部連結 → 圖片本身掛超連結。
async function mediaOrImage(sl: Slide, it: RefItem, x: number, y: number, w: number, h: number, onProgress?: (m: string) => void) {
  if (it.videoFile && isTauri() && currentDir()) {
    try {
      onProgress?.(`處理影片…${it.title || it.videoFile}（大檔自動轉 720p，可能需要一點時間）`);
      // 首尾裁切點一併帶給 Rust：stb-trim 轉檔時直接切出該段（客戶只看到裁好的）
      const buf = await invoke<ArrayBuffer>("video_for_embed", {
        dir: currentDir(), rel: it.videoFile, maxMb: 60,
        trimStart: it.trimStart ?? null, trimEnd: it.trimEnd ?? null,
      });
      if (buf.byteLength > 0 && buf.byteLength <= 150 * 1024 * 1024) {
        onProgress?.(`嵌入影片…${it.title || it.videoFile}`);
        const m: Record<string, unknown> = { type: "video", data: `video/mp4;base64,${bufToB64(buf)}`, x, y, w, h };
        if (it.imageRef) m.cover = it.imageRef; // 海報圖當影片封面
        sl.addMedia(m as never);
        return;
      }
    } catch (err) { console.error("影片嵌入失敗", it.videoFile, err); /* 落到海報圖 */ }
  }
  if (it.imageRef) {
    const io: Record<string, unknown> = { data: it.imageRef, x, y, w, h };
    if (it.videoUrl) io.hyperlink = { url: it.videoUrl, tooltip: "播放影片" };
    sl.addImage(io as never);
  }
}

// 項目文字（標題／說明／對照 cut／影片連結），回傳用掉的高度
function itemTexts(sl: Slide, store: Store, it: RefItem, x: number, y: number, w: number, big = false) {
  let cy = y;
  if (it.title) {
    sl.addText(it.title, { x, y: cy, w, h: big ? 0.42 : 0.3, fontFace: FONT, fontSize: big ? 16 : 12, bold: true, color: INK });
    cy += big ? 0.44 : 0.31;
  }
  if (it.note) {
    sl.addText(it.note, { x, y: cy, w, h: big ? 0.75 : 0.55, fontFace: FONT, fontSize: big ? 11 : 9.5, color: INK2, valign: "top" });
    cy += big ? 0.78 : 0.57;
  }
  if (it.cutRefs?.length) {
    sl.addText(`對照 ${cutRefLabel(store, it.cutRefs)}`, { x, y: cy, w, h: 0.26, fontFace: FONT, fontSize: 8.5, color: MUTED });
    cy += 0.27;
  }
  if (it.videoUrl) {
    sl.addText("▶ 影片連結", { x, y: cy, w, h: 0.28, fontFace: FONT, fontSize: 9.5, color: BLUE, underline: { style: "sng" }, hyperlink: { url: it.videoUrl } });
    cy += 0.29;
  }
  return cy - y;
}

// ---- 參考章（TONE／RHYTHM／REFERENCES／ACTOR／WARDROBE／SETTING／LOCATION）----

async function refSlides(pptx: PptxGenJS, p: Project, chId: string, en: string, zh: string, onProgress?: (m: string) => void) {
  const store = fakeStore(p);
  const items = p.refPages[chId] || [];
  // actor/wardrobe 恆直式；tone 跟隨整片比例（直式案＝直式）
  const portrait = PORTRAIT_CHAPTERS.has(chId) || (chId === "tone" && p.aspect === "9:16");
  const autoAspect = chId === "rhythm" || chId === "references"; // 逐項依素材方向（RefItem.portrait）
  const maxOne = chId === "references" || (chId === "rhythm" && items.length <= 1);

  if (maxOne) {
    // 單項最大化，一項一頁；references 右側放對照 cut 縮圖欄
    const numbers = computeCutNumbers(p.cuts, p.films);
    const cutTall = p.aspect === "9:16"; // 對照 cut 縮圖跟隨整片比例
    for (const it of items) {
      const sl = pptx.addSlide();
      header(sl, en, zh);
      const side = chId === "references";
      const itPortrait = autoAspect && !!it.portrait; // 直式素材：圖靠左限高、文字放右
      if (itPortrait) {
        const imgH = 3.9, imgW = imgH * 9 / 16;
        await mediaOrImage(sl, it, MX, TOP, imgW, imgH, onProgress);
        const tx = MX + imgW + 0.4;
        const tw = (side ? MX + 5.9 : W - MX) - tx; // references 保留右側對照欄空間
        itemTexts(sl, store, it, tx, TOP, Math.max(2.2, tw), true);
      } else {
        const imgW = side ? 5.9 : 6.6, imgH = imgW * 9 / 16;
        await mediaOrImage(sl, it, MX, TOP, imgW, imgH, onProgress);
        itemTexts(sl, store, it, MX, TOP + imgH + 0.12, imgW, true);
      }
      if (side && it.cutRefs?.length) {
        const sx = MX + 5.9 + 0.35, sw = W - sx - MX;
        sl.addText("對照 CUT", { x: sx, y: TOP, w: sw, h: 0.26, fontFace: FONT, fontSize: 9, color: MUTED, charSpacing: 2 });
        const thumbs = p.cuts.filter((c) => it.cutRefs!.includes(c.id));
        const tw = cutTall ? 0.8 : 1.35, th = cutTall ? tw * 16 / 9 : tw * 9 / 16;
        thumbs.forEach((c, i) => {
          const tx = sx + (i % 2) * (tw + 0.15);
          const ty = TOP + 0.32 + Math.floor(i / 2) * (th + 0.34);
          if (c.imageRef) sl.addImage({ data: c.imageRef, x: tx, y: ty, w: tw, h: th });
          sl.addText(`CUT ${numbers.get(c.id)?.label ?? ""}`, { x: tx, y: ty + th + 0.01, w: tw, h: 0.2, fontFace: "Courier New", fontSize: 7.5, color: MUTED, align: "center" });
        });
      }
    }
    return;
  }

  if (portrait) {
    // 演員／服裝：9:16 直式卡，4 個一頁
    for (let s = 0; s < items.length; s += 4) {
      const sl = pptx.addSlide();
      header(sl, en, zh);
      const batch = items.slice(s, s + 4);
      const cw = (W - MX * 2 - 3 * 0.25) / 4;
      for (let i = 0; i < batch.length; i++) {
        const x = MX + i * (cw + 0.25);
        const ih = 2.85, iw = ih * 9 / 16;
        await mediaOrImage(sl, batch[i], x + (cw - iw) / 2, TOP, iw, ih, onProgress);
        itemTexts(sl, store, batch[i], x, TOP + ih + 0.1, cw);
      }
    }
    return;
  }

  // 2×2（TONE／RHYTHM／SETTING／LOCATION）：4 個一頁
  for (let s = 0; s < items.length; s += 4) {
    const sl = pptx.addSlide();
    header(sl, en, zh);
    const batch = items.slice(s, s + 4);
    const cw = (W - MX * 2 - 0.35) / 2;
    const chh = (H - TOP - 0.25 - 0.2) / 2;
    for (let i = 0; i < batch.length; i++) {
      const it = batch[i];
      const x = MX + (i % 2) * (cw + 0.35);
      const y = TOP + Math.floor(i / 2) * (chh + 0.2);
      if (autoAspect && it.portrait) {
        // 直式素材：格內直式縮圖靠左（限高），文字放右
        const ih = 1.75, iw = ih * 9 / 16;
        await mediaOrImage(sl, it, x, y, iw, ih, onProgress);
        itemTexts(sl, store, it, x + iw + 0.2, y, cw - iw - 0.2);
      } else {
        const ih = 1.42, iw = ih * 16 / 9; // 圖上、文字下（同 App 版面）
        await mediaOrImage(sl, it, x, y, iw, ih, onProgress);
        itemTexts(sl, store, it, x, y + ih + 0.08, cw);
      }
    }
  }
}

// ---- 分鏡（STORYBOARD）：橫式 4×2 八顆一頁；直式一排 N 格站立框（頁維持 16:9）----

function stbSlides(pptx: PptxGenJS, p: Project, en: string, zh: string, dense = true) {
  const numbers = computeCutNumbers(p.cuts, p.films);
  const multi = p.films.length > 1;

  // 直式：頁還是 16:9，但分鏡格站立（9:16），一排放滿＝一頁（密 6／大 4）
  if (p.aspect === "9:16") {
    const cols = dense ? 6 : 4;
    const gap = 0.16;
    const cw = (W - MX * 2 - (cols - 1) * gap) / cols;
    const ih = Math.min(cw * 16 / 9, 3.3);   // 直式縮圖高度上限，留說明空間
    const iw = ih * 9 / 16;                   // 依高回推寬，格內置中
    const bottom = H - 0.12;
    for (const f of p.films) {
      const cuts = p.cuts.filter((c) => c.filmId === f.id);
      if (!cuts.length) continue;
      const pages = Math.max(1, Math.ceil(cuts.length / cols));
      for (let pg = 0; pg < pages; pg++) {
        const sl = pptx.addSlide();
        header(sl, en, `${zh}${multi ? ` · ${f.name}` : ""} · 頁 ${pg + 1}/${pages}`);
        for (let slot = 0; slot < cols; slot++) {
          const cut = cuts[pg * cols + slot];
          if (!cut) continue;
          const n = numbers.get(cut.id)!;
          const cx = MX + slot * (cw + gap);
          const ix = cx + (cw - iw) / 2;
          sl.addText(`CUT ${n.label}`, { x: cx, y: TOP, w: cw, h: 0.19, fontFace: "Courier New", fontSize: 8.5, bold: true, color: INK2, margin: 0, valign: "top" });
          const iy = TOP + 0.21;
          if (cut.imageRef) sl.addImage({ data: cut.imageRef, x: ix, y: iy, w: iw, h: ih });
          else sl.addShape("rect", { x: ix, y: iy, w: iw, h: ih, fill: { color: "f4f3ee" }, line: { color: LINE, width: 0.75 } });
          let cy = iy + ih + 0.06;
          if (cut.desc) {
            sl.addText(cut.desc, { x: cx, y: cy, w: cw, h: 0.5, fontFace: FONT, fontSize: 8, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
            cy += 0.52;
          }
          if (cut.vo && cy + 0.2 <= bottom) {
            sl.addText([{ text: "VO ", options: { fontSize: 7, bold: true, color: BLUE } }, { text: cut.vo, options: { fontSize: 8, color: BLUE } }], { x: cx, y: cy, w: cw, h: 0.2, fontFace: FONT, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
            cy += 0.22;
          }
          if (cut.sup && cy + 0.2 <= bottom) {
            sl.addText([{ text: "SUPER ", options: { fontSize: 7, bold: true, color: GREEN } }, { text: cut.sup, options: { fontSize: 8, color: GREEN } }], { x: cx, y: cy, w: cw, h: 0.2, fontFace: FONT, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
          }
        }
      }
    }
    return;
  }

  const cw = (W - MX * 2 - 3 * 0.22) / 4;
  const rh = (H - TOP - 0.25) / 2;
  for (const f of p.films) { // 多路：逐路出頁，頁標帶路名
    const cuts = p.cuts.filter((c) => c.filmId === f.id);
    if (!cuts.length) continue;
    const pages = Math.max(1, Math.ceil(cuts.length / PER_PAGE));
  for (let pg = 0; pg < pages; pg++) {
    const sl = pptx.addSlide();
    header(sl, en, `${zh}${multi ? ` · ${f.name}` : ""} · 頁 ${pg + 1}/${pages}`);
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const cut = cuts[pg * PER_PAGE + slot];
      if (!cut) continue;
      const n = numbers.get(cut.id)!;
      const x = MX + (slot % 4) * (cw + 0.22);
      const y = TOP + Math.floor(slot / 4) * rh;
      // 文字框全數 margin:0＋行高收緊——PPTX 文字框有預設內距，
      // 不歸零的話堆到 VO/SUPER 會壓到下一排的 CUT 標籤（Armin 實測回報）
      sl.addText(`CUT ${n.label}`, { x, y, w: cw, h: 0.19, fontFace: "Courier New", fontSize: 8.5, bold: true, color: INK2, margin: 0, valign: "top" });
      const ih = cw * 9 / 16;
      if (cut.imageRef) sl.addImage({ data: cut.imageRef, x, y: y + 0.21, w: cw, h: ih });
      else sl.addShape("rect", { x, y: y + 0.21, w: cw, h: ih, fill: { color: "f4f3ee" }, line: { color: LINE, width: 0.75 } });
      let cy = y + 0.21 + ih + 0.04;
      const bottom = y + rh - 0.06; // 本格底線，不越界壓到下一排
      if (cut.desc) {
        sl.addText(cut.desc, { x, y: cy, w: cw, h: 0.4, fontFace: FONT, fontSize: 8.5, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
        cy += 0.42;
      }
      if (cut.vo && cy + 0.2 <= bottom) {
        sl.addText([
          { text: "VO ", options: { fontSize: 7, bold: true, color: BLUE } },
          { text: cut.vo, options: { fontSize: 8, color: BLUE } },
        ], { x, y: cy, w: cw, h: 0.2, fontFace: FONT, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
        cy += 0.22;
      }
      if (cut.sup && cy + 0.2 <= bottom) {
        sl.addText([
          { text: "SUPER ", options: { fontSize: 7, bold: true, color: GREEN } },
          { text: cut.sup, options: { fontSize: 8, color: GREEN } },
        ], { x, y: cy, w: cw, h: 0.2, fontFace: FONT, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });
      }
    }
  }
  }
}

// ---- 製作時程（甘特）----

function ganttSlide(pptx: PptxGenJS, p: Project, en: string, zh: string) {
  if (!p.milestones.length) return;
  const sl = pptx.addSlide();
  header(sl, en, zh);
  const DAY = 86400000;
  const d2n = (s: string) => (s ? new Date(s + "T00:00:00").getTime() : NaN);
  let min = Infinity, max = -Infinity;
  for (const m of p.milestones) {
    const s = d2n(m.start), e = d2n(m.end);
    if (!isNaN(s)) min = Math.min(min, s);
    if (!isNaN(e)) max = Math.max(max, e + DAY);
  }
  const span = max > min ? max - min : DAY;
  // 版型＝事項｜軌道（條）｜日期欄——日期一律放固定右欄，與條完全脫鉤，
  // 不會再有「短條跟日期對不上」的問題（同 App：日期輸入框也在右側）
  const tx = 2.35, tw = 6.05;
  const dx = tx + tw + 0.12, dw = W - MX - dx;
  const fmtMD = (s: string) => { const [, m, d] = s.split("-"); return `${Number(m)}/${Number(d)}`; };
  p.milestones.forEach((m, i) => {
    const y = TOP + 0.15 + i * 0.42;
    sl.addText(m.label, { x: MX, y: y + 0.03, w: 1.8, h: 0.24, fontFace: FONT, fontSize: 10.5, color: INK, margin: 0, valign: "middle" });
    // 每列先鋪軌道框（淡底＋髮絲線）＝視覺基準，條不再像浮在空白裡
    sl.addShape("rect", { x: tx, y: y + 0.03, w: tw, h: 0.24, fill: { color: "f6f5f0" }, line: { color: LINE, width: 0.75 } });
    const s = d2n(m.start), e = d2n(m.end) + DAY;
    if (isNaN(s) || isNaN(d2n(m.end))) return;
    const bx = tx + ((s - min) / span) * tw;
    const bw = Math.max(0.14, ((e - s) / span) * tw);
    sl.addShape("roundRect", { x: bx, y: y + 0.03, w: bw, h: 0.24, fill: { color: (m.color || GANTT_COLORS[0]).replace("#", "") }, rectRadius: 0.04 });
    sl.addText(`${fmtMD(m.start)}${m.end !== m.start ? `–${fmtMD(m.end)}` : ""}`,
      { x: dx, y: y + 0.03, w: dw, h: 0.24, fontFace: FONT, fontSize: 8.5, color: INK2, align: "left", valign: "middle", margin: 0 });
  });
}

// ---- 通告單（每拍攝日一頁）----

function callSheetSlide(pptx: PptxGenJS, p: Project, day: ShootDay, dayIdx: number, en: string) {
  const sl = pptx.addSlide();
  header(sl, en, `通告單 · Day ${dayIdx + 1}`);
  const times = chainRundown(day.rundown, hhmmToMin(day.callTime));
  const wrap = times.length ? minToHHMM(times[times.length - 1].end) : "—";

  sl.addText([
    { text: p.meta.title, options: { fontSize: 19, bold: true, color: INK } },
    { text: "　拍攝通告單", options: { fontSize: 10, color: MUTED } },
  ], { x: MX, y: 0.5, w: 6.8, h: 0.42, fontFace: FONT });
  sl.addText(day.date || "", { x: 7.3, y: 0.55, w: W - 7.3 - MX, h: 0.35, fontFace: FONT, fontSize: 12, color: INK2, align: "right" });

  // 上方資訊條：集合／預計收工／製作
  const cells: [string, string][] = [["集合", day.callTime], ["預計收工", wrap], ["製作", p.meta.client]];
  const cw = (W - MX * 2 - 0.24) / 3;
  cells.forEach(([k, v], i) => {
    const x = MX + i * (cw + 0.12);
    sl.addShape("rect", { x, y: 1.05, w: cw, h: 0.8, fill: { color: "ffffff" }, line: { color: LINE, width: 1 } });
    sl.addText(k, { x: x + 0.14, y: 1.13, w: cw - 0.28, h: 0.22, fontFace: FONT, fontSize: 8.5, color: MUTED });
    sl.addText(v, { x: x + 0.14, y: 1.36, w: cw - 0.28, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: INK });
  });

  // 聯絡人橫排
  const runs: PptxGenJS.TextProps[] = [{ text: "聯絡人　", options: { fontSize: 9, color: MUTED } }];
  p.contacts.forEach((c) => {
    runs.push({ text: `${c.role} `, options: { fontSize: 9.5, color: MUTED } });
    runs.push({ text: `${c.name}　`, options: { fontSize: 10.5, bold: true, color: INK } });
    runs.push({ text: `${c.phone}　　`, options: { fontSize: 10, color: INK2 } });
  });
  sl.addText(runs, { x: MX, y: 2.02, w: W - MX * 2, h: 0.34, fontFace: FONT });

  // 大組通告時間：兩欄
  sl.addText("大組通告時間", { x: MX, y: 2.55, w: 4, h: 0.3, fontFace: FONT, fontSize: 11.5, bold: true, color: INK });
  const colW = (W - MX * 2 - 0.5) / 2;
  day.callGroups.forEach((g, i) => {
    const col = Math.floor(i / 7), row = i % 7;
    if (col > 1) return; // 超過 14 組：先截斷（實務不會）
    const x = MX + col * (colW + 0.5);
    const y = 2.95 + row * 0.36;
    sl.addText([
      { text: g.label, options: { fontSize: 10.5, bold: true, color: INK } },
      { text: g.loc ? ` ・ ${g.loc}` : "", options: { fontSize: 9.5, color: INK2 } },
    ], { x, y, w: colW - 0.85, h: 0.32, fontFace: FONT });
    sl.addText(g.time, { x: x + colW - 0.85, y, w: 0.85, h: 0.32, fontFace: FONT, fontSize: 10.5, bold: true, color: INK, align: "right" });
    sl.addShape("line", { x, y: y + 0.33, w: colW, h: 0, line: { color: LINE, width: 0.75 } });
  });
}

// ---- Rundown（每拍攝日、4 個時段一頁）----

function rundownSlides(pptx: PptxGenJS, p: Project, day: ShootDay, dayIdx: number, en: string) {
  if (!day.rundown.length) return;
  const numbers = computeCutNumbers(p.cuts, p.films);
  const times = chainRundown(day.rundown, hhmmToMin(day.callTime));
  const perSlide = 4;
  for (let s = 0; s < day.rundown.length; s += perSlide) {
    const sl = pptx.addSlide();
    header(sl, en, `Rundown · Day ${dayIdx + 1}${day.date ? ` · ${day.date}` : ""}`);
    const batch = day.rundown.slice(s, s + perSlide);
    batch.forEach((b, bi) => {
      const t = times[s + bi];
      const y = TOP + bi * 1.2;
      // 左：時間＋類型
      sl.addText(`${minToHHMM(t.start)}–${minToHHMM(t.end)}`, { x: MX, y, w: 1.45, h: 0.28, fontFace: "Courier New", fontSize: 11, bold: true, color: INK });
      sl.addText(b.type, { x: MX, y: y + 0.3, w: 1.45, h: 0.24, fontFace: FONT, fontSize: 9, color: MUTED });
      // 中：標題＋cut 縮圖列
      sl.addText(b.title, { x: 2.05, y, w: 3.95, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: INK });
      const thumbs = b.cutIds.map((cid) => p.cuts.find((c) => c.id === cid)).filter(Boolean).slice(0, 5);
      // 直式案：分鏡縮圖站立（縮小以塞進 1.2" 列高）；橫式維持 16:9
      const tall = p.aspect === "9:16";
      const tw = tall ? 0.35 : 0.78, th = tall ? tw * 16 / 9 : tw * 9 / 16, step = tall ? 0.44 : 0.86;
      thumbs.forEach((c, i) => {
        const tx = 2.05 + i * step;
        if (c!.imageRef) sl.addImage({ data: c!.imageRef, x: tx, y: y + 0.36, w: tw, h: th });
        sl.addText(numbers.get(c!.id)?.label ?? "", { x: tx, y: y + 0.36 + th, w: tw, h: 0.17, fontFace: "Courier New", fontSize: 6.5, color: MUTED, align: "center" });
      });
      // 右：地點／停車／道具＋停車圖
      const rx = 6.15, rw = b.parkImage ? 2.15 : 3.4;
      const lines: [string, string][] = [["地點", b.loc], ["停車", b.park], ["道具", b.props]];
      let ly = y;
      for (const [k, v] of lines) {
        if (!v) continue;
        sl.addText([
          { text: `${k} `, options: { fontSize: 7.5, bold: true, color: MUTED } },
          { text: v, options: { fontSize: 9, color: INK } },
        ], { x: rx, y: ly, w: rw, h: 0.26, fontFace: FONT, valign: "top" });
        ly += 0.28;
      }
      if (b.parkImage) {
        const pw = 1.1, ph = pw * 9 / 16;
        sl.addImage({ data: b.parkImage, x: W - MX - pw, y, w: pw, h: ph });
        sl.addText("停車", { x: W - MX - pw, y: y + ph, w: pw, h: 0.18, fontFace: FONT, fontSize: 7, color: MUTED, align: "center" });
      }
      if (bi < batch.length - 1) sl.addShape("line", { x: MX, y: y + 1.08, w: W - MX * 2, h: 0, line: { color: LINE, width: 0.75 } });
    });
  }
}

// cutRefLabel 需要 Store 介面，這裡只用 get()
function fakeStore(p: Project): Store {
  return { get: () => p } as unknown as Store;
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}
