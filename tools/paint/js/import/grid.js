// 拡大されたドット絵の「マス目」（1マスの大きさ p と、境目の位置 = ずれ）を見つける
//   大きさ: 色の「傾きの変化」（2階差分）を列ごとに足したグラフは、くっきりした拡大でも
//           ぼかした拡大（マスの中心で折れ曲がる）でもマスの大きさの周期になる。自己相関で周期を探す
//   ずれ:   マスの内側がいちばん均一な色になる位置を選ぶ
// src = { w, h, d: RGBA }, crop = { x, y, w, h }。境目の座標は phase + k*p（ピクセル i は [i, i+1)）
import { clamp } from '../util.js';
import { looksUnscaled } from './unscaled.js';
import { backgroundMask } from './pixel-bg.js';

const CAP = 48; // 1ピクセルあたりの上限（強い境目1本にグラフが引きずられないように）

// 明るさ（透明度を掛けたもの）。JPEG は色味を半分の解像度・16px のブロックで持つため、
// 色味を使うと 16px 周期の段差を拾ってしまう。明るさは元の解像度なので、こちらを使う
const luma = (d, o) => (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) * d[o + 3] / 255;

// mask: 1 = 背景（使わない）
function profile(src, crop, horiz, mask) {
  const { w: SW, d } = src, n = horiz ? crop.w : crop.h, m = horiz ? crop.h : crop.w;
  const D = new Float32Array(n), step = horiz ? 4 : SW * 4, mStep = Math.max(1, Math.floor(m / 512));
  const mi = (i, j) => (horiz ? j * crop.w + i : i * crop.w + j);
  for (let j = 0; j < m; j += mStep) {
    const base = horiz ? ((crop.y + j) * SW + crop.x) * 4 : (crop.y * SW + crop.x + j) * 4;
    for (let i = 1; i < n - 1; i++) {
      if (mask[mi(i - 1, j)] || mask[mi(i, j)] || mask[mi(i + 1, j)]) continue;
      const b = base + i * step, a = b - step, c = b + step;
      const s = Math.abs(luma(d, a) - 2 * luma(d, b) + luma(d, c)) * 2 + Math.abs(d[a + 3] - 2 * d[b + 3] + d[c + 3]);
      D[i] += Math.min(s, CAP);
    }
  }
  if (src.jpeg) hideJpegBlocks(D, horiz ? crop.x : crop.y);
  const S = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) S[i] = (D[i - 1] + 2 * D[i] + D[i + 1]) / 4;
  // 背景と絵の境目などのゆるやかな変化を取り除く（周りの平均を引く）
  const win = 15, pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + S[i];
  const H = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - win), b = Math.min(n, i + win + 1); H[i] = S[i] - (pre[b] - pre[a]) / (b - a); }
  return H;
}

// JPEG は 8×8 ピクセルのブロックごとに圧縮されるため、ブロックの境目に周期 8 の段差ができる。
// 境目をまたぐ位置の値を両隣から補って、マス目と取り違えないようにする
function hideJpegBlocks(D, offset) {
  const n = D.length;
  for (let i = 1; i + 2 < n; i++) {
    if ((offset + i) % 8 !== 7) continue;
    const l = D[i - 1], r = D[i + 2];
    D[i] = (2 * l + r) / 3; D[i + 1] = (l + 2 * r) / 3;
  }
}

// 自己相関から、だいたいの周期を見つける。
// 周期 p の候補ごとに「p, 2p, 3p … での自己相関の平均」を点数にし、最高点に近い中で一番小さい p を選ぶ
// （2倍・3倍の周期も高い点になるため、一番小さいものが本当の1マス）
function roughPeriod(H) {
  const n = H.length, maxLag = Math.floor(n / 2);
  if (maxLag < 4) return null;
  const r = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += H[i] * H[i + lag];
    r[lag] = s / (n - lag);
  }
  if (r[0] <= 0) return null;
  const rAt = (x) => { const i = Math.floor(x), f = x - i; return r[i] * (1 - f) + r[i + 1] * f; };
  const scores = [];
  let best = 0;
  for (let p = 2; p <= maxLag / 2; p += 0.05) {
    let s = 0, k = 0;
    for (let q = p; q <= maxLag; q += p) { s += rAt(q); k++; }
    scores.push([p, s / k]);
    best = Math.max(best, s / k);
  }
  if (best <= 0) return null;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i][1] < best * 0.6) continue;
    while (i + 1 < scores.length && scores[i + 1][1] >= scores[i][1]) i++; // 山の頂上まで
    return { p: scores[i][0], conf: scores[i][1] / r[0] };
  }
  return null;
}

function at(H, pos) { const i = Math.floor(pos), f = pos - i; return H[i] * (1 - f) + (H[i + 1] || 0) * f; }
function comb(H, p, phase) {
  let s = 0, c = 0;
  for (let pos = phase; pos < H.length - 1; pos += p) { s += at(H, pos); c++; }
  return c >= 2 ? s / c : -Infinity;
}

