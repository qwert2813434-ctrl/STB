// 配對板（R3）：STBC 自建包選「當場勘圖」時，把照片手動對到本案既有分鏡。
// 互動＝點左邊照片（亮起）→ 點右邊分鏡格＝連上；配掉的照片從左欄消失（遞補）；
// 點已配的格＝解除（照片回到左欄）；「復原」＝退掉上一步配對。
// 「照順序自動配」一鍵預填；沒配到的照片略過；匯入＝單一 undo 步、只寫 scoutRef/scoutMeta。
import type { Store } from "./store";
import type { Cut } from "./model";
import { computeCutNumbers, aspectSpec } from "./model";
import { t, tf } from "./i18n";

export interface ScoutPhoto {
  scoutRef: string;
  scoutMeta: Cut["scoutMeta"];
  desc: string;
}

// 配對板只看構圖：開板先縮成小圖（原圖 1600px 反覆解碼＝iPad 記憶體牆風險、點擊重繪卡頓）
function thumb(src: string, max = 360): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      if (sc >= 1) return res(src);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => res(src);
    img.src = src;
  });
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

// 三岔路選擇窗：對不上的包要「當新的一路」還是「當場勘圖（配對板）」
export function openImportChoice(cutCount: number, shotCount: number, allowProject = false): Promise<"film" | "scout" | "project" | null> {
  return new Promise((res) => {
    const ov = document.createElement("div");
    ov.className = "mb-overlay";
    ov.innerHTML = `<div class="mb-panel mb-choice">
      <div class="mb-title">${t("這個包對不上本案的 cut")}</div>
      <p class="mb-p">${tf("{c} 顆 cut、已拍 {s} 張照片——像是 STBC 自建或其他專案的分鏡包。要怎麼用？", { c: cutCount, s: shotCount })}</p>
      <button class="mb-big" data-c="film">${t("當新的一路")}<span>${t("整包加成新的一路（B路/C路…），照片＝該路分鏡圖")}</span></button>
      <button class="mb-big" data-c="scout"${shotCount ? "" : " disabled"}>${t("當場勘圖（手動對位）")}<span>${t("開配對板，把照片對到本案既有的分鏡格")}</span></button>
      ${allowProject ? `<button class="mb-big" data-c="project">${t("開成新專案")}<span>${t("跟本案無關——另開一個獨立專案，照片＝分鏡圖")}</span></button>` : ""}
      <button class="mb-cancel">${t("取消")}</button>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest("[data-c]") as HTMLElement | null;
      if (b && !(b as HTMLButtonElement).disabled) { ov.remove(); res(b.dataset.c as "film" | "scout" | "project"); return; }
      if (t.closest(".mb-cancel") || t === ov) { ov.remove(); res(null); }
    });
  });
}

export async function openMatchBoard(store: Store, photos: ScoutPhoto[]) {
  const p = store.get();
  const cuts = p.cuts.filter((c) => !c.hidden); // 隱藏的不進配對板（它們是摺起來的）
  // 縮圖先備好（顯示用小圖；匯入寫回的仍是原圖）
  const photoThumbs = await Promise.all(photos.map((ph) => thumb(ph.scoutRef)));
  const cutThumbs = new Map<string, string>();
  await Promise.all(cuts.filter((c) => c.imageRef).map(async (c) => {
    cutThumbs.set(c.id, await thumb(c.imageRef!));
  }));
  const numbers = computeCutNumbers(p.cuts, p.films);
  const pad = (100 / aspectSpec(p.aspect).ar).toFixed(2); // 比例跟案子走（表驅動）：padding-top % 撐高
  const assign = new Map<number, string>();             // 照片 idx → cutId
  const history: { pi: number; cid: string }[] = [];    // 配對步驟（復原用）
  let sel = 0;

  const nextUnassigned = (from: number): number => {
    for (let k = 0; k < photos.length; k++) {
      const n = (from + k) % photos.length;
      if (!assign.has(n)) return n;
    }
    return -1; // 全配完
  };

  const ov = document.createElement("div");
  ov.className = "mb-overlay" + (p.aspect === "9:16" ? " mb-portrait" : "");
  ov.innerHTML = `<div class="mb-panel">
    <div class="mb-head">
      <span class="mb-title">${t("配對板")}</span>
      <span class="mb-hint">${t("點左邊照片 → 點右邊分鏡格＝連上（照片會遞補消失）；點已配的格＝退回；配錯按「復原」。")}</span>
      <button class="mb-auto" title="${t("照片 #1 對第 1 格、#2 對第 2 格…（拍攝順序＝分鏡順序時一鍵完成）")}">${t("照順序自動配")}</button>
      <button class="mb-next" title="${t("捲到下一個還沒配到照片的分鏡格（保證不漏格）")}">${t("下一個未配格")}</button>
      <button class="mb-undo" title="${t("退掉上一步配對（照片回到左欄）")}">${t("復原")}</button>
      <button class="mb-clearall">${t("清空")}</button>
      <button class="mb-go">${t("匯入")}</button>
      <button class="mb-x" aria-label="${t("關閉")}">✕</button>
    </div>
    <div class="mb-body">
      <div class="mb-photos"></div>
      <div class="mb-cuts"></div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const photosEl = ov.querySelector(".mb-photos") as HTMLElement;
  const cutsEl = ov.querySelector(".mb-cuts") as HTMLElement;
  const goBtn = ov.querySelector(".mb-go") as HTMLButtonElement;
  const undoBtn = ov.querySelector(".mb-undo") as HTMLButtonElement;

  const photoOfCut = (cutId: string): number | null => {
    for (const [i, cid] of assign) if (cid === cutId) return i;
    return null;
  };

  function render() {
    // 左欄：只列未配對的（遞補）；全配完顯示完成訊息
    const remaining = photos.map((ph, i) => ({ ph, i })).filter(({ i }) => !assign.has(i));
    photosEl.innerHTML = remaining.length
      ? remaining.map(({ ph, i }) => {
          const focal = ph.scoutMeta?.focal ? `${ph.scoutMeta.focal}mm` : "";
          return `<div class="mb-ph${i === sel ? " sel" : ""}" data-ph="${i}">
            <div class="mb-ph-th" style="padding-top:${pad}%"><img src="${photoThumbs[i]}" draggable="false"></div>
            <div class="mb-ph-cap"><b>#${i + 1}</b>${focal ? ` ${focal}` : ""}</div>
          </div>`;
        }).join("")
      : `<div class="mb-alldone">${t("照片都配完了——檢查右邊再按「匯入」。")}</div>`;

    const multi = p.films.length > 1;
    let html = "";
    for (const f of p.films) {
      const sub = cuts.filter((c) => c.filmId === f.id);
      if (!sub.length) continue;
      if (multi) html += `<div class="mb-film">${esc(f.name)}</div>`;
      html += `<div class="mb-grid">` + sub.map((c) => {
        const pi = photoOfCut(c.id);
        return `<div class="mb-cut${pi != null ? " done" : ""}" data-cut="${c.id}" title="${esc(c.desc || "")}${pi != null ? t("（點一下退回照片）") : ""}">
          <div class="mb-cut-th" style="padding-top:${pad}%">
            ${cutThumbs.has(c.id) ? `<img src="${cutThumbs.get(c.id)}" draggable="false">` : `<span class="mb-noimg">${t("無分鏡圖")}</span>`}
            ${sel >= 0 && photos[sel] && pi == null ? `<img class="mb-ghost" src="${photoThumbs[sel]}" draggable="false">` : ""}
            ${pi != null
              ? `<img class="mb-mini" src="${photoThumbs[pi]}" draggable="false"><span class="mb-badge">#${pi + 1}</span>`
              : (c.scoutRef ? `<span class="mb-hasscout">${t("已有場勘")}</span>` : "")}
          </div>
          <div class="mb-cut-cap">CUT ${numbers.get(c.id)?.label ?? ""}</div>
        </div>`;
      }).join("") + `</div>`;
    }
    cutsEl.innerHTML = html;
    goBtn.textContent = tf("匯入 {n} 組", { n: assign.size });
    goBtn.disabled = assign.size === 0;
    undoBtn.disabled = history.length === 0;
    photosEl.querySelector(".mb-ph.sel")?.scrollIntoView({ block: "nearest" });
  }

  ov.addEventListener("click", (e) => {
    const el = e.target as HTMLElement;
    if (el.closest(".mb-x") || el === ov) { ov.remove(); return; }
    if (el.closest(".mb-auto")) {
      assign.clear(); history.length = 0;
      photos.forEach((_, i) => {
        if (cuts[i]) { assign.set(i, cuts[i].id); history.push({ pi: i, cid: cuts[i].id }); }
      });
      sel = nextUnassigned(0);
      render();
      return;
    }
    if (el.closest(".mb-undo")) {
      const last = history.pop();
      if (!last) return;
      assign.delete(last.pi);
      sel = last.pi; // 退回的照片直接變成目前選取，馬上能重配
      render();
      return;
    }
    if (el.closest(".mb-clearall")) { assign.clear(); history.length = 0; sel = 0; render(); return; }
    if (el.closest(".mb-next")) {
      const target = cuts.find((c) => photoOfCut(c.id) == null);
      if (!target) { alert(t("每一格都配到了。")); return; }
      const cell = cutsEl.querySelector(`[data-cut="${target.id}"] .mb-cut-th`) as HTMLElement | null;
      if (cell) {
        cell.scrollIntoView({ behavior: "smooth", block: "center" });
        cell.classList.add("flash");
        setTimeout(() => cell.classList.remove("flash"), 1200);
      }
      return;
    }
    if (el.closest(".mb-go")) {
      const overwrite = [...assign.values()].filter((cid) => cuts.find((c) => c.id === cid)?.scoutRef).length;
      if (overwrite && !confirm(tf("{n} 格已有場勘會被新照片覆蓋，繼續？", { n: overwrite }))) return;
      const skipped = photos.length - assign.size;
      store.importScout(
        [...assign].map(([i, cid]) => ({ id: cid, scoutRef: photos[i].scoutRef, scoutMeta: photos[i].scoutMeta })),
      );
      ov.remove();
      alert(tf("已匯入 {n} 組{skipped}。", { n: assign.size, skipped: skipped ? tf("；{k} 張未配對略過", { k: skipped }) : "" }));
      return;
    }
    const ph = el.closest("[data-ph]") as HTMLElement | null;
    if (ph) { sel = Number(ph.dataset.ph); render(); return; }
    const cutEl = el.closest("[data-cut]") as HTMLElement | null;
    if (cutEl) {
      const cid = cutEl.dataset.cut!;
      const cur = photoOfCut(cid);
      if (cur != null) {
        // 點已配的格＝退回（照片回左欄並變成目前選取）
        assign.delete(cur);
        const hIdx = history.findIndex((h) => h.pi === cur && h.cid === cid);
        if (hIdx >= 0) history.splice(hIdx, 1);
        sel = cur;
        render();
        return;
      }
      if (sel < 0 || !photos[sel] || assign.has(sel)) { sel = nextUnassigned(0); render(); return; }
      assign.set(sel, cid);
      history.push({ pi: sel, cid });
      sel = nextUnassigned(sel + 1);
      render();
    }
  });

  render();
}
