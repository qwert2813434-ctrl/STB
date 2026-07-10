// 輸入框鍵盤規則（全 App 統一）——為中文輸入而設：
// 中文選字每個詞都按 Enter 確認，若把 Enter 當「完成輸入」，打一個詞就被
// 踢出輸入框、要滑鼠點回來（Armin 實測回報）。
// 規則：Enter＝吞掉、游標留在框內繼續打；Esc＝結束輸入（blur→commit）；
// 要離開也可以直接點別處。allowNewline 的欄位（多行附註）Enter 照常換行。
export function bindEditKeys(root: HTMLElement, allowNewline?: (el: HTMLElement) => boolean) {
  root.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (!el.isContentEditable) return;
    if (e.key === "Enter" && !e.isComposing) {
      if (allowNewline?.(el)) return;
      e.preventDefault(); // 不換行、不離開——繼續打
    } else if (e.key === "Escape" && !e.isComposing) {
      e.preventDefault();
      el.blur();
    }
  });
}
