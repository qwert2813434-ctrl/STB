// 場景組（背景層專用）。每個 set 回傳背景筆畫陣列；角色與道具由 story.mjs 疊上去。
// 遠中近三層的線寬差是唯一的空氣透視手段：遠 0.28／中 0.45／近 0.75。
import { GREY, W, H } from "./draw.mjs";
import { tree, cottage, bed, ground, pathway, tufts, rocks, flowers, LW, rectPts } from "./parts.mjs";

// 森林：horizon＝遠景樹底線，gy＝角色站的地面
export function forest(hand, o = {}) {
  const { horizon = 430, gy = 560, path = null, fore = "both", mist = true, dense = 1, bare = 0 } = o;
  const { hatch, sketchy, R } = hand;
  const out = [];
  const far = Math.round(11 * dense);
  for (let i = 0; i < far; i++) {
    out.push(...tree(hand, { x: 40 + (i * 1240) / far + (i % 3) * 16, base: horizon + 2, h: 82 + (i % 4) * 24, kind: "fir", weight: 0.42 }));
  }
  const mids = [[150, 320, "fir"], [318, 250, "fir"], [452, 210, "oak"], [880, 268, "fir"], [1046, 226, "oak"], [1196, 320, "fir"]];
  for (const [x, h, k] of mids) if (R(0, 1) < 0.85 * dense) out.push(...tree(hand, { x, base: gy - 40, h, kind: k, weight: 0.85, seedShift: x, mask: true }));
  for (let i = 0; i < bare; i++) out.push(...tree(hand, { x: 520 + i * 190, base: gy - 60, h: 200, kind: "bare", weight: 0.65 }));
  if (path) out.push(...pathway(hand, path));
  out.push(...ground(hand, { y: horizon + 4, from: 0, to: W, weight: 0.55 }));
  out.push(...ground(hand, { y: gy, from: 0, to: W, weight: 0.85 }));
  out.push(...tufts(hand, { y: gy + 12, from: 20, to: 460, n: 8, size: 1.3 }));
  out.push(...tufts(hand, { y: gy + 24, from: 860, to: 1266, n: 8, size: 1.5 }));
  if (mist) out.push(...hatch(0, horizon + 10, W, gy - horizon - 30, { gap: 26, size: LW.faint, press: 0.32, color: GREY, angle: -1.15 }));
  if (fore === "both" || fore === "left") out.push(...tree(hand, { x: 62, base: H + 10, h: 800, w: 190, kind: "trunk", weight: 1.05, mask: true }));
  if (fore === "both" || fore === "right") out.push(...tree(hand, { x: 1230, base: H + 10, h: 760, w: 160, kind: "trunk", weight: 0.95, mask: true }));
  return out;
}

// 樹冠仰角：主體是天空。四個角各長一棵樹的樹幹往中心收（仰角透視），
// 葉團沿著枝條長、天空留在正中央＝光從那裡下來。
export function canopy(hand) {
  const { sketchy, stroke, hatch, fillPoly, R } = hand;
  const out = [];
  const cx = 660, cy = 300;
  const corners = [[-60, 800], [1340, 820], [-80, -60], [1360, -40], [420, 860], [980, 880]];
  for (const [bx, by] of corners) {
    const t = 0.62 + R(-0.08, 0.08);
    const ex = bx + (cx - bx) * t, ey = by + (cy - by) * t;
    out.push(...sketchy([[bx, by], [bx + (ex - bx) * 0.5 + R(-50, 50), by + (ey - by) * 0.5 + R(-50, 50)], [ex, ey]], { size: LW.body * R(1.1, 1.8), jitter: 2.4, passes: 2, spread: 2.4 }));
    // 分枝
    for (let k = 0; k < 4; k++) {
      const t2 = R(0.35, 0.92);
      const px = bx + (ex - bx) * t2, py = by + (ey - by) * t2;
      const ang = Math.atan2(ey - by, ex - bx) + R(-1.1, 1.1);
      const len = R(120, 260);
      const qx = px + Math.cos(ang) * len, qy = py + Math.sin(ang) * len;
      out.push(...sketchy([[px, py], [qx, qy]], { size: LW.detail * R(0.9, 1.6), jitter: 2, passes: 1, tail: 6 }));
      // 枝端葉團
      const lumps = [];
      const rr = R(52, 96);
      for (let j = 0; j <= 11; j++) {
        const a = (Math.PI * 2 * j) / 11;
        lumps.push([qx + Math.cos(a) * rr * (1 + Math.sin(j * 2.1) * 0.18), qy + Math.sin(a) * rr * 0.68 * (1 + Math.cos(j * 1.6) * 0.2)]);
      }
      out.push(...sketchy(lumps, { size: LW.detail, jitter: 2.4, closed: true, passes: 1 }));
      for (let j = 0; j < 3; j++) out.push(stroke([[qx + R(-40, 40), qy + R(-30, 30)], [qx + R(-40, 40), qy + R(-30, 30)]], { size: LW.faint, press: 0.5, jitter: 1.6 }));
    }
  }
  // 光：從中央放射的細線
  for (let i = 0; i < 16; i++) {
    const a = R(0, Math.PI * 2), r0 = R(60, 140), r1 = r0 + R(180, 420);
    out.push(stroke([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], { size: LW.faint, press: 0.35, jitter: 1.2, color: GREY }));
  }
  return out;
}

