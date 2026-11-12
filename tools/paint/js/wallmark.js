// 壁の種類の印（文字なしの2つのマーク）
//   壁: ダイヤ = 塗った ◆、ダイヤ以外 = 点線の ◇ に斜線
//   光: ON = 光を出す太陽のようなマーク、OFF = 中が空の丸
//   色の一覧・下のバーの色見本・建築ナビ・キャンバス（オプション）で同じ印を使う
import { st, wallOf } from './state.js';
import { WALLS } from './paints.js';

const NS = 'http://www.w3.org/2000/svg';
export const isDiamond = (v) => WALLS[wallOf(v)].gem === 'diamond';
export const isLit = (v) => WALLS[wallOf(v)].lit;

// 10×10 の中に描く形（SVG とキャンバスで共通）
const DIAMOND = 'M5 .8L9.2 5 5 9.2.8 5z';
const SLASH = 'M7.4 2.6L2.6 7.4';
const RAYS = 'M5 .4v1.5M5 8.1v1.5M.4 5h1.5M8.1 5h1.5M1.75 1.75l1.05 1.05M7.2 7.2l1.05 1.05M1.75 8.25l1.05-1.05M7.2 2.8l1.05-1.05';

function svg(parts) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 10 10'); s.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of parts) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    s.appendChild(e);
  }
  return s;
}
const wallIcon = (diamond) => svg(diamond
  ? [['path', { d: DIAMOND, class: 'wm-fill' }]]
  : [['path', { d: DIAMOND, class: 'wm-dash' }], ['path', { d: SLASH, class: 'wm-line' }]]);
const lightIcon = (on) => svg(on
  ? [['circle', { cx: 5, cy: 5, r: 2.3, class: 'wm-fill' }], ['path', { d: RAYS, class: 'wm-line' }]]
  : [['circle', { cx: 5, cy: 5, r: 3, class: 'wm-ring' }]]);

// <span class="wm"><svg 壁/><svg 光/></span>。v = マスの値（1〜）
export function wallBadge(v, cls) {
  const b = document.createElement('span');
  b.className = 'wm' + (cls ? ' ' + cls : '');
  b.title = (isDiamond(v) ? 'ダイヤ' : 'ダイヤ以外') + '・光' + (isLit(v) ? 'オン' : 'オフ');
  b.append(wallIcon(isDiamond(v)), lightIcon(isLit(v)));
  return b;
}

// キャンバス: (x, y) を左上とする大きさ d の枠に、黒ふち＋白で描く
const P = { diamond: new Path2D(DIAMOND), slash: new Path2D(SLASH), rays: new Path2D(RAYS) };
function stroke2(ctx, path, w, dash) {
  ctx.setLineDash(dash || []); // 点線は黒ふちも点線にして、すき間が見えるように
  ctx.lineWidth = w * 2.4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke(path);
  ctx.lineWidth = w; ctx.strokeStyle = '#fff'; ctx.stroke(path);
  ctx.setLineDash([]);
}
function drawWall(ctx, x, y, d, diamond) {
  ctx.save(); ctx.translate(x, y); ctx.scale(d / 10, d / 10);
  const k = 10 / d; // 1px を 10×10 の座標に直す
  if (diamond) { ctx.lineWidth = 1.6 * k; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke(P.diamond); ctx.fillStyle = '#fff'; ctx.fill(P.diamond); }
  else { stroke2(ctx, P.diamond, 1.1 * k, [2.2, 1.7]); stroke2(ctx, P.slash, 1.1 * k); }
  ctx.restore();
}
function drawLight(ctx, x, y, d, on) {
  ctx.save(); ctx.translate(x, y); ctx.scale(d / 10, d / 10);
  const k = 10 / d, c = new Path2D();
  c.arc(5, 5, on ? 2.3 : 3, 0, Math.PI * 2);
  if (on) { stroke2(ctx, P.rays, 1.1 * k); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.stroke(c); ctx.fillStyle = '#fff'; ctx.fill(c); }
  else stroke2(ctx, c, 1.1 * k);
  ctx.restore();
}

// st.showWall のとき、各マスの左上に壁、右下に光の印を描く（マスの中に収める。小さすぎると描かない）
export function drawWallMarks(ctx, cw, ch) {
  const { view: v, W, H, data } = st, s = v.s;
  if (!st.showWall || s < 10) return;
  const x0 = Math.max(0, Math.floor(-v.x / s)), x1 = Math.min(W - 1, Math.floor((cw - v.x) / s));
  const y0 = Math.max(0, Math.floor(-v.y / s)), y1 = Math.min(H - 1, Math.floor((ch - v.y) / s));
  const pad = Math.max(1.5, s * 0.07), d = Math.min((s - pad * 2) * 0.5, 16);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const val = data[y * W + x];
    if (!val) continue;
    const px = v.x + x * s, py = v.y + y * s;
    drawWall(ctx, px + pad, py + pad, d, isDiamond(val));
    drawLight(ctx, px + s - pad - d, py + s - pad - d, d, isLit(val));
  }
}
