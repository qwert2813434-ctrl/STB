// 共用圖片編輯器：裁切（拖曳定位）＋區塊內縮放（滑桿）＋一鍵黑白＋換一張圖。
// 固定比例取景框（16:9 或 9:16），套用時用 canvas 輸出。
// 沿用 ALIGN 教訓：等比例置中起始、位移夾限（圖永遠蓋滿框）、無效值防呆。

interface CropOpts { bw?: boolean; allowReplace?: boolean }

export function openCropper(dataUrl: string, aspect: number, opts?: CropOpts): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) { resolve(dataUrl); return; }
      mount(img, dataUrl, aspect, resolve, opts ?? {});
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function mount(img0: HTMLImageElement, dataUrl0: string, aspect: number, resolve: (v: string | null) => void, opts: CropOpts) {
  // 取景框尺寸：橫式 640 寬、直式 400 高度上限
  const vw = aspect >= 1 ? 640 : Math.round(520 * aspect);
  const vh = Math.round(vw / aspect);

  let img = img0;                 // 目前的來源圖（換圖時替換）
  let iw = img.naturalWidth, ih = img.naturalHeight;
  let baseScale = Math.max(vw / iw, vh / ih);
  let zoom = 1;                   // 1..4（乘在 baseScale 上）
  let tx = (vw - iw * baseScale) / 2;
  let ty = (vh - ih * baseScale) / 2;
  let bw = opts.bw ?? false;

  const overlay = document.createElement("div");
  overlay.className = "crop-overlay";
  overlay.innerHTML = `
    <div class="crop-card">
      <div class="crop-stage" style="width:${vw}px;height:${vh}px">
        <img src="${dataUrl0}" alt="" draggable="false">
      </div>
      <div class="crop-bar">
        <span class="crop-hint">拖曳定位・滑桿縮放</span>
        <input type="range" min="100" max="400" value="100" class="crop-zoom">
        <button class="crop-bw${bw ? " on" : ""}">黑白</button>
        ${opts.allowReplace ? `<button class="crop-replace">換一張圖</button>` : ""}
        <button class="crop-cancel">取消</button>
        <button class="crop-apply">套用</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector(".crop-stage") as HTMLElement;
  const imgEl = stage.querySelector("img") as HTMLImageElement;
  const zoomEl = overlay.querySelector(".crop-zoom") as HTMLInputElement;
  const bwBtn = overlay.querySelector(".crop-bw") as HTMLButtonElement;

  function clampAndPaint() {
    const s = baseScale * zoom;
    const w = iw * s, h = ih * s;
    tx = Math.min(0, Math.max(vw - w, tx));
    ty = Math.min(0, Math.max(vh - h, ty));
    imgEl.style.transform = `translate(${tx}px, ${ty}px)`;
    imgEl.style.width = `${w}px`;
    imgEl.style.height = `${h}px`;
    imgEl.style.filter = bw ? "grayscale(1)" : "";
  }
  clampAndPaint();

  let dragging = false, lx = 0, ly = 0;
  stage.addEventListener("pointerdown", (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tx += e.clientX - lx; ty += e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    clampAndPaint();
  });
  stage.addEventListener("pointerup", () => { dragging = false; });

  zoomEl.addEventListener("input", () => {
    const prev = baseScale * zoom;
    zoom = Number(zoomEl.value) / 100;
    const next = baseScale * zoom;
    tx = vw / 2 - ((vw / 2 - tx) / prev) * next; // 以框中心為錨縮放
    ty = vh / 2 - ((vh / 2 - ty) / prev) * next;
    clampAndPaint();
  });

  bwBtn.addEventListener("click", () => {
    bw = !bw;
    bwBtn.classList.toggle("on", bw);
    clampAndPaint();
  });

  // 換一張圖：重新選檔 → 重置取景（同一編輯器內完成）
  if (opts.allowReplace) {
    (overlay.querySelector(".crop-replace") as HTMLElement).addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const nimg = new Image();
          nimg.onload = () => {
            if (!nimg.naturalWidth) return;
            img = nimg;
            iw = nimg.naturalWidth; ih = nimg.naturalHeight;
            baseScale = Math.max(vw / iw, vh / ih);
            zoom = 1; zoomEl.value = "100";
            tx = (vw - iw * baseScale) / 2;
            ty = (vh - ih * baseScale) / 2;
            imgEl.src = r.result as string;
            clampAndPaint();
          };
          nimg.src = r.result as string;
        };
        r.readAsDataURL(f);
      };
      input.click();
    });
  }

  function close(result: string | null) {
    overlay.remove();
    resolve(result);
  }
  (overlay.querySelector(".crop-cancel") as HTMLElement).addEventListener("click", () => close(null));
  (overlay.querySelector(".crop-apply") as HTMLElement).addEventListener("click", () => {
    const s = baseScale * zoom;
    const outW = aspect >= 1 ? 1600 : 900;
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    const sx = -tx / s, sy = -ty / s, sw = vw / s, sh = vh / s;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    if (bw) toGray(ctx, outW, outH); // 手動灰階（WKWebView 的 ctx.filter 不可靠）
    close(canvas.toDataURL("image/jpeg", 0.9));
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
}

// 逐像素轉灰階（Rec.601 亮度加權）
function toGray(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
}
