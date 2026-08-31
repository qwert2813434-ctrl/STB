import type { Store } from "./store";

import { renderStb } from "./stbView";
import { renderRefPage } from "./refPageView";
import { renderGantt } from "./ganttView";
import { renderCallSheet } from "./callSheetView";
import { renderStaff } from "./staffView";
import { renderRundown } from "./rundownView";
import { projectLogo } from "./logoAsset";
import { t, chapterTitle } from "./i18n";

// 頁面收集與標題頁 HTML：簡報（previewMode）與匯出中心（exportDialog）共用，
// 兩邊吃同一份渲染 ⇒ 預覽＝輸出。

export interface ChapterPages { id: string; en: string; zh: string; pages: HTMLElement[]; }

// refItemHasContent／chapterPlan 已搬到 model.ts（純邏輯、不碰 DOM，才驗得到「舊案零影響」這條鐵則）
import { refItemHasContent, chapterPlan } from "./model";
export { refItemHasContent, chapterPlan };

// 收集出場章節的頁面
export function collectChapters(store: Store): ChapterPages[] {
  const p = store.get();
  const temp = document.createElement("div");
  const collect = (render: () => void): HTMLElement[] => {
    temp.innerHTML = "";
    render();
    const out: HTMLElement[] = [];
    temp.querySelectorAll(".page").forEach((page) => {
      const wrap = document.createElement("div");
      wrap.className = "print-page";
      const label = page.previousElementSibling;
      if (label && label.classList.contains("page-label")) wrap.appendChild(label.cloneNode(true));
      wrap.appendChild(page.cloneNode(true));
      out.push(wrap);
    });
    return out;
  };
  const result: ChapterPages[] = [];
  for (const ch of chapterPlan(p)) {
    let pages: HTMLElement[] = [];
    if (ch.kind === "storyboard") {
      // 多路：逐路收頁（每路自己的頁、頁標帶路名）
      for (const f of p.films) {
        if (!p.cuts.some((c) => c.filmId === f.id)) continue;
        pages.push(...collect(() => renderStb(store, temp, -1, new Set(), f.id)));
      }
    } else if (ch.kind === "staff") {
      pages = collect(() => renderStaff(store, temp));
    } else if (ch.kind === "schedule") {
      pages = collect(() => renderGantt(store, temp));
      for (const day of p.days) {
        pages.push(...collect(() => renderCallSheet(store, temp, day)));
        pages.push(...collect(() => renderRundown(store, temp, day)));
      }
    } else {
      pages = collect(() => renderRefPage(store, temp, ch.id));
    }
    const ct = chapterTitle(ch);
    if (pages.length) result.push({ id: ch.id, en: ct.cap, zh: ct.sub, pages });
  }
  return result;
}

// 首頁（置中 LOGO，可替換；預設＝錄人）
export function logoSlideHtml(store: Store): string {
  return `<div class="pv-logo-slide"><img src="${projectLogo(store.get())}" alt="LOGO" draggable="false"></div>`;
}

// 封面（片名＋目錄）：目錄只列「會出場」的章（空章/隱藏章不列）
export function coverSlideHtml(store: Store): string {
  const p = store.get();
  let list = "";
  for (const ch of chapterPlan(p)) {
    const ct = chapterTitle(ch);
    list += `<li><span class="ag-en">${ct.cap}</span>${ct.sub ? `<span class="ag-zh">${ct.sub}</span>` : ""}</li>`;
  }
  const sub = p.mode === "schedule" ? t("拍攝通告") : t("PPM ・ 前製會議");
  return `<div class="pv-title-slide">
    <div class="pv-big">${esc(p.meta.title)}</div>
    <div class="pv-sub">${sub} ・ ${esc(p.meta.client)}</div>
    <ol class="ag-list pv-agenda">${list}</ol>
  </div>`;
}

// 章節標題頁（01 TONE／調性 這種）
export function titleSlideHtml(en: string, zh: string, index: number): string {
  return `<div class="pv-title-slide center">
    <div class="pv-index">${String(index).padStart(2, "0")}</div>
    <div class="pv-big">${en}</div>
    ${zh ? `<div class="pv-sub">${zh}</div>` : ""}
  </div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
