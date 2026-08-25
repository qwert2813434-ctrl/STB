// 造型零件庫。
//
// 三個原則（前兩版失敗換來的）：
// ① 角色＝解剖正確的連續剪影，不是幾何零件拼裝。
// ② 轉角（腿縫、下擺角、窗框）把控制點寫兩次＝尖點，不然全被曲線平滑成拱門。
// ③ 前景要能蓋住背景：先用白色 fillPoly 挖掉自己的形狀，再畫輪廓。
//
// 局部座標一律「腳底中心為原點、身高 100 單位、面向 +x」，遠景近景同一套線只換 s。

const T = (px, py, s, face) => (x, y) => [px + x * (s / 100) * face, py + y * (s / 100)];
const K = (p) => [p, p];                    // 尖點

// 特寫＝把角色放大到遠超出畫布，讓畫布本身當取景框。
// 位置一定要從「頭在局部座標的位置」反算，用猜的會整個人出框（第一版 5 顆特寫全空）。
export const HEAD = { red: [4, -86], wolf: [22, -94], wolfUp: [10, -92], person: [1, -92] };

// 線寬要跟著主體縮放：特寫把角色放大 10 倍，線還是 7px 就變成髮絲。
// 白色遮擋筆畫不動（它靠固定間距鋪滿，放大反而會溢出輪廓）。
function scaleInk(strokes, s, base) {
  const k = Math.min(3.2, Math.max(0.7, s / base));
  if (Math.abs(k - 1) < 0.02) return strokes;
  for (const st of strokes) {
    if (!st || st.color === "#ffffff") continue;
    st.size = Math.round((st.size ?? 1) * k * 100) / 100;
  }
  return strokes;
}

export function placeAt(local, target, s, face = 1) {
  return { x: target[0] - local[0] * (s / 100) * face, y: target[1] - local[1] * (s / 100) };
}
export function placeHead(kind, target, s, face = 1) {
  return placeAt(HEAD[kind], target, s, face);
}
export const LW = { hero: 0.55, body: 0.45, detail: 0.34, faint: 0.28, fore: 0.75 };
export function rectPts(x, y, w, h) {
  return [...K([x, y]), ...K([x + w, y]), ...K([x + w, y + h]), ...K([x, y + h])];
}

