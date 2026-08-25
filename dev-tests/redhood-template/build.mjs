// 組 STB 案子：把 64 卡的筆跡（三圖層）＋壓平 PNG 塞進 project.json。
// schema 依 app/src/model.ts；「等於預設就不寫入」的慣例照 taxId／sec 那套走。
import fs from "node:fs";
import path from "node:path";
import { CUTS, buildCut } from "./story.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(path.join(here, p)).toString("base64");

const films = [{ id: "f1", name: "A路" }];

const cuts = CUTS.map((c, i) => {
  const L = buildCut(i);
  const sketch = { scene: L.scene.filter(Boolean), figure: L.figure.filter(Boolean) };
  const extra = L.extra.filter((l) => l.strokes.filter(Boolean).length);
  if (extra.length) sketch.extra = extra.map((l) => ({ name: l.name, strokes: l.strokes.filter(Boolean) }));
  return {
    id: `c${i + 1}`,
    // groupId 相同＝連續鏡（編號會變 21-1／21-2），所以預設每顆自成一組。
    // 這兩對是真的連續鏡，順便示範這個功能：狼靠近→歪頭、掀被→撲起。
    groupId: [20, 21].includes(i) ? "gA" : [54, 55].includes(i) ? "gB" : `g${i + 1}`,
    filmId: "f1",
    shot: c.shot,
    desc: c.desc,
    vo: c.vo,
    sup: c.sup,
    imageRef: dataUrl(`png_q/cut${String(i).padStart(2, "0")}.png`),
    sketch,
    prompt: c.prompt ?? "",
    props: c.props,
    note: c.note,
  };
});

const REF = {
  tone: [
    ["png_q/cut08.png", "整體調性：手繪線稿", "全片維持鉛筆線稿的質感，不上色。唯一的彩色是小紅帽的斗篷，用來在畫面裡定位她。", [cuts[8].id]],
    ["png_q/cut12.png", "光：從樹梢漏下來", "森林段落的光都從上方來，越往故事後段越少。到外婆家時只剩窗戶那一塊。", [cuts[12].id]],
    ["png_q/cut25.png", "明暗對比：花叢是最亮的一場", "花叢的明亮是為了對照後面屋內的暗，兩場之間不要有中間調。", [cuts[25].id]],
    ["png_q/cut47.png", "暗：外婆家內景", "屋內只用排線壓暗，不塗黑。保留線稿的通透感。", [cuts[47].id]],
  ],
  rhythm: [
    ["png_q/cut20.png", "節奏：遇狼前後", "遇狼之前是走路的連續動作，遇狼之後開始出現停頓。停頓比動作更重要。", [cuts[20].id]],
    ["png_q/cut29.png", "一顆講兩件事", "前景採花、背景狼離開——同一顆裡完成，不要剪成兩顆，剪開就沒有「她沒察覺」的意思了。", [cuts[29].id]],
    ["png_q/cut50.png", "三問：同機位推進", "耳朵、眼睛、牙齒三顆用同一個機位逐步推近，節奏一致，最後一顆縮短一半。", [cuts[50].id]],
    ["png_q/cut63.png", "收尾：回到第 9 顆的那條路", "結尾用同一條路的空鏡，讓觀眾自己感覺「她走過這裡」。", [cuts[63].id]],
  ],
  references: [
    ["png_q/cut00.png", "開場：家的內景", "暖、安靜、有生活感。壁爐、木地板、窗光，都用最少的線交代。", []],
    ["png_q/cut32.png", "外婆家：三棵大樹下", "小屋是全片唯一有煙囪的建築，煙的有無是敘事訊息（第 33 顆有、第 40 顆沒有）。", []],
    ["png_q/cut49.png", "床上的「外婆」", "睡帽壓低、被子拉高，越正常越可怕。不要在這顆就露出狼的特徵。", []],
    ["png_q/cut62.png", "結尾：三個人站在屋前", "三個人不排成一直線，用高低與間距分出主次。", []],
  ],
  actor: [
    ["prop_q/actor_red.png", "小紅帽", "六到八歲。動作要輕，不演害怕——她一直到第 55 顆才知道發生什麼事。", [], true],
    ["prop_q/actor_wolf.png", "狼", "不擬人化到會走路（除了扮外婆那幾顆）。動作慢，牠不趕時間。", [], true],
    ["prop_q/actor_granny.png", "外婆／母親", "同一位演員分飾，用髮型與圍裙區分。駝背是外婆的識別。", [], true],
    ["prop_q/actor_hunter.png", "獵人", "只出現四顆，不需要台詞以外的表演。體型要明顯大過狼。", [], true],
  ],
  wardrobe: [
    ["prop_q/ward_cloak.png", "紅斗篷（主）", "全片唯一的彩色。要有兜帽、及膝、走動時下擺會擺。深紅不要正紅。", [], true],
    ["prop_q/ward_bonnet.png", "外婆的睡帽（狼穿）", "尖錐帽帶毛球，帽緣要能壓住眼睛上方——這是三問成立的前提。", [], true],
    ["prop_q/ward_hunter.png", "獵人裝", "厚外套＋寬簷帽，剪影要跟狼完全不同。", [], true],
    ["prop_q/ward_apron.png", "外婆圍裙", "家居感，深色圍裙壓在淺色衣服上。", [], true],
  ],
  setting: [
    ["prop_q/set_basket.png", "藤籃（關鍵道具）", "出現在第 1、3、32 顆與大部分行走鏡頭。蓋布是可以掀開的，裡面有麵包與酒瓶。", []],
    ["prop_q/set_bed.png", "外婆的床", "鐵製床頭板、厚棉被。被子要能一次掀開（第 55 顆）。", []],
    ["prop_q/set_cottage.png", "小屋（外觀）", "木板牆、雙斜屋頂、煙囪。窗戶要能從外面看見裡面有沒有光。", []],
    ["prop_q/set_tree.png", "樹（三種）", "針葉＝森林主體；闊葉＝路口與屋旁；枯枝＝氣氛用，只在狼出現的段落。", []],
  ],
  location: [
    ["prop_q/loc_forest.png", "森林小徑", "主場景。小徑要能一路收到畫面深處，前景兩側各留一棵出血的樹幹。", []],
    ["prop_q/loc_meadow.png", "花叢", "離小徑有一段距離，看不見小徑＝她確實偏離了。", []],
    ["prop_q/loc_house.png", "外婆家（外）", "三棵大樹下的空地，正面拍。門與窗要同時入鏡。", []],
    ["prop_q/loc_room.png", "外婆家（內）", "一窗一床一壁爐。窗在左、床在右，全片不換軸線。", []],
  ],
};

