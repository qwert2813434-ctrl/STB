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
export function rasterLogo(src: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || 800, ih = img.naturalHeight || 800;
        const scale = 1200 / Math.max(iw, ih);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(iw * scale));
        c.height = Math.max(1, Math.round(ih * scale));
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve({ data: c.toDataURL("image/png"), w: iw, h: ih });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
