// 建築ナビ「まとめて」の下の欄: 今のかたまりの 色・名前・ブロック・×数 と、形・場所・同じ色の何個目か
import { st, valueName, paintAbbr, paintOf } from '../state.js';
import { $, clamp, el } from '../util.js';
import { stage } from '../render.js';
import { blockIcon } from './block.js';
import { pieces } from './pieces.js';

const rowNo = (y) => (st.naviFromBottom ? st.H - y : y + 1);
const span = (a, b) => (a === b ? `${a}` : `${a}–${b}`);

export function renderPiecePanel() {
  const { list } = pieces();
  st.pieceIdx = clamp(st.pieceIdx, 0, Math.max(0, list.length - 1));
  const p = list[st.pieceIdx];
  $('naviRow').textContent = list.length ? `かたまり ${st.pieceIdx + 1} / ${list.length}` : 'かたまりがありません';
  $('naviDir').textContent = '順番: ' + (st.pieceOrder === 'size' ? '大きい順' : '色ごと');
  $('naviDir').title = '押すと順番（大きいかたまりから／色ごとにまとめて）を切り替え';
  const box = $('naviRuns');
  box.textContent = '';
  if (!p) { box.appendChild(el('li', 'none', '何も描かれていません')); return; }

  const li = el('li', 'run piece');
  const sw = el('i'); sw.style.setProperty('--c', st.hex[p.v - 1]);
  li.append(sw, el('span', 'nm', paintAbbr(paintOf(p.v))), blockIcon(p.v), el('b', null, '×' + p.n));
  li.title = valueName(p.v);
  box.appendChild(li);

  // 形（ぴったり四角なら幅×高さ）と場所（列・作る順の行）、同じ色の中で何個目か
  const w = p.x1 - p.x0 + 1, h = p.y1 - p.y0 + 1;
  const ya = rowNo(st.naviFromBottom ? p.y1 : p.y0), yb = rowNo(st.naviFromBottom ? p.y0 : p.y1);
  const same = list.filter((q) => q.v === p.v), k = same.indexOf(p) + 1;
  const info = el('li', 'piece-info');
  info.append(
    el('span', p.rect ? 'tag' : null, p.rect ? `四角 ${w}×${h}` : `${w}×${h} の範囲`),
    el('span', null, `列 ${span(p.x0 + 1, p.x1 + 1)}・${st.naviFromBottom ? '下' : '上'}から ${span(ya, yb)}行目`),
    el('span', null, same.length > 1 ? `この色 ${k} / ${same.length}個目` : 'この色はこれだけ'),
  );
  box.appendChild(info);
}

// かたまりが画面からはみ出していたら真ん中に寄せる
export function ensurePieceVisible() {
  const p = pieces().list[st.pieceIdx];
  if (!p) return;
  const v = st.view, cw = stage.clientWidth, ch = stage.clientHeight - 56; // 56 = 下のボタンの分
  const l = v.x + p.x0 * v.s, r = v.x + (p.x1 + 1) * v.s, t = v.y + p.y0 * v.s, b = v.y + (p.y1 + 1) * v.s;
  if (l < 0 || r > cw) { v.x = Math.round(cw / 2 - ((p.x0 + p.x1 + 1) / 2) * v.s); st.autoFit = false; }
  if (t < 0 || b > ch) { v.y = Math.round(ch / 2 - ((p.y0 + p.y1 + 1) / 2) * v.s); st.autoFit = false; }
}
