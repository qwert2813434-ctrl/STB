import { bindEditKeys } from "./editKeys";
import type { Store } from "./store";
import { computeCutNumbers, chainRundown, hhmmToMin, minToHHMM } from "./model";
import { openCutPicker, fileToWorkingImage, pickFiles } from "./cutPicker";
import { openCropper } from "./cropper";

// 渲染 Rundown 拍攝日程頁：真實時間區塊、地點/停車/道具、指派的 cut（顯示編號）。
export function renderRundown(store: Store, root: HTMLElement, dayOverride?: import("./model").ShootDay) {
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts, p.films);
  const day = dayOverride ?? store.currentDay();
  if (!day) { root.innerHTML = ""; return; }
  const times = chainRundown(day.rundown, hhmmToMin(day.callTime));

  let html = `<p class="page-label">Rundown · 拍攝日程 · A5 橫</p><div class="page rundown">`;
  day.rundown.forEach((b, i) => {
    const t = times[i];
    let cutsHtml = "";
    for (const cid of b.cutIds) {
      const n = numbers.get(cid);
      if (!n) continue;
      const cut = p.cuts.find((c) => c.id === cid);
      const box = cut?.imageRef ? `<img src="${cut.imageRef}" alt="" draggable="false">` : "16:9";
      cutsHtml += `<span class="rd-cut"><span class="rd-cut-box">${box}</span><span class="rd-cut-no">${n.label}</span></span>`;
    }
    html += `
      <div class="rd-row" data-block="${b.id}">
        <span class="rd-grip" data-block="${b.id}" title="拖曳排序">⠿</span>
        <div class="rd-time">${minToHHMM(t.start)}–${minToHHMM(t.end)}</div>
        <div class="rd-main">
          <div class="rd-head">
            <span class="rd-type" data-btype="${b.id}" title="點擊切換類型" role="button">${b.type}</span>
            <span class="rd-title cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="title" data-ph="時段名稱">${esc(b.title)}</span>
          </div>
          <div class="rd-cols">
            <div class="rd-col-media">
              ${cutsHtml ? `<div class="rd-cuts">${cutsHtml}</div>` : ""}
              <div class="rd-tools">
                <button class="ref-mini" data-assigncuts="${b.id}"><i>⌗</i> 對照分鏡</button>
                <button class="ref-mini" data-parkimg="${b.id}">＋ 停車圖</button>
              </div>
            </div>
            <div class="rd-col-text">
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">地點</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="loc" data-ph="地點">${esc(b.loc)}</span></span>
              </div>
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">停車</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="park" data-ph="停車資訊">${esc(b.park)}</span></span>
              </div>
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">道具</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="props" data-ph="道具準備">${esc(b.props)}</span></span>
              </div>
              ${b.parkImage ? `<div class="rd-parkrow"><span class="rd-park"><img src="${b.parkImage}" alt="停車位置" data-parkedit="${b.id}" draggable="false"><span class="rd-park-tag">停車</span><button class="rd-park-x" data-parkdel="${b.id}" aria-label="移除停車圖">✕</button></span></div>` : ""}
            </div>
          </div>
        </div>
        <div class="rd-adj">
          <button data-block="${b.id}" data-d="-5" aria-label="減 5 分">−5</button>
          <span class="rd-dur">${b.durMin} 分</span>
          <button data-block="${b.id}" data-d="5" aria-label="加 5 分">+5</button>
          <button class="rd-del" data-del="${b.id}" aria-label="刪除時段">✕</button>
        </div>
      </div>`;
  });
  html += `<div class="rd-addrow"><button data-addblock>＋ 新增時段</button></div>`;
  html += `</div>`;
  root.innerHTML = html;
}

