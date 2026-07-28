// 匯入場勘包（STB Camera 匯出的 .stb）：照片按 cutId 自動對位，
// 只寫 scoutRef/scoutMeta——imageRef（分鏡）永不被碰。
// zip 解讀走 JS（DecompressionStream），不動 Rust；讀檔用既有 read_file。
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { isTauri, asFsPath } from "./persistence";
import { openImportChoice, openMatchBoard } from "./matchBoard";
import type { Store } from "./store";
import type { Cut } from "./model";
import { t, tf } from "./i18n";

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  // 複製成獨立 ArrayBuffer（subarray 的 view 帶 offset，也順便滿足 TS 的 BlobPart 型別）
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Response(new Blob([copy.buffer])).body!.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// 解 zip → { 檔名: bytes }。支援 stored(0) 與 deflated(8)。
async function unzip(buf: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(t("不是有效的 .stb 檔"));
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error(t("zip 目錄損壞"));
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    if (!name.endsWith("/")) out[name] = method === 0 ? comp.slice() : await inflateRaw(comp);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export async function importScoutFlow(
  store: Store,
  openAsProject?: (path: string) => Promise<boolean>,
): Promise<void> {
  if (!isTauri()) { alert(t("匯入場勘要在 STB 應用程式內使用。")); return; }
  const path = await open({
    title: t("選擇場勘包（STB Camera 匯出的 .stb）"),
    filters: [{ name: t("場勘包（.stb）"), extensions: ["stb"] }],
  });
  if (typeof path !== "string") return;
  // iPad 的選檔器回傳 file:// URL（含百分比編碼）——Rust 端要的是純路徑。
  // 桌面回傳的本來就是路徑，asFsPath 對它是 no-op（2026-07-28 Armin 實機卡住的病根）
  const fsPath = asFsPath(path);
  try {
    const buf = await invoke<ArrayBuffer>("read_file", { path: fsPath });
    const files = await unzip(buf);
    const pj = files["project.json"];
    if (!pj) throw new Error(t("包裡沒有 project.json"));
    const proj = JSON.parse(new TextDecoder().decode(pj)) as {
      films?: { id?: string; name?: string }[];
      cuts?: (Partial<Cut> & { id?: string })[];
    };
    const allCuts = (proj.cuts ?? []).filter((c) => c.id);
    if (!allCuts.length) { alert(t("這個包裡沒有任何 cut。")); return; }

    const p = store.get();
    const ids = new Set(p.cuts.map((c) => c.id));
    const scouts = allCuts.filter((c) => c.scoutRef);
    const matched = scouts.filter((s) => ids.has(s.id!));

    // 岔路一：cutId 對得上本案＝順向場勘包 → 自動對位
    if (matched.length) {
      const conflicts = matched.filter((s) => p.cuts.find((c) => c.id === s.id)?.scoutRef).length;
      // 溢出＝包裡有、本案沒有的 cut（攝影師現場新增的）——分「兄弟對得上的路」與「整路對不上」
      const matchedFilms = new Set(
        allCuts.filter((c) => ids.has(c.id!)).map((c) => c.filmId ?? ""),
      );
      const extras = allCuts.filter((c) => !ids.has(c.id!) && matchedFilms.has(c.filmId ?? ""));
      const strays = allCuts.filter((c) => !ids.has(c.id!) && !matchedFilms.has(c.filmId ?? ""));

      const msg =
        tf("場勘包：{scouts} 顆場勘照，對上本案 {matched} 顆", { scouts: scouts.length, matched: matched.length }) +
        (conflicts ? tf("（{n} 顆已有場勘，會被新的覆蓋）", { n: conflicts }) : "") +
        t("。\n\n只寫入場勘圖，分鏡圖不會動。匯入？");
      if (!confirm(msg)) return;

      // 溢出提示：要不要把現場新增的 cut 插進對應位置
      let additions: { cut: (typeof allCuts)[number]; prevPkgId: string | null; headAnchorId: string | null }[] = [];
      if (extras.length) {
        const take = confirm(
          tf(
            "包裡有 {n} 顆本案沒有的 cut——像是現場新增的。\n\n要一併加入嗎？會插在對應位置並設為「隱藏」（細灰格）——照片在場勘圖、分鏡編號完全不變。\n確定＝加入；取消＝略過這些。",
            { n: extras.length },
          ),
        );
        if (take) {
          additions = extras.map((c) => {
            const pos = allCuts.indexOf(c);
            let prevPkgId: string | null = null;
            for (let i = pos - 1; i >= 0; i--) {
              const pv = allCuts[i];
              if ((pv.filmId ?? "") === (c.filmId ?? "")) { prevPkgId = pv.id!; break; }
            }
            const headAnchorId =
              allCuts.find((x) => (x.filmId ?? "") === (c.filmId ?? "") && ids.has(x.id!))?.id ?? null;
            return { cut: c, prevPkgId, headAnchorId };
          });
        }
      }

      store.importScout(
        matched.map((s) => ({ id: s.id!, scoutRef: s.scoutRef!, scoutMeta: s.scoutMeta ?? null })),
        additions,
      );

      // 整路對不上的（罕見：包裡混了別路）→ 另問一次，加為新的一路
      if (strays.length && confirm(tf("另外 {n} 顆屬於整路都對不上的路。要加為新的一路嗎？", { n: strays.length }))) {
        const r = store.importAsNewFilm(proj.films ?? [], strays);
        alert(tf("已另加 {films} 路、{cuts} 顆 cut。", { films: r.films, cuts: r.cuts }));
      }
      if (additions.length) alert(tf("完成：場勘對位 {matched} 顆，插入新 cut {added} 顆。", { matched: matched.length, added: additions.length }));
      return;
    }

    // 岔路二：對不上＝STBC 自建（或別案）包 → 問「當新的一路」或「當場勘圖（配對板）」
    const choice = await openImportChoice(allCuts.length, scouts.length, !!openAsProject);
    if (!choice) return;
    if (choice === "project") { await openAsProject?.(fsPath); return; }
    if (choice === "film") {
      const r = store.importAsNewFilm(proj.films ?? [], allCuts);
      alert(tf("已加入 {films} 路、共 {cuts} 顆 cut——已切到新的一路。", { films: r.films, cuts: r.cuts }));
      return;
    }
    openMatchBoard(store, scouts.map((c) => ({
      scoutRef: c.scoutRef!, scoutMeta: c.scoutMeta ?? null, desc: c.desc ?? "",
    })));
  } catch (err) {
    alert(tf("匯入場勘失敗：{err}", { err: String(err) }));
  }
}
