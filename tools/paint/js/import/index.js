// 画像の取り込み（シートの操作と処理の流れ）
//   画像 → 範囲 → マス目（自動検出 or 手動）→ マスの色 → 背景除去・余白詰め・色の調整 → 16色
import { st } from '../state.js';
import { $, toast } from '../util.js';
import { makeSheet, openSheet, closeSheet } from '../sheet.js';
import { snapshot, pushUndo, afterData } from '../history.js';
import { refreshNavi } from '../navi/navi.js';
import { createWork, nextName } from '../works/store.js';
import { openWork } from '../works/sheet.js';
import { IMPORT_BODY } from './markup.js';
import { createSourceView } from './source-view.js';
import { detectGrid, gridForCell } from './grid.js';
import { sampleGrid, resampleArea } from './cells.js';
import { convertCells } from './convert.js';

const LIMIT = 2048; // 解析する画像の長辺の上限（px）
let sheet, view;
let src = null, crop = null, det = null, manual = 0, cells = null, result = null, baseName = '';

const mode = () => (document.querySelector('input[name="impMode"]:checked') || {}).value || 'dot';

function prepare(im) {
  let w = im.naturalWidth, h = im.naturalHeight;
  const k = Math.min(1, LIMIT / Math.max(w, h));
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingEnabled = k < 1; x.drawImage(im, 0, 0, w, h);
  return { canvas: c, w, h, d: x.getImageData(0, 0, w, h).data, jpeg: false };
}

