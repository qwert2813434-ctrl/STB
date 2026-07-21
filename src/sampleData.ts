import type { Project, Aspect } from "./model";
import { normalizeProject, newId } from "./model";

// 全新空白案子（「新增案子」用）：結構齊全、內容全空——
// 十章從零開始，一個拍攝日待填，聯絡人只留職位框。
// aspect＝分鏡比例（新建時問一次；"9:16"＝直式，其餘＝橫式）。
export function emptyProject(name = "未命名案子", aspect?: Aspect): Project {
  return normalizeProject({
    meta: { title: name, client: "", version: 1 },
    contacts: [
      { role: "製片", name: "", phone: "" },
      { role: "監製", name: "", phone: "" },
      { role: "導演", name: "", phone: "" },
    ],
    cuts: [],
    days: [{ id: newId("d"), date: "", callTime: "08:00", callGroups: [], rundown: [] }],
    milestones: [],
    refPages: {},
    aspect,
  });
}

// 示範案：全部使用中性示意文字（發佈給別人看時不含任何真實專案內容）。
// 05 群組有兩個成員 → 連續鏡 05-1 / 05-2。
// 經 normalizeProject 出場：films/filmId 等新欄位自動補齊（單路）。
export function sampleProject(): Project {
  return normalizeProject({
    meta: {
      title: "示範案_品牌形象篇",
      client: "示範製作公司",
      version: 1,
    },
    contacts: [
      { role: "製片", name: "示意製片", phone: "0900-000-000" },
      { role: "監製", name: "示意監製", phone: "0900-000-000" },
      { role: "導演", name: "高偉鳴", phone: "0900-000-000" },
    ],
    cuts: [
      { id: "c1", groupId: "g1", shot: "W", desc: "陽光在樹葉之間的縫隙", vo: "水，來自自然。", sup: "示範疊印字卡 A", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c2", groupId: "g2", shot: "M", desc: "主角在流理台前洗碗盤", vo: "每當聽見水的聲音", sup: "示範疊印字卡 B", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c3", groupId: "g3", shot: "M", desc: "主角將碗盤放下", vo: "能感受到它在流動", sup: "示範疊印字卡 C", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c4", groupId: "g4", shot: "CU", desc: "看見水滴從碗盤滑落", vo: "它帶來養分，也帶走髒污", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c5", groupId: "g5", shot: "M", desc: "主角洗的水果", vo: "而我們知道，每一次洗滌", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c6", groupId: "g5", shot: "CU", desc: "鏡頭漸漸特寫手上水果", vo: "都是水再次回到自然的旅程", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c7", groupId: "g6", shot: "W", desc: "天空與草地風吹過", vo: "當潔淨不再是負擔", sup: "", imageRef: null, prompt: "", props: "", note: "" },
      { id: "c8", groupId: "g7", shot: "W", desc: "蜻蜓在湖面上", vo: "生活就能自在呼吸", sup: "", imageRef: null, prompt: "", props: "", note: "" },
    ],
    days: [
      {
        id: "d1",
        date: "2026-07-19",
        callTime: "07:30",
        callGroups: [
          { label: "製片組", time: "07:00", loc: "集合點 A（示意）" },
          { label: "妝髮組", time: "07:00", loc: "集合點 A（示意）" },
          { label: "導演組", time: "07:30", loc: "集合點 A（示意）" },
          { label: "攝影・燈光・收音", time: "07:30", loc: "集合點 A（示意）" },
          { label: "演員", time: "08:30", loc: "通告直達第一場景（示意）" },
        ],
        rundown: [
      { id: "b1", durMin: 30, type: "集合", title: "集合・器材上車", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
      { id: "b2", durMin: 30, type: "移動", title: "前往場景 A", loc: "場景 A（示意地址）", mapUrl: "#", park: "路邊白線（示意）", props: "", cutIds: [], note: "" },
      { id: "b3", durMin: 90, type: "拍攝", title: "場景 A：外景日戲", loc: "場景 A（示意地址）", mapUrl: "#", park: "路邊白線（示意）", props: "無", cutIds: ["c1", "c7", "c8"], note: "示範備註" },
      { id: "b4", durMin: 60, type: "移動", title: "移動＋場佈｜場景 B", loc: "場景 B（示意地址）", mapUrl: "#", park: "附近平面停車場（示意）", props: "", cutIds: [], note: "" },
      { id: "b5", durMin: 60, type: "用餐", title: "劇組便當", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
      { id: "b6", durMin: 90, type: "拍攝", title: "場景 B：內景戲", loc: "場景 B（示意地址）", mapUrl: "", park: "", props: "示範道具 ×6、示範陳設", cutIds: ["c2", "c3", "c4"], note: "" },
      { id: "b7", durMin: 60, type: "拍攝", title: "場景 B：補拍與特寫", loc: "場景 B（示意地址）", mapUrl: "", park: "", props: "示範道具（小件）", cutIds: ["c5", "c6"], note: "" },
      { id: "b8", durMin: 30, type: "其他", title: "收工整理・器材清點", loc: "", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
        ],
      },
    ],
    milestones: [
      { id: "m1", label: "拍攝", start: "2026-07-19", end: "2026-07-19" },
      { id: "m2", label: "A copy", start: "2026-07-22", end: "2026-07-24" },
      { id: "m3", label: "客戶回饋", start: "2026-07-25", end: "2026-07-27" },
      { id: "m4", label: "B copy", start: "2026-07-28", end: "2026-07-31" },
      { id: "m5", label: "客戶回饋", start: "2026-08-01", end: "2026-08-03" },
      { id: "m6", label: "Final", start: "2026-08-06", end: "2026-08-07" },
    ],
    refPages: {
      tone: [
        { id: "t1", imageRef: null, title: "調性參考 A（示意）", note: "自然光為主、生活感。" },
        { id: "t2", imageRef: null, title: "調性參考 B（示意）", note: "色調乾淨明亮；質感透亮。" },
        { id: "t3", imageRef: null, title: "調性參考 C（示意）", note: "自然綠色" },
        { id: "t4", imageRef: null, title: "調性參考 D（示意）", note: "室內對比強的日落光" },
      ],
      rhythm: [
        { id: "rh1", imageRef: null, title: "節奏參考（示意）", note: "口白帶著影片走，輕柔的旋律，搭配自然的環境音" },
      ],
      references: [
        { id: "rf1", imageRef: null, title: "動作參考（示意）", note: "手部動作的節奏與方向示意；鏡頭貼近但不搶戲。", cutRefs: ["c3", "c4"] },
      ],
      actor: [
        { id: "a1", imageRef: null, title: "演員參考（示意）", note: "氣質乾淨、生活感；年齡帶與造型方向示意。" },
      ],
      wardrobe: [
        { id: "w1", imageRef: null, title: "白衣居家", note: "連身洋裝" },
      ],
      setting: [
        { id: "s1", imageRef: null, title: "瀝水架及白色盤子", note: "" },
      ],
      location: [
        { id: "l1", imageRef: null, title: "場景參考（示意）", note: "採光好、材質溫潤；空間感與陳設方向示意。" },
      ],
    },
  });
}
