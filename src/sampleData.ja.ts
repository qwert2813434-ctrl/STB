import type { Project } from "./model";
import { normalizeProject } from "./model";

// 日文示範案：結構與 zh/en 示範案同構（同 id／同群組／同指派），內容改寫成日本 CM 情境。
// 原則（07 對照表第 4 條）：示範案不翻譯、重寫——這份是日本市場的第一印象。
// 日本絵コンテ慣例：每 cut 填秒数（合計 30 秒）＋サイズ（W/M/CU），故此案 sec 全填。
export function sampleProjectJa(): Project {
  return normalizeProject({
    meta: {
      title: "サンプル_ブランドフィルム",
      client: "サンプル制作株式会社",
      version: 1,
    },
    films: [{ id: "f1", name: "A案" }],
    contacts: [
      { role: "プロデューサー", name: "サンプルP", phone: "090-0000-0000" },
      { role: "制作担当", name: "サンプルPM", phone: "090-0000-0000" },
      { role: "ディレクター", name: "サンプルD", phone: "090-0000-0000" },
    ],
    cuts: [
      { id: "c1", groupId: "g1", shot: "W", sec: 3, desc: "木漏れ日、葉のあいだの光", vo: "水は、自然から。", sup: "サンプルスーパー A", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c2", groupId: "g2", shot: "M", sec: 4, desc: "シンクで食器を洗う女性", vo: "水の音を聞くたびに", sup: "サンプルスーパー B", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c3", groupId: "g3", shot: "M", sec: 3, desc: "皿を水切りかごに置く", vo: "流れていくのがわかる", sup: "サンプルスーパー C", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c4", groupId: "g4", shot: "CU", sec: 3.5, desc: "皿から滑り落ちる水滴", vo: "潤いを運び、汚れを連れていく", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c5", groupId: "g5", shot: "M", sec: 4, desc: "洗ったばかりの果物", vo: "洗うということは", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c6", groupId: "g5", shot: "CU", sec: 4, desc: "手のなかの果物へゆっくり寄る", vo: "水が自然へ還る旅のはじまり", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c7", groupId: "g6", shot: "W", sec: 4, desc: "空と草原、風が渡る", vo: "清潔が、重荷でなくなったとき", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c8", groupId: "g7", shot: "W", sec: 4.5, desc: "湖面をすべるトンボ", vo: "暮らしは、深く呼吸できる", sup: "", imageRef: null, prompt: "", props: "", note: "" },
    ],
    days: [
      {
        id: "d1",
        date: "2026-07-19",
        callTime: "07:30",
        callGroups: [
          { label: "制作部", time: "07:00", loc: "集合場所A（サンプル）" },
          { label: "ヘアメイク", time: "07:00", loc: "集合場所A（サンプル）" },
          { label: "演出部", time: "07:30", loc: "集合場所A（サンプル）" },
          { label: "撮影・照明・録音", time: "07:30", loc: "集合場所A（サンプル）" },
          { label: "キャスト", time: "08:30", loc: "ロケ地Aへ直行（サンプル）" },
        ],
        rundown: [
          { id: "b1", durMin: 30, type: "call", title: "集合・機材積み込み", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
          { id: "b2", durMin: 30, type: "move", title: "ロケ地Aへ移動", loc: "ロケ地A（サンプル住所）", mapUrl: "#", park: "路上駐車（サンプル）", props: "", cutIds: [], note: "" },
          { id: "b3", durMin: 90, type: "shoot", title: "ロケ地A：屋外・日中", loc: "ロケ地A（サンプル住所）", mapUrl: "#", park: "路上駐車（サンプル）", props: "なし", cutIds: ["c1", "c7", "c8"], note: "サンプルメモ" },
          { id: "b4", durMin: 60, type: "move", title: "移動＋セッティング｜ロケ地B", loc: "ロケ地B（サンプル住所）", mapUrl: "#", park: "近隣コインパーキング（サンプル）", props: "", cutIds: [], note: "" },
          { id: "b5", durMin: 60, type: "meal", title: "スタッフ弁当", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
          { id: "b6", durMin: 90, type: "shoot", title: "ロケ地B：屋内", loc: "ロケ地B（サンプル住所）", mapUrl: "", park: "", props: "サンプル小道具 ×6、装飾", cutIds: ["c2", "c3", "c4"], note: "" },
          { id: "b7", durMin: 60, type: "shoot", title: "ロケ地B：追い撮り・寄り", loc: "ロケ地B（サンプル住所）", mapUrl: "", park: "", props: "サンプル小道具（小物）", cutIds: ["c5", "c6"], note: "" },
          { id: "b8", durMin: 30, type: "other", title: "撤収・機材チェック", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
        ],
      },
    ],
    milestones: [
      { id: "m1", label: "撮影", start: "2026-07-19", end: "2026-07-19" },
      { id: "m2", label: "初号", start: "2026-07-22", end: "2026-07-24" },
      { id: "m3", label: "確認戻し", start: "2026-07-25", end: "2026-07-27" },
      { id: "m4", label: "二号", start: "2026-07-28", end: "2026-07-31" },
      { id: "m5", label: "確認戻し", start: "2026-08-01", end: "2026-08-03" },
      { id: "m6", label: "完パケ", start: "2026-08-06", end: "2026-08-07" },
    ],
    refPages: {
      tone: [
        { id: "t1", imageRef: null, title: "トーン参考 A（サンプル）", note: "自然光ベース、生活感のある質感。" },
        { id: "t2", imageRef: null, title: "トーン参考 B（サンプル）", note: "クリーンで明るい色調、透明感。" },
        { id: "t3", imageRef: null, title: "トーン参考 C（サンプル）", note: "自然のグリーン" },
        { id: "t4", imageRef: null, title: "トーン参考 D（サンプル）", note: "室内に差し込むコントラストの強い夕光" },
      ],
      rhythm: [
        { id: "rh1", imageRef: null, title: "リズム参考（サンプル）", note: "ナレーションが全体を引っ張る。柔らかなメロディに環境音を重ねる" },
      ],
      references: [
        { id: "rf1", imageRef: null, title: "動き参考（サンプル）", note: "手の動きのテンポと方向。カメラは寄るが芝居の邪魔をしない。", cutRefs: ["c3", "c4"] },
      ],
      actor: [
        { id: "a1", imageRef: null, title: "キャスト参考（サンプル）", note: "清潔感と生活感。年齢帯とスタイリングの方向性。" },
      ],
      wardrobe: [
        { id: "w1", imageRef: null, title: "白の部屋着", note: "ワンピース" },
      ],
      setting: [
        { id: "s1", imageRef: null, title: "水切りかごと白い皿", note: "" },
      ],
      location: [
        { id: "l1", imageRef: null, title: "ロケ地参考（サンプル）", note: "採光が良く、素材の質感が温かい。空間の広がりと装飾の方向性。" },
      ],
    },
  });
}
