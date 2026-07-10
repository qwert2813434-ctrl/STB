import type { Store } from "./store";
import type { Project, RefItem, Chapter } from "./model";
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

// 參考項目「有內容」的定義：全空的佔位框（按了＋新增但沒填）不算——
// 不然點過一下新增，簡報就多出一頁空章（Armin 實測回報）
export function refItemHasContent(it: RefItem): boolean {
  return !!(it.imageRef || it.title.trim() || it.note.trim() || it.videoFile || it.videoUrl || it.cutRefs?.length);
}

// 章節出場名單（簡報/匯出共用）：沒內容的章自動跳過；
// hiddenChapters＝「這次不給客戶看」的手動隱藏（編輯器不受影響）。
// includeHidden 給簡報「章節」勾選清單用（要能把藏起來的勾回來）。
export function chapterPlan(p: Project, includeHidden = false): Chapter[] {
  const hidden = new Set(p.hiddenChapters ?? []);
  return CHAPTERS.filter((ch) => ch.id !== "agenda").filter((ch) => {
    if (!includeHidden && hidden.has(ch.id)) return false;
    if (ch.kind === "storyboard") return p.cuts.length > 0;
    if (ch.kind === "schedule") return p.milestones.length > 0 || p.days.length > 0;
    return (p.refPages[ch.id] || []).some(refItemHasContent);
  });
}

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
      pages = collect(() => renderStb(store, temp, -1, new Set()));
    } else if (ch.kind === "schedule") {
      pages = collect(() => renderGantt(store, temp));
      for (const day of p.days) {
        pages.push(...collect(() => renderCallSheet(store, temp, day)));
        pages.push(...collect(() => renderRundown(store, temp, day)));
      }
    } else {
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

// 封面（片名＋目錄）：目錄只列「會出場」的章（空章/隱藏章不列）
export function coverSlideHtml(store: Store): string {
  const p = store.get();
  let list = "";
  for (const ch of chapterPlan(p)) {
    list += `<li><span class="ag-en">${ch.en}</span><span class="ag-zh">${ch.label}</span></li>`;
  }
  return `<div class="pv-title-slide">
    <div class="pv-big">${esc(p.meta.title)}</div>
    <div class="pv-sub">PPM ・ 前製會議 ・ ${esc(p.meta.client)}</div>
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
