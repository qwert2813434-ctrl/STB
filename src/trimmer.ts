// 影片首尾裁切（匯入時選 in/out 點，沿用 ALIGN 的導入體驗、無時長限制）。
// 不重新編碼：只記 trimStart/trimEnd（秒），播放時從起點播、到終點停。
// 手勢自製（pointerdown/move/up），不依賴原生 range input。

export interface TrimRange { start: number; end: number; }

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

// 回傳 null＝不裁切（整段）；套用整段也視為不裁切
export function openTrimmer(url: string): Promise<TrimRange | null> {
  return new Promise((resolve) => {
    const o = document.createElement("div");
    o.className = "crop-overlay";
    o.innerHTML = `
      <div class="crop-card trim-card">
        <video class="trim-video" playsinline></video>
        <div class="trim-track">
          <div class="trim-range"></div>
          <div class="trim-handle" data-h="s" title="起點"></div>
          <div class="trim-handle" data-h="e" title="終點"></div>
        </div>
        <div class="crop-bar">
          <span class="crop-hint trim-label">載入中…</span>
          <span class="spacer"></span>
          <button class="trim-preview">▶ 預覽片段</button>
          <button class="trim-skip">不裁切</button>
          <button class="trim-apply">套用</button>
        </div>
      </div>`;
    document.body.appendChild(o);
    const v = o.querySelector(".trim-video") as HTMLVideoElement;
    const track = o.querySelector(".trim-track") as HTMLElement;
    const rangeEl = o.querySelector(".trim-range") as HTMLElement;
    const hs = o.querySelector('[data-h="s"]') as HTMLElement;
    const he = o.querySelector('[data-h="e"]') as HTMLElement;
    const label = o.querySelector(".trim-label") as HTMLElement;

    let dur = 0;
    let s = 0;
    let e = 0;

    const done = (r: TrimRange | null) => {
      v.pause();
      o.remove();
      document.removeEventListener("keydown", onKey, true);
      resolve(r);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); done(null); }
    };
    document.addEventListener("keydown", onKey, true);

    const pct = (t: number) => (dur ? (t / dur) * 100 : 0);
    const layout = () => {
      hs.style.left = `calc(${pct(s)}% - 7px)`;
      he.style.left = `calc(${pct(e)}% - 7px)`;
      rangeEl.style.left = pct(s) + "%";
      rangeEl.style.width = Math.max(0, pct(e) - pct(s)) + "%";
      label.textContent = `${fmt(s)} – ${fmt(e)}　（全長 ${fmt(dur)}）`;
    };

    v.muted = true;
    v.preload = "auto";
    v.src = url;
    v.onloadedmetadata = () => {
      dur = v.duration || 0;
      s = 0;
      e = dur;
      layout();
    };
    // 播放預覽：到終點自動停
    v.ontimeupdate = () => { if (e > 0 && v.currentTime >= e) v.pause(); };

    // 拖曳把手：拖到哪、畫面就 seek 到哪（邊拖邊看影格）
    let drag: "s" | "e" | null = null;
    const seekTo = (clientX: number) => {
      const r = track.getBoundingClientRect();
      const t = Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur));
      if (drag === "s") s = Math.min(t, Math.max(0, e - 0.1));
      else e = Math.max(t, Math.min(dur, s + 0.1));
      try { v.currentTime = t; } catch { /* metadata 未就緒 */ }
      layout();
    };
    track.addEventListener("pointerdown", (ev) => {
      const h = (ev.target as HTMLElement).closest(".trim-handle") as HTMLElement | null;
      if (!h || !dur) return;
      drag = h.dataset.h as "s" | "e";
      try { h.setPointerCapture(ev.pointerId); } catch { /* 合成事件 */ }
      seekTo(ev.clientX);
    });
    track.addEventListener("pointermove", (ev) => { if (drag) { ev.preventDefault(); seekTo(ev.clientX); } });
    track.addEventListener("pointerup", () => { drag = null; });
    track.addEventListener("pointercancel", () => { drag = null; });

    (o.querySelector(".trim-preview") as HTMLElement).addEventListener("click", () => {
      try { v.currentTime = s; } catch { /* noop */ }
      v.muted = false;
      void v.play();
    });
    (o.querySelector(".trim-skip") as HTMLElement).addEventListener("click", () => done(null));
    (o.querySelector(".trim-apply") as HTMLElement).addEventListener("click", () => {
      // 套用整段＝等於不裁切
      if (!dur || (s <= 0.05 && e >= dur - 0.05)) done(null);
      else done({ start: s, end: e });
    });
    o.addEventListener("click", (ev) => { if (ev.target === o) done(null); });
  });
}
