// iPad 取名對話框：iOS 沒有「存檔對話框」（Mac 靠它輸入案名建資料夾），
// 「案名＝資料夾名」的規則不變，改由 App 內輸入框完成。
import { t } from "./i18n";
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

// 新建案分鏡比例：橫式 16:9（預設）／直式 9:16。整片一次定案，之後全章跟著走。
// 回傳 null＝取消整個新建流程（與 askName 一致）。
export function askAspect(): Promise<"16:9" | "9:16" | "3:2" | "21:9" | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "nd-overlay";
    overlay.innerHTML = `
      <div class="nd-panel">
        <div class="nd-title">${t("分鏡比例")}</div>
        <div class="nd-sub">${t("整片的分鏡格方向，之後所有分鏡都照這個比例。")}</div>
        <div class="asp-choices">
          <button class="asp-choice" data-asp="16:9">
            <span class="asp-frame land"></span>
            <span class="asp-label">${t("橫式 16:9")}</span>
            <span class="asp-hint">${t("一般影片・簡報")}</span>
          </button>
          <button class="asp-choice" data-asp="3:2">
            <span class="asp-frame land32"></span>
            <span class="asp-label">${t("全幅 3:2")}</span>
            <span class="asp-hint">${t("平面・相機原生")}</span>
          </button>
          <button class="asp-choice" data-asp="21:9">
            <span class="asp-frame land219"></span>
            <span class="asp-label">${t("寬銀幕 21:9")}</span>
            <span class="asp-hint">${t("電影感・Scope")}</span>
          </button>
          <button class="asp-choice" data-asp="9:16">
            <span class="asp-frame port"></span>
            <span class="asp-label">${t("直式 9:16")}</span>
            <span class="asp-hint">${t("Reels・限動・直式廣告")}</span>
          </button>
        </div>
        <div class="nd-actions">
          <button class="nd-cancel">${t("取消")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (v: "16:9" | "9:16" | "3:2" | "21:9" | null) => { overlay.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
    overlay.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const choice = t.closest("[data-asp]") as HTMLElement | null;
      if (choice) { done(choice.dataset.asp as "16:9" | "9:16" | "3:2" | "21:9"); return; }
      if (t.closest(".nd-cancel") || t === overlay) done(null);
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
