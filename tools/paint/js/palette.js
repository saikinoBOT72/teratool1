// 道具の切り替え・ペンキの一覧・下のバーの表示・集計
import { st, NPAINT, refreshRgb, paintName } from './state.js';
import { $, el } from './util.js';
import { cv, markDirty, schedule } from './render.js';
import { scheduleSave } from './works/store.js';
import { closePops } from './popups.js';

// 一覧のまとまり（値: 0 = 透過, 1〜29 = ペンキ）
const GROUPS = [
  ['透過・塗り無し', [0, 1]],
  ['普通のペンキ', range(2, 13)],
  ['濃いペンキ', range(14, 25)],
  ['茶・黒・白・灰色', range(26, 29)],
];
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

const swEls = new Map(), badgeEls = new Map();
const TOOL_NAMES = { pen: 'ペン', fill: '塗りつぶし', pick: 'スポイト', pan: '移動', line: '直線', rect: '四角', ellipse: '円' };

export function updateCursor() {
  cv.style.cursor = (st.mode === 'navi') ? 'pointer' : (st.tool === 'pan' || st.spaceDown) ? 'grab' : 'crosshair';
}

export function setTool(t) {
  st.tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  const svg = document.querySelector(`.tool[data-tool="${t}"] svg`);
  $('toolIcon').replaceChildren(svg ? svg.cloneNode(true) : '');
  $('toolName').textContent = TOOL_NAMES[t] || t;
  updateCursor();
}

export function setMirror(on) {
  st.mirror = on;
  $('btnMirror').setAttribute('aria-pressed', String(on));
  schedule(); scheduleSave();
}

function paintChip(node, v) {
  node.classList.toggle('is-clear', v === 0);
  if (v) node.style.setProperty('--c', st.hex[v - 1]);
}

export function refreshSel() {
  swEls.forEach((b, v) => b.setAttribute('aria-pressed', String(v === st.sel)));
  $('selName').textContent = paintName(st.sel);
  $('selName2').textContent = '選択中：' + paintName(st.sel);
  paintChip($('colorChip'), st.sel);
}

// 色を選んだら、描けない道具（移動・スポイト）からペンに戻す
export function setSel(v) {
  st.sel = v; refreshSel();
  if (st.tool === 'pan' || st.tool === 'pick') setTool('pen');
  scheduleSave();
}

export function buildPalette() {
  const box = $('palette');
  box.textContent = '';
  for (const [title, values] of GROUPS) {
    const g = el('div', 'pal-group');
    g.appendChild(el('h4', null, title));
    const row = el('div', 'pal-row');
    for (const v of values) {
      const b = el('button', 'sw'); b.type = 'button'; b.title = paintName(v);
      paintChip(b, v);
      const n = el('span', 'n'); b.appendChild(n);
      b.addEventListener('click', () => { setSel(v); closePops(); });
      row.appendChild(b); swEls.set(v, b); badgeEls.set(v, n);
    }
    g.appendChild(row); box.appendChild(g);
  }
  refreshSel();
}

// 見え方（ゲーム画面/全体マップ・壁・光）が変わったときに色を塗り直す
export function applyColors() {
  refreshRgb();
  swEls.forEach((b, v) => paintChip(b, v));
  refreshSel(); markDirty();
}

// ペンキごとのマス数（＝必要なペンキの数）を表示
export function updateCounts() {
  const c = new Array(NPAINT + 1).fill(0);
  for (let i = 0; i < st.data.length; i++) c[st.data[i]]++;
  let total = 0, used = 0;
  for (let v = 1; v <= NPAINT; v++) {
    badgeEls.get(v).textContent = c[v] ? String(c[v]) : '';
    swEls.get(v).setAttribute('aria-label', paintName(v) + (c[v] ? '（' + c[v] + 'マス）' : ''));
    total += c[v]; if (c[v]) used++;
  }
  $('stats').textContent = total + 'マス・' + used + '色';
}

export function updateSizeUI() {
  $('sizeLabel').textContent = st.W + ' × ' + st.H + 'マス';
  $('workName').textContent = st.workName || 'ペンキドット絵';
  document.title = (st.workName ? st.workName + ' - ' : '') + 'ペンキドット絵';
  $('inW').value = st.W; $('inH').value = st.H;
}
