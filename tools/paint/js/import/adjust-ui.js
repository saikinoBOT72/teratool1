// 取り込み時の編集（背景・色・使うペンキ・仕上げ）の操作と、その設定値
import { st, NPAINT, paintName } from '../state.js';
import { $, el } from '../util.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const OTHERS = range(26, 29); // 茶・黒・白・灰色
const PRESETS = {
  standard: range(2, 29),            // 塗り無し以外（ダイヤ以外の壁では、塗り無しは青と同じ色になるため）
  all: range(1, 29),
  normal: [...range(2, 13), ...OTHERS],
  deep: [...range(14, 25), ...OTHERS],
};
const SLIDERS = ['impBright', 'impContrast', 'impSat', 'impHue'];
const ui = { allowed: new Set(PRESETS.standard), clear: new Set(), flipH: false, flipV: false, rot: 0 };
let onChange = () => {};

export function getOptions(photo) {
  return {
    bg: $('impBg').checked, trim: $('impTrim').checked, dither: photo && $('impDither').checked,
    bright: +$('impBright').value, contrast: +$('impContrast').value, sat: +$('impSat').value, hue: +$('impHue').value,
    allowed: [...ui.allowed].sort((a, b) => a - b),
    clear: ui.clear, despeckle: $('impSpeck').checked, outline: +$('impOutline').value,
    flipH: ui.flipH, flipV: ui.flipV, rot: ui.rot,
  };
}

// 新しい画像を読んだら、画像ごとの設定（透明にした色・反転・回転）だけ戻す
export function resetForNewImage() {
  ui.clear.clear(); ui.flipH = ui.flipV = false; ui.rot = 0;
  renderClear(); renderTransform();
}

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
    const b = chipOf(v, paintName(v) + ' を透明に ×');
    b.addEventListener('click', () => toggleClear(v));
    box.appendChild(b);
  }
}

function renderAllowed() {
  const box = $('impAllowed');
  box.textContent = '';
  for (let v = 1; v <= NPAINT; v++) {
    const b = chipOf(v, paintName(v));
    b.setAttribute('aria-pressed', String(ui.allowed.has(v)));
    b.addEventListener('click', () => {
      if (ui.allowed.has(v)) { if (ui.allowed.size > 1) ui.allowed.delete(v); } else ui.allowed.add(v);
      renderAllowed(); onChange();
    });
    box.appendChild(b);
  }
  $('impAllowedCount').textContent = `${ui.allowed.size}/${NPAINT}色`;
}

function renderTransform() {
  $('impFlipH').setAttribute('aria-pressed', String(ui.flipH));
  $('impFlipV').setAttribute('aria-pressed', String(ui.flipV));
  $('impRot').textContent = ui.rot ? `右に回す（${ui.rot * 90}°）` : '右に回す';
}

// 色の見え方（ゲーム画面/全体マップ等）が変わったときに見本の色を合わせる
export function refreshAdjustColors() { renderAllowed(); renderClear(); }

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
  for (let v = 1; v <= NPAINT; v++) { const o = el('option', null, paintName(v)); o.value = v; sel.appendChild(o); }
  ['impBg', 'impTrim', 'impSpeck', 'impOutline'].forEach((id) => $(id).addEventListener('change', onChange));
  $('impFlipH').addEventListener('click', () => { ui.flipH = !ui.flipH; renderTransform(); onChange(); });
  $('impFlipV').addEventListener('click', () => { ui.flipV = !ui.flipV; renderTransform(); onChange(); });
  $('impRot').addEventListener('click', () => { ui.rot = (ui.rot + 1) & 3; renderTransform(); onChange(); });
  renderAllowed(); renderTransform();
}
