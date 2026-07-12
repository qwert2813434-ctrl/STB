import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { appDataDir, documentDir } from "@tauri-apps/api/path";
import type { Project } from "./model";
import { openTrimmer, type TrimRange } from "./trimmer";
import { askName } from "./nameDialog";

export interface VideoImport {
  path: string;
  poster: string | null;
  trimStart?: number;
  trimEnd?: number;
}

// 案子＝一個資料夾，真相檔＝ {folder}/project.json。
// 只在 Tauri 環境啟用；瀏覽器預覽時按鈕隱藏（isTauri 為 false）。

export function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

// iPad/iPhone（雙指以上觸控）＝行動版：檔案流程走 Documents＋App 內取名，
// 沒有桌面的存檔/資料夾對話框
export function isMobile(): boolean {
  return navigator.maxTouchPoints >= 2;
}

let projectDir: string | null = null;

export function currentDir(): string | null {
  return projectDir;
}

export function dirName(): string {
  if (!projectDir) return "";
  const parts = projectDir.split("/");
  return parts[parts.length - 1] || projectDir;
}

// 從指定資料夾載入案子（開啟對話框、專案管理頁、啟動自動開回共用）
export async function loadFromDir(dir: string): Promise<Project | null> {
  const text = await invoke<string>("load_project", { dir });
  const parsed = JSON.parse(text) as Project;
  projectDir = dir;
  localStorage.setItem("lastProjectDir", dir);
  upsertRecent(dir, parsed?.meta?.title || dirName());
  return parsed;
}

// ---- 最近案子（專案管理頁的條列來源；只是清單，不動案子本體）----
export interface RecentEntry { dir: string; title: string; at: number; packed?: boolean; }

export function recentProjects(): RecentEntry[] {
  try { return JSON.parse(localStorage.getItem("recentProjects") || "[]") as RecentEntry[]; }
  catch { return []; }
}

export function upsertRecent(dir: string, title: string) {
  const list = recentProjects().filter((r) => r.dir !== dir);
  list.unshift({ dir, title, at: Date.now() });
  localStorage.setItem("recentProjects", JSON.stringify(list.slice(0, 20)));
}

export function removeRecent(dir: string) {
  localStorage.setItem("recentProjects", JSON.stringify(recentProjects().filter((r) => r.dir !== dir)));
}

export function lastProjectDir(): string | null {
  return localStorage.getItem("lastProjectDir");
}

// 新增案子用：脫離目前資料夾（新案子未存檔前不寫任何地方，
// 也不讓下次啟動誤載回舊案子）
export function resetProjectDir() {
  projectDir = null;
  localStorage.removeItem("lastProjectDir");
}

// ---- iPad 檔案方案：案子住 App 的 Documents ----
// 配 Info.plist 的 UIFileSharingEnabled，整個資料夾出現在
// 「檔案」App ▸ 我的 iPad ▸ STB——備份／改名／刪除／AirDrop 都在那裡做。
let mobileBaseDir: string | null = null;
export async function mobileBase(): Promise<string> {
  if (!mobileBaseDir) mobileBaseDir = (await documentDir()).replace(/\/+$/, "");
  return mobileBaseDir;
}

// 一次性搬家：早期「過渡存檔」把案子放在 App 內部空間（檔案 App 看不到），
// 啟動時搬進 Documents，localStorage 裡的路徑指標跟著改。搬過＝來源不存在＝跳過。
export async function migrateMobileHome(): Promise<void> {
  try {
    const old = `${(await appDataDir()).replace(/\/+$/, "")}/STB案子`;
    const dst = `${await mobileBase()}/STB案子`;
    const moved = await invoke<boolean>("move_dir", { src: old, dst });
    if (!moved) return;
    if (localStorage.getItem("lastProjectDir") === old) localStorage.setItem("lastProjectDir", dst);
    const fixed = recentProjects().map((r) => (r.dir === old ? { ...r, dir: dst } : r));
    localStorage.setItem("recentProjects", JSON.stringify(fixed));
  } catch { /* 沒得搬或搬不動：不擋啟動 */ }
}

// iPad 專案清單：掃 Documents 的真實資料夾（在檔案 App 增刪的案子即時反映）；
// .stb 打包案子也列出（packed），點了由 unpackPacked 解開
export async function listMobileProjects(): Promise<RecentEntry[]> {
  const parent = await mobileBase();
  const rows = await invoke<{ dir: string; title: string; mtime: number; packed: boolean }[]>("list_projects", { parent });
  return rows.map((r) => ({ dir: r.dir, title: r.title, at: r.mtime, packed: r.packed }));
}

