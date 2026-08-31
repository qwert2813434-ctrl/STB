// 舊檔往返測試：hydrate 再 stringify，必須與原檔 byte-identical
import { readFileSync } from 'fs';
import { normalizeProject as hydrate } from '../src/model';
const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const out = JSON.stringify(hydrate(JSON.parse(raw)), null, 2);
  const same = out.trim() === raw.trim();
  const hasIg = /"ig"\s*:/.test(out);
  console.log(`${same ? 'OK  ' : 'DIFF'}  ig欄位:${hasIg ? '有' : '無'}  ${f.split('/').slice(-2).join('/')}`);
  if (!same) {
    bad++;
    const a = raw.trim().split('\n'), b = out.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++)
      if (a[i] !== b[i]) { console.log(`   第 ${i+1} 行\n   舊 ${a[i]}\n   新 ${b[i]}`); break; }
  }
}
console.log(bad ? `\n${bad} 個不一致` : '\n全部 byte-identical');