// ---------- 小紅帽 ----------
// pose: walk / stand / run / reach / crouch / back（背影）
// 疊畫順序就是這個角色能不能讀懂的關鍵：腿→斗篷→手→兜帽→臉。
// 臉是一顆比帽緣更前面的白色圓＝從兜帽裡「探出來」，第一版把臉畫在剪影內部，
// 整個人就變成一個紅鈴鐺。
export function redHood(hand, { x, y, s = 200, face = 1, pose = "walk", cloakColor = "#b3341c", mask = true }) {
  const p = T(x, y, s, face);
  const M = (a) => a.map(([ax, ay]) => p(ax, ay));
  const { sketchy, stroke, ring, fillPoly } = hand;
  const out = [];
  const lean = pose === "run" ? 5 : pose === "walk" ? 2 : 0;
  const A = ([ax, ay]) => [ax + (lean * -ay) / 100, ay];

  // ① 腿（先畫，等一下被下擺蓋掉上半段）
  const legs = pose === "run"
    ? [[[-6, -38], [-16, -25], [-26, -17]], [[7, -37], [17, -23], [23, -7]]]
    : pose === "walk"
      ? [[[-6, -38], [-10, -21], [-13, -4]], [[6, -37], [9, -20], [11, -4]]]
      : pose === "crouch"
        ? [[[-6, -36], [-14, -23], [-11, -5]], [[6, -36], [14, -22], [17, -5]]]
        : [[[-5, -38], [-6, -21], [-7, -4]], [[5, -38], [6, -21], [7, -4]]];
  for (const L of legs) {
    out.push(...sketchy(M(L), { size: LW.body, jitter: 0.8, passes: 1, spread: 0.7 }));
    const f = L[L.length - 1];
    out.push(stroke(M([...K([f[0] - 3, f[1] - 1]), ...K([f[0] + 4, f[1] - 1]), ...K([f[0] + 6, f[1] + 3]), ...K([f[0] - 4, f[1] + 3])]), { size: LW.body, closed: true, jitter: 0.5 }));
  }

  // ② 斗篷（不含兜帽，肩到膝的 A 字，別做成鐘）
  const cape = [
    [-2, -75], [-11, -72], [-14, -58], ...K([-16, -40]),
    [-6, -38], [4, -40], ...K([15, -41]), [12, -58], [10, -72], [2, -75],
  ].map(A);
  if (mask) out.push(...fillPoly(M(cape)));
  out.push(...sketchy(M(cape), { size: LW.hero, color: cloakColor, jitter: 1.1, closed: true, passes: 2, spread: 1.1 }));
  out.push(stroke(M([[-8, -68], [-12, -54], [-14, -42]].map(A)), { size: LW.detail, color: cloakColor, press: 0.6, jitter: 0.9 }));
  out.push(stroke(M([[1, -66], [0, -52], [-1, -41]].map(A)), { size: LW.faint, color: cloakColor, press: 0.5, jitter: 0.9 }));
  out.push(stroke(M([[8, -60], [9, -50], [10, -42]].map(A)), { size: LW.faint, color: cloakColor, press: 0.45, jitter: 0.8 }));

  // ③ 手臂
  const arm = pose === "reach" ? [[9, -70], [20, -74], [30, -76]]
    : pose === "run" ? [[9, -68], [18, -62], [21, -55]]
      : [[9, -68], [14, -60], [15, -52]];
  out.push(...sketchy(M(arm.map(A)), { size: LW.body, color: cloakColor, jitter: 0.8, passes: 1 }));
  const h = arm[arm.length - 1];
  out.push(stroke(M([...K([h[0] - 2, h[1]]), ...K([h[0] + 3, h[1] - 1]), ...K([h[0] + 4, h[1] + 4]), ...K([h[0] - 1, h[1] + 5])].map(A)), { size: LW.detail, closed: true, jitter: 0.4 }));

  // ④ 兜帽：包住後腦，前緣（x=15）留在臉的前面一點＝臉是「從開口裡看見」的
  const hood = [[-3, -74], [-11, -78], [-13, -88], [-8, -96], [2, -100], [11, -97], [15, -90], [15, -82], [8, -76]].map(A);
  if (mask) out.push(...fillPoly(M(hood)));
  out.push(...sketchy(M(hood), { size: LW.hero, color: cloakColor, jitter: 1, closed: true, passes: 2, spread: 1 }));

  // ⑤ 臉：白色挖空（比帽緣內縮 1.5 單位），只畫看得見的前下緣輪廓
  const fc = A([4, -86]);
  const F = (dx, dy) => [fc[0] + dx, fc[1] + dy];
  if (mask) out.push(...fillPoly(M([F(-8, -8), F(0, -10), F(8, -6), F(9, 3), F(2, 9), F(-7, 5)])));
  out.push(stroke(M([F(-3, -10), F(6, -8), F(9, -1), F(7, 5), F(0, 9)]), { size: LW.detail, jitter: 0.5 }));
  if (s >= 700) {
    // 特寫才畫五官：中遠景畫了只會變一團髒點
    out.push(stroke(M([F(1, -4), F(4, -5), F(6, -3)]), { size: LW.detail * 0.7, press: 1, jitter: 0.2 }));      // 上眼瞼
    out.push(stroke(M([F(2, -2), F(5, -2)]), { size: LW.detail * 0.5, press: 0.7, jitter: 0.2 }));              // 下眼瞼
    out.push(stroke(M([F(4, -4), F(4.6, -3)]), { size: LW.detail * 0.6, press: 1, jitter: 0.15 }));             // 瞳
    out.push(stroke(M([F(0, -7), F(4, -8), F(7, -6)]), { size: LW.faint, press: 0.6, jitter: 0.3 }));           // 眉
    out.push(stroke(M([F(7, -1), F(9, 1), F(7, 2)]), { size: LW.detail * 0.7, press: 0.7, jitter: 0.2 }));      // 鼻
    out.push(stroke(M([F(3, 4), F(6, 4), F(7, 3)]), { size: LW.detail * 0.8, press: 0.7, jitter: 0.2 }));       // 唇
    out.push(stroke(M([F(-4, -6), F(-2, -2), F(-3, 2)]), { size: LW.faint, press: 0.5, jitter: 0.5 }));         // 兜帽內的髮
    out.push(stroke(M([F(-1, -7), F(0, -3)]), { size: LW.faint, press: 0.4, jitter: 0.5 }));
  } else if (s >= 200) {
    out.push(stroke(M([F(2, -3), F(6, -3)]), { size: LW.detail, press: 0.9, jitter: 0.25 }));   // 眼
    out.push(stroke(M([F(2, 4), F(5, 3)]), { size: LW.faint, press: 0.55, jitter: 0.25 }));     // 嘴
  }
  // 帽緣壓在額頭上＝兜帽在前、臉在裡
  out.push(stroke(M([F(-9, -7), F(-2, -11), F(6, -9), F(10, -4)]), { size: LW.detail, color: cloakColor, press: 0.85, jitter: 0.5 }));

  return { strokes: scaleInk(out, s, 230), hand: p(A(h)[0], h[1] + 5), head: p(fc[0], fc[1]), foot: p(0, 0), scale: s / 100, face };
}

// ---------- 籃子 ----------
export function basket(hand, { x, y, s = 80, face = 1, mask = true }) {
  const u = s / 100;
  const P = (ax, ay) => [x + ax * u * face, y + ay * u];
  const { sketchy, stroke, fillPoly } = hand;
  const out = [];
  const body = [...K(P(-50, -30)), P(-44, 6), P(-32, 28), ...K(P(32, 28)), P(44, 6), ...K(P(50, -30))];
  if (mask) out.push(...fillPoly(body));
  out.push(stroke([P(-34, -30), P(-24, -66), P(2, -76), P(28, -62), P(34, -28)], { size: LW.body, jitter: 0.9 })); // 提把
  out.push(stroke([P(-28, -68), P(2, -78), P(24, -66)], { size: LW.faint, press: 0.5, jitter: 0.8 }));
  out.push(...sketchy(body, { size: LW.body, jitter: 0.9, passes: 2, spread: 1 }));
  out.push(stroke([P(-50, -30), P(-16, -22), P(18, -22), P(50, -30)], { size: LW.body, jitter: 0.8 }));            // 籃口
  out.push(stroke([P(-45, -4), P(0, 2), P(45, -4)], { size: LW.faint, press: 0.5, jitter: 0.7 }));                 // 藤編
  out.push(stroke([P(-38, 14), P(0, 20), P(38, 14)], { size: LW.faint, press: 0.45, jitter: 0.7 }));
  out.push(...sketchy([P(-38, -26), P(-26, -42), P(-2, -46), P(20, -40), P(36, -26)], { size: LW.detail, jitter: 0.9, passes: 1 })); // 蓋布
  return scaleInk(out, s, 90);
}

