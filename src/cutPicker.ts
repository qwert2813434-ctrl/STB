import type { Store } from "./store";
import { computeCutNumbers } from "./model";
import { invoke } from "@tauri-apps/api/core";
import { isMobile } from "./persistence";

// cut 對照選擇器：列出所有分鏡縮圖＋編號，勾選要對照的 cut，確定回傳 id 陣列。
// 用於 REF 項目與 Rundown 時段的「對照 cutXX–cutYY」。
// 「＋ 匯入分鏡圖」＝製片情境：腳本是別的軟體做的，把導演給的圖檔（可多選）
// 一次帶進來，每張自動變一顆 cut，馬上就能指派給時段。
export function openCutPicker(store: Store, selected: string[]): Promise<string[] | null> {
  return new Promise((resolve) => {
    const chosen = new Set(selected);

    const overlay = document.createElement("div");
    overlay.className = "cutpick-overlay";
    overlay.innerHTML = `
      <div class="cutpick-card">
        <div class="cp-head">對照分鏡 — 勾選對應的 cut</div>
        <div class="cp-grid"></div>
        <div class="cp-bar">
          <button class="cp-import" title="選其他軟體輸出的分鏡圖檔（可多選），每張自動變成一顆 cut">＋ 匯入分鏡圖</button>
          <button class="cp-clear">清除</button>
          <span class="spacer"></span>
          <button class="cp-cancel">取消</button>
          <button class="cp-ok">確定</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const gridEl = overlay.querySelector(".cp-grid") as HTMLElement;

    function renderGrid() {
      const p = store.get();
      const numbers = computeCutNumbers(p.cuts, p.films);
      const multi = p.films.length > 1;
      const cell = (c: (typeof p.cuts)[number]) => {
        const n = numbers.get(c.id)!;
        const on = chosen.has(c.id) ? " on" : "";
        return `<button class="cp-cell${on}" data-cp="${c.id}">
          <span class="cp-no">CUT ${n.label}</span>
          <span class="cp-thumb">${c.imageRef ? `<img src="${c.imageRef}" alt="">` : "16:9"}</span>
          <span class="cp-desc">${esc(c.desc || "")}</span>
        </button>`;
      };
      // 多路：依路分組列出（路名小標橫跨整列）
      gridEl.innerHTML = p.films.map((f) => {
        const cs = p.cuts.filter((c) => c.filmId === f.id);
        if (!cs.length) return "";
        return (multi ? `<div class="cp-filmh">${esc(f.name)}</div>` : "") + cs.map(cell).join("");
      }).join("") || `<div class="cp-empty">這個案子還沒有分鏡。<br>按左下「＋ 匯入分鏡圖」，把其他軟體輸出的分鏡圖（可多選）一次帶進來。</div>`;
    }
    renderGrid();

    gridEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-cp]") as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.cp!;
      if (chosen.has(id)) { chosen.delete(id); btn.classList.remove("on"); }
      else { chosen.add(id); btn.classList.add("on"); }
    });

    const close = (result: string[] | null) => { overlay.remove(); resolve(result); };
    (overlay.querySelector(".cp-import") as HTMLElement).addEventListener("click", () => {
      void pickBoardImages().then((imgs) => {
        if (!imgs.length) return;
        const ids = store.addCutsFromImages(imgs);
        ids.forEach((id) => chosen.add(id)); // 剛匯入的通常就是要指派的：自動勾選
        renderGrid();
      });
    });
    (overlay.querySelector(".cp-clear") as HTMLElement).addEventListener("click", () => {
      chosen.clear();
      overlay.querySelectorAll(".cp-cell.on").forEach((el) => el.classList.remove("on"));
    });
    (overlay.querySelector(".cp-cancel") as HTMLElement).addEventListener("click", () => close(null));
    (overlay.querySelector(".cp-ok") as HTMLElement).addEventListener("click", () => {
      // 依分鏡順序回傳（讓範圍顯示正確）
      const p = store.get();
      close(p.cuts.filter((c) => chosen.has(c.id)).map((c) => c.id));
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
  });
}

// 批次選外部分鏡圖：依檔名排序（分鏡通常命名 01、02…），
// 自動置中裁 16:9（1280×720；之後點縮圖可用既有圖片編輯器微調）。
// 分鏡章 inspector 的「＋ 匯入分鏡圖」也用這條。
export function pickBoardImages(): Promise<string[]> {
  return new Promise((resolve) => {
    void pickFiles("image/*", true).then(async (picked) => {
      const files = picked.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const out: string[] = [];
      const cloudy: string[] = [];  // iCloud 原檔還沒下載（空殼檔）——舊照片常見
      const failed: string[] = [];  // 真正解碼失敗（附尺寸與原因，遠端除錯用）
      for (const f of files) {
        if (f.size === 0) { cloudy.push(f.name); continue; }
        const r = await fileToBoard(f);
        if (typeof r === "string") out.push(r);
        else failed.push(`${f.name}（${(f.size / 1048576).toFixed(1)}MB${r.dims ? `・${r.dims}` : ""}・${r.why}）`);
        // 呼吸間隔：讓 iOS 有空回收上一張的解碼緩衝（批次 10 張連轟會耗盡）
        await new Promise((r2) => setTimeout(r2, 80));
      }
      // 失敗不再無聲，且分清原因（iPad 實測：iCloud 最佳化儲存＝原檔在雲端，
      // 挑選當下還沒下載完就會拿到空殼——Armin 抓到的根因）
      // 「剛剛的點選」其實已觸發 iCloud 開始下載原檔——教使用者重試節奏，
      // 不依賴任何看不到的下載指示器（挑選介面不顯示下載狀態＝系統限制）
      const retryHint = "剛剛的點選已經讓 iCloud 開始下載這幾張了——\n等個幾秒，再按一次「＋ 匯入分鏡圖」選同樣的照片，通常第二次就會成功。\n（一直失敗的話：設定 → 照片 → 改「下載並保留原始檔」可根治）";
      let msg = "";
      if (cloudy.length) {
        msg += `☁️ ${cloudy.length} 張的原始檔還在 iCloud：\n${cloudy.join("\n")}\n\n${retryHint}\n`;
      }
      if (failed.length) {
        msg += `\n⚠️ ${failed.length} 張讀取失敗（尺寸/格式超過系統上限，全景照與超大圖常見）：\n${failed.join("\n")}\n\n可在「照片」App 裁切或縮小後再加入。`;
      }
      if (msg) alert(msg);
      resolve(out);
    });
  });
}

// 單檔 → 1280×720 cover 置中的分鏡圖。
// 首選 createImageBitmap＋resize：WebKit 邊解碼邊縮圖——手機原檔（HEIC、
// 48MP）不會撐爆 WebView 記憶體/解碼上限（iPad 實測「部分照片永遠失敗」的根因）；
// 舊環境退回 FileReader＋<img> 路徑。
// 統一選檔器：input 要「掛進 DOM＋保持模組引用」——iOS 上懸空的 input
// 會在原生選擇器開著時被 GC 回收 → onchange 永遠不回來（無聲失敗）。
// iPad 實測指紋：逐顆加圖前兩張成功、之後全滅（session 越久 GC 越勤）。
let liveInput: HTMLInputElement | null = null;
export async function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  // iPad：原生 PHPicker——iCloud 原檔由「系統」下載完才交檔（空殼問題根治，
  // 也沒有網頁 input 被 GC 的地雷）。取消＝空清單。失敗才退回網頁 input。
  if (isMobile() && accept.startsWith("image")) {
    const toast = document.createElement("div");
    toast.className = "pv-toast";
    toast.textContent = "正在準備照片…（在 iCloud 的原檔會先下載）";
    toast.addEventListener("click", () => toast.remove()); // 保險絲：萬一等待卡住，點一下就收
    document.body.appendChild(toast);
    try {
      const paths = await invoke<string[]>("pick_photos", { limit: multiple ? 0 : 1 });
      const files: File[] = [];
      for (const p of paths) {
        const buf = await invoke<ArrayBuffer>("read_file", { path: p });
        const name = p.split("/").pop() ?? "photo.jpg";
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const type = ({ heic: "image/heic", heif: "image/heif", png: "image/png", gif: "image/gif", webp: "image/webp" } as Record<string, string>)[ext] ?? "image/jpeg";
        files.push(new File([buf], name, { type }));
      }
      return files;
    } catch (err) {
      console.error("PHPicker 失敗，退回網頁選擇器", err);
    } finally {
      toast.remove();
    }
  }
  return new Promise((resolve) => {
    liveInput?.remove(); // 上一個沒回來的（iOS 取消不觸發事件）先清掉
    const input = document.createElement("input");
    liveInput = input;
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
    document.body.appendChild(input);
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      input.remove();
      if (liveInput === input) liveInput = null;
      resolve(files);
    };
    input.click();
  });
}

// 全 App 共用的一塊工作畫布：iOS 對 canvas 有「總預算」而且回收慢——
// 就算每次用完歸零，連續大量開新畫布仍會耗盡（iPad 實測：批次 10 張第一輪
// 掉 1 張、第二輪全滅）。固定重用同一塊＝預算恆定，永不累積。
let workCanvas: HTMLCanvasElement | null = null;
function getWorkCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!workCanvas) workCanvas = document.createElement("canvas");
  workCanvas.width = w;   // 重設尺寸同時清空內容
  workCanvas.height = h;
  return { c: workCanvas, ctx: workCanvas.getContext("2d")! };
}

// 解碼一張使用者的照片（HEIC/48MP/全景都可能）→ 回傳可畫的來源與尺寸。
// 順序：createImageBitmap＋resize（邊解邊縮最省）→ <img>（WebKit 內建
// 影像快取，同一張重複匯入會命中快取）→ createImageBitmap 原尺寸。
async function decodePhoto(f: File): Promise<{ src: CanvasImageSource; w: number; h: number; cleanup: () => void } | { why: string }> {
  let lastErr = "";
  try {
    const bmp = await createImageBitmap(f, { resizeWidth: 1920, resizeQuality: "high" });
    return { src: bmp, w: bmp.width, h: bmp.height, cleanup: () => bmp.close() };
  } catch (e) { lastErr = String((e as Error)?.message ?? e); }
  const url = URL.createObjectURL(f);
  const img = await new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
  if (img) {
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, cleanup: () => { img.src = ""; URL.revokeObjectURL(url); } };
  }
  URL.revokeObjectURL(url);
  try {
    const bmp = await createImageBitmap(f);
    return { src: bmp, w: bmp.width, h: bmp.height, cleanup: () => bmp.close() };
  } catch (e) { lastErr = String((e as Error)?.message ?? e); }
  return { why: `無法解碼（${lastErr || "格式不支援"}）` };
}

async function fileToBoard(f: File): Promise<string | { why: string; dims?: string }> {
  const d = await decodePhoto(f);
  if ("why" in d) return d;
  try {
    const { ctx } = getWorkCanvas(1280, 720);
    const k = Math.max(1280 / d.w, 720 / d.h); // cover 置中
    ctx.drawImage(d.src, (1280 - d.w * k) / 2, (720 - d.h * k) / 2, d.w * k, d.h * k);
    // iOS 超限來源會「無聲畫成空白」：抽樣中心像素驗證真的有畫上去
    const px = ctx.getImageData(600, 340, 80, 40).data;
    let sum = 0;
    for (let i = 3; i < px.length; i += 4) sum += px[i];
    if (sum === 0) return { why: "超過繪圖上限（畫布為空）", dims: `${d.w}×${d.h}` };
    return workCanvas!.toDataURL("image/jpeg", 0.85);
  } finally {
    d.cleanup();
  }
}

// 單張照片 → 縮小後的「工作圖」（最長邊 maxEdge）——給裁切器用。
// 逐顆 cut 加圖的舊路是把 48MP 原檔整張餵進裁切器（iPad 連加幾顆就把
// 解碼資源吃光＝A路 cut3 後全滅的根因）；統一先縮再裁，裁切體驗不變。
export async function fileToWorkingImage(f: File, maxEdge = 2000): Promise<string | null> {
  if (f.size === 0) return null; // iCloud 空殼
  const d = await decodePhoto(f);
  if ("why" in d) return null;
  try {
    const k = Math.min(1, maxEdge / Math.max(d.w, d.h));
    const w = Math.max(1, Math.round(d.w * k));
    const h = Math.max(1, Math.round(d.h * k));
    const { ctx } = getWorkCanvas(w, h);
    ctx.drawImage(d.src, 0, 0, w, h);
    const px = ctx.getImageData(Math.floor(w / 2) - 8, Math.floor(h / 2) - 8, 16, 16).data;
    let sum = 0;
    for (let i = 3; i < px.length; i += 4) sum += px[i];
    if (sum === 0) return null;
    return workCanvas!.toDataURL("image/jpeg", 0.9);
  } finally {
    d.cleanup();
  }
}

// 對照 cut 的顯示標籤：連續段落用範圍（CUT 03–05），跳號用逗號
export function cutRefLabel(store: Store, cutIds: string[]): string {
  if (!cutIds.length) return "";
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts, p.films);
  const labels = p.cuts.filter((c) => cutIds.includes(c.id)).map((c) => numbers.get(c.id)!.label);
  if (labels.length <= 2) return labels.map((l) => "CUT " + l).join("、");
  return `CUT ${labels[0]}–${labels[labels.length - 1]}`;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
