import { t, tf, chapterTitle } from "./i18n"; // 最先載入：偵測語系並設 <html lang>（帶動字型堆疊）
import { bindEditKeys } from "./editKeys";
import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Store } from "./store";
import { sampleProject, emptyProject } from "./sampleData";
import { renderStb, bindStb } from "./stbView";
import { renderRundown, bindRundown } from "./rundownView";
import { renderCallSheet, bindCallSheet } from "./callSheetView";
import { renderStaff, bindStaff } from "./staffView";
import { renderRefPage, bindRefPage } from "./refPageView";
import { renderGantt, bindGantt } from "./ganttView";
import { openPreview } from "./previewMode";
import { openExportDialog } from "./exportDialog";
import { openCropper } from "./cropper";
import { CHAPTERS, computeCutNumbers, pageCount, chainRundown, hhmmToMin, minToHHMM, normalizeProject, aspectSpec, type Aspect, type Project } from "./model";
import { askAspect } from "./nameDialog";
import { isTauri, isMobile, currentDir, dirName, chooseFolderAndLoad, createProjectFolder, chooseFolderAndSaveAs, saveToCurrent, loadFromDir, lastProjectDir, upsertRecent, detachDir, migrateMobileHome, listMobileProjects, unpackPacked, mobileBase, extractPosterFor, saveImageAs } from "./persistence";
import { projectLogo } from "./logoAsset";
import { openHelp } from "./helpDialog";
import { importScoutFlow } from "./scoutImport";
import { checkUpdate } from "./updateCheck";
import { openHub } from "./hubDialog";
import { openSketchEditor } from "./sketchEditor";
import { pickBoardImages, fileToWorkingImage, pickFiles, bindDropImage } from "./cutPicker";
import { openBlockPicker } from "./assignDialog";

// iPad／觸控裝置：桌面版型用 zoom 等比縮到螢幕寬——zoom 以裝置原生解析度
// 算繪（viewport 縮小會把文字弄糊）。桌面不受影響；iPad 專屬 UI 是後續獨立設計案。
const DESIGN_W = 1240;
function fitMobileZoom() {
  if (navigator.maxTouchPoints < 2) return; // 非觸控裝置（Mac）不動
  const z = Math.min(1, window.innerWidth / DESIGN_W);
  (document.documentElement.style as unknown as { zoom: string }).zoom = String(z);
}
window.addEventListener("resize", fitMobileZoom);
fitMobileZoom();

const store = new Store(sampleProject());
const expanded = new Set<string>(); // 暫時展開的 VO/Super 行
let pendingFlash = -1;

// 編輯模式日／夜（記住選擇；簡報模式另有自己的開關）
const THEME_KEY = "stbTheme";
function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const b = document.getElementById("btn-theme");
  if (b) b.textContent = dark ? t("淺色") : t("深色");
}
applyTheme(localStorage.getItem(THEME_KEY) === "dark");

