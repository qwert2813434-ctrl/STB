import { bindEditKeys } from "./editKeys";
import type { Store } from "./store";
import { GANTT_COLORS } from "./model";

// SCHEDULE 大項：製作時程甘特圖。
// 列＝事項（名稱可打字、起訖日期可改、可選色、可上下移動）；
// 條＝依全域日期範圍換算位置，可直接拖曳整條移動、拉右緣改結束日。

const DAY = 86400000;
let openPalette: string | null = null; // 正展開調色盤的事項 id

function d2n(s: string): number {
  return s ? new Date(s + "T00:00:00").getTime() : NaN;
}
function fmtMD(s: string): string {
  if (!s) return "—";
  const [, m, d] = s.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 全域日期範圍（min 起、max 訖含當天）
function ganttSpan(ms: { start: string; end: string }[]) {
  let min = Infinity, max = -Infinity;
  for (const m of ms) {
    const s = d2n(m.start), e = d2n(m.end);
    if (!isNaN(s)) min = Math.min(min, s);
    if (!isNaN(e)) max = Math.max(max, e + DAY);
  }
  const span = max > min ? max - min : DAY;
  return { min, span };
}

export function renderGantt(store: Store, root: HTMLElement) {
  const ms = store.get().milestones;
  const { min, span } = ganttSpan(ms);
  let html = `<p class="page-label">Schedule · 製作時程 · A5 橫</p><div class="page gantt">`;

  ms.forEach((m, idx) => {
    const s = d2n(m.start), e = d2n(m.end) + DAY;
    const ok = !isNaN(s) && !isNaN(d2n(m.end));
    const left = ok ? ((s - min) / span) * 100 : 0;
    const width = ok ? Math.max(1.5, ((e - s) / span) * 100) : 0;
    const color = m.color || GANTT_COLORS[0];
    html += `
      <div class="gt-row" data-ms="${m.id}">
        <span class="gt-move">
          <button class="gt-up" data-mup="${m.id}" ${idx === 0 ? "disabled" : ""} aria-label="上移">▲</button>
          <button class="gt-down" data-mdown="${m.id}" ${idx === ms.length - 1 ? "disabled" : ""} aria-label="下移">▼</button>
        </span>
        <button class="gt-swatch" data-mswatch="${m.id}" style="background:${color}" title="選顏色"></button>
        <div class="gt-label cut-line" contenteditable draggable="false" data-mlabel="${m.id}" data-ph="事項">${esc(m.label)}</div>
        <div class="gt-track">
          ${ok ? `<div class="gt-bar" style="left:${left}%;width:${width}%;background:${color}" data-mbar="${m.id}" title="拖曳移動；拉左右緣改起訖日">
            <span class="gt-resize-l" data-mresizel="${m.id}" title="調整起始日"></span>
            <span class="gt-dates">${fmtMD(m.start)}${m.end !== m.start ? `–${fmtMD(m.end)}` : ""}</span>
            <span class="gt-resize" data-mresize="${m.id}" title="調整結束日"></span>
          </div>` : `<span class="gt-nodate">未設日期</span>`}
        </div>
        <input type="date" class="gt-date" data-mdate="${m.id}" data-df="start" value="${m.start}">
        <input type="date" class="gt-date" data-mdate="${m.id}" data-df="end" value="${m.end}">
        <button class="gt-del" data-mdel="${m.id}" aria-label="刪除事項">✕</button>
        ${openPalette === m.id ? paletteHtml(m.id, color) : ""}
      </div>`;
  });
  html += `<div class="gt-addrow"><button data-madd>＋ 新增事項</button></div></div>`;
  root.innerHTML = html;
}

function paletteHtml(id: string, current: string): string {
  const dots = GANTT_COLORS.map(
    (c) => `<button class="gt-dot${c === current ? " on" : ""}" style="background:${c}" data-mcolor="${id}" data-c="${c}" aria-label="顏色"></button>`
  ).join("");
  return `<div class="gt-palette">${dots}</div>`;
}

export function bindGantt(store: Store, root: HTMLElement) {
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-madd]")) { store.addMilestone(); return; }
    const del = t.closest("[data-mdel]") as HTMLElement | null;
    if (del) { store.deleteMilestone(del.dataset.mdel!); return; }
    const up = t.closest("[data-mup]") as HTMLElement | null;
    if (up) { store.moveMilestone(up.dataset.mup!, -1); return; }
    const down = t.closest("[data-mdown]") as HTMLElement | null;
    if (down) { store.moveMilestone(down.dataset.mdown!, 1); return; }
    const sw = t.closest("[data-mswatch]") as HTMLElement | null;
    if (sw) { openPalette = openPalette === sw.dataset.mswatch ? null : sw.dataset.mswatch!; renderGantt(store, root); return; }
    const dot = t.closest("[data-mcolor]") as HTMLElement | null;
    if (dot) { openPalette = null; store.setMilestoneColor(dot.dataset.mcolor!, dot.dataset.c!); return; }
  });
  root.addEventListener("change", (e) => {
    const inp = e.target as HTMLInputElement;
    if (inp.dataset.mdate) store.setMilestoneDate(inp.dataset.mdate, inp.dataset.df as "start" | "end", inp.value);
  });
  root.addEventListener("blur", (e) => {
    const el = e.target as HTMLElement;
    if (el.isContentEditable && el.dataset.mlabel) {
      store.editMilestoneLabel(el.dataset.mlabel, (el.textContent || "").trim());
    }
  }, true);
  bindEditKeys(root); // Enter 留在框內（中文選字友善）、Esc 結束輸入

  // 拖曳甘特條：整條拖＝平移日期；拉右緣＝改結束日、拉左緣＝改起始日（往前）。
  // 自製指標手勢（同 STB/Rundown），邊拖邊給視覺回饋，放開才寫回日期。
  let drag: { id: string; mode: "move" | "end" | "start"; sx: number; bar: HTMLElement; trackW: number; spanDays: number; startLeft: number; startW: number } | null = null;

  root.addEventListener("pointerdown", (e) => {
    const bar = (e.target as HTMLElement).closest(".gt-bar") as HTMLElement | null;
    if (!bar) return;
    const track = bar.parentElement as HTMLElement;
    const t = e.target as HTMLElement;
    const mode = t.closest(".gt-resize-l") ? "start" : t.closest(".gt-resize") ? "end" : "move";
    const { span } = ganttSpan(store.get().milestones);
    drag = {
      id: bar.dataset.mbar!, mode, sx: e.clientX, bar,
      trackW: track.clientWidth || 1,
      spanDays: Math.max(1, Math.round(span / DAY)),
      startLeft: parseFloat(bar.style.left) || 0,
      startW: parseFloat(bar.style.width) || 0,
    };
    bar.classList.add("dragging");
    try { bar.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
    e.preventDefault();
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dxPct = ((e.clientX - drag.sx) / drag.trackW) * 100;
    if (drag.mode === "move") drag.bar.style.left = `${drag.startLeft + dxPct}%`;
    else if (drag.mode === "end") drag.bar.style.width = `${Math.max(1.5, drag.startW + dxPct)}%`;
    else { // start：左緣跟著走、右緣不動
      const d = Math.min(dxPct, drag.startW - 1.5);
      drag.bar.style.left = `${drag.startLeft + d}%`;
      drag.bar.style.width = `${drag.startW - d}%`;
    }
  });
  const finish = (e: PointerEvent) => {
    if (!drag) return;
    const was = drag;
    drag = null;
    was.bar.classList.remove("dragging");
    const days = Math.round(((e.clientX - was.sx) / was.trackW) * was.spanDays);
    if (days) store.shiftMilestone(was.id, days, was.mode);
    else renderGantt(store, root); // 沒動到整天：復位視覺
  };
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointercancel", () => { if (drag) { drag.bar.classList.remove("dragging"); drag = null; renderGantt(store, root); } });
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
