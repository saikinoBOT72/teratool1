// マウス・タッチ・ペン・キーボードの操作
import { st, MIN_SCALE, MAX_SCALE } from './state.js';
import { clamp } from './util.js';
import { cv, schedule } from './render.js';
import { zoomAt, zoomCenter, stepUp, stepDown, panBy, updateReadout, toggleGrid } from './view.js';
import { cellAt, beginAction, continueStroke, endStroke, cancelStroke } from './draw.js';
import { setTool, setMirror, updateCursor } from './palette.js';
import { undo, redo } from './history.js';
import { sheetOpen, closeSheet } from './sheet.js';
import { enterNavi, exitNavi, selectRow, step, toggleDone } from './navi/navi.js';

const pointers = new Map();
let mode = null;   // 'draw' | 'pan' | 'gesture' | 'none' | null
let gest = null;   // 2本指の拡大縮小
let panLast = null;

function local(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function startGesture() {
  const [a, b] = Array.from(pointers.values());
  const v = st.view, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  gest = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), s0: v.s, cx: (m.x - v.x) / v.s, cy: (m.y - v.y) / v.s, m };
  mode = 'gesture';
}

function doGesture() {
  const pts = Array.from(pointers.values());
  if (pts.length < 2 || !gest) return;
  const [a, b] = pts, v = st.view;
  const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const ns = clamp(gest.s0 * d / gest.d0, MIN_SCALE, MAX_SCALE);
  v.s = ns; v.x = m.x - gest.cx * ns; v.y = m.y - gest.cy * ns;
  gest.m = m; st.autoFit = false; schedule(); updateReadout();
}

function startPan(p) { mode = 'pan'; panLast = p; cv.style.cursor = 'grabbing'; }

function onDown(e) {
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const p = local(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2) { cancelStroke(); startGesture(); return; }
  if (pointers.size > 2) return;
  const mouse = e.pointerType === 'mouse';
  if (mouse && (e.button === 1 || e.button === 2)) { startPan(p); return; } // 中・右ボタンで移動
  if (mouse && e.button !== 0) return;
  if (st.spaceDown || (st.tool === 'pan' && st.mode === 'edit')) { startPan(p); return; }
  if (st.mode === 'navi') { mode = 'navi'; selectRow(cellAt(p.x, p.y)); return; }
  mode = 'draw'; beginAction(p);
}

function onMove(e) {
  const p = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  const c = cellAt(p.x, p.y);
  if (e.pointerType === 'mouse' && st.mode === 'edit') { st.hover = c; schedule(); }
  if (c) { st.lastCell = c; updateReadout(); }
  if (mode === 'gesture') doGesture();
  else if (mode === 'pan' && panLast) { panBy(p.x - panLast.x, p.y - panLast.y); panLast = p; }
  else if (mode === 'draw') continueStroke(p);
  else if (mode === 'navi' && c && c.y !== st.navRow) selectRow(c); // なぞって行を選ぶ
}

function onUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (mode === 'draw') endStroke();
  else if (mode === 'pan') { mode = null; panLast = null; updateCursor(); }
  else if (mode === 'gesture' && pointers.size < 2) {
    mode = 'none';
    // 拡大縮小を終えたら倍率を整数に寄せてマスをくっきりさせる
    if (gest && st.view.s >= 3) zoomAt(gest.m.x, gest.m.y, Math.round(st.view.s));
    gest = null;
  }
  if (pointers.size === 0) mode = null;
  if (e.pointerType !== 'mouse') st.hover = null;
  schedule();
}

const KEY_TOOLS = { b: 'pen', e: 'eraser', f: 'fill', i: 'pick', h: 'pan', l: 'line', r: 'rect', o: 'ellipse' };

// 建築ナビ中のキー: ↑↓ で行を移動、Enter で完了、N で編集に戻る
function naviKey(e, k) {
  if (k === 'arrowup' || k === 'arrowdown') {
    e.preventDefault();
    step((k === 'arrowup') === st.naviFromBottom ? 1 : -1);
  } else if (k === 'enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); toggleDone(); }
  else if (k === 'n') exitNavi();
  else if (k === 'g') toggleGrid();
  else if (k === '+' || k === '=') zoomCenter(1);
  else if (k === '-') zoomCenter(-1);
}

function onKeyDown(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key === 'Escape') { closeSheet(); return; }
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod || e.altKey || sheetOpen()) return;
  if (k === ' ' && tag !== 'BUTTON') { e.preventDefault(); st.spaceDown = true; updateCursor(); return; }
  if (st.mode === 'navi') { naviKey(e, k); return; }
  if (KEY_TOOLS[k]) setTool(KEY_TOOLS[k]);
  else if (k === 'm') setMirror(!st.mirror);
  else if (k === 'n') enterNavi();
  else if (k === 'g') toggleGrid();
  else if (k === '+' || k === '=') zoomCenter(1);
  else if (k === '-') zoomCenter(-1);
}

export function initInput() {
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { st.hover = null; schedule(); } });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, e.deltaY < 0 ? stepUp(st.view.s) : stepDown(st.view.s));
  }, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { st.spaceDown = false; updateCursor(); schedule(); } });
}
