import { recentProjects, removeRecent, currentDir, type RecentEntry } from "./persistence";

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
  onOpenSample: () => boolean;        // 看內建示範案（不落地、不影響真案子）
  list?: () => Promise<RecentEntry[]>; // iPad：掃真實資料夾當清單來源
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
      <div class="hub-row" data-dir="${esc(r.dir)}">
        <div class="hub-rmain">
          <div class="hub-rtitle">${esc(r.title || "未命名案子")}${r.dir === cur ? `<span class="hub-rnow">目前</span>` : ""}</div>
          <div class="hub-rpath">${esc(mobile ? `檔案 App ▸ STB ▸ ${r.dir.split("/").pop() || ""}` : r.dir)}</div>
        </div>
        <span class="hub-rdate">${fmtDate(r.at)}</span>
        ${mobile ? "" : `<button class="hub-rx" data-forget="${esc(r.dir)}" title="從清單移除（不會刪除案子本身）">✕</button>`}
      </div>`).join("");
  }

  function render() {
    overlay.innerHTML = `
      <div class="hub-panel">
        <div class="hub-head">
          <span class="hub-title">專案</span>
          <button class="hub-act" data-hubnew="ppm">＋ 新增案子</button>
          <button class="hub-act" data-hubnew="schedule" title="製片版：分鏡整理＋甘特／通告單／Rundown 的輕量排表案；隨時可展開成完整 PPM">＋ 通告排表</button>
          ${mobile ? "" : `<button class="hub-act" data-hubopen>開啟其他案子…</button>`}
          <button class="hub-act" data-hubsample title="內建示範案，看版面與玩法用；不會動到你的案子">示範案</button>
          <span class="spacer"></span>
          <button class="hub-close" aria-label="關閉">✕</button>
        </div>
        <div class="hub-body">
          <div class="hub-h">${mobile ? "案子" : "最近案子"}</div>
          <div class="hub-empty">載入中…</div>
        </div>
        <div class="hub-foot">${mobile
          ? `案子放在「檔案」App ▸ 我的 iPad ▸ <b>STB</b>，一案一資料夾。備份／改名／刪除請在檔案 App 對<b>整個資料夾</b>操作，勿單獨動資料夾內的檔案。`
          : `案子＝一個資料夾（project.json＋assets 影片素材）。<b>請勿單獨移動或刪除資料夾內的檔案</b>，影片是用連結掛進案子的；備份＝複製整個資料夾。`}</div>
      </div>`;
    void fillRows();
  }

  async function fillRows() {
    const entries = actions.list ? await actions.list().catch(() => [] as RecentEntry[]) : recentProjects();
    const body = overlay.querySelector(".hub-body");
    if (!body) return; // 已關閉
    body.innerHTML = `<div class="hub-h">${mobile ? "案子" : "最近案子"}</div>` +
      (rowsHtml(entries) || `<div class="hub-empty">還沒有案子——按「＋ 新增案子」開始${mobile ? "" : "，或開啟既有的案子資料夾"}。</div>`);
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
    const t = e.target as HTMLElement;
    if (t.closest(".hub-close") || t === overlay) { close(); return; }
    const nw = t.closest("[data-hubnew]") as HTMLElement | null;
    if (nw) { void actions.onCreate(nw.dataset.hubnew as "ppm" | "schedule").then((ok) => { if (ok) close(); }); return; }
    if (t.closest("[data-hubopen]")) { void actions.onOpenOther().then((ok) => { if (ok) close(); }); return; }
    if (t.closest("[data-hubsample]")) { if (actions.onOpenSample()) close(); return; }
    const forget = t.closest("[data-forget]") as HTMLElement | null;
    if (forget) { removeRecent(forget.dataset.forget!); void fillRows(); return; }
    const row = t.closest(".hub-row") as HTMLElement | null;
    if (row) {
      void actions.onOpenDir(row.dataset.dir!).then((ok) => {
        if (ok) { close(); return; }
        if (mobile) {
          alert("開不了這個案子——資料夾可能在檔案 App 被移動或刪除了。");
        } else {
          alert("開不了這個案子——資料夾可能被移動或刪除了。已從清單移除。");
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
