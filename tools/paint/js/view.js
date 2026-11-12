// 表示位置・拡大縮小
import { st, MIN_SCALE, MAX_SCALE } from './state.js';
import { $, clamp } from './util.js';
import { stage, frame, schedule } from './render.js';
import { scheduleSave } from './works/store.js';

export function updateReadout() {
  let t = '';
  if (st.lastCell) t += 'x ' + (st.lastCell.x + 1) + ' ・ y ' + (st.lastCell.y + 1) + ' ・ ';
  t += '×' + (Math.round(st.view.s * 10) / 10);
  $('readout').textContent = t;
}

// 全体が収まるように表示する
// 下の拡大縮小ボタンに重ならないよう、下側は広めに空ける
export function fit() {
  const cw = stage.clientWidth, ch = stage.clientHeight, pad = 14, padBottom = 58;
  if (!cw || !ch) return;
  let s = Math.min((cw - pad * 2) / st.W, (ch - pad - padBottom) / st.H);
  s = s >= 1 ? Math.floor(s) : Math.max(MIN_SCALE, s);
  s = clamp(s, MIN_SCALE, MAX_SCALE);
  st.view.s = s;
  st.view.x = Math.round((cw - st.W * s) / 2);
  st.view.y = Math.round(pad + (ch - pad - padBottom - st.H * s) / 2);
  frame(); updateReadout();
}

// 画面上の点 (px, py) を中心に倍率 ns へ
export function zoomAt(px, py, ns) {
  const v = st.view;
  ns = clamp(ns, MIN_SCALE, MAX_SCALE);
  const cx = (px - v.x) / v.s, cy = (py - v.y) / v.s;
  v.s = ns;
  v.x = Math.round(px - cx * ns); v.y = Math.round(py - cy * ns);
  st.autoFit = false; schedule(); updateReadout();
}

export function stepUp(s) { return s < 4 ? s * 1.25 : Math.max(Math.round(s * 1.2), Math.floor(s) + 1); }
export function stepDown(s) { return s <= 4 ? s / 1.25 : Math.min(Math.round(s / 1.2), Math.ceil(s) - 1); }

export function zoomCenter(dir) {
  zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, dir > 0 ? stepUp(st.view.s) : stepDown(st.view.s));
}

export function panBy(dx, dy) {
  st.view.x += dx; st.view.y += dy; st.autoFit = false; schedule();
}

export function toggleGrid() {
  st.showGrid = !st.showGrid;
  $('btnGrid').setAttribute('aria-pressed', String(st.showGrid));
  schedule(); scheduleSave();
}
