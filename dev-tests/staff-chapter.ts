// STAFF 章：舊案零影響 + credits.json 規格。動 staffView／creditsExport／pages 之後必跑。
import { readFileSync } from 'fs';
import { normalizeProject } from '../src/model';
import { chapterPlan } from '../src/model';
import { creditsJson } from '../src/creditsExport';

let bad = 0;
const chk = (ok: boolean, msg: string) => { if (!ok) { bad++; console.log('✗ ' + msg); } else console.log('✓ ' + msg); };

// ── 1. 舊案（沒有 staffInDeck）：STAFF 不進 deck ──
for (const f of process.argv.slice(2)) {
  const p = normalizeProject(JSON.parse(readFileSync(f, 'utf8')));
  const ids = chapterPlan(p).map((c) => c.id);
  chk(!ids.includes('staff'), `舊案不含 STAFF 章：${f.split('/').slice(-2)[0]}（${ids.length} 章）`);
  chk(!('staffInDeck' in p), '舊案序列化不長出 staffInDeck 欄位');
  break;
}

// ── 2. 開了才進，而且要有人名 ──
const base = normalizeProject({ meta: { title: 'T' }, contacts: [{ role: '導演', name: '', phone: '' }] });
chk(!chapterPlan({ ...base, staffInDeck: true }).some((c) => c.id === 'staff'), '開了但沒人名 → 仍不進 deck');
const withName = { ...base, contacts: [{ role: '導演', name: '高偉鳴', phone: '' }], staffInDeck: true };
chk(chapterPlan(withName).some((c) => c.id === 'staff'), '開了且有人名 → 進 deck');

// ── 3. credits.json：排序、正規化、去電話、IG ──
const p3 = normalizeProject({
  meta: { title: '測試片', client: '錄人影像 Pezós' },
  contacts: [
    { role: '收音', name: '鄭〇哲', phone: '0900-000-000', ig: 'cheng' },
    { role: '燈光', name: '吳〇翰', phone: '0911-111-111' },
    { role: '導演', name: '高偉鳴', phone: '0922-222-222', ig: 'arminkao' },
    { role: '平面設計師', name: '蔡〇婷', phone: '' },
    { role: '', name: '沒職務的人', phone: '' },
    { role: '製片', name: '  ', phone: '0933-333-333' },   // 沒名字 → 不收
  ],
});
const j = JSON.parse(creditsJson(p3));
const roles = j.works[0].credits.map((c: any) => c.role);
chk(JSON.stringify(roles) === JSON.stringify(['導演', '燈光師', '混音音效', '平面設計', '']),
    `職能流程排序＋正規化（含平面設計師 bug 修正）：${roles.join(' → ')}`);
chk(!creditsJson(p3).includes('phone'), 'credits.json 不含電話');
chk(!creditsJson(p3).includes('0900'), 'credits.json 不含任何電話號碼');
chk(j.works[0].credits[0].ig === 'arminkao', 'IG 有帶進去');
chk(!('ig' in j.works[0].credits[1]), '沒 IG 的人不長出空欄位');
chk(j.works[0].public === false, '預設標為未公開');
chk(j.version === 1 && j.studio.name === '錄人影像 Pezós', 'v1 規格欄位齊全');


// ── 4. onCall：通告單與 STAFF 名單是兩份人 ──
{
  const p = normalizeProject({ meta: { title: 'T' }, contacts: [
    { role: '製片', name: '示意製片', phone: '0900-000-000' },          // 舊檔沒有 onCall
    { role: '燈光師', name: '吳〇翰', phone: '', onCall: false },        // STAFF 才有
  ]});
  chk(p.contacts[0].onCall === undefined, '舊檔聯絡人缺 onCall（＝上通告單，行為不變）');
  chk(p.contacts[1].onCall === false, 'STAFF 新增的人 onCall:false');
  const s = JSON.stringify(p);
  chk(!/"onCall":true/.test(s), 'onCall 只在 false 時寫入，不長出 true');
  const onCall = p.contacts.filter((c) => c.onCall !== false);
  chk(onCall.length === 1 && onCall[0].name === '示意製片', `通告單只列 1 人，STAFF 列 ${p.contacts.length} 人`);
  chk(JSON.parse(creditsJson(p)).works[0].credits.length === 2, 'credits.json 收全組（不分 onCall）');
}
console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
if (bad) process.exit(1);