// tauri dialog 在 iOS 回傳 file:// URL（中文百分比編碼）；Rust fs 要純路徑
// （Armin 實測：匯入失敗 No such file or directory 的病根）
function asFsPath(p: string): string {
  if (!p.startsWith("file://")) return p;
  try { return decodeURIComponent(p.slice(7)); } catch { return p.slice(7); }
}

// 解開 .stb 打包案子：建「檔名」資料夾（撞名自動加 2、3…），回傳新資料夾。
// destParent 不給＝解在 .stb 同層（Mac）；給＝解進指定的家
// （iPad 從 iCloud 選檔：來源唯讀，要解進 Documents 案子家）
export async function unpackPacked(rawPath: string, destParent?: string): Promise<string> {
  const path = asFsPath(rawPath);
  const parent = destParent ?? path.replace(/\/[^/]*$/, "");
  const stem = (path.split("/").pop() ?? "案子").replace(/\.stb$/i, "").trim() || "案子";
  for (let i = 0; i < 50; i++) {
    const dst = `${parent}/${stem}${i ? ` ${i + 1}` : ""}`;
    try {
      await invoke("unpack_project", { src: path, dstDir: dst });
      return dst;
    } catch (err) {
      if (String(err).includes("已有案子")) continue; // 撞名：下一個序號
      throw err;
    }
  }
  throw new Error("同名資料夾太多，清一下再解");
}

// iPad 建案／另存共用：App 內輸入案名 → Documents/{案名}；
// 同名已存在就提示換名重問（Rust save_as 有防蓋守門）
async function createInDocuments(srcDir: string | null, contents: string, title: string, def: string): Promise<string | null> {
  const base = await mobileBase();
  for (;;) {
    const name = await askName(title, def);
    if (!name) return null;
    const dst = `${base}/${name}`;
    try {
      await invoke("save_as", { srcDir, dstDir: dst, contents });
      projectDir = dst;
      localStorage.setItem("lastProjectDir", dst);
      return dst;
    } catch (err) {
      if (String(err).includes("已有案子")) { alert("已經有同名的案子——換個名字。"); def = name; continue; }
      throw err;
    }
  }
}

// 開啟案子：直接選案子的 project.json 檔案——
// 資料夾選擇器會把檔案反灰（Armin：看不出有沒有選到）；改選檔案，
// 只亮 .json、選到什麼一目瞭然，再從檔案位置推回案子資料夾。
export async function chooseFolderAndLoad(): Promise<Project | null> {
  const path = await open({
    title: "開啟案子：選 project.json 或打包案子（.stb）",
    filters: [{ name: "STB 案子（project.json／.stb）", extensions: ["json", "stb"] }],
  });
  if (typeof path !== "string") return null;
  // 打包案子：先在同層解開成資料夾再載入
  if (/\.stb$/i.test(path)) {
    const dir = await unpackPacked(path);
    return loadFromDir(dir);
  }
  const dir = path.replace(/\/[^/]*$/, "");
  return loadFromDir(dir);
}

// 看示範案用：脫離目前案子資料夾（避免自動存檔把示範內容寫進真案子），
// 但保留 lastProjectDir——下次啟動仍回到原本的案子。
export function detachDir() {
  projectDir = null;
}

// 建立案子資料夾（第一次儲存／新增案子共用）：
// 走「儲存對話框」——輸入案名＝資料夾名，按鈕就是「儲存」。
// （不再用資料夾選擇器：按鈕顯示 Open、檔案灰色，Armin 實測反直覺。）
export async function createProjectFolder(contents: string, suggestedName: string): Promise<string | null> {
  if (isMobile()) return createInDocuments(null, contents, "輸入案名（案子會存在「檔案」App ▸ STB）", suggestedName);
  const path = await save({ defaultPath: suggestedName, title: "輸入案名（會以案名建立案子資料夾）" });
  if (!path) return null;
  await invoke("save_as", { srcDir: null, dstDir: path, contents });
  projectDir = path;
  localStorage.setItem("lastProjectDir", path);
  return path;
}

// 存到已選定的資料夾（自動存檔用）
export async function saveToCurrent(contents: string): Promise<boolean> {
  if (!projectDir) return false;
  await invoke("save_project", { dir: projectDir, contents });
  return true;
}

