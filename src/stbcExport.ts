// 匯出分鏡 for STBC：只含分鏡章的輕量 .stb（給 STB Camera 場勘用）。
// 去掉塗鴉筆跡/參考章/通告/甘特等重資料——場勘只需要 meta＋films＋cuts。
// zip 在 JS 端寫（stored，合法 zip；讀取端 STBC/STB Rust 都吃）。
import { save } from "@tauri-apps/plugin-dialog";
import { appCacheDir } from "@tauri-apps/api/path";
import { isMobile } from "./persistence";
import { invoke } from "@tauri-apps/api/core";
import type { Store } from "./store";
import { t, tf } from "./i18n";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 單檔 zip（stored）——場勘包只有 project.json
function zipSingle(name: string, data: Uint8Array): Uint8Array {
  const nameB = new TextEncoder().encode(name);
  const crc = crc32(data);
  const local = new Uint8Array(30 + nameB.length);
  const ldv = new DataView(local.buffer);
  ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0x0800, true);
  ldv.setUint32(14, crc, true); ldv.setUint32(18, data.length, true); ldv.setUint32(22, data.length, true);
  ldv.setUint16(26, nameB.length, true);
  local.set(nameB, 30);
  const cd = new Uint8Array(46 + nameB.length);
  const cdv = new DataView(cd.buffer);
  cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0x0800, true);
  cdv.setUint32(16, crc, true); cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true);
  cdv.setUint16(28, nameB.length, true); cdv.setUint32(42, 0, true);
  cd.set(nameB, 46);
  const cdOffset = local.length + data.length;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, 1, true); edv.setUint16(10, 1, true);
  edv.setUint32(12, cd.length, true); edv.setUint32(16, cdOffset, true);
  const out = new Uint8Array(cdOffset + cd.length + 22);
  out.set(local, 0); out.set(data, local.length); out.set(cd, cdOffset); out.set(eocd, cdOffset + cd.length);
  return out;
}

function toB64(u: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u.length; i += CHUNK) s += String.fromCharCode(...u.subarray(i, i + CHUNK));
  return btoa(s);
}

export async function exportForSTBC(store: Store): Promise<void> {
  const p = store.get();
  const slim = {
    meta: { title: p.meta.title, client: p.meta.client, version: p.meta.version },
    films: p.films,
    cuts: p.cuts.filter((c) => !c.hidden).map((c) => ({
      id: c.id, groupId: c.groupId, filmId: c.filmId,
      shot: c.shot, desc: c.desc, vo: c.vo, sup: c.sup,
      imageRef: c.imageRef, prompt: "", props: "", note: "",
      ...(c.scoutRef ? { scoutRef: c.scoutRef } : {}),
      ...(c.scoutMeta ? { scoutMeta: c.scoutMeta } : {}),
    })),
    days: [], milestones: [], refPages: {}, mode: "ppm",
    ...(p.aspect && p.aspect !== "16:9" ? { aspect: p.aspect } : {}),
  };
  const json = new TextEncoder().encode(JSON.stringify(slim, null, 2));
  const zip = zipSingle("project.json", json);
  const name = (p.meta.title || "分鏡").replace(/[\/:*?"<>|]/g, "-");
// iPad 沒有存檔對話框——寫進快取後彈原生分享面板（AirDrop 給 iPhone 剛好是這顆的主用途）
  if (isMobile()) {
    const dst = `${(await appCacheDir()).replace(/\/+$/, "")}/${name}_分鏡.stb`;
    await invoke("save_file", { path: dst, b64: toB64(zip) });
    await invoke("share_path", { path: dst });
    return;
  }
  const path = await save({
    defaultPath: `${name}_分鏡.stb`,
    title: t("匯出分鏡 for STBC（輕量 .stb，只含分鏡章）"),
    filters: [{ name: t("STB 分鏡包"), extensions: ["stb"] }],
  });
  if (!path) return;
  await invoke("save_file", { path, b64: toB64(zip) });
  alert(tf("已匯出分鏡包（{n} 顆，{size} MB）——AirDrop 給手機的 STB Camera 開始場勘。", { n: p.cuts.length, size: (zip.length / 1024 / 1024).toFixed(1) }));
}
