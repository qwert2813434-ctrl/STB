import type { Store } from "./store";
import { chainRundown, hhmmToMin, minToHHMM } from "./model";

// 「指派到時段」（＝設定場次）：分鏡章多選 cut 後，挑一個 Rundown 時段
// 反向指派——製片先把卡片整理好，再一批一批分到場次，不用進 Rundown 一個個勾。
export function openBlockPicker(store: Store): Promise<string | null> {
  return new Promise((resolve) => {
    const p = store.get();
    const overlay = document.createElement("div");
    overlay.className = "cutpick-overlay";

    let body = "";
    p.days.forEach((d, di) => {
      const times = chainRundown(d.rundown, hhmmToMin(d.callTime));
      body += `<div class="bp-day">Day ${di + 1}${d.date ? ` · ${d.date}` : ""}</div>`;
      body += d.rundown.map((b, bi) => `
        <button class="bp-row" data-bp="${b.id}">
          <span class="bp-time">${minToHHMM(times[bi].start)}–${minToHHMM(times[bi].end)}</span>
          <span class="bp-type">${b.type}</span>
          <span class="bp-title">${esc(b.title || "（未命名時段）")}</span>
          ${b.cutIds.length ? `<span class="bp-count">${b.cutIds.length} 顆</span>` : ""}
        </button>`).join("") || `<div class="cp-empty">這天還沒有時段——先到 Rundown 新增時段。</div>`;
    });

    overlay.innerHTML = `
      <div class="cutpick-card">
        <div class="cp-head">指派到時段 — 這批 cut 要在哪個場次拍</div>
        <div class="bp-list">${body}</div>
        <div class="cp-bar"><span class="spacer"></span><button class="cp-cancel">取消</button></div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (result: string | null) => { overlay.remove(); resolve(result); };
    overlay.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest("[data-bp]") as HTMLElement | null;
      if (row) { close(row.dataset.bp!); return; }
      if (t.closest(".cp-cancel") || t === overlay) close(null);
    });
  });
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
