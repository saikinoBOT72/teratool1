// メニュー（サイズ変更・全消去・表示設定・色の調整・PNG書き出し）
import { st, MAX } from './state.js';
import { $, clamp, toast } from './util.js';
import { img, schedule } from './render.js';
import { snapshot, pushUndo, afterData } from './history.js';
import { updateSizeUI, resetPalette } from './palette.js';
import { scheduleSave } from './storage.js';

const scrim = $('scrim');
let lastFocus = null;

export function sheetOpen() { return !scrim.hidden; }
export function openSheet() { lastFocus = document.activeElement; scrim.hidden = false; $('btnClose').focus(); }
export function closeSheet() {
  if (scrim.hidden) return;
  scrim.hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

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
  afterData(true);
  toast(st.W + ' × ' + st.H + 'マスにしました');
}

let exportUrl = null;
function download(blob, name) {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  exportUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = exportUrl; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  // ダウンロードできない環境向けに、長押し保存用の画像も出しておく
  $('exportImg').src = exportUrl;
  $('exportFallback').hidden = false;
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
    download(blob, 'paint-' + st.W + 'x' + st.H + (sc > 1 ? '-x' + sc : '') + '.png');
    toast('PNGを書き出しました');
  }, 'image/png');
}

export function initMenu() {
  $('btnMenu').addEventListener('click', openSheet);
  $('btnClose').addEventListener('click', closeSheet);
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) closeSheet(); });

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
  $('btnPalReset').addEventListener('click', () => { resetPalette(); toast('色を初期値に戻しました'); });
  $('btnExport').addEventListener('click', exportPng);
}