// 另存新檔：整個案子（project.json＋assets 素材）複製成新案子，
// 之後的編輯與自動存檔都寫到新家——版本備份、改稿分支都靠這顆。
// 同樣走「儲存對話框」：輸入新案名＝新資料夾名。
export async function chooseFolderAndSaveAs(contents: string, suggestedName: string): Promise<string | null> {
  if (isMobile()) return createInDocuments(currentDir(), contents, "另存新檔：輸入新案名（整個案子會複製一份）", `${suggestedName} 副本`);
  const path = await save({ defaultPath: `${suggestedName} 副本`, title: "另存新檔：輸入新案名（整個案子會複製過去）" });
  if (!path) return null;
  await invoke("save_as", { srcDir: projectDir, dstDir: path, contents });
  projectDir = path;
  localStorage.setItem("lastProjectDir", path);
  return path;
}

// 用系統預設瀏覽器開外部連結（參考影片用）；瀏覽器預覽時退回 window.open
export function openExternal(url: string) {
  const u = /^https?:\/\//i.test(url) ? url : "https://" + url;
  if (isTauri()) void openUrl(u);
  else window.open(u, "_blank");
}

// 依副檔名給 MIME（<video> 有正確 type 才穩定）
function videoMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ({ mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm" } as Record<string, string>)[ext] ?? "video/mp4";
}

// 讀案子裡的檔案 → Blob URL。播放不走 asset protocol：
// WKWebView 對自訂協定的影片串流不可靠、失敗又無聲；bytes→Blob 保證 <video> 吃得下。
async function assetBlobUrl(relPath: string): Promise<string> {
  if (!projectDir) throw new Error("尚未開啟案子");
  const buf = await invoke<ArrayBuffer>("read_asset", { dir: projectDir, rel: relPath });
  return URL.createObjectURL(new Blob([buf], { type: videoMime(relPath) }));
}

const VID_EXTS = ["mp4", "mov", "m4v", "webm"];
const IMG_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "tif", "tiff"];

function imageMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" } as Record<string, string>)[ext] ?? "image/jpeg";
}

// 匯入影片（複製進 assets/ → 首尾裁切 → 抽首圖），選檔對話框與「＋ 加入檔案」共用。
// 還沒開案子＝不擋路：當場讓使用者選資料夾（空資料夾＝目前內容存成新案子；
// 已有 project.json 的資料夾請走「開啟案子」載入，避免把原內容覆蓋掉）。
async function importVideo(src: string): Promise<VideoImport | null> {
  if (!projectDir) {
    const dir = await open({ directory: true, title: "選擇案子資料夾（影片與 project.json 將存在這裡）" });
    if (typeof dir !== "string") return null;
    let hasProject = false;
    try { await invoke<string>("load_project", { dir }); hasProject = true; } catch { /* 沒有 project.json */ }
    if (hasProject) {
      alert("這個資料夾已經有案子檔（project.json）。請先按頂欄「開啟案子…」載入它，再加入影片，避免覆蓋原內容。");
      return null;
    }
    projectDir = dir;
    localStorage.setItem("lastProjectDir", dir);
  }
  const rel = await invoke<string>("import_asset", { dir: projectDir, src });
  let poster: string | null = null;
  let trim: TrimRange | null = null;
  try {
    const url = await assetBlobUrl(rel);
    trim = await openTrimmer(url);                 // 首尾裁切（無時長限制；不裁＝整段）
    poster = await extractPoster(url, trim?.start); // 封面抽在裁切起點
    URL.revokeObjectURL(url);
  } catch { poster = null; }
  return { path: rel, poster, trimStart: trim?.start, trimEnd: trim?.end };
}

// 選本機影片檔 → 複製進案子 assets/ → 裁切 → 抽首圖
export async function chooseVideoImport(): Promise<VideoImport | null> {
  const src = await open({
    title: "選擇影片檔",
    filters: [{ name: "影片", extensions: VID_EXTS }],
  });
  if (typeof src !== "string") return null;
  return importVideo(src);
}

// 「＋ 加入檔案」：一顆按鈕圖片影片都吃。
// 影片 → 複製進 assets ＋ 裁切 ＋ 抽首圖；圖片 → 讀 bytes 轉 Blob URL 給裁切器。
export async function chooseMediaImport(): Promise<
  | ({ kind: "video" } & VideoImport)
  | { kind: "image"; url: string }
  | null
