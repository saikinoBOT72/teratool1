// 道具の切り替え・ペンキのパレット・色の調整・状態表示
import { st, DEFAULTS, refreshRgb } from './state.js';
import { $ } from './util.js';
import { cv, markDirty, schedule } from './render.js';
import { scheduleSave } from './works/store.js';

const palEl = $('palette');
let swEls = [], badgeEls = [], palInputs = [];

export function updateCursor() {
  cv.style.cursor = (st.mode === 'navi') ? 'pointer' : (st.tool === 'pan' || st.spaceDown) ? 'grab' : 'crosshair';
}

export function setTool(t) {
  st.tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  updateCursor();
}

export function setMirror(on) {
  st.mirror = on;
  $('btnMirror').setAttribute('aria-pressed', String(on));
  schedule(); scheduleSave();
}

export function refreshSel() {
  swEls.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === st.sel)));
  $('selName').textContent = '選択中：' + DEFAULTS[st.sel - 1][0];
}

// 色を選んだら、描けない道具（消しゴム等）からペンに戻す
export function setSel(v) {
  st.sel = v; refreshSel();
  if (st.tool === 'eraser' || st.tool === 'pan' || st.tool === 'pick') setTool('pen');
  scheduleSave();
}

export function buildPalette() {
  palEl.innerHTML = ''; swEls = []; badgeEls = [];
  DEFAULTS.forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw'; b.title = d[0];
    b.style.setProperty('--c', st.pal[i]);
    const n = document.createElement('span'); n.className = 'n'; b.appendChild(n);
    b.addEventListener('click', () => setSel(i + 1));
    palEl.appendChild(b); swEls.push(b); badgeEls.push(n);
  });
  refreshSel();
}

export function buildPalEditor() {
  const box = $('palEdit'); box.innerHTML = ''; palInputs = [];
  DEFAULTS.forEach((d, i) => {
    const lab = document.createElement('label');
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = st.pal[i]; inp.id = 'pc' + i;
    inp.addEventListener('input', () => {
      st.pal[i] = inp.value; refreshRgb(); swEls[i].style.setProperty('--c', st.pal[i]);
      markDirty(); scheduleSave();
    });
    const sp = document.createElement('span'); sp.textContent = d[0];
    lab.appendChild(inp); lab.appendChild(sp); box.appendChild(lab); palInputs.push(inp);
  });
}

// 色の調整を反映し直す（初期化・バックアップからの復元時）
export function syncPalette() {
  refreshRgb();
  swEls.forEach((b, i) => b.style.setProperty('--c', st.pal[i]));
  palInputs.forEach((inp, i) => { inp.value = st.pal[i]; });
  markDirty(); scheduleSave();
}

export function resetPalette() {
  st.pal = DEFAULTS.map((d) => d[1]);
  syncPalette();
}

// 色ごとのマス数（＝必要なペンキの数）を表示
export function updateCounts() {
  const c = new Array(16).fill(0);
  for (let i = 0; i < st.data.length; i++) { const v = st.data[i]; if (v) c[v - 1]++; }
  let total = 0, used = 0;
  for (let i = 0; i < 16; i++) {
    badgeEls[i].textContent = c[i] ? String(c[i]) : '';
    swEls[i].setAttribute('aria-label', DEFAULTS[i][0] + (c[i] ? '（' + c[i] + 'マス）' : ''));
    total += c[i]; if (c[i]) used++;
  }
  $('stats').textContent = total + 'マス・' + used + '色';
}

export function updateSizeUI() {
  $('sizeLabel').textContent = st.W + ' × ' + st.H + 'マス';
  $('workName').textContent = st.workName || 'ペンキドット絵';
  document.title = (st.workName ? st.workName + ' - ' : '') + 'ペンキドット絵';
  $('inW').value = st.W; $('inH').value = st.H;
}
