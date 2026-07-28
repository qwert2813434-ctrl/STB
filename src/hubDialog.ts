import { recentProjects, removeRecent, currentDir, type RecentEntry } from "./persistence";
import { t, tf } from "./i18n";

// 專案管理頁（概念同 Adobe 開始畫面）：案子條列（案名＋位置＋時間，
// 點了才開）、＋新增案子（輸入案名→以案名建資料夾）、開啟其他案子。
// 動作本體由 main.ts 傳入（載入/建立牽動 store 與存檔狀態）。
// Mac＝最近案子清單（localStorage）；iPad 傳入 list＝掃「檔案」App ▸ STB 的
// 真實資料夾——在檔案 App 增刪改名的案子即時反映，也沒有「清單記錯」問題。

export interface HubActions {
  // 新增案子（含存檔對話框）；mode: ppm＝完整十章、schedule＝通告排表（製片版）
  onCreate: (mode: "ppm" | "schedule") => Promise<boolean>;
  onOpenDir: (dir: string) => Promise<boolean>; // 開案子；false＝資料夾不見了
  onOpenOther: () => Promise<boolean>; // 選 project.json 開其他案子（桌面限定）
  onImportSTBC?: () => void; // 匯入 STBC 項目（場勘包/自建分鏡包，桌面限定）
  onOpenSample: () => boolean;        // 看內建示範案（不落地、不影響真案子）
  list?: () => Promise<RecentEntry[]>; // iPad：掃真實資料夾當清單來源
  onOpenPacked?: (path: string) => Promise<boolean>; // .stb 打包案子：解開＋載入（最近清單用）
  onOpenStbFile?: () => Promise<boolean>;            // 從磁碟選一個 .stb 解開成專案
  // iPad：從 iCloud 雲碟／檔案 App 任何位置選 .stb 匯入（Armin：拉檔進
  // STB 資料夾太麻煩，工作流是去 iCloud 找檔案）
  onImportPacked?: () => Promise<boolean>;
}

