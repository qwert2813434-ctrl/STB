import type { Project } from "./model";

// 首頁 LOGO 三層：案子自己的 `meta.logo` → 使用者的「預設 LOGO」（本機設定）→ 空的虛線框。
//
// 🔴 2026-09-01：內建預設本來是錄人 logo，等於**每個使用者的封面、簡報第一頁、
//    匯出的 PPTX／PDF 都印著別人公司的商標**。改成使用者自己在「關於」裡放一次，
//    存本機（不進 project.json，換案子不會被帶走）。錄人那份 svg 已移出 App，
//    在 `STB/行銷素材/錄人 logo.svg`——Armin 自己選一次就回到原本的樣子。

const KEY = "stbDefaultLogo";

// 沒有任何 logo 時的佔位：中性虛線框，點下去就是既有的「替換 LOGO」流程。
// 純幾何、不含文字＝不用翻譯，深淺色主題下都看得見。
const PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">` +
      `<rect x="6" y="6" width="188" height="108" rx="10" fill="none" ` +
      `stroke="#b9b4a6" stroke-width="2" stroke-dasharray="7 6"/>` +
      `<path d="M62 78l22-26 16 19 12-13 26 20z" fill="#d8d3c4"/>` +
      `<circle cx="72" cy="48" r="7" fill="#d8d3c4"/></svg>`,
  );

/** 使用者的預設 LOGO（本機設定，跨案子沿用）。沒設過＝null。 */
export function userDefaultLogo(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setUserDefaultLogo(v: string | null): void {
  try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* 私密瀏覽 */ }
}

export function projectLogo(p: Project): string {
  return p.meta.logo || userDefaultLogo() || PLACEHOLDER;
}

// LOGO 轉透明 PNG（canvas 光柵化）：
// html2canvas 對 SVG 圖縮放不可靠（會照原生尺寸畫→截圖只剩一角）、
// PowerPoint/jsPDF 對 SVG 支援不一——進匯出管線前先轉 PNG 最穩。
// whiten＝深色版面用：把不透明像素全塗白（source-in 保留 alpha）。
// 不能靠 CSS 的 brightness(0) invert(1)——html2canvas 1.4.1 不支援 CSS filter，
// 截圖時 filter 整條被無視，深色首頁的 logo 會黑上黑隱形（簡報模式是活 DOM 所以沒事）。
export function rasterLogo(src: string, whiten = false): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || 800, ih = img.naturalHeight || 800;
        const scale = 1200 / Math.max(iw, ih);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(iw * scale));
        c.height = Math.max(1, Math.round(ih * scale));
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0, c.width, c.height);
        if (whiten) { g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
        const data = c.toDataURL("image/png");
        c.width = c.height = 0; // iOS：畫布用完立刻釋放
        resolve({ data, w: iw, h: ih });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
