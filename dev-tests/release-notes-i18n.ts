// 發版前的閘門：releaseNotes.ts 的每一條都要有英文與日文譯文。
//
// 為什麼需要這支：「關於」面板的更新紀錄本來直接印繁中原文，英文／日文使用者
// 看到的整段是中文（2026-09-01 才接上 t()）。t() 缺字會靜靜回退到中文，
// 不會報錯——所以漏翻只有這支測試看得出來。
//
//   npx tsx dev-tests/release-notes-i18n.ts
import { RELEASE_NOTES } from "../src/releaseNotes";
import { en } from "../src/locales/en";
import { ja } from "../src/locales/ja";

const items = [...new Set(RELEASE_NOTES.flatMap((r) => r.items))];
let bad = 0;

for (const [name, dict] of [["en", en], ["ja", ja]] as const) {
  const miss = items.filter((i) => !(i in dict));
  const empty = items.filter((i) => i in dict && !dict[i].trim());
  bad += miss.length + empty.length;
  console.log(
    `${name}：${items.length - miss.length}/${items.length}` +
      (miss.length ? `　✗ 缺 ${miss.length}` : "　✓ 全數覆蓋") +
      (empty.length ? `　✗ 空 ${empty.length}` : ""),
  );
  miss.forEach((m) => console.log("   缺：" + m.slice(0, 56)));
}

// 英文譯文若整段還是中文＝根本沒翻。這兩個是「該留原文」的例外：
// 「日本語」是使用者真的要按的那顆按鈕、AI編輯指南_SCHEMA.md 是真的檔名。
const OK_CJK = ["日本語", "AI編輯指南_SCHEMA.md"];
const zhLeft = items.filter(
  (i) => en[i] && /[一-鿿]/.test(OK_CJK.reduce((s, w) => s.split(w).join(""), en[i])),
);
bad += zhLeft.length;
console.log(zhLeft.length ? `✗ 英文譯文有中文殘留 ${zhLeft.length} 條` : "✓ 英文譯文無中文殘留");
zhLeft.forEach((i) => console.log("   " + en[i].slice(0, 56)));

console.log(bad ? `\n✗ ${bad} 個問題` : "\n全部通過");
process.exit(bad ? 1 : 0);
