import { bindEditKeys } from "./editKeys";
import type { Store } from "./store";
import { computeCutNumbers, pageCount, PER_PAGE } from "./model";

// 渲染 STB 頁式版面。inline 編輯不觸發整頁重繪（避免游標跳）。
// expanded：暫時展開但還沒填字的 VO/Super 行（key = `${cutId}:vo`／`:sup`）。
export function renderStb(store: Store, root: HTMLElement, flashFromSeq = -1, expanded = new Set<string>()) {
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts);
  const pages = pageCount(p.cuts.length);
  let html = "";

  for (let pg = 0; pg < pages; pg++) {
    html += `<p class="page-label">STB · 頁 ${pg + 1} / ${pages} · A5 橫</p>`;
    html += `<div class="page">`;
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const seq = pg * PER_PAGE + slot;
      const cut = p.cuts[seq];
      if (!cut) {
        html += `<div class="cut-empty"></div>`;
        continue;
      }
      const n = numbers.get(cut.id)!;
      const grouped = n.groupSize > 1 ? " grouped" : "";
      const sel = store.isSelected(cut.id) ? " sel" : "";
      const flash = flashFromSeq >= 0 && seq >= flashFromSeq ? " flash" : "";
      // VO/Super 不長存：有值、或剛展開待填時才顯示
      const showVo = cut.vo !== "" || expanded.has(cut.id + ":vo");
      const showSup = cut.sup !== "" || expanded.has(cut.id + ":sup");
      // cut-head 整條當拖曳把手（自製指標手勢）；文字/圖片區照常點擊打字
      html += `
        <div class="cut${grouped}${sel}" data-id="${cut.id}">
          <div class="cut-head" data-id="${cut.id}" title="拖曳移動整張卡">
            <span class="cut-grip">⠿</span>
            <span class="cut-no${flash}">CUT ${n.label}</span>
          </div>
          <div class="cut-thumb" data-thumb="${cut.id}">${cut.imageRef ? `<img src="${cut.imageRef}" alt="分鏡" draggable="false">` : `<span class="thumb-add">＋ 分鏡圖</span>`}</div>
          <div class="cut-line cut-desc" contenteditable draggable="false" data-id="${cut.id}" data-f="desc" data-ph="畫面描述">${esc(cut.desc)}</div>
          ${showVo ? `<div class="cut-line-row cut-vo"><span class="tag">VO</span><span class="cut-edit" contenteditable draggable="false" data-id="${cut.id}" data-f="vo" data-ph="旁白 / 台詞">${esc(cut.vo)}</span></div>` : ""}
          ${showSup ? `<div class="cut-line-row cut-sup"><span class="tag">SUPER</span><span class="cut-edit" contenteditable draggable="false" data-id="${cut.id}" data-f="sup" data-ph="疊印字卡">${esc(cut.sup)}</span></div>` : ""}
        </div>`;
    }
    html += `</div>`;
  }
  root.innerHTML = html;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// 綁定一次事件（委派）
export function bindStb(
  store: Store,
  root: HTMLElement,
  onChange: (flashFromSeq?: number) => void,
  expanded: Set<string>
) {
  root.addEventListener("click", (e) => {
    const cut = (e.target as HTMLElement).closest(".cut") as HTMLElement | null;
    // ⌘點擊＝加選/取消、Shift 點擊＝連選（多選群組用），可編輯區也吃
    if (cut && (e.metaKey || e.ctrlKey)) { e.preventDefault(); store.toggleSelect(cut.dataset.id!); return; }
    if (cut && e.shiftKey && store.selectedId) { e.preventDefault(); store.selectRange(cut.dataset.id!); return; }
    // 點可編輯區：什麼都不做，讓游標直接進入（不重繪，否則 contenteditable 被
    // 重建、游標掉出來，就變成「要長按才打得了字」）
    if ((e.target as HTMLElement).isContentEditable) return;
    const t = e.target as HTMLElement;
    const id = cut?.dataset.id ?? null;
    store.select(id);
    // 點到卡片但沒點中細細的文字行（Armin：一直沒打到字）：
    // 游標自動進「畫面描述」——點了就能打，不用瞄準。頭列（拖曳）與縮圖除外。
    if (cut && id && !t.closest(".cut-head") && !t.closest(".cut-thumb")) {
      const desc = root.querySelector(`.cut[data-id="${id}"] .cut-desc`) as HTMLElement | null;
      if (desc) {
        desc.focus();
        const r = document.createRange();
        r.selectNodeContents(desc);
        r.collapse(false);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
  });

  // inline 編輯：blur 時 commit 文字（不重繪，DOM 已是最新）
  root.addEventListener(
    "blur",
    (e) => {
      const el = e.target as HTMLElement;
      if (!el.isContentEditable) return;
      const id = el.dataset.id!;
      const field = el.dataset.f as "desc" | "vo" | "sup" | "shot";
      // tag 已移出可編輯區，直接取純文字
      const text = (el.textContent || "").trim();
      store.editField(id, field, text);
      // 展開後沒填字 → 收回（下次重繪隱藏），維持「VO/Super 不長存」
      if ((field === "vo" || field === "sup") && text === "") {
        expanded.delete(id + ":" + field);
      }
    },
    true
  );

  // 輸入框鍵盤規則（editKeys）：Enter 留在框內（中文選字友善）、Esc 結束
  bindEditKeys(root);

  // 自製指標拖曳：不依賴 HTML5 DnD（WKWebView 裡不可靠——ALIGN 教訓：手勢自己擁有）。
  // pointerdown 在 cut-head 上按住 → 位移超過門檻進入拖曳 → 指到哪張卡亮哪張 → 放開重排。
  let pdrag: { id: string; started: boolean; sx: number; sy: number } | null = null;

  const clearDragUi = () => {
    document.body.classList.remove("dragging-any");
    root.querySelectorAll(".dragging, .drop-target").forEach((el) => el.classList.remove("dragging", "drop-target"));
  };

  root.addEventListener("pointerdown", (e) => {
    const head = (e.target as HTMLElement).closest(".cut-head") as HTMLElement | null;
    const cut = head?.closest(".cut") as HTMLElement | null;
    if (!head || !cut) return;
    pdrag = { id: cut.dataset.id!, started: false, sx: e.clientX, sy: e.clientY };
    try { head.setPointerCapture(e.pointerId); } catch { /* 合成事件無有效 pointerId */ }
  });
  root.addEventListener("pointermove", (e) => {
    if (!pdrag) return;
    if (!pdrag.started) {
      if (Math.abs(e.clientX - pdrag.sx) + Math.abs(e.clientY - pdrag.sy) < 5) return;
      pdrag.started = true;
      root.querySelector(`.cut[data-id="${pdrag.id}"]`)?.classList.add("dragging");
      document.body.classList.add("dragging-any");
    }
    e.preventDefault();
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cut") as HTMLElement | null;
    root.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
    if (over && over.dataset.id !== pdrag.id) over.classList.add("drop-target");
  });
  const finishDrag = (e: PointerEvent) => {
    if (!pdrag) return;
    const was = pdrag;
    pdrag = null;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cut") as HTMLElement | null;
    clearDragUi();
    if (was.started && over && over.dataset.id !== was.id) {
      store.moveGroup(was.id, over.dataset.id!);
      onChange(0);
    }
  };
  root.addEventListener("pointerup", finishDrag);
  root.addEventListener("pointercancel", () => { pdrag = null; clearDragUi(); });
}