export function bindRundown(store: Store, root: HTMLElement) {
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const adj = t.closest("[data-d]") as HTMLElement | null;
    if (adj) { store.adjustBlockDuration(adj.dataset.block!, Number(adj.dataset.d)); return; }
    const del = t.closest("[data-del]") as HTMLElement | null;
    if (del) { store.deleteBlock(del.dataset.del!); return; }
    const ty = t.closest("[data-btype]") as HTMLElement | null;
    if (ty) { store.cycleBlockType(ty.dataset.btype!); return; }
    // 對照分鏡：cutPicker 多選縮圖 → 指派給時段
    const ac = t.closest("[data-assigncuts]") as HTMLElement | null;
    if (ac) {
      const b = store.currentDay()?.rundown.find((x) => x.id === ac.dataset.assigncuts);
      openCutPicker(store, b?.cutIds ?? []).then((ids) => {
        if (ids) store.setBlockCuts(ac.dataset.assigncuts!, ids);
      });
      return;
    }
    // 停車位置照片：選圖 → 裁 16:9（顯示比分鏡縮圖大約兩倍）
    const pi = t.closest("[data-parkimg]") as HTMLElement | null;
    if (pi) { pickParkImage(store, pi.dataset.parkimg!); return; }
    const pd = t.closest("[data-parkdel]") as HTMLElement | null;
    if (pd) { store.setBlockParkImage(pd.dataset.parkdel!, null); return; }
    // 點既有停車圖 → 編輯器（裁切／縮放／黑白／換圖）
    const pe = t.closest("[data-parkedit]") as HTMLElement | null;
    if (pe) { editParkImage(store, pe.dataset.parkedit!); return; }
    if (t.closest("[data-addblock]")) store.addBlockAfter(null);
  });

  // 區塊文字 inline 編輯：blur 才 commit（打字不重繪）
  root.addEventListener("blur", (e) => {
    const el = e.target as HTMLElement;
    if (!el.isContentEditable || !el.dataset.bitem) return;
    store.editBlockField(el.dataset.bitem!, el.dataset.bf as "title" | "loc" | "park" | "props", (el.textContent || "").trim());
  }, true);
  bindEditKeys(root); // Enter 留在框內（中文選字友善）、Esc 結束輸入

  // 區塊拖曳排序（抓 ⠿ 把手）：自製指標手勢（同 STB，不用 HTML5 DnD），
  // 放開後時間鏈由 chainRundown 重算
  let pdrag: { id: string; started: boolean; sx: number; sy: number } | null = null;

  const clearDragUi = () => {
    document.body.classList.remove("dragging-any");
    root.querySelectorAll(".dragging, .drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
  };

  root.addEventListener("pointerdown", (e) => {
    const grip = (e.target as HTMLElement).closest(".rd-grip") as HTMLElement | null;
    if (!grip) return;
    pdrag = { id: grip.dataset.block!, started: false, sx: e.clientX, sy: e.clientY };
    try { grip.setPointerCapture(e.pointerId); } catch { /* 合成事件無有效 pointerId */ }
  });
  root.addEventListener("pointermove", (e) => {
    if (!pdrag) return;
    if (!pdrag.started) {
      if (Math.abs(e.clientX - pdrag.sx) + Math.abs(e.clientY - pdrag.sy) < 5) return;
      pdrag.started = true;
      root.querySelector(`.rd-row[data-block="${pdrag.id}"]`)?.classList.add("dragging");
      document.body.classList.add("dragging-any");
    }
    e.preventDefault();
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".rd-row") as HTMLElement | null;
    root.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
    if (over && over.dataset.block !== pdrag.id) over.classList.add("drop-target");
  });
  const finishDrag = (e: PointerEvent) => {
    if (!pdrag) return;
    const was = pdrag;
    pdrag = null;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".rd-row") as HTMLElement | null;
    clearDragUi();
    if (was.started && over && over.dataset.block !== was.id) {
      store.moveBlock(was.id, over.dataset.block!);
    }
  };
  root.addEventListener("pointerup", finishDrag);
  root.addEventListener("pointercancel", () => { pdrag = null; clearDragUi(); });
}

async function pickParkImage(store: Store, blockId: string) {
  const [f] = await pickFiles("image/*", false);
  if (!f) return;
  // 先縮成工作圖再裁（iPad：原檔直餵會耗盡解碼資源）
  const url = await fileToWorkingImage(f);
  if (!url) { alert("這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次。"); return; }
  const cropped = await openCropper(url, 16 / 9, { allowReplace: true });
  if (cropped) store.setBlockParkImage(blockId, cropped);
}

// 點既有停車圖：在編輯器裡裁切／縮放／一鍵黑白／換一張
async function editParkImage(store: Store, blockId: string) {
  const b = store.currentDay()?.rundown.find((x) => x.id === blockId);
  if (!b?.parkImage) return;
  const out = await openCropper(b.parkImage, 16 / 9, { allowReplace: true });
  if (out) store.setBlockParkImage(blockId, out);
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
