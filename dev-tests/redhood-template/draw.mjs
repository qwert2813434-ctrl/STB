// 手繪筆觸引擎：把幾何形狀變成 STB 的 SketchStroke（pts=[x,y,壓力]，1280×720 座標）。
// 輸出直接進 project.json 的 cut.sketch，不是圖片——iPad 上點進去每一筆都還能改。

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 一維值噪音：手抖是低頻的，用隨機數逐點加會變毛邊
function noise1(rand) {
  const N = 1024;
  const tab = Array.from({ length: N }, () => rand() * 2 - 1);
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = tab[((i % N) + N) % N], b = tab[((((i + 1) % N) + N) % N)];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

// Catmull-Rom：把少數控制點變成順的曲線。
// 轉角要「尖」的地方把同一個點寫兩次＝曲線在那裡形成尖點（腿縫、下擺角都靠這個，
// 不然四條腿會被平滑成一座拱橋——第一版狼就是這樣壞掉的）。
export function spline(pts, closed = false, per = 14) {
  if (pts.length < 3) return pts.slice();
  const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i + 2 < p.length; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(closed ? out[0].slice() : pts[pts.length - 1].slice());
  return out;
}

// 依弧長重新取樣：筆觸抖動要跟「畫過的距離」走，不能跟控制點疏密走
function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1e-6) continue;
    let t = (step - carry) / d;
    while (t <= 1) {
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      t += step / d;
    }
    carry = (carry + d) % step;
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.4) out.push(last);
  return out;
}

