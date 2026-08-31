import helpHtml from "./help.html?raw";
import helpHtmlEn from "./help.en.html?raw";
import helpHtmlJa from "./help.ja.html?raw";
import { APP_VERSION, RELEASE_NOTES } from "./releaseNotes";
import { openExternal } from "./persistence";
import { locale, setLocale, t, type Locale } from "./i18n";
import { userDefaultLogo, setUserDefaultLogo } from "./logoAsset";

// 說明視窗：工具列「?」開啟。兩個分頁——
// 「使用說明」＝內嵌 行銷素材/PPM_使用說明.html（同套米白視覺，iframe srcdoc）；
// 「關於與更新」＝版本號＋更新紀錄（releaseNotes.ts，發版時同步更新）。

const GITHUB_URL = "https://github.com/qwert2813434-ctrl/STB";

export function openHelp() {
  if (document.querySelector(".help-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "help-overlay";
  overlay.innerHTML = `
    <div class="help-panel">
      <div class="help-head">
        <span class="help-title">STB</span>
        <span class="help-ver">v${APP_VERSION}</span>
        <span class="help-tabs">
          <button class="help-tab on" data-htab="guide">${t("使用說明")}</button>
          <button class="help-tab" data-htab="about">${t("關於與更新")}</button>
        </span>
        <span class="spacer"></span>
        <button class="help-close" aria-label="${t("關閉")}">✕</button>
      </div>
      <div class="help-body">
        <iframe class="help-frame" title="${t("使用說明")}"></iframe>
        <div class="help-about" style="display:none">
          <p class="help-lede">${t("STB — 為腳本與前製會議而生的 Mac App。<br>資料全在本機：一個案子＝一個資料夾＋一份 project.json，無帳號、無雲端。")}</p>
          <p><button class="help-link" data-hgithub>${t("原始碼與最新版下載（GitHub）↗")}</button></p>
          <p class="help-langrow"><span class="help-langk">${t("預設 LOGO")}</span>
            <img class="help-logo" src="${userDefaultLogo() ?? ""}"${userDefaultLogo() ? "" : " hidden"} alt="">
            <button class="help-lang" data-hlogo>${t("選擇圖片…")}</button>
            <button class="help-lang" data-hlogoclear${userDefaultLogo() ? "" : " hidden"}>${t("清除")}</button>
            <span class="help-loghint">${t("新案子的封面會用這張；個別案子仍可自己換")}</span>
          </p>
          <p class="help-langrow"><span class="help-langk">語言 · Language</span>
            ${(["zh", "en", "ja"] as const).map((l) => `
              <button class="help-lang${locale() === l ? " on" : ""}" data-hlang="${l}">${{ zh: "繁體中文", en: "English", ja: "日本語" }[l]}</button>`).join("")}
          </p>
          ${RELEASE_NOTES.map((r) => `
            <div class="help-rel">
              <div class="help-relh"><b>v${r.version}</b><span>${r.date}</span></div>
              <ul>${r.items.map((it) => `<li>${t(it)}</li>`).join("")}</ul>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // 使用說明：srcdoc 內嵌（自帶完整樣式，不吃 app 的 CSS）
  (overlay.querySelector(".help-frame") as HTMLIFrameElement).srcdoc =
    { zh: helpHtml, en: helpHtmlEn, ja: helpHtmlJa }[locale()];

  const frame = overlay.querySelector(".help-frame") as HTMLElement;
  const about = overlay.querySelector(".help-about") as HTMLElement;

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }
  document.addEventListener("keydown", onKey, true);

  // 換完就地更新這一列，並敲一下主畫面重畫封面（不用關掉視窗再開）
  function syncLogoRow() {
    const v = userDefaultLogo();
    const img = overlay.querySelector(".help-logo") as HTMLImageElement | null;
    const clr = overlay.querySelector("[data-hlogoclear]") as HTMLElement | null;
    if (img) { img.src = v ?? ""; img.hidden = !v; }
    if (clr) clr.hidden = !v;
    document.dispatchEvent(new CustomEvent("stb:logo-changed"));
  }

  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".help-close") || t === overlay) { close(); return; }
    if (t.closest("[data-hgithub]")) { openExternal(GITHUB_URL); return; }
    const lg = t.closest("[data-hlang]") as HTMLElement | null;
    if (lg) { setLocale(lg.dataset.hlang as Locale); return; }
    // 預設 LOGO：跟首頁「點擊替換 LOGO」同一套（讀成 data URL，不過裁切器保留透明度）
    if (t.closest("[data-hlogoclear]")) { setUserDefaultLogo(null); syncLogoRow(); return; }
    if (t.closest("[data-hlogo]")) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/svg+xml,image/webp,image/jpeg";
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { setUserDefaultLogo(r.result as string); syncLogoRow(); };
        r.readAsDataURL(f);
      };
      input.click();
      return;
    }
    const tab = t.closest("[data-htab]") as HTMLElement | null;
    if (tab) {
      overlay.querySelectorAll(".help-tab").forEach((el) => el.classList.toggle("on", el === tab));
      const guide = tab.dataset.htab === "guide";
      frame.style.display = guide ? "" : "none";
      about.style.display = guide ? "none" : "";
    }
  });
}
