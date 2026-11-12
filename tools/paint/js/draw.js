// 描く・塗りつぶし・図形・スポイト（左右対称に対応）。消すときは「透過」の色で塗る
import { st, brushValue } from './state.js';
import { clamp } from './util.js';
import { markDirty, schedule } from './render.js';
import { snapshot, pushUndo } from './history.js';
import { setTool, pickValue } from './palette.js';
import { scheduleSave } from './works/store.js';
import { plotLine, plotRect, plotEllipse } from './shapes.js';

const SHAPES = { line: plotLine, rect: plotRect, ellipse: plotEllipse };
let stroke = null; // { snap, last, start, changed }

// キャンバス上の座標 → マス。clampIt なら範囲外でも端のマスにする
export function cellAt(px, py, clampIt = false) {
  const v = st.view;
  let x = Math.floor((px - v.x) / v.s), y = Math.floor((py - v.y) / v.s);
  if (clampIt) { x = clamp(x, 0, st.W - 1); y = clamp(y, 0, st.H - 1); }
  return (x >= 0 && y >= 0 && x < st.W && y < st.H) ? { x, y } : null;
}

const mirrorX = (x) => st.W - 1 - x;

function put1(x, y, val) {
  if (x < 0 || y < 0 || x >= st.W || y >= st.H) return;
  const i = y * st.W + x;
  if (st.data[i] !== val) { st.data[i] = val; stroke.changed = true; st.dirty = true; }
}
function put(x, y, val) {
  put1(x, y, val);
  if (st.mirror) put1(mirrorX(x), y, val);
}


function paintTo(c) {
  if (!c) { stroke.last = null; return; }
  const val = brushValue(); // 0 = 透過（消す）
  if (stroke.last) plotLine(stroke.last.x, stroke.last.y, c.x, c.y, (x, y) => put(x, y, val));
  else put(c.x, c.y, val);
  stroke.last = c;
}

// 図形はドラッグ中ずっと「元に戻してから描き直す」ことでプレビューする
function shapeTo(c) {
  st.data.set(stroke.snap.d);
  stroke.changed = false;
  const val = brushValue();
  SHAPES[st.tool](stroke.start.x, stroke.start.y, c.x, c.y, (x, y) => put(x, y, val));
  st.dirty = true;
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

function pick(c) {
  pickValue(st.data[c.y * st.W + c.x]); // 何もないマスなら「透過」
  setTool('pen');
}

// 押した瞬間の処理。p はキャンバス上の座標
export function beginAction(p) {
  const shape = !!SHAPES[st.tool];
  const c = cellAt(p.x, p.y);
  if (c) st.lastCell = c;
  if (!c) return;
  if (st.tool === 'pick') { pick(c); return; }
  if (st.tool === 'fill') {
    const snap = snapshot();
    const val = brushValue();
    let changed = flood(c.x, c.y, val);
    if (st.mirror) changed = flood(mirrorX(c.x), c.y, val) || changed;
    if (changed) { pushUndo(snap); markDirty(); scheduleSave(); }
    return;
  }
  stroke = { snap: snapshot(), last: null, start: c, changed: false };
  if (shape) shapeTo(c); else paintTo(c);
  schedule();
}

export function continueStroke(p) {
  if (!stroke) return;
  if (SHAPES[st.tool]) shapeTo(cellAt(p.x, p.y, true));
  else paintTo(cellAt(p.x, p.y));
  schedule();
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