const app = document.getElementById("app")!;
app.innerHTML = `
  <div class="topbar">
    <span class="name cut-edit" id="proj-name" contenteditable draggable="false" title="${t("點擊修改案名")}" data-ph="${t("案名")}"></span>
    <span class="tag-ppm">PPM</span>
    <span class="save-state" id="save-state"></span>
    <span class="spacer"></span>
    <button id="btn-undo" class="touch-only">${t("復原")}</button>
    <button id="btn-redo" class="touch-only">${t("重做")}</button>
    <button id="btn-preview">${t("▶ 預覽")}</button>
    <button id="btn-print">${t("匯出…")}</button>
    <button id="btn-hub">${t("專案…")}</button>
    <button id="btn-save">${t("儲存專案")}</button>
    <button id="btn-saveas">${t("另存新檔…")}</button>
    <button id="btn-theme" title="${t("切換日／夜")}">${t("深色")}</button>
    <button id="btn-help" title="${t("使用說明與版本資訊")}" aria-label="${t("說明")}">?</button>
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
          <p class="page-label" style="margin-top:6px">${t("拍攝日程（通告單＋Rundown）")}</p>
          <div class="day-tabs" id="day-tabs"></div>
          <div id="callsheet-area"></div>
          <div id="rundown-area"></div>
        </div>
        <div id="staff-area"></div>
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
const staffArea = document.getElementById("staff-area")!;
const refpageArea = document.getElementById("refpage-area")!;
const inspector = document.getElementById("inspector")!;
const statusbar = document.getElementById("statusbar")!;

function kindOf(id: string) {
  return CHAPTERS.find((c) => c.id === id)?.kind ?? "agenda";
}

// 「關於」裡換了預設 LOGO → 封面要跟著換（helpDialog 只管存，不認識主畫面）
document.addEventListener("stb:logo-changed", () => renderAll());

function renderAll() {
  // 分鏡縮圖比例交給 CSS 變數（.cut-thumb / .rd-cut-box / 塗鴉畫布共用）——加新比例不用改 CSS
  document.documentElement.style.setProperty("--cut-ar", String(aspectSpec(store.get().aspect).ar));
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
  staffArea.style.display = kind === "staff" ? "" : "none";
  refpageArea.style.display = kind === "refpage" ? "" : "none";
  inspector.style.display = kind === "storyboard" ? "" : "none";

  if (kind === "agenda") {
    statusbar.innerHTML = `<span class="k">PPM</span><span class="v">${tf("{n} 章", { n: CHAPTERS.length - 1 })}</span><span class="spacer"></span><span class="hint">${t("點左側章節開始，或點目錄項目")}</span>`;
    renderAgenda();
  } else if (kind === "storyboard") {
    const filmCuts = p.cuts.filter((c) => c.filmId === store.currentFilmId);
    const filmTag = p.films.length > 1 ? `${store.currentFilm()?.name ?? ""} ` : "";
    statusbar.innerHTML = `
      <span class="k">${t("分鏡")}</span><span class="v">${filmTag}${tf("{n} 顆 cut", { n: filmCuts.length })}</span>
      <span class="k" style="margin-left:8px">${t("頁數")}</span><span class="v">${pageCount(filmCuts.length, store.get().aspect)}</span>
      <span class="spacer"></span><span class="hint">${isMobile()
        ? t("把手 ⠿ 拖曳重排 · 點文字直接編輯 · 長按卡片＝多選 · 復原鈕在右上")
        : t("把手 ⠿ 拖曳重排 · 點文字直接編輯 · ⌘/Shift 點擊多選")}</span>`;
    renderStb(store, stbArea, pendingFlash, expanded);
    pendingFlash = -1;
    renderInspector();
  } else if (kind === "staff") {
    const p2 = store.get();
    const n = p2.contacts.filter((c) => c.name.trim()).length;
    statusbar.innerHTML = `<span class="k">CONTACTS</span><span class="v">${t("工作人員")}</span>`
      + `<span class="k" style="margin-left:8px">${t("人數")}</span><span class="v">${n}</span>`
      + `<span class="spacer"></span><span class="hint">${t("跟通告單共用同一份名單 · 這裡不顯示電話")}</span>`;
    renderStaff(store, staffArea);
  } else if (kind === "schedule") {
    const day = store.currentDay();
    const times = day ? chainRundown(day.rundown, hhmmToMin(day.callTime)) : [];
    const wrap = times.length ? minToHHMM(times[times.length - 1].end) : "—";
    statusbar.innerHTML = `
      <span class="k">${t("拍攝日")}</span><span class="v">${day?.date || t("（未定）")}</span>
      <span class="k" style="margin-left:8px">${t("集合")}</span><span class="v">${day?.callTime || "—"}</span>
      <span class="k" style="margin-left:8px">${t("收工")}</span><span class="v">${wrap}</span>
      <span class="spacer"></span><span class="hint">${t("通告單在前 · 該日 Rundown 在後")}</span>`;
    renderGantt(store, ganttArea);
    renderDayTabs();
    renderCallSheet(store, callsheetArea);
    renderRundown(store, rundownArea);
  } else {
    const ch = CHAPTERS.find((c) => c.id === chapId)!;
    const n = (p.refPages[chapId] || []).length;
    const ct = chapterTitle(ch);
    statusbar.innerHTML = `<span class="k">${ct.cap}</span>${ct.sub ? `<span class="v">${ct.sub}</span>` : ""}<span class="k" style="margin-left:8px">${t("項目")}</span><span class="v">${n}</span><span class="spacer"></span><span class="hint">${t("貼參考圖＋說明，向客戶對齊調性")}</span>`;
    renderRefPage(store, refpageArea, chapId);
  }
}

function renderSidebar() {
  const mode = store.get().mode ?? "ppm";
  let html = "";
  for (const ch of CHAPTERS) {
    // 通告排表模式（製片版）：側欄＝分鏡（卡片整理：匯入/排序/群組/標註）
    // ＋ SCHEDULE（甘特/通告單/Rundown）——其餘 PPM 章收起
    if (mode === "schedule" && ch.kind !== "schedule" && ch.kind !== "storyboard") continue;
    const on = ch.id === store.currentChapter ? " on" : "";
    const ct = chapterTitle(ch);
    html += `<button class="chap${on}" data-chap="${ch.id}"><span class="chap-en">${ct.cap}</span>${ct.sub ? `<span class="chap-zh">${ct.sub}</span>` : ""}</button>`;
  }
  // 模式切換：同一份檔案、只是檢視範圍——導演接手就展開、製片交接就收合
  html += `<button class="mode-switch" data-modeswitch title="${t("同一個案子檔，隨時可切換")}">${
    mode === "schedule" ? t("⇱ 展開完整 PPM") : t("⇲ 通告排表模式")
  }</button>`;
  sidebar.innerHTML = html;
}

function renderAgenda() {
  const p = store.get();
  // 首頁（目錄前）：置中 LOGO，點擊替換（透明 PNG 佳，不走裁切器保留透明度）
  let html = `<p class="page-label">${t("COVER · 首頁")}</p><div class="page cover-page">
    <img class="cover-logo" src="${projectLogo(p)}" alt="LOGO" title="${t("點擊替換 LOGO")}" data-logoreplace draggable="false">
    <span class="cover-hint">${t("點 LOGO 替換（建議透明 PNG）")}${p.meta.logo ? `　<button class="cover-reset" data-logoreset>${t("還原預設")}</button>` : ""}</span>
  </div>`;
  html += `<p class="page-label">${t("AGENDA · 目錄 · A5 橫")}</p><div class="page agenda">
    <div class="ag-title cut-edit" contenteditable draggable="false" data-meta="title" data-ph="${t("片名")}">${esc(p.meta.title)}</div>
    <div class="ag-sub">${t("PPM ・ 前製會議")} ・ <span class="cut-edit" contenteditable draggable="false" data-meta="client" data-ph="${t("製作公司")}">${esc(p.meta.client)}</span></div>
    <ol class="ag-list">`;
  for (const ch of CHAPTERS) {
    if (ch.id === "agenda") continue;
    const ct = chapterTitle(ch);
    html += `<li data-chap="${ch.id}"><span class="ag-en">${ct.cap}</span>${ct.sub ? `<span class="ag-zh">${ct.sub}</span>` : ""}</li>`;
  }
  html += `</ol></div>`;
  agendaArea.innerHTML = html;
}

function renderInspector() {
  const p = store.get();
  // 觸控多選模式：body 掛旗標（CSS 讓卡上的字不吃事件——點到哪都算點卡，
  // 不彈鍵盤不搶焦點；「看起來選了、其實是輸入焦點框」的誤會就此絕跡）
  document.body.classList.toggle("sel-mode", store.touchSelect);
  // 多選：Mac＝⌘/Shift 點擊；iPad＝長按進入模式（touchSelect，1 顆也算在模式中）
  if (store.touchSelect ? store.selectedIds.length >= 1 : store.selectedIds.length > 1) {
    inspector.innerHTML = `
      <span class="cur">${tf("已選 {n} 顆", { n: store.selectedIds.length })}</span>
      ${store.selectedIds.length > 1 ? `<button data-a="group">${t("組成連續鏡")}</button>` : ""}
      <button data-a="assign">${t("⇒ 指派到時段")}</button>
      ${store.scoutMode ? `<button data-a="delscoutmulti">${t("刪場勘")}</button>` : ""}
      <button data-a="delmulti">${t("刪除選取")}</button>
      ${store.touchSelect
        ? `<button data-a="selend">${t("完成")}</button><span class="hint">${t("點卡片＝加選/取消 · 按「完成」結束")}</span>`
        : `<span class="hint">${t("⌘ 點擊加選 · Shift 點擊連選")}</span>`}`;
    return;
  }
  const id = store.selectedId;
  if (!id) {
    inspector.innerHTML = `
      <button data-a="importboards">${t("＋ 匯入分鏡圖")}</button>
      <span class="hint">${t("外部軟體做的分鏡：多選圖檔一次帶入，拖曳排序、⌘/Shift 多選組連續鏡或指派到時段")}</span>`;
    return;
  }
  const numbers = computeCutNumbers(p.cuts, p.films);
  const n = numbers.get(id);
  if (!n) return;
  const cut = p.cuts.find((c) => c.id === id)!;
  const grouped = n.groupSize > 1;
  const canVo = cut.vo === "" && !expanded.has(id + ":vo");
  const canSup = cut.sup === "" && !expanded.has(id + ":sup");
  inspector.innerHTML = `
    <span class="cur">${tf("CUT {label}", { label: n.label })}</span>
    <button data-a="add">${t("新增 cut（插在後面）")}</button>
    <button data-a="subshot">${t("＋ 連續鏡")}</button>
    ${grouped ? `<button data-a="detach">${t("拆除群組")}</button>` : ""}
    ${canVo ? `<button data-a="addvo">${t("+ VO")}</button>` : ""}
    ${canSup ? `<button data-a="addsup">${t("+ Super")}</button>` : ""}
    <button data-a="sketch" title="${t("Apple Pencil／滑鼠塗鴉分鏡（Pencil 直接點縮圖也可）")}">✏️ ${t("塗鴉")}</button>
    <button data-a="assign">${t("⇒ 指派到時段")}</button>
    <button data-a="dup">${t("複製")}</button>
    <button data-a="hide" title="${t("隱藏這顆（預覽/匯出看不見、不佔編號；點灰格顯示回來）")}">${t("隱藏")}</button>
    <button data-a="del">${t("刪除")}</button>
    ${grouped ? `<span class="hint">${t("連續鏡：拖任一子鏡整組同行 · 拆除＝整組拆散")}</span>` : ""}
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
  // flash 用「路內」序（畫面一次只顯示一路）
  const cs = store.get().cuts.filter((c) => c.filmId === store.currentFilmId);
  const seq = cs.findIndex((c) => c.id === store.selectedId);
  pendingFlash = seq >= 0 ? seq : 0;
  renderAll();
}