export function loadImageFile(file) {
  if (!file || !/^image\//.test(file.type)) { toast('画像ファイルを選んでください'); return; }
  openImport();
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => {
    try {
      src = prepare(im);
      // JPEG のブロック境目を避ける処理は、縮小していない（位置がずれていない）ときだけ使う
      src.jpeg = /jpe?g/i.test(file.type) && src.w === im.naturalWidth;
      baseName = (file.name || '').replace(/\.[^.]+$/, '').trim().slice(0, 30);
      $('impBody').hidden = false;
      view.setImage(src.canvas);
      setCrop({ x: 0, y: 0, w: src.w, h: src.h });
    } catch (e) { toast('画像を読み込めませんでした'); }
    URL.revokeObjectURL(url);
  };
  im.onerror = () => { toast('画像を読み込めませんでした'); URL.revokeObjectURL(url); };
  im.src = url;
}

function setCrop(c) {
  crop = c; det = null; manual = 0;
  view.setCrop(c);
  $('impCropInfo').textContent = `${c.w} × ${c.h}px`;
  resample();
}

function describe(g) {
  const size = Math.abs(g.px - g.py) < 0.05 ? g.px.toFixed(2) : `${g.px.toFixed(2)} × ${g.py.toFixed(2)}`;
  if (manual) return `1マス ${size}px（手動）`;
  if (g.px === 1 && g.py === 1) return '拡大されていない画像として、1ピクセル = 1マスで取り込みます。';
  // 確かさ = 周期の強さ。くっきりした拡大で 0.25 以上、強くぼやけた画像で 0.1 前後、ドット絵でない画像は 0.1 未満
  const level = g.conf >= 0.25 ? '高' : g.conf >= 0.1 ? '中' : '低';
  const tip = { 高: '', 中: '。ピンクの線がずれていたら「1マスの大きさ」を直してください。', 低: '。ドット絵ではないかもしれません。線がずれていたら「1マスの大きさ」を直すか、「普通の画像」を試してください。' };
  return `見つけたマス目: 1マス ${size}px（確かさ: ${level}）${tip[level]}`;
}

// マス目を決めてマスの色を取る
function resample() {
  if (!src) return;
  const dot = mode() === 'dot';
  $('impDot').hidden = !dot; $('impPhoto').hidden = dot;
  cells = null;
  if (dot) {
    if (!det) det = detectGrid(src, crop);
    const g = manual ? gridForCell(src, crop, manual) : det;
    if (g.ok) {
      cells = sampleGrid(src, crop, g);
      $('impDetect').textContent = describe(g);
      if (!manual) $('impCell').value = g.px.toFixed(2);
    } else {
      $('impDetect').textContent = 'マス目を見つけられませんでした。「1マスの大きさ」を入れるか、「普通の画像」を選んでください。';
    }
    view.setGrid(g.ok ? g : null);
  } else {
    cells = resampleArea(src, crop, +$('impSize').value);
    view.setGrid(null);
  }
  remap();
}

// 背景・色の設定を反映してプレビュー
function remap() {
  const pc = $('impPrev');
  result = cells && convertCells(cells, {
    bg: $('impBg').checked, trim: $('impTrim').checked, dither: mode() === 'photo' && $('impDither').checked,
    bright: +$('impBright').value, sat: +$('impSat').value,
  });
  const ok = !!(result && !result.empty);
  $('impNew').disabled = !ok; $('impReplace').disabled = !ok;
  if (!ok) {
    pc.width = 1; pc.height = 1;
    $('impInfo').textContent = result && result.empty ? '全部背景として消えてしまいました。「背景を自動で透明にする」を外してください。' : '';
    return;
  }
  pc.width = result.w; pc.height = result.h;
  const x = pc.getContext('2d'), id = x.createImageData(result.w, result.h), used = new Set();
  result.d.forEach((v, i) => {
    if (!v) return;
    const c = st.rgbs[v - 1], o = i * 4;
    id.data[o] = c[0]; id.data[o + 1] = c[1]; id.data[o + 2] = c[2]; id.data[o + 3] = 255; used.add(v);
  });
  x.putImageData(id, 0, 0);
  pc.style.width = Math.min(480, result.w * Math.max(1, Math.floor(220 / Math.max(result.w, result.h)))) + 'px';
  let info = `${result.w} × ${result.h}マス・${used.size}色`;
  if (result.removed) info += `・背景 ${result.removed}マスを透明に`;
  if (result.clipped) info += '。200マスを超えた部分は切り捨てました';
  $('impInfo').textContent = info;
}

function apply(asNew) {
  if (!result || result.empty) return;
  const { w, h, d } = result;
  if (asNew) {
    const id = createWork(nextName(baseName || '取り込み'), { w, h, d, done: [], navRow: h - 1 });
    if (!id || !openWork(id)) { toast('保存できませんでした（容量不足の可能性）'); return; }
  } else {
    pushUndo(snapshot());
    st.W = w; st.H = h; st.data = d.slice(); st.done.clear(); st.navRow = h - 1;
    afterData(true); refreshNavi();
  }
  closeSheet();
  toast(`${w} × ${h}マスで取り込みました`);
}

export function openImport() { openSheet(sheet); if (src) view.redraw(); }

export function initImporter() {
  sheet = makeSheet('importSheet', '画像を取り込む', IMPORT_BODY);
  view = createSourceView($('impSrc'), setCrop);
  $('impFile').addEventListener('change', () => { const f = $('impFile').files[0]; $('impFile').value = ''; if (f) loadImageFile(f); });
  $('impCropReset').addEventListener('click', () => src && setCrop({ x: 0, y: 0, w: src.w, h: src.h }));
  document.querySelectorAll('input[name="impMode"]').forEach((r) => r.addEventListener('change', resample));
  $('impCell').addEventListener('change', () => { const v = +$('impCell').value; if (v >= 1 && v <= 256) { manual = v; resample(); } });
  $('impAuto').addEventListener('click', () => { manual = 0; resample(); });
  $('impSize').addEventListener('change', resample);
  ['impDither', 'impBg', 'impTrim'].forEach((id) => $(id).addEventListener('change', remap));
  ['impBright', 'impSat'].forEach((id) => $(id).addEventListener('input', remap));
  $('impColorReset').addEventListener('click', () => { $('impBright').value = 0; $('impSat').value = 0; remap(); });
  $('impNew').addEventListener('click', () => apply(true));
  $('impReplace').addEventListener('click', () => apply(false));

  // 貼り付け・ドラッグ＆ドロップ（どの画面からでも）
  window.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); loadImageFile(item.getAsFile()); }
  });
  window.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    const f = e.dataTransfer && [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); loadImageFile(f); }
  });
}
