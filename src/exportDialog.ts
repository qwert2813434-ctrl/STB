import type { Store } from "./store";
import { collectChapters, coverSlideHtml, titleSlideHtml, logoSlideHtml } from "./pages";
import { rasterLogo } from "./logoAsset";
import { isTauri, isMobile } from "./persistence";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { buildEditablePptx } from "./pptxNative";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

// 匯出中心：先把每頁用 html2canvas 截成圖（沿用簡報字體/版面），縮圖預覽
// 確認後組成 PDF（A5 橫）或 PPTX（16:9，Keynote／PowerPoint 可直接開）。
// 預覽的圖＝輸出的圖，所見即所得——截圖有 bug 會直接在預覽現形，不會印了才知道。
// （.key 為蘋果封閉格式無法直接產生；Keynote 原生支援開 PPTX，即為 Keynote 匯出。）
// 存檔：前端轉 base64 → Rust save_file 寫檔 → Rust open_path（macOS `open`）
// 開檔預覽——不走 opener plugin 的 openPath（路徑 scope 限制曾造成匯出失敗）。

interface ExImg { img: string; w: number; h: number; }
interface ExChapter { id: string; en: string; zh: string; title: ExImg | null; pages: ExImg[]; }

export async function openExportDialog(store: Store) {
  if (document.querySelector(".ex-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "ex-overlay";
  overlay.innerHTML = `
    <div class="ex-panel">
      <div class="ex-head">
        <span class="ex-title">匯出</span>
        <label class="ex-opt"><input type="checkbox" data-extitles checked> 封面＋章節標題頁</label>
        <label class="ex-opt"><input type="checkbox" data-exlabels> 頁面小標</label>
        <span class="spacer"></span>
        <button class="ex-go" data-exgo="pdf">匯出 PDF</button>
        <button class="ex-go" data-exgo="pptx">匯出 PPTX（可編輯）</button>
        <button class="ex-close" aria-label="關閉">✕</button>
      </div>
      <div class="ex-hint">勾選要匯出的章節。PDF＝與縮圖完全一致的成品；PPTX＝可編輯重排版——文字可改、圖片可換、本機影片嵌入（Keynote／PowerPoint 可播）、影片連結可點，版面與縮圖略有差異。</div>
      <div class="ex-body"><div class="ex-status">擷取頁面中…</div></div>
    </div>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector(".ex-body") as HTMLElement;

  let logo: ExImg | null = null;
  let cover: ExImg | null = null;
  let chapters: ExChapter[] = [];
  const excluded = new Set<number>(); // 取消勾選的章（index）
  let busy = false;

  const withTitles = () => (overlay.querySelector("[data-extitles]") as HTMLInputElement).checked;
  const withLabels = () => (overlay.querySelector("[data-exlabels]") as HTMLInputElement).checked;

  // 逐頁截圖：頁面掛 .pv-fit ⇒ 沿用簡報全部字體與隱藏規則；scale 2 求印刷銳利度
  async function captureAll() {
    busy = true;
    const src = collectChapters(store);
    const cap = document.createElement("div");
    cap.className = "pv-fit pdf-capture" + (withLabels() ? "" : " nolabel");
    document.body.appendChild(cap);
    const shot = async (el: HTMLElement): Promise<ExImg> => {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      const img = { img: canvas.toDataURL("image/jpeg", 0.92), w: canvas.width, h: canvas.height };
      canvas.width = canvas.height = 0; // iOS：畫布用完立刻釋放
      return img;
    };
    const slide16 = (html: string): HTMLElement => {
      const box = document.createElement("div");
      box.className = "ex-slide16";
      box.innerHTML = html;
      cap.appendChild(box);
      return box;
    };
    try {
      const total = src.reduce((a, c) => a + c.pages.length, 0) + src.length + 2;
      let done = 0;
      const tick = () => {
        const s = body.querySelector(".ex-status");
        if (s) s.textContent = `擷取頁面中… ${++done} / ${total}`;
      };
      // LOGO 若是 SVG：先轉 PNG 再截（html2canvas 畫 SVG 會照原生尺寸、
      // 忽略 CSS 縮放 → 之前縮圖只剩一個角）
      const logoEl = slide16(logoSlideHtml(store));
      const logoImg = logoEl.querySelector("img");
      if (logoImg && logoImg.src.startsWith("data:image/svg")) {
        const r = await rasterLogo(logoImg.src);
        if (r) { logoImg.src = r.data; await logoImg.decode().catch(() => { /* 就緒即可 */ }); }
      }
      logo = await shot(logoEl);
      tick();
      cover = await shot(slide16(coverSlideHtml(store)));
      tick();
      chapters = [];
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        const title = await shot(slide16(titleSlideHtml(ch.en, ch.zh, i + 1)));
        tick();
        const pages: ExImg[] = [];
        for (const pg of ch.pages) {
          cap.appendChild(pg);
          pages.push(await shot(pg));
          tick();
        }
        chapters.push({ id: ch.id, en: ch.en, zh: ch.zh, title, pages });
      }
    } finally {
      cap.remove();
      busy = false;
    }
  }

  function groupHtml(i: number, en: string, zh: string, imgs: ExImg[]): string {
    const off = excluded.has(i);
    const check = i >= 0
      ? `<input type="checkbox" data-exch="${i}" ${off ? "" : "checked"}>`
      : `<span class="ex-covertag">●</span>`;
    return `<div class="ex-ch${off ? " off" : ""}">
      <label class="ex-chname">${check} ${en}<span class="ex-zh">${zh}</span></label>
      <div class="ex-thumbs">${imgs.map((m) => `<img src="${m.img}" loading="lazy" alt="">`).join("")}</div>
    </div>`;
  }

  function renderPreview() {
    if (!chapters.length) { body.innerHTML = `<div class="ex-status">沒有可匯出的內容——先在各章加入內容。</div>`; return; }
    let html = "";
    if (withTitles() && cover) html += groupHtml(-1, "COVER", "首頁＋封面", [...(logo ? [logo] : []), cover]);
    chapters.forEach((ch, i) => {
      const imgs = [...(withTitles() && ch.title ? [ch.title] : []), ...ch.pages];
      html += groupHtml(i, ch.en, ch.zh, imgs);
    });
    body.innerHTML = html;
  }

  // 依目前勾選收頁（順序＝簡報順序：封面 → 各章標題頁＋內頁）
  function selectedImgs(): ExImg[] {
    const out: ExImg[] = [];
    if (withTitles() && logo) out.push(logo);
    if (withTitles() && cover) out.push(cover);
    chapters.forEach((ch, i) => {
      if (excluded.has(i)) return;
      if (withTitles() && ch.title) out.push(ch.title);
      out.push(...ch.pages);
    });
    return out;
  }

  async function doExport(kind: "pdf" | "pptx") {
    if (busy) return;
    const imgs = selectedImgs();
    if (!imgs.length) { alert("沒有選取任何頁面。"); return; }
    busy = true;
    const toast = document.createElement("div");
    toast.className = "pv-toast";
    toast.textContent = `組裝 ${kind.toUpperCase()}…`;
    document.body.appendChild(toast);
    try {
      const name = (store.get().meta.title || "PPM").replace(/[\/:*?"<>|]/g, "-");
      let b64: string;
      if (kind === "pdf") {
        // 16:9 橫式頁（338.7×190.5mm＝簡報比例，Armin：比 A5 更有質感）：
        // 每頁等比置中塞入（contain，不裁切不變形）
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [338.7, 190.5] });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        imgs.forEach((m, i) => {
          if (i > 0) pdf.addPage();
          const k = Math.min(pw / m.w, ph / m.h);
          pdf.addImage(m.img, "JPEG", (pw - m.w * k) / 2, (ph - m.h * k) / 2, m.w * k, m.h * k);
        });
        b64 = pdf.output("datauristring").split("base64,").pop()!;
      } else {
        // PPTX＝可編輯重排版（pptxNative）：真文字框＋圖片物件＋嵌入影片＋超連結
        const ids = new Set(chapters.filter((_, i) => !excluded.has(i)).map((c) => c.id));
        b64 = await buildEditablePptx(store, {
          ids,
          withTitles: withTitles(),
          onProgress: (msg) => { toast.textContent = msg; },
        });
      }
      if (!isTauri()) { // 瀏覽器開發環境：走瀏覽器下載
        const a = document.createElement("a");
        a.href = `data:application/octet-stream;base64,${b64}`;
        a.download = `${name}_PPM.${kind}`;
        a.click();
        close();
        return;
      }
      if (isMobile()) {
        // iPad/iPhone：沒有「另存到哪」對話框——彈原生分享面板
        //（AirDrop／存到檔案／LINE 都從這裡出去）
        toast.textContent = "開啟分享…";
        await invoke("share_export", { name: `${name}_PPM.${kind}`, b64 });
        close();
        return;
      }
      const path = await save({ defaultPath: `${name}_PPM.${kind}`, filters: [{ name: kind.toUpperCase(), extensions: [kind] }] });
      if (!path) return; // 使用者取消
      await invoke("save_file", { path, b64 });
      close();
      try { await invoke("open_path", { path }); } catch { /* 檔已存好，開檔失敗不吵 */ }
    } catch (err) {
      console.error(err);
      alert(`匯出失敗：${(err as Error)?.message ?? err}`);
    } finally {
      toast.remove();
      busy = false;
    }
  }

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }
  document.addEventListener("keydown", onKey, true);

  overlay.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ex-close")) { close(); return; }
    const go = t.closest("[data-exgo]") as HTMLElement | null;
    if (go) void doExport(go.dataset.exgo as "pdf" | "pptx");
  });
  overlay.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.exch !== undefined) {
      const i = Number(t.dataset.exch);
      if (t.checked) excluded.delete(i); else excluded.add(i);
      renderPreview();
    } else if (t.hasAttribute("data-extitles")) {
      renderPreview();
    } else if (t.hasAttribute("data-exlabels")) { // 小標開關要重截圖
      body.innerHTML = `<div class="ex-status">擷取頁面中…</div>`;
      void captureAll().then(renderPreview).catch(showCaptureError);
    }
  });

  const showCaptureError = (err: unknown) => {
    body.innerHTML = `<div class="ex-status">擷取失敗：${String((err as Error)?.message ?? err).replace(/[&<>]/g, "")}</div>`;
  };
  try {
    await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    await captureAll();
    renderPreview();
  } catch (err) {
    console.error(err);
    showCaptureError(err);
  }
}