const refPages = {};
for (const [k, items] of Object.entries(REF)) {
  refPages[k] = items.map(([img, title, note, cutRefs, portrait], j) => {
    const it = { id: `${k}${j + 1}`, imageRef: dataUrl(img), title, note };
    if (cutRefs && cutRefs.length) it.cutRefs = cutRefs;
    if (portrait) it.portrait = true;
    return it;
  });
}

// 一天的拍攝通告＋Rundown（示範怎麼把 cut 指派到時段）
const days = [{
  id: "day1",
  date: "2026-09-14",
  callTime: "06:30",
  callGroups: [
    { label: "製作組", time: "06:00", loc: "溪頭妖怪村停車場" },
    { label: "攝影・燈光", time: "06:00", loc: "溪頭妖怪村停車場" },
    { label: "演員・妝髮", time: "07:00", loc: "現場梳化車" },
    { label: "美術・道具", time: "05:30", loc: "外婆家搭景現場" },
  ],
  rundown: [
    { id: "d1b1", durMin: 60, type: "call", title: "集合・器材下車", loc: "溪頭妖怪村停車場", mapUrl: "", park: "園區第二停車場（大型車可停）", props: "", cutIds: [], note: "山區清晨低溫約 12 度，提醒各組帶保暖。" },
    { id: "d1b2", durMin: 90, type: "setup", title: "森林小徑場佈・鋪軌", loc: "林道 A 段", mapUrl: "", park: "", props: "軌道 12 尺、反光板、造霧機", cutIds: [], note: "造霧要等風停，先拍不需要霧的顆。" },
    { id: "d1b3", durMin: 150, type: "shoot", title: "第 2 段　入林（行走戲）", loc: "林道 A 段", mapUrl: "", park: "", props: "藤籃、紅斗篷", cutIds: cuts.slice(8, 16).map((c) => c.id), note: "順光時段先拍第 13 顆仰角。" },
    { id: "d1b4", durMin: 60, type: "meal", title: "午餐", loc: "林道口臨時餐棚", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
    { id: "d1b5", durMin: 30, type: "move", title: "移動至外婆家搭景", loc: "林道 B 段空地", mapUrl: "", park: "", props: "", cutIds: [], note: "器材車走產業道路，約 15 分鐘。" },
    { id: "d1b6", durMin: 180, type: "shoot", title: "第 7 段　三個問題（內景）", loc: "外婆家搭景（棚內）", mapUrl: "", park: "", props: "床、睡帽、棉被、藤籃", cutIds: cuts.slice(48, 56).map((c) => c.id), note: "三顆特寫用同一機位往前推，換鏡頭不換位置。" },
    { id: "d1b7", durMin: 90, type: "shoot", title: "第 8 段　獵人・收尾", loc: "外婆家搭景（內＋外）", mapUrl: "", park: "", props: "獵人裝、獵槍（道具）", cutIds: cuts.slice(56, 64).map((c) => c.id), note: "第 64 顆等日落前 30 分鐘，只有一次機會。" },
    { id: "d1b8", durMin: 45, type: "other", title: "收工・器材點交", loc: "外婆家搭景", mapUrl: "", park: "", props: "", cutIds: [], note: "" },
  ],
  vehicles: [
    { id: "v1", label: "製片車", plate: "ABC-1234", driver: "陳製片", driverPhone: "0912-345-678", passengers: ["導演", "副導", "場記"] },
    { id: "v2", label: "器材車", plate: "DEF-5678", driver: "林燈光", driverPhone: "0922-333-444", passengers: ["攝影大助", "燈光助理"] },
    { id: "v3", label: "演員車", plate: "GHI-9012", driver: "王司機", driverPhone: "0933-222-111", passengers: ["小演員與家長", "妝髮"] },
  ],
  notes: [
    "山區訊號不穩，各組長請開對講機第 3 頻道。",
    "有兒童演員，單日工作時間上限 8 小時，且每 90 分鐘休息一次。",
    "動物（犬）由訓犬師全程陪同，禁止工作人員自行接觸。",
    "雨備：改拍第 7 段內景，外景順延至備用日 9/16。",
  ],
}];

const milestones = [
  { id: "m1", label: "PPM", start: "2026-09-01", end: "2026-09-03" },
  { id: "m2", label: "勘景・搭景", start: "2026-09-04", end: "2026-09-11" },
  { id: "m3", label: "拍攝", start: "2026-09-14", end: "2026-09-15" },
  { id: "m4", label: "A copy", start: "2026-09-16", end: "2026-09-22" },
  { id: "m5", label: "客戶回饋", start: "2026-09-23", end: "2026-09-25" },
  { id: "m6", label: "調光・混音", start: "2026-09-26", end: "2026-09-30" },
  { id: "m7", label: "Final", start: "2026-10-01", end: "2026-10-02" },
];

const project = {
  meta: { title: "小紅帽（手繪分鏡範本）", client: "範本示範", version: 1, logo: null },
  contacts: [
    { role: "導演", name: "高偉鳴", phone: "0900-000-000" },
    { role: "製片", name: "示範製片", phone: "0900-000-000" },
    { role: "監製", name: "示範監製", phone: "0900-000-000" },
  ],
  films,
  cuts,
  days,
  milestones,
  refPages,
  mode: "ppm",
  aspect: "16:9",
};

const outDir = path.join(here, "out", "小紅帽_手繪分鏡範本");
fs.rmSync(path.join(here, "out"), { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const json = JSON.stringify(project);
fs.writeFileSync(path.join(outDir, "project.json"), json);

const strokes = cuts.reduce((a, c) => a + c.sketch.scene.length + c.sketch.figure.length + (c.sketch.extra?.reduce((b, l) => b + l.strokes.length, 0) ?? 0), 0);
const pts = cuts.reduce((a, c) => a + [...c.sketch.scene, ...c.sketch.figure, ...(c.sketch.extra?.flatMap((l) => l.strokes) ?? [])].reduce((b, s) => b + s.pts.length, 0), 0);
console.log(`cuts=${cuts.length} strokes=${strokes} points=${pts} json=${(json.length / 1048576).toFixed(1)}MB`);
console.log(`refPages: ${Object.entries(refPages).map(([k, v]) => k + "=" + v.length).join(" ")}`);
