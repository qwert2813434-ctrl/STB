import { bindEditKeys } from "./editKeys";
import type { Store } from "./store";
import { CHAPTERS, PORTRAIT_CHAPTERS, computeCutNumbers } from "./model";
import { openCropper } from "./cropper";
import { openExternal, chooseVideoImport, chooseMediaImport, mountInlineVideo, isTauri } from "./persistence";
import { openCutPicker, cutRefLabel } from "./cutPicker";

// 通用圖文參考頁：一個組件覆蓋 TONE / REFERENCE RHYTHM / REFERENCES /
// ACTOR / WARDROBE / SETTING / LOCATION 七章。
// - ACTOR / WARDROBE 用 9:16 直式卡（人是直立的）
// - 版型依章節分流：TONE＝2×2、RHYTHM＝1 或 2 個最大化、
//   REFERENCES＝單項最大化＋對照 cut 放右側欄（與區塊分開）
// - 上傳圖片先過裁切器（比例跟卡一致）
// - 每項可掛影片連結或本機影片，▶ 播放（簡報時也能點）

const expandedVideo = new Set<string>(); // 暫時展開但還沒填的影片連結行
const activeCleanups: (() => void)[] = []; // 區塊內播放中的影片（重繪時暫停＋釋放）

// 對照 cut 放側欄的章節（區塊最大化，cut 與區塊分開）
const SIDE_CHAPTERS = new Set(["references"]);

// 需要影片的章節：縮圖按鈕＝「＋ 加入檔案」，圖片影片一顆按鈕都吃
const VIDEO_CHAPTERS = new Set(["tone", "rhythm", "references"]);

function gridClass(chapterId: string, count: number, portrait: boolean): string {
  if (portrait) return " portrait";
  if (chapterId === "tone") return " cols2";                      // 2×2
  if (chapterId === "rhythm") return count <= 1 ? " cols1" : " cols2"; // 1 或 2 個最大
  if (SIDE_CHAPTERS.has(chapterId)) return " max";                 // 單項最大化
  if (chapterId === "setting" || chapterId === "location") return " cols2"; // 美術道具／場景＝2×2
  return "";
}

export function renderRefPage(store: Store, root: HTMLElement, chapterId: string) {
  while (activeCleanups.length) activeCleanups.pop()!(); // 重繪前先收掉播放中的影片
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  const portrait = PORTRAIT_CHAPTERS.has(chapterId);
  const side = SIDE_CHAPTERS.has(chapterId);
  const items = store.get().refPages[chapterId] || [];
  let html = `<p class="page-label">${ch?.en || ""} · A5 橫</p><div class="page refpage">`;
  if (!items.length) {
    html += `<div class="ref-empty">此章尚無內容。按「＋ 新增項目」貼上參考圖與說明。</div>`;
  }
  html += `<div class="ref-grid${gridClass(chapterId, items.length, portrait)}">`;
  for (const it of items) {
    const showVideo = (it.videoUrl ?? "") !== "" || expandedVideo.has(it.id);
    const hasVideo = (it.videoUrl ?? "") !== "" || (it.videoFile ?? "") !== "";
    const addLabel = VIDEO_CHAPTERS.has(chapterId) ? "＋ 加入檔案（圖片／影片）" : "＋ 圖片";
    const dark = it.videoFile && !it.imageRef; // 有影片但沒封面：暗底佔位
    // 徽章：本機影片＝▶（區塊內播）；只有連結＝↗（開瀏覽器，地圖/網頁都適用）
    const badge = it.videoFile ? "▶" : "↗";
    const main = `
        <div class="ref-thumb${portrait ? " portrait" : ""}${dark ? " dark" : ""}" data-refimg="${it.id}">
          ${it.imageRef ? `<img src="${it.imageRef}" alt="" draggable="false">` : `<span class="thumb-add">${dark ? "影片" : addLabel}</span>`}
          ${hasVideo ? `<button class="ref-play" data-refplay="${it.id}" aria-label="播放／開啟">${badge}</button>` : ""}
        </div>
        <div class="ref-title cut-line" contenteditable draggable="false" data-ritem="${it.id}" data-rf="title" data-ph="標題">${esc(it.title)}</div>
        <div class="ref-note cut-line" contenteditable draggable="false" data-ritem="${it.id}" data-rf="note" data-ph="說明／備註">${esc(it.note)}</div>
        ${side ? "" : renderCutRefs(store, it.id, it.cutRefs ?? [])}
        ${showVideo ? `<div class="ref-video"><span class="tag">${badge}</span><span class="cut-edit" contenteditable draggable="false" data-ritem="${it.id}" data-rf="videoUrl" data-ph="${VIDEO_CHAPTERS.has(chapterId) ? "影片連結（YouTube／Vimeo／雲端）" : "連結（地圖／網頁／雲端）"}">${esc(it.videoUrl ?? "")}</span></div>` : ""}
        <div class="ref-actions">
          ${!showVideo ? `<button class="ref-mini" data-refvideo="${it.id}">${VIDEO_CHAPTERS.has(chapterId) ? "＋ 影片連結" : "＋ 連結"}</button>` : ""}
          ${chapterId === "actor" ? `<button class="ref-mini" data-refvidfile="${it.id}">＋ 本機影片</button>` : ""}
        </div>`;
    if (side) {
      html += `
      <div class="ref-item side" data-item="${it.id}">
        <div class="ref-main">${main}</div>
        <div class="ref-side">
          <div class="ref-side-h">對照 CUT</div>
          ${renderCutRefs(store, it.id, it.cutRefs ?? [])}
        </div>
        <button class="ref-del" data-refdel="${it.id}" aria-label="刪除項目">✕</button>
      </div>`;
    } else {
      html += `
      <div class="ref-item" data-item="${it.id}">${main}
        <button class="ref-del" data-refdel="${it.id}" aria-label="刪除項目">✕</button>
      </div>`;
    }
  }
  html += `</div><div class="ref-addrow"><button data-refadd="${chapterId}">＋ 新增項目</button></div></div>`;
  root.innerHTML = html;
}