export function makeHand(seed) {
  const rand = mulberry32(seed);
  const n = noise1(rand);
  let serial = 0;
  const R = (a, b) => a + rand() * (b - a);

  // 一筆：anchors→曲線→弧長取樣→沿法線加低頻抖動→給壓力曲線
  function stroke(anchors, o = {}) {
    const {
      tool = "pen", size = 1, color = null, closed = false,
      jitter = 1.9, freq = 2.2, step = 8,
      lead = 0, tail = 0,            // 起收筆超出（分鏡師的線常常出頭）
      press = 1, flat = false,        // flat＝壓力一致（讓 perfect-freehand 用速度模擬筆鋒）
    } = o;
    const off = (serial += 7.31) + R(0, 40);
    let dense = resample(spline(anchors, closed), step);
    if (dense.length < 2) return null;

    // 起收筆延長：沿頭尾切線推出去
    if (lead > 0) {
      const [a, b] = [dense[0], dense[1]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      dense.unshift([a[0] - ((b[0] - a[0]) / L) * lead, a[1] - ((b[1] - a[1]) / L) * lead]);
    }
    if (tail > 0) {
      const [a, b] = [dense[dense.length - 2], dense[dense.length - 1]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      dense.push([b[0] + ((b[0] - a[0]) / L) * tail, b[1] + ((b[1] - a[1]) / L) * tail]);
    }

    const N = dense.length;
    const pts = dense.map((p, i) => {
      const t = i / (N - 1);
      const prev = dense[Math.max(0, i - 1)], next = dense[Math.min(N - 1, i + 1)];
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const L = Math.hypot(dx, dy) || 1;
      const w = n(t * N * 0.06 * freq + off) * 0.75 + n(t * N * 0.18 * freq + off * 1.7) * 0.35;
      const j = w * jitter;
      // 壓力：起筆輕、行筆穩、收筆放掉，再疊一點呼吸
      let pr = 0.72 + 0.16 * n(t * 5 + off * 0.5);
      pr *= t < 0.14 ? 0.5 + (t / 0.14) * 0.5 : t > 0.86 ? 1 - ((t - 0.86) / 0.14) * 0.42 : 1;
      pr = Math.max(0.12, Math.min(1, pr * press));
      // 精度只留 0.1px／壓力兩位：一份 64 卡的案子有六十萬個點，
      // 小數位直接決定 project.json 是 10MB 還是 25MB
      return [
        Math.round((p[0] + (-dy / L) * j) * 10) / 10,
        Math.round((p[1] + (dx / L) * j) * 10) / 10,
        flat ? 0.5 : Math.round(pr * 100) / 100,
      ];
    });

    const s = { tool, pts };
    if (size !== 1) s.size = Math.round(size * 100) / 100;
    if (color) s.color = color;
    return s;
  }

  // 同一條輪廓分成幾筆疊畫＝素描的「找線」手感（一氣呵成反而假）
  function sketchy(anchors, o = {}) {
    const { passes = 2, spread = 2.4, ...rest } = o;
    const out = [];
    for (let k = 0; k < passes; k++) {
      const sh = k === 0 ? 0 : R(-spread, spread);
      const shy = k === 0 ? 0 : R(-spread, spread);
      const seg = k === 0 ? anchors : anchors.slice(Math.floor(R(0, 0.22) * anchors.length), Math.ceil(anchors.length * R(0.78, 1)));
      if (seg.length < 2) continue;
      const s = stroke(seg.map(([x, y]) => [x + sh, y + shy]), {
        ...rest,
        press: (rest.press ?? 1) * (k === 0 ? 1 : R(0.55, 0.8)),
        lead: k === 0 ? (rest.lead ?? 0) : R(0, 5),
        tail: k === 0 ? (rest.tail ?? 0) : R(0, 7),
      });
      if (s) out.push(s);
    }
    return out;
  }

  // 排線陰影：一組平行短線（angle 弧度），常見於分鏡的體積表現
  function hatch(x, y, w, h, o = {}) {
    const { angle = -Math.PI / 3.2, gap = 11, size = 0.55, color = null, press = 0.6, jitter = 1.4, ragged = 0.3 } = o;
    const out = [];
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    const diag = Math.hypot(w, h);
    const cx = x + w / 2, cy = y + h / 2;
    for (let d = -diag / 2; d <= diag / 2; d += gap) {
      const jd = d + R(-gap * 0.18, gap * 0.18);
      const half = (diag / 2) * R(0.55, 1) * (1 - ragged * rand());
      const a = [cx + nx * jd - dx * half, cy + ny * jd - dy * half];
      const b = [cx + nx * jd + dx * half, cy + ny * jd + dy * half];
      // 夾回矩形內（超出的線先裁掉再畫）
      const cl = clipSeg(a, b, x, y, x + w, y + h);
      if (!cl) continue;
      const s = stroke([cl[0], [(cl[0][0] + cl[1][0]) / 2 + R(-2, 2), (cl[0][1] + cl[1][1]) / 2 + R(-2, 2)], cl[1]], {
        size, color, press, jitter, step: 10, lead: R(0, 3), tail: R(0, 5),
      });
      if (s) out.push(s);
    }
    return out;
  }

  function clipSeg(a, b, x0, y0, x1, y1) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const tests = [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]];
    for (const [p, q] of tests) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }

  // 麥克筆塗抹：來回一筆畫完的色塊（marker alpha 0.32，疊起來自然有濃淡）
  function scrub(x, y, w, h, o = {}) {
    const { color = null, size = 1, rows = null, press = 1 } = o;
    const band = 20 * size;
    const nrows = rows ?? Math.max(2, Math.round(h / band));
    const pts = [];
    for (let i = 0; i <= nrows; i++) {
      const yy = y + (h * i) / nrows;
      const left = x + R(-3, 6), right = x + w + R(-6, 3);
      pts.push(i % 2 ? [right, yy] : [left, yy]);
      pts.push(i % 2 ? [left, yy + h / nrows / 2] : [right, yy + h / nrows / 2]);
    }
    return [stroke(pts, { tool: "marker", size, color, press, jitter: 2.6, step: 12 })].filter(Boolean);
  }

  // 圓/橢圓（手繪：不閉合、起收筆略過頭）
  function ring(cx, cy, rx, ry, o = {}) {
    const { start = R(0, 6.28), sweep = Math.PI * 2 * R(1.0, 1.08), wob = 0.06, steps = 14 } = o;
    const a = [];
    for (let i = 0; i <= steps; i++) {
      const t = start + (sweep * i) / steps;
      const k = 1 + n(i * 0.7 + cx * 0.01) * wob;
      a.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    return stroke(a, o);
  }

  // 封閉形狀填色：掃描線切出水平筆畫。白色＝遮擋（前景蓋住背景），
  // 這是唯一能讓「人站在樹前面」讀得出來的辦法——線稿本身沒有不透明度。
  // 壓力刻意一高一低交錯：sketchEditor 看到「壓力全相同」會改用速度模擬筆鋒，
  // 填色就會出現粗細不均的縫。
  function fillPoly(pts, o = {}) {
    const { color = "#ffffff", step = 7, size = 1.7, pad = 3 } = o;
    const poly = spline(pts, true, 10);
    let y0 = Infinity, y1 = -Infinity;
    for (const p of poly) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const out = [];
    for (let y = y0 + step / 2; y < y1; y += step) {
      const xs = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        if (xs[k + 1] - xs[k] < 2) continue;
        const s = { tool: "pen", pts: [[xs[k] - pad, y, 0.62], [(xs[k] + xs[k + 1]) / 2, y, 0.6], [xs[k + 1] + pad, y, 0.62]], size };
        if (color) s.color = color;
        out.push(s);
      }
    }
    return out;
  }

  return { stroke, sketchy, hatch, scrub, ring, fillPoly, rand, R, n };
}

// 畫布與色票（色票對齊 sketchEditor 的內建三色，紅＝#b3341c）
export const W = 1280, H = 720;
export const INK = "#141311";
export const RED = "#b3341c";
export const GREY = "#8d8880";