export function openHub(actions: HubActions) {
  if (document.querySelector(".hub-overlay")) return;
  const mobile = !!actions.list;
  const overlay = document.createElement("div");
  overlay.className = "hub-overlay";
  document.body.appendChild(overlay);

  function rowsHtml(entries: RecentEntry[]): string {
    const cur = currentDir();
    return entries.map((r) => `
      <div class="hub-row" data-dir="${esc(r.dir)}"${r.packed ? ` data-packed="1"` : ""}>
        <div class="hub-rmain">
          <div class="hub-rtitle">${esc(r.title || t("未命名案子"))}${r.packed ? `<span class="hub-rpack">${t("打包")}</span>` : ""}${r.dir === cur ? `<span class="hub-rnow">${t("目前")}</span>` : ""}</div>
          <div class="hub-rpath">${r.packed ? t("打包案子——點一下解開成資料夾並開啟") : esc(mobile ? tf("檔案 App ▸ STB ▸ {name}", { name: r.dir.split("/").pop() || "" }) : r.dir)}</div>
        </div>
        <span class="hub-rdate">${fmtDate(r.at)}</span>
        ${mobile ? "" : `<button class="hub-rx" data-forget="${esc(r.dir)}" title="${t("從清單移除（不會刪除案子本身）")}">✕</button>`}
      </div>`).join("");
  }

  function render() {
    overlay.innerHTML = `
      <div class="hub-panel">
        <div class="hub-head">
          <span class="hub-title">${t("專案")}</span>
          <button class="hub-act" data-hubnew="ppm">${t("＋ 創建新專案")}</button>
          <button class="hub-act" data-hubnew="schedule" title="${t("製片版：分鏡整理＋甘特／通告單／Rundown 的輕量排表案；隨時可展開成完整 PPM")}">${t("＋ 排表流程")}</button>
          ${mobile
            ? `<button class="hub-act" data-hubimport title="${t("從 iCloud 雲碟／檔案 App 選打包案子（.stb），複製進來解開")}">${t("匯入案子…")}</button>
               <button class="hub-act" data-hubstbc title="${t("匯入 STB Camera 的場勘包／自建分鏡包——照片按 cut 對位")}">${t("匯入 STBC 項目…")}</button>`
            : `<button class="hub-act" data-hubopen>${t("開啟舊專案…")}</button>
               <button class="hub-act" data-hubstb title="${t("開啟收到的 .stb 分鏡包（解開成專案）")}">${t("匯入分鏡…")}</button>
               <button class="hub-act" data-hubstbc title="${t("匯入 STB Camera 的場勘包／自建分鏡包——照片按 cut 對位")}">${t("匯入 STBC 項目…")}</button>`}
          <span class="spacer"></span>
          <button class="hub-close" aria-label="${t("關閉")}">✕</button>
        </div>
        <div class="hub-body">
          <div class="hub-h">${mobile ? t("案子") : t("最近案子")}</div>
          <div class="hub-empty">${t("載入中…")}</div>
        </div>
        <div class="hub-foot">${mobile
          ? t("案子放在「檔案」App ▸ 我的 iPad ▸ <b>STB</b>，一案一資料夾。備份／改名／刪除請在檔案 App 對<b>整個資料夾</b>操作。收到別人傳的 <b>.stb 打包案子</b>：存進同一個 STB 資料夾，回這裡點一下即解開。")
          : t("案子＝一個資料夾（project.json＋assets 影片素材）。<b>請勿單獨移動或刪除資料夾內的檔案</b>；備份＝複製整個資料夾。要傳給別人＝「匯出…」→ 打包案子（.stb 單檔）。")}</div>
      </div>`;
    void fillRows();
  }

  async function fillRows() {
    const entries = actions.list ? await actions.list().catch(() => [] as RecentEntry[]) : recentProjects();
    const body = overlay.querySelector(".hub-body");
    if (!body) return; // 已關閉
    body.innerHTML = `<div class="hub-h">${mobile ? t("案子") : t("最近案子")}</div>` +
      (rowsHtml(entries) || `<div class="hub-empty">${mobile ? t("還沒有案子——按「＋ 新增案子」開始。") : t("還沒有案子——按「＋ 新增案子」開始，或開啟既有的案子資料夾。")}</div>`);
  }
  render();

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }
  document.addEventListener("keydown", onKey, true);

  overlay.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    if (el.closest(".hub-close") || el === overlay) { close(); return; }
    const nw = el.closest("[data-hubnew]") as HTMLElement | null;
    if (nw) { void actions.onCreate(nw.dataset.hubnew as "ppm" | "schedule").then((ok) => { if (ok) close(); }); return; }
    if (el.closest("[data-hubopen]")) { void actions.onOpenOther().then((ok) => { if (ok) close(); }); return; }
    if (el.closest("[data-hubimport]")) { void actions.onImportPacked?.().then((ok) => { if (ok) close(); else void fillRows(); }); return; }
    if (el.closest("[data-hubstb]")) { void actions.onOpenStbFile?.().then((ok) => { if (ok) close(); }); return; }
    if (el.closest("[data-hubstbc]")) { close(); actions.onImportSTBC?.(); return; }
    const forget = el.closest("[data-forget]") as HTMLElement | null;
    if (forget) { removeRecent(forget.dataset.forget!); void fillRows(); return; }
    const row = el.closest(".hub-row") as HTMLElement | null;
    if (row?.dataset.packed && actions.onOpenPacked) {
      void actions.onOpenPacked(row.dataset.dir!).then((ok) => {
        if (ok) { close(); return; }
        void fillRows();
      });
      return;
    }
    if (row) {
      void actions.onOpenDir(row.dataset.dir!).then((ok) => {
        if (ok) { close(); return; }
        if (mobile) {
          alert(t("開不了這個案子——資料夾可能在檔案 App 被移動或刪除了。"));
        } else {
          alert(t("開不了這個案子——資料夾可能被移動或刪除了。已從清單移除。"));
          removeRecent(row.dataset.dir!);
        }
        void fillRows();
      });
    }
  });
}

function fmtDate(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