// 對照 cut 區：有選就顯示縮圖列＋範圍標籤；沒選給一個「＋ 對照 cut」按鈕
function renderCutRefs(store: Store, itemId: string, cutIds: string[]): string {
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts);
  if (!cutIds.length) {
    return `<button class="ref-mini ref-cutbtn" data-refcut="${itemId}"><i>⌗</i> 對照 cut</button>`;
  }
  let thumbs = "";
  for (const c of p.cuts.filter((x) => cutIds.includes(x.id))) {
    const n = numbers.get(c.id)!;
    thumbs += `<span class="rc-thumb" title="CUT ${n.label}">${c.imageRef ? `<img src="${c.imageRef}" alt="">` : ""}<span class="rc-no">${n.label}</span></span>`;
  }
  return `<div class="ref-cutrefs" data-refcut="${itemId}"><span class="rc-label">${cutRefLabel(store, cutIds)}</span><span class="rc-strip">${thumbs}</span></div>`;
}

export function bindRefPage(store: Store, root: HTMLElement, getChapter: () => string, rerender: () => void) {
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const add = t.closest("[data-refadd]") as HTMLElement | null;
    if (add) { store.addRefItem(add.dataset.refadd!); return; }
    const del = t.closest("[data-refdel]") as HTMLElement | null;
    if (del) { store.deleteRefItem(getChapter(), del.dataset.refdel!); return; }
    // 播放中的影片：點擊交給原生控制列；✕＝停止（重繪回縮圖並釋放）
    if (t.closest(".ref-thumb video")) return;
    if (t.closest(".vstop")) { rerender(); return; }
    const play = t.closest("[data-refplay]") as HTMLElement | null;
    if (play) {
      playInline(store, root, getChapter(), play.dataset.refplay!);
      return;
    }
    const cutBtn = t.closest("[data-refcut]") as HTMLElement | null;
    if (cutBtn) {
      const ch = getChapter();
      const it = store.get().refPages[ch]?.find((x) => x.id === cutBtn.dataset.refcut);
      openCutPicker(store, it?.cutRefs ?? []).then((ids) => {
        if (ids) { store.setRefCuts(ch, cutBtn.dataset.refcut!, ids); rerender(); }
      });
      return;
    }
    const vidFile = t.closest("[data-refvidfile]") as HTMLElement | null;
    if (vidFile) { pickVideoFile(store, getChapter(), vidFile.dataset.refvidfile!, rerender); return; }
    const vid = t.closest("[data-refvideo]") as HTMLElement | null;
    if (vid) {
      expandedVideo.add(vid.dataset.refvideo!);
      rerender();
      const el = root.querySelector(`[data-ritem="${vid.dataset.refvideo}"][data-rf="videoUrl"]`) as HTMLElement | null;
      el?.focus();
      return;
    }
    const img = t.closest("[data-refimg]") as HTMLElement | null;
    if (img) {
      if (img.classList.contains("playing")) return; // 播放中不開選檔
      const ch = getChapter();
      const it = store.get().refPages[ch]?.find((x) => x.id === img.dataset.refimg);
      // 已有圖（且非影片項目）→ 進編輯器（裁切／縮放／黑白／換圖）
      if (it?.imageRef && !it.videoFile) { editRefImage(store, ch, it.id, rerender); return; }
      // 需要影片的章節：一顆「＋ 加入檔案」圖片影片都吃（原生對話框，需 Tauri）
      if (VIDEO_CHAPTERS.has(ch) && isTauri()) pickRefMedia(store, ch, img.dataset.refimg!, rerender);
      else pickRefImage(store, ch, img.dataset.refimg!);
    }
  });
  root.addEventListener("blur", (e) => {
    const el = e.target as HTMLElement;
    if (!el.isContentEditable || !el.dataset.ritem) return;
    const field = el.dataset.rf as "title" | "note" | "videoUrl";
    const text = (el.textContent || "").trim();
    store.editRefField(getChapter(), el.dataset.ritem!, field, text);
    if (field === "videoUrl" && text === "") {
      expandedVideo.delete(el.dataset.ritem!);
      rerender();
    } else if (field === "videoUrl") {
      rerender(); // 讓 ▶ 徽章出現
    }
  }, true);
  // 輸入框鍵盤規則：Enter 留在框內（中文選字友善）、Esc 結束；附註欄可換行
  bindEditKeys(root, (el) => el.dataset.rf === "note");
}

