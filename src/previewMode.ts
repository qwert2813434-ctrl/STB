import type { Store } from "./store";
import { mountInlineVideo, openExternal } from "./persistence";
import type { RefItem } from "./model";
import { collectChapters, coverSlideHtml, titleSlideHtml, logoSlideHtml } from "./pages";
import { openExportDialog } from "./exportDialog";

// 預覽（簡報模式）：照 PPM 簡報節奏播放——
// 目錄 → 大項標題頁 → 該章內頁 → 下一大項…。←/→/空白鍵換頁、Esc 離開。
// 同時就是印刷版面的預覽（頁面原封渲染、唯讀）。
// 影片：換到有本機影片的頁面＝區塊內自動播放（控制列含音量），
// 換頁即暫停並釋放記憶體；外部連結項目的 ▶ 開系統瀏覽器。

type Slide =
  | { kind: "logo" }
  | { kind: "cover" }
  | { kind: "title"; en: string; zh: string; index: number }
  | { kind: "page"; el: HTMLElement };

export function openPreview(store: Store) {
  const slides: Slide[] = [{ kind: "logo" }, { kind: "cover" }];

  collectChapters(store).forEach((ch, i) => {
    slides.push({ kind: "title", en: ch.en, zh: ch.zh, index: i + 1 });
    for (const el of ch.pages) slides.push({ kind: "page", el });
  });

  // ---- overlay ----
  const overlay = document.createElement("div");
  overlay.className = "pv-overlay";
  overlay.innerHTML = `
    <div class="pv-stage"><div class="pv-fit"></div></div>
    <div class="pv-nav">
      <button class="pv-prev" aria-label="上一頁">←</button>
      <span class="pv-count"></span>
      <button class="pv-next" aria-label="下一頁">→</button>
      <button class="pv-print">匯出…</button>
      <button class="pv-close" aria-label="離開預覽">Esc 離開</button>
    </div>`;
  document.body.appendChild(overlay);
  const fit = overlay.querySelector(".pv-fit") as HTMLElement;
  const stage = overlay.querySelector(".pv-stage") as HTMLElement;
  const count = overlay.querySelector(".pv-count") as HTMLElement;

  let i = 0;

  // 精準適配簡報框：固定 1560px 設計寬度，量整頁尺寸後 scale 到剛好塞進視窗
  //（含高度，2×2 這種高頁面也完整入框），置中、不捲動。
  function fitNow() {
    requestAnimationFrame(() => {
      const availW = stage.clientWidth - 48;
      const availH = stage.clientHeight - 48;
      const w = fit.offsetWidth || 1;
      const h = fit.scrollHeight || 1;
      const k = Math.min(availW / w, availH / h, 1);
      fit.style.transform = `translate(-50%, -50%) scale(${k})`;
    });
  }
  const onResize = () => fitNow();
  window.addEventListener("resize", onResize);

  // 本頁播放中的影片（換頁/離開時暫停＋釋放）
  const slideCleanups: (() => void)[] = [];
  function clearSlideVideos() {
    while (slideCleanups.length) slideCleanups.pop()!();
  }
  // 換到內頁：頁上有本機影片的參考區塊 → 區塊內自動播放
  function mountSlideVideos() {
    const byId = new Map<string, RefItem>();
    for (const items of Object.values(store.get().refPages)) for (const it of items) byId.set(it.id, it);
    fit.querySelectorAll("[data-refimg]").forEach((el) => {
      const it = byId.get((el as HTMLElement).dataset.refimg || "");
      if (it?.videoFile) {
        const trim = it.trimStart !== undefined && it.trimEnd !== undefined ? { start: it.trimStart, end: it.trimEnd } : undefined;
        void mountInlineVideo(el as HTMLElement, it.videoFile, true, trim).then((c) => {
          if (c) slideCleanups.push(c);
        });
      }
    });
  }

  function show() {
    clearSlideVideos();
    const s = slides[i];
    count.textContent = `${i + 1} / ${slides.length}`;
    if (s.kind === "logo") {
      fit.innerHTML = logoSlideHtml(store);
    } else if (s.kind === "cover") {
      fit.innerHTML = coverSlideHtml(store);
    } else if (s.kind === "title") {
      fit.innerHTML = titleSlideHtml(s.en, s.zh, s.index);
    } else {
      fit.innerHTML = "";
      fit.appendChild(s.el);
      mountSlideVideos();
    }
    fitNow();
  }

  function step(d: number) {
    i = Math.min(slides.length - 1, Math.max(0, i + d));
    show();
  }

  function close() {
    clearSlideVideos();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    overlay.remove();
  }

  function onKey(e: KeyboardEvent) {
    // 匯出中心開著：按鍵全交給它（Esc 關它、不透傳翻頁）
    if (document.querySelector(".ex-overlay")) return;
    // 焦點在影片控制列上：空白/方向鍵交給播放器，不換頁
    if ((e.target as HTMLElement)?.tagName === "VIDEO" && e.key !== "Escape") return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  }
  document.addEventListener("keydown", onKey, true);

  (overlay.querySelector(".pv-prev") as HTMLElement).addEventListener("click", () => step(-1));
  (overlay.querySelector(".pv-next") as HTMLElement).addEventListener("click", () => step(1));
  (overlay.querySelector(".pv-close") as HTMLElement).addEventListener("click", close);
  (overlay.querySelector(".pv-print") as HTMLElement).addEventListener("click", (e) => { e.stopPropagation(); void openExportDialog(store); });
  stage.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // 播放中的影片：點擊交給原生控制列（播放/暫停/音量），不換頁
    if (t.tagName === "VIDEO" || t.closest("video")) return;
    // ▶（外部連結項目）：開系統瀏覽器；本機影片已自動在區塊內播
    const play = (t.closest("[data-refplay]") ??
      t.closest(".ref-thumb")?.querySelector("[data-refplay]")) as HTMLElement | null;
    if (play) { e.stopPropagation(); playRefVideo(store, play.dataset.refplay!); return; }
    step(1);
  });

  show();
}

// 簡報中點 ▶（掛外部連結的項目）：開系統瀏覽器
function playRefVideo(store: Store, itemId: string) {
  for (const items of Object.values(store.get().refPages)) {
    const it = items.find((x) => x.id === itemId);
    if (!it) continue;
    if (it.videoUrl) openExternal(it.videoUrl);
    return;
  }
}

// （collectChapters 與匯出邏輯已搬到 pages.ts／exportDialog.ts）
