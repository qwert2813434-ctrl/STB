// 自製指標拖曳（分鏡卡／Rundown 列／通告大組列共用）：
// 不依賴 HTML5 DnD——WKWebView 裡不可靠（ALIGN 教訓：手勢自己擁有）。
// 觸控手感三件組（04 企劃「拖曳觸感」）：按住把手＝立刻浮起（CSS lift）、
// 拖動＝卡片跟手位移（inline transform）、沒放到目標＝彈回原位；
// 放到目標＝落定重排。滑鼠走同一條路，Mac 同步升級。
export interface DragSpec {
  root: HTMLElement;
  handleSel: string; // 把手（pointerdown 起點）
  itemSel: string;   // 可拖的卡（也是落點偵測對象）
  idOf: (item: HTMLElement) => string | undefined;
  onDrop: (fromId: string, toId: string) => void;
}

export function bindPointerDrag({ root, handleSel, itemSel, idOf, onDrop }: DragSpec) {
  let drag: { id: string; el: HTMLElement; started: boolean; sx: number; sy: number } | null = null;

  const clearUi = () => {
    document.body.classList.remove("dragging-any");
    root.querySelectorAll(".dragging, .drop-target").forEach((el) => {
      el.classList.remove("dragging", "drop-target");
      (el as HTMLElement).style.transform = "";
      (el as HTMLElement).style.transition = "";
    });
  };

  root.addEventListener("pointerdown", (e) => {
    const handle = (e.target as HTMLElement).closest(handleSel) as HTMLElement | null;
    const item = handle?.closest(itemSel) as HTMLElement | null;
    if (!handle || !item) return;
    const id = idOf(item);
    if (!id) return;
    drag = { id, el: item, started: false, sx: e.clientX, sy: e.clientY };
    try { handle.setPointerCapture(e.pointerId); } catch { /* 合成事件無有效 pointerId */ }
  });

  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.started) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 5) return;
      drag.started = true;
      drag.el.classList.add("dragging");
      document.body.classList.add("dragging-any");
    }
    e.preventDefault();
    // 跟手：inline transform 蓋過 class 的 scale，所以自己帶上 scale；
    // .dragging 已關 pointer-events，elementFromPoint 才看得到底下的落點
    drag.el.style.transform = `translate(${e.clientX - drag.sx}px, ${e.clientY - drag.sy}px) scale(1.03)`;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(itemSel) as HTMLElement | null;
    root.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
    if (over && idOf(over) !== drag.id) over.classList.add("drop-target");
  });

  const finish = (e: PointerEvent) => {
    if (!drag) return;
    const was = drag;
    drag = null;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(itemSel) as HTMLElement | null;
    const toId = over ? idOf(over) : undefined;
    if (was.started && toId && toId !== was.id) {
      clearUi();
      onDrop(was.id, toId); // 重排重繪＝落定
      return;
    }
    if (was.started) {
      // 沒放到目標：彈回原位（微過衝的彈性曲線），彈完再卸浮起狀態
      root.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
      was.el.style.transition = "transform .22s cubic-bezier(.34, 1.56, .64, 1)";
      was.el.style.transform = "";
      setTimeout(clearUi, 240);
      return;
    }
    clearUi();
  };
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointercancel", () => {
    if (drag?.started) { drag.el.style.transition = "transform .22s cubic-bezier(.34, 1.56, .64, 1)"; drag.el.style.transform = ""; }
    drag = null;
    setTimeout(clearUi, 240);
  });
}
