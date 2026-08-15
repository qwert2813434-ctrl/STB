// 主畫面規模壓測（Node 跑，瀏覽器虛擬時間會失真）：
// npx esbuild dev-tests/scale-bench.ts --bundle --platform=node --format=cjs --outfile=/tmp/scale-bench.cjs \
//   --banner:js='globalThis.localStorage={getItem:()=>null,setItem:()=>{}};globalThis.navigator={language:"zh-TW",maxTouchPoints:0};globalThis.location={search:""};globalThis.document={documentElement:{setAttribute:()=>{},style:{}},addEventListener:()=>{}};globalThis.window=globalThis;'
// node /tmp/scale-bench.cjs <效能壓力測試20/project.json>（案子用 gen-stress-project.py --cuts 20 生）
import { readFileSync } from "node:fs";
import { normalizeProject } from "../src/model";
import { Store } from "../src/store";

const path = process.argv[2];
const t = () => performance.now();
let t0 = t();
const raw = JSON.parse(readFileSync(path, "utf-8"));
console.log(`JSON.parse（開案讀檔）: ${(t() - t0).toFixed(0)}ms`);

t0 = t();
const project = normalizeProject(raw);
console.log(`normalizeProject: ${(t() - t0).toFixed(0)}ms`);

const clones: number[] = [];
for (let i = 0; i < 3; i++) { t0 = t(); structuredClone(project); clones.push(t() - t0); }
console.log(`structuredClone 整案（＝每次編輯的 undo 快照）×3: ${clones.map((x) => x.toFixed(0) + "ms").join(" / ")}`);

const store = new Store(project);
const edits: number[] = [];
for (let i = 0; i < 3; i++) { t0 = t(); store.editField(project.cuts[0].id, "desc", "壓測 " + i); edits.push(t() - t0); }
console.log(`store.editField ×3（實際編輯一格文字）: ${edits.map((x) => x.toFixed(0) + "ms").join(" / ")}`);

t0 = t();
const json = JSON.stringify(store.get());
console.log(`JSON.stringify（autosave 序列化 ${(json.length / 1e6).toFixed(1)}MB）: ${(t() - t0).toFixed(0)}ms`);
