import helpHtml from "./help.html?raw";
import { APP_VERSION, RELEASE_NOTES } from "./releaseNotes";
import { openExternal } from "./persistence";

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
          <button class="help-tab on" data-htab="guide">使用說明</button>
          <button class="help-tab" data-htab="about">關於與更新</button>
        </span>
        <span class="spacer"></span>
        <button class="help-close" aria-label="關閉">✕</button>
      </div>
      <div class="help-body">
        <iframe class="help-frame" title="使用說明"></iframe>
        <div class="help-about" style="display:none">
          <p class="help-lede">STB — 為腳本與前製會議而生的 Mac App。<br>
          資料全在本機：一個案子＝一個資料夾＋一份 project.json，無帳號、無雲端。</p>
          <p><button class="help-link" data-hgithub>原始碼與最新版下載（GitHub）↗</button></p>
          ${RELEASE_NOTES.map((r) => `
            <div class="help-rel">
              <div class="help-relh"><b>v${r.version}</b><span>${r.date}</span></div>
              <ul>${r.items.map((it) => `<li>${it}</li>`).join("")}</ul>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // 使用說明：srcdoc 內嵌（自帶完整樣式，不吃 app 的 CSS）
  (overlay.querySelector(".help-frame") as HTMLIFrameElement).srcdoc = helpHtml;

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

  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".help-close") || t === overlay) { close(); return; }
    if (t.closest("[data-hgithub]")) { openExternal(GITHUB_URL); return; }
    const tab = t.closest("[data-htab]") as HTMLElement | null;
    if (tab) {
      overlay.querySelectorAll(".help-tab").forEach((el) => el.classList.toggle("on", el === tab));
      const guide = tab.dataset.htab === "guide";
      frame.style.display = guide ? "" : "none";
      about.style.display = guide ? "none" : "";
    }
  });
}
