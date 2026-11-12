// 選択範囲の表示: 選択の外を暗くし、境目を白黒の点線で囲む。ドラッグ中の四角・囲う線も描く
import { st } from '../state.js';
import { sel, hasSel } from './mask.js';
import { selDrag } from './tool.js';

const dim = document.createElement('canvas'); // 1マス = 1px。選択の外だけ色をつける
let cacheVer = -1, edges = null;

function rebuild() {
  const { W, H } = st, m = sel.mask;
  dim.width = W; dim.height = H;
  const x = dim.getContext('2d'), id = x.createImageData(W, H);
  for (let i = 0; i < W * H; i++) if (!m[i]) { id.data[i * 4 + 3] = 110; } // 黒を半透明で
  x.putImageData(id, 0, 0);
  // 境目の線（マスの辺）を、横・縦につながる分はまとめて1本に
  edges = new Path2D();
  const at = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H && m[cy * W + cx] === 1;
  for (let y = 0; y <= H; y++) {
    let start = -1;
    for (let cx = 0; cx <= W; cx++) {
      const on = cx < W && at(cx, y - 1) !== at(cx, y);
      if (on && start < 0) start = cx;
      if (!on && start >= 0) { edges.moveTo(start, y); edges.lineTo(cx, y); start = -1; }
    }
  }
  for (let cx = 0; cx <= W; cx++) {
    let start = -1;
    for (let y = 0; y <= H; y++) {
      const on = y < H && at(cx - 1, y) !== at(cx, y);
      if (on && start < 0) start = y;
      if (!on && start >= 0) { edges.moveTo(cx, start); edges.lineTo(cx, y); start = -1; }
    }
  }
  cacheVer = sel.ver;
}

// path をマス単位の座標で、白黒の点線で描く
function ants(ctx, path) {
  const v = st.view;
  ctx.save();
  ctx.translate(v.x, v.y); ctx.scale(v.s, v.s);
  ctx.lineWidth = 2 / v.s; ctx.strokeStyle = '#000'; ctx.setLineDash([]); ctx.stroke(path);
  ctx.lineWidth = 1 / v.s; ctx.strokeStyle = '#fff'; ctx.setLineDash([4 / v.s, 4 / v.s]); ctx.stroke(path);
  ctx.restore();
}

export function selOverlay(ctx) {
  if (st.mode !== 'edit') return;
  const v = st.view;
  if (hasSel()) {
    if (cacheVer !== sel.ver || dim.width !== st.W || dim.height !== st.H) rebuild();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(dim, v.x, v.y, st.W * v.s, st.H * v.s);
    ants(ctx, edges);
  }
  const d = selDrag();
  if (!d) return;
  const p = new Path2D();
  if (d.mode === 'rect') {
    const x0 = Math.min(d.start.x, d.cur.x), y0 = Math.min(d.start.y, d.cur.y);
    p.rect(x0, y0, Math.abs(d.cur.x - d.start.x) + 1, Math.abs(d.cur.y - d.start.y) + 1);
  } else if (d.mode === 'lasso' && d.pts.length) {
    p.moveTo(d.pts[0].x + 0.5, d.pts[0].y + 0.5);
    for (const q of d.pts) p.lineTo(q.x + 0.5, q.y + 0.5);
    p.closePath();
  }
  ants(ctx, p);
}
