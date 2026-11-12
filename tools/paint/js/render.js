// キャンバスへの描画（絵・市松模様の背景・グリッド・カーソル）
import { st } from './state.js';
import { updateCounts } from './palette.js';
import { drawWallMarks } from './wallmark.js';

export const cv = document.getElementById('cv');
export const stage = document.getElementById('stage');
const ctx = cv.getContext('2d');

// 1マス = 1px の絵（書き出しにも使う）
export const img = document.createElement('canvas');
const ictx = img.getContext('2d');
// 透明部分の市松模様
const bg = document.createElement('canvas');
const bctx = bg.getContext('2d');
let bgKey = '';
let raf = 0;
// 絵の上に重ねて描くもの（建築ナビの行表示など）。fn(ctx, cw, ch)
const overlays = [];
export function addOverlay(fn) { overlays.push(fn); }

function rebuildImage() {
  const { W, H, data, rgbs } = st;
  if (img.width !== W || img.height !== H) { img.width = W; img.height = H; }
  const id = ictx.createImageData(W, H), d = id.data;
  for (let i = 0, n = W * H; i < n; i++) {
    const v = data[i];
    if (v) { const c = rgbs[v - 1], o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  }
  ictx.putImageData(id, 0, 0);
}

function rebuildBg(a, b) {
  bg.width = st.W; bg.height = st.H;
  bctx.fillStyle = a; bctx.fillRect(0, 0, st.W, st.H);
  bctx.fillStyle = b;
  for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) if ((x + y) & 1) bctx.fillRect(x, y, 1, 1);
}

// horizontal=false なら縦線
function drawLines(step, count, horizontal, color, offset, from, to, limit) {
  const v = st.view;
  ctx.beginPath();
  for (let i = 0; i <= count; i += step) {
    const p = (horizontal ? v.y : v.x) + i * v.s;
    if (p < -2 || p > limit + 2) continue;
    const q = Math.floor(p) + offset;
    if (horizontal) { ctx.moveTo(from, q); ctx.lineTo(to, q); } else { ctx.moveTo(q, from); ctx.lineTo(q, to); }
  }
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
}

function drawGrid(cw, ch, w, h) {
  const { view: v, W, H } = st;
  const x0 = Math.max(0, v.x), x1 = Math.min(cw, v.x + w);
  const y0 = Math.max(0, v.y), y1 = Math.min(ch, v.y + h);
  if (v.s >= 6) {
    drawLines(1, W, false, 'rgba(0,0,0,0.22)', 0.5, y0, y1, cw);
    drawLines(1, H, true, 'rgba(0,0,0,0.22)', 0.5, x0, x1, ch);
    if (v.s >= 12) {
      drawLines(1, W, false, 'rgba(255,255,255,0.16)', 1.5, y0, y1, cw);
      drawLines(1, H, true, 'rgba(255,255,255,0.16)', 1.5, x0, x1, ch);
    }
  }
  if (st.showMajor && v.s >= 2) {
    drawLines(10, W, false, 'rgba(0,0,0,0.6)', 0.5, y0, y1, cw);
    drawLines(10, H, true, 'rgba(0,0,0,0.6)', 0.5, x0, x1, ch);
    drawLines(10, W, false, 'rgba(255,255,255,0.5)', 1.5, y0, y1, cw);
    drawLines(10, H, true, 'rgba(255,255,255,0.5)', 1.5, x0, x1, ch);
  }
}

function drawHover() {
  const v = st.view, hx = v.x + st.hover.x * v.s, hy = v.y + st.hover.y * v.s, hs = v.s;
  if (hs >= 5) {
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeRect(hx + 1, hy + 1, hs - 2, hs - 2);
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.strokeRect(hx + 0.5, hy + 0.5, hs - 1, hs - 1);
  } else {
    ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.strokeRect(hx - 0.5, hy - 0.5, hs + 1, hs + 1);
  }
}

// 左右対称モードの中心線
function drawMirrorAxis(h) {
  const v = st.view, x = Math.round(v.x + (st.W / 2) * v.s) + 0.5;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath(); ctx.moveTo(x, v.y - 6); ctx.lineTo(x, v.y + h + 6); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const cw = stage.clientWidth, ch = stage.clientHeight;
  if (!cw || !ch) return;
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const cs = getComputedStyle(document.documentElement);
  const ca = cs.getPropertyValue('--check-a').trim(), cb = cs.getPropertyValue('--check-b').trim();
  const key = ca + '|' + cb + '|' + st.W + 'x' + st.H;
  if (key !== bgKey) { rebuildBg(ca, cb); bgKey = key; }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cs.getPropertyValue('--stage').trim() || '#ccc';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  const v = st.view, w = st.W * v.s, h = st.H * v.s;
  ctx.drawImage(bg, v.x, v.y, w, h);
  ctx.drawImage(img, v.x, v.y, w, h);

  if (st.showGrid) drawGrid(cw, ch, w, h);
  drawWallMarks(ctx, cw, ch);
  ctx.strokeStyle = cs.getPropertyValue('--outline').trim() || '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.floor(v.x) - 0.5, Math.floor(v.y) - 0.5, Math.round(w) + 1, Math.round(h) + 1);

  const editing = st.mode === 'edit';
  if (editing && st.mirror) drawMirrorAxis(h);
  for (const fn of overlays) fn(ctx, cw, ch);
  if (editing && st.hover && st.tool !== 'pan' && !st.spaceDown) drawHover();
}

// すぐに描き直す（fit 直後など）
export function frame() {
  if (st.dirty) { rebuildImage(); updateCounts(); st.dirty = false; }
  render();
}

// 次のフレームで描き直す
export function schedule() {
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); });
}

// 絵の中身が変わったことを知らせる
export function markDirty() { st.dirty = true; schedule(); }
