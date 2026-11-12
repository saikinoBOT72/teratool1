// 選択範囲（マスごとに 1 = 選択）。選択中は、選択したマスだけに描ける
//   作り方: 四角 / 囲う（なげなわ）/ 同じ色（つながり・全体）/ 全部 / 描いたマス。新しく・足す・引く・反転
import { st } from '../state.js';
import { plotLine } from '../shapes.js';

// mode: 'rect' | 'lasso' | 'wand'（同じ色・つながり） | 'color'（同じ色・全体）、op: 'new' | 'add' | 'sub'
export const sel = { mask: null, w: 0, h: 0, count: 0, ver: 0, mode: 'rect', op: 'new' };
const listeners = [];
export function onSelChange(fn) { listeners.push(fn); }
function changed() { sel.ver++; for (const fn of listeners) fn(); }

// サイズが変わったら選択は外す
export function hasSel() {
  if (sel.mask && (sel.w !== st.W || sel.h !== st.H)) clearSel();
  return !!sel.mask;
}
// 描いてよいマスか（選択が無ければどこでも）
export function canPaint(i) { return !sel.mask || sel.mask[i] === 1; }

export function clearSel() {
  if (!sel.mask) return;
  sel.mask = null; sel.count = 0; changed();
}

// m（Uint8Array）を今の選択と合わせる
export function applySel(m, op = sel.op) {
  const n = st.W * st.H, cur = hasSel() ? sel.mask : null, out = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = cur ? cur[i] : 0;
    const v = op === 'add' ? (a | m[i]) : op === 'sub' ? (a & (m[i] ^ 1)) : m[i];
    out[i] = v; count += v;
  }
  sel.mask = count ? out : null; sel.w = st.W; sel.h = st.H; sel.count = count;
  changed();
}

const blank = () => new Uint8Array(st.W * st.H);

export function rectMask(x0, y0, x1, y1) {
  const m = blank();
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) m[y * st.W + x] = 1;
  }
  return m;
}

// なぞった線（マスの列）で囲んだ内側と、線の上のマス
export function lassoMask(pts) {
  const { W, H } = st, m = blank();
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1; };
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    plotLine(a.x, a.y, b.x, b.y, set);
  }
  if (pts.length < 3) return m;
  // マスの中心が多角形（マスの中心どうしを結んだ線）の内側か（偶奇判定）
  for (let y = 0; y < H; y++) {
    const xs = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) set(x, y);
    }
  }
  return m;
}

// (x, y) と同じ色のマス。contig ならつながっている部分だけ（透過も1つの色として選べる）
export function colorMask(x, y, contig) {
  const { W, H, data } = st, m = blank(), t = data[y * W + x];
  if (!contig) { for (let i = 0; i < m.length; i++) m[i] = data[i] === t ? 1 : 0; return m; }
  const stack = [y * W + x]; m[y * W + x] = 1;
  while (stack.length) {
    const i = stack.pop(), cx = i % W, cy = (i / W) | 0;
    for (const j of [cx > 0 ? i - 1 : -1, cx < W - 1 ? i + 1 : -1, cy > 0 ? i - W : -1, cy < H - 1 ? i + W : -1]) {
      if (j >= 0 && !m[j] && data[j] === t) { m[j] = 1; stack.push(j); }
    }
  }
  return m;
}

export function drawnMask() { return st.data.map((v) => (v ? 1 : 0)); }
export function allMask() { return blank().fill(1); }

// 選択が無いときの反転は「全部」
export function invertSel() {
  const m = allMask();
  if (hasSel()) for (let i = 0; i < m.length; i++) m[i] = sel.mask[i] ^ 1;
  applySel(m, 'new');
}
