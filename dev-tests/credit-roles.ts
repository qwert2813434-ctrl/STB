// 職務正規化測試：動 creditRoles.ts 之後必跑
import { canonRole, ROLE_EN, ROLE_ORDER, STANDARD_ROLES } from '../src/creditRoles';
const cases: [string, string][] = [
  ['燈光', '燈光師'], ['燈助', '燈光助理'], ['攝助', '攝影助理'], ['大助', '攝影大助'],
  ['梳化', '妝髮'], ['服裝', '造型'], ['服裝設計', '造型'], ['助理導演', '副導演'],
  ['校色', '調光師'], ['DI', '調光師'], ['花絮', '側拍'], ['製作人', '製片'],
  ['藝術指導', '美術指導'], ['配樂', '音樂製作'], ['收音', '混音音效'], ['錄音', '混音音效'],
  ['Copywriter', '企劃'], ['Drone', '空拍'],
  ['平面設計師', '平面設計'],            // ← 原本會被解析成「平面攝影」的 bug
  ['平面攝影', '平面攝影'], ['平面', '平面攝影'],
  ['DP', '攝影師'], ['攝影指導', '攝影師'], ['攝影', '攝影師'],   // ← 併條
  ['剪接', '剪輯師'], ['後製', '剪輯師'], ['調光', '調光師'],
  ['燈光組', ''], ['攝影組', ''],        // 組別不是人
  ['小高的表哥', '小高的表哥'],           // 認不得就原樣留著，不吞掉
];
let bad = 0;
for (const [input, want] of cases) {
  const got = canonRole(input);
  if (got !== want) { bad++; console.log(`✗ ${input} → 「${got}」，應為「${want}」`); }
}
console.log(`${cases.length - bad}/${cases.length} 通過`);
const noEn = ROLE_ORDER.filter((r) => !ROLE_EN[r]);
console.log(noEn.length ? `✗ 缺英譯：${noEn.join('、')}` : `✓ ${ROLE_ORDER.length} 個職務全有英譯`);
console.log(`標準名單 ${STANDARD_ROLES.length} 條：${STANDARD_ROLES.join(' → ')}`);
if (bad) process.exit(1);

// ── 日文寫法也要認得（2026-08-30 起支援）──
import { ROLE_JA, roleAlt } from '../src/creditRoles';
const jaCases: [string, string][] = [
  ['監督', '導演'],            // ⚠️ 日文的監督＝導演，不是監製
  ['助監督', '副導演'], ['プロデューサー', '製片'], ['ラインプロデューサー', '執行製片'],
  ['撮影監督', '攝影師'], ['撮影', '攝影師'], ['撮影助手', '攝影助理'],
  ['照明', '燈光師'], ['照明助手', '燈光助理'], ['美術', '美術指導'], ['美術進行', '美術執行'],
  ['ヘアメイク', '妝髮'], ['スタイリスト', '造型'], ['編集', '剪輯師'], ['カラリスト', '調光師'],
  ['絵コンテ', '分鏡'], ['ナレーション', '旁白'], ['キャスト', '演員'], ['キャスティング', '演員管理'],
];
let jbad = 0;
for (const [i2, w] of jaCases) { const g = canonRole(i2); if (g !== w) { jbad++; console.log(`✗ ${i2} → 「${g}」，應為「${w}」`); } }
console.log(`日文寫法 ${jaCases.length - jbad}/${jaCases.length} 通過`);
const noJa = ROLE_ORDER.filter((r) => !ROLE_JA[r]);
console.log(noJa.length ? `✗ 缺日文職稱：${noJa.join('、')}` : `✓ ${ROLE_ORDER.length} 個職務全有日文職稱`);
console.log(`副行語系：zh→${roleAlt('導演', 'zh')}　ja→${roleAlt('導演', 'ja')}　en→${roleAlt('導演', 'en')}`);
if (jbad) process.exit(1);
