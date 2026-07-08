import "./style.css";
import { Store } from "./store";
import { sampleProject, emptyProject } from "./sampleData";
import { renderStb, bindStb } from "./stbView";
import { renderRundown, bindRundown } from "./rundownView";
import { renderCallSheet, bindCallSheet } from "./callSheetView";
import { renderRefPage, bindRefPage } from "./refPageView";
import { renderGantt, bindGantt } from "./ganttView";
import { openPreview } from "./previewMode";
import { openExportDialog } from "./exportDialog";
import { openCropper } from "./cropper";
import { CHAPTERS, computeCutNumbers, pageCount, chainRundown, hhmmToMin, minToHHMM, normalizeProject } from "./model";
import { isTauri, currentDir, dirName, chooseFolderAndLoad, createProjectFolder, chooseFolderAndSaveAs, saveToCurrent, loadFromDir, lastProjectDir, upsertRecent, detachDir, extractPosterFor } from "./persistence";
import { projectLogo } from "./logoAsset";
import { openHelp } from "./helpDialog";
import { openHub } from "./hubDialog";

const store = new Store(sampleProject());
const expanded = new Set<string>(); // 暫時展開的 VO/Super 行
let pendingFlash = -1;

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="topbar">
    <span class="name cut-edit" id="proj-name" contenteditable draggable="false" title="點擊修改案名" data-ph="案名"></span>
    <span class="tag-ppm">PPM</span>
    <span class="save-state" id="save-state"></span>
    <span class="spacer"></span>
    <button id="btn-preview">▶ 預覽</button>
    <button id="btn-print">匯出…</button>
    <button id="btn-hub">專案…</button>
    <button id="btn-save">儲存案子</button>
    <button id="btn-saveas">另存新檔…</button>
    <button id="btn-add">新增 cut</button>
    <button id="btn-help" title="使用說明與版本資訊" aria-label="說明">?</button>
  </div>
  <div class="ppm-layout">
    <nav class="sidebar" id="sidebar"></nav>
    <div class="content-col">
      <div class="statusbar" id="statusbar"></div>
      <div class="chapter-content">
        <div id="agenda-area"></div>
        <div id="stb-area"></div>
        <div id="schedule-view">
          <div id="gantt-area"></div>
          <p class="page-label" style="margin-top:6px">拍攝日程（通告單＋Rundown）</p>
          <div class="day-tabs" id="day-tabs"></div>
          <div id="callsheet-area"></div>
          <div id="rundown-area"></div>
        </div>
        <div id="refpage-area"></div>
      </div>
      <div class="inspector" id="inspector"></div>
    </div>
  </div>
