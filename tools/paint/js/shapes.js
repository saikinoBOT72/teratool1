// 図形をマス単位で描く。各関数は点ごとに plot(x, y) を呼ぶ（範囲外チェックは呼び出し側）

// ブレゼンハムの直線
export function plotLine(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 四角の枠
export function plotRect(x0, y0, x1, y1, plot) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let x = xa; x <= xb; x++) { plot(x, ya); plot(x, yb); }
  for (let y = ya + 1; y < yb; y++) { plot(xa, y); plot(xb, y); }
}

// 塗りつぶした四角
export function plotRectFill(x0, y0, x1, y1, plot) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) plot(x, y);
  }
}

// 2点を対角とする四角に内接する楕円の枠（偶数・奇数どちらの幅でも左右上下対称になる）
export function plotEllipse(x0, y0, x1, y1, plot) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  const cx = (xa + xb) / 2, cy = (ya + yb) / 2;
  const rx = (xb - xa) / 2 + 0.5, ry = (yb - ya) / 2 + 0.5;
  const inside = (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  // 楕円の内側のマスのうち、上下左右のどれかが外側のものを枠とする
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) plot(x, y);
    }
  }
}
