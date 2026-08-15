import { getStroke } from "perfect-freehand";
import type { Store } from "./store";
import type { CutSketch, SketchStroke } from "./model";
import { boardDims } from "./model";
import { pickFiles, fileToWorkingImage } from "./cutPicker";
import { bindUndoGestures } from "./touchUndo";
import { askName } from "./nameDialog";

// 塗鴉分鏡編輯器（04 企劃⑤，技術路線 A：web canvas＋Pointer Events）。
// 定位：不跟分鏡師比質感——跟「沒有分鏡」比清楚。溝通工具，不是繪畫 App。
// 工具＝筆／麥克筆／橡皮擦／選取＋復原。2026-08-15（企劃 10）解凍三件：
// 粗細三檔＋黑紅藍三色、自訂圖層（上限 4）、套索選取移動縮放——擴充守著
// 「讓溝通更清楚」一句話原則，調色盤/筆刷引擎這類繪畫 App 的東西仍不做。
// 圖層：場景（構圖）＋人物（表演/運鏡）固定——「複製 cut 只改人物層」
// 工作流的地基；自訂層放 extra 疊人物上方。筆跡存資料（可再編輯）；
// 完成時壓平 PNG 走既有 imageRef 管線（簡報/匯出零改動）。
// Apple Pencil＝pointerType "pen"（手指不作畫＝防手掌誤觸）；
// Mac 滑鼠同一條路，桌面也能畫能測。

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

  // 開檔＝淺拷貝就夠：筆畫與圖層物件全程不可變（所有修改都換新物件、
  // 欄位整個重指），store 那份絕不會被就地改。structuredClone 在怪獸案
  // （26 萬點）要上百 ms＝「剛打開筆沒反應」的一半元兇。
  let work: CutSketch = cut.sketch ? { ...cut.sketch } : { scene: [], figure: [] };
  // 照片格開塗鴉＝拿照片當半透明墊底沿描（勘景照描圖，04 企劃核心）——
  // 照片收進 sketch.underlay，不會消失；輸出壓平不含墊底
  if (cut.imageRef && !cut.sketch) work.underlay = cut.imageRef;
  let underlayImg: HTMLImageElement | null = null; // 墊底的解碼快取
  let tool: "pen" | "marker" | "eraser" | "select" = "pen";
  // 圖層：場景/人物固定（語意層），自訂層在 work.extra（上限 4，疊人物上方）。
  // layer＝目前作用層："scene"｜"figure"｜extra 的索引。
  // 橡皮擦/清除/選取都只動作用層——與兩層時代的行為一致。
  const MAX_EXTRA = 4;
  const extras = () => work.extra ?? [];
  const curStrokes = (): SketchStroke[] => (typeof layer === "number" ? extras()[layer].strokes : work[layer]);
  // 所有筆畫修改的唯一出口：整個陣列（含圖層物件）都換新的不就地改——
  // 復原快照因此可以淺拷貝共享（見 pushUndo），路徑快取也永遠不會過期。
  // 只動作用層 → 只標作用層重建（below/above 兩張大圖不動）。
  const setCurStrokes = (arr: SketchStroke[]) => {
    if (typeof layer === "number") {
      const li = layer;
      work.extra = extras().map((l, i) => (i === li ? { ...l, strokes: arr } : l));
    } else work[layer] = arr;
    invalidateActive();
  };
  const layerName = (): string =>
    typeof layer === "number" ? extras()[layer]?.name ?? "" : layer === "scene" ? "場景" : "人物";
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
  let layer: "scene" | "figure" | number = work.scene.length ? "figure" : "scene";
  const undoStack: CutSketch[] = [];
  const redoStack: CutSketch[] = [];
  let drawing: number[][] | null = null; // 進行中的筆畫
  let erasing = false;
  let erasedAny = false;

  // ---- 選取工具：套索圈選 → 框內拖＝移動、角把手＝等比縮放（定錨對角）----
  // 只動作用層（與橡皮擦一致）；變形直接改 pts＝筆跡仍是資料，落定後照常可擦可再選。
  // 整輪選取的所有變形算一步復原（第一次動到才 pushUndo）。
  let sel: number[] = [];                 // 選中筆畫在作用層的索引
  let lasso: number[][] | null = null;    // 進行中的套索（畫布座標）
  let selDrag: { mode: "move" | "scale"; last: [number, number]; anchor: [number, number] } | null = null;
  let selPushed = false;
  const HANDLE_HIT = 30;                  // 把手命中半徑（畫布 px）
  const clearSel = () => { sel = []; lasso = null; selDrag = null; selPushed = false; };
  const selBBox = (): [number, number, number, number] | null => {
    if (!sel.length) return null;
    const arr = curStrokes();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of sel) for (const p of arr[i]?.pts ?? []) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return x1 < x0 ? null : [x0, y0, x1, y1];
  };
  const inPoly = (x: number, y: number, poly: number[][]): boolean => {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const finishLasso = () => {
    if (!lasso) return;
    const poly = lasso;
    lasso = null;
    sel = [];
    if (poly.length >= 3) {
      curStrokes().forEach((s, i) => {
        let inside = 0;
        for (const p of s.pts) if (inPoly(p[0], p[1], poly)) inside++;
        if (inside > s.pts.length / 2) sel.push(i); // 過半制：橫貫全圖的長線不會被順手抓走
      });
    }
    selPushed = false;
    render();
  };
  // 變形＝換新筆畫物件（映射座標），不就地改 pts——
  // 舊物件可能被復原快照共享，而且路徑快取認物件不認內容
  const transformSel = (fn: (p: number[]) => number[]) => {
    if (!selPushed) { pushUndo(); selPushed = true; }
    const arr = [...curStrokes()];
    for (const i of sel) arr[i] = { ...arr[i], pts: arr[i].pts.map(fn) };
    setCurStrokes(arr);
    render();
  };

  const overlay = document.createElement("div");
  overlay.className = "sk-overlay";
  overlay.innerHTML = `
    <div class="sk-panel">
      <div class="sk-bar">
        <button data-sktool="pen" class="on">筆</button>
        <button data-sktool="marker">麥克筆</button>
        <button data-sktool="eraser">橡皮擦</button>
        <button data-sktool="select" title="圈起來＝選取（只選目前圖層）；框內拖＝移動、角把手＝等比縮放">選取</button>
        <span class="sk-sep"></span>
        <span class="sk-sizes">${SIZES.map((s, i) =>
          `<button data-sksize="${s}" title="${["細", "中", "粗"][i]}"><i style="width:${4 + i * 3}px;height:${4 + i * 3}px"></i></button>`).join("")}
        </span>
        <span class="sk-colors">${COLORS.map((c) =>
          `<button data-skcolor="${c}"><i style="background:${c}"></i></button>`).join("")}
        </span>
        <span class="sk-sep"></span>
        <button data-sklayer title="圖層清單：場景畫構圖、人物畫表演與運鏡（複製 cut 只重畫人物層）；最多再加 4 層自訂圖層，疊在人物上方">圖層：<b></b></button>
        <button data-skunder title="勘景照半透明墊底沿描——不會畫畫也能構圖正確；輸出的塗鴉不含墊底"></button>
        <span class="spacer"></span>
        <button data-skundo>復原</button>
        <button data-skredo>重做</button>
        <button data-skclear>清除本層</button>
        <span class="sk-sep"></span>
        <button class="sk-cancel">取消</button>
        <button class="sk-ok">完成</button>
      </div>
      <div class="sk-layers"></div>
      <div class="sk-stage"><canvas class="sk-canvas${portrait ? " portrait" : ""}" width="${W}" height="${H}"></canvas></div>
      <div class="sk-hint">Apple Pencil／滑鼠作畫，手指不會誤觸 · <b>雙指輕點＝復原、三指輕點＝重做</b> · 橡皮擦＝擦到哪消到哪（只擦目前圖層） · 選取＝圈起來拖著走、拉角落等比縮放 · 完成＝存進分鏡格，之後點縮圖可回來繼續改</div>
    </div>`;
  document.body.appendChild(overlay);
  const canvas = overlay.querySelector(".sk-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const layerLabel = overlay.querySelector("[data-sklayer] b") as HTMLElement;

  // ---- 筆畫外形（perfect-freehand：把點序列變成有筆鋒的封閉外形）----
  // 效能鐵則（2026-08-15 iPad 發燙事件後定案）：**筆畫物件不可變**——
  // 所有修改（畫/擦裂/變形）都產生新物件，所以外形可以 WeakMap 快取，
  // 算一次用到死；物件被換掉＝快取自動失效（GC 順便收走）。
  const pathCache = new WeakMap<SketchStroke, Path2D>();
  function strokePath(s: SketchStroke): Path2D {
    const hit = pathCache.get(s);
    if (hit) return hit;
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
    pathCache.set(s, p);
    return p;
  }

  // 靜態內容畫在離屏 canvas，內容變動才重建——之前「每幀重算全部筆畫外形」
  // 在 iPad 上畫幾層就把 CPU 燒滿（發燙→降頻→被看門狗砍）。
  //
  // 2026-08-16 二修（Armin：剛打開落筆，筆有收到但畫面等一下才全部冒出來）：
  // 第一版單張快取圖有個互動缺陷——每畫完一筆就整張重建，冷建構要幾十幀，
  // 而連續作畫的每一筆都讓它從頭來＝建構永遠蓋不完。改**三層離屏**：
  //   below（作用層下方＋背景/墊底）／active（作用層）／above（作用層上方）
  // 畫新筆＝只把那一筆補進 active（一筆成本）；擦除/變形/清除＝只重建 active
  //（同步，作用層筆數等級）；換層/圖層操作/undo/墊底才重建 below+above
  //（分幀預算＋雙緩衝：蓋完才換前台，重建中不閃；首建直接秀進度）。
  const mkCv = () => {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    return { cv, cx: cv.getContext("2d")! };
  };
  let belowFront = mkCv(), belowBuild = mkCv();
  let aboveFront = mkCv(), aboveBuild = mkCv();
  const active = mkCv();
  const BUILD_BUDGET_MS = 12;
  let dirtyAll = true;      // below+above 全重建（分幀）＋active 同步重建
  let dirtyActive = false;  // 只重建 active（同步）
  let building = false;
  let pairReady = false;    // below/above 前台是否完整過（首建期間直接秀後台當進度）
  let buildQueue: { cx: CanvasRenderingContext2D; s: SketchStroke; a: number }[] = [];
  let buildPos = 0;
  const invalidate = () => { dirtyAll = true; };
  const invalidateActive = () => { dirtyActive = true; };

  // 各層依渲染順序（scene=0、figure=1、extra=2+i；index 大＝上面）
  const layerSeq = (): { strokes: SketchStroke[]; idx: number; hidden?: boolean }[] => [
    { strokes: work.scene, idx: 0 },
    { strokes: work.figure, idx: 1 },
    ...extras().map((l, i) => ({ strokes: l.strokes, idx: 2 + i, hidden: l.hidden })),
  ];
  const activeIdx = (): number => (layer === "scene" ? 0 : layer === "figure" ? 1 : 2 + layer);
  const strokeAlpha = (s: SketchStroke): number => (s.tool === "marker" ? 0.32 : 1);
  const paintStrokeInto = (cx: CanvasRenderingContext2D, s: SketchStroke, a: number) => {
    cx.fillStyle = s.color ?? INK;
    cx.globalAlpha = a;
    cx.fill(strokePath(s));
    cx.globalAlpha = 1;
  };

  // 作用層永遠同步重建：成本只跟這一層的筆數走，擦除/變形回饋才不遲到
  const rebuildActive = () => {
    dirtyActive = false;
    active.cx.clearRect(0, 0, W, H);
    const li = activeIdx();
    for (const L of layerSeq()) {
      if (L.idx !== li || L.hidden) continue;
      for (const s of L.strokes) paintStrokeInto(active.cx, s, strokeAlpha(s));
    }
  };

  // 依渲染順序攤平所有要畫的筆畫（含各層打淡係數）
  const orderedStrokes = (editorMode: boolean): { s: SketchStroke; a: number }[] => {
    const out: { s: SketchStroke; a: number }[] = [];
    for (const which of ["scene", "figure"] as const) {
      const dim = editorMode && which !== layer ? 0.4 : 1;
      for (const s of work[which]) out.push({ s, a: (s.tool === "marker" ? 0.32 : 1) * dim });
    }
    // 自訂層疊在人物上方，依陣列順序（index 大＝上面）；隱藏層連壓平都不進
    for (let i = 0; i < extras().length; i++) {
      const L = extras()[i];
      if (L.hidden) continue;
      const dim = editorMode && layer !== i ? 0.4 : 1;
      for (const s of L.strokes) out.push({ s, a: (s.tool === "marker" ? 0.32 : 1) * dim });
    }
    return out;
  };

  const paintBg = (cx: CanvasRenderingContext2D, editorMode: boolean) => {
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
  };

  // 同步整張畫完（壓平輸出用；editorMode=false＝不含墊底、不打淡）
  function paintStatic(cx: CanvasRenderingContext2D, editorMode: boolean) {
    paintBg(cx, editorMode);
    for (const { s, a } of orderedStrokes(editorMode)) {
      cx.fillStyle = s.color ?? INK;
      cx.globalAlpha = a;
      cx.fill(strokePath(s));
    }
    cx.globalAlpha = 1;
  }

  // 每幀組合：below＋active＋above＋進行中筆畫＋選取視覺
  function paintFrame() {
    if (dirtyAll) { // 開新一輪 below/above 後台建構（前台留舊圖，不閃）
      dirtyAll = false;
      building = true;
      buildPos = 0;
      paintBg(belowBuild.cx, true);
      aboveBuild.cx.clearRect(0, 0, W, H);
      const li = activeIdx();
      buildQueue = [];
      for (const L of layerSeq()) {
        if (L.hidden || L.idx === li) continue;
        const target = L.idx < li ? belowBuild.cx : aboveBuild.cx;
        for (const s of L.strokes) buildQueue.push({ cx: target, s, a: strokeAlpha(s) * 0.4 });
      }
      rebuildActive();
    } else if (dirtyActive) rebuildActive();
    if (building) {
      const t0 = performance.now();
      while (buildPos < buildQueue.length && performance.now() - t0 < BUILD_BUDGET_MS) {
        const it = buildQueue[buildPos++];
        paintStrokeInto(it.cx, it.s, it.a);
      }
      if (buildPos >= buildQueue.length) {
        building = false;
        pairReady = true;
        [belowFront, belowBuild] = [belowBuild, belowFront]; // 蓋完才換前台
        [aboveFront, aboveBuild] = [aboveBuild, aboveFront];
      } else {
        render(); // 還沒蓋完，下一幀繼續（預算制＝主執行緒每幀都有空檔收筆的事件）
      }
    }
    // 首建（前台從沒完整過）直接秀後台當進度；之後的重建都等蓋完才換
    const showProgress = building && !pairReady;
    ctx.drawImage((showProgress ? belowBuild : belowFront).cv, 0, 0);
    ctx.drawImage(active.cv, 0, 0);
    ctx.drawImage((showProgress ? aboveBuild : aboveFront).cv, 0, 0);
    if (drawing && drawing.length > 1) {
      const tl: "pen" | "marker" = tool === "marker" ? "marker" : "pen";
      ctx.fillStyle = color;
      ctx.globalAlpha = tool === "marker" ? 0.32 : 1;
      // 進行中的筆畫每幀都在長，不進快取（臨時物件，畫完 GC）
      const sim = drawing.every((p) => p[2] === drawing![0][2]);
      const outline = getStroke(drawing, {
        size: (tl === "marker" ? 24 : 7) * sizes[tl],
        thinning: tl === "marker" ? 0 : 0.55,
        smoothing: 0.5,
        streamline: 0.3,
        simulatePressure: sim,
      });
      if (outline.length) {
        ctx.beginPath();
        ctx.moveTo(outline[0][0], outline[0][1]);
        for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // 選取視覺：套索虛線、選取框＋四角把手
    if (tool === "select") {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#185fa5";
      ctx.setLineDash([8, 6]);
      if (lasso && lasso.length > 1) {
        ctx.beginPath();
        ctx.moveTo(lasso[0][0], lasso[0][1]);
        for (let i = 1; i < lasso.length; i++) ctx.lineTo(lasso[i][0], lasso[i][1]);
        ctx.stroke();
      }
      const bb = selBBox();
      if (bb) {
        ctx.strokeRect(bb[0] - 6, bb[1] - 6, bb[2] - bb[0] + 12, bb[3] - bb[1] + 12);
        ctx.setLineDash([]);
        ctx.fillStyle = "#185fa5";
        const hs: [number, number][] = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]];
        for (const [hx, hy] of hs) ctx.fillRect(hx - 7, hy - 7, 14, 14);
      }
      ctx.restore();
    }
  }

  let raf = 0;
  const render = () => {
    if (raf) return; // 一幀一畫，move 事件再密也不爆
    raf = requestAnimationFrame(() => { raf = 0; paintFrame(); });
  };
  const syncBar = () => {
    overlay.querySelectorAll("[data-sktool]").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.sktool === tool));
    // 粗細顯示目前工具記住的檔位；橡皮擦/選取沒有粗細/顏色，兩組打淡不可按
    const inkTool: "pen" | "marker" = tool === "marker" ? "marker" : "pen";
    const noInk = tool === "eraser" || tool === "select";
    overlay.querySelectorAll("[data-sksize]").forEach((b) => b.classList.toggle("on", parseFloat((b as HTMLElement).dataset.sksize!) === sizes[inkTool]));
    overlay.querySelectorAll("[data-skcolor]").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.skcolor === color));
    (overlay.querySelector(".sk-sizes") as HTMLElement).classList.toggle("sk-off", noInk);
    (overlay.querySelector(".sk-colors") as HTMLElement).classList.toggle("sk-off", noInk);
    layerLabel.textContent = layerName();
    (overlay.querySelector("[data-sklayer]") as HTMLElement).classList.toggle("sk-fig", layer === "figure");
    (overlay.querySelector("[data-skunder]") as HTMLElement).textContent = work.underlay ? "✕ 移除墊底" : "＋ 墊底照片";
  };

  // ---- 圖層面板（浮動，點「圖層」開合）----
  // 列表由上而下＝畫面由上而下：自訂層（index 大在上）→ 人物 → 場景。
  // 眼睛/刪除/排序只有自訂層有——場景與人物是骨架，永遠在、永遠顯示。
  const layersEl = overlay.querySelector(".sk-layers") as HTMLElement;
  let panelOpen = false;
  const EYE = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><path d="M4 4l16 16"/></svg>`;
  const renderLayers = () => {
    const rows: string[] = [];
    rows.push(`<button class="sk-ladd" ${extras().length >= MAX_EXTRA ? "disabled" : ""}>＋ 新增圖層${extras().length >= MAX_EXTRA ? "（已達上限）" : ""}</button>`);
    for (let i = extras().length - 1; i >= 0; i--) {
      const L = extras()[i];
      rows.push(`<div class="sk-lrow${layer === i ? " on" : ""}${L.hidden ? " hid" : ""}" data-lid="${i}">
        <button class="sk-leye" data-leye="${i}" title="${L.hidden ? "顯示" : "隱藏"}">${L.hidden ? EYE_OFF : EYE}</button>
        <span class="sk-lname" title="點作用中的圖層名稱＝改名">${esc(L.name)}</span>
        <button class="sk-lmv" data-lup="${i}" ${i === extras().length - 1 ? "disabled" : ""}>↑</button>
        <button class="sk-lmv" data-ldn="${i}" ${i === 0 ? "disabled" : ""}>↓</button>
        <button class="sk-ldel" data-ldel="${i}">✕</button>
      </div>`);
    }
    rows.push(`<div class="sk-lrow sk-fixed${layer === "figure" ? " on" : ""}" data-lid="figure"><span class="sk-leye-ph"></span><span class="sk-lname">人物</span></div>`);
    rows.push(`<div class="sk-lrow sk-fixed${layer === "scene" ? " on" : ""}" data-lid="scene"><span class="sk-leye-ph"></span><span class="sk-lname">場景</span></div>`);
    layersEl.innerHTML = rows.join("");
  };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const closePanel = () => { panelOpen = false; layersEl.classList.remove("open"); };

  layersEl.addEventListener("click", (e) => {
    const t0 = e.target as HTMLElement;
    clearSel(); // 圖層一動（切層/增刪/排序/顯隱）選取索引就不可信，一律解除
    // 圖層物件一律換新的不就地改（快照淺拷貝的前提，見 snap()）
    if (t0.closest(".sk-ladd")) {
      if (extras().length >= MAX_EXTRA) return;
      pushUndo();
      work.extra = [...extras(), { name: `圖層 ${extras().length + 1}`, strokes: [] }];
      layer = work.extra.length - 1;
      invalidate(); // 作用層變了＝打淡的對象變了
      renderLayers(); syncBar(); render();
      return;
    }
    const eye = t0.closest("[data-leye]") as HTMLElement | null;
    if (eye) {
      const i = +eye.dataset.leye!;
      pushUndo();
      work.extra = extras().map((l, idx) => {
        if (idx !== i) return l;
        const n = { ...l };
        if (n.hidden) delete n.hidden; else n.hidden = true; // false 不落地
        return n;
      });
      invalidate();
      renderLayers(); render();
      return;
    }
    const up = t0.closest("[data-lup]") as HTMLElement | null;
    const dn = t0.closest("[data-ldn]") as HTMLElement | null;
    if (up || dn) {
      // 列表的「上」＝畫面的上層＝index 變大
      const i = +((up ?? dn)!.dataset.lup ?? (up ?? dn)!.dataset.ldn!);
      const j = up ? i + 1 : i - 1;
      if (j < 0 || j >= extras().length) return;
      pushUndo();
      const arr = [...work.extra!];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      work.extra = arr;
      if (layer === i) layer = j; else if (layer === j) layer = i;
      invalidate();
      renderLayers(); syncBar(); render();
      return;
    }
    const del = t0.closest("[data-ldel]") as HTMLElement | null;
    if (del) {
      const i = +del.dataset.ldel!;
      const L = extras()[i];
      if (L.strokes.length && !confirm(`刪除圖層「${L.name}」？上面的筆畫會一起刪（可復原）。`)) return;
      pushUndo();
      work.extra = extras().filter((_, idx) => idx !== i);
      if (!work.extra.length) delete work.extra;
      if (layer === i) layer = "figure";
      else if (typeof layer === "number" && layer > i) layer -= 1;
      invalidate();
      renderLayers(); syncBar(); render();
      return;
    }
    const row = t0.closest("[data-lid]") as HTMLElement | null;
    if (row) {
      const id = row.dataset.lid!;
      const next: typeof layer = id === "scene" || id === "figure" ? id : +id;
      if (next === layer && typeof layer === "number" && t0.closest(".sk-lname")) {
        // 點作用中的自訂層名稱＝改名
        void askName("圖層名稱", extras()[layer].name).then((v) => {
          if (!v || typeof layer !== "number" || v === extras()[layer].name) return;
          pushUndo();
          const li = layer;
          work.extra = extras().map((l, idx) => (idx === li ? { ...l, name: v } : l));
          renderLayers(); syncBar();
        });
        return;
      }
      layer = next;
      // 作用中的隱藏層畫了也看不見——選它＝把它打開
      if (typeof layer === "number" && extras()[layer].hidden) {
        pushUndo();
        const li = layer;
        work.extra = extras().map((l, idx) => {
          if (idx !== li) return l;
          const n = { ...l };
          delete n.hidden;
          return n;
        });
      }
      invalidate(); // 作用層變了＝打淡的對象變了
      renderLayers(); syncBar(); render();
    }
  });

  // 墊底解碼（快取一張 <img>；underlay 變動後呼叫）
  const loadUnderlay = () => {
    if (!work.underlay) { underlayImg = null; invalidate(); render(); return; }
    const img = new Image();
    img.onload = () => { underlayImg = img; invalidate(); render(); };
    img.src = work.underlay;
  };

  // 快照＝淺拷貝：筆畫與圖層物件全程不可變（修改一律換新物件），
  // 50 份快照共享同一批筆畫＝記憶體不再隨筆畫數×50 膨脹，
  // 每筆結束也不再整份 structuredClone（之前多層多筆時這裡就是卡頓源之一）。
  const snap = (w: CutSketch): CutSketch => ({ ...w });
  const pushUndo = () => {
    undoStack.push(snap(work));
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0; // 新動作＝重做線斷掉
  };
  // 復原/重做共用：從一疊拿快照、現況推進另一疊（墊底變動一併跟上）
  const applySnapshot = (from: CutSketch[], to: CutSketch[]) => {
    const s = from.pop();
    if (!s) return;
    to.push(snap(work));
    const underlayChanged = s.underlay !== work.underlay;
    work = s;
    invalidate();
    clearSel(); // 筆畫索引已換了一批，選取框不能留
    // 復原可能退掉圖層本身——作用層索引失效就退回人物層
    if (typeof layer === "number" && layer >= (work.extra?.length ?? 0)) layer = "figure";
    if (underlayChanged) loadUnderlay();
    if (panelOpen) renderLayers();
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
    for (const s of curStrokes()) {
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
      // 裂開的段落沿用原筆畫的粗細/顏色（太短的碎屑不留）
      for (const r of runs) if (r.length >= 3) out.push({ ...s, pts: r });
    }
    if (changed) { setCurStrokes(out); erasedAny = true; render(); }
  };

  // getCoalescedEvents：Pencil 240Hz 的中間點全收，線才順。
  // 回空陣列（合成事件/部分 webdriver）就退回主事件——不然整段 move 一顆點都不進。
  const coalesced = (e: PointerEvent): PointerEvent[] => {
    const list = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.();
    return list && list.length ? list : [e];
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // 手掌/手指不作畫（Pencil 防誤觸）
    e.preventDefault();
    rectK = measureK(); // 起筆時量一次倍率
    calibrate(e);       // 起筆時定原點
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
    if (tool === "select") {
      const [x, y] = toPt(e);
      const bb = selBBox();
      if (bb) {
        // 角把手優先（0↔3、1↔2 互為對角＝縮放定錨）
        const corners: [number, number][] = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]];
        const hit = corners.findIndex((c) => Math.hypot(c[0] - x, c[1] - y) < HANDLE_HIT);
        if (hit >= 0) { selDrag = { mode: "scale", last: [x, y], anchor: corners[3 - hit] }; return; }
        if (x >= bb[0] - 8 && x <= bb[2] + 8 && y >= bb[1] - 8 && y <= bb[3] + 8) {
          selDrag = { mode: "move", last: [x, y], anchor: [0, 0] };
          return;
        }
      }
      sel = [];
      lasso = [[x, y]];
      render();
      return;
    }
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
    if (selDrag) {
      const [x, y] = toPt(e);
      const d = selDrag;
      if (d.mode === "move") {
        const dx = x - d.last[0], dy = y - d.last[1];
        if (dx || dy) transformSel((p) => [p[0] + dx, p[1] + dy, p[2]]);
        d.last = [x, y];
      } else {
        // 每步用「離定錨距離的比值」當倍率——連續乘上去，手感跟拉圖片角一樣
        const ax = d.anchor[0], ay = d.anchor[1];
        const d0 = Math.hypot(d.last[0] - ax, d.last[1] - ay);
        const d1 = Math.hypot(x - ax, y - ay);
        if (d0 > 4 && d1 > 4) {
          let k = d1 / d0;
          const bb = selBBox();
          if (bb && k < 1) {
            // 防縮到消失：整組最長邊縮到 12px 就停
            const longSide = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
            if (longSide > 0 && longSide * k < 12) k = 12 / longSide;
          }
          if (k !== 1) transformSel((p) => [ax + (p[0] - ax) * k, ay + (p[1] - ay) * k, p[2]]);
        }
        d.last = [x, y];
      }
      return;
    }
    if (lasso) {
      dropGhostStart(lasso, e);
      for (const ev of coalesced(e)) lasso.push(toPt(ev));
      render();
      return;
    }
    if (erasing) { eraseAt(e); return; }
    if (!drawing) return;
    dropGhostStart(drawing, e);
    for (const ev of coalesced(e)) drawing.push(toPt(ev));
    render();
  });
  // 髒起點防禦（2026-08-16 實機）：剛開編輯器立刻落筆，第一拍事件的 offset
  // 原點偶爾是髒的——起點被算到畫布左緣，跟第二拍連成一條橫貫直線。
  // 物理常識當守門：連續兩個取樣（4–8ms）不可能差 200 畫布px，第二拍
  // 進來發現起點離群就把它丟掉（calibrate 已用本拍重校過原點，本拍是準的）。
  const dropGhostStart = (pts: number[][], e: PointerEvent) => {
    if (pts.length !== 1) return;
    const p1 = toPt(e);
    if (Math.hypot(p1[0] - pts[0][0], p1[1] - pts[0][1]) > 200) pts.length = 0;
  };
  const finishStroke = () => {
    if (selDrag) { selDrag = null; return; }
    if (lasso) { finishLasso(); return; }
    if (erasing) {
      erasing = false;
      if (!erasedAny) undoStack.pop(); // 沒擦到東西＝不佔一步復原
      return;
    }
    if (!drawing) return;
    if (drawing.length > 1) {
      pushUndo(); // 快照＝「畫這筆之前」
      const tl = tool as "pen" | "marker";
      const stroke: SketchStroke = {
        tool: tl, pts: drawing,
        // 等於預設值就不寫＝沒動過粗細/顏色的檔案 byte-identical
        ...(sizes[tl] !== 1 ? { size: sizes[tl] } : {}),
        ...(color !== INK ? { color } : {}),
      };
      setCurStrokes([...curStrokes(), stroke]);
      // 新筆是作用層最上面一筆＝直接補畫進 active，免整層重建
      //（開檔冷建構期間連續作畫也不會把建構打掉重來）；作用層被眼睛
      // 藏起來的邊角＝不畫（與隱藏語義一致，rebuildActive 也會跳過）
      if (!(typeof layer === "number" && extras()[layer]?.hidden)) {
        paintStrokeInto(active.cx, stroke, strokeAlpha(stroke));
        dirtyActive = false;
      }
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
    // 工具列與圖層面板除外（preventDefault 會吃掉合成 click，按鈕就點不了）
    if (!(e.target as HTMLElement).closest(".sk-bar, .sk-layers")) e.preventDefault();
  };
  overlay.addEventListener("touchstart", palmGuard, { passive: false });
  overlay.addEventListener("touchmove", palmGuard, { passive: false });

  // ---- 工具列 ----
  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    // 面板開著時點外面＝先收面板；點的是背板就只收面板不關編輯器
    if (panelOpen && !t.closest(".sk-layers") && !t.closest("[data-sklayer]")) {
      closePanel();
      if (t === overlay) return;
    }
    const tb = t.closest("[data-sktool]") as HTMLElement | null;
    if (tb) {
      tool = tb.dataset.sktool as typeof tool;
      clearSel(); // 換工具＝選取解除
      syncBar();
      render();
      return;
    }
    const sb = t.closest("[data-sksize]") as HTMLElement | null;
    if (sb && (tool === "pen" || tool === "marker")) {
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
    if (t.closest("[data-sklayer]")) {
      panelOpen = !panelOpen;
      if (panelOpen) {
        renderLayers();
        // 面板貼在工具列正下方（工具列窄螢幕會換行，高度不固定）
        layersEl.style.top = `${(overlay.querySelector(".sk-bar") as HTMLElement).offsetHeight + 4}px`;
      }
      layersEl.classList.toggle("open", panelOpen);
      return;
    }
    if (t.closest("[data-skunder]")) {
      if (work.underlay) {
        pushUndo();
        work.underlay = null;
        underlayImg = null;
        invalidate();
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
      if (!curStrokes().length) return;
      pushUndo();
      setCurStrokes([]);
      clearSel();
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
    paintStatic(cx, false); // 壓平＝純塗鴉：不含墊底、不打淡、不含進行中筆畫與選取框
    const out = c.toDataURL("image/png"); // 線稿用 PNG：銳利且壓得小
    c.width = c.height = 0;
    return out;
  }

  function save() {
    // 自訂層全被刪光＝欄位整個拿掉（不留 "extra":[] 髒欄位）
    if (work.extra && !work.extra.length) delete work.extra;
    const hasInk = work.scene.length || work.figure.length || work.extra?.some((l) => l.strokes.length);
    if (!hasInk) {
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
    // 圖層改名對話框開著＝鍵盤讓給它（這裡是 capture，它自己 stopPropagation 擋不到我們）
    if (document.querySelector(".nd-overlay")) return;
    // 編輯器開著時鍵盤自己收：Esc 取消、⌘Z 復原（不讓全域 undo 動到案子）
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (panelOpen) { closePanel(); return; }            // 先收圖層面板
      if (sel.length || lasso) { clearSel(); render(); return; } // 再解除選取
      close();                                            // 都沒有才關編輯器
      return;
    }
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
    enabled: () => !drawing && !erasing && !selDrag && !lasso,
  });

  syncBar();
  loadUnderlay();
  render();
}
