import { getStroke } from "perfect-freehand";
import type { Store } from "./store";
import type { CutSketch, SketchStroke } from "./model";
import { boardDims } from "./model";
import { pickFiles, fileToWorkingImage } from "./cutPicker";
import { bindUndoGestures } from "./touchUndo";

// 塗鴉分鏡編輯器（04 企劃⑤，技術路線 A：web canvas＋Pointer Events）。
// 定位：不跟分鏡師比質感——跟「沒有分鏡」比清楚。溝通工具，不是繪畫 App。
// 工具凍結＝筆／麥克筆／橡皮擦＋復原（不做圖層系統、調色盤、筆刷設定）。
// 兩層固定圖層：場景（構圖）＋人物（表演/運鏡）——「複製 cut 只改人物層」
// 工作流的地基。筆跡存資料（可再編輯）；完成時壓平 PNG 走既有 imageRef
// 管線（簡報/匯出零改動）。Apple Pencil＝pointerType "pen"（手指不作畫＝
// 防手掌誤觸）；Mac 滑鼠同一條路，桌面也能畫能測。

export function openSketchEditor(store: Store, cutId: string) {
  const cut = store.get().cuts.find((c) => c.id === cutId);
  if (!cut) return;
  if (document.querySelector(".sk-overlay")) return;
  // 畫布尺寸隨分鏡比例：橫式 1280×720／直式 720×1280。筆跡座標存在此空間，
  // 整片比例一次定案不變動＝同案的筆跡座標永遠一致。
  const { w: W, h: H } = boardDims(store.get().aspect);
  const portrait = H > W;
  // 已有照片、還沒有筆跡：照片自動變半透明「墊底」沿描（不會消失，
  // 收在筆跡資料裡；輸出＝純塗鴉。不想描就取消，照片原封不動）
  if (cut.imageRef && !cut.sketch) {
    if (!confirm("這格已有照片。開塗鴉會把照片當「半透明墊底」讓你沿描——完成後這格顯示塗鴉（照片收在筆跡裡，可隨時回編輯器）。繼續？")) return;
  }

  let work: CutSketch = cut.sketch ? structuredClone(cut.sketch) : { scene: [], figure: [] };
  // 照片格開塗鴉＝拿照片當半透明墊底沿描（勘景照描圖，04 企劃核心）——
  // 照片收進 sketch.underlay，不會消失；輸出壓平不含墊底
  if (cut.imageRef && !cut.sketch) work.underlay = cut.imageRef;
  let underlayImg: HTMLImageElement | null = null; // 墊底的解碼快取
  let tool: "pen" | "marker" | "eraser" = "pen";
  // 粗細三檔（倍率乘在筆的基準粗細上，筆/麥克筆各自記住）＋三色
  //（黑／紅＝註記與運鏡箭頭／藍＝呼應 VO 語意色）。檢視偏好存 localStorage，
  // 筆畫上等於預設值（1／黑）就不寫進 JSON——舊檔相容的關鍵。
  const SIZES = [0.6, 1, 1.6];
  const COLORS = ["#141311", "#b3341c", "#185fa5"];
  const INK = COLORS[0];
  const sizeKey = (tl: "pen" | "marker") => (tl === "marker" ? "stbSkSizeMarker" : "stbSkSizePen");
  const loadSize = (tl: "pen" | "marker"): number => {
    const v = parseFloat(localStorage.getItem(sizeKey(tl)) || "1");
    return SIZES.includes(v) ? v : 1;
  };
  const sizes = { pen: loadSize("pen"), marker: loadSize("marker") };
  let color = ((): string => {
    const v = localStorage.getItem("stbSkColor") || INK;
    return COLORS.includes(v) ? v : INK;
  })();
  // 聰明預設：空白＝先畫場景（構圖）；已有場景＝進來多半是改人物
  let layer: "scene" | "figure" = work.scene.length ? "figure" : "scene";
  const undoStack: CutSketch[] = [];
  const redoStack: CutSketch[] = [];
  let drawing: number[][] | null = null; // 進行中的筆畫
  let erasing = false;
  let erasedAny = false;

  const overlay = document.createElement("div");
  overlay.className = "sk-overlay";
  overlay.innerHTML = `
    <div class="sk-panel">
      <div class="sk-bar">
        <button data-sktool="pen" class="on">筆</button>
        <button data-sktool="marker">麥克筆</button>
        <button data-sktool="eraser">橡皮擦</button>
        <span class="sk-sep"></span>
        <span class="sk-sizes">${SIZES.map((s, i) =>
          `<button data-sksize="${s}" title="${["細", "中", "粗"][i]}"><i style="width:${4 + i * 3}px;height:${4 + i * 3}px"></i></button>`).join("")}
        </span>
        <span class="sk-colors">${COLORS.map((c) =>
          `<button data-skcolor="${c}"><i style="background:${c}"></i></button>`).join("")}
        </span>
        <span class="sk-sep"></span>
        <button data-sklayer title="兩層固定圖層：場景畫構圖、人物畫表演與運鏡——之後複製 cut 只重畫人物層">正在畫：<b></b></button>
        <button data-skunder title="勘景照半透明墊底沿描——不會畫畫也能構圖正確；輸出的塗鴉不含墊底"></button>
        <span class="spacer"></span>
        <button data-skundo>復原</button>
        <button data-skredo>重做</button>
        <button data-skclear>清除本層</button>
        <span class="sk-sep"></span>
        <button class="sk-cancel">取消</button>
        <button class="sk-ok">完成</button>
      </div>
      <div class="sk-stage"><canvas class="sk-canvas${portrait ? " portrait" : ""}" width="${W}" height="${H}"></canvas></div>
      <div class="sk-hint">Apple Pencil／滑鼠作畫，手指不會誤觸 · <b>雙指輕點＝復原、三指輕點＝重做</b> · 橡皮擦＝擦到哪消到哪（只擦目前圖層） · 完成＝存進分鏡格，之後點縮圖可回來繼續改</div>
    </div>`;
  document.body.appendChild(overlay);
  const canvas = overlay.querySelector(".sk-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const layerLabel = overlay.querySelector("[data-sklayer] b") as HTMLElement;

  // ---- 筆畫外形（perfect-freehand：把點序列變成有筆鋒的封閉外形）----
  function strokePath(s: SketchStroke): Path2D {
    // 壓力全相同（滑鼠/未回報）→ 讓演算法用速度模擬筆鋒
    const sim = s.pts.every((p) => p[2] === s.pts[0][2]);
    const outline = getStroke(s.pts, {
      size: (s.tool === "marker" ? 24 : 7) * (s.size ?? 1),
      thinning: s.tool === "marker" ? 0 : 0.55,
      smoothing: 0.5,
      streamline: 0.3, // 低一點＝墨水更貼筆尖（不拖尾）
      simulatePressure: sim,
    });
    const p = new Path2D();
    if (!outline.length) return p;
    p.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) p.lineTo(outline[i][0], outline[i][1]);
    p.closePath();
    return p;
  }

  // editorMode＝編輯畫面（顯示墊底、非作用層打淡）；false＝輸出壓平（純塗鴉）
  function paintInto(cx: CanvasRenderingContext2D, editorMode: boolean) {
    cx.fillStyle = "#ffffff";
    cx.fillRect(0, 0, W, H);
    if (editorMode && underlayImg) {
      // 墊底 45% 沿描；cover 置中不變形
      const iw = underlayImg.naturalWidth || W, ih = underlayImg.naturalHeight || H;
      const s = Math.max(W / iw, H / ih);
      cx.globalAlpha = 0.45;
      cx.drawImage(underlayImg, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      cx.globalAlpha = 1;
    }
    for (const which of ["scene", "figure"] as const) {
      const dim = editorMode && which !== layer ? 0.4 : 1;
      for (const s of work[which]) {
        cx.fillStyle = s.color ?? INK;
        cx.globalAlpha = (s.tool === "marker" ? 0.32 : 1) * dim;
        cx.fill(strokePath(s));
      }
    }
    if (drawing && drawing.length > 1) {
      const tl = tool === "eraser" ? "pen" : tool;
      cx.fillStyle = color;
      cx.globalAlpha = tool === "marker" ? 0.32 : 1;
      cx.fill(strokePath({ tool: tl, pts: drawing, size: sizes[tl] }));
    }
    cx.globalAlpha = 1;
  }

  let raf = 0;
  const render = () => {
    if (raf) return; // 一幀一畫，move 事件再密也不爆
    raf = requestAnimationFrame(() => { raf = 0; paintInto(ctx, true); });
  };
  const syncBar = () => {
    overlay.querySelectorAll("[data-sktool]").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.sktool === tool));
    // 粗細顯示目前工具記住的檔位；橡皮擦沒有粗細/顏色，兩組打淡不可按
    const inkTool = tool === "eraser" ? "pen" : tool;
    overlay.querySelectorAll("[data-sksize]").forEach((b) => b.classList.toggle("on", parseFloat((b as HTMLElement).dataset.sksize!) === sizes[inkTool]));
    overlay.querySelectorAll("[data-skcolor]").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.skcolor === color));
    (overlay.querySelector(".sk-sizes") as HTMLElement).classList.toggle("sk-off", tool === "eraser");
    (overlay.querySelector(".sk-colors") as HTMLElement).classList.toggle("sk-off", tool === "eraser");
    layerLabel.textContent = layer === "scene" ? "場景" : "人物";
    (overlay.querySelector("[data-sklayer]") as HTMLElement).classList.toggle("sk-fig", layer === "figure");
    (overlay.querySelector("[data-skunder]") as HTMLElement).textContent = work.underlay ? "✕ 移除墊底" : "＋ 墊底照片";
  };

  // 墊底解碼（快取一張 <img>；underlay 變動後呼叫）
  const loadUnderlay = () => {
    if (!work.underlay) { underlayImg = null; render(); return; }
    const img = new Image();
    img.onload = () => { underlayImg = img; render(); };
    img.src = work.underlay;
  };

  const pushUndo = () => {
    undoStack.push(structuredClone(work));
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0; // 新動作＝重做線斷掉
  };
  // 復原/重做共用：從一疊拿快照、現況推進另一疊（墊底變動一併跟上）
  const applySnapshot = (from: CutSketch[], to: CutSketch[]) => {
    const s = from.pop();
    if (!s) return;
    to.push(structuredClone(work));
    const underlayChanged = s.underlay !== work.underlay;
    work = s;
    if (underlayChanged) loadUnderlay();
    syncBar();
    render();
  };
  const doUndo = () => applySnapshot(undoStack, redoStack);
  const doRedo = () => applySnapshot(redoStack, undoStack);

  // ---- 指標 → 畫布座標 ----
  // 2026-07-22 真機十字靶＋雙引擎回歸測試定案。getBoundingClientRect() 有兩個
  // 獨立的雷，都只在 iPad（整頁 zoom）發作，Mac（z=1）不受影響：
  //  ① CSS zoom 語意各版 WebKit 不同——舊行為 rect 回「版面 px」（不含 zoom），
  //     標準化後回「視覺 px」（已含 zoom）。實測 macOS 26.3 是舊的、
  //     iPadOS 26.5.2 是新的。2026-07-12 那版寫死 ÷zoom，在新行為上等於修兩次。
  //  ② 舊行為下 rect.top 還會被捲動量污染 scrollY×(1/z−1)——捲到第 20 卡再開
  //     塗鴉就歪，捲得越深偏越多。這條從第一版就在，只是沒人測過捲動。
  // 所以原點完全不碰 rect：改由引擎自己的 offsetX/Y 反推（offset 與 clientX 同
  // 一個座標空間，兩種語意下都一樣，也不受捲動影響）。rect 只用來取「尺寸」
  // ——尺寸不受捲動污染——再乘上實測倍率 k 補掉語意差異。
  const rootZoom = (): number =>
    parseFloat((document.documentElement.style as unknown as { zoom?: string }).zoom || "1") || 1;
  // 原點：由引擎自己的 offsetX/Y 反推。offset 與 clientX 同一座標空間、
  // 不受捲動污染、也跟 rect 的 zoom 語意無關——是唯一兩種行為下都乾淨的量。
  // 只吃「真事件」（down/move）：getCoalescedEvents() 的子點 offset 在各引擎
  // 不可靠，那正是 2026-07-12 放棄 offset 路線的原因。每顆真事件都重校，
  // 所以畫到一半捲動／轉向／視窗變形都會自己修回來。
  let ox = 0, oy = 0, calibrated = false;
  const calibrate = (ev: PointerEvent): void => {
    if (ev.target !== canvas) return;                 // offset 是相對 target 算的
    if (!Number.isFinite(ev.offsetX) || !Number.isFinite(ev.offsetY)) return;
    ox = ev.clientX - ev.offsetX;                     // 畫布左上角（client 空間）
    oy = ev.clientY - ev.offsetY;
    calibrated = true;
  };
  // 尺寸用 rect（尺寸不受捲動污染），再乘實測倍率 k 補掉 zoom 語意差異。
  // 不用 clientWidth：它是整數，四捨五入會帶進 2～4 畫布px 的尺度誤差，
  // rect.width 是小數（實測誤差只剩 1.6～2.5px＝量測粒度）。
  const measureK = (): number => {
    const z = rootZoom();
    if (z === 1) return 1;                            // 沒 zoom 就沒這問題，省一次 layout
    const p = document.createElement("div");
    p.style.cssText = "position:fixed;top:0;left:0;width:100px;height:1px;visibility:hidden;pointer-events:none";
    document.body.appendChild(p);
    const m = p.getBoundingClientRect().width;        // 舊行為量到 100、標準化後量到 100×z
    p.remove();
    return m ? (100 * z) / m : z;
  };
  let rectK = measureK();                             // 只在起筆時量（每點都量會卡死 240Hz）
  const toPt = (ev: PointerEvent): number[] => {
    const r = canvas.getBoundingClientRect();
    const px = calibrated ? ox : r.left * rectK;      // 沒校正過就退回 rect，保底不 NaN
    const py = calibrated ? oy : r.top * rectK;
    return [
      (ev.clientX - px) * (W / (r.width * rectK)),
      (ev.clientY - py) * (H / (r.height * rectK)),
      ev.pressure || 0.5,
    ];
  };

  // 切段橡皮擦：擦到哪消到哪——擦中一筆的中段，該筆自動裂成前後兩筆，
  // 剩下的段落仍是筆跡資料（可再編輯）。整筆刪除版 Armin 實測不直覺，
  // 這才是備忘錄手感與「筆跡＝資料」紅線的交集。
  const eraseAt = (e: PointerEvent) => {
    const [x, y] = toPt(e);
    const rr = 18 * 18;
    const out: SketchStroke[] = [];
    let changed = false;
    for (const s of work[layer]) {
      const runs: number[][][] = [];
      let run: number[][] = [];
      let hit = false;
      for (const p of s.pts) {
        if ((p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y) < rr) {
          hit = true;
          if (run.length) { runs.push(run); run = []; }
        } else run.push(p);
      }
      if (run.length) runs.push(run);
      if (!hit) { out.push(s); continue; }
      changed = true;
      for (const r of runs) if (r.length >= 3) out.push({ tool: s.tool, pts: r }); // 太短的碎屑不留
    }
    if (changed) { work[layer] = out; erasedAny = true; render(); }
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // 手掌/手指不作畫（Pencil 防誤觸）
    e.preventDefault();
    rectK = measureK(); // 起筆時量一次倍率
    calibrate(e);       // 起筆時定原點
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
    if (tool === "eraser") {
      pushUndo();
      erasedAny = false;
      erasing = true;
      eraseAt(e);
      return;
    }
    drawing = [toPt(e)];
    render();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    calibrate(e); // 每顆真事件重校原點＝畫到一半捲動／轉向也會自己修回來
    if (erasing) { eraseAt(e); return; }
    if (!drawing) return;
    // getCoalescedEvents：Pencil 240Hz 的中間點全收，線才順
    const evs = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.() ?? [e];
    for (const ev of evs) drawing.push(toPt(ev));
    render();
  });
  const finishStroke = () => {
    if (erasing) {
      erasing = false;
      if (!erasedAny) undoStack.pop(); // 沒擦到東西＝不佔一步復原
      return;
    }
    if (!drawing) return;
    if (drawing.length > 1) {
      pushUndo(); // 快照＝「畫這筆之前」
      const tl = tool as "pen" | "marker";
      work[layer] = [...work[layer], {
        tool: tl, pts: drawing,
        // 等於預設值就不寫＝沒動過粗細/顏色的檔案 byte-identical
        ...(sizes[tl] !== 1 ? { size: sizes[tl] } : {}),
        ...(color !== INK ? { color } : {}),
      }];
    }
    drawing = null;
    render();
  };
  canvas.addEventListener("pointerup", finishStroke);
  // pointercancel＝iOS 因手掌/手勢中止筆的事件流——已畫的部分「收下」
  // 不丟棄（丟棄＝手掌一放筆畫整段蒸發，Armin 平放 iPad 實測的失效感）
  canvas.addEventListener("pointercancel", finishStroke);

  // 真・防手掌：手掌壓在編輯器任何地方（畫布＋周邊面板）都擋掉 WebKit
  // 拿觸點做原生手勢——系統手勢一啟動就會 cancel 掉筆的事件流。
  // 小觸點（小拇指側）系統不會自動當手掌，全靠這裡。工具列除外（按鈕要能點）。
  const palmGuard = (e: TouchEvent) => {
    if (!(e.target as HTMLElement).closest(".sk-bar")) e.preventDefault();
  };
  overlay.addEventListener("touchstart", palmGuard, { passive: false });
  overlay.addEventListener("touchmove", palmGuard, { passive: false });

  // ---- 工具列 ----
  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const tb = t.closest("[data-sktool]") as HTMLElement | null;
    if (tb) { tool = tb.dataset.sktool as typeof tool; syncBar(); return; }
    const sb = t.closest("[data-sksize]") as HTMLElement | null;
    if (sb && tool !== "eraser") {
      sizes[tool] = parseFloat(sb.dataset.sksize!);
      localStorage.setItem(sizeKey(tool), sb.dataset.sksize!);
      syncBar();
      return;
    }
    const cb = t.closest("[data-skcolor]") as HTMLElement | null;
    if (cb) {
      color = cb.dataset.skcolor!;
      localStorage.setItem("stbSkColor", color);
      syncBar();
      return;
    }
    if (t.closest("[data-sklayer]")) { layer = layer === "scene" ? "figure" : "scene"; syncBar(); render(); return; }
    if (t.closest("[data-skunder]")) {
      if (work.underlay) {
        pushUndo();
        work.underlay = null;
        underlayImg = null;
        syncBar();
        render();
      } else {
        void pickFiles("image/*", false).then(async ([f]) => {
          if (!f) return;
          const url = await fileToWorkingImage(f, 1280); // 縮到 1280 寬（墊底不用原檔）
          if (!url) { alert("這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次。"); return; }
          pushUndo();
          work.underlay = url;
          loadUnderlay();
          syncBar();
        });
      }
      return;
    }
    if (t.closest("[data-skundo]")) { doUndo(); return; }
    if (t.closest("[data-skredo]")) { doRedo(); return; }
    if (t.closest("[data-skclear]")) {
      if (!work[layer].length) return;
      pushUndo();
      work[layer] = [];
      render();
      return;
    }
    if (t.closest(".sk-cancel")) { close(); return; }
    if (t.closest(".sk-ok")) { save(); return; }
    if (t === overlay) close(); // 點外側＝取消（筆跡沒存——與其他對話框一致）
  });

  function flatten(): string {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const cx = c.getContext("2d")!;
    const keep = drawing; drawing = null;
    paintInto(cx, false); // 壓平＝純塗鴉：不含墊底、不打淡
    drawing = keep;
    const out = c.toDataURL("image/png"); // 線稿用 PNG：銳利且壓得小
    c.width = c.height = 0;
    return out;
  }

  function save() {
    if (!work.scene.length && !work.figure.length) {
      // 沒有任何筆畫：有墊底＝照片原樣放回（等於沒描，不動這格）；
      // 全空＝移除塗鴉（連圖一起清空這格）
      if (work.underlay) store.setCutSketch(cutId, null, work.underlay);
      else store.setCutSketch(cutId, null, null);
      close();
      return;
    }
    store.setCutSketch(cutId, work, flatten());
    close();
  }

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e: KeyboardEvent) {
    // 編輯器開著時鍵盤自己收：Esc 取消、⌘Z 復原（不讓全域 undo 動到案子）
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) doRedo(); else doUndo();
    }
  }
  document.addEventListener("keydown", onKey, true);

  // iPadOS 通用手勢：雙指輕點＝復原、三指輕點＝重做（畫到一半不觸發）
  bindUndoGestures(overlay, {
    onUndo: doUndo,
    onRedo: doRedo,
    enabled: () => !drawing && !erasing,
  });

  syncBar();
  loadUnderlay();
  render();
}
