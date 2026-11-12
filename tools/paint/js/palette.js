// 道具の切り替え・色の一覧・下のバーの表示・集計
//   色の一覧: 透過 / 最近使った色 / 壁ごと（ダイヤ以外・光オフ …）に28色ずつ。どの色も直接選ぶ
import { st, NPAINT, refreshRgb, shortName, valueName, cellValue, WALL_LABELS } from './state.js';
import { $, el } from './util.js';
import { cv, markDirty, schedule } from './render.js';
import { scheduleSave } from './works/store.js';
import { closePops } from './popups.js';
import { refreshSelPanel } from './select/panel.js';

const RECENT_MAX = 12;
const swatches = []; // { b, v, n }（n = マス数の表示）
const TOOL_NAMES = { pen: 'ペン', fill: '塗りつぶし', pick: 'スポイト', pan: '移動', line: '直線', rect: '四角', rectFill: '塗り四角', ellipse: '円', select: '選択' };

export function updateCursor() {
  cv.style.cursor = (st.mode === 'navi') ? 'pointer' : (st.tool === 'pan' || st.spaceDown) ? 'grab' : 'crosshair';
}

export function setTool(t) {
  st.tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  const svg = document.querySelector(`.tool[data-tool="${t}"] svg`);
  $('toolIcon').replaceChildren(svg ? svg.cloneNode(true) : '');
  $('toolName').textContent = TOOL_NAMES[t] || t;
  updateCursor(); refreshSelPanel();
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
  for (const s of swatches) s.b.setAttribute('aria-pressed', String(s.v === st.sel));
  $('selName').textContent = shortName(st.sel);
  $('selName2').textContent = '選択中：' + valueName(st.sel);
  paintChip($('colorChip'), st.sel);
}

// 色を選ぶ（スポイトからも）。描けない道具（移動・スポイト）からはペンに戻す
export function setSel(v) {
  st.sel = v;
  if (v) { st.recent = [v, ...st.recent.filter((x) => x !== v)].slice(0, RECENT_MAX); renderRecent(); }
  refreshSel();
  if (st.tool === 'pan' || st.tool === 'pick' || st.tool === 'select') setTool('pen');
  scheduleSave();
}
export const pickValue = setSel;

function swatch(v, withCount) {
  const b = el('button', 'sw'); b.type = 'button'; b.title = valueName(v);
  paintChip(b, v);
  const n = el('span', 'n'); if (withCount) b.appendChild(n);
  b.addEventListener('click', () => { setSel(v); closePops(); });
  const s = { b, v, n: withCount ? n : null };
  swatches.push(s);
  return b;
}

function group(title, cls) {
  const g = el('div', 'pal-group');
  g.appendChild(el('h4', null, title));
  const row = el('div', 'pal-row ' + (cls || ''));
  g.appendChild(row);
  return [g, row];
}

let recentRow = null;
function renderRecent() {
  if (!recentRow) return;
  for (let i = swatches.length - 1; i >= 0; i--) if (swatches[i].recent) swatches.splice(i, 1);
  recentRow.textContent = '';
  for (const v of st.recent) { recentRow.appendChild(swatch(v, false)); swatches[swatches.length - 1].recent = true; }
  recentRow.parentElement.hidden = !st.recent.length;
  for (const s of swatches) if (s.recent) s.b.setAttribute('aria-pressed', String(s.v === st.sel));
}

export function buildPalette() {
  const box = $('palette');
  box.textContent = ''; swatches.length = 0;
  const [g0, r0] = group('透過（何も置かない）');
  r0.appendChild(swatch(0, false));
  box.appendChild(g0);
  const [gr, rr] = group('最近使った色');
  recentRow = rr; box.appendChild(gr);
  // 壁の順: ダイヤ以外・光オフ → ダイヤ以外・光オン → ダイヤ・光オフ → ダイヤ・光オン
  for (const wall of [0, 2, 1, 3]) {
    const [g, row] = group(WALL_LABELS[wall], 'paints');
    for (let p = 1; p <= NPAINT; p++) row.appendChild(swatch(cellValue(p, wall), true));
    box.appendChild(g);
  }
  renderRecent();
  refreshSel();
}

// 見え方（ゲーム画面 / 全体マップ）が変わったときに色を塗り直す
export function applyColors() {
  refreshRgb();
  for (const s of swatches) paintChip(s.b, s.v);
  refreshSel(); markDirty();
}

// 色ごとのマス数（＝必要なペンキの数）を表示
export function updateCounts() {
  const c = new Map();
  for (let i = 0; i < st.data.length; i++) { const v = st.data[i]; if (v) c.set(v, (c.get(v) || 0) + 1); }
  let total = 0;
  c.forEach((n) => { total += n; });
  for (const s of swatches) {
    if (!s.n) continue;
    const n = c.get(s.v) || 0;
    s.n.textContent = n ? String(n) : '';
    s.b.setAttribute('aria-label', valueName(s.v) + (n ? '（' + n + 'マス）' : ''));
  }
  $('stats').textContent = total + 'マス・' + c.size + '色';
}

export function updateSizeUI() {
  $('sizeLabel').textContent = st.W + ' × ' + st.H + 'マス';
  $('workName').textContent = st.workName || 'ペンキドット絵';
  document.title = (st.workName ? st.workName + ' - ' : '') + 'ペンキドット絵';
  $('inW').value = st.W; $('inH').value = st.H;
}