async function pickImage(cutId: string) {
  // 已有分鏡圖 → 直接進編輯器（裁切／區塊內縮放／一鍵黑白／換一張）；
  // 沒有 → 選檔後進裁切器。裁切比例跟著整片分鏡比例（直式＝9:16）。
  const ar = aspectSpec(store.get().aspect).ar;
  const cut = store.get().cuts.find((c) => c.id === cutId);
  if (cut?.imageRef) {
    const out = await openCropper(cut.imageRef, ar, { allowReplace: true, saveName: `${store.get().meta.title || "分鏡"}_CUT` });
    if (out) store.setImage(cutId, out);
    return;
  }
  const [file] = await pickFiles("image/*", false);
  if (file) await applyImageFile(cutId, file);
}

// 手動匯入單張場勘圖：選檔 → 裁切成分鏡比例 → 寫入 scoutRef（分鏡圖不動）
async function pickScoutImage(cutId: string) {
  const src = await open({
    title: t("選擇場勘照片"),
    filters: [{ name: t("圖片"), extensions: ["jpg", "jpeg", "png", "webp", "heic", "gif", "bmp"] }],
  });
  if (typeof src !== "string") return;
  const buf = await invoke<ArrayBuffer>("read_file", { path: src });
  const ext = src.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp" } as Record<string, string>)[ext] ?? "image/jpeg";
  const url = URL.createObjectURL(new Blob([buf], { type: mime }));
  const ar = aspectSpec(store.get().aspect).ar;
  const out = await openCropper(url, ar);
  URL.revokeObjectURL(url);
  if (out) store.setScoutImage(cutId, out);
}