// ---------- 狼 ----------
// pose: stalk / trot / leap / sit / stand（後腿站立）/ lie（躺床）
export function wolf(hand, { x, y, s = 220, face = 1, pose = "stalk", bonnet = false, snarl = false, mask = true }) {
  const p = T(x, y, s, face);
  const M = (a) => a.map(([ax, ay]) => p(ax, ay));
  const { sketchy, stroke, fillPoly } = hand;
  const out = [];
  let headAt, earAt;

  if (pose === "stand" || pose === "lie") {
    // 擬人：後腿站立／躺床。肩窄腰粗、前爪當手
    const body = [
      [4, -96], [-8, -92], [-13, -82], [-14, -72],
      [-18, -56], [-19, -38], [-17, -20], ...K([-16, -4]),
      ...K([-6, -4]), [-4, -20], [-1, -34], [2, -20], ...K([4, -4]),
      ...K([14, -4]), [15, -20], [17, -38], [18, -56],
      [16, -70], [14, -80], [16, -88],
    ];
    if (mask) out.push(...fillPoly(M(body)));
    out.push(...sketchy(M(body), { size: LW.hero, jitter: 1.1, closed: true, passes: 2, spread: 1.2 }));
    // 頭：吻部往前凸（狼扮外婆最好認的地方）
    const head = [[16, -88], [12, -98], [4, -104], [-6, -102], [-11, -94], [-10, -86], [-2, -82], [8, -82],
      [20, -84], [30, -86], [34, -90], [28, -93], [17, -93]];
    if (mask) out.push(...fillPoly(M(head)));
    out.push(...sketchy(M(head), { size: LW.hero, jitter: 1, closed: true, passes: 2, spread: 1.1 }));
    out.push(stroke(M([[30, -88], [33, -89]]), { size: LW.body, press: 1, jitter: 0.3 }));   // 鼻頭
    out.push(stroke(M([[14, -94], [19, -95]]), { size: LW.detail, press: 1, jitter: 0.3 }));  // 眼
    if (snarl) {
      // 張口＋犬齒（第 55 顆的「妳的牙齒好大」就靠這個）
      const jaw = [[16, -84], [24, -78], [33, -76], [30, -82], [20, -85]];
      out.push(...fillPoly(M(jaw)));
      out.push(...sketchy(M(jaw), { size: LW.body, jitter: 0.9, closed: true, passes: 2 }));
      for (const [tx, ty] of [[20, -85], [25, -84], [30, -83]]) out.push(stroke(M([[tx - 2, ty], [tx, ty + 5], [tx + 2, ty - 0.5]]), { size: LW.detail, press: 0.9, jitter: 0.2 }));
      for (const [tx, ty] of [[22, -79], [27, -78]]) out.push(stroke(M([[tx - 1.6, ty], [tx, ty - 4], [tx + 1.6, ty + 0.4]]), { size: LW.detail, press: 0.8, jitter: 0.2 }));
      out.push(stroke(M([[17, -83], [22, -81]]), { size: LW.faint, press: 0.6, jitter: 0.4 }));  // 口角
    } else {
      out.push(stroke(M([[22, -85], [30, -86]]), { size: LW.detail, press: 0.6, jitter: 0.4 })); // 嘴縫
    }
    // 前爪
    out.push(...sketchy(M([[15, -72], [26, -66], [31, -58]]), { size: LW.body, jitter: 0.9, passes: 1 }));
    out.push(...sketchy(M([[-15, -70], [-24, -62], [-27, -54]]), { size: LW.body, press: 0.8, jitter: 0.9, passes: 1 }));
    headAt = [4, -94];
    earAt = [[[-7, -100], [-12, -113], [1, -103]], [[2, -103], [6, -115], [11, -100]]];
  } else if (pose === "sit") {
    // 坐姿：前腿直立、後腿摺在身側、臀著地
    const body = [
      [48, -88], [41, -93], [34, -96], [28, -100], [19, -96], [11, -90],
      [0, -79], [-11, -62], [-21, -43], [-26, -25], ...K([-28, -5]),
      ...K([-11, -5]), [-8, -18], [-5, -33], [0, -43], [8, -48],
      [10, -33], ...K([10, -4]), ...K([17, -4]), [17, -33],
      [20, -49], [22, -65], [25, -81], [31, -88], [39, -89],
    ];
    if (mask) out.push(...fillPoly(M(body)));
    out.push(...sketchy(M(body), { size: LW.hero, jitter: 1.1, closed: true, passes: 2, spread: 1.2 }));
    const tail = [[-25, -38], [-38, -41], [-47, -31], [-43, -18], [-35, -21], [-33, -31], [-26, -34]];
    if (mask) out.push(...fillPoly(M(tail)));
    out.push(...sketchy(M(tail), { size: LW.body, jitter: 1.2, closed: true, passes: 2 }));
    out.push(stroke(M([[36, -92], [40, -91]]), { size: LW.detail, press: 1, jitter: 0.3 }));
    out.push(stroke(M([[39, -88], [46, -88]]), { size: LW.detail, press: 0.6, jitter: 0.4 }));
    out.push(stroke(M([[45, -90], [48, -89]]), { size: LW.body, press: 1, jitter: 0.3 }));
    headAt = [32, -93]; earAt = [[[24, -99], [20, -111], [31, -102]], [[31, -101], [35, -113], [41, -99]]];
  } else {
    // 四足：鼻尖→吻上→額→頸背→肩→背→臀→後腿→腹→前腿→胸→喉→下顎→回鼻尖
    // 狼不是鹿：頸要短、胸要深（背 -95／腹 -57）、腿只佔一半、吻短而方。
    // 比例是狼與鹿的差別：胸要深（背 -95／腹 -50＝深度 45）、腿只到 -48、
    // 頭要低要近（鼻尖 x=52 不是 66），吻短而鈍。
    const drop = pose === "stalk" ? 9 : 0;   // 潛行＝頭壓到與背同高
    const hind = pose === "leap"
      ? [[-38, -70], [-50, -58], [-60, -44], ...K([-66, -34]), ...K([-57, -29]), [-48, -40], [-36, -48], [-24, -52]]
      : [[-42, -70], [-43, -52], [-35, -40], [-36, -20], ...K([-35, -3]), ...K([-26, -3]), [-27, -20], [-24, -40], [-21, -54]];
    const fore = pose === "leap"
      ? [[14, -52], [26, -44], ...K([36, -38]), ...K([40, -46]), [30, -52], [24, -58]]
      : [[12, -38], ...K([12, -3]), ...K([21, -3]), [21, -38], [23, -50]];
    const body = [
      [34, -86 + drop], [29, -91 + drop], [24, -95 + drop], [18, -101 + drop], [13, -98 + drop], [10, -95],
      [-6, -93], [-20, -91], [-32, -88],
      ...hind, [-16, -60], [-2, -56], [10, -52], ...fore,
      [24, -64], [25, -77 + drop * 0.5], [26, -86 + drop], [30, -85 + drop],
    ];
    if (mask) out.push(...fillPoly(M(body)));
    out.push(...sketchy(M(body), { size: LW.hero, jitter: 1.2, closed: true, passes: 2, spread: 1.3 }));
    // 遠側兩條腿：淡一階＝有前後
    out.push(...sketchy(M([[-18, -50], [-17, -28], [-15, -4]]), { size: LW.body, press: 0.6, jitter: 0.9, passes: 1 }));
    out.push(...sketchy(M([[3, -50], [2, -28], [3, -4]]), { size: LW.body, press: 0.6, jitter: 0.9, passes: 1 }));
    // 尾：有體積但別做成香蕉——貼著臀往後下垂
    const tail = pose === "leap" || pose === "trot"
      ? [[-32, -82], [-44, -86], [-54, -82], [-58, -72], [-51, -70], [-43, -76], [-33, -78]]
      : [[-32, -82], [-44, -80], [-52, -70], [-53, -58], [-46, -59], [-43, -70], [-33, -76]];
    if (mask) out.push(...fillPoly(M(tail)));
    out.push(...sketchy(M(tail), { size: LW.body, jitter: 1.3, closed: true, passes: 2, spread: 1.2 }));
    // 背毛
    for (const [bx, by] of [[-8, -93], [2, -94], [10, -94]]) out.push(stroke(M([[bx, by], [bx - 2, by - 6]]), { size: LW.faint, press: 0.6, jitter: 0.6 }));
    headAt = [22, -94 + drop];
    earAt = [[[15, -101 + drop], [11, -113 + drop], [21, -104 + drop]], [[21, -103 + drop], [25, -114 + drop], [30, -100 + drop]]];
    out.push(stroke(M([[25, -93 + drop], [29, -92 + drop]]), { size: LW.detail, press: 1, jitter: 0.3 }));   // 眼
    out.push(stroke(M([[29, -88 + drop], [33, -87 + drop]]), { size: LW.detail, press: 0.6, jitter: 0.4 })); // 嘴縫
    out.push(stroke(M([[32, -88 + drop], [34, -87 + drop]]), { size: LW.body, press: 1, jitter: 0.3 }));     // 鼻
  }

  if (Array.isArray(earAt?.[0]?.[0])) for (const e of earAt) out.push(stroke(M(e), { size: LW.body, jitter: 0.8 }));

  if (bonnet) {
    // 睡帽：尖錐往後垂＋帽緣＋毛球（不是棒球帽——第一版畫成鴨舌了）
    const [hx, hy] = headAt;
    const cap = [[hx + 15, hy - 2], [hx + 12, hy - 14], [hx + 2, hy - 22], [hx - 10, hy - 24], [hx - 22, hy - 30], [hx - 30, hy - 34], [hx - 26, hy - 26], [hx - 16, hy - 16], [hx - 16, hy - 4]];
    out.push(...fillPoly(M([...cap, [hx - 16, hy + 2], [hx + 15, hy + 3]])));
    out.push(...sketchy(M(cap), { size: LW.body, jitter: 1, passes: 2, spread: 1 }));
    out.push(stroke(M([[hx - 17, hy - 2], [hx - 2, hy - 7], [hx + 16, hy - 2]]), { size: LW.detail, jitter: 0.7 }));  // 帽緣
    out.push(...sketchy(M([[hx - 30, hy - 34], [hx - 36, hy - 39], [hx - 33, hy - 45], [hx - 26, hy - 43], [hx - 27, hy - 36]]), { size: LW.detail, closed: true, jitter: 0.8, passes: 1 })); // 毛球
  }
  return { out: scaleInk(out, s, 240), head: p(headAt[0], headAt[1]), scale: s / 100, face };
}

