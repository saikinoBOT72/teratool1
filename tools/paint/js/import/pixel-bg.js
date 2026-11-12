// マス目を探す前に、画像の背景（外周からつながる、外周でよく出てくる色）をピクセル単位で見つける。
// 背景を除いた部分だけでマス目を探すので、雑な切り抜きや市松模様の背景に引きずられない。
// 戻り値: Uint8Array(crop.w * crop.h)。1 = 背景
export function backgroundMask(src, crop) {
  const { w: SW, d } = src, W = crop.w, H = crop.h, n = W * H;
  const idx = (x, y) => ((crop.y + y) * SW + crop.x + x) * 4;
  const border = [];
  for (let x = 0; x < W; x++) { border.push([x, 0]); border.push([x, H - 1]); }
  for (let y = 1; y < H - 1; y++) { border.push([0, y]); border.push([W - 1, y]); }

  // 外周の色を 16段階に丸めて数える
  const bins = new Map();
  let transparent = 0;
  for (const [x, y] of border) {
    const o = idx(x, y);
    if (d[o + 3] < 128) { transparent++; continue; }
    const key = (d[o] >> 4) << 8 | (d[o + 1] >> 4) << 4 | (d[o + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[o]; b.g += d[o + 1]; b.b += d[o + 2];
    bins.set(key, b);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n);
  const colors = [];
  if (top[0] && top[0].n >= border.length * 0.3) colors.push(top[0]);
  if (colors.length && top[1] && top[1].n >= border.length * 0.15) colors.push(top[1]);
  const cols = colors.map((c) => [c.r / c.n, c.g / c.n, c.b / c.n]);

  const mask = new Uint8Array(n);
  if (!cols.length && !transparent) return mask;
  const isBg = (x, y) => {
    const o = idx(x, y);
    if (d[o + 3] < 128) return true;
    return cols.some((c) => Math.abs(d[o] - c[0]) + Math.abs(d[o + 1] - c[1]) + Math.abs(d[o + 2] - c[2]) <= 48);
  };
  const stack = [];
  for (const [x, y] of border) { const i = y * W + x; if (!mask[i] && isBg(x, y)) { mask[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    if (x > 0 && !mask[i - 1] && isBg(x - 1, y)) { mask[i - 1] = 1; stack.push(i - 1); }
    if (x < W - 1 && !mask[i + 1] && isBg(x + 1, y)) { mask[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !mask[i - W] && isBg(x, y - 1)) { mask[i - W] = 1; stack.push(i - W); }
    if (y < H - 1 && !mask[i + W] && isBg(x, y + 1)) { mask[i + W] = 1; stack.push(i + W); }
  }
  return mask;
}
