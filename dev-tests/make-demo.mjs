// 產出各語系的截圖夾具：圖不動、只換文字欄位。
// 內容表在 dev-tests/demo-src/*.json（進 git，是資產）；產物在 public/demo/（.gitignore）。
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
const T = JSON.parse(readFileSync('dev-tests/demo-src/magicstone-i18n.json', 'utf8'));
const base = JSON.parse(readFileSync('public/demo/magicstone.json', 'utf8'));

// 各語系的工作人員（職務用該語系的寫法——canonRole 兩邊都認得）
const CREW = {
  zh: [['導演','示意導演','director_demo',1],['監製','示意監製','',1],['製片','示意製片','studio_demo',1],
       ['攝影師','示意攝影','dp_demo',0],['燈光師','示意燈光','',0],['美術指導','示意美術','art_demo',0],
       ['剪輯師','示意剪輯','editor_demo',0],['調光師','示意調光','',0],['混音音效','示意混音','sound_demo',0]],
  en: [['Director','Sample Director','director_demo',1],['Executive Producer','Sample EP','',1],['Producer','Sample Producer','studio_demo',1],
       ['Cinematographer','Sample DP','dp_demo',0],['Gaffer','Sample Gaffer','',0],['Art Director','Sample Art','art_demo',0],
       ['Editor','Sample Editor','editor_demo',0],['Colorist','Sample Colorist','',0],['Sound Design','Sample Sound','sound_demo',0]],
  ja: [['監督','サンプル監督','director_demo',1],['エグゼクティブプロデューサー','サンプルEP','',1],['プロデューサー','サンプル制作','studio_demo',1],
       ['撮影監督','サンプル撮影','dp_demo',0],['照明','サンプル照明','',0],['美術','サンプル美術','art_demo',0],
       ['編集','サンプル編集','editor_demo',0],['カラリスト','サンプルカラリスト','',0],['音響効果','サンプル音響','sound_demo',0]],
};

const pick = (tbl, s, lang) => (lang === 'zh' ? s : (tbl?.[s]?.[lang] ?? s));

for (const lang of ['zh', 'en', 'ja']) {
  const p = JSON.parse(JSON.stringify(base));
  p.meta.title = pick(T.meta.title, p.meta.title, lang) || p.meta.title;
  if (lang !== 'zh') {
    p.meta.title = T.meta.title[lang]; p.meta.client = T.meta.client[lang];
    p.films.forEach((f) => { f.name = T.films[f.name]?.[lang] ?? f.name; });
    p.cuts.forEach((c) => {
      if (c.desc) c.desc = pick(T.desc, c.desc, lang);
      if (c.sup) c.sup = pick(T.sup, c.sup, lang);
      // note＝製作備註，不進客戶簡報也不上截圖版面，留原文不動
    });
    for (const items of Object.values(p.refPages || {}))
      items.forEach((it) => { if (it.title) it.title = pick(T.refTitle, it.title, lang); });
  }
  p.staffInDeck = true;
  p.contacts = CREW[lang].map(([role, name, ig, onCall]) => ({
    role, name, phone: onCall ? '0900-000-000' : '', ...(ig ? { ig } : {}), ...(onCall ? {} : { onCall: false }),
  }));
  mkdirSync('public/demo', { recursive: true });
  writeFileSync(`public/demo/magicstone.${lang}.json`, JSON.stringify(p));
  // 別用「有沒有漢字」判斷——日文本來就有漢字。要比對的是「跟原文一不一樣」
  const untouched = lang === 'zh' ? 0
    : p.cuts.filter((c, i) => c.desc && c.desc === base.cuts[i].desc).length;
  const sups = lang === 'zh' ? 0
    : p.cuts.filter((c, i) => c.sup && c.sup === base.cuts[i].sup && !/^魔法石$/.test(c.sup)).length;
  console.log(`  magicstone.${lang}.json  ${(JSON.stringify(p).length / 1e6).toFixed(1)} MB` +
              (lang === 'zh' ? '' : `  · 沒換到的 desc ${untouched}／sup ${sups}`));
}

// ── 通告單／Rundown／甘特：原案是真的客戶案，場地與地址全部換成示意內容 ──
const C = JSON.parse(readFileSync('dev-tests/demo-src/callsheet-i18n.json', 'utf8'));
const cbase = JSON.parse(readFileSync('public/demo/callsheet.json', 'utf8'));
for (const lang of ['zh', 'en', 'ja']) {
  const p = JSON.parse(JSON.stringify(cbase));
  const m = (tbl, s2) => (s2 && tbl[s2]?.[lang]) || s2;
  p.meta.title = C.meta.title[lang];
  p.meta.client = C.meta.client[lang];
  p.contacts = C.crew[lang].map(([role, name, phone]) => ({ role, name, phone }));
  p.cuts.forEach((c) => { if (c.desc) c.desc = m(C.desc, c.desc); });
  for (const items of Object.values(p.refPages || {})) items.forEach((it) => { it.title = m(C.refTitle, it.title); });
  (p.days || []).forEach((d) => {
    (d.callGroups || []).forEach((g) => { g.label = m(C.groups, g.label); g.loc = m(C.locs, g.loc); });
    (d.rundown || []).forEach((b) => { b.title = m(C.rundown, b.title); b.loc = m(C.locs, b.loc); b.note = m(C.notes, b.note); b.park = m(C.locs, b.park); });
  });
  writeFileSync(`public/demo/callsheet.${lang}.json`, JSON.stringify(p));
  const raw = JSON.stringify(p);
  const leaked = ['陽明山', '民生東路', '民生社區', '淨毒'].filter((x) => raw.includes(x));
  console.log(`  callsheet.${lang}.json   ${(raw.length / 1024).toFixed(0)} KB` +
              (leaked.length ? `  ⚠️ 還有真實資訊：${leaked.join('、')}` : '  · 無真實場地殘留'));
}

// ── 小紅帽：從逐格圖現建一個 STB 案（工作層沒有現成案子）──
// 2026-08-30 預設不產（Armin 看過三語對照後：小紅帽比較不適合當宣傳截圖）。
// 夾具與這段程式留著，要用就 STB_DEMO_REDHOOD=1 ./dev-tests/shots.sh
if (process.env.STB_DEMO_REDHOOD) {
  const R = JSON.parse(readFileSync('dev-tests/demo-src/redhood-i18n.json', 'utf8'));
  const b64 = R.frames.map((f) => {
    const p = `${R.frameDir}/${f}.jpg`;
    return 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');
  });
  const id = (p2, i) => `${p2}${String(i).padStart(3, '0')}`;
  for (const lang of ['zh', 'en', 'ja']) {
    const filmId = 'f001';
    const proj = {
      meta: { title: R.meta.title[lang], client: R.meta.client[lang], version: 1, logo: null },
      contacts: [], films: [{ id: filmId, name: R.filmName[lang] }],
      cuts: R.cuts.map((c, i) => ({
        id: id('c', i + 1), groupId: id('g', i + 1), filmId,
        shot: c.shot, desc: c[lang].desc, vo: c[lang].vo, sup: '',
        imageRef: b64[i], prompt: '', props: '', note: '',
      })),
      days: [], milestones: [], refPages: {}, hiddenChapters: [], mode: 'ppm',
    };
    writeFileSync(`public/demo/redhood.${lang}.json`, JSON.stringify(proj));
    console.log(`  redhood.${lang}.json    ${(JSON.stringify(proj).length / 1e6).toFixed(1)} MB  · ${proj.cuts.length} 顆分鏡`);
  }
}
