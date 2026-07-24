// 更新提醒（使用者回饋：離線 App 沒人知道出新版了）。
// 做法刻意輕：開 App 時抓一份小 JSON 比版本，有新版才浮一條橫幅＋下載連結。
// 不自動下載安裝（那要 Tauri updater＋簽章 manifest，工大很多）。
// 離線／抓不到／JSON 壞掉＝安靜跳過，絕不打擾——這是離線 App 的底線。
// 來源＝小高工具間（GitHub Pages 回 access-control-allow-origin: *，webview 直接 fetch 得到）。
import { APP_VERSION } from "./releaseNotes";
import { isMobile, isTauri, openExternal } from "./persistence";

const FEED = "https://qwert2813434-ctrl.github.io/tools/stb-latest.json";
const SKIP_KEY = "stbSkipVersion"; // 使用者按「這版不用提醒」記在這

interface Feed { version?: string; url?: string; notes?: string }

// 純數字比較（1.10.0 > 1.9.0），不引語意化版本套件
function isNewer(remote: string, local: string): boolean {
  const a = remote.split(".").map((n) => parseInt(n, 10) || 0);
  const b = local.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function checkUpdate(): Promise<void> {
  // iPad 版走 App Store，系統本來就會提醒更新——只有 Mac 自行發佈版需要這條
  if (!isTauri() || isMobile()) return;
  try {
    const r = await fetch(FEED, { cache: "no-store" });
    if (!r.ok) return;
    const d = (await r.json()) as Feed;
    if (!d.version || !isNewer(d.version, APP_VERSION)) return;
    if (localStorage.getItem(SKIP_KEY) === d.version) return;
    showBanner(d.version, d.url || "https://github.com/qwert2813434-ctrl/STB/releases", d.notes || "");
  } catch {
    /* 離線或網路不通：安靜跳過 */
  }
}

function showBanner(version: string, url: string, notes: string) {
  const el = document.createElement("div");
  el.className = "upd-bar";
  el.innerHTML = `
    <span class="upd-dot"></span>
    <span class="upd-txt"><b>有新版 ${version}</b>${notes ? `　${notes}` : ""}</span>
    <button class="upd-go">前往下載</button>
    <button class="upd-skip" title="這個版本不再提醒">略過</button>
    <button class="upd-x" aria-label="關閉">✕</button>`;
  document.body.appendChild(el);
  el.querySelector(".upd-go")!.addEventListener("click", () => { openExternal(url); el.remove(); });
  el.querySelector(".upd-skip")!.addEventListener("click", () => { localStorage.setItem(SKIP_KEY, version); el.remove(); });
  el.querySelector(".upd-x")!.addEventListener("click", () => el.remove());
}