async function pickVideoFile(store: Store, chapterId: string, itemId: string, rerender: () => void) {
  const res = await chooseVideoImport();
  if (res) { store.setRefVideoFile(chapterId, itemId, res.path, res.poster, res.trimStart, res.trimEnd); rerender(); }
}

// ▶＝在區塊內播放（本機影片換成 <video>＋✕ 停止；外部連結開瀏覽器）
async function playInline(store: Store, root: HTMLElement, chapterId: string, itemId: string) {
  const it = store.get().refPages[chapterId]?.find((x) => x.id === itemId);
  if (!it) return;
  if (!it.videoFile) { if (it.videoUrl) openExternal(it.videoUrl); return; }
  const thumb = root.querySelector(`[data-refimg="${itemId}"]`) as HTMLElement | null;
  if (!thumb) return;
  const trim = it.trimStart !== undefined && it.trimEnd !== undefined ? { start: it.trimStart, end: it.trimEnd } : undefined;
  const cleanup = await mountInlineVideo(thumb, it.videoFile, true, trim);
  if (cleanup) {
    activeCleanups.push(cleanup);
    const stop = document.createElement("button");
    stop.className = "vstop";
    stop.textContent = "✕";
    stop.title = "停止播放";
    thumb.appendChild(stop);
  }
}

// 「＋ 加入檔案」：影片 → 存進案子＋抽首圖；圖片 → 進裁切器（同原圖片流程）
async function pickRefMedia(store: Store, chapterId: string, itemId: string, rerender: () => void) {
  const res = await chooseMediaImport();
  if (!res) return;
  if (res.kind === "video") {
    store.setRefVideoFile(chapterId, itemId, res.path, res.poster, res.trimStart, res.trimEnd);
    rerender();
    return;
  }
  const cropped = await openCropper(res.url, PORTRAIT_CHAPTERS.has(chapterId) ? 9 / 16 : 16 / 9);
  URL.revokeObjectURL(res.url);
  if (cropped) store.setRefImage(chapterId, itemId, cropped);
}

function pickRefImage(store: Store, chapterId: string, itemId: string) {
  const portrait = PORTRAIT_CHAPTERS.has(chapterId);
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const cropped = await openCropper(r.result as string, portrait ? 9 / 16 : 16 / 9, { allowReplace: true });
      if (cropped) store.setRefImage(chapterId, itemId, cropped);
    };
    r.readAsDataURL(f);
  };
  input.click();
}

// 點既有參考圖：裁切／縮放／一鍵黑白／換一張
async function editRefImage(store: Store, chapterId: string, itemId: string, rerender: () => void) {
  const it = store.get().refPages[chapterId]?.find((x) => x.id === itemId);
  if (!it?.imageRef) return;
  const out = await openCropper(it.imageRef, PORTRAIT_CHAPTERS.has(chapterId) ? 9 / 16 : 16 / 9, { allowReplace: true });
  if (out) { store.setRefImage(chapterId, itemId, out); rerender(); }
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
