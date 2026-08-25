import raw from "./luren-logo.svg?raw";
import type { Project } from "./model";

// 首頁 LOGO：預設＝錄人 logo（內建資產）；案子可換（meta.logo 存 data URL，
// 建議透明 PNG——不過裁切器，維持透明度）。null＝用預設。

export const DEFAULT_LOGO: string =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw);

export function projectLogo(p: Project): string {
  return p.meta.logo || DEFAULT_LOGO;
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
