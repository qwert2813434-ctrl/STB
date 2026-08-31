// 把 STAFF 章的實際 markup 套上 App 的 style.css 渲染出來，用看的驗版面。
import { readFileSync, writeFileSync } from 'fs';
const css = readFileSync('src/style.css', 'utf8');
const ROWS = [
  ['導演', 'Director', '高偉鳴', 'arminkao', true],
  ['監製', 'Executive Producer', '示意監製', '', true],
  ['製片', 'Producer', '示意製片', 'studio_lin', true],
  ['攝影師', 'Director of Photography', '黃〇宇', 'huang.dp'],
  ['燈光師', 'Gaffer', '吳〇翰', ''],
  ['美術指導', 'Art Director', '蔡〇婷', 'tsai.art'],
  ['剪輯師', 'Editor', '高偉鳴', 'arminkao'],
  ['調光師', 'Colorist', '高偉鳴', ''],
  ['混音音效', 'Sound Design', '鄭〇哲', 'cheng.sound'],
  ['收音', 'Sound Design', '一個很長的名字測試', ''],   // 認不得→顯示收斂提示
];
const row = ([zh, en, name, ig, onCall], hint) => `<div class="staff-row">
  <span class="staff-rolecell">
    <span class="staff-role cut-edit" contenteditable>${zh}</span>
    <span class="staff-en">${en}${hint ? `<span class="staff-canon">→ 混音音效</span>` : ''}</span>
  </span>
  <span class="staff-name cut-edit" contenteditable>${name}</span>
  <span class="staff-ig cut-edit" contenteditable>${ig}</span>
  <span class="staff-acts">
    <button class="staff-call${onCall ? ' on' : ''}">通告</button>
    <button class="staff-del">✕</button>
  </span>
</div>`;
const page = `<p class="page-label">CONTACTS · 工作人員</p><div class="page staffpage">
<div class="staff-grid">${ROWS.map((r, i) => row(r, i === 9)).join('')}</div>
<div class="staff-addrow"><button>＋ 新增人員</button></div></div>`;
const doc = (cls, body) => `<!doctype html><meta charset="utf-8">
<style>${css}
body { margin:0; padding:24px; background:var(--bg,#efeee8); font-family:-apple-system,"PingFang TC",sans-serif; }
.wrap { max-width:1180px; }</style>
<div class="wrap ${cls}">${body}</div>`;
// .pv-fit 有自己的定位／縮放，跟編輯器版放同一頁會互相疊——各出一個檔各截一張
writeFileSync('dev-tests/shot/staff.html', doc('', page));
writeFileSync('dev-tests/shot/staff-pv.html', doc('pv-fit', page));
console.log('✓ dev-tests/shot/staff.html（編輯器）＋ staff-pv.html（簡報）');
