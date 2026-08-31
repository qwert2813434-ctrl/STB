// iPad 取名對話框：iOS 沒有「存檔對話框」（Mac 靠它輸入案名建資料夾），
// 「案名＝資料夾名」的規則不變，改由 App 內輸入框完成。
import { t } from "./i18n";
import { ASPECTS, type Aspect } from "./model";
export function askName(title: string, def: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "nd-overlay";
    overlay.innerHTML = `
      <div class="nd-panel">
        <div class="nd-title">${esc(title)}</div>
        <input class="nd-input" type="text" value="${esc(def)}" autocapitalize="off" autocomplete="off" spellcheck="false">
        <div class="nd-actions">
          <button class="nd-cancel">${t("取消")}</button>
          <button class="nd-ok">${t("確定")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector(".nd-input") as HTMLInputElement;
    const done = (v: string | null) => { overlay.remove(); resolve(v); };
    const ok = () => {
      // 檔名不能帶的符號直接換掉（與匯出檔名同一套規則）
      const v = input.value.replace(/[\/:*?"<>|]/g, "-").trim();
      if (!v) { input.focus(); return; }
      done(v);
    };
    overlay.querySelector(".nd-ok")!.addEventListener("click", ok);
    overlay.querySelector(".nd-cancel")!.addEventListener("click", () => done(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) done(null); });
    input.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 中文輸入法選字中，Enter＝選字
      if (e.key === "Enter") { e.preventDefault(); ok(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); }
    });
    input.focus();
    input.select();
  });
}

// 新建案分鏡比例。選項全部從 model.ts 的 ASPECTS 表長出來——
// 加一個比例＝只改那張表，這裡不用動（2026-08-30 加 4:3 時把三份硬寫的複本收掉）。
// 回傳 null＝取消整個新建流程（與 askName 一致）。
export function askAspect(): Promise<Aspect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "nd-overlay";
    // 縮圖框：長邊固定 60px，短邊按 ar 算——不再為每個比例寫一條 CSS class
    const choices = (Object.entries(ASPECTS) as [Aspect, (typeof ASPECTS)[Aspect]][])
      .map(([key, spec]) => {
        const w = spec.ar >= 1 ? 60 : Math.round(60 * spec.ar);
        const h = spec.ar >= 1 ? Math.round(60 / spec.ar) : 60;
        return `<button class="asp-choice" data-asp="${key}">
            <span class="asp-frame" style="--aw:${w}px;--ah:${h}px"></span>
            <span class="asp-label">${esc(t(spec.label))}</span>
            <span class="asp-hint">${esc(t(spec.hint))}</span>
          </button>`;
      }).join("");
    overlay.innerHTML = `
      <div class="nd-panel">
        <div class="nd-title">${t("分鏡比例")}</div>
        <div class="nd-sub">${t("整片的分鏡格方向，之後所有分鏡都照這個比例。")}</div>
        <div class="asp-choices">${choices}</div>
        <div class="nd-actions">
          <button class="nd-cancel">${t("取消")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (v: Aspect | null) => { overlay.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
    overlay.addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      const choice = el.closest("[data-asp]") as HTMLElement | null;
      if (choice) { done(choice.dataset.asp as Aspect); return; }
      if (el.closest(".nd-cancel") || el === overlay) done(null);
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); }
    }
    document.addEventListener("keydown", onKey, true);
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