// ---------- 人（外婆／獵人） ----------
export function person(hand, { x, y, s = 200, face = 1, who = "granny", pose = "stand", mask = true }) {
  const p = T(x, y, s, face);
  const M = (a) => a.map(([ax, ay]) => p(ax, ay));
  const { sketchy, stroke, ring, fillPoly } = hand;
  const out = [];
  const stout = who === "hunter" ? 1.2 : 1;
  const hunch = who === "granny" ? 4 : 0;   // 外婆駝背

  // 軀幹（肩→背→擺→前→胸→頸），頸口內收＝有脖子
  const torso = [
    [-5, -76 + hunch], [-13, -73 + hunch], [-16, -58], [-15 * stout, -42], ...K([-18 * stout, -22]),
    ...K([0, -20]), ...K([17 * stout, -22]), [14 * stout, -42], [13, -58], [11, -73 + hunch], [4, -76 + hunch],
  ];
  if (mask) out.push(...fillPoly(M(torso)));
  out.push(...sketchy(M(torso), { size: LW.hero, jitter: 1.1, closed: true, passes: 2, spread: 1.2 }));
  out.push(stroke(M([[-5, -76 + hunch], [-4, -82 + hunch]]), { size: LW.detail, jitter: 0.5 }));  // 頸
  out.push(stroke(M([[4, -76 + hunch], [4, -82 + hunch]]), { size: LW.detail, jitter: 0.5 }));

  // 頭
  const hy = -92 + hunch;
  if (mask) out.push(...fillPoly(M([[-10, hy - 10], [0, hy - 12], [10, hy - 8], [11, hy + 4], [2, hy + 11], [-8, hy + 6]])));
  out.push(ring(...p(1, hy), 11 * (s / 100), 12 * (s / 100), { size: LW.body, jitter: 0.9 }));
  out.push(stroke(M([[5, hy - 1], [9, hy - 1]]), { size: LW.detail, press: 0.9, jitter: 0.3 }));   // 眼
  out.push(stroke(M([[6, hy + 6], [10, hy + 5]]), { size: LW.faint, press: 0.6, jitter: 0.3 }));   // 嘴
  if (who === "hunter") {
    out.push(...fillPoly(M([[-13, hy - 4], [-9, hy - 16], [3, hy - 20], [13, hy - 15], [15, hy - 3]])));
    out.push(...sketchy(M([[-13, hy - 4], [-9, hy - 16], [3, hy - 20], [13, hy - 15], [15, hy - 3]]), { size: LW.body, jitter: 0.9, passes: 1 }));
    out.push(stroke(M([[-16, hy - 3], [0, hy - 6], [20, hy - 2]]), { size: LW.body, jitter: 0.8 })); // 帽簷
    out.push(stroke(M([[-16, -58], [-22, -40], [-20, -26]]), { size: LW.detail, press: 0.6, jitter: 1 })); // 背帶
  } else {
    out.push(stroke(M([[-9, hy - 6], [-15, hy - 12], [-9, hy - 17], [-3, hy - 12]]), { size: LW.body, jitter: 0.9 })); // 髮髻
    out.push(...sketchy(M([[-11, hy + 2], [-8, hy - 9], [2, hy - 13], [11, hy - 7]]), { size: LW.detail, press: 0.7, passes: 1 }));
    out.push(stroke(M([[-14, -50], [0, -46], [13, -50]]), { size: LW.faint, press: 0.5, jitter: 0.9 }));   // 圍裙口
    out.push(...sketchy(M([[-10, -46], [-11, -24], [10, -24], [9, -46]]), { size: LW.faint, press: 0.5, passes: 1 }));
  }
  // 腿
  for (const L of [[[-7, -22], [-8, -12], [-9, -3]], [[7, -22], [8, -12], [9, -3]]]) {
    out.push(...sketchy(M(L), { size: LW.body, jitter: 0.8, passes: 1 }));
    const f = L[L.length - 1];
    out.push(stroke(M([...K([f[0] - 3, f[1] - 1]), ...K([f[0] + 4, f[1] - 1]), ...K([f[0] + 6, f[1] + 3]), ...K([f[0] - 4, f[1] + 3])]), { size: LW.body, closed: true, jitter: 0.5 }));
  }
  // 手臂（畫在軀幹外側才看得見）
  const arm = pose === "reach" ? [[12, -70 + hunch], [26, -72], [37, -68]]
    : pose === "raise" ? [[12, -70 + hunch], [23, -84], [27, -98]]
      : [[12, -70 + hunch], [19, -54], [20, -38]];
  out.push(...sketchy(M(arm), { size: LW.body, jitter: 0.9, passes: 1 }));
  out.push(...sketchy(M([[-12, -70 + hunch], [-19, -54], [-20, -38]]), { size: LW.body, press: 0.7, jitter: 0.9, passes: 1 }));
  return { out: scaleInk(out, s, 240), hand: p(arm[arm.length - 1][0], arm[arm.length - 1][1]), head: p(1, hy), scale: s / 100 };
}

