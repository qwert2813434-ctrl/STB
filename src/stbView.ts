import { bindEditKeys } from "./editKeys";
import { bindPointerDrag } from "./pointerDrag";
import type { Store } from "./store";
import { computeCutNumbers, pageCount, PER_PAGE } from "./model";

// 渲染 STB 頁式版面。inline 編輯不觸發整頁重繪（避免游標跳）。
// expanded：暫時展開但還沒填字的 VO/Super 行（key = `${cutId}:vo`／`:sup`）。
// 多路：一次只顯示一路（上方路分頁切換）；filmOverride＝匯出時指定路（不出分頁列）。
export function renderStb(store: Store, root: HTMLElement, flashFromSeq = -1, expanded = new Set<string>(), filmOverride?: string) {
  const p = store.get();
  const filmId = filmOverride ?? (store.currentFilmId || p.films[0]?.id);
  const film = p.films.find((f) => f.id === filmId);
  const cuts = p.cuts.filter((c) => c.filmId === filmId);
  const multi = p.films.length > 1;
  const numbers = computeCutNumbers(p.cuts, p.films);
  const pages = pageCount(cuts.length);
  let html = "";

  // 路分頁（同 Day 分頁互動）：點切換；點「當前路」的名字＝直接改名；✕ 刪路
  if (!filmOverride) {
    html += `<div class="day-tabs film-tabs">`;
    for (const f of p.films) {
      const on = f.id === filmId;
      html += `<span class="daytab-wrap">
        <button class="daytab${on ? " on" : ""}" data-film="${f.id}" title="${on ? "點名字直接改" : "切換到這一路"}">${
          on
            ? `<span class="cut-edit" contenteditable draggable="false" data-filmname="${f.id}" data-ph="路名">${esc(f.name)}</span>`
            : esc(f.name)
        }</button>
        ${p.films.length > 1 ? `<button class="daytab-del" data-delfilm="${f.id}" title="刪除此路（含其分鏡）">✕</button>` : ""}
      </span>`;
    }
    html += `<button class="daytab-add" data-addfilm title="一份 PPM 多支片：每路獨立 CUT 01 起跳">＋ 一路</button></div>`;
  }

  for (let pg = 0; pg < pages; pg++) {
    html += `<p class="page-label">STB${multi ? ` · ${esc(film?.name ?? "")}` : ""} · 頁 ${pg + 1} / ${pages} · A5 橫</p>`;
    html += `<div class="page">`;
    for (let slot = 0; slot < PER_PAGE; slot++) {
      const seq = pg * PER_PAGE + slot;
      const cut = cuts[seq];
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
  // 長按卡片＝進入多選模式（iPad 沒有 ⌘ 鍵；04 企劃「多選改長按」）。
  // 編輯字、拖曳把手不攔（各有原生行為）；手指動了＝要捲動/拖曳，不是長按。
  let lp: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
  let lpFired = false;
  const lpCancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  root.addEventListener("pointerdown", (e) => {
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
    // 路分頁：切換／新增／刪除（當前路的名字是可編輯區，會走下面的早退不切換）
    if (t0.closest("[data-addfilm]")) { store.addFilm(); return; }
    const delFilm = t0.closest("[data-delfilm]") as HTMLElement | null;
    if (delFilm) {
      const p = store.get();
      const f = p.films.find((x) => x.id === delFilm.dataset.delfilm);
      const n = p.cuts.filter((c) => c.filmId === f?.id).length;
      if (f && confirm(`刪除「${f.name}」？此路的 ${n} 顆分鏡（含 Rundown 指派）會一併刪除。`)) {
        store.deleteFilm(f.id);
      }
      return;
    }
    const filmTab = t0.closest("[data-film]") as HTMLElement | null;
    if (filmTab && !t0.isContentEditable) { store.setFilm(filmTab.dataset.film!); return; }

    const cut = t0.closest(".cut") as HTMLElement | null;
    // 觸控多選模式（長按進入）：點卡片＝加選/取消（觸控版的 ⌘ 點擊）。
    // stopImmediatePropagation：模式中點縮圖不能觸發換圖（main 的 thumb handler）
    if (cut && store.touchSelect) {
      e.preventDefault();
      e.stopImmediatePropagation();
      store.toggleSelect(cut.dataset.id!);
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

  // 拖曳排序（抓 cut-head）：共用指標拖曳（跟手＋彈回，見 pointerDrag.ts）
  bindPointerDrag({
    root,
    handleSel: ".cut-head",
    itemSel: ".cut",
    idOf: (el) => el.dataset.id,
    onDrop: (from, to) => { store.moveGroup(from, to); onChange(0); },
  });
}