// 花叢草地
export function meadow(hand, o = {}) {
  const { gy = 540, horizon = 400 } = o;
  const { hatch, R } = hand;
  const out = [];
  for (let i = 0; i < 9; i++) out.push(...tree(hand, { x: 60 + i * 150, base: horizon, h: 90 + (i % 3) * 22, kind: "fir", weight: 0.4 }));
  out.push(...ground(hand, { y: horizon + 4, from: 0, to: W, weight: 0.5 }));
  out.push(...ground(hand, { y: gy, from: 0, to: W, weight: 0.8 }));
  for (const [y, n, s] of [[gy + 20, 9, 1.1], [gy + 70, 8, 1.4], [gy + 130, 7, 1.8]]) {
    out.push(...tufts(hand, { y, from: 0, to: W, n: n + 4, size: s }));
    out.push(...flowers(hand, { y, from: 20, to: W - 20, n, size: s }));
  }
  out.push(...hatch(0, horizon + 8, W, 90, { gap: 24, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 }));
  return out;
}

// 外婆家外觀
export function cottageExt(hand, o = {}) {
  const { x = 700, base = 556, w = 420, open = false, lit = false, smoke = true, path = true, far = false } = o;
  const { hatch } = hand;
  const out = [];
  for (let i = 0; i < 11; i++) out.push(...tree(hand, { x: 30 + i * 122, base: 404, h: 96 + (i % 4) * 26, kind: "fir", weight: 0.42 }));
  out.push(...ground(hand, { y: 408, from: 0, to: W, weight: 0.5 }));
  out.push(...tree(hand, { x: 176, base: 540, h: 330, kind: "fir", weight: 0.85, mask: true }));
  out.push(...tree(hand, { x: 1148, base: 556, h: 300, kind: "oak", weight: 0.85, seedShift: 90, mask: true }));
  out.push(...ground(hand, { y: base + 4, from: 0, to: W, weight: 0.85 }));
  out.push(...cottage(hand, { x, base, w, open, lit, smoke, mask: true }));
  if (path) out.push(...pathway(hand, { yNear: H + 6, yFar: base + 2, xNear: x, xFar: x + 36, wNear: 460, wFar: 90 }));
  out.push(...tufts(hand, { y: base + 16, from: 40, to: Math.max(60, x - w / 2 - 60), n: 8, size: 1.3 }));
  out.push(...tufts(hand, { y: base + 30, from: Math.min(W - 60, x + w / 2 + 60), to: 1266, n: 8, size: 1.5 }));
  out.push(...flowers(hand, { y: base + 44, from: 950, to: 1200, n: 5, size: 1.3 }));
  out.push(...hatch(x - w * 0.62, base - w * 0.4, w * 0.3, w * 0.42, { gap: 18, size: LW.faint, press: 0.36, color: GREY, angle: -1.15 }));
  if (far) out.push(...hatch(0, 410, W, 120, { gap: 26, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 }));
  return out;
}