// 把一個檔案套進某格——選檔與「拖曳入圖」共用同一條管線（縮工作圖 → 裁切 → 存）
async function applyImageFile(cutId: string, file: File) {
  const ar = aspectSpec(store.get().aspect).ar;
  // 先縮成工作圖再進裁切器（原檔 48MP 直餵會耗盡 iPad 解碼資源）
  const url = await fileToWorkingImage(file);
  if (!url) { alert(t("這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次；全景/超大圖請先裁切。")); return; }
  const cropped = await openCropper(url, ar, { allowReplace: true });
  if (cropped) store.setImage(cutId, cropped);
}

function renderDayTabs() {
  const p = store.get();
  const canDel = p.days.length > 1;
  let html = "";
  p.days.forEach((d, i) => {
    const on = d.id === store.currentDayId ? " on" : "";
    html += `<span class="daytab-wrap">
      <button class="daytab${on}" data-day="${d.id}">${tf("Day {n}", { n: i + 1 })}${d.date ? `<span class="daytab-date">${d.date}</span>` : ""}</button>
      ${canDel ? `<button class="daytab-del" data-delday="${d.id}" title="${t("刪除此拍攝日")}">✕</button>` : ""}
    </span>`;
  });
  html += `<button class="daytab-add" data-addday>${t("＋ 新增拍攝日")}</button>`;
  dayTabs.innerHTML = html;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// ---- 事件 ----
sidebar.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("[data-modeswitch]")) {
    const cur = store.get().mode ?? "ppm";
    store.setMode(cur === "ppm" ? "schedule" : "ppm");
    return;
  }
  const btn = t.closest("[data-chap]") as HTMLElement | null;
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
bindEditKeys(agendaArea); // Enter 留在框內（中文選字友善）、Esc 結束輸入

dayTabs.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("[data-addday]")) { store.addDay(); return; }
  const del = t.closest("[data-delday]") as HTMLElement | null;
  if (del) {
    const p = store.get();
    const idx = p.days.findIndex((d) => d.id === del.dataset.delday);
    if (confirm(tf("確定刪除 Day {day}？此拍攝日的通告與 Rundown 會一併刪除。", { day: `${idx + 1}${p.days[idx]?.date ? `（${p.days[idx].date}）` : ""}` }))) {
      store.deleteDay(del.dataset.delday!);
    }
    return;
  }
  const tab = t.closest("[data-day]") as HTMLElement | null;
  if (tab) store.setDay(tab.dataset.day!);
});

