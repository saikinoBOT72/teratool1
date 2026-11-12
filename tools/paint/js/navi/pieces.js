// 建築ナビの「まとめて」モード: 同じ色（ペンキ＋ブロック）でつながったマスを1つのかたまりとして、
// 作りやすい順（大きい順 / 色ごと）に1つずつ案内する
import { st } from '../state.js';

let cache = null, gen = 0; // { data, W, H, order, list, owner: Int32Array（マス → 順番。-1 = 空） }

// つながった同じ値のかたまり（斜めもつながりとみなす。斜めのふち線も1つにまとまる）
function findPieces() {
  const { W, H, data } = st, seen = new Uint8Array(W * H), list = [];
  for (let s = 0; s < W * H; s++) {
    if (!data[s] || seen[s]) continue;
    const v = data[s], cells = [s], p = { v, cells, x0: W, y0: H, x1: -1, y1: -1 };
    seen[s] = 1;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k], x = i % W, y = (i / W) | 0;
      if (x < p.x0) p.x0 = x; if (x > p.x1) p.x1 = x; if (y < p.y0) p.y0 = y; if (y > p.y1) p.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[j] && data[j] === v) { seen[j] = 1; cells.push(j); }
      }
    }
    p.n = cells.length;
    p.rect = p.n === (p.x1 - p.x0 + 1) * (p.y1 - p.y0 + 1); // ぴったり四角
    list.push(p);
  }
  return list;
}

// 作る順の行の位置（下から作るなら下ほど先）
const rowKey = (p) => (st.naviFromBottom ? -p.y1 : p.y0);

// 大きい順: 大きいかたまりから。色ごと: マス数の多い色から、その色の中は大きい順
function sortPieces(list, order) {
  const bySize = (a, b) => b.n - a.n || rowKey(a) - rowKey(b) || a.x0 - b.x0;
  if (order === 'size') return list.sort(bySize);
  const total = new Map();
  for (const p of list) total.set(p.v, (total.get(p.v) || 0) + p.n);
  return list.sort((a, b) => (a.v === b.v ? bySize(a, b) : total.get(b.v) - total.get(a.v) || a.v - b.v));
}

// 今の絵のかたまり一覧（絵・サイズ・順番が変わったら作り直す）
export function pieces() {
  const order = st.pieceOrder + (st.naviFromBottom ? 'B' : 'T');
  if (!cache || cache.data !== st.data || cache.W !== st.W || cache.H !== st.H || cache.order !== order) {
    const list = sortPieces(findPieces(), st.pieceOrder), owner = new Int32Array(st.W * st.H).fill(-1);
    list.forEach((p, k) => { for (const i of p.cells) owner[i] = k; });
    cache = { data: st.data, W: st.W, H: st.H, order, list, owner, id: ++gen };
  }
  return cache;
}
// 中身を書きかえたとき（同じ配列のまま）に作り直させる
export function resetPieces() { cache = null; }

// マス (x, y) を含むかたまりの順番（無ければ -1）
export function pieceAt(c) { return c ? pieces().owner[c.y * st.W + c.x] : -1; }

// キャンバス: 済んだかたまりはそのまま、今のかたまりを黄色の枠で囲み、まだのところは暗く
const dim = document.createElement('canvas');
let dimKey = '', edges = null;
export function drawPieces(ctx) {
  const { list, owner } = pieces(), v = st.view, idx = st.pieceIdx, { W, H } = st;
  const key = `${idx}|${cache.id}`;
  if (key !== dimKey || !edges) {
    dim.width = W; dim.height = H;
    const x = dim.getContext('2d'), id = x.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      if (owner[i] < 0 || owner[i] > idx) { id.data[i * 4 + 3] = 120; } // まだ・空き
    }
    x.putImageData(id, 0, 0);
    edges = new Path2D();
    const p = list[idx], at = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H && owner[cy * W + cx] === idx;
    if (p) for (const i of p.cells) {
      const cx = i % W, cy = (i / W) | 0;
      if (!at(cx, cy - 1)) { edges.moveTo(cx, cy); edges.lineTo(cx + 1, cy); }
      if (!at(cx, cy + 1)) { edges.moveTo(cx, cy + 1); edges.lineTo(cx + 1, cy + 1); }
      if (!at(cx - 1, cy)) { edges.moveTo(cx, cy); edges.lineTo(cx, cy + 1); }
      if (!at(cx + 1, cy)) { edges.moveTo(cx + 1, cy); edges.lineTo(cx + 1, cy + 1); }
    }
    dimKey = key;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(dim, v.x, v.y, W * v.s, H * v.s);
  ctx.translate(v.x, v.y); ctx.scale(v.s, v.s);
  ctx.lineCap = 'square';
  ctx.lineWidth = 5 / v.s; ctx.strokeStyle = '#000'; ctx.stroke(edges);
  ctx.lineWidth = 2.5 / v.s; ctx.strokeStyle = '#ffd400'; ctx.stroke(edges);
  ctx.restore();
}
