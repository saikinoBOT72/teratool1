// 壁の種類の印: ダイヤ = 塗った ◆、ダイヤ以外 = 点線の ◇ に ×。光は ON / OFF の文字
//   色の一覧・下のバー・建築ナビ・キャンバス（オプション）で同じ印を使う
import { st, wallOf } from './state.js';
import { WALLS } from './paints.js';

const NS = 'http://www.w3.org/2000/svg';
const DIAMOND = 'M5 .6L9.4 5 5 9.4.6 5z';
export const isDiamond = (v) => WALLS[wallOf(v)].gem === 'diamond';
export const isLit = (v) => WALLS[wallOf(v)].lit;

function svgMark(diamond) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 10 10'); s.setAttribute('class', 'wm-d'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', DIAMOND);
  if (diamond) p.setAttribute('class', 'wm-fill');
  else {
    p.setAttribute('class', 'wm-dash');
    const x = document.createElementNS(NS, 'path');
    x.setAttribute('d', 'M3.4 3.4l3.2 3.2M6.6 3.4L3.4 6.6'); x.setAttribute('class', 'wm-x');
    s.appendChild(x);
  }
  s.insertBefore(p, s.firstChild);
  return s;
}

// <span class="wm"><svg>◆</svg><b>ON</b></span>。v = マスの値（1〜）
export function wallBadge(v, cls) {
  const b = document.createElement('span');
  b.className = 'wm' + (isLit(v) ? ' on' : ' off') + (cls ? ' ' + cls : '');
  b.appendChild(svgMark(isDiamond(v)));
  const t = document.createElement('b'); t.textContent = isLit(v) ? 'ON' : 'OFF';
  b.appendChild(t);
  return b;
}

// キャンバスの各マスに印を描く（st.showWall のとき）。小さいときは ◆ だけ、もっと小さいと描かない
export function drawWallMarks(ctx, cw, ch) {
  const { view: v, W, H, data } = st, s = v.s;
  if (!st.showWall || s < 9) return;
  const x0 = Math.max(0, Math.floor(-v.x / s)), x1 = Math.min(W - 1, Math.floor((cw - v.x) / s));
  const y0 = Math.max(0, Math.floor(-v.y / s)), y1 = Math.min(H - 1, Math.floor((ch - v.y) / s));
  const full = s >= 18, d = Math.min(s * (full ? 0.42 : 0.55), 18);
  const font = Math.min(Math.round(s * 0.26), 13);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.font = `700 ${font}px system-ui, sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const val = data[y * W + x];
    if (!val) continue;
    const px = v.x + x * s, py = v.y + y * s, pad = Math.max(1.5, s * 0.08);
    const cx = px + pad + d / 2, cy = py + pad + d / 2, r = d / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    if (isDiamond(val)) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
    } else {
      ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.setLineDash([Math.max(1.5, r * 0.35), Math.max(1.2, r * 0.25)]); ctx.stroke();
      ctx.setLineDash([]);
      const k = r * 0.42; // 中のバツ
      ctx.beginPath(); ctx.moveTo(cx - k, cy - k); ctx.lineTo(cx + k, cy + k); ctx.moveTo(cx + k, cy - k); ctx.lineTo(cx - k, cy + k);
      ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    if (!full) continue;
    const t = isLit(val) ? 'ON' : 'OFF', tx = px + s - pad, ty = py + s - pad;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(t, tx, ty);
    ctx.fillStyle = isLit(val) ? '#ffe680' : '#fff'; ctx.fillText(t, tx, ty);
  }
  ctx.restore();
}
