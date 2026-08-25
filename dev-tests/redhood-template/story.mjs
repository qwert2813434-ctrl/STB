// 《小紅帽》64 卡分鏡（8 頁滿版，橫式 16:9 每頁 8 格）。
// 每卡三層：背景 scene／人物 figure／物件 extra——iPad 上點縮圖進塗鴉編輯器可分層改。
// 特寫的作法＝把角色放大到遠超出畫布再定位，畫布本身就是取景框。
import { makeHand, GREY, RED, W, H } from "./draw.mjs";
import { redHood, basket, wolf, person, tree, cottage, bed, ground, tufts, rocks, flowers, LW, rectPts, placeAt, placeHead } from "./parts.mjs";
import { forest, canopy, meadow, cottageExt, interior, forestFloor } from "./sets.mjs";

const PATH_MID = { yNear: H + 6, yFar: 452, xNear: 660, xFar: 618, wNear: 980, wFar: 30 };

// 每卡的共用回傳格式
const F = (scene, figure, obj) => ({ scene, figure, extra: [{ name: "物件", strokes: obj }] });

export const CUTS = [
  // ─────────── 第 1 段　出發 ───────────
  {
    shot: "W", sec: 4, desc: "小紅帽的家。母親把蓋著布的籃子交到女孩手上，晨光從窗戶斜進來。",
    vo: "從前，在森林邊上住著一個小女孩。", sup: "小紅帽", props: "藤籃、蓋布、麵包",
    note: "開場定調：暖、安靜。門在畫面右側，之後她從那裡出去。",
    draw: (h) => {
      const scene = interior(h, { hearth: true, floor: 566 });
      const m = person(h, { x: 470, y: 606, s: 300, face: 1, who: "granny", pose: "reach" });
      const g = redHood(h, { x: 690, y: 612, s: 236, face: -1, pose: "stand" });
      return F(scene, [...m.out, ...g.strokes], basket(h, { x: 592, y: 480, s: 78 }));
    },
  },
  {
    shot: "M", sec: 3, desc: "母親蹲下，替女孩把兜帽拉好，叮嚀她別離開小徑。",
    vo: "「路上不要跟陌生人說話，也不要離開小徑。」", sup: "", props: "",
    note: "這顆是全片唯一的親密距離，之後都拉遠。",
    draw: (h) => {
      const scene = interior(h, { floor: 620, window: true });
      const m = person(h, { x: 430, y: 700, s: 520, face: 1, who: "granny", pose: "reach" });
      const g = redHood(h, { x: 800, y: 704, s: 430, face: -1, pose: "stand" });
      return F(scene, [...m.out, ...g.strokes], []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "籃子特寫：布被掀開一角，露出麵包與一小瓶酒，再被蓋回去。",
    vo: "籃子裡是給外婆的麵包和酒。", sup: "", props: "藤籃、麵包、酒瓶",
    note: "道具即劇本——這顆決定了後面所有「籃子還在不在」的敘事。",
    draw: (h) => {
      const { hatch } = h;
      const scene = [...hatch(0, 0, W, H, { gap: 30, size: LW.faint, press: 0.26, color: GREY, angle: -1.15 })];
      return F(scene, [], basket(h, { x: 640, y: 560, s: 480 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "小紅帽的臉，點了點頭。兜帽的紅佔滿畫面上緣。",
    vo: "小女孩答應了。", sup: "", props: "",
    note: "只有這裡看得清她的表情，記住這張臉，第 53 顆要對照。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 32, size: LW.faint, press: 0.24, color: GREY, angle: -1.15 });
      const g = redHood(h, { ...placeHead("red", [660, 356], 1500), s: 1500, face: 1, pose: "stand" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "W", sec: 3, desc: "家門口。小紅帽走出門，母親倚在門框上目送。",
    vo: "", sup: "", props: "",
    note: "門框當前景框，人往畫面深處走。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 420, base: 560, w: 380, open: true, smoke: true, path: false });
      const g = redHood(h, { x: 760, y: 646, s: 250, face: 1, pose: "walk" });
      const m = person(h, { x: 470, y: 566, s: 170, face: 1, who: "granny", pose: "raise" });
      return F(scene, [...m.out, ...g.strokes], basket(h, { x: g.hand[0] + 4, y: g.hand[1] + 22, s: 62 }));
    },
  },
  {
    shot: "MS", sec: 3, desc: "小紅帽的背影，走上通往森林的小徑。",
    vo: "於是她提著籃子，往森林走去。", sup: "", props: "",
    note: "背影 ＝ 觀眾跟著她走。全片最常用的機位。",
    draw: (h) => {
      const scene = forest(h, { horizon: 430, gy: 556, path: PATH_MID, fore: "left" });
      const g = redHood(h, { x: 640, y: 690, s: 300, face: -1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] - 4, y: g.hand[1] + 26, s: 74 }));
    },
  },
  {
    shot: "W", sec: 3, desc: "回頭看：家已經變小，母親還站在門口。",
    vo: "", sup: "", props: "",
    note: "越肩回望，交代距離感，也是最後一次看到家。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 470, base: 486, w: 200, smoke: true, path: false, far: true });
      const m = person(h, { x: 496, y: 492, s: 78, face: 1, who: "granny", pose: "raise" });
      const g = redHood(h, { x: 1080, y: 730, s: 420, face: -1, pose: "stand" });
      return F(scene, [...m.out, ...g.strokes], []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "腳步踩過落葉。",
    vo: "", sup: "", props: "落葉",
    note: "轉場用的地面空鏡；聲音在這裡接進森林。",
    draw: (h) => {
      const scene = forestFloor(h);
      const g = redHood(h, { x: 660, y: 620, s: 1500, face: 1, pose: "walk" });
      return F(scene, g.strokes, []);
    },
  },

  // ─────────── 第 2 段　入林 ───────────
  {
    shot: "W", sec: 4, desc: "森林全景。高聳的針葉林，小徑往深處收，小紅帽只有一點紅。",
    vo: "森林很大，也很安靜。", sup: "", props: "",
    note: "全片的地理定場。紅點的大小＝她有多深入。",
    draw: (h) => {
      const scene = forest(h, { horizon: 424, gy: 552, path: PATH_MID, fore: "both", dense: 1.2 });
      const g = redHood(h, { x: 648, y: 596, s: 130, face: -1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] - 2, y: g.hand[1] + 12, s: 34 }));
    },
  },
  {
    shot: "MS", sec: 3, desc: "穿過兩棵大樹之間，樹幹在前景切過畫面。",
    vo: "", sup: "", props: "",
    note: "前景遮擋製造「有人在看她」的不安，但這顆還沒有狼。",
    draw: (h) => {
      const scene = forest(h, { horizon: 400, gy: 588, fore: "both", dense: 0.8, bare: 1 });
      const g = redHood(h, { x: 600, y: 700, s: 320, face: 1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 4, y: g.hand[1] + 26, s: 78 }));
    },
  },
  {
    shot: "M", sec: 3, desc: "側面跟拍。小紅帽一邊走一邊哼歌，籃子隨腳步晃。",
    vo: "她一路哼著歌。", sup: "", props: "藤籃",
    note: "橫移跟拍；背景樹幹等速滑過就有速度感。",
    draw: (h) => {
      const scene = forest(h, { horizon: 380, gy: 600, fore: null, dense: 1.1 });
      const g = redHood(h, { x: 560, y: 706, s: 380, face: 1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 30, s: 96 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "手撥開擋路的枝條。",
    vo: "", sup: "", props: "",
    note: "小動作維持節奏，避免連續走路顯得拖。",
    draw: (h) => {
      const { sketchy, stroke, R } = h;
      const scene = [];
      for (let i = 0; i < 8; i++) {
        const y = 60 + i * 90;
        scene.push(...sketchy([[-30, y], [400, y + R(-60, 60)], [900, y + R(-80, 80)], [W + 30, y + R(-40, 40)]], { size: LW.body * R(0.6, 1.2), jitter: 2.6, passes: 1 }));
      }
      scene.push(...h.hatch(0, 0, W, H, { gap: 34, size: LW.faint, press: 0.24, color: GREY, angle: -1.15 }));
      const g = redHood(h, { ...placeAt([30, -76], [830, 390], 2200), s: 2200, face: 1, pose: "reach" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "W", sec: 3, desc: "仰角。陽光從樹梢的縫隙灑下來。",
    vo: "陽光從樹葉的縫隙裡漏下來。", sup: "", props: "",
    note: "全片唯一的仰角，用來換氣。之後的森林都會變暗。",
    draw: (h) => F(canopy(h), [], []),
  },
  {
    shot: "MS", sec: 2, desc: "一群小鳥從枝頭飛起。",
    vo: "", sup: "", props: "",
    note: "鳥飛＝有東西驚動了牠們。這是狼的第一次「出場」。",
    draw: (h) => {
      const { stroke, R } = h;
      const scene = forest(h, { horizon: 360, gy: 620, fore: "right", dense: 0.9, bare: 2 });
      const birds = [];
      for (let i = 0; i < 14; i++) {
        const x = R(200, 1100), y = R(80, 380), s = R(0.7, 1.6);
        birds.push(stroke([[x - 16 * s, y], [x - 6 * s, y - 8 * s], [x, y - 2 * s], [x + 6 * s, y - 9 * s], [x + 16 * s, y - 1 * s]], { size: LW.detail, press: 0.6, jitter: 0.8 }));
      }
      return F(scene, [], birds);
    },
  },
  {
    shot: "M", sec: 3, desc: "小紅帽停下腳步，回頭看了一眼。",
    vo: "", sup: "", props: "",
    note: "第一次停頓。從這裡開始節奏變慢。",
    draw: (h) => {
      const scene = forest(h, { horizon: 392, gy: 596, fore: "left", dense: 1 });
      const g = redHood(h, { x: 620, y: 700, s: 360, face: -1, pose: "stand" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] - 6, y: g.hand[1] + 28, s: 90 }));
    },
  },
  {
    shot: "W", sec: 3, desc: "小徑轉彎處，樹後有一團說不清的暗影。",
    vo: "", sup: "", props: "",
    note: "影子不要畫清楚，觀眾自己會補完。",
    draw: (h) => {
      const scene = forest(h, { horizon: 420, gy: 566, path: { ...PATH_MID, xFar: 760, xNear: 520 }, fore: "both", dense: 1.1 });
      const shade = h.hatch(760, 420, 210, 150, { gap: 8, size: LW.faint, press: 0.55, color: GREY, angle: -1.2 });
      const g = redHood(h, { x: 470, y: 636, s: 190, face: 1, pose: "walk" });
      return F(scene, g.strokes, shade);
    },
  },

  // ─────────── 第 3 段　遇狼 ───────────
  {
    shot: "MS", sec: 2, desc: "樹後有動靜，枝葉晃了一下。",
    vo: "", sup: "", props: "",
    note: "只給聲音與晃動，狼還沒露臉。",
    draw: (h) => {
      const scene = forest(h, { horizon: 402, gy: 590, fore: "right", dense: 1 });
      const { stroke, R } = h;
      const swish = [];
      for (let i = 0; i < 6; i++) swish.push(stroke([[700 + i * 18, 330 + R(-30, 30)], [780 + i * 22, 300 + R(-40, 40)]], { size: LW.detail, press: 0.5, jitter: 1.6, tail: 8 }));
      return F(scene, [], swish);
    },
  },
  {
    shot: "CU", sec: 2, desc: "狼的眼睛。",
    vo: "", sup: "", props: "",
    note: "全片第一個「狼」的資訊，只給眼睛。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 14, size: LW.faint, press: 0.34, color: GREY, angle: -1.15 });
      const w = wolf(h, { ...placeHead("wolf", [600, 330], 1700), s: 1700, face: 1, pose: "stalk" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "W", sec: 4, desc: "狼從樹後走出來，不快，正好擋在小徑中間。",
    vo: "然後，牠出現了。", sup: "狼", props: "",
    note: "兩人分居畫面兩側、中間留空＝對峙。別讓他們靠近。",
    draw: (h) => {
      const scene = forest(h, { horizon: 416, gy: 570, path: PATH_MID, fore: "left", dense: 1 });
      const w = wolf(h, { x: 880, y: 596, s: 240, face: -1, pose: "stalk" });
      const g = redHood(h, { x: 420, y: 622, s: 250, face: 1, pose: "stand" });
      return F(scene, [...w.out, ...g.strokes], basket(h, { x: g.hand[0] + 4, y: g.hand[1] + 22, s: 62 }));
    },
  },
  {
    shot: "M", sec: 2, desc: "小紅帽退了半步，籃子抱緊。",
    vo: "", sup: "", props: "藤籃",
    note: "退半步就好，不要演成驚嚇——她還不知道危險。",
    draw: (h) => {
      const scene = forest(h, { horizon: 386, gy: 600, fore: "left", dense: 0.9 });
      const g = redHood(h, { x: 560, y: 706, s: 380, face: 1, pose: "crouch" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 30, s: 96 }));
    },
  },
  {
    shot: "MS", sec: 3, desc: "低角度：狼一步一步靠近，體型壓過畫面。",
    vo: "「小姑娘，妳要去哪裡呢？」", sup: "", props: "",
    note: "低機位讓狼變大，這是全片唯一一次把狼放到最大。",
    draw: (h) => {
      const scene = forest(h, { horizon: 300, gy: 660, fore: "right", dense: 0.7 });
      const w = wolf(h, { x: 700, y: 700, s: 560, face: -1, pose: "trot" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "M", sec: 3, desc: "狼歪著頭，裝出友善的樣子。",
    vo: "「去外婆家。她生病了。」", sup: "", props: "",
    note: "歪頭是全片唯一的「表演」，其餘都靠構圖。",
    draw: (h) => {
      const scene = forest(h, { horizon: 340, gy: 640, fore: null, dense: 0.8 });
      const w = wolf(h, { x: 620, y: 690, s: 470, face: -1, pose: "stalk" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "小紅帽的臉，說出了外婆家在哪裡。",
    vo: "「就在森林的另一頭，三棵大橡樹下面。」", sup: "", props: "",
    note: "這句話是全片的轉折點——她自己說出了地址。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 30, size: LW.faint, press: 0.26, color: GREY, angle: -1.15 });
      const g = redHood(h, { ...placeHead("red", [600, 340], 1450), s: 1450, face: 1, pose: "stand" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "W", sec: 3, desc: "一人一狼站在小徑上，樹影把他們框在中間。",
    vo: "", sup: "", props: "",
    note: "段落收尾的定場。狼的位置比她高一階＝主導權換人。",
    draw: (h) => {
      const scene = forest(h, { horizon: 412, gy: 576, path: PATH_MID, fore: "both", dense: 1.1 });
      const w = wolf(h, { x: 840, y: 566, s: 190, face: -1, pose: "stalk" });
      const g = redHood(h, { x: 470, y: 616, s: 220, face: 1, pose: "stand" });
      return F(scene, [...w.out, ...g.strokes], basket(h, { x: g.hand[0] + 4, y: g.hand[1] + 20, s: 56 }));
    },
  },

  // ─────────── 第 4 段　岔路與花 ───────────
  {
    shot: "M", sec: 3, desc: "狼抬起前爪，指向林子深處的花叢。",
    vo: "「妳看，那邊的花開得多好。」", sup: "", props: "",
    note: "狼的動作要慢；牠不趕時間，牠在下一步棋。",
    draw: (h) => {
      const scene = forest(h, { horizon: 356, gy: 630, fore: "left", dense: 0.8 });
      const w = wolf(h, { x: 700, y: 680, s: 430, face: -1, pose: "stand" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "W", sec: 3, desc: "花叢。陽光落在草地上，一片明亮。",
    vo: "", sup: "", props: "野花",
    note: "全片最亮的一顆，跟後面外婆家的暗形成對比。",
    draw: (h) => F(meadow(h, { gy: 520, horizon: 392 }), [], []),
  },
  {
    shot: "MS", sec: 3, desc: "小紅帽離開小徑，走進花叢裡。",
    vo: "她想，摘一把花給外婆吧。", sup: "", props: "藤籃",
    note: "「離開小徑」＝她違背了第 2 顆的叮嚀。構圖上要看得出她走出了路。",
    draw: (h) => {
      const scene = meadow(h, { gy: 540, horizon: 400 });
      const g = redHood(h, { x: 700, y: 660, s: 300, face: 1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 26, s: 76 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "手摘下一朵花。",
    vo: "", sup: "", props: "野花",
    note: "",
    draw: (h) => {
      const scene = [...meadow(h, { gy: 320, horizon: 190 }), ...flowers(h, { y: 640, from: 40, to: 1240, n: 8, size: 5.2 })];
      const g = redHood(h, { ...placeAt([30, -76], [560, 330], 1250), s: 1250, face: 1, pose: "reach" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "M", sec: 4, desc: "小紅帽低頭採花；背景深處，狼安靜地離開了。",
    vo: "", sup: "", props: "野花、藤籃",
    note: "一顆講兩件事：前景她沒察覺、背景狼走了。不要剪成兩顆。",
    draw: (h) => {
      const scene = meadow(h, { gy: 556, horizon: 386 });
      const w = wolf(h, { x: 1080, y: 404, s: 120, face: -1, pose: "trot" });
      const g = redHood(h, { x: 480, y: 690, s: 340, face: 1, pose: "crouch" });
      return F(scene, [...w.out, ...g.strokes], [...basket(h, { x: 700, y: 660, s: 92 }), ...flowers(h, { y: 640, from: 300, to: 620, n: 4, size: 1.8 })]);
    },
  },
  {
    shot: "W", sec: 3, desc: "狼在林子裡快步奔跑，往外婆家的方向。",
    vo: "狼比她先走一步。", sup: "", props: "",
    note: "全片唯一的速度感。之後回到慢。",
    draw: (h) => {
      const scene = forest(h, { horizon: 408, gy: 578, fore: "both", dense: 1.2 });
      const w = wolf(h, { x: 620, y: 596, s: 250, face: -1, pose: "trot" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "MS", sec: 3, desc: "小紅帽抬起頭——小徑上已經沒有狼了。",
    vo: "", sup: "", props: "",
    note: "空掉的路比狼還可怕。留白兩秒再切。",
    draw: (h) => {
      const scene = forest(h, { horizon: 420, gy: 560, path: PATH_MID, fore: "left", dense: 1 });
      const g = redHood(h, { x: 430, y: 686, s: 300, face: 1, pose: "stand" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 24, s: 74 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "花束被放進籃子，蓋上布。",
    vo: "", sup: "", props: "藤籃、野花",
    note: "跟第 3 顆同機位＝籃子的第二次亮相，觀眾會感覺時間過去了。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 30, size: LW.faint, press: 0.26, color: GREY, angle: -1.15 });
      return F(scene, [], [...basket(h, { x: 640, y: 580, s: 470 }), ...flowers(h, { y: 356, from: 470, to: 810, n: 5, size: 2.6, color: RED })]);
    },
  },

  // ─────────── 第 5 段　狼先到 ───────────
  {
    shot: "W", sec: 3, desc: "外婆的小屋，三棵大樹下。煙囪冒著煙。",
    vo: "外婆的家就在三棵大樹下面。", sup: "外婆家", props: "",
    note: "小屋的定場。記住煙囪有煙——第 40 顆它會停。",
    draw: (h) => F(cottageExt(h, { x: 700, base: 556, w: 420, smoke: true }), [], []),
  },
  {
    shot: "MS", sec: 3, desc: "狼走到門前，停住。",
    vo: "", sup: "", props: "",
    note: "狼的背影，別給表情。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 760, base: 600, w: 620, smoke: true, path: false });
      const w = wolf(h, { x: 460, y: 640, s: 300, face: 1, pose: "stalk" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "爪子敲了敲門板。",
    vo: "「外婆，是我，小紅帽。」", sup: "", props: "",
    note: "聲音要學小孩，畫面只給爪子＝觀眾知道是假的，外婆不知道。",
    draw: (h) => {
      const { sketchy, hatch } = h;
      const scene = [...sketchy(rectPts(120, -60, 1040, 900), { size: LW.hero, jitter: 1.6, closed: true, passes: 2 })];
      for (let i = 1; i < 5; i++) scene.push(...sketchy([[140, -60 + i * 190], [1140, -60 + i * 190]], { size: LW.faint, press: 0.4, jitter: 1.4, passes: 1 }));
      scene.push(...hatch(0, 0, 120, H, { gap: 16, size: LW.faint, press: 0.4, color: GREY }));
      const w = wolf(h, { ...placeAt([31, -58], [840, 300], 620), s: 620, face: 1, pose: "stand" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "M", sec: 2, desc: "門開了一條縫，裡面是黑的。",
    vo: "", sup: "", props: "",
    note: "門縫的黑要夠黑——這是全片最直接的一次恐嚇。",
    draw: (h) => {
      const { sketchy, hatch } = h;
      const scene = [...hatch(0, 0, W, H, { gap: 26, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 })];
      scene.push(...sketchy(rectPts(196, -40, 700, 820), { size: LW.hero, jitter: 1.6, closed: true, passes: 2 }));
      for (let i = 1; i < 4; i++) scene.push(...sketchy(rectPts(240, 20 + i * 200, 610, 160), { size: LW.faint, press: 0.45, closed: true, passes: 1 }));
      // 門縫：開一條，裡面全黑
      const gap = [...sketchy(rectPts(896, -40, 96, 820), { size: LW.body, jitter: 1.4, closed: true, passes: 2 }),
        ...hatch(900, -30, 88, 800, { gap: 5, size: LW.body, press: 0.9 }),
        ...hatch(900, -30, 88, 800, { gap: 5, size: LW.body, press: 0.9, angle: -2.1 })];
      return F(scene, [], gap);
    },
  },
  {
    shot: "MS", sec: 3, desc: "狼推門進去，背影沒入屋內的暗處。",
    vo: "", sup: "", props: "",
    note: "不拍狼做了什麼。門一關，觀眾自己會想。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 700, base: 580, w: 560, open: true, smoke: true, path: false });
      const w = wolf(h, { x: 800, y: 600, s: 240, face: 1, pose: "stalk" });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "W", sec: 3, desc: "門關上了。屋子從外面看，什麼也沒發生。",
    vo: "", sup: "", props: "",
    note: "空鏡。這裡要留白足夠久，久到觀眾不舒服。",
    draw: (h) => F(cottageExt(h, { x: 700, base: 556, w: 420, smoke: false, lit: false }), [], []),
  },
  {
    shot: "CU", sec: 2, desc: "窗簾被風吹動了一下。",
    vo: "", sup: "", props: "窗簾",
    note: "唯一的動作在窗簾上。屋裡沒有聲音。",
    draw: (h) => {
      const { sketchy, stroke, scrub, hatch, R } = h;
      const scene = [...hatch(250, 30, 680, 650, { gap: 26, size: LW.faint, press: 0.32, color: GREY, angle: -1.2 })];
      scene.push(...sketchy([[150, -30], [140, 300], [162, 700], [230, 420], [214, -20]], { size: LW.hero, jitter: 1.8, passes: 2, spread: 1.8 }));
      for (let i = 0; i < 5; i++) scene.push(...sketchy([[168 + i * 14, -20], [156 + i * 16, 320], [176 + i * 15, 690]], { size: LW.detail, press: 0.5, jitter: 1.6, passes: 1 }));
      // 被風掀起的一角
      const curtain = [...sketchy([[880, -30], [1010, 260], [900, 520], [1080, 660], [1180, 300], [1150, -20]], { size: LW.hero, jitter: 2, passes: 2, spread: 2 })];
      for (let i = 0; i < 4; i++) curtain.push(...sketchy([[930 + i * 46, -20], [960 + i * 40, 280], [1000 + i * 44, 600]], { size: LW.detail, press: 0.5, jitter: 1.8, passes: 1 }));
      scene.push(...hatch(0, 0, 150, H, { gap: 16, size: LW.faint, press: 0.4, color: GREY }));
      return F(scene, [], curtain);
    },
  },
  {
    shot: "W", sec: 3, desc: "屋外很安靜，煙囪的煙不見了。",
    vo: "", sup: "", props: "",
    note: "對照第 33 顆：煙沒了＝爐火滅了＝家裡沒人在照顧。",
    draw: (h) => F(cottageExt(h, { x: 700, base: 556, w: 420, smoke: false, far: true }), [], []),
  },

  // ─────────── 第 6 段　抵達 ───────────
  {
    shot: "W", sec: 3, desc: "小紅帽提著籃子走近小屋。",
    vo: "小紅帽採完花，才想起外婆。", sup: "", props: "藤籃、野花",
    note: "跟第 33 顆同機位，這次畫面裡多了她。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 720, base: 556, w: 420, smoke: false });
      const g = redHood(h, { x: 420, y: 690, s: 290, face: 1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 24, s: 72 }));
    },
  },
  {
    shot: "MS", sec: 2, desc: "門是開著的。",
    vo: "", sup: "", props: "",
    note: "外婆從不讓門開著——這個細節要讓觀眾比她先發現。",
    draw: (h) => F(cottageExt(h, { x: 660, base: 610, w: 700, open: true, smoke: false, path: false }), [], []),
  },
  {
    shot: "M", sec: 3, desc: "小紅帽站在門口喊了一聲。",
    vo: "「外婆？」", sup: "", props: "",
    note: "沒有人回答。這顆之後全片沒有 VO 到第 60 顆。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 620, base: 660, w: 860, open: true, smoke: false, path: false });
      const g = redHood(h, { x: 800, y: 700, s: 330, face: -1, pose: "stand" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] - 6, y: g.hand[1] + 26, s: 82 }));
    },
  },
  {
    shot: "W", sec: 3, desc: "從門口看進屋內：昏暗，只有窗戶那一塊亮。",
    vo: "", sup: "", props: "",
    note: "主觀鏡頭。床在畫面右邊，先給一半就好。",
    draw: (h) => {
      const { sketchy, hatch } = h;
      const scene = interior(h, { floor: 566, dim: true, bedAt: { x: 800, base: 600, w: 600, face: -1 } });
      // 門框壓四邊＝主觀鏡頭
      const frame = [...hatch(0, 0, 150, H, { gap: 7, size: LW.body, press: 0.8 }),
        ...hatch(1140, 0, 140, H, { gap: 7, size: LW.body, press: 0.8 }),
        ...hatch(0, 0, W, 70, { gap: 7, size: LW.body, press: 0.8 }),
        ...sketchy([[150, -20], [150, H + 20]], { size: LW.hero, jitter: 1.4, passes: 2 }),
        ...sketchy([[1140, -20], [1140, H + 20]], { size: LW.hero, jitter: 1.4, passes: 2 }),
        ...sketchy([[140, 70], [1150, 70]], { size: LW.hero, jitter: 1.4, passes: 2 })];
      return F(scene, [], frame);
    },
  },
  {
    shot: "MS", sec: 3, desc: "小紅帽走進屋裡，門在她身後半掩。",
    vo: "", sup: "", props: "藤籃",
    note: "她背對門＝退路被切掉了。",
    draw: (h) => {
      const scene = interior(h, { floor: 576, dim: true, bedAt: { x: 950, base: 606, w: 540, face: -1 } });
      const g = redHood(h, { x: 400, y: 646, s: 300, face: 1, pose: "walk" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 26, s: 76 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "地上有一隻翻倒的椅子。",
    vo: "", sup: "", props: "木椅",
    note: "唯一的暴力痕跡，不拍外婆。",
    draw: (h) => {
      const { sketchy, hatch } = h;
      const scene = [...hatch(0, 0, W, H, { gap: 28, size: LW.faint, press: 0.28, color: GREY, angle: -1.15 })];
      scene.push(...sketchy([[0, 596], [640, 612], [W, 590]], { size: LW.hero, jitter: 2, passes: 2 }));   // 地板
      // 側倒的椅子：椅面朝觀眾、四腳朝右、椅背躺在地上
      const seat = [[300, 300], [640, 250], [700, 470], [352, 528]];
      const ch = [...h.fillPoly(seat), ...sketchy(seat, { size: LW.hero, jitter: 1.4, closed: true, passes: 2 })];
      for (const [ax, ay, bx, by] of [[640, 250, 880, 214], [700, 470, 942, 430], [300, 300, 250, 214], [352, 528, 300, 442]])
        ch.push(...sketchy([[ax, ay], [bx, by]], { size: LW.body, jitter: 1.3, passes: 2 }));
      ch.push(...sketchy([[880, 214], [942, 430]], { size: LW.body, jitter: 1.2, passes: 1 }));
      ch.push(...sketchy([[250, 214], [300, 442]], { size: LW.body, jitter: 1.2, passes: 1 }));
      const back = [[300, 300], [250, 214], [110, 236], [166, 322]];
      ch.push(...h.fillPoly(back), ...sketchy(back, { size: LW.body, jitter: 1.3, closed: true, passes: 2 }));
      ch.push(...h.hatch(320, 300, 340, 200, { gap: 22, size: LW.faint, press: 0.35, color: GREY, angle: -0.4 }));
      return F(scene, [], ch);
    },
  },
  {
    shot: "M", sec: 3, desc: "小紅帽轉頭看向床的方向。",
    vo: "", sup: "", props: "",
    note: "視線引導：她看的方向就是下一顆。",
    draw: (h) => {
      const scene = interior(h, { floor: 620, dim: true, window: true });
      const g = redHood(h, { x: 480, y: 700, s: 400, face: 1, pose: "stand" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 8, y: g.hand[1] + 32, s: 100 }));
    },
  },
  {
    shot: "W", sec: 3, desc: "床上躺著一個人影，戴著外婆的睡帽，被子拉到下巴。",
    vo: "", sup: "", props: "睡帽、棉被",
    note: "遠一點，別讓觀眾太早看清那是狼。",
    draw: (h) => {
      const scene = interior(h, { floor: 566, dim: true, bedAt: { x: 820, base: 600, w: 620, face: -1 } });
      const w = wolf(h, { x: 760, y: 486, s: 250, face: -1, pose: "lie", bonnet: true });
      return F(scene, w.out, []);
    },
  },

  // ─────────── 第 7 段　三個問題 ───────────
  {
    shot: "MS", sec: 3, desc: "小紅帽一步一步走近床邊。",
    vo: "", sup: "", props: "",
    note: "三顆問答之前唯一的移動。之後全部定鏡。",
    draw: (h) => {
      const scene = interior(h, { floor: 580, dim: true, bedAt: { x: 900, base: 610, w: 560, face: -1 } });
      const w = wolf(h, { x: 850, y: 500, s: 230, face: -1, pose: "lie", bonnet: true });
      const g = redHood(h, { x: 360, y: 654, s: 310, face: 1, pose: "walk" });
      return F(scene, [...w.out, ...g.strokes], basket(h, { x: g.hand[0] + 6, y: g.hand[1] + 26, s: 78 }));
    },
  },
  {
    shot: "M", sec: 3, desc: "床上的「外婆」，睡帽壓得很低。",
    vo: "", sup: "", props: "睡帽",
    note: "這顆要正面、對稱、安靜。越正常越可怕。",
    draw: (h) => {
      const scene = interior(h, { floor: 640, dim: true, window: false, bedAt: { x: 700, base: 680, w: 900, face: -1 } });
      const w = wolf(h, { x: 660, y: 520, s: 420, face: -1, pose: "lie", bonnet: true });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "睡帽底下露出來的耳朵。",
    vo: "「外婆，妳的耳朵好大。」", sup: "", props: "",
    note: "三問的第一問。三顆用同一個機位往前推。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 26, size: LW.faint, press: 0.28, color: GREY, angle: -1.15 });
      const w = wolf(h, { ...placeHead("wolfUp", [640, 470], 1450), s: 1450, face: 1, pose: "lie", bonnet: true });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "M", sec: 2, desc: "小紅帽在床邊，手還抓著籃子。",
    vo: "「這樣才聽得清楚妳說話呀。」", sup: "", props: "藤籃",
    note: "反應鏡頭；她的臉不要害怕，只要疑惑。",
    draw: (h) => {
      const scene = interior(h, { floor: 660, dim: true, window: false });
      const g = redHood(h, { x: 520, y: 720, s: 420, face: 1, pose: "stand" });
      return F(scene, g.strokes, basket(h, { x: g.hand[0] + 8, y: g.hand[1] + 34, s: 104 }));
    },
  },
  {
    shot: "CU", sec: 2, desc: "睡帽陰影下的一雙眼睛。",
    vo: "「外婆，妳的眼睛好大。」", sup: "", props: "",
    note: "第二問。比上一顆再近一階。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 22, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 });
      const w = wolf(h, { ...placeHead("wolfUp", [600, 400], 2000), s: 2000, face: 1, pose: "lie", bonnet: true });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "M", sec: 2, desc: "小紅帽又往前一點。",
    vo: "「這樣才看得清楚妳呀。」", sup: "", props: "",
    note: "同機位、人更大一點＝她自己走進危險。",
    draw: (h) => {
      const scene = interior(h, { floor: 700, dim: true, window: false });
      const g = redHood(h, { x: 560, y: 760, s: 500, face: 1, pose: "stand" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "CU", sec: 2, desc: "被子被掀開——是狼的嘴。",
    vo: "「外婆，妳的牙齒好大——」", sup: "", props: "",
    note: "第三問。這顆是全片的爆點，只給零點五秒。",
    draw: (h) => {
      const scene = h.hatch(0, 0, W, H, { gap: 18, size: LW.faint, press: 0.34, color: GREY, angle: -1.15 });
      const w = wolf(h, { ...placeAt([25, -82], [620, 400], 2200), s: 2200, face: 1, pose: "stand", snarl: true });
      return F(scene, w.out, []);
    },
  },
  {
    shot: "W", sec: 2, desc: "狼從床上撲起來。",
    vo: "", sup: "", props: "棉被",
    note: "動勢往畫面左下＝小紅帽的位置。撞出去就切。",
    draw: (h) => {
      const { stroke, R } = h;
      const scene = interior(h, { floor: 576, dim: true, bedAt: { x: 900, base: 606, w: 560, face: -1 } });
      const w = wolf(h, { x: 700, y: 470, s: 400, face: -1, pose: "trot" });
      const lines = [];
      for (let i = 0; i < 9; i++) lines.push(stroke([[900 + i * 34, 180 + R(-40, 40)], [560 + i * 30, 420 + R(-40, 40)]], { size: LW.detail, press: 0.5, jitter: 2, tail: 10 }));
      return F(scene, w.out, lines);
    },
  },

  // ─────────── 第 8 段　獵人 ───────────
  {
    shot: "W", sec: 3, desc: "屋外。一個獵人正好經過，聽見了聲響。",
    vo: "", sup: "獵人", props: "獵槍",
    note: "救援線第一次出現。不要更早鋪，也不能更晚。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 720, base: 556, w: 420, smoke: false });
      const p = person(h, { x: 300, y: 636, s: 280, face: 1, who: "hunter", pose: "stand" });
      return F(scene, p.out, []);
    },
  },
  {
    shot: "MS", sec: 2, desc: "獵人推開門。",
    vo: "", sup: "", props: "",
    note: "門開的方向跟第 37 顆狼進去時相反＝救援。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 660, base: 640, w: 780, open: true, smoke: false, path: false });
      const p = person(h, { x: 420, y: 690, s: 360, face: 1, who: "hunter", pose: "reach" });
      return F(scene, p.out, []);
    },
  },
  {
    shot: "M", sec: 2, desc: "獵人舉起手臂大喝一聲。",
    vo: "「出去！」", sup: "", props: "",
    note: "全片唯一的大動作。聲音比畫面重要。",
    draw: (h) => {
      const scene = interior(h, { floor: 640, dim: true, window: true });
      const p = person(h, { x: 520, y: 700, s: 430, face: 1, who: "hunter", pose: "raise" });
      return F(scene, p.out, []);
    },
  },
  {
    shot: "W", sec: 2, desc: "狼從窗戶跳出去，逃進森林。",
    vo: "狼從窗戶逃走了，再也沒有回來。", sup: "", props: "",
    note: "不打不殺——這是給小孩看的版本。狼只是消失。",
    draw: (h) => {
      const { stroke, R } = h;
      const scene = cottageExt(h, { x: 560, base: 596, w: 560, open: true, smoke: false, path: false });
      const w = wolf(h, { x: 960, y: 612, s: 250, face: 1, pose: "trot" });
      const speed = [];
      for (let i = 0; i < 7; i++) speed.push(stroke([[600 + R(-30, 30), 430 + i * 26], [820 + R(-40, 40), 430 + i * 26]], { size: LW.faint, press: 0.45, jitter: 1.4, tail: 10 }));
      return F(scene, w.out, speed);
    },
  },
  {
    shot: "MS", sec: 3, desc: "小紅帽從床底下爬出來。",
    vo: "", sup: "", props: "",
    note: "她自己爬出來，不要被抱出來。",
    draw: (h) => {
      const scene = interior(h, { floor: 580, dim: false, bedAt: { x: 880, base: 610, w: 560, face: -1 } });
      const g = redHood(h, { x: 520, y: 656, s: 300, face: 1, pose: "crouch" });
      return F(scene, g.strokes, []);
    },
  },
  {
    shot: "M", sec: 3, desc: "衣櫃打開，外婆平安無事地走出來。",
    vo: "外婆躲在衣櫃裡，一點事也沒有。", sup: "", props: "衣櫃",
    note: "外婆自己走出來＝這個版本沒有人被吃掉。",
    draw: (h) => {
      const { sketchy } = h;
      const scene = interior(h, { floor: 620, window: true });
      scene.push(...sketchy(rectPts(760, 180, 360, 440), { size: LW.body, jitter: 1.2, closed: true, passes: 2 }));
      scene.push(...sketchy([[940, 184], [940, 616]], { size: LW.detail, jitter: 1, passes: 1 }));
      const p = person(h, { x: 500, y: 690, s: 380, face: 1, who: "granny", pose: "reach" });
      return F(scene, p.out, []);
    },
  },
  {
    shot: "W", sec: 4, desc: "三個人站在小屋前，籃子放在門邊的石頭上。",
    vo: "那天以後，小紅帽再也沒有離開過小徑。", sup: "", props: "藤籃、野花",
    note: "收在遠景。三個人不要排成一直線。",
    draw: (h) => {
      const scene = cottageExt(h, { x: 760, base: 556, w: 400, smoke: true });
      const gr = person(h, { x: 380, y: 616, s: 240, face: 1, who: "granny", pose: "stand" });
      const hu = person(h, { x: 560, y: 636, s: 262, face: -1, who: "hunter", pose: "stand" });
      const g = redHood(h, { x: 470, y: 646, s: 190, face: -1, pose: "stand" });
      return F(scene, [...gr.out, ...hu.out, ...g.strokes], basket(h, { x: 660, y: 640, s: 70 }));
    },
  },
  {
    shot: "W", sec: 5, desc: "傍晚的小徑，空的。光線斜斜地穿過樹幹。",
    vo: "", sup: "劇終", props: "",
    note: "跟第 9 顆同一條路，這次沒有人。片尾停在這裡。",
    draw: (h) => {
      const scene = forest(h, { horizon: 424, gy: 552, path: PATH_MID, fore: "both", dense: 1.2 });
      scene.push(...h.hatch(300, 120, 700, 420, { gap: 30, size: LW.faint, press: 0.3, color: GREY, angle: -1.35 }));
      return F(scene, [], []);
    },
  },
];

export function buildCut(i) {
  return CUTS[i].draw(makeHand(9137 + i * 613));
}
