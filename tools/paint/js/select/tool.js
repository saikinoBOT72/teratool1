// 選択の道具の操作: 四角・囲うはドラッグ、同じ色はタップ。
//   PC は Shift を押しながらで「足す」、Alt を押しながらで「引く」
import { sel, applySel, rectMask, lassoMask, colorMask } from './mask.js';
import { schedule } from '../render.js';

let drag = null; // { mode, op, start, cur, pts }
export const selDrag = () => drag;

function opFor(mods) {
  if (mods && mods.altKey) return 'sub';
  if (mods && mods.shiftKey) return 'add';
  return sel.op;
}

export function selBegin(c, mods) {
  const op = opFor(mods);
  if (sel.mode === 'wand' || sel.mode === 'color') {
    applySel(colorMask(c.x, c.y, sel.mode === 'wand'), op);
    schedule();
    return;
  }
  drag = { mode: sel.mode, op, start: c, cur: c, pts: [c] };
  schedule();
}

export function selMove(c) {
  if (!drag || !c) return;
  drag.cur = c;
  const last = drag.pts[drag.pts.length - 1];
  if (drag.mode === 'lasso' && (last.x !== c.x || last.y !== c.y)) drag.pts.push(c);
  schedule();
}

export function selEnd() {
  if (!drag) return;
  const d = drag;
  drag = null;
  applySel(d.mode === 'rect' ? rectMask(d.start.x, d.start.y, d.cur.x, d.cur.y) : lassoMask(d.pts), d.op);
  schedule();
}

export function selCancel() { if (drag) { drag = null; schedule(); } }