`;

const sidebar = document.getElementById("sidebar")!;
const ganttArea = document.getElementById("gantt-area")!;
const agendaArea = document.getElementById("agenda-area")!;
const stbArea = document.getElementById("stb-area")!;
const scheduleView = document.getElementById("schedule-view")!;
const dayTabs = document.getElementById("day-tabs")!;
const callsheetArea = document.getElementById("callsheet-area")!;
const rundownArea = document.getElementById("rundown-area")!;
const refpageArea = document.getElementById("refpage-area")!;
const inspector = document.getElementById("inspector")!;
const statusbar = document.getElementById("statusbar")!;
const btnAdd = document.getElementById("btn-add") as HTMLButtonElement;

function kindOf(id: string) {
  return CHAPTERS.find((c) => c.id === id)?.kind ?? "agenda";
}

function renderAll() {
  const p = store.get();
  // 案名正在編輯中就別覆寫（游標會掉）
  const nameEl = document.getElementById("proj-name")!;
  if (document.activeElement !== nameEl) nameEl.textContent = p.meta.title;

  renderSidebar();

  const chapId = store.currentChapter;
  const kind = kindOf(chapId);
  agendaArea.style.display = kind === "agenda" ? "" : "none";
  stbArea.style.display = kind === "storyboard" ? "" : "none";
  scheduleView.style.display = kind === "schedule" ? "" : "none";
  refpageArea.style.display = kind === "refpage" ? "" : "none";
  inspector.style.display = kind === "storyboard" ? "" : "none";
  btnAdd.style.display = kind === "storyboard" ? "" : "none";

  if (kind === "agenda") {
    statusbar.innerHTML = `<span class="k">PPM</span><span class="v">${CHAPTERS.length - 1} 章</span><span class="spacer"></span><span class="hint">點左側章節開始，或點目錄項目</span>`;
    renderAgenda();
  } else if (kind === "storyboard") {
    statusbar.innerHTML = `
      <span class="k">分鏡</span><span class="v">${p.cuts.length} 顆 cut</span>
      <span class="k" style="margin-left:8px">頁數</span><span class="v">${pageCount(p.cuts.length)}</span>
      <span class="spacer"></span><span class="hint">把手 ⠿ 拖曳重排 · 點文字直接編輯 · ⌘/Shift 點擊多選</span>`;
    renderStb(store, stbArea, pendingFlash, expanded);
    pendingFlash = -1;
    renderInspector();
  } else if (kind === "schedule") {
    const day = store.currentDay();
    const times = day ? chainRundown(day.rundown, hhmmToMin(day.callTime)) : [];
    const wrap = times.length ? minToHHMM(times[times.length - 1].end) : "—";
    statusbar.innerHTML = `
      <span class="k">拍攝日</span><span class="v">${day?.date || "（未定）"}</span>
      <span class="k" style="margin-left:8px">集合</span><span class="v">${day?.callTime || "—"}</span>
      <span class="k" style="margin-left:8px">收工</span><span class="v">${wrap}</span>
      <span class="spacer"></span><span class="hint">通告單在前 · 該日 Rundown 在後</span>`;
    renderGantt(store, ganttArea);
    renderDayTabs();
    renderCallSheet(store, callsheetArea);
    renderRundown(store, rundownArea);
  } else {
    const ch = CHAPTERS.find((c) => c.id === chapId)!;
    const n = (p.refPages[chapId] || []).length;
    statusbar.innerHTML = `<span class="k">${ch.en}</span><span class="v">${ch.label}</span><span class="k" style="margin-left:8px">項目</span><span class="v">${n}</span><span class="spacer"></span><span class="hint">貼參考圖＋說明，向客戶對齊調性</span>`;
    renderRefPage(store, refpageArea, chapId);
  }
}

function renderSidebar() {
  let html = "";
  for (const ch of CHAPTERS) {
    const on = ch.id === store.currentChapter ? " on" : "";
    html += `<button class="chap${on}" data-chap="${ch.id}"><span class="chap-en">${ch.en}</span><span class="chap-zh">${ch.label}</span></button>`;
  }
  sidebar.innerHTML = html;
}

function renderAgenda() {
  const p = store.get();
  // 首頁（目錄前）：置中 LOGO，點擊替換（透明 PNG 佳，不走裁切器保留透明度）
  let html = `<p class="page-label">COVER · 首頁</p><div class="page cover-page">
    <img class="cover-logo" src="${projectLogo(p)}" alt="LOGO" title="點擊替換 LOGO" data-logoreplace draggable="false">
    <span class="cover-hint">點 LOGO 替換（建議透明 PNG）${p.meta.logo ? `　<button class="cover-reset" data-logoreset>還原預設</button>` : ""}</span>
  </div>`;
  html += `<p class="page-label">AGENDA · 目錄 · A5 橫</p><div class="page agenda">
    <div class="ag-title cut-edit" contenteditable draggable="false" data-meta="title" data-ph="片名">${esc(p.meta.title)}</div>
    <div class="ag-sub">PPM ・ 前製會議 ・ <span class="cut-edit" contenteditable draggable="false" data-meta="client" data-ph="製作公司">${esc(p.meta.client)}</span></div>
    <ol class="ag-list">`;
  for (const ch of CHAPTERS) {
    if (ch.id === "agenda") continue;
    html += `<li data-chap="${ch.id}"><span class="ag-en">${ch.en}</span><span class="ag-zh">${ch.label}</span></li>`;
  }
  html += `</ol></div>`;
  agendaArea.innerHTML = html;
}

function renderInspector() {
  const p = store.get();
  // 多選（⌘/Shift 點擊）：組成連續鏡／整批刪除
  if (store.selectedIds.length > 1) {
    inspector.innerHTML = `
      <span class="cur">已選 ${store.selectedIds.length} 顆</span>
      <button data-a="group">組成連續鏡</button>
      <button data-a="delmulti">刪除選取</button>
      <span class="hint">⌘ 點擊加選 · Shift 點擊連選</span>`;
    return;
  }
  const id = store.selectedId;
  if (!id) {
    inspector.innerHTML = `<span class="hint">點一格選取 cut（⌘/Shift 多選可組連續鏡）。快捷：⌘D 複製 · ⌦ 刪除 · ⌘Z 復原</span>`;
    return;
  }
  const numbers = computeCutNumbers(p.cuts);
  const n = numbers.get(id);
  if (!n) return;
  const cut = p.cuts.find((c) => c.id === id)!;
  const grouped = n.groupSize > 1;
  const canVo = cut.vo === "" && !expanded.has(id + ":vo");
  const canSup = cut.sup === "" && !expanded.has(id + ":sup");
  inspector.innerHTML = `
    <span class="cur">CUT ${n.label}</span>
    <button data-a="add">新增 cut（插在後面）</button>
    <button data-a="subshot">＋ 連續鏡</button>
    ${grouped ? `<button data-a="detach">拆除群組</button>` : ""}
    ${canVo ? `<button data-a="addvo">+ VO</button>` : ""}
    ${canSup ? `<button data-a="addsup">+ Super</button>` : ""}
    <button data-a="dup">複製</button>
    <button data-a="del">刪除</button>
    ${grouped ? `<span class="hint">連續鏡：拖任一子鏡整組同行 · 拆除＝整組拆散</span>` : ""}
  `;
}

function focusLine(id: string, field: string) {
  const el = stbArea.querySelector(`.cut[data-id="${id}"] [data-f="${field}"]`) as HTMLElement | null;
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function addCut() {
  store.addCutAfter(store.selectedId);
  const seq = store.get().cuts.findIndex((c) => c.id === store.selectedId);
  pendingFlash = seq >= 0 ? seq : 0;
  renderAll();
}

async function pickImage(cutId: string) {
  // 已有分鏡圖 → 直接進編輯器（裁切／區塊內縮放／一鍵黑白／換一張）；
  // 沒有 → 選檔後進裁切器。
  const cut = store.get().cuts.find((c) => c.id === cutId);
  if (cut?.imageRef) {
    const out = await openCropper(cut.imageRef, 16 / 9, { allowReplace: true });
    if (out) store.setImage(cutId, out);
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const cropped = await openCropper(reader.result as string, 16 / 9, { allowReplace: true });
      if (cropped) store.setImage(cutId, cropped);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function renderDayTabs() {
  const p = store.get();
  const canDel = p.days.length > 1;
  let html = "";
  p.days.forEach((d, i) => {
    const on = d.id === store.currentDayId ? " on" : "";
    html += `<span class="daytab-wrap">
      <button class="daytab${on}" data-day="${d.id}">Day ${i + 1}${d.date ? `<span class="daytab-date">${d.date}</span>` : ""}</button>
      ${canDel ? `<button class="daytab-del" data-delday="${d.id}" title="刪除此拍攝日">✕</button>` : ""}
    </span>`;
  });
  html += `<button class="daytab-add" data-addday>＋ 新增拍攝日</button>`;
  dayTabs.innerHTML = html;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// ---- 事件 ----
sidebar.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-chap]") as HTMLElement | null;
  if (btn) store.setChapter(btn.dataset.chap!);
});
agendaArea.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  // 首頁 LOGO：點擊替換（保留透明度，不走裁切器）／還原預設
  if (t.closest("[data-logoreset]")) { store.setLogo(null); return; }
  if (t.closest("[data-logoreplace]")) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/svg+xml,image/webp,image/jpeg";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => store.setLogo(r.result as string);
      r.readAsDataURL(f);
    };
    input.click();
    return;
  }
  const li = t.closest("[data-chap]") as HTMLElement | null;
  if (li) store.setChapter(li.dataset.chap!);
});
// 目錄頁片名／製作公司 inline 編輯
agendaArea.addEventListener("blur", (e) => {
  const el = e.target as HTMLElement;
  if (el.isContentEditable && el.dataset.meta) {
    store.editMeta(el.dataset.meta as "title" | "client", (el.textContent || "").trim());
  }
}, true);
agendaArea.addEventListener("keydown", (e) => {
  const el = e.target as HTMLElement;
  const ke = e as KeyboardEvent;
  if (el.isContentEditable && ke.key === "Enter" && !ke.isComposing) { e.preventDefault(); el.blur(); }
});

dayTabs.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("[data-addday]")) { store.addDay(); return; }
  const del = t.closest("[data-delday]") as HTMLElement | null;
  if (del) {
    const p = store.get();
    const idx = p.days.findIndex((d) => d.id === del.dataset.delday);
    if (confirm(`確定刪除 Day ${idx + 1}${p.days[idx]?.date ? `（${p.days[idx].date}）` : ""}？此拍攝日的通告與 Rundown 會一併刪除。`)) {
      store.deleteDay(del.dataset.delday!);
    }
    return;
  }
  const tab = t.closest("[data-day]") as HTMLElement | null;
  if (tab) store.setDay(tab.dataset.day!);
});

inspector.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
  if (!btn || !store.selectedId) return;
  const id = store.selectedId;
  const a = btn.dataset.a;
  if (a === "add") addCut();
  else if (a === "dup") store.duplicateCut(id);
  else if (a === "del") store.deleteCut(id);
  else if (a === "group") { store.groupCuts([...store.selectedIds]); pendingFlash = 0; renderAll(); }
  else if (a === "delmulti") store.deleteCuts([...store.selectedIds]);
  else if (a === "subshot") {
    store.addSubShot(id);
    const seq = store.get().cuts.findIndex((c) => c.id === store.selectedId);
    pendingFlash = seq >= 0 ? seq : 0;
    renderAll();
  }
  else if (a === "detach") { store.dissolveGroup(id); pendingFlash = 0; renderAll(); }
  else if (a === "addvo") { expanded.add(id + ":vo"); renderAll(); focusLine(id, "vo"); }
  else if (a === "addsup") { expanded.add(id + ":sup"); renderAll(); focusLine(id, "sup"); }
});

btnAdd.addEventListener("click", addCut);

// ---- 存檔（Tauri 原生檔案；瀏覽器預覽時隱藏） ----
const btnHub = document.getElementById("btn-hub") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const saveState = document.getElementById("save-state")!;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function serialize(): string {
  return JSON.stringify(store.get(), null, 2);
}

function updateSaveState(text?: string) {
  if (!isTauri()) { saveState.textContent = ""; return; }
  if (text) { saveState.textContent = text; return; }
  saveState.textContent = currentDir()
    ? `${dirName()}${dirty ? "・未存變更" : "・已存檔"}`
    : "未存檔（按「儲存案子」選資料夾）";
}

async function doSave() {
  try {
    if (currentDir()) {
      await saveToCurrent(serialize());
      upsertRecent(currentDir()!, store.get().meta.title);
    } else {
      // 第一次儲存：存檔對話框輸入案名 → 以案名建立資料夾
      const dir = await createProjectFolder(serialize(), store.get().meta.title || "未命名案子");
      if (!dir) return;
      upsertRecent(dir, store.get().meta.title);
    }
    dirty = false;
    updateSaveState();
  } catch (err) {
    updateSaveState(`存檔失敗：${err}`);
  }
}

// 切換案子前的防呆：目前內容還沒存成案子就要先確認（已存案子有自動存檔，安全）
function confirmLeave(): boolean {
  if (currentDir() || !dirty) return true;
  return confirm("目前的內容尚未儲存成案子，切換後會消失。確定繼續？");
}

async function doOpen(): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const raw = await chooseFolderAndLoad();
    if (!raw) return false;
    store.replaceProject(normalizeProject(raw));
    dirty = false;
    updateSaveState();
    void healPosters();
    return true;
  } catch (err) {
    alert(`開不了這個檔案——請選案子資料夾裡的 project.json。\n（${err}）`);
    return false;
  }
}

// 看內建示範案：純看版面與玩法，脫離案子資料夾（自動存檔不會寫進真案子；
// 下次啟動仍回到原本的案子）
function hubOpenSample(): boolean {
  if (!confirmLeave()) return false;
  store.replaceProject(sampleProject());
  detachDir();
  dirty = false;
  updateSaveState("示範案（唯讀概念：改了不會存，除非另存新檔）");
  return true;
}

// 專案管理頁的三個動作：新增（案名＝資料夾名）／開最近案子／開其他案子
async function hubCreate(): Promise<boolean> {
  if (!confirmLeave()) return false;
  const proj = emptyProject();
  const dir = await createProjectFolder(JSON.stringify(proj, null, 2), "未命名案子");
  if (!dir) return false;
  proj.meta.title = dirName() || proj.meta.title; // 案名＝使用者輸入的資料夾名
  store.replaceProject(proj);
  dirty = false;
  await saveToCurrent(serialize()); // 把定案名寫回 project.json
  upsertRecent(dir, proj.meta.title);
  updateSaveState();
  return true;
}

async function hubOpenDir(dir: string): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const raw = await loadFromDir(dir);
    if (!raw) return false;
    store.replaceProject(normalizeProject(raw));
    dirty = false;
    updateSaveState();
    void healPosters();
    return true;
  } catch { return false; }
}

// 另存新檔：沒開案子＝等同第一次儲存；有案子＝整份（含素材）複製成新案子
async function doSaveAs() {
  try {
    const title = store.get().meta.title || "未命名案子";
    const dir = currentDir()
      ? await chooseFolderAndSaveAs(serialize(), title)
      : await createProjectFolder(serialize(), title);
    if (!dir) return;
    // 新案子的案名跟著新資料夾名走
    store.editMeta("title", dirName() || title);
    await saveToCurrent(serialize());
    upsertRecent(dir, store.get().meta.title);
    dirty = false;
    updateSaveState();
  } catch (err) {
    alert(`另存失敗：${err}`);
  }
}

// 補抓封面：載入的案子裡有影片但沒首圖的項目（舊版抽圖 bug 留下的），重抽一次
async function healPosters() {
  const p = store.get();
  for (const [ch, items] of Object.entries(p.refPages)) {
    for (const it of items) {
      if (it.videoFile && !it.imageRef) {
        const poster = await extractPosterFor(it.videoFile);
        if (poster) store.setRefImage(ch, it.id, poster);
      }
    }
  }
}

const btnSaveAs = document.getElementById("btn-saveas") as HTMLButtonElement;
if (isTauri()) {
  btnHub.addEventListener("click", () => openHub({ onCreate: hubCreate, onOpenDir: hubOpenDir, onOpenOther: doOpen, onOpenSample: hubOpenSample }));
  btnSave.addEventListener("click", doSave);
  btnSaveAs.addEventListener("click", () => void doSaveAs());
  // 自動存檔：真相變更（含 inline 打字）後 800ms 寫回；純選取/切章不觸發
  store.onMutate(() => {
    dirty = true;
    updateSaveState();
    if (!currentDir()) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(doSave, 800);
  });
  updateSaveState();
  // 啟動自動開回上次的案子（資料夾被移走就留在示範資料，不吵）
  (async () => {
    const last = lastProjectDir();
    if (!last) return;
    try {
      const raw = await loadFromDir(last);
      if (raw) {
        store.replaceProject(normalizeProject(raw));
        dirty = false;
        updateSaveState();
        void healPosters();
      }
    } catch { /* 上次的資料夾不在了：忽略 */ }
  })();
} else {
  btnHub.style.display = "none";
  btnSave.style.display = "none";
  btnSaveAs.style.display = "none";
}

// 貼上外部文字：一律轉純文字（外部字體/顏色/大小不帶進來，版面不跑掉）
document.addEventListener("paste", (e) => {
  const el = e.target as HTMLElement | null;
  if (!el?.isContentEditable) return;
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain") ?? "";
  document.execCommand("insertText", false, text);
});

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  // ⌘S 隨處可存（正在打字也先收尾再存）
  if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (isTauri()) void doSave();
    return;
  }
  if ((e.target as HTMLElement).isContentEditable) return;
  if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); store.undo(); }
  else if (mod && (e.key.toLowerCase() === "z" && e.shiftKey || e.key.toLowerCase() === "y")) { e.preventDefault(); store.redo(); }
  else if (kindOf(store.currentChapter) !== "storyboard") return; // 以下為分鏡專屬
  else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); if (store.selectedId) { store.duplicateCut(store.selectedId); pendingFlash = 0; renderAll(); } }
  else if (e.key === "Enter") { e.preventDefault(); addCut(); }
  else if ((e.key === "Backspace" || e.key === "Delete") && store.selectedId) {
    e.preventDefault();
    if (store.selectedIds.length > 1) store.deleteCuts([...store.selectedIds]);
    else store.deleteCut(store.selectedId);
  }
});

// 上方案名 inline 編輯（Armin：找不到改案名的地方——目錄頁跟通告單也能改，
// 但最直覺的就是點上面那個名字）
const projName = document.getElementById("proj-name")!;
projName.addEventListener("blur", () => {
  store.editMeta("title", (projName.textContent || "").trim());
});
projName.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); projName.blur(); }
});

bindStb(store, stbArea, (flash) => { if (flash !== undefined) pendingFlash = flash; }, expanded);
stbArea.addEventListener("click", (e) => {
  const thumb = (e.target as HTMLElement).closest("[data-thumb]") as HTMLElement | null;
  if (thumb) pickImage(thumb.dataset.thumb!);
});
bindRundown(store, rundownArea);
bindCallSheet(store, callsheetArea);
bindGantt(store, ganttArea);
bindRefPage(store, refpageArea, () => store.currentChapter, renderAll);
document.getElementById("btn-preview")!.addEventListener("click", () => openPreview(store));
document.getElementById("btn-print")!.addEventListener("click", () => void openExportDialog(store));
document.getElementById("btn-help")!.addEventListener("click", openHelp);
store.subscribe(renderAll);
renderAll();