// p0 の近くを、端まで ずれが 1/4 ピクセル以内に収まる細かさで探す
function refinePeriod(H, p0, range) {
  const n = H.length, dp = Math.max(0.001, 0.25 * p0 / n);
  let best = p0, bs = -Infinity;
  for (let p = Math.max(2, p0 - range); p <= p0 + range; p += dp) {
    for (let f = 0; f < p; f += 0.25) { const s = comb(H, p, f); if (s > bs) { bs = s; best = p; } }
  }
  return best;
}

// マスの内側の色のばらつきが一番小さくなる「ずれ」を探す（行を最大96本使う）
function bestPhase(src, crop, horiz, p, mask) {
  const { w: SW, d } = src, n = horiz ? crop.w : crop.h, m = horiz ? crop.h : crop.w;
  const lines = Math.min(m, 96), buf = new Float32Array(n * 3 * lines);
  for (let l = 0; l < lines; l++) {
    const j = Math.floor((l + 0.5) * m / lines);
    for (let i = 0; i < n; i++) {
      const o = horiz ? ((crop.y + j) * SW + crop.x + i) * 4 : ((crop.y + i) * SW + crop.x + j) * 4, f = d[o + 3] / 255;
      const q = (l * n + i) * 3;
      if (mask[horiz ? j * crop.w + i : i * crop.w + j]) { buf[q] = buf[q + 1] = buf[q + 2] = NaN; continue; }
      buf[q] = d[o] * f; buf[q + 1] = d[o + 1] * f; buf[q + 2] = d[o + 2] * f;
    }
  }
  let best = 0, bc = Infinity;
  for (let t = 0; t < 32; t++) {
    const ph = t * p / 32;
    let cost = 0, cnt = 0;
    for (let k = Math.floor(-ph / p); ph + k * p < n; k++) {
      const s = Math.max(0, Math.ceil(ph + k * p + p * 0.25 - 0.5)), e = Math.min(n - 1, Math.floor(ph + (k + 1) * p - p * 0.25 - 0.5));
      if (e < s) continue;
      for (let l = 0; l < lines; l++) {
        let m0 = 0, m1 = 0, m2 = 0, c = 0;
        const base = l * n * 3;
        for (let i = s; i <= e; i++) { const q = base + i * 3; if (buf[q] === buf[q]) { m0 += buf[q]; m1 += buf[q + 1]; m2 += buf[q + 2]; c++; } }
        if (c < 2) continue; // 背景だけ・1ピクセルだけのマスは判断に使わない
        m0 /= c; m1 /= c; m2 /= c;
        for (let i = s; i <= e; i++) { const q = base + i * 3; if (buf[q] === buf[q]) cost += Math.abs(buf[q] - m0) + Math.abs(buf[q + 1] - m1) + Math.abs(buf[q + 2] - m2); }
        cnt += c;
      }
    }
    if (cnt && cost / cnt < bc) { bc = cost / cnt; best = ph; }
  }
  return best;
}

function axis(src, crop, horiz, mask) {
  const H = profile(src, crop, horiz, mask), r = roughPeriod(H);
  if (!r) return null;
  return { p: refinePeriod(H, r.p, Math.max(0.6, r.p * 0.05)), conf: r.conf };
}

// 自動検出。{ ok, px, py, ox, oy, conf }
export function detectGrid(src, crop) {
  if (crop.w < 4 || crop.h < 4) return { ok: false };
  if (looksUnscaled(src, crop)) return { ok: true, px: 1, py: 1, ox: 0, oy: 0, conf: 1 };
  const mask = backgroundMask(src, crop);
  let ax = axis(src, crop, true, mask), ay = axis(src, crop, false, mask);
  if (!ax && !ay) return { ok: false };
  ax = ax || ay; ay = ay || ax;  // 片方しか見つからなければ正方形のマスとみなす
  let px = ax.p, py = ay.p;
  // 片方がもう片方のほぼ整数倍なら、大きい方は2倍・3倍…の周期を拾った間違いとみなし、小さい方に合わせる
  const k = Math.max(px, py) / Math.min(px, py), kr = Math.round(k);
  if (kr >= 2 && Math.abs(k - kr) / kr < 0.06) {
    const p = Math.min(px, py), horiz = px > py;
    const fixed = refinePeriod(profile(src, crop, horiz, mask), p, p * 0.02);
    if (horiz) px = fixed; else py = fixed;
  }
  if (Math.abs(px - py) / Math.max(px, py) < 0.02) px = py = (px + py) / 2;
  return {
    ok: true, px, py, conf: Math.min(ax.conf, ay.conf),
    ox: bestPhase(src, crop, true, px, mask), oy: bestPhase(src, crop, false, py, mask),
  };
}

// 利用者が1マスの大きさを指定したとき。近く（±1%）だけ探して合わせる
export function gridForCell(src, crop, p) {
  if (p < 1.5) return { ok: true, px: 1, py: 1, ox: 0, oy: 0, conf: 0 };
  const mask = backgroundMask(src, crop);
  const px = refinePeriod(profile(src, crop, true, mask), p, p * 0.01);
  const py = refinePeriod(profile(src, crop, false, mask), p, p * 0.01);
  return { ok: true, px, py, conf: 0, ox: bestPhase(src, crop, true, px, mask), oy: bestPhase(src, crop, false, py, mask) };
}