// 室內：外婆家（bed=true）或小紅帽家（hearth=true）
export function interior(hand, o = {}) {
  const { floor = 566, dim = false, window: win = true, bedAt = null, hearth = false, doorAt = null } = o;
  const { sketchy, stroke, hatch, scrub, fillPoly, R } = hand;
  const out = [];
  out.push(...sketchy([[0, 92], [640, 76], [W, 96]], { size: LW.detail, press: 0.55, jitter: 1.6, passes: 1 }));
  out.push(...sketchy([[0, floor], [640, floor + 12], [W, floor - 6]], { size: LW.hero, jitter: 2, passes: 2 }));
  // 地板木紋
  for (let i = 0; i < 5; i++) out.push(stroke([[R(0, 300) + i * 220, floor + 14], [R(0, 300) + i * 230 - 60, H]], { size: LW.faint, press: 0.32, jitter: 1.6 }));
  if (win) {
    out.push(...sketchy(rectPts(150, 146, 258, 250), { size: LW.body, jitter: 1, closed: true, passes: 2 }));
    out.push(...sketchy([[279, 148], [279, 394]], { size: LW.detail, jitter: 0.9, passes: 1 }));
    out.push(...sketchy([[152, 270], [406, 266]], { size: LW.detail, jitter: 0.9, passes: 1 }));
    out.push(...sketchy([[128, 132], [430, 126]], { size: LW.body, jitter: 0.9, passes: 1 }));
    out.push(...sketchy([[140, 134], [120, 250], [136, 384], [178, 300], [168, 140]], { size: LW.detail, jitter: 1.3, passes: 1 }));
    out.push(...sketchy([[418, 130], [440, 250], [424, 376], [384, 296], [392, 136]], { size: LW.detail, jitter: 1.3, passes: 1 }));
    if (!dim) out.push(...scrub(172, 166, 210, 200, { color: GREY, size: 1.6, rows: 4, press: 0.45 }));
  }
  if (doorAt !== null) {
    out.push(...sketchy(rectPts(doorAt - 78, floor - 330, 156, 330), { size: LW.body, jitter: 1, closed: true, passes: 2 }));
    out.push(...hatch(doorAt - 72, floor - 324, 144, 318, { gap: 9, size: LW.faint, press: 0.45 }));
  }
  if (hearth) {
    out.push(...sketchy(rectPts(830, floor - 300, 300, 300), { size: LW.body, jitter: 1.1, closed: true, passes: 2 }));
    out.push(...sketchy([[864, floor], [872, floor - 150], [1088, floor - 150], [1096, floor]], { size: LW.body, jitter: 1, passes: 2 }));
    out.push(...hatch(876, floor - 144, 208, 140, { gap: 10, size: LW.faint, press: 0.5 }));
    out.push(...sketchy([[820, floor - 300], [1140, floor - 306]], { size: LW.body, jitter: 1, passes: 2 })); // 壁爐架
    for (const bx of [880, 960, 1040]) out.push(...sketchy(rectPts(bx, floor - 348, 30, 42), { size: LW.faint, press: 0.5, closed: true, passes: 1 }));
  }
  if (bedAt) out.push(...bed(hand, bedAt));
  out.push(...hatch(0, floor - 190, 96, 190, { gap: 18, size: LW.faint, press: 0.36, color: GREY }));
  if (dim) out.push(...hatch(430, 110, 820, 420, { gap: 22, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 }));
  return out;
}

// 地面特寫（腳步、落葉）
export function forestFloor(hand) {
  const { sketchy, stroke, hatch, R } = hand;
  const out = [];
  for (let i = 0; i < 22; i++) {
    const x = R(-40, W + 40), y = R(120, H), sc = R(0.6, 1.5);
    const leaf = [[x, y], [x + 34 * sc, y - 20 * sc], [x + 70 * sc, y - 12 * sc], [x + 52 * sc, y + 14 * sc], [x + 16 * sc, y + 16 * sc]];
    out.push(...sketchy(leaf, { size: LW.detail, jitter: 1.2, closed: true, passes: 1 }));
    out.push(stroke([[x + 4 * sc, y + 2 * sc], [x + 60 * sc, y - 8 * sc]], { size: LW.faint, press: 0.45, jitter: 0.8 }));
  }
  for (let i = 0; i < 7; i++) {
    const x = R(0, W), y = R(200, H);
    out.push(stroke([[x, y], [x + R(60, 200), y + R(-30, 30)]], { size: LW.faint, press: 0.35, jitter: 1.6 }));
  }
  out.push(...hatch(0, 0, W, 200, { gap: 24, size: LW.faint, press: 0.3, color: GREY, angle: -1.15 }));
  return out;
}
