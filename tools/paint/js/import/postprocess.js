// 減色した後の仕上げ: 指定した色を透明に・1マスのゴミ取り・ふち取り・反転/回転
import { MAX } from '../state.js';

// r = { w, h, d }（d: 0 = 透過, 1〜 = ペンキ）。新しい r を返す
// opt = { clear: Set(透明にするペンキ), despeckle, outline: 0 or ペンキ番号, flipH, flipV, rot: 0..3（右90°単位） }
export function postprocess(r, opt) {
  let { w, h } = r, d = r.d.slice();
  if (opt.clear.size) for (let i = 0; i < d.length; i++) if (opt.clear.has(d[i])) d[i] = 0;
  if (opt.despeckle) d = despeckle(w, h, d);
  if (opt.outline) ({ w, h, d } = outline(w, h, d, opt.outline));
  if (opt.flipH || opt.flipV) d = flip(w, h, d, opt.flipH, opt.flipV);
  for (let k = 0; k < (opt.rot & 3); k++) ({ w, h, d } = rotate(w, h, d));
  return { ...r, w, h, d };
}

// 上下左右と違う色の1マスを、まわりで一番多い色にする（3方向以上が同じ色のとき）
function despeckle(w, h, d) {
  const out = d.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = d[i];
    const nb = [];
    if (x > 0) nb.push(d[i - 1]); if (x < w - 1) nb.push(d[i + 1]);
    if (y > 0) nb.push(d[i - w]); if (y < h - 1) nb.push(d[i + w]);
    if (nb.length < 3 || nb.includes(v)) continue;
    const count = new Map();
    for (const n of nb) count.set(n, (count.get(n) || 0) + 1);
    const [best, n] = [...count].sort((a, b) => b[1] - a[1])[0];
    if (n >= 3) out[i] = best;
  }
  return out;
}

// 絵のまわり（上下左右が絵に接する透明マス）を color で囲む。はみ出す分だけ1マスずつ広げる
function outline(w, h, d, color) {
  const W = Math.min(w + 2, MAX), H = Math.min(h + 2, MAX), ox = W > w ? 1 : 0, oy = H > h ? 1 : 0;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < h && y + oy < H; y++) for (let x = 0; x < w && x + ox < W; x++) out[(y + oy) * W + x + ox] = d[y * w + x];
  const src = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (src[i]) continue;
    if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) out[i] = color;
  }
  return { w: W, h: H, d: out };
}

function flip(w, h, d, fh, fv) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out[(fv ? h - 1 - y : y) * w + (fh ? w - 1 - x : x)] = d[y * w + x];
  }
  return out;
}

// 右に90°回す
function rotate(w, h, d) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = d[y * w + x];
  return { w: h, h: w, d: out };
}
