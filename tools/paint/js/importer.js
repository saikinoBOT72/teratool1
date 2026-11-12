// 画像の取り込み（16色への減色）。画像は端末内だけで処理し、送信しない
import { st, MAX } from './state.js';
import { $, clamp, toast } from './util.js';
import { snapshot, pushUndo, afterData } from './history.js';
import { closeSheet } from './menu.js';

/* ---- 色差は見た目に近い Lab 色空間で測る ---- */
function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function toLab(r, g, b) {
  const R = srgb2lin(r), G = srgb2lin(g), B = srgb2lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// 大きすぎる画像は長辺2048pxに縮めてから画素を読む
function prepareSource(im) {
  let sw = im.naturalWidth, sh = im.naturalHeight;
  const m = Math.max(sw, sh);
  if (m > 2048) { const k = 2048 / m; sw = Math.max(1, Math.round(sw * k)); sh = Math.max(1, Math.round(sh * k)); }
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, sw, sh);
  return { w: sw, h: sh, nw: im.naturalWidth, nh: im.naturalHeight, d: x.getImageData(0, 0, sw, sh).data };
}

// 面積平均で縮小（透明度で重み付け）
function resample(src, tw, th) {
  const { w: sw, h: sh, d: sd } = src, out = new Float32Array(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor(ty * sh / th), y1 = Math.max(y0 + 1, Math.ceil((ty + 1) * sh / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor(tx * sw / tw), x1 = Math.max(x0 + 1, Math.ceil((tx + 1) * sw / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * sw + x) * 4, al = sd[i + 3];
        r += sd[i] * al; g += sd[i + 1] * al; b += sd[i + 2] * al; a += al; n++;
      }
      const o = (ty * tw + tx) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
      out[o + 3] = a / n;
    }
  }
  return out;
}

function targetSize(src, longSide) {
  let tw = src.nw, th = src.nh;
  if (longSide) { const k = longSide / Math.max(tw, th); tw = Math.max(1, Math.round(tw * k)); th = Math.max(1, Math.round(th * k)); }
  const m = Math.max(tw, th);
  if (m > MAX) { const k = MAX / m; tw = Math.max(1, Math.round(tw * k)); th = Math.max(1, Math.round(th * k)); }
  return [tw, th];
}

// longSide=0 は原寸。dither=true でフロイド–スタインバーグ法
function quantize(src, longSide, dither) {
  const [tw, th] = targetSize(src, longSide);
  const px = resample(src, tw, th);
  const labs = st.rgbs.map((c) => toLab(c[0], c[1], c[2]));
  const nearest = (r, g, b) => {
    const l = toLab(r, g, b);
    let best = 0, bd = Infinity;
    for (let i = 0; i < 16; i++) {
      const q = labs[i], d0 = l[0] - q[0], d1 = l[1] - q[1], d2 = l[2] - q[2], d = d0 * d0 + d1 * d1 + d2 * d2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const out = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const o = (y * tw + x) * 4;
    if (px[o + 3] < 128) continue; // 半透明以下は空マス
    const r = clamp(px[o], 0, 255), g = clamp(px[o + 1], 0, 255), b = clamp(px[o + 2], 0, 255);
    const idx = nearest(r, g, b);
    out[y * tw + x] = idx + 1;
    if (!dither) continue;
    const pr = st.rgbs[idx], er = r - pr[0], eg = g - pr[1], eb = b - pr[2];
    const spread = (xx, yy, f) => {
      if (xx < 0 || xx >= tw || yy >= th) return;
      const oo = (yy * tw + xx) * 4;
      if (px[oo + 3] < 128) return;
      px[oo] += er * f; px[oo + 1] += eg * f; px[oo + 2] += eb * f;
    };
    spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
  }
  return { w: tw, h: th, d: out };
}

let srcCache = null, importResult = null;

function updatePreview() {
  if (!srcCache) return;
  const r = quantize(srcCache, +$('importSize').value, $('importDither').checked);
  importResult = r;
  const pc = $('importPrev'); pc.width = r.w; pc.height = r.h;
  const pctx = pc.getContext('2d'), id = pctx.createImageData(r.w, r.h), d = id.data, used = new Set();
  for (let i = 0; i < r.d.length; i++) {
    const v = r.d[i];
    if (!v) continue;
    const c = st.rgbs[v - 1], o = i * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; used.add(v);
  }
  pctx.putImageData(id, 0, 0);
  $('importInfo').textContent = r.w + ' × ' + r.h + 'マス・' + used.size + '色を使用。取り込むと今の絵は置きかわります（元に戻せます）。';
}

function onFile() {
  const f = $('importFile').files && $('importFile').files[0];
  if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = () => {
    try {
      srcCache = prepareSource(im);
      $('importSize').value = Math.max(im.naturalWidth, im.naturalHeight) <= 128 ? '0' : '64';
      $('importBody').hidden = false;
      updatePreview();
    } catch (err) { toast('画像を読み込めませんでした'); }
    URL.revokeObjectURL(url);
  };
  im.onerror = () => { toast('画像を読み込めませんでした'); URL.revokeObjectURL(url); };
  im.src = url;
}

function applyImport() {
  if (!importResult) return;
  pushUndo(snapshot());
  st.W = importResult.w; st.H = importResult.h; st.data = importResult.d.slice();
  afterData(true); closeSheet(); toast(st.W + ' × ' + st.H + 'マスで取り込みました');
}

export function initImporter() {
  $('importFile').addEventListener('change', onFile);
  $('importSize').addEventListener('change', updatePreview);
  $('importDither').addEventListener('change', updatePreview);
  $('btnImport').addEventListener('click', applyImport);
}
