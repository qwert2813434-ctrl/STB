import { bindEditKeys } from "./editKeys";
import { bindPointerDrag } from "./pointerDrag";
import type { Store } from "./store";
import { computeCutNumbers, perPage } from "./model";
import type { Cut } from "./model";
import { t, tf } from "./i18n";

// 渲染 STB 頁式版面。inline 編輯不觸發整頁重繪（避免游標跳）。
// expanded：暫時展開但還沒填字的 VO/Super 行（key = `${cutId}:vo`／`:sup`）。
// 多路：一次只顯示一路（上方路分頁切換）；filmOverride＝匯出時指定路（不出分頁列）。
export function renderStb(store: Store, root: HTMLElement, flashFromSeq = -1, expanded = new Set<string>(), filmOverride?: string) {
  const p = store.get();
  const filmId = filmOverride ?? (store.currentFilmId || p.films[0]?.id);
  const film = p.films.find((f) => f.id === filmId);
  // 匯出/簡報（filmOverride）：隱藏的 cut 完全不出現；編輯器照常列出（顯示為細灰格）
  const cuts = p.cuts.filter((c) => c.filmId === filmId && (!filmOverride || !c.hidden));
  const multi = p.films.length > 1;
  const portrait = p.aspect === "9:16";
  // 直式分鏡格密度（僅直式有意義）：密＝6 欄 12／頁；大＝4 欄 4／頁（閱讀舒服）
  const comfy = portrait && !store.portraitDense;
  const pp = portrait ? (store.portraitDense ? 12 : 4) : perPage(p.aspect);
  const numbers = computeCutNumbers(p.cuts, p.films);
  // 隱藏的不佔格位：畫成一條細線貼在前一顆可見 cut 之後（Keynote 跳過投影片邏輯）
  const visible = cuts.filter((c) => !c.hidden);
  const ghostAfter = new Map<string, typeof cuts>();
  {
    let lastVis: string | null = null;
    for (const c of cuts) {
      if (!c.hidden) { lastVis = c.id; continue; }
      const k = lastVis ?? "^";
      if (!ghostAfter.has(k)) ghostAfter.set(k, []);
      ghostAfter.get(k)!.push(c);
    }
  }
  // 方案4（Armin 定案 43125）：縫間半高圓頭短線，hover 伸長全高；連續隱藏合併一根
  const stickFor = (gs: typeof cuts, left = false) => {
    const withScout = gs.some((g) => g.scoutRef);
    return `<span class="ghost-stick${left ? " left" : ""}" data-unhide="${gs.map((g) => g.id).join(",")}" title="${tf("隱藏 {n} 顆{scout}——點一下顯示回來", { n: gs.length, scout: withScout ? t("（含場勘）") : "" })}"><i></i></span>`;
  };
  const pages = Math.max(1, Math.ceil(visible.length / pp));
  let html = "";

  // 路分頁（同 Day 分頁互動）：點切換；點「當前路」的名字＝直接改名；✕ 刪路
  if (!filmOverride) {
    html += `<div class="day-tabs film-tabs">`;
    for (const f of p.films) {
      const on = f.id === filmId;
      html += `<span class="daytab-wrap">
        <button class="daytab${on ? " on" : ""}" data-film="${f.id}" title="${on ? t("點名字直接改") : t("切換到這一路")}">${
          on
            ? `<span class="cut-edit" contenteditable draggable="false" data-filmname="${f.id}" data-ph="${t("路名")}">${esc(f.name)}</span>`
            : esc(f.name)
        }</button>
        ${p.films.length > 1 ? `<button class="daytab-del" data-delfilm="${f.id}" title="${t("刪除此路（含其分鏡）")}">✕</button>` : ""}
      </span>`;
    }
    html += `<button class="daytab-add" data-addfilm title="${t("一份 PPM 多支片：每路獨立 CUT 01 起跳")}">${t("＋ 一路")}</button></div>`;
  }

  // 直式：分鏡格密度切換（大／密）——純檢視偏好
  if (portrait && !filmOverride) {
    html += `<div class="board-density"><span class="bd-label">${t("分鏡格")}</span>
      <button data-density="comfy" class="${!store.portraitDense ? "on" : ""}" title="${t("4 欄・4 格一頁，閱讀舒服")}">${t("大")}</button>
      <button data-density="dense" class="${store.portraitDense ? "on" : ""}" title="${t("6 欄・12 格一頁，一次看更多")}">${t("密")}</button></div>`;
  }

  // 欄位列：景別／秒數顯示切換（純檢視偏好；日文版預設兩個都開）
  if (!filmOverride) {
    html += `<div class="board-density"><span class="bd-label">${t("欄位")}</span>
      <button data-fld="shot" class="${store.showShot ? "on" : ""}" title="${t("每顆 cut 顯示景別（W／M／CU）")}">${t("景別")}</button>
      <button data-fld="sec" class="${store.showSec ? "on" : ""}" title="${t("每顆 cut 顯示秒數，頁尾自動合計")}">${t("秒數")}</button></div>`;
  }

  // 場勘列：分鏡／場勘切換（有場勘才出現；hover「場勘」長出 ✕＝清除全部）＋匯入場勘＋新增 cut
  const hasScout = cuts.some((c) => c.scoutRef);
  if (!filmOverride) {
    html += `<div class="board-density scout-row">`;
    if (hasScout) {
      html += `<span class="bd-label">${t("顯示")}</span>
        <button data-scout="off" class="${!store.scoutMode ? "on" : ""}" title="${t("導演的分鏡圖")}">${t("分鏡")}</button>
        <span class="scout-wrap" data-scoutwrap>
          <button data-scout="on" class="${store.scoutMode ? "on" : ""}" title="${t("攝影師 STB Camera 帶回的現場鏡位圖")}">${t("場勘")}</button>
          <button class="scout-clear" data-scoutclear title="${t("刪除本案全部場勘圖（分鏡不動，⌘Z 可復原）")}">✕</button>
        </span>`;
    }
    html += `<button data-scoutimport title="${t("匯入 STB Camera 拍回來的場勘包（.stb）——照片按 cut 自動對位，分鏡圖不會動")}">${t("匯入場勘")}</button>`;
    html += `<button data-addcut title="${t("在選取的 cut 之後新增一顆（沒選＝加在最後）")}">${t("＋ 新增 cut")}</button>`;
    html += `</div>`;
  }

  for (let pg = 0; pg < pages; pg++) {
    html += `<p class="page-label">STB${multi ? ` · ${esc(film?.name ?? "")}` : ""} · ${tf("頁 {a} / {b}", { a: pg + 1, b: pages })} · ${portrait ? t("直式 9:16") : t("A5 橫")}${store.showSec ? secTotalLabel(visible) : ""}</p>`;
    html += `<div class="page${portrait ? " portrait" : ""}${comfy ? " comfy" : ""}">`;
    for (let slot = 0; slot < pp; slot++) {
      const seq = pg * pp + slot;
      const cut = visible[seq];
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
      // 場勘模式：縮圖顯示 scoutRef（現場鏡位圖）、不出塗鴉鈕；沒拍到標「無場勘」。
      // 分鏡模式（預設）：一切照舊，imageRef 永不被場勘覆蓋。
      const scout = store.scoutMode;
      const meta = cut.scoutMeta;
      const thumbInner = scout
        ? (cut.scoutRef
            ? `<img src="${cut.scoutRef}" alt="${t("場勘")}" draggable="false">${meta ? `<span class="scout-meta">${meta.focal}mm · ${meta.system === "s35" ? "S35" : t("全幅")}</span>` : ""}<button class="thumb-save" data-saveimg="${cut.id}" title="${t("存這張場勘圖")}">⬇</button><button class="thumb-delscout" data-delscout="${cut.id}" title="${t("刪除這張場勘圖（分鏡不動）")}">✕</button>`
            : `<span class="thumb-add">${t("＋ 場勘圖")}</span>`)
        : `${cut.imageRef
            ? `<img src="${cut.imageRef}" alt="${t("分鏡")}" draggable="false">`
            : `<span class="thumb-add">${t("＋ 分鏡圖")}</span>`
          }<button class="thumb-sketch" data-sketch="${cut.id}" title="${t("塗鴉分鏡（Apple Pencil／滑鼠）")}">✏️</button>${cut.imageRef ? `<button class="thumb-save" data-saveimg="${cut.id}" title="${t("把這張分鏡圖存成檔案")}">⬇</button>` : ""}`;

      // cut-head 整條當拖曳把手（自製指標手勢）；文字/圖片區照常點擊打字
      html += `
        <div class="cut${grouped}${sel}" data-id="${cut.id}">
          <div class="cut-head" data-id="${cut.id}" title="${t("拖曳移動整張卡")}">
            <span class="cut-grip">⠿</span>
            <span class="cut-no${flash}">${tf("CUT {label}", { label: n.label })}</span>
            <button class="cut-hide" data-hide="${cut.id}" title="${t("隱藏這顆（預覽/匯出看不見、不佔編號；點灰格顯示回來）")}">${t("隱藏")}</button>
          </div>
          <div class="cut-thumb${scout ? " scout" : ""}"${scout ? (cut.scoutRef ? ` data-scoutedit="${cut.id}"` : ` data-scoutadd="${cut.id}"`) : ""} data-thumb="${scout ? "" : cut.id}">${thumbInner}</div>
          <div class="cut-line cut-desc" contenteditable draggable="false" data-id="${cut.id}" data-f="desc" data-ph="${t("畫面描述")}">${esc(cut.desc)}</div>
          ${showVo ? `<div class="cut-line-row cut-vo"><span class="tag">${t("VO")}</span><span class="cut-edit" contenteditable draggable="false" data-id="${cut.id}" data-f="vo" data-ph="${t("旁白 / 台詞")}">${esc(cut.vo)}</span></div>` : ""}
          ${showSup ? `<div class="cut-line-row cut-sup"><span class="tag">${t("SUPER")}</span><span class="cut-edit" contenteditable draggable="false" data-id="${cut.id}" data-f="sup" data-ph="${t("疊印字卡")}">${esc(cut.sup)}</span></div>` : ""}
          ${store.showShot || store.showSec ? `<div class="cut-meta">
            ${store.showShot ? `<span class="cm-pair"><span class="cm-k">${t("景別")}</span><span class="cut-edit cm-v" contenteditable draggable="false" data-id="${cut.id}" data-f="shot" data-ph="—">${esc(cut.shot)}</span></span>` : ""}
            ${store.showSec ? `<span class="cm-pair"><span class="cm-k">${t("秒數")}</span><span class="cut-edit cm-v" contenteditable draggable="false" data-id="${cut.id}" data-f="sec" data-ph="—">${cut.sec ?? ""}</span></span>` : ""}
          </div>` : ""}
          ${ghostAfter.has(cut.id) ? stickFor(ghostAfter.get(cut.id)!) : ""}
          ${seq === 0 && ghostAfter.has("^") ? stickFor(ghostAfter.get("^")!, true) : ""}
        </div>`;
    }
    html += `</div>`;
  }
  root.innerHTML = html;
}

