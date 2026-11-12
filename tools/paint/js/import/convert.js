// マスの色 → ペンキの番号。背景除去・余白の切り詰め・明るさ/鮮やかさの調整・減色
import { st, MAX } from '../state.js';
import { toLab, nearest } from './color.js';
import { removeBackground } from './background.js';

// opt = { bg, trim, bright(-50..50), sat(-50..50), dither }
// 戻り値 { w, h, d: Uint8Array, removed, clipped, empty }
export function convertCells(cells, opt) {
  let { w, h } = cells;
  const n = w * h, lab = new Float32Array(n * 3), on = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (cells.px[o + 3] < 128) continue;
    on[i] = 1;
    const l = toLab(cells.px[o], cells.px[o + 1], cells.px[o + 2]);
    lab[i * 3] = l[0]; lab[i * 3 + 1] = l[1]; lab[i * 3 + 2] = l[2];
  }
  const removed = opt.bg ? removeBackground(w, h, lab, on) : 0;

  // 余白を詰める範囲
  let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
  if (opt.trim) {
    x0 = w; y0 = h; x1 = -1; y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on[y * w + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return { w: 1, h: 1, d: new Uint8Array(1), removed, clipped: false, empty: true };
  }
  let ow = x1 - x0 + 1, oh = y1 - y0 + 1;
  const clipped = ow > MAX || oh > MAX;
  ow = Math.min(ow, MAX); oh = Math.min(oh, MAX);

  // 調整後の色を一番近いペンキに。ディザは誤差を右・下へ配る（フロイド–スタインバーグ法）
  const labs = st.rgbs.map((c) => toLab(c[0], c[1], c[2]));
  const kL = opt.bright * 0.6, kC = 1 + opt.sat / 50;
  const buf = new Float32Array(ow * oh * 3), out = new Uint8Array(ow * oh);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = (y + y0) * w + x + x0, j = (y * ow + x) * 3;
    buf[j] = lab[i * 3] + kL; buf[j + 1] = lab[i * 3 + 1] * kC; buf[j + 2] = lab[i * 3 + 2] * kC;
  }
  const opaque = (x, y) => on[(y + y0) * w + x + x0];
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    if (!opaque(x, y)) continue;
    const j = (y * ow + x) * 3;
    const idx = nearest(labs, buf[j], buf[j + 1], buf[j + 2]);
    out[y * ow + x] = idx + 1;
    if (!opt.dither) continue;
    const q = labs[idx], e = [buf[j] - q[0], buf[j + 1] - q[1], buf[j + 2] - q[2]];
    const spread = (xx, yy, f) => {
      if (xx < 0 || xx >= ow || yy >= oh || !opaque(xx, yy)) return;
      const k = (yy * ow + xx) * 3;
      buf[k] += e[0] * f; buf[k + 1] += e[1] * f; buf[k + 2] += e[2] * f;
    };
    spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
  }
  return { w: ow, h: oh, d: out, removed, clipped, empty: false };
}
