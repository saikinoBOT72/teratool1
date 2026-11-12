// 道具の切り替え・ペンキの一覧・下のバーの表示・集計
import { st, NPAINT, refreshRgb, paintName, shortName, brushValue, cellValue, wallIndex, paintOf, wallOf } from './state.js';
import { WALLS as WALL_DEFS } from './paints.js';
import { syncColorControls } from './colorset.js';
import { $, el } from './util.js';
import { cv, markDirty, schedule } from './render.js';
import { scheduleSave } from './works/store.js';
import { closePops } from './popups.js';

// 一覧のまとまり（ペンキ番号: 0 = 透過, 1〜29）。色は「これから塗る壁」のもの
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

// p = ペンキ番号（0 = 透過）。今の「塗る壁」の色で見せる
function paintChip(node, p) {
  node.classList.toggle('is-clear', p === 0);
  if (p) node.style.setProperty('--c', st.hex[cellValue(p, wallIndex()) - 1]);
}

export function refreshSel() {
  swEls.forEach((b, p) => b.setAttribute('aria-pressed', String(p === st.sel)));
  $('selName').textContent = shortName(brushValue());
  $('selName2').textContent = '選択中：' + shortName(brushValue());
  paintChip($('colorChip'), st.sel);
}

// スポイト: マスの値から、ペンキと壁の両方を選ぶ
export function pickValue(v) {
  if (v) {
    const w = WALL_DEFS[wallOf(v)];
    st.gem = w.gem; st.lit = w.lit;
    syncColorControls(); applyColors();
  }
  setSel(paintOf(v));
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
  swEls.forEach((b, p) => paintChip(b, p));
  refreshSel(); markDirty(); // マス数の表示も「塗る壁」に合わせて更新される
}

// マス数（＝必要なペンキの数）。一覧の数字は、今の「塗る壁」でのそのペンキのマス数
export function updateCounts() {
  const c = new Map();
  for (let i = 0; i < st.data.length; i++) { const v = st.data[i]; if (v) c.set(v, (c.get(v) || 0) + 1); }
  let total = 0;
  c.forEach((n) => { total += n; });
  const wall = wallIndex();
  for (let p = 1; p <= NPAINT; p++) {
    const n = c.get(cellValue(p, wall)) || 0;
    badgeEls.get(p).textContent = n ? String(n) : '';
    swEls.get(p).setAttribute('aria-label', paintName(p) + (n ? '（' + n + 'マス）' : ''));
  }
  $('stats').textContent = total + 'マス・' + c.size + '種類';
}

export function updateSizeUI() {
  $('sizeLabel').textContent = st.W + ' × ' + st.H + 'マス';
  $('workName').textContent = st.workName || 'ペンキドット絵';
  document.title = (st.workName ? st.workName + ' - ' : '') + 'ペンキドット絵';
  $('inW').value = st.W; $('inH').value = st.H;
}