inspector.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
  if (!btn) return;
  // 匯入分鏡圖：不需要選取（空案子也能按）
  if (btn.dataset.a === "importboards") {
    void pickBoardImages(store.get().aspect).then((imgs) => { if (imgs.length) store.addCutsFromImages(imgs); });
    return;
  }
  if (!store.selectedId) return;
  const id = store.selectedId;
  const a = btn.dataset.a;
  // 指派到時段（＝設定場次）：單選或多選都吃
  if (a === "assign") {
    const ids = store.selectedIds.length > 1 ? [...store.selectedIds] : [id];
    void openBlockPicker(store).then((blockId) => {
      if (blockId) store.assignCutsToBlock(blockId, ids);
    });
    return;
  }
  if (a === "selend") { store.select(null); return; } // 結束觸控多選（select(null) 會關模式）
  if (a === "sketch") { openSketchEditor(store, id); return; }
  if (a === "add") addCut();
  else if (a === "dup") store.duplicateCut(id);
  // 隱藏：卡片變成縫間細線（不佔編號），選取要跟著清掉——被選的卡片已經不在了
  else if (a === "hide") { store.setHidden(id, true); store.select(null); }
  else if (a === "del") store.deleteCut(id);
  else if (a === "group") { store.groupCuts([...store.selectedIds]); pendingFlash = 0; renderAll(); }
  else if (a === "delscoutmulti") {
   const ids = store.selectedIds.filter((id) => store.get().cuts.find((c) => c.id === id)?.scoutRef);
   if (ids.length && confirm(tf("刪除選取的 {n} 張場勘圖？分鏡圖不受影響（可復原）。", { n: ids.length }))) {
     store.clearScoutMany(ids);
   }
   return;
 }
 if (a === "delmulti") store.deleteCuts([...store.selectedIds]);
  else if (a === "subshot") {
    store.addSubShot(id);
    const cs = store.get().cuts.filter((c) => c.filmId === store.currentFilmId);
    const seq = cs.findIndex((c) => c.id === store.selectedId);
    pendingFlash = seq >= 0 ? seq : 0;
    renderAll();
  }
  else if (a === "detach") { store.dissolveGroup(id); pendingFlash = 0; renderAll(); }
  else if (a === "addvo") { expanded.add(id + ":vo"); renderAll(); focusLine(id, "vo"); }
  else if (a === "addsup") { expanded.add(id + ":sup"); renderAll(); focusLine(id, "sup"); }
});


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
    ? `${dirName()}${dirty ? t("・未存變更") : t("・已存檔")}`
    : t("未存檔（按「儲存專案」選資料夾）");
}

async function doSave() {
  try {
    if (currentDir()) {
      await saveToCurrent(serialize());
      upsertRecent(currentDir()!, store.get().meta.title);
    } else {
      // 第一次儲存：存檔對話框輸入案名 → 以案名建立資料夾
      const dir = await createProjectFolder(serialize(), store.get().meta.title || t("未命名案子"));
      if (!dir) return;
      upsertRecent(dir, store.get().meta.title);
    }
    dirty = false;
    updateSaveState();
    void syncMtime(); // 自己寫的檔＝新基準，別誤判成外部改動
  } catch (err) {
    updateSaveState(tf("存檔失敗：{err}", { err: String(err) }));
  }
}

// 切換案子前的防呆：目前內容還沒存成案子就要先確認（已存案子有自動存檔，安全）
function confirmLeave(): boolean {
  if (currentDir() || !dirty) return true;
  return confirm(t("目前的內容尚未儲存成案子，切換後會消失。確定繼續？"));
}

async function doOpen(): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const raw = await chooseFolderAndLoad();
    if (!raw) return false;
    store.replaceProject(promoteScoutBoards(normalizeProject(raw)));
    dirty = false;
    updateSaveState();
    void healPosters();
    void syncMtime();
    return true;
  } catch (err) {
    alert(tf("開不了這個檔案——請選案子資料夾裡的 project.json。\n（{err}）", { err: String(err) }));
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
  updateSaveState(t("示範案（唯讀概念：改了不會存，除非另存新檔）"));
  return true;
}

// 專案管理頁的動作：新增（案名＝資料夾名；ppm＝完整十章、schedule＝通告排表）
// ／開最近案子／開其他案子
async function hubCreate(mode: "ppm" | "schedule"): Promise<boolean> {
  if (!confirmLeave()) return false;
  // 完整 PPM 才問分鏡比例（橫式／直式）；通告排表輕量走橫式預設。取消＝中止新建。
  let aspect: Aspect | undefined;
  if (mode === "ppm") {
    const a = await askAspect();
    if (a === null) return false;
    aspect = a;
  }
  const proj = emptyProject(t("未命名案子"), aspect);
  proj.mode = mode;
  const dir = await createProjectFolder(JSON.stringify(proj, null, 2), mode === "schedule" ? t("未命名通告") : t("未命名案子"));
  if (!dir) return false;
  proj.meta.title = dirName() || proj.meta.title; // 案名＝使用者輸入的資料夾名
  store.replaceProject(proj);
  dirty = false;
  await saveToCurrent(serialize()); // 把定案名寫回 project.json
  upsertRecent(dir, proj.meta.title);
  updateSaveState();
  void syncMtime();
  return true;
}

