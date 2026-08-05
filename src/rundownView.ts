import { bindEditKeys } from "./editKeys";
import { bindPointerDrag } from "./pointerDrag";
import type { Store } from "./store";
import { computeCutNumbers, chainRundown, hhmmToMin, minToHHMM, BLOCK_TYPE_LABELS, type RundownBlock } from "./model";
import { openCutPicker, fileToWorkingImage, pickFiles } from "./cutPicker";
import { openCropper } from "./cropper";
import { saveImageAs } from "./persistence";
import { t, tf } from "./i18n";

// 分頁估高：不分頁的話一頁越排越長，簡報 fitNow() 會把整頁縮到看不見
//（Armin 2026-08-05 回報）。時段高度差很多（有無縮圖／停車圖），固定「N 個一頁」
// 會一頁爆滿一頁空，所以按估高打包。單位＝簡報 1560px 設計寬下的 px（版面上限在那條路，
// 編輯器頁高本來就隨內容捲動）。
// 常數是 dev-tests/rundown-page-test.html 量出來校準的，改版面就重跑那支。
const PAGE_BUDGET = 800; // 內容上限：880（簡報框）− 40（.page padding）− 30（頁標）
function blockHeight(b: RundownBlock, portrait: boolean): number {
  const thumbRows = Math.ceil(b.cutIds.length / 6);   // 縮圖 96px 寬，媒體欄一列約 6 顆
  const media = thumbRows * (portrait ? 191 : 74);
  const text = 78 + (b.parkImage ? 98 : 0);           // 地點/停車/道具三行（＋停車圖）
  return 54 + Math.max(media, text);                  // 54＝上下留白＋標題列
}
function paginate(blocks: RundownBlock[], portrait: boolean): RundownBlock[][] {
  const pages: RundownBlock[][] = [[]];
  let used = 0;
  for (const b of blocks) {
    const h = blockHeight(b, portrait);
    if (used && used + h > PAGE_BUDGET) { pages.push([]); used = 0; } // used>0 才換頁＝超高的單塊自己一頁，不留空頁
    pages[pages.length - 1].push(b);
    used += h;
  }
  return pages;
}

