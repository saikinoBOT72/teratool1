// 色の計算。色の近さは見た目に近い Lab 色空間で測る
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

export function toLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function dist2(a, i, b, j) {
  const d0 = a[i] - b[j], d1 = a[i + 1] - b[j + 1], d2 = a[i + 2] - b[j + 2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}

// labs: パレットの Lab の配列。一番近い色の番号（0始まり）
export function nearest(labs, L, A, B) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < labs.length; i++) {
    const q = labs[i], d0 = L - q[0], d1 = A - q[1], d2 = B - q[2], d = d0 * d0 + d1 * d1 + d2 * d2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
