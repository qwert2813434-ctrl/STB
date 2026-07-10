import { bindEditKeys } from "./editKeys";
import type { Store } from "./store";
import { chainRundown, hhmmToMin, minToHHMM } from "./model";

// 通告首頁（每個拍攝日一份，放在該日 Rundown 前）。
// 片名／日期／集合／製作／大組通告時間全部 inline 可編輯（預計收工＝機器欄，連動 Rundown）。
export function renderCallSheet(store: Store, root: HTMLElement, dayOverride?: import("./model").ShootDay) {
  const p = store.get();
  const day = dayOverride ?? store.currentDay();
  if (!day) { root.innerHTML = ""; return; }
  const times = chainRundown(day.rundown, hhmmToMin(day.callTime));
  const wrap = times.length ? minToHHMM(times[times.length - 1].end) : "—";

  let html = `<p class="page-label">通告單 · A5 橫</p><div class="page callsheet">`;
  html += `
    <div class="cs-head">
      <span class="cs-title cut-edit" contenteditable draggable="false" data-meta="title" data-ph="片名">${esc(p.meta.title)}</span>
      <span class="cs-tag">拍攝通告單</span>
      <span class="cs-spacer"></span>
      <span class="cs-date cut-edit" contenteditable draggable="false" data-dayf="date" data-ph="YYYY-MM-DD">${esc(day.date)}</span>
    </div>
    <div class="cs-strip">
      <div class="cs-cell"><div class="cs-k">集合</div><div class="cs-v cut-edit" contenteditable draggable="false" data-dayf="callTime" data-ph="08:00">${esc(day.callTime)}</div></div>
      <div class="cs-cell"><div class="cs-k">預計收工</div><div class="cs-v">${wrap}</div></div>
      <div class="cs-cell"><div class="cs-k">製作</div><div class="cs-v cut-edit" contenteditable draggable="false" data-meta="client" data-ph="製作公司">${esc(p.meta.client)}</div></div>
    </div>`;

  // 聯絡人：上方橫排一列（老通告單格式：製片-姓名 電話 / 監製… / 導演…）
  html += `<div class="cs-contactline"><span class="cs-clabel">聯絡人</span>`;
  p.contacts.forEach((c, i) => {
    html += `<span class="cs-centry">
      <span class="cs-crole cut-edit" contenteditable draggable="false" data-ct="${i}" data-ctf="role" data-ph="職位">${esc(c.role)}</span>
      <span class="cut-edit" contenteditable draggable="false" data-ct="${i}" data-ctf="name" data-ph="姓名">${esc(c.name)}</span>
      <span class="cs-gt cs-phone cut-edit" contenteditable draggable="false" data-ct="${i}" data-ctf="phone" data-ph="0900-000-000">${esc(c.phone)}</span>
      <button class="cs-gdel" data-ctdel="${i}" aria-label="刪除聯絡人">✕</button>
    </span>`;
  });
  html += `<button class="cs-addinline" data-ctadd title="新增聯絡人">＋</button></div>`;

  // 大組通告時間：直排二分欄（人員＋集合位置），列可拖曳置換（⠿ 把手）
  html += `<div class="cs-groups"><div class="cs-gh">大組通告時間</div><div class="cs-glist">`;
  day.callGroups.forEach((g, i) => {
    html += `<div class="cs-grow" data-cgrow="${i}">
      <span class="cs-grip" data-cgrip="${i}" title="拖曳排序">⠿</span>
      <span class="cs-gl cut-edit" contenteditable draggable="false" data-cg="${i}" data-cgf="label" data-ph="組別／演員">${esc(g.label)}</span>
      <span class="cs-gs"><span class="cs-dot">・</span><span class="cut-edit" contenteditable draggable="false" data-cg="${i}" data-cgf="loc" data-ph="集合地點">${esc(g.loc)}</span></span>
      <span class="cs-spacer"></span>
      <span class="cs-gt cut-edit" contenteditable draggable="false" data-cg="${i}" data-cgf="time" data-ph="07:00">${esc(g.time)}</span>
      <button class="cs-gdel" data-cgdel="${i}" aria-label="刪除組別">✕</button>
    </div>`;
  });
  html += `</div><div class="cs-addgroup"><button data-cgadd>＋ 新增組別</button></div></div>`;
  html += `</div>`;
  root.innerHTML = html;
}

export function bindCallSheet(store: Store, root: HTMLElement) {
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-cgadd]")) { store.addCallGroup(); return; }
    if (t.closest("[data-ctadd]")) { store.addContact(); return; }
    const cdel = t.closest("[data-ctdel]") as HTMLElement | null;
    if (cdel) { store.deleteContact(Number(cdel.dataset.ctdel)); return; }
    const del = t.closest("[data-cgdel]") as HTMLElement | null;
    if (del) store.deleteCallGroup(Number(del.dataset.cgdel));
  });
  root.addEventListener("blur", (e) => {
    const el = e.target as HTMLElement;
    if (!el.isContentEditable) return;
    const text = (el.textContent || "").trim();
    if (el.dataset.meta) { store.editMeta(el.dataset.meta as "title" | "client", text); return; }
    if (el.dataset.dayf === "date") { store.setDayDate(text); return; }
    if (el.dataset.dayf === "callTime") { store.setDayCallTime(text); return; }
    if (el.dataset.ct !== undefined) { store.editContact(Number(el.dataset.ct), el.dataset.ctf as "role" | "name" | "phone", text); return; }
    if (el.dataset.cg !== undefined) store.editCallGroup(Number(el.dataset.cg), el.dataset.cgf as "label" | "time" | "loc", text);
  }, true);
  bindEditKeys(root); // Enter 留在框內（中文選字友善）、Esc 結束輸入

  // 大組通告列拖曳置換（⠿ 把手，自製指標手勢，同 Rundown）
  let gdrag: { idx: number; started: boolean; sx: number; sy: number } | null = null;
  const clearDragUi = () => {
    document.body.classList.remove("dragging-any");
    root.querySelectorAll(".dragging, .drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
  };
  root.addEventListener("pointerdown", (e) => {
    const grip = (e.target as HTMLElement).closest(".cs-grip") as HTMLElement | null;
    if (!grip) return;
    gdrag = { idx: Number(grip.dataset.cgrip), started: false, sx: e.clientX, sy: e.clientY };
    try { grip.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
  });
  root.addEventListener("pointermove", (e) => {
    if (!gdrag) return;
    if (!gdrag.started) {
      if (Math.abs(e.clientX - gdrag.sx) + Math.abs(e.clientY - gdrag.sy) < 5) return;
      gdrag.started = true;
      root.querySelector(`.cs-grow[data-cgrow="${gdrag.idx}"]`)?.classList.add("dragging");
      document.body.classList.add("dragging-any");
    }
    e.preventDefault();
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cs-grow") as HTMLElement | null;
    root.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
    if (over && Number(over.dataset.cgrow) !== gdrag.idx) over.classList.add("drop-target");
  });
  const finishDrag = (e: PointerEvent) => {
    if (!gdrag) return;
    const was = gdrag;
    gdrag = null;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cs-grow") as HTMLElement | null;
    clearDragUi();
    if (was.started && over) {
      const dst = Number(over.dataset.cgrow);
      if (dst !== was.idx) store.moveCallGroup(was.idx, dst);
    }
  };
  root.addEventListener("pointerup", finishDrag);
  root.addEventListener("pointercancel", () => { gdrag = null; clearDragUi(); });
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
