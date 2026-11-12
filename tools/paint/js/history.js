// 元に戻す / やり直し
import { st } from './state.js';
import { $ } from './util.js';
import { cancelStroke } from './draw.js';
import { markDirty } from './render.js';
import { fit } from './view.js';
import { updateSizeUI } from './palette.js';
import { scheduleSave } from './works/store.js';

const LIMIT = 80;
const undoStack = [], redoStack = [];

export function snapshot() { return { w: st.W, h: st.H, d: st.data.slice() }; }

export function pushUndo(s) {
  undoStack.push(s);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateHist();
}

// 作品を切り替えたときなど
export function clearHistory() { undoStack.length = 0; redoStack.length = 0; updateHist(); }

// 絵の中身が変わった後の共通処理
export function afterData(sizeChanged) {
  updateSizeUI();
  if (sizeChanged) { st.autoFit = true; fit(); }
  markDirty();
  scheduleSave();
}

function applySnap(s) {
  const sizeChanged = s.w !== st.W || s.h !== st.H;
  st.W = s.w; st.H = s.h; st.data = s.d;
  afterData(sizeChanged);
}

export function undo() {
  if (!undoStack.length) return;
  cancelStroke();
  redoStack.push(snapshot()); applySnap(undoStack.pop()); updateHist();
}

export function redo() {
  if (!redoStack.length) return;
  cancelStroke();
  undoStack.push(snapshot()); applySnap(redoStack.pop()); updateHist();
}

export function updateHist() {
  $('btnUndo').disabled = !undoStack.length;
  $('btnRedo').disabled = !redoStack.length;
}