// 渲染 Rundown 拍攝日程頁：真實時間區塊、地點/停車/道具、指派的 cut（顯示編號）。
export function renderRundown(store: Store, root: HTMLElement, dayOverride?: import("./model").ShootDay) {
  const p = store.get();
  const numbers = computeCutNumbers(p.cuts, p.films);
  const day = dayOverride ?? store.currentDay();
  if (!day) { root.innerHTML = ""; return; }
  const times = chainRundown(day.rundown, hhmmToMin(day.callTime));

  const portrait = p.aspect === "9:16"; // 指派的分鏡縮圖跟隨整片比例（停車照另計，維持橫式）
  const rowHtml = (b: RundownBlock, i: number) => {
    const tm = times[i];
    let cutsHtml = "";
    for (const cid of b.cutIds) {
      const n = numbers.get(cid);
      if (!n) continue;
      const cut = p.cuts.find((c) => c.id === cid);
      const box = cut?.imageRef ? `<img src="${cut.imageRef}" alt="" draggable="false">` : "▢";
      cutsHtml += `<span class="rd-cut${portrait ? " portrait" : ""}"><span class="rd-cut-box${portrait ? " portrait" : ""}">${box}</span><span class="rd-cut-no">${n.label}</span></span>`;
    }
    return `
      <div class="rd-row" data-block="${b.id}">
        <span class="rd-grip" data-block="${b.id}" title="${t("拖曳排序")}">⠿</span>
        <div class="rd-time">${minToHHMM(tm.start)}–${minToHHMM(tm.end)}</div>
        <div class="rd-main">
          <div class="rd-head">
            <span class="rd-type" data-btype="${b.id}" title="${t("點擊切換類型")}" role="button">${t(BLOCK_TYPE_LABELS[b.type])}</span>
            <span class="rd-title cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="title" data-ph="${t("時段名稱")}">${esc(b.title)}</span>
          </div>
          <div class="rd-cols">
            <div class="rd-col-media">
              ${cutsHtml ? `<div class="rd-cuts">${cutsHtml}</div>` : ""}
              <div class="rd-tools">
                <button class="ref-mini" data-assigncuts="${b.id}"><i>⌗</i> ${t("對照分鏡")}</button>
                <button class="ref-mini" data-parkimg="${b.id}">${t("＋ 停車圖")}</button>
              </div>
            </div>
            <div class="rd-col-text">
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">${t("地點")}</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="loc" data-ph="${t("地點")}">${esc(b.loc)}</span></span>
              </div>
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">${t("停車")}</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="park" data-ph="${t("停車資訊")}">${esc(b.park)}</span></span>
              </div>
              <div class="rd-sub">
                <span class="rd-pair"><span class="rd-k">${t("道具")}</span><span class="cut-edit" contenteditable draggable="false" data-bitem="${b.id}" data-bf="props" data-ph="${t("道具準備")}">${esc(b.props)}</span></span>
              </div>
              ${b.parkImage ? `<div class="rd-parkrow"><span class="rd-park"><img src="${b.parkImage}" alt="${t("停車位置")}" data-parkedit="${b.id}" draggable="false"><span class="rd-park-tag">${t("停車")}</span><button class="rd-park-save" data-parksave="${b.id}" title="${t("把停車圖存成檔案")}">⬇</button><button class="rd-park-x" data-parkdel="${b.id}" aria-label="${t("移除停車圖")}">✕</button></span></div>` : ""}
            </div>
          </div>
        </div>
        <div class="rd-adj">
          <button data-block="${b.id}" data-d="-5" aria-label="${t("減 5 分")}">−5</button>
          <span class="rd-dur">${tf("{n} 分", { n: b.durMin })}</span>
          <button data-block="${b.id}" data-d="5" aria-label="${t("加 5 分")}">+5</button>
          <button class="rd-del" data-del="${b.id}" aria-label="${t("刪除時段")}">✕</button>
        </div>
      </div>`;
  };

  const pages = paginate(day.rundown, portrait);
  let html = "";
  let seq = 0;
  pages.forEach((blocks, pg) => {
    const pn = pages.length > 1 ? ` · ${tf("頁 {a} / {b}", { a: pg + 1, b: pages.length })}` : "";
    html += `<p class="page-label">${t("Rundown · 拍攝日程 · A5 橫")}${pn}</p><div class="page rundown">`;
    for (const b of blocks) html += rowHtml(b, seq++);
    // 新增鈕只掛最後一頁（時段一律接在最後）
    if (pg === pages.length - 1) html += `<div class="rd-addrow"><button data-addblock>${t("＋ 新增時段")}</button></div>`;
    html += `</div>`;
  });
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
    // ⬇＝把停車圖存成檔案（現場常要單獨傳給司機／製片）
    const ps = t.closest("[data-parksave]") as HTMLElement | null;
    if (ps) {
      const p2 = store.get();
      const blk = p2.days.flatMap((d) => d.rundown).find((x) => x.id === ps.dataset.parksave);
      if (blk?.parkImage) void saveImageAs(blk.parkImage, `${p2.meta.title || "案子"}_停車_${blk.title || blk.id}`);
      return;
    }
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

  // 區塊拖曳排序：共用指標拖曳（跟手＋彈回，見 pointerDrag.ts）。
  // 把手＝⠿＋時間欄（時間是機器算的不可編輯，正好當大面積拖曳區——
  // iPad 實測：⠿ 太小，手指落在時間上會觸發 iOS 選字）。
  // 放開後時間鏈由 chainRundown 重算。
  bindPointerDrag({
    root,
    handleSel: ".rd-grip, .rd-time",
    itemSel: ".rd-row",
    idOf: (el) => el.dataset.block,
    onDrop: (from, to) => store.moveBlock(from, to),
  });
}

async function pickParkImage(store: Store, blockId: string) {
  const [f] = await pickFiles("image/*", false);
  if (!f) return;
  // 先縮成工作圖再裁（iPad：原檔直餵會耗盡解碼資源）
  const url = await fileToWorkingImage(f);
  if (!url) { alert(t("這張照片讀不進來——若原檔還在 iCloud，等幾秒再試一次。")); return; }
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
