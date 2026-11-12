// 取り込み時の編集（背景・色・使う色のオプション・仕上げ）の操作と、その設定値
// 使う色は基本は全部（28色 × 壁4種）。オプションで壁の種類・ペンキをしぼれる
import { st, NPAINT, NWALL, paintName, shortName, valueName, cellValue, WALL_LABELS } from '../state.js';
import { $, el } from '../util.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const OTHERS = range(25, 28); // 茶・黒・白・灰色
const PRESETS = {
  all: range(1, NPAINT),
  normal: [...range(1, 12), ...OTHERS],
  deep: [...range(13, 24), ...OTHERS],
};
const WALL_ORDER = [0, 2, 1, 3];
const SLIDERS = ['impBright', 'impContrast', 'impSat', 'impHue'];
const ui = { allowed: new Set(PRESETS.all), walls: new Set(range(0, NWALL - 1)), clear: new Set(), flipH: false, flipV: false, rot: 0 };
let onChange = () => {};

export function getOptions(photo) {
  return {
    bg: $('impBg').checked, trim: $('impTrim').checked, dither: photo && $('impDither').checked,
    bright: +$('impBright').value, contrast: +$('impContrast').value, sat: +$('impSat').value, hue: +$('impHue').value,
    allowed: [...ui.allowed].sort((a, b) => a - b),
    walls: [...ui.walls].sort((a, b) => a - b),
    clear: ui.clear, despeckle: $('impSpeck').checked, outline: +$('impOutline').value,
    flipH: ui.flipH, flipV: ui.flipV, rot: ui.rot,
  };
}

// 新しい画像を読んだら、画像ごとの設定（透明にした色・反転・回転）だけ戻す
export function resetForNewImage() {
  ui.clear.clear(); ui.flipH = ui.flipV = false; ui.rot = 0;
  renderClear(); renderTransform();
}

// v = マスの値（色は st.hex[v - 1]）
function chipOf(v, label) {
  const b = el('button', 'chip pchip'); b.type = 'button';
  const c = el('i', 'chip-c'); c.style.setProperty('--c', st.hex[v - 1]); b.appendChild(c);
  b.appendChild(document.createTextNode(label));
  return b;
}

// 結果の絵をタップした色を透明にする（もう一度タップ、または一覧の × で戻す）
export function toggleClear(v) {
  if (!v) return;
  if (ui.clear.has(v)) ui.clear.delete(v); else ui.clear.add(v);
  renderClear(); onChange();
}
function renderClear() {
  const box = $('impClearList');
  box.textContent = '';
  for (const v of ui.clear) {
    const b = chipOf(v, shortName(v) + ' を透明に ×');
    b.addEventListener('click', () => toggleClear(v));
    box.appendChild(b);
  }
}

function renderAllowed() {
  const box = $('impAllowed');
  box.textContent = '';
  const showWall = Math.min(...ui.walls);
  for (let p = 1; p <= NPAINT; p++) {
    const b = chipOf(cellValue(p, showWall), paintName(p));
    b.setAttribute('aria-pressed', String(ui.allowed.has(p)));
    b.addEventListener('click', () => {
      if (ui.allowed.has(p)) { if (ui.allowed.size > 1) ui.allowed.delete(p); } else ui.allowed.add(p);
      renderAllowed(); onChange();
    });
    box.appendChild(b);
  }
  const n = ui.allowed.size * ui.walls.size;
  $('impAllowedCount').textContent = n === NPAINT * NWALL ? `全部 ${n}色` : `${n}色`;
}

function renderWalls() {
  const box = $('impWalls');
  box.textContent = '';
  for (const w of WALL_ORDER) {
    const b = chipOf(cellValue(13, w), WALL_LABELS[w]); // 見本は濃い赤
    b.setAttribute('aria-pressed', String(ui.walls.has(w)));
    b.addEventListener('click', () => {
      if (ui.walls.has(w)) { if (ui.walls.size > 1) ui.walls.delete(w); } else ui.walls.add(w);
      renderWalls(); renderAllowed(); onChange();
    });
    box.appendChild(b);
  }
}

function renderTransform() {
  $('impFlipH').setAttribute('aria-pressed', String(ui.flipH));
  $('impFlipV').setAttribute('aria-pressed', String(ui.flipV));
  $('impRot').textContent = ui.rot ? `右に回す（${ui.rot * 90}°）` : '右に回す';
}

// 見え方（ゲーム画面 / 全体マップ）が変わったときに見本の色を合わせる
export function refreshAdjustColors() { renderWalls(); renderAllowed(); renderClear(); }

export function initAdjust(cb) {
  onChange = cb;
  for (const id of SLIDERS) {
    $(id).addEventListener('input', () => { $(id + 'V').textContent = $(id).value; onChange(); });
  }
  $('impColorReset').addEventListener('click', () => {
    for (const id of SLIDERS) { $(id).value = 0; $(id + 'V').textContent = '0'; }
    onChange();
  });
  $('impPresets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    ui.allowed = new Set(PRESETS[b.dataset.preset]); renderAllowed(); onChange();
  });
  const sel = $('impOutline');
  for (const w of WALL_ORDER) {
    const g = el('optgroup'); g.label = WALL_LABELS[w];
    for (let p = 1; p <= NPAINT; p++) { const o = el('option', null, valueName(cellValue(p, w))); o.value = cellValue(p, w); g.appendChild(o); }
    sel.appendChild(g);
  }
  ['impBg', 'impTrim', 'impSpeck', 'impOutline'].forEach((id) => $(id).addEventListener('change', onChange));
  $('impFlipH').addEventListener('click', () => { ui.flipH = !ui.flipH; renderTransform(); onChange(); });
  $('impFlipV').addEventListener('click', () => { ui.flipV = !ui.flipV; renderTransform(); onChange(); });
  $('impRot').addEventListener('click', () => { ui.rot = (ui.rot + 1) & 3; renderTransform(); onChange(); });
  renderWalls(); renderAllowed(); renderTransform();
}
