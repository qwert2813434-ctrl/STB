import type { Store } from "./store";
import { computeCutNumbers } from "./model";

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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = [...(input.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const out: string[] = [];
      const cloudy: string[] = [];  // iCloud 原檔還沒下載（空殼檔）——舊照片常見
      const failed: string[] = [];  // 真正解碼失敗
      for (const f of files) {
        if (f.size === 0) { cloudy.push(f.name); continue; }
        const board = await fileToBoard(f);
        if (board) out.push(board);
        else failed.push(f.name);
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
        msg += `\n⚠️ ${failed.length} 張這次沒讀成：\n${failed.join("\n")}\n\n${cloudy.length ? "同上，等幾秒重選。" : retryHint}`;
      }
      if (msg) alert(msg);
      resolve(out);
    };
    input.click();
  });
}

// 單檔 → 1280×720 cover 置中的分鏡圖。
// 首選 createImageBitmap＋resize：WebKit 邊解碼邊縮圖——手機原檔（HEIC、
// 48MP）不會撐爆 WebView 記憶體/解碼上限（iPad 實測「部分照片永遠失敗」的根因）；
// 舊環境退回 FileReader＋<img> 路徑。
async function fileToBoard(f: File): Promise<string | null> {
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(f, { resizeWidth: 1920, resizeQuality: "high" });
  } catch {
    try { bmp = await createImageBitmap(f); } catch { bmp = null; }
  }
  const draw = (w: number, h: number, src: CanvasImageSource): string => {
    const c = document.createElement("canvas");
    c.width = 1280; c.height = 720;
    const ctx = c.getContext("2d")!;
    const k = Math.max(1280 / w, 720 / h); // cover 置中
    ctx.drawImage(src, (1280 - w * k) / 2, (720 - h * k) / 2, w * k, h * k);
    return c.toDataURL("image/jpeg", 0.85);
  };
  if (bmp) {
    const dataUrl = draw(bmp.width, bmp.height, bmp);
    bmp.close();
    return dataUrl;
  }
  // 備援：FileReader → <img>
  const url = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });
  const img = await new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
  if (!img) return null;
  return draw(img.naturalWidth, img.naturalHeight, img);
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
