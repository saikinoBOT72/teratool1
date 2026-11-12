// メニュー（作品・サイズ変更・全消去・PNG書き出し・表示設定・色の見え方）
import { st, MAX } from './state.js';
import { $, clamp, toast, download } from './util.js';
import { img, schedule } from './render.js';
import { snapshot, pushUndo, afterData } from './history.js';
import { updateSizeUI } from './palette.js';
import { buildColorControls } from './colorset.js';
import { onColorsChanged } from './colors-changed.js';
import { scheduleSave } from './works/store.js';
import { openSheet, closeSheet, wireSheet } from './sheet.js';
import { refreshNavi } from './navi/navi.js';
import { openWorks } from './works/sheet.js';
import { openImport } from './import/index.js';

// 右と下を広げる／切る
function resizeTo(nw, nh) {
  nw = clamp(Math.round(nw) || 0, 1, MAX); nh = clamp(Math.round(nh) || 0, 1, MAX);
  if (nw === st.W && nh === st.H) { updateSizeUI(); return; }
  pushUndo(snapshot());
  const nd = new Uint8Array(nw * nh);
  for (let y = 0; y < Math.min(st.H, nh); y++) {
    for (let x = 0; x < Math.min(st.W, nw); x++) nd[y * nw + x] = st.data[y * st.W + x];
  }
  st.W = nw; st.H = nh; st.data = nd;
  afterData(true); refreshNavi();
  toast(st.W + ' × ' + st.H + 'マスにしました');
}

function exportPng() {
  const sc = +$('exportScale').value || 1;
  const c = document.createElement('canvas');
  c.width = st.W * sc; c.height = st.H * sc;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0, c.width, c.height);
  c.toBlob((blob) => {
    if (!blob) { toast('書き出しに失敗しました'); return; }
    const base = (st.workName || 'paint').replace(/[\\/:*?"<>|]/g, '_');
    const url = download(blob, `${base}-${st.W}x${st.H}${sc > 1 ? '-x' + sc : ''}.png`);
    // ダウンロードできない環境向けに、長押し保存用の画像も出しておく
    $('exportImg').src = url;
    $('exportFallback').hidden = false;
    toast('PNGを書き出しました');
  }, 'image/png');
}

export function initMenu() {
  const menu = $('menuSheet');
  wireSheet(menu);
  $('btnMenu').addEventListener('click', () => openSheet(menu));
  $('menuWorks').addEventListener('click', openWorks);
  $('menuImport').addEventListener('click', openImport);

  $('presets').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) resizeTo(+b.dataset.n, +b.dataset.n);
  });
  $('btnResize').addEventListener('click', () => resizeTo(+$('inW').value, +$('inH').value));
  $('btnClear').addEventListener('click', () => {
    pushUndo(snapshot()); st.data = new Uint8Array(st.W * st.H); afterData(false);
    closeSheet(); toast('全部消しました（元に戻せます）');
  });
  $('chkMajor').addEventListener('change', () => { st.showMajor = $('chkMajor').checked; schedule(); scheduleSave(); });
  $('chkWall').addEventListener('change', () => setShowWall($('chkWall').checked));
  buildColorControls($('menuColorControls'), onColorsChanged);
  $('btnExport').addEventListener('click', exportPng);
}

// キャンバスの壁の印（◆ ON/OFF）の表示切り替え（メニューと D キー）
export function setShowWall(on) {
  st.showWall = on; $('chkWall').checked = on;
  $('btnWall').setAttribute('aria-pressed', String(on));
  schedule(); scheduleSave();
}