// ---------- 樹 ----------
export function tree(hand, { x, base, h = 300, w = null, kind = "fir", weight = 1, seedShift = 0, mask = false }) {
  const { sketchy, stroke, fillPoly, R, n } = hand;
  const out = [];
  const width = w ?? h * 0.42;
  const u = h / 100;
  const P = (lx, ly) => [x + lx * (width / 100), base + ly * u];

  if (kind === "trunk") {
    const lx = -34, rx = 34;
    const col = [P(lx + 5, 0), P(lx - 4, -34), P(lx + 3, -68), P(lx - 5, -100), P(rx + 7, -100), P(rx - 1, -66), P(rx + 6, -32), P(rx - 4, 0)];
    if (mask) out.push(...fillPoly(col));
    out.push(...sketchy([P(lx + 5, 0), P(lx - 4, -34), P(lx + 3, -68), P(lx - 5, -100)], { size: LW.fore * weight, jitter: 2, passes: 2, spread: 1.8 }));
    out.push(...sketchy([P(rx - 4, 0), P(rx + 6, -32), P(rx - 1, -66), P(rx + 7, -100)], { size: LW.fore * weight, jitter: 2, passes: 2, spread: 1.8 }));
    for (let i = 0; i < 11; i++) {
      const yy = -5 - i * 9.2;
      out.push(stroke([P(lx + 9, yy), P(lx + 9 + 62 * R(0.16, 0.6), yy - R(2, 10))], { size: LW.detail, press: 0.45, jitter: 1.4, tail: 4 }));
    }
    out.push(stroke([P(lx + 4, -5), P(lx - 24, 5)], { size: LW.body * weight, jitter: 1.6 }));
    out.push(stroke([P(rx - 2, -7), P(rx + 26, 4)], { size: LW.body * weight, jitter: 1.6 }));
  } else if (kind === "bare") {
    out.push(...sketchy([P(-7, 0), P(-2, -46), P(4, -100)], { size: LW.body * 1.35 * weight, jitter: 1.8, passes: 2 }));
    for (const [t, dir, len] of [[40, -1, 48], [54, 1, 42], [68, -1, 36], [80, 1, 30], [90, -1, 22]]) {
      const yy = -t;
      out.push(stroke([P(0, yy), P(dir * len * 0.5, yy - len * 0.3), P(dir * len, yy - len * 0.54)], { size: LW.body * weight, jitter: 1.5, tail: 3 }));
      out.push(stroke([P(dir * len * 0.55, yy - len * 0.32), P(dir * len * 0.82, yy - len * 0.78)], { size: LW.detail, press: 0.6, jitter: 1.3, tail: 3 }));
      out.push(stroke([P(dir * len * 0.78, yy - len * 0.45), P(dir * len * 1.28, yy - len * 0.54)], { size: LW.faint, press: 0.5, jitter: 1.2, tail: 3 }));
    }
  } else if (kind === "oak") {
    // 闊葉：樹冠一圈不規則「雲」，比畫葉子省事又像
    const lumps = [];
    const nb = 15;
    for (let i = 0; i <= nb; i++) {
      const a = Math.PI * (1.04 + (i / nb) * 0.92);
      const rr = 1 + Math.sin(i * 2.1 + seedShift * 0.03) * 0.11;   // 平滑葉團，噪音會長出刺
      lumps.push(P(Math.cos(a) * 62 * rr, -64 + Math.sin(a) * 40 * rr));
    }
    const canopy = [...lumps, P(28, -30), P(-28, -30)];
    if (mask) out.push(...fillPoly(canopy));
    out.push(...sketchy([P(-11, 0), P(-7, -20), P(-10, -40)], { size: LW.body * 1.35 * weight, jitter: 1.4, passes: 2 }));
    out.push(...sketchy([P(11, 0), P(8, -20), P(11, -40)], { size: LW.body * 1.35 * weight, jitter: 1.4, passes: 2 }));
    out.push(stroke([P(-9, -34), P(-26, -48), P(-38, -58)], { size: LW.body * weight, jitter: 1.3 }));
    out.push(stroke([P(10, -36), P(28, -50), P(40, -60)], { size: LW.body * weight, jitter: 1.3 }));
    out.push(...sketchy(lumps, { size: LW.body * weight, jitter: 2.4, passes: 2, spread: 2 }));
    for (let i = 0; i < 6; i++) {
      const cx = R(-44, 44), cy = R(-90, -50);
      out.push(stroke([P(cx - 13, cy), P(cx - 4, cy - 8), P(cx + 7, cy - 2), P(cx + 15, cy - 9)], { size: LW.faint, press: 0.5, jitter: 1.8 }));
    }
  } else {
    // 針葉：一條剪影從樹尖沿左側階梯往下、過樹幹、再沿右側回樹尖
    const tiers = 5;
    const sil = [P(0, -100)];
    for (let i = 1; i <= tiers; i++) {
      const t = i / tiers, wv = 12 + 44 * Math.pow(t, 1.25), yy = -100 + 88 * t;
      sil.push(P(-wv, yy - 5), P(-wv * 0.42, yy + 1));
    }
    sil.push(...K(P(-7, -10)), ...K(P(-6, 0)), ...K(P(6, 0)), ...K(P(7, -10)));
    for (let i = tiers; i >= 1; i--) {
      const t = i / tiers, wv = 12 + 44 * Math.pow(t, 1.25), yy = -100 + 88 * t;
      sil.push(P(wv * 0.42, yy + 1), P(wv, yy - 5));
    }
    if (mask) out.push(...fillPoly(sil));
    out.push(...sketchy(sil, { size: (weight < 0.7 ? LW.detail : LW.body) * (weight > 1 ? 1.3 : 1), jitter: 1.7, closed: true, passes: weight < 0.7 ? 1 : 2, spread: 1.5 }));
    if (weight >= 0.7) for (let i = 1; i <= 3; i++) {
      const yy = -84 + i * 20;
      out.push(stroke([P(-6, yy), P(0, yy + 5), P(6, yy)], { size: LW.faint, press: 0.5, jitter: 1.2 }));
    }
  }
  return out;
}

