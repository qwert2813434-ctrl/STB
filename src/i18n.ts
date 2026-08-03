import { en } from "./locales/en";
import { ja } from "./locales/ja";

// i18n 骨架（階段 0b）。key＝繁中原文（gettext 式）：
// 繁中語系不查表、程式碼裡的字串就是唯一真相；en/ja 包缺譯時回繁中原文。
// 顯示字串要走 t()；schema（project.json 的 key 與值）永遠不經過這裡。

export type Locale = "zh" | "en" | "ja";
const DICTS: Record<"en" | "ja", Record<string, string>> = { en, ja };
const LANG_ATTR: Record<Locale, string> = { zh: "zh-Hant", en: "en", ja: "ja" };

function detect(): Locale {
  // QA 後門：?lang=en 強制語系（只讀不存，重載即回歸正常偵測）
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "zh" || q === "en" || q === "ja") return q;
  // 日文 1.6.1 起開放（Armin 2026-08-03 拍板；語言包/手冊兩條長句仍標「審」待母語定案）
  const saved = localStorage.getItem("stbLang");
  if (saved === "zh" || saved === "en" || saved === "ja") return saved;
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("ja")) return "ja";
  return "zh";
}

const cur: Locale = detect();
// <html lang> 帶動字型堆疊與日文禁則（style.css :root[lang="ja"]）
document.documentElement.lang = LANG_ATTR[cur];

export function locale(): Locale { return cur; }

export function setLocale(l: Locale) {
  if (l === cur) return;
  localStorage.setItem("stbLang", l);
  location.reload(); // 字串散在各渲染器，整頁重載最穩（App 自動存檔，無資料風險）
}

export function t(s: string): string {
  if (cur === "zh") return s;
  return DICTS[cur][s] ?? s;
}

// 章節標題三語系規則（07 對照表＋2026-07-27 Armin 定案）：
// zh＝現行「亞洲英文大標＋中文」不變；ja＝同一套亞洲英文＋日文並列（日本業界慣例，トンマナ=tone & manner）；
// en＝enIntl 單行（英文版再放兩行英文＝重疊怪異）。sub 為空字串時消費端不渲染副行。
export function chapterTitle(ch: { en: string; enIntl: string; ja: string; label: string }): { cap: string; sub: string } {
  if (cur === "en") return { cap: ch.enIntl, sub: "" };
  if (cur === "ja") return { cap: ch.en, sub: ch.ja };
  return { cap: ch.en, sub: ch.label };
}

// 帶參數字串：tf("確定刪除 Day {n}？", { n: 3 })——key 用 {占位符} 原文，譯文可重排語序
export function tf(s: string, vars: Record<string, string | number>): string {
  let out = t(s);
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v)); // 不用 replaceAll：tsconfig lib=ES2020
  return out;
}
