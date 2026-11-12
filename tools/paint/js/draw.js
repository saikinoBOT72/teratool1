// 描く・消す・塗りつぶし・スポイト
import { st } from './state.js';
import { markDirty, schedule } from './render.js';
import { snapshot, pushUndo } from './history.js';
import { setTool, refreshSel } from './palette.js';
import { scheduleSave } from './storage.js';

let stroke = null; // { snap, last, changed }

export function cellAt(px, py) {
  const v = st.view;
  const x = Math.floor((px - v.x) / v.s), y = Math.floor((py - v.y) / v.s);
  return (x >= 0 && y >= 0 && x < st.W && y < st.H) ? { x, y } : null;
}

function put(x, y, val) {
  const i = y * st.W + x;
  if (st.data[i] !== val) { st.data[i] = val; stroke.changed = true; st.dirty = true; }
}

// ブレゼンハムの直線（素早く動かしても途切れないように）
function line(x0, y0, x1, y1, val) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(x0, y0, val);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function paintTo(c) {
  if (!c) { stroke.last = null; return; }
  const val = st.tool === 'eraser' ? 0 : st.sel;
  if (stroke.last) line(stroke.last.x, stroke.last.y, c.x, c.y, val); else put(c.x, c.y, val);
  stroke.last = c;
}

// 4方向の塗りつぶし。変化がなければ false
function flood(x, y, val) {
  const { W, H, data } = st;
  const t = data[y * W + x];
  if (t === val) return false;
  const stack = [y * W + x]; data[y * W + x] = val;
  while (stack.length) {
    const i = stack.pop(), cx = i % W, cy = (i / W) | 0;
    if (cx > 0 && data[i - 1] === t) { data[i - 1] = val; stack.push(i - 1); }
    if (cx < W - 1 && data[i + 1] === t) { data[i + 1] = val; stack.push(i + 1); }
    if (cy > 0 && data[i - W] === t) { data[i - W] = val; stack.push(i - W); }
    if (cy < H - 1 && data[i + W] === t) { data[i + W] = val; stack.push(i + W); }
  }
  return true;
}

// 押した瞬間の処理。p はキャンバス上の座標
export function beginAction(p) {
  const c = cellAt(p.x, p.y);
  if (c) st.lastCell = c;
  if (st.tool === 'pick') {
    if (!c) return;
    const v = st.data[c.y * st.W + c.x];
    if (v) { st.sel = v; refreshSel(); setTool('pen'); scheduleSave(); } else { setTool('eraser'); }
    return;
  }
  if (st.tool === 'fill') {
    if (!c) return;
    const snap = snapshot();
    if (flood(c.x, c.y, st.sel)) { pushUndo(snap); markDirty(); scheduleSave(); }
    return;
  }
  stroke = { snap: snapshot(), last: null, changed: false };
  paintTo(c); schedule();
}

export function continueStroke(c) {
  if (!stroke) return;
  paintTo(c); schedule();
}

export function endStroke() {
  if (!stroke) return;
  if (stroke.changed) { pushUndo(stroke.snap); scheduleSave(); }
  stroke = null;
}

// 描きかけを取り消して元に戻す（2本指操作の開始時など）
export function cancelStroke() {
  if (!stroke) return;
  st.data.set(stroke.snap.d); stroke = null; markDirty();
}