// ---------- 小屋 ----------
export function cottage(hand, { x, base, w = 340, face = 1, open = false, smoke = true, mask = true, lit = false }) {
  const { sketchy, stroke, hatch, fillPoly, R } = hand;
  const out = [];
  const h = w * 0.52, rf = w * 0.4, eave = w * 0.09;
  const L = x - w / 2, Rt = x + w / 2, T0 = base - h;
  if (mask) out.push(...fillPoly([[L - eave, T0 + 6], [x, T0 - rf], [Rt + eave, T0 + 6], ...K([Rt, T0 + 6]), ...K([Rt, base]), ...K([L, base]), ...K([L, T0 + 6])]));
  out.push(...sketchy(rectPts(L, T0, w, h), { size: LW.hero, jitter: 1.2, closed: true, passes: 2, spread: 1.2 }));
  out.push(...sketchy([[L - eave, T0 + 6], [x, T0 - rf], [Rt + eave, T0 + 6]], { size: LW.hero, jitter: 1.3, passes: 2 }));
  out.push(stroke([[L - eave, T0 + 6], [x, T0 + 2], [Rt + eave, T0 + 6]], { size: LW.body, jitter: 1 }));
  for (let i = 1; i <= 3; i++) {                                     // 屋瓦線（跟著屋頂斜度收）
    const k = i / 4;
    out.push(stroke([[L - eave + (x - L + eave) * k, T0 + 6 - (rf + 6) * k], [x, T0 + 2 - (rf + 2) * k]], { size: LW.faint, press: 0.45, jitter: 1 }));
    out.push(stroke([[Rt + eave - (Rt + eave - x) * k, T0 + 6 - (rf + 6) * k], [x, T0 + 2 - (rf + 2) * k]], { size: LW.faint, press: 0.45, jitter: 1 }));
  }
  const dw = w * 0.19, dx = x + w * 0.2 * face, dh = h * 0.6;
  const ww = w * 0.2, wx = x - w * 0.22 * face, wy = base - h * 0.72, wh = ww * 0.86;
  for (let i = 1; i < 6; i++) {
    const yy = base - (h * i) / 6;
    const segs = [[L + 3, Math.min(wx - ww / 2, dx - dw / 2) - 6], [Math.max(wx + ww / 2, dx + dw / 2) + 6, Rt - 3]];
    for (const [a, b] of segs) if (b - a > 20) out.push(stroke([[a, yy], [(a + b) / 2, yy + R(-2, 2)], [b, yy]], { size: LW.faint, press: 0.4, jitter: 1 }));
  }
  // 門
  out.push(...sketchy(rectPts(dx - dw / 2, base - dh, dw, dh), { size: LW.body, jitter: 0.9, closed: true, passes: 1 }));
  if (open) {
    out.push(...hatch(dx - dw / 2 + 3, base - dh + 3, dw - 6, dh - 6, { gap: 7, size: LW.faint, press: 0.5 }));
    out.push(...sketchy([[dx + dw / 2, base - dh], [dx + dw * 1.25, base - dh * 1.06], [dx + dw * 1.2, base + 2], [dx + dw / 2, base]], { size: LW.body, jitter: 0.9, passes: 1 }));
  } else {
    out.push(stroke([[dx + dw * 0.28, base - dh * 0.5], [dx + dw * 0.35, base - dh * 0.48]], { size: LW.body, press: 0.9, jitter: 0.3 }));
    out.push(...sketchy(rectPts(dx - dw * 0.3, base - dh * 0.88, dw * 0.6, dh * 0.3), { size: LW.faint, press: 0.5, closed: true, passes: 1 }));
  }
  // 窗
  out.push(...sketchy(rectPts(wx - ww / 2, wy, ww, wh), { size: LW.body, jitter: 0.9, closed: true, passes: 1 }));
  out.push(stroke([[wx, wy - 1], [wx, wy + wh + 1]], { size: LW.detail, jitter: 0.6 }));
  out.push(stroke([[wx - ww / 2, wy + wh / 2], [wx + ww / 2, wy + wh / 2]], { size: LW.detail, jitter: 0.6 }));
  out.push(stroke([[wx - ww * 0.62, wy + wh + 3], [wx + ww * 0.62, wy + wh + 3]], { size: LW.body, jitter: 0.7 }));
  if (lit) out.push(...hatch(wx - ww / 2 + 3, wy + 3, ww - 6, wh - 6, { gap: 6, size: LW.faint, press: 0.5, angle: -1.2 }));
  // 煙囪＋炊煙
  const cx = x - w * 0.26;
  out.push(...sketchy(rectPts(cx, T0 - rf * 0.72, w * 0.085, rf * 0.72 + h * 0.1), { size: LW.body, jitter: 0.9, passes: 1 }));
  if (smoke) out.push(stroke([[cx + w * 0.04, T0 - rf * 0.86], [cx - w * 0.03, T0 - rf * 1.2], [cx + w * 0.05, T0 - rf * 1.5], [cx - w * 0.02, T0 - rf * 1.82]], { size: LW.detail, press: 0.5, jitter: 2, tail: 6 }));
  return out;
}

