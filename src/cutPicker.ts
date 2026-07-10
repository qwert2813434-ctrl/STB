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
      const numbers = computeCutNumbers(p.cuts);
      gridEl.innerHTML = p.cuts.map((c) => {
        const n = numbers.get(c.id)!;
        const on = chosen.has(c.id) ? " on" : "";
        return `<button class="cp-cell${on}" data-cp="${c.id}">
          <span class="cp-no">CUT ${n.label}</span>
          <span class="cp-thumb">${c.imageRef ? `<img src="${c.imageRef}" alt="">` : "16:9"}</span>
          <span class="cp-desc">${esc(c.desc || "")}</span>
        </button>`;
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
      for (const f of files) {
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
        if (!img) continue;
        const c = document.createElement("canvas");
        c.width = 1280; c.height = 720;
        const ctx = c.getContext("2d")!;
        const k = Math.max(1280 / img.naturalWidth, 720 / img.naturalHeight); // cover 置中
        const w = img.naturalWidth * k, h = img.naturalHeight * k;
        ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);
        out.push(c.toDataURL("image/jpeg", 0.85));
      }
      resolve(out);
    };
    input.click();
  });
}

// 對照 cut 的顯示標籤：連續段落用範圍（CUT 03–05），跳號用逗號
export function cutRefLabel(store: Store, cutIds: string[]): string {
  if (!cutIds.length) return "";
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts);
  const labels = p.cuts.filter((c) => cutIds.includes(c.id)).map((c) => numbers.get(c.id)!.label);
  if (labels.length <= 2) return labels.map((l) => "CUT " + l).join("、");
  return `CUT ${labels[0]}–${labels[labels.length - 1]}`;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