// iPad「匯入案子…」：iOS 文件選擇器（可瀏覽 iCloud 雲碟）選 .stb →
// 複製解開進 Documents 案子家 → 開啟。來源在 iCloud 是唯讀的，所以
// 一律解進自己的家，不動原檔。
async function hubImportPacked(): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const path = await open({
      title: t("選擇打包案子（.stb）"),
      filters: [{ name: t("STB 打包案子"), extensions: ["stb"] }],
    });
    if (typeof path !== "string") return false;
    const dir = await unpackPacked(path, await mobileBase());
    const raw = await loadFromDir(dir);
    if (!raw) return false;
    store.replaceProject(promoteScoutBoards(normalizeProject(raw)));
    dirty = false;
    updateSaveState();
    void healPosters();
    void syncMtime();
    return true;
  } catch (err) {
    alert(tf("匯入失敗：{err}\n（備援路線：把 .stb 存進 檔案 App ▸ 我的 iPad ▸ STB，回專案頁點一下即可解開）", { err: String(err) }));
    return false;
  }
}

// .stb 打包案子：解開成同層資料夾 → 載入（iPad 專案頁清單／收 AirDrop 用）
async function hubOpenPacked(path: string): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const dir = await unpackPacked(path);
    const raw = await loadFromDir(dir);
    if (!raw) return false;
    store.replaceProject(promoteScoutBoards(normalizeProject(raw)));
    dirty = false;
    updateSaveState();
    void healPosters();
    void syncMtime();
    return true;
  } catch (err) {
    alert(tf("解不開這個打包案子：{err}", { err: String(err) }));
    return false;
  }
}

// 從磁碟選一個 .stb 分鏡包解開成專案（「匯入分鏡…」）。
// ⚠️ 2026-07-28 修：這顆按鈕原本誤綁 doOpen，而 doOpen 只吃「案子資料夾裡的 project.json」，
// 選 .stb 一定失敗——標籤承諾了程式沒做的事（Armin 實測踩到）。
async function hubOpenStbFile(): Promise<boolean> {
  const path = await open({
    title: t("選擇分鏡包（.stb）"),
    filters: [{ name: t("分鏡包（.stb）"), extensions: ["stb"] }],
  });
  if (typeof path !== "string") return false;
  return hubOpenPacked(path);
}

// 從 STBC 三岔路選「開成新專案」：解包＋載入＋照片自動升格為分鏡（使用者已明確選了，不再問）
async function openPackedAsProject(path: string): Promise<boolean> {
  try {
    if (!confirmLeave()) return false;
    const dir = await unpackPacked(path, isMobile() ? await mobileBase() : undefined);
    const raw = await loadFromDir(dir);
    if (!raw) return false;
    const p = normalizeProject(raw);
    const promoted = p.cuts.some((c) => c.scoutRef) && !p.cuts.some((c) => c.imageRef)
      ? { ...p, cuts: p.cuts.map((c) => (c.scoutRef ? { ...c, imageRef: c.scoutRef, scoutRef: null } : c)) }
      : p;
    store.replaceProject(promoted);
    dirty = false;
    updateSaveState();
    void healPosters();
    void syncMtime();
    return true;
  } catch (err) {
    alert(tf("開不了這個分鏡包：{err}", { err: String(err) }));
    return false;
  }
}

// STBC「自建分鏡包」：照片存在 scoutRef、imageRef 全空——直接開會看到一排空白分鏡
// （Armin 2026-07-28 實測踩到：檔案有解開，但分鏡欄是空的＝看起來像匯入失敗）。
// 規則對齊 importAsNewFilm：照片就是這一路的分鏡圖。
function promoteScoutBoards(p: Project): Project {
  const cuts = p.cuts ?? [];
  if (!cuts.some((c) => c.scoutRef) || cuts.some((c) => c.imageRef)) return p;
  const yes = confirm(
    t("這是 STB Camera 的自建分鏡包——照片在場勘欄、分鏡欄是空的。\n\n要把照片當成分鏡圖嗎？\n確定＝照片變分鏡（建議）；取消＝維持場勘欄。"),
  );
  if (!yes) return p;
  return { ...p, cuts: cuts.map((c) => (c.scoutRef ? { ...c, imageRef: c.scoutRef, scoutRef: null } : c)) };
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
    void syncMtime();
    return true;
  } catch { return false; }
}

