// 選択の操作パネル（下のバーの上）。選択の道具のときは全部、ほかの道具で選択中なら「選択中○マス・解除」の1行だけ
import { st } from '../state.js';
import { $ } from '../util.js';
import { markDirty, schedule, addOverlay } from '../render.js';
import { snapshot, pushUndo } from '../history.js';
import { scheduleSave } from '../works/store.js';
import { sel, hasSel, clearSel, applySel, invertSel, allMask, drawnMask, onSelChange } from './mask.js';
import { selOverlay } from './overlay.js';

// 選択したマスを v で塗る（0 = 消す）
export function fillSel(v) {
  if (!hasSel()) return;
  const snap = snapshot();
  let changed = false;
  for (let i = 0; i < st.data.length; i++) {
    if (sel.mask[i] && st.data[i] !== v) { st.data[i] = v; changed = true; }
  }
  if (changed) { pushUndo(snap); markDirty(); scheduleSave(); }
}

export const selectAll = () => applySel(allMask(), 'new');
export { clearSel, invertSel };

let lastH = -1;
export function refreshSelPanel() {
  const on = hasSel(), full = st.tool === 'select';
  $('selPanel').hidden = st.mode !== 'edit' || (!full && !on);
  $('selFull').hidden = !full;
  $('selInfo').textContent = on ? `選択中 ${sel.count}マス` : '選択なし';
  $('selInfo').title = on ? '選択したマスの中だけに描けます' : '';
  $('selClear').disabled = !on;
  $('selFill').disabled = !on; $('selErase').disabled = !on;
  for (const b of document.querySelectorAll('#selModes [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === sel.mode));
  for (const b of document.querySelectorAll('#selOps [data-op]')) b.setAttribute('aria-pressed', String(b.dataset.op === sel.op));
  // パネルの高さが変わったらキャンバスの表示を合わせる（ResizeObserver が拾う）
  const h = $('selPanel').hidden ? 0 : $('selPanel').offsetHeight;
  if (h !== lastH) { lastH = h; schedule(); }
}

export function initSelect() {
  addOverlay(selOverlay);
  onSelChange(() => { refreshSelPanel(); schedule(); });
  $('selModes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) { sel.mode = b.dataset.mode; refreshSelPanel(); }
  });
  $('selOps').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]');
    if (b) { sel.op = b.dataset.op; refreshSelPanel(); }
  });
  $('selAll').addEventListener('click', selectAll);
  $('selDrawn').addEventListener('click', () => applySel(drawnMask(), sel.op));
  $('selInvert').addEventListener('click', invertSel);
  $('selClear').addEventListener('click', clearSel);
  $('selFill').addEventListener('click', () => fillSel(st.sel));
  $('selErase').addEventListener('click', () => fillSel(0));
  refreshSelPanel();
}
