// iPadOS 通用手勢：雙指輕點＝復原、三指輕點＝重做（Procreate／備忘錄同款）。
// 掛在元素上（元素移除＝手勢自動失效）；輕點的定義＝短（<350ms）且沒滑動。
// Apple Pencil 的觸點（touchType "stylus"）不算手指——畫圖中誤判不了。
export interface UndoGestureOpts {
  onUndo: () => void;
  onRedo: () => void;
  enabled?: () => boolean; // 每次輕點時再確認（例：主 App 在對話框開著時讓位）
}

export function bindUndoGestures(el: HTMLElement | Document, opts: UndoGestureOpts) {
  let g: { max: number; t: number; x: number; y: number; moved: boolean } | null = null;
  const fingersOf = (e: TouchEvent) =>
    [...e.touches].filter((t) => (t as Touch & { touchType?: string }).touchType !== "stylus").length;

  el.addEventListener("touchstart", ((e: TouchEvent) => {
    const n = fingersOf(e);
    if (!g && n >= 2) {
      g = { max: n, t: Date.now(), x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
    } else if (g) {
      g.max = Math.max(g.max, n);
    }
  }) as EventListener, { passive: true });

  el.addEventListener("touchmove", ((e: TouchEvent) => {
    if (g && e.touches.length &&
      Math.abs(e.touches[0].clientX - g.x) + Math.abs(e.touches[0].clientY - g.y) > 30) {
      g.moved = true;
    }
  }) as EventListener, { passive: true });

  el.addEventListener("touchend", ((e: TouchEvent) => {
    if (!g) return;
    if (fingersOf(e) > 0) return; // 手指還沒全放開
    const hit = !g.moved && Date.now() - g.t < 350;
    const n = g.max;
    g = null;
    if (!hit) return;
    if (opts.enabled && !opts.enabled()) return;
    if (n === 2) opts.onUndo();
    else if (n >= 3) opts.onRedo();
  }) as EventListener, { passive: true });

  el.addEventListener("touchcancel", (() => { g = null; }) as EventListener, { passive: true });
}