// ---------- 床 ----------
export function bed(hand, { x, base, w = 560, face = 1, mask = true }) {
  const { sketchy, stroke, fillPoly } = hand;
  const out = [];
  const h = w * 0.4, L = x - w / 2, R2 = x + w / 2;
  const hb = face > 0 ? L : R2, ft = face > 0 ? R2 : L, dir = face > 0 ? 1 : -1;
  if (mask) out.push(...fillPoly([[hb - 6 * dir, base - h * 1.1], [hb + 46 * dir, base - h * 1.12], [hb + 40 * dir, base - h * 0.58],
    [x, base - h * 0.74], [ft, base - h * 0.68], ...K([ft + 6 * dir, base]), ...K([hb - 6 * dir, base])]));
  out.push(...sketchy([[hb - 6 * dir, base - h * 0.34], [hb - 6 * dir, base - h * 1.08], [hb + 46 * dir, base - h * 1.12], [hb + 46 * dir, base - h * 0.4]], { size: LW.hero, jitter: 1.1, passes: 2 }));
  out.push(...sketchy([[hb, base - h * 0.34], [x, base - h * 0.28], [ft + 6 * dir, base - h * 0.36]], { size: LW.hero, jitter: 1.2, passes: 2 }));
  out.push(...sketchy([[ft, base - h * 0.36], [ft, base - h * 0.9], [ft + 30 * -dir, base - h * 0.92], [ft + 30 * -dir, base - h * 0.42]], { size: LW.body, jitter: 1, passes: 1 }));
  out.push(stroke([[hb - 4 * dir, base - h * 0.34], [hb - 3 * dir, base]], { size: LW.body, jitter: 0.8 }));
  out.push(stroke([[ft + 2 * dir, base - h * 0.36], [ft + 3 * dir, base]], { size: LW.body, jitter: 0.8 }));
  // 棉被
  out.push(...sketchy([[hb + 40 * dir, base - h * 0.6], [x - 60 * dir, base - h * 0.78], [x + 70 * dir, base - h * 0.62], [ft, base - h * 0.68]], { size: LW.hero, jitter: 1.5, passes: 2, spread: 1.6 }));
  for (let i = 0; i < 5; i++) {
    const xx = hb + dir * (80 + (i * (w - 160)) / 5);
    out.push(stroke([[xx, base - h * 0.64], [xx + 14 * dir, base - h * 0.52], [xx + 5 * dir, base - h * 0.4]], { size: LW.faint, press: 0.5, jitter: 1.1 }));
  }
  // 枕頭
  out.push(...sketchy([[hb + 14 * dir, base - h * 0.7], [hb + 30 * dir, base - h * 0.98], [hb + 96 * dir, base - h * 1], [hb + 112 * dir, base - h * 0.72]], { size: LW.body, jitter: 1.1, passes: 1 }));
  return out;
}