> {
  const src = await open({
    title: "選擇圖片或影片",
    filters: [{ name: "圖片或影片", extensions: [...IMG_EXTS, ...VID_EXTS] }],
  });
  if (typeof src !== "string") return null;
  const ext = src.split(".").pop()?.toLowerCase() ?? "";
  if (VID_EXTS.includes(ext)) {
    const v = await importVideo(src);
    return v ? { kind: "video", ...v } : null;
  }
  const buf = await invoke<ArrayBuffer>("read_file", { path: src });
  return { kind: "image", url: URL.createObjectURL(new Blob([buf], { type: imageMime(src) })) };
}

// 區塊內播放：把縮圖容器換成 <video controls>（原生控制列含音量／進度），
// 回傳清理函式（暫停＋釋放 Blob 記憶體）。載入失敗顯示原因、不無聲。
// 只有掛載中的影片佔記憶體，清理後即釋放——換頁/停止就還回去。
// trim＝首尾裁切點：從起點播、到終點停；停在終點再按播放會跳回起點。
export async function mountInlineVideo(container: HTMLElement, relPath: string, autoplay: boolean, trim?: TrimRange): Promise<(() => void) | null> {
  let url: string;
  try {
    url = await assetBlobUrl(relPath);
  } catch (err) {
    container.innerHTML = `<span class="thumb-add">影片載入失敗：${err}</span>`;
    return null;
  }
  container.innerHTML = "";
  container.classList.add("playing");
  const v = document.createElement("video");
  v.src = url;
  v.controls = true;
  v.playsInline = true;
  if (trim) {
    v.addEventListener("loadedmetadata", () => { try { v.currentTime = trim.start; } catch { /* noop */ } });
    v.addEventListener("timeupdate", () => { if (v.currentTime >= trim.end - 0.05) v.pause(); });
    v.addEventListener("play", () => { if (v.currentTime >= trim.end - 0.1) v.currentTime = trim.start; });
  }
  container.appendChild(v);
  if (autoplay) {
    // 有聲自動播；被平台擋下就改靜音播（使用者可用控制列開聲音）
    v.play().catch(() => { v.muted = true; v.play().catch(() => { /* 等使用者按播放 */ }); });
  }
  return () => {
    v.pause();
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  };
}

// 重抽某支影片的封面（載入舊案時補抓沒抽到的首圖）
export async function extractPosterFor(relPath: string): Promise<string | null> {
  try {
    const url = await assetBlobUrl(relPath);
    const poster = await extractPoster(url);
    URL.revokeObjectURL(url);
    return poster;
  } catch { return null; }
}

// 從影片抽一幀當封面（預設中段；有裁切點就抽起點附近），畫進 canvas。
// 注意 preload 必須 "auto"——WKWebView 在 "metadata" 模式不載入影格，
// loadeddata 永遠不觸發、抽圖一律超時（縮圖空白的病根）。
function extractPoster(srcUrl: string, atSec?: number): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    v.src = srcUrl;
    const done = (r: string | null) => { v.remove(); resolve(r); };
    let drawn = false;
    const draw = () => {
      if (drawn) return;
      drawn = true;
      try {
        const vw = v.videoWidth || 1600, vh = v.videoHeight || 900;
        const c = document.createElement("canvas");
        c.width = 1600; c.height = 900;
        // cover 裁切：非 16:9 的影片置中裁滿，不變形
        const scale = Math.max(1600 / vw, 900 / vh);
        const dw = vw * scale, dh = vh * scale;
        c.getContext("2d")!.drawImage(v, (1600 - dw) / 2, (900 - dh) / 2, dw, dh);
        const out = c.toDataURL("image/jpeg", 0.85);
        c.width = c.height = 0; // iOS：畫布用完立刻釋放
        done(out);
      } catch { done(null); }
    };
    v.onloadedmetadata = () => {
      try {
        const dur = v.duration || 2;
        v.currentTime = atSec !== undefined ? Math.min(atSec + 0.1, dur) : Math.min(1, dur / 2);
      } catch { done(null); }
    };
    v.onseeked = () => {
      // seeked 觸發時 WKWebView 常常還沒真正呈現影格，直接畫 canvas 會得到黑幀
      // （黑封面的病根）→ 等 requestVideoFrameCallback（影格真的呈現）再畫，
      // 加 400ms 後備（draw 有 drawn 旗標，只會畫一次）
      const anyv = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void };
      if (typeof anyv.requestVideoFrameCallback === "function") anyv.requestVideoFrameCallback(() => draw());
      setTimeout(draw, 400);
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 6000); // 保險：超時放棄首圖（影片仍存好）
  });
}
