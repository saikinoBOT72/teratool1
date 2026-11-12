// ペンキドット絵 — 16色のペンキでドット絵を描くツール。
// すべてブラウザ内で動作し、外部への通信は行わない。
import { st, refreshRgb } from './state.js';
import { $ } from './util.js';
import { stage, schedule } from './render.js';
import { fit, zoomCenter, toggleGrid } from './view.js';
import { loadSaved, loadSample, save } from './storage.js';
import { undo, redo, updateHist } from './history.js';
import { buildPalette, buildPalEditor, setTool, updateSizeUI } from './palette.js';
import { initInput } from './input.js';
import { initMenu } from './menu.js';
import { initImporter } from './importer.js';

if (!loadSaved()) loadSample();
refreshRgb();
buildPalette();
buildPalEditor();
$('btnGrid').setAttribute('aria-pressed', String(st.showGrid));
$('chkMajor').checked = st.showMajor;
setTool('pen');
updateSizeUI();
updateHist();

// 上部バー・ズーム・道具ボタン
$('btnGrid').addEventListener('click', toggleGrid);
$('btnUndo').addEventListener('click', undo);
$('btnRedo').addEventListener('click', redo);
$('zIn').addEventListener('click', () => zoomCenter(1));
$('zOut').addEventListener('click', () => zoomCenter(-1));
$('zFit').addEventListener('click', () => { st.autoFit = true; fit(); });
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

initInput();
initMenu();
initImporter();

// テーマ（ライト/ダーク）が変わったら描き直す
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule); } catch (_) { /* old browsers */ }
new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.addEventListener('pagehide', save);

new ResizeObserver(() => { if (st.autoFit) fit(); else schedule(); }).observe(stage);
requestAnimationFrame(fit);
