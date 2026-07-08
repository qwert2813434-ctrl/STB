import type { Store } from "./store";
import { CHAPTERS } from "./model";
import { renderStb } from "./stbView";
import { renderRefPage } from "./refPageView";
import { renderGantt } from "./ganttView";
import { renderCallSheet } from "./callSheetView";
import { renderRundown } from "./rundownView";
import { projectLogo } from "./logoAsset";

// 頁面收集與標題頁 HTML：簡報（previewMode）與匯出中心（exportDialog）共用，
// 兩邊吃同一份渲染 ⇒ 預覽＝輸出。

export interface ChapterPages { id: string; en: string; zh: string; pages: HTMLElement[]; }

// 收集所有章節的頁面（空章自動略過）
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
  for (const ch of CHAPTERS) {
    if (ch.id === "agenda") continue;
    let pages: HTMLElement[] = [];
    if (ch.kind === "storyboard" && p.cuts.length) {
      pages = collect(() => renderStb(store, temp, -1, new Set()));
    } else if (ch.kind === "schedule" && (p.milestones.length || p.days.length)) {
      pages = collect(() => renderGantt(store, temp));
      for (const day of p.days) {
        pages.push(...collect(() => renderCallSheet(store, temp, day)));
        pages.push(...collect(() => renderRundown(store, temp, day)));
      }
    } else if (ch.kind === "refpage" && (p.refPages[ch.id]?.length ?? 0) > 0) {
      pages = collect(() => renderRefPage(store, temp, ch.id));
    }
    if (pages.length) result.push({ id: ch.id, en: ch.en, zh: ch.label, pages });
  }
  return result;
}

// 首頁（置中 LOGO，可替換；預設＝錄人）
export function logoSlideHtml(store: Store): string {
  return `<div class="pv-logo-slide"><img src="${projectLogo(store.get())}" alt="LOGO" draggable="false"></div>`;
}

// 封面（片名＋目錄）
export function coverSlideHtml(store: Store): string {
  const meta = store.get().meta;
  let list = "";
  for (const ch of CHAPTERS) {
    if (ch.id === "agenda") continue;
    list += `<li><span class="ag-en">${ch.en}</span><span class="ag-zh">${ch.label}</span></li>`;
  }
  return `<div class="pv-title-slide">
    <div class="pv-big">${esc(meta.title)}</div>
    <div class="pv-sub">PPM ・ 前製會議 ・ ${esc(meta.client)}</div>
    <ol class="ag-list pv-agenda">${list}</ol>
  </div>`;
}

// 章節標題頁（01 TONE／調性 這種）
export function titleSlideHtml(en: string, zh: string, index: number): string {
  return `<div class="pv-title-slide center">
    <div class="pv-index">${String(index).padStart(2, "0")}</div>
    <div class="pv-big">${en}</div>
    <div class="pv-sub">${zh}</div>
  </div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