// 另存新檔：沒開案子＝等同第一次儲存；有案子＝整份（含素材）複製成新案子
async function doSaveAs() {
  try {
    const title = store.get().meta.title || t("未命名案子");
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
    void syncMtime();
  } catch (err) {
    alert(tf("另存失敗：{err}", { err: String(err) }));
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
// —— AI／外部編輯即時同步 ——
// project.json 是唯一真相：外部（Claude Code／任何 AI／文字編輯器）改了檔案，
// App 每 2 秒偵測 mtime 自動重載——這就是「自然語言駕駛 STB」的地基。
// 防呆：本地有未存變更或正在打字時不搶；檔案寫到一半（JSON 解析失敗）下輪再試。
let knownMtime = 0;
async function syncMtime() {
  knownMtime = currentDir()
    ? await invoke<number>("project_mtime", { dir: currentDir() }).catch(() => 0)
    : 0;
}

// 專案管理頁：Mac＝最近案子清單；iPad＝掃「檔案」App ▸ STB 的真實資料夾
const hubActions = {
  onCreate: hubCreate,
  onOpenDir: hubOpenDir,
  onOpenOther: doOpen,
  onOpenSample: hubOpenSample,
  onOpenPacked: hubOpenPacked,
  onOpenStbFile: hubOpenStbFile,
  onImportPacked: isMobile() ? hubImportPacked : undefined,
  onImportSTBC: () => void importScoutFlow(store, openPackedAsProject),
  list: isMobile() ? listMobileProjects : undefined,
};

if (isTauri()) {
  btnHub.addEventListener("click", () => openHub(hubActions));
  btnSave.addEventListener("click", doSave);
  btnSaveAs.addEventListener("click", () => void doSaveAs());
  setInterval(async () => {
    if (!currentDir() || dirty) return;
    if ((document.activeElement as HTMLElement | null)?.isContentEditable) return;
    const m = await invoke<number>("project_mtime", { dir: currentDir()! }).catch(() => 0);
    if (!m) return;
    if (knownMtime === 0) { knownMtime = m; return; } // 第一次＝定基準
    if (m <= knownMtime) return;
    try {
      const raw = await loadFromDir(currentDir()!);
      if (raw) {
        store.replaceProject(normalizeProject(raw));
        dirty = false;
        updateSaveState(tf("{name}・已從外部更新", { name: String(dirName()) }));
        void healPosters();
      }
      knownMtime = m;
    } catch { /* 檔案可能寫到一半：下一輪再試 */ }
  }, 2000);
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
    // iPad 一次性搬家（過渡存檔 → 檔案 App 看得到的 Documents）要在開案前做，
    // localStorage 的路徑指標才會先指到新家
    if (isMobile()) await migrateMobileHome();
    const last = lastProjectDir();
    if (last) {
      try {
        const raw = await loadFromDir(last);
        if (raw) {
          store.replaceProject(normalizeProject(raw));
          dirty = false;
          updateSaveState();
          void healPosters();
          void syncMtime();
          return;
        }
      } catch { /* 上次的資料夾不在了：往下走 */ }
    }
    // iPad 沒案子可回：直接開專案管理頁取名建案（示範內容編輯不落地，先建案才存）
    if (isMobile()) openHub(hubActions);
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
bindEditKeys(projName.parentElement as HTMLElement); // 案名同規則：Enter 留、Esc 結束

bindStb(store, stbArea, (flash) => { if (flash !== undefined) pendingFlash = flash; }, expanded);
// 觸控多選的就地加選/取消：只刷新底欄計數，不整頁重繪（stbView 發出）
document.addEventListener("stb:selchange", () => renderInspector());
// Pencil 點縮圖＝直接進塗鴉（iPad 不放常駐 ✏️ 鈕——筆本身就是入口）
let lastPtrType = "";
stbArea.addEventListener("pointerdown", (e) => { lastPtrType = (e as PointerEvent).pointerType; }, true);
stbArea.addEventListener("click", (e) => {
  // ＋新增 cut（從頂欄搬進分鏡章，跟匯入按鈕同列）
  if ((e.target as HTMLElement).closest("[data-addcut]")) { addCut(); return; }
  // 匯入場勘包（STB Camera 拍回來的 .stb）
  if ((e.target as HTMLElement).closest("[data-scoutimport]")) { void importScoutFlow(store, openPackedAsProject); return; }
  // 清除本案全部場勘圖
  if ((e.target as HTMLElement).closest("[data-scoutclear]")) {
    const n = store.get().cuts.filter((c) => c.scoutRef).length;
    if (confirm(tf("刪除本案全部 {n} 張場勘圖？分鏡圖不受影響（⌘Z 可復原）。", { n }))) store.clearAllScout();
    return;
  }
  // ✕＝刪除這格的場勘圖（分鏡不動，可 undo）
  const ds = (e.target as HTMLElement).closest("[data-delscout]") as HTMLElement | null;
  if (ds) {
    if (confirm(t("刪除這張場勘圖？分鏡圖不受影響（可 ⌘Z 復原）。"))) store.clearScout(ds.dataset.delscout!);
    return;
  }
  // ⬇＝把這格的分鏡圖另存成檔案
  const si = (e.target as HTMLElement).closest("[data-saveimg]") as HTMLElement | null;
  if (si) {
    const p = store.get();
    const c = p.cuts.find((x) => x.id === si.dataset.saveimg);
    // 場勘模式存 scoutRef、分鏡模式存 imageRef
    const img = store.scoutMode ? c?.scoutRef : c?.imageRef;
    if (c && img) {
      const label = computeCutNumbers(p.cuts, p.films).get(c.id)?.label ?? c.id;
      void saveImageAs(img, `${p.meta.title || (store.scoutMode ? "場勘" : "分鏡")}_CUT${label}`);
    }
    return;
  }
  // 場勘模式空格＝手動匯入單張場勘圖
  // 點場勘照＝進調整介面（跟分鏡圖同一套；iPad 存圖入口就在裡面——區塊零按鈕原則）
  const se = (e.target as HTMLElement).closest("[data-scoutedit]") as HTMLElement | null;
  if (se) {
    const cutId = se.dataset.scoutedit!;
    const c = store.get().cuts.find((x) => x.id === cutId);
    if (c?.scoutRef) {
      void (async () => {
        const ar = aspectSpec(store.get().aspect).ar;
        const out = await openCropper(c.scoutRef!, ar, { saveName: `${store.get().meta.title || t("場勘")}_${t("場勘")}` });
        if (out) store.setScoutImage(cutId, out);
      })();
    }
    return;
  }
  const sa = (e.target as HTMLElement).closest("[data-scoutadd]") as HTMLElement | null;
  if (sa) { void pickScoutImage(sa.dataset.scoutadd!); return; }
  // ✏️（桌面 hover 鈕）＝塗鴉分鏡；已是塗鴉的格點縮圖也直接回編輯器（筆跡可再編輯）
  const sk = (e.target as HTMLElement).closest("[data-sketch]") as HTMLElement | null;
  if (sk) { openSketchEditor(store, sk.dataset.sketch!); return; }
  const thumb = (e.target as HTMLElement).closest("[data-thumb]") as HTMLElement | null;
  if (!thumb) return;
  const cut = store.get().cuts.find((c) => c.id === thumb.dataset.thumb);
  if (!cut) return;
  if (cut.sketch || lastPtrType === "pen") { openSketchEditor(store, cut.id); return; }
  pickImage(cut.id);
});
bindRundown(store, rundownArea);
bindStaff(store, staffArea, () => renderAll());
bindCallSheet(store, callsheetArea);
bindGantt(store, ganttArea);
bindRefPage(store, refpageArea, () => store.currentChapter, renderAll);
document.getElementById("btn-preview")!.addEventListener("click", () => openPreview(store));
document.getElementById("btn-print")!.addEventListener("click", () => void openExportDialog(store));
document.getElementById("btn-help")!.addEventListener("click", openHelp);
document.getElementById("btn-theme")!.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  applyTheme(dark);
});
// iPad 主畫面復原/重做＝頂欄按鈕（觸控裝置才顯示；Mac 仍是 ⌘Z／⇧⌘Z）。
// 雙指/三指輕點手勢 2026-08-15 起收斂到塗鴉編輯器內——在表格與 inline 編輯的
// 畫面上，雙指誤觸退掉的是「整個案子的上一步」，使用者不知道退了什麼。
// toast 確認「剛剛真的退了一步」（undo 本身常常看不出來動了哪）
const gestureToast = (msg: string) => {
  const t = document.createElement("div");
  t.className = "pv-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 700);
};
const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement;
const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement;
btnUndo.addEventListener("click", () => { if (store.canUndo()) { store.undo(); gestureToast(t("↩︎ 上一步")); } });
btnRedo.addEventListener("click", () => { if (store.canRedo()) { store.redo(); gestureToast(t("↪︎ 下一步")); } });
store.subscribe(() => { btnUndo.disabled = !store.canUndo(); btnRedo.disabled = !store.canRedo(); });

// 全域保險：把圖片拖進 App 但「沒對準」放置區時，webview 預設會導航去開那張圖，
// 整個介面被圖片佔滿又回不去（Tauri 沒有上一頁）。這裡把所有沒被處理的拖放一律
// 擋掉預設行為 —— 有對準圖片格的 drop 仍由下面 bindDropImage 先處理（子層先跑）。
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// 拖曳入圖：檔案拖到分鏡格＝直接套進那一格（參考頁的綁在 refPageView 內）
bindDropImage(stbArea, "[data-thumb]", (el, f) => void applyImageFile(el.dataset.thumb!, f));

store.subscribe(renderAll);
renderAll();

// ── QA 後門：截圖自動化用（跟 i18n 的 ?lang= 同一種東西，只讀不寫、不進 localStorage）──
//   ?demo=<name>  載入 public/demo/<name>.json 當前專案（截圖夾具，public/demo 已進 .gitignore）
//   ?chap=<id>    直接跳到某一章
// 產品環境打這兩個參數：demo 檔不存在就 404 靜靜跳過，chap 只是切章，都無副作用。
{
  const qs = new URLSearchParams(location.search);
  const chap = qs.get("chap");
  const goChap = () => { if (chap && CHAPTERS.some((c) => c.id === chap)) { store.currentChapter = chap; renderAll(); } };
  const demo = qs.get("demo");
  // 允許 magicstone.ja 這種帶語系的檔名；不准出現 .. 或斜線（路徑穿越）
  if (demo && /^[\w-]+(\.[\w-]+)*$/.test(demo)) {
    void fetch(`/demo/${demo}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no demo"))))
      .then((j) => { store.replaceProject(normalizeProject(j)); goChap(); })
      .catch(() => goChap());
  } else goChap();
}
// 更新提醒：延後幾秒再查，不跟開檔搶資源；離線就安靜跳過
setTimeout(() => void checkUpdate(), 4000);
