// 画像 → マスごとの色（RGBA）。{ w, h, px: Float32Array(w*h*4) }
import { MAX } from '../state.js';
import { clamp } from '../util.js';

// 1軸ぶんのマスの範囲（使うピクセルの範囲 [s, e]）。境目は phase + k*p
function cellRanges(n, p, phase) {
  const out = [];
  const k0 = Math.ceil(-phase / p - 0.5), k1 = Math.floor((n - phase) / p - 0.5);
  for (let k = k0; k <= k1 && out.length < MAX * 2; k++) {
    const a = phase + k * p, b = a + p;
    if (Math.min(b, n) - Math.max(a, 0) < p * 0.5) continue; // 半分以上はみ出したマスは使わない
    // マスの内側に中心が入るピクセルだけを使う（境目のにじみ・JPEG のノイズを避ける）。
    // 大きいマスほど、ぼかしで隣の色が混ざりやすいので、中心寄りの狭い範囲にする
    const mg = p >= 6 ? 0.35 : 0.25;
    let s = Math.max(0, Math.ceil(a + p * mg - 0.5)), e = Math.min(n - 1, Math.floor(b - p * mg - 0.5));
    if (e < s) s = e = clamp(Math.floor(a + p / 2), 0, n - 1);
    out.push([s, e]);
  }
  return out;
}

function median(arr, n) {
  const a = arr.subarray(0, n).sort();
  return n & 1 ? a[n >> 1] : (a[(n >> 1) - 1] + a[n >> 1]) / 2;
}

// ドット絵: 各マスの内側の色の中央値をとる
export function sampleGrid(src, crop, g) {
  const xs = cellRanges(crop.w, g.px, g.ox), ys = cellRanges(crop.h, g.py, g.oy);
  const W = xs.length, H = ys.length, px = new Float32Array(W * H * 4);
  const R = new Float32Array(64), G = new Float32Array(64), B = new Float32Array(64), A = new Float32Array(64);
  const { w: SW, d } = src;
  for (let cy = 0; cy < H; cy++) {
    const [ys0, ys1] = ys[cy], sy = Math.max(1, Math.ceil((ys1 - ys0 + 1) / 7));
    for (let cx = 0; cx < W; cx++) {
      const [xs0, xs1] = xs[cx], sx = Math.max(1, Math.ceil((xs1 - xs0 + 1) / 7));
      let n = 0, na = 0;
      for (let y = ys0; y <= ys1 && na < 64; y += sy) {
        for (let x = xs0; x <= xs1 && na < 64; x += sx) {
          const i = ((crop.y + y) * SW + crop.x + x) * 4;
          A[na++] = d[i + 3];
          if (d[i + 3] >= 128) { R[n] = d[i]; G[n] = d[i + 1]; B[n] = d[i + 2]; n++; }
        }
      }
      const o = (cy * W + cx) * 4;
      px[o + 3] = median(A, na);
      if (n) { px[o] = median(R, n); px[o + 1] = median(G, n); px[o + 2] = median(B, n); }
    }
  }
  return { w: W, h: H, px };
}

// 普通の画像: 長辺 longSide マスに縮小（面積平均・透明度で重み付け）
export function resampleArea(src, crop, longSide) {
  const k = Math.min(1, longSide / Math.max(crop.w, crop.h));
  const tw = Math.max(1, Math.round(crop.w * k)), th = Math.max(1, Math.round(crop.h * k));
  const { w: SW, d } = src, px = new Float32Array(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor(ty * crop.h / th), y1 = Math.max(y0 + 1, Math.ceil((ty + 1) * crop.h / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor(tx * crop.w / tw), x1 = Math.max(x0 + 1, Math.ceil((tx + 1) * crop.w / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = ((crop.y + y) * SW + crop.x + x) * 4, al = d[i + 3];
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al; n++;
      }
      const o = (ty * tw + tx) * 4;
      if (a > 0) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; }
      px[o + 3] = a / n;
    }
  }
  return { w: tw, h: th, px };
}
