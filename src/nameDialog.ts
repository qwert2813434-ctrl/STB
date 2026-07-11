// iPad 取名對話框：iOS 沒有「存檔對話框」（Mac 靠它輸入案名建資料夾），
// 「案名＝資料夾名」的規則不變，改由 App 內輸入框完成。
export function askName(title: string, def: string): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "nd-overlay";
    overlay.innerHTML = `
      <div class="nd-panel">
        <div class="nd-title">${esc(title)}</div>
        <input class="nd-input" type="text" value="${esc(def)}" autocapitalize="off" autocomplete="off" spellcheck="false">
        <div class="nd-actions">
          <button class="nd-cancel">取消</button>
          <button class="nd-ok">確定</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector(".nd-input") as HTMLInputElement;
    const done = (v: string | null) => { overlay.remove(); resolve(v); };
    const ok = () => {
      // 檔名不能帶的符號直接換掉（與匯出檔名同一套規則）
      const v = input.value.replace(/[\/:*?"<>|]/g, "-").trim();
      if (!v) { input.focus(); return; }
      done(v);
    };
    overlay.querySelector(".nd-ok")!.addEventListener("click", ok);
    overlay.querySelector(".nd-cancel")!.addEventListener("click", () => done(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) done(null); });
    input.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 中文輸入法選字中，Enter＝選字
      if (e.key === "Enter") { e.preventDefault(); ok(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); }
    });
    input.focus();
    input.select();
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
