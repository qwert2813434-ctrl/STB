// STAFF 章（EN: CONTACTS／JA: スタッフリスト）——工作人員名單。
//
// 07 在地化對照表 §02 早就列了這一章：英日的 pre-pro book 都有，繁中版原本沒有。
// 資料就是既有的 `p.contacts`，不另開一份——一份資料三個出口：
//   通告單＝要電話（現場用）／本章＝不要電話（給客戶看）／匯出 credits.json＝給名冊。
//
// 🔴 舊案零影響：本章只有 `staffInDeck === true` 才進簡報與匯出（pages.ts），
//    缺欄＝false。所以既有專案的 deck 頁數與版面完全不變。

import type { Store } from "./store";
import { t, locale } from "./i18n";
import { canonRole, roleRank, roleAlt, STANDARD_ROLES } from "./creditRoles";
import { saveTextAs } from "./persistence";
import { creditsJson } from "./creditsExport";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** 依職能流程排序（不改資料，只改顯示順序）。 */
function ordered(store: Store) {
  return store.get().contacts
    .map((c, i) => ({ c, i }))
    .sort((a, b) => roleRank(a.c.role) - roleRank(b.c.role));
}

export function renderStaff(store: Store, root: HTMLElement) {
  const p = store.get();
  const rows = ordered(store);
  const inDeck = p.staffInDeck === true;

  let html = `<div class="staff-bar">
    <label class="staff-toggle"><input type="checkbox" id="staff-indeck"${inDeck ? " checked" : ""}>
      <span>${t("放進簡報與匯出")}</span></label>
    <span class="staff-hint">${inDeck ? t("客戶會看到這一頁") : t("目前只在編輯器裡，客戶看不到")}</span>
    <span class="staff-hint">${t("標「通告」的人才會出現在通告單上")}</span>
    <span class="spacer"></span>
    <button data-staff-std>${t("補上標準八條")}</button>
    <button data-staff-json>${t("匯出 credits.json")}</button>
  </div>`;

  html += `<p class="page-label">CONTACTS · ${t("工作人員")}</p><div class="page staffpage">`;
  if (!rows.length) html += `<div class="ref-empty">${t("還沒有人。按「補上標準八條」帶入台灣廣告最常列的八個職務，或自己一個一個加。")}</div>`;
  html += `<div class="staff-grid">`;
  for (const { c, i } of rows) {
    const canon = canonRole(c.role);
    // 打「攝影」「燈光」這類簡稱時，在旁邊顯示會被收斂成什麼——不動使用者打的字。
    // 🔴 收斂結果要用「介面語言」寫：canon 本身是繁中，英日介面直接印它會變中文亂入
    //    （2026-09-01 產英文商店截圖時看到 "Cinematographer → 攝影師"）。
    const canonLabel = canon ? (locale() === "zh" ? canon : roleAlt(canon, locale())) : "";
    // 副行＝另一個語系的寫法。英文介面打英文職務時它會跟本行一字不差
    //（Director／Director），重複一次沒有訊息量——一樣就不印。
    const alt = roleAlt(canon, locale());
    const hint = canonLabel && canonLabel !== c.role ? `<span class="staff-canon">→ ${esc(canonLabel)}</span>` : "";
    html += `<div class="staff-row">
      <span class="staff-rolecell">
        <span class="staff-role cut-edit" contenteditable draggable="false" data-st="${i}" data-stf="role" data-ph="${t("職位")}">${esc(c.role)}</span>
        <span class="staff-en">${esc(alt === c.role ? "" : alt)}${hint}</span>
      </span>
      <span class="staff-name cut-edit" contenteditable draggable="false" data-st="${i}" data-stf="name" data-ph="${t("姓名")}">${esc(c.name)}</span>
      <span class="staff-ig cut-edit" contenteditable draggable="false" data-st="${i}" data-stf="ig" data-ph="${t("IG 帳號")}">${esc(c.ig ?? "")}</span>
      <span class="staff-acts">
        <button class="staff-call${c.onCall === false ? "" : " on"}" data-stcall="${i}"
          title="${t("上通告單（現場要打電話找的人）")}">${t("通告")}</button>
        <button class="staff-del" data-stdel="${i}" title="${t("從專案刪除這個人")}" aria-label="${t("刪除聯絡人")}">✕</button>
      </span>
    </div>`;
  }
  html += `</div><div class="staff-addrow"><button data-staffadd>${t("＋ 新增人員")}</button></div></div>`;
  root.innerHTML = html;
}

export function bindStaff(store: Store, root: HTMLElement, rerender: () => void) {
  root.addEventListener("click", async (e) => {
    const el = (e.target as HTMLElement).closest("button") as HTMLElement | null;
    if (!el) return;
    if (el.dataset.staffadd !== undefined) { store.addContact("", false); rerender(); return; }
    if (el.dataset.stdel !== undefined) { store.deleteContact(Number(el.dataset.stdel)); rerender(); return; }
    if (el.dataset.stcall !== undefined) {
      const i = Number(el.dataset.stcall);
      store.setContactOnCall(i, store.get().contacts[i]?.onCall === false);
      rerender(); return;
    }
    if (el.dataset.staffStd !== undefined) {
      // 只補「還沒有的」職務，已經填的一律不動
      const have = new Set(store.get().contacts.map((c) => canonRole(c.role)));
      STANDARD_ROLES.filter((r) => !have.has(r)).forEach((r) => store.addContact(r, false));
      rerender(); return;
    }
    if (el.dataset.staffJson !== undefined) {
      const name = (store.get().meta.title || "credits").replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 60);
      await saveTextAs(creditsJson(store.get()), `${name}.credits.json`);
      return;
    }
  });
  root.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === "staff-indeck") { store.setStaffInDeck(el.checked); rerender(); }
  });
  // contenteditable 的落字（跟通告單同一套：失焦或 Enter 時寫回）
  root.addEventListener("blur", (e) => {
    const el = e.target as HTMLElement;
    if (el.dataset?.st === undefined) return;
    store.editContact(Number(el.dataset.st), el.dataset.stf as "role" | "name" | "ig", el.textContent ?? "");
    rerender();
  }, true);
  root.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (el.dataset?.st !== undefined && (e as KeyboardEvent).key === "Enter") { e.preventDefault(); el.blur(); }
  });
}
