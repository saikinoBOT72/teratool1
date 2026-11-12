// ペンキドット絵 — 16色のペンキでドット絵を描くツール。
// すべてブラウザ内で動作し、外部への通信は行わない。
import { st, refreshRgb } from './state.js';
import { $ } from './util.js';
import { stage, schedule } from './render.js';
import { fit, zoomCenter, toggleGrid } from './view.js';
import { boot, save } from './works/store.js';
import { undo, redo, updateHist } from './history.js';
import { buildPalette, setTool, setMirror, updateSizeUI } from './palette.js';
import { initPops, closePops } from './popups.js';
import { buildColorControls } from './colorset.js';
import { onColorsChanged } from './colors-changed.js';
import { initInput } from './input.js';
import { initMenu } from './menu.js';
import { initNavi } from './navi/navi.js';
import { initWorks } from './works/sheet.js';
import { initImporter } from './import/index.js';

boot();
refreshRgb();
buildPalette();
buildColorControls($('colorControls'), onColorsChanged);
$('btnGrid').setAttribute('aria-pressed', String(st.showGrid));
$('chkMajor').checked = st.showMajor;
$('btnMirror').setAttribute('aria-pressed', String(st.mirror));
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
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => { setTool(b.dataset.tool); closePops(); }));
$('btnMirror').addEventListener('click', () => setMirror(!st.mirror));

initPops();
initInput();
initMenu();
initNavi();
initWorks();
initImporter();

// テーマ（ライト/ダーク）が変わったら描き直す
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule); } catch (_) { /* old browsers */ }
new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

new ResizeObserver(() => { if (st.autoFit) fit(); else schedule(); }).observe(stage);
requestAnimationFrame(fit);