// 頁尾合計秒數（日本絵コンテ慣例：CM 要剛好 15 或 30 秒，所以順便標出離目標還差多少）。
// 只在「有人真的填過秒數」時才出現，避免全空時掛一個「合計 0 秒」。
function secTotalLabel(cuts: Cut[]): string {
  const filled = cuts.filter((c) => typeof c.sec === "number");
  if (!filled.length) return "";
  const total = Math.round(filled.reduce((s, c) => s + (c.sec ?? 0), 0) * 10) / 10;
  const target = [15, 30, 60].find((x) => Math.abs(total - x) <= x * 0.34);
  const diff = target ? Math.round((total - target) * 10) / 10 : 0;
  const hint = target && diff !== 0
    ? `（${target}${t("秒")} ${diff > 0 ? "+" : ""}${diff}）`
    : target ? `（${target}${t("秒")} ✓）` : "";
  const miss = filled.length < cuts.length ? tf("・{n} 顆未填", { n: cuts.length - filled.length }) : "";
  return ` · ${tf("合計 {n} 秒", { n: total })}${hint}${miss}`;
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
  // 長按「場勘」chip＝暫時長出清除 ✕（觸控沒有 hover；Armin：常駐太怪、按鈕要少）
  {
    let timer = 0;
    root.addEventListener("pointerdown", (e) => {
      const wrap = (e.target as HTMLElement).closest("[data-scoutwrap]") as HTMLElement | null;
      if (!wrap || e.pointerType === "mouse") return;
      timer = window.setTimeout(() => {
        wrap.classList.add("show-clear");
        window.setTimeout(() => wrap.classList.remove("show-clear"), 4000);
      }, 450);
    });
    const cancel = () => window.clearTimeout(timer);
    root.addEventListener("pointerup", cancel);
    root.addEventListener("pointercancel", cancel);
    root.addEventListener("pointermove", cancel);
  }

  // 長按卡片＝進入多選模式（iPad 沒有 ⌘ 鍵；04 企劃「多選改長按」）。
  // 編輯字、拖曳把手不攔（各有原生行為）；手指動了＝要捲動/拖曳，不是長按。
  let lp: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
  let lpFired = false;
  const lpCancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  root.addEventListener("pointerdown", (e) => {
    // 新手勢開始＝上一次長按的「吞 click」旗標作廢——iOS 長按放開常常
    // 根本不發 click，旗標殘留會把下一次正常點擊吃掉（Armin 實測：
    // 第二張卡看起來選了、底下卻還是「已選 1 顆」的元凶之一）
    lpFired = false;
    if (e.pointerType === "mouse") return;
    const t = e.target as HTMLElement;
    if (t.isContentEditable || t.closest(".cut-head")) return;
    const id = (t.closest(".cut") as HTMLElement | null)?.dataset.id;
    if (!id) return;
    lp = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        lp = null;
        lpFired = true;
        (document.activeElement as HTMLElement | null)?.blur?.(); // 收鍵盤/焦點框
        const wasMode = store.touchSelect;
        store.touchSelect = true;
        if (!store.selectedIds.includes(id)) store.toggleSelect(id); // 進場並選上這張（emit 重繪）
        else if (!wasMode) store.select(id); // 已是單選：只是升級成模式 UI（emit 重繪）
      }, 450),
    };
  });
  root.addEventListener("pointermove", (e) => {
    if (lp && Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) > 8) lpCancel();
  });
  root.addEventListener("pointerup", lpCancel);
  root.addEventListener("pointercancel", lpCancel);

  root.addEventListener("click", (e) => {
    // 長按剛成立：吞掉隨後那一下 click（否則立刻又 toggle 回去）
    if (lpFired) { lpFired = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    const t0 = e.target as HTMLElement;
    // 隱藏／顯示單顆 cut
    const hd = t0.closest("[data-hide]") as HTMLElement | null;
    if (hd) { store.setHidden(hd.dataset.hide!, true); return; }
    const uh = t0.closest("[data-unhide]") as HTMLElement | null;
    if (uh) { store.showCuts(uh.dataset.unhide!.split(",")); return; }
    // 分鏡格密度切換（大／密）——純檢視偏好，不動資料
    const dens = t0.closest("[data-density]") as HTMLElement | null;
    if (dens) { store.setPortraitDense(dens.dataset.density === "dense"); return; }
    // 景別／秒數欄顯示切換（點一下＝開關，純檢視偏好）
    const fld = t0.closest("[data-fld]") as HTMLElement | null;
    if (fld) {
      if (fld.dataset.fld === "shot") store.setShowShot(!store.showShot);
      else store.setShowSec(!store.showSec);
      return;
    }
    // 分鏡／場勘顯示切換（純檢視偏好）
    const sc = t0.closest("[data-scout]") as HTMLElement | null;
    if (sc) { store.setScoutMode(sc.dataset.scout === "on"); return; }
    // 路分頁：切換／新增／刪除（當前路的名字是可編輯區，會走下面的早退不切換）
    if (t0.closest("[data-addfilm]")) { store.addFilm(); return; }
    const delFilm = t0.closest("[data-delfilm]") as HTMLElement | null;
    if (delFilm) {
      const p = store.get();
      const f = p.films.find((x) => x.id === delFilm.dataset.delfilm);
      const n = p.cuts.filter((c) => c.filmId === f?.id).length;
      if (f && confirm(tf("刪除「{name}」？此路的 {n} 顆分鏡（含 Rundown 指派）會一併刪除。", { name: f.name, n }))) {
        store.deleteFilm(f.id);
      }
      return;
    }
    const filmTab = t0.closest("[data-film]") as HTMLElement | null;
    if (filmTab && !t0.isContentEditable) { store.setFilm(filmTab.dataset.film!); return; }

    const cut = t0.closest(".cut") as HTMLElement | null;
    // 觸控多選模式（長按進入）：點卡片＝加選/取消（觸控版的 ⌘ 點擊）。
    // stopImmediatePropagation：模式中點縮圖不能觸發換圖（main 的 thumb handler）。
    // 點空白「不」結束模式——結束只有一個出口：底欄「完成」
    //（Armin 拍板：避免多選到一半誤點空白全部消失）。
    // 加選/取消＝就地換妝（silent toggle＋classList），不整頁重繪——
    // 黑框與計數由同一份資料同步驅動，不可能分家（黑框殘影 bug 的正解）
    if (store.touchSelect) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cut) {
        const id = cut.dataset.id!;
        store.toggleSelect(id, true);
        if (!store.touchSelect) { store.select(null); return; } // 全取消＝結束模式（整頁重繪）
        cut.classList.toggle("sel", store.isSelected(id));
        document.dispatchEvent(new Event("stb:selchange")); // 底欄計數跟上
      }
      return;
    }
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
      // 路名改名（路分頁上的可編輯字）
      if (el.dataset.filmname) {
        store.renameFilm(el.dataset.filmname, (el.textContent || "").trim());
        return;
      }
      const id = el.dataset.id!;
      // 秒數是數字欄，走自己的解析（全形數字/單位都吃得下，空值＝拿掉欄位）
      if (el.dataset.f === "sec") { store.editSec(id, el.innerText || ""); return; }
      const field = el.dataset.f as "desc" | "vo" | "sup" | "shot";
      // tag 已移出可編輯區，直接取純文字。
      // 用 innerText 不用 textContent：shift+enter 產生的 <br> 在 textContent 會被吃掉
      // （兩段還會黏成一行），innerText 才會還原成 \n。搭配 CSS white-space: pre-wrap 顯示。
      const text = (el.innerText || "").trim();
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

  // 拖曳排序（抓 cut-head）：共用指標拖曳（跟手＋彈回，見 pointerDrag.ts）
  bindPointerDrag({
    root,
    handleSel: ".cut-head",
    itemSel: ".cut",
    idOf: (el) => el.dataset.id,
    onDrop: (from, to) => { store.moveGroup(from, to); onChange(0); },
  });
}
