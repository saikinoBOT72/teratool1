// 雑な切り抜きで入った背景を透明にする
//   外周のマスでよく出てくる色（2色まで。透過を表す市松模様にも対応）を背景とみなし、
//   外周からつながっている背景色のマスだけを消す（絵の内側の同じ色は残る）
import { dist2 } from './color.js';

const SAME = 16 * 16;  // これより近い色は同じ色とみなす（Lab の差の2乗）
const LOOSE = 30 * 30; // 仕上げで使う、ゆるい基準

// lab: Float32Array(n*3), on: Uint8Array(n)（1 = 色あり）。on を書きかえ、消したマス数を返す
export function removeBackground(w, h, lab, on) {
  const border = [];
  for (let x = 0; x < w; x++) { border.push(x); if (h > 1) border.push((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { border.push(y * w); if (w > 1) border.push(y * w + w - 1); }

  // 外周の色をまとめる
  const groups = [];
  for (const i of border) {
    if (!on[i]) continue;
    let g = groups.find((q) => dist2(lab, i * 3, lab, q.i * 3) < SAME);
    if (!g) groups.push(g = { i, n: 0 });
    g.n++;
  }
  groups.sort((a, b) => b.n - a.n);
  const bg = [];
  if (groups[0] && groups[0].n >= border.length * 0.35) bg.push(groups[0].i);
  if (bg.length && groups[1] && groups[1].n >= border.length * 0.2) bg.push(groups[1].i);
  if (!bg.length) return 0;

  const isBg = (i) => !on[i] || bg.some((j) => dist2(lab, i * 3, lab, j * 3) < SAME);
  const seen = new Uint8Array(w * h), stack = [];
  for (const i of border) if (!seen[i] && isBg(i)) { seen[i] = 1; stack.push(i); }
  let removed = 0;
  while (stack.length) {
    const i = stack.pop();
    if (on[i]) { on[i] = 0; removed++; }
    const x = i % w, y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) if (j >= 0 && !seen[j] && isBg(j)) { seen[j] = 1; stack.push(j); }
  }
  // 仕上げ: 背景に近い色（少しゆるい基準）で、まわりの3方向以上が背景になったマスも消す
  // （JPEG で隣の色がにじんで、背景なのに少し色が違って残ったマス）
  const near = (i) => bg.some((j) => dist2(lab, i * 3, lab, j * 3) < LOOSE);
  for (let i = 0; i < w * h; i++) {
    if (!on[i] || !near(i)) continue;
    const x = i % w, y = (i / w) | 0;
    const off = (x === 0 || !on[i - 1]) + (x === w - 1 || !on[i + 1]) + (y === 0 || !on[i - w]) + (y === h - 1 || !on[i + w]);
    if (off >= 3) { on[i] = 0; removed++; }
  }
  return removed;
}