// ---------- 地面／小徑／草／石／花 ----------
export function ground(hand, { y, from = 0, to = 1280, weight = 1 }) {
  const { sketchy } = hand;
  return sketchy([[from, y], [(from + to) * 0.35, y - 5], [(from + to) * 0.7, y + 3], [to, y - 2]], { size: LW.body * weight, jitter: 2.2, passes: 2, spread: 2.4 });
}

export function pathway(hand, { yNear, yFar, xNear = 640, xFar = 640, wNear = 520, wFar = 40 }) {
  const { sketchy, stroke, R } = hand;
  const out = [];
  const mid = (yNear + yFar) / 2;
  out.push(...sketchy([[xNear - wNear / 2, yNear], [xNear - wNear * 0.3, mid + 24], [xFar - wFar / 2, yFar]], { size: LW.body, jitter: 2, passes: 2, spread: 2 }));
  out.push(...sketchy([[xNear + wNear / 2, yNear], [xNear + wNear * 0.32, mid + 20], [xFar + wFar / 2, yFar]], { size: LW.body, jitter: 2, passes: 2, spread: 2 }));
  for (let i = 0; i < 14; i++) {
    const t = R(0.05, 0.95), yy = yFar + (yNear - yFar) * t;
    const hw = (wFar + (wNear - wFar) * t) / 2;
    const cx = xFar + (xNear - xFar) * t + R(-hw * 0.6, hw * 0.6);
    out.push(stroke([[cx, yy], [cx + R(8, 26) * (1 - 0.5 * (1 - t)), yy + R(-3, 3)]], { size: LW.faint, press: 0.4, jitter: 1 }));
  }
  return out;
}

export function tufts(hand, { y, from, to, n = 12, size = 1, slope = 0 }) {
  const { stroke, R } = hand;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n, x = from + (to - from) * t + R(-12, 12), yy = y + slope * t, hgt = R(9, 22) * size;
    for (let k = -1; k <= 1; k++) out.push(stroke([[x + k * 4 * size, yy + R(-2, 2)], [x + k * 8 * size, yy - hgt * R(0.62, 1)]], { size: LW.faint, press: 0.55, jitter: 0.9, tail: 3 }));
  }
  return out;
}

export function rocks(hand, { y, from, to, n = 4, size = 1 }) {
  const { sketchy, R } = hand;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = from + ((to - from) * i) / n + R(-20, 20), w = R(18, 40) * size, h = w * R(0.4, 0.62);
    out.push(...sketchy([[x - w / 2, y], [x - w * 0.34, y - h], [x + w * 0.2, y - h * 1.1], [x + w / 2, y - h * 0.3], [x + w * 0.4, y]], { size: LW.detail, jitter: 1.2, passes: 1 }));
  }
  return out;
}

export function flowers(hand, { y, from, to, n = 6, size = 1, color = null }) {
  const { stroke, ring, R } = hand;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = from + ((to - from) * i) / n + R(-14, 14), hgt = R(16, 30) * size;
    out.push(stroke([[x, y], [x + R(-4, 4), y - hgt * 0.6], [x + R(-6, 6), y - hgt]], { size: LW.faint, press: 0.5, jitter: 0.8 }));
    out.push(ring(x + R(-5, 5), y - hgt - 3 * size, 4 * size, 4 * size, { size: LW.detail, color, press: 0.7, jitter: 0.7 }));
  }
  return out;
}
