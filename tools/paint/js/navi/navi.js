// 建築ナビ: 1行ずつ「左から 赤×3 → 黒×2 …」を列番号つきで表示する。
// 「まとめて」モードでは、つながった同じ色のかたまりごとに案内する（pieces.js / piece-panel.js）
import { st, valueName, paintAbbr, paintOf } from '../state.js';
import { blockIcon } from './block.js';
import { $, clamp, el } from '../util.js';
import { addOverlay, schedule, stage } from '../render.js';
import { updateReadout, fit } from '../view.js';
import { updateCursor } from '../palette.js';
import { scheduleSave } from '../works/store.js';
import { closePops } from '../popups.js';
import { refreshSelPanel } from '../select/panel.js';
import { pieces, pieceAt, drawPieces } from './pieces.js';
import { renderPiecePanel, ensurePieceVisible } from './piece-panel.js';

// 行 y の並び。末尾の空白は省く
export function rowRuns(y) {
  const { W, data } = st, runs = [];
  let x = 0;
  while (x < W) {
    const v = data[y * W + x];
    let n = 1;
    while (x + n < W && data[y * W + x + n] === v) n++;
    runs.push({ v, x, n });
    x += n;
  }
  if (runs.length && runs[runs.length - 1].v === 0) runs.pop();
  return runs;
}

// 作る順の番号（1始まり）
const orderNo = (y) => (st.naviFromBottom ? st.H - y : y + 1);

const pieceMode = () => st.naviMode === 'piece';

function renderPanel() {
  for (const b of document.querySelectorAll('#naviModes [data-nm]')) b.setAttribute('aria-pressed', String(b.dataset.nm === st.naviMode));
  $('naviPrev').textContent = pieceMode() ? '前のかたまり' : '前の行';
  $('naviNext').textContent = pieceMode() ? '次のかたまり' : '次の行';
  if (pieceMode()) { renderPiecePanel(); return; }
  const y = st.navRow;
  $('naviRow').textContent = `${st.naviFromBottom ? '下' : '上'}から ${orderNo(y)}行目 / ${st.H}`;
  $('naviDir').textContent = '順番: ' + (st.naviFromBottom ? '下から' : '上から');
  $('naviDir').title = '押すと作る順番（下から／上から）を切り替え';

  const list = $('naviRuns');
  list.textContent = '';
  const runs = rowRuns(y);
  if (!runs.length) list.appendChild(el('li', 'none', 'この行は空です（何も置かない）'));
  for (const r of runs) {
    const pos = r.n > 1 ? `${r.x + 1}–${r.x + r.n}` : `${r.x + 1}`;
    const li = el('li', r.v ? 'run' : 'run empty');
    if (r.v) {
      const sw = el('i'); sw.style.setProperty('--c', st.hex[r.v - 1]); li.appendChild(sw);
      li.title = valueName(r.v);
    }
    // 色 → 色の名前 → 使うブロック → ×数 → 列
    if (r.v) li.append(el('span', 'nm', paintAbbr(paintOf(r.v))), blockIcon(r.v));
    li.appendChild(el('b', null, (r.v ? '' : '空 ') + '×' + r.n));
    li.appendChild(el('small', null, pos));
    li.setAttribute('aria-label', `${r.v ? valueName(r.v) : '空き'} ${r.n}マス（${pos}列目）`);
    list.appendChild(li);
  }
}

// 行が画面外なら縦方向に寄せる
function ensureVisible() {
  const v = st.view, ch = stage.clientHeight - 56, top = v.y + st.navRow * v.s; // 56 = 下のボタンの分
  if (top < 0 || top + v.s > ch) { v.y = Math.round(ch / 2 - (st.navRow + 0.5) * v.s); st.autoFit = false; }
}

function update() { renderPanel(); if (pieceMode()) ensurePieceVisible(); else ensureVisible(); schedule(); scheduleSave(); }

// d = +1 で作る順の次の行へ
export function step(d) {
  if (pieceMode()) { st.pieceIdx = clamp(st.pieceIdx + d, 0, Math.max(0, pieces().list.length - 1)); update(); return; }
  const dir = st.naviFromBottom ? -1 : 1;
  st.navRow = clamp(st.navRow + d * dir, 0, st.H - 1);
  update();
}

// キャンバスを押した（drag = なぞっている途中）。1行ずつなら行を、まとめてならそのマスのかたまりを選ぶ
export function selectRow(c, drag) {
  if (!c) return;
  if (pieceMode()) {
    const k = pieceAt(c);
    if (k >= 0 && k !== st.pieceIdx) { st.pieceIdx = k; renderPanel(); schedule(); }
    return;
  }
  if (drag && c.y === st.navRow) return;
  st.navRow = c.y; st.lastCell = c; updateReadout(); update();
}

// 作品・サイズ・色の見え方が変わったとき
export function refreshNavi() { if (st.mode === 'navi') { st.navRow = clamp(st.navRow, 0, st.H - 1); renderPanel(); } }

export function enterNavi() {
  closePops();
  st.mode = 'navi'; st.hover = null;
  st.navRow = clamp(st.navRow, 0, st.H - 1);
  $('editPanel').hidden = true; $('naviPanel').hidden = false;
  updateCursor(); renderPanel(); refreshSelPanel(); refit();
}

// 下の欄の高さが変わるので、全体が見えるように表示し直す
function refit() { st.autoFit = true; requestAnimationFrame(() => fit()); }

export function exitNavi() {
  st.mode = 'edit';
  $('naviPanel').hidden = true; $('editPanel').hidden = false;
  updateCursor(); refreshSelPanel(); refit();
}

// キャンバス上の表示: 今の行を枠で囲み、他の行は薄く（まとめてなら今のかたまりを囲む）
function overlay(ctx) {
  if (st.mode !== 'navi') return;
  if (pieceMode()) { drawPieces(ctx); return; }
  const v = st.view, w = st.W * v.s;
  for (let y = 0; y < st.H; y++) {
    if (y === st.navRow) continue;
    ctx.fillStyle = 'rgba(15,20,25,0.45)';
    ctx.fillRect(v.x, v.y + y * v.s, w, v.s);
  }
  const top = Math.round(v.y + st.navRow * v.s), left = Math.round(v.x), hh = Math.round(v.s);
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeRect(left - 2.5, top - 2.5, Math.round(w) + 5, hh + 5);
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffd400'; ctx.strokeRect(left - 1, top - 1, Math.round(w) + 2, hh + 2);
}

export function initNavi() {
  addOverlay(overlay);
  $('btnNavi').addEventListener('click', enterNavi);
  $('naviExit').addEventListener('click', exitNavi);
  $('naviPrev').addEventListener('click', () => step(-1));
  $('naviNext').addEventListener('click', () => step(1));
  $('naviDir').addEventListener('click', () => {
    if (pieceMode()) { st.pieceOrder = st.pieceOrder === 'size' ? 'color' : 'size'; st.pieceIdx = 0; } else st.naviFromBottom = !st.naviFromBottom;
    update();
  });
  $('naviModes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nm]');
    if (!b || b.dataset.nm === st.naviMode) return;
    st.naviMode = b.dataset.nm;
    update(); refit(); // 下の欄の高さが変わる
  });
}
