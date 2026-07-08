import type { Store } from "./store";
import { computeCutNumbers } from "./model";

// cut 對照選擇器：列出所有分鏡縮圖＋編號，勾選要對照的 cut，確定回傳 id 陣列。
// 用於 REF 項目的「對照 cutXX–cutYY」——表明某參考招式/動態對應哪幾顆 cut。
export function openCutPicker(store: Store, selected: string[]): Promise<string[] | null> {
  return new Promise((resolve) => {
    const p = store.get();
    const numbers = computeCutNumbers(p.cuts);
    const chosen = new Set(selected);

    const overlay = document.createElement("div");
    overlay.className = "cutpick-overlay";
    const grid = p.cuts.map((c) => {
      const n = numbers.get(c.id)!;
      const on = chosen.has(c.id) ? " on" : "";
      return `<button class="cp-cell${on}" data-cp="${c.id}">
        <span class="cp-no">CUT ${n.label}</span>
        <span class="cp-thumb">${c.imageRef ? `<img src="${c.imageRef}" alt="">` : "16:9"}</span>
        <span class="cp-desc">${esc(c.desc || "")}</span>
      </button>`;
    }).join("");
    overlay.innerHTML = `
      <div class="cutpick-card">
        <div class="cp-head">對照分鏡 — 勾選這個參考對應的 cut</div>
        <div class="cp-grid">${grid}</div>
        <div class="cp-bar">
          <button class="cp-clear">清除</button>
          <span class="spacer"></span>
          <button class="cp-cancel">取消</button>
          <button class="cp-ok">確定</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector(".cp-grid")!.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-cp]") as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.cp!;
      if (chosen.has(id)) { chosen.delete(id); btn.classList.remove("on"); }
      else { chosen.add(id); btn.classList.add("on"); }
    });

    const close = (result: string[] | null) => { overlay.remove(); resolve(result); };
    (overlay.querySelector(".cp-clear") as HTMLElement).addEventListener("click", () => {
      chosen.clear();
      overlay.querySelectorAll(".cp-cell.on").forEach((el) => el.classList.remove("on"));
    });
    (overlay.querySelector(".cp-cancel") as HTMLElement).addEventListener("click", () => close(null));
    (overlay.querySelector(".cp-ok") as HTMLElement).addEventListener("click", () => {
      // 依分鏡順序回傳（讓範圍顯示正確）
      close(p.cuts.filter((c) => chosen.has(c.id)).map((c) => c.id));
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
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
