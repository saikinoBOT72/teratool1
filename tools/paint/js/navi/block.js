// 建築ナビで「どのブロック（壁）を使うか」を示すアイコン。ゲーム内の持ち物アイコンに似せて自分で描いたもの
//   （ゲームの画像は使っていない）。外枠 → 中間の帯 → 中心、右上に明るい線
//   ダイヤ = 白っぽい / ダイヤ以外 = 青。光オフはそれぞれ暗くなる
import { wallOf, WALL_LABELS } from '../state.js';

const NS = 'http://www.w3.org/2000/svg';
// 壁の番号順（state.js）: ダイヤ以外・オフ, ダイヤ・オフ, ダイヤ以外・オン, ダイヤ・オン
// [外枠, 帯, 中心, 明るい線]
const PALETTE = [
  ['#0e1640', '#1c2a6a', '#24357e', '#4a5cae'],
  ['#232327', '#3d3e44', '#4b4c53', '#8e9098'],
  ['#0f2160', '#2b55c4', '#3f72f2', '#9cc2ff'],
  ['#5c5e66', '#c4c7ce', '#eef0f3', '#ffffff'],
];

function rect(s, x, y, w, h, fill) {
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('fill', fill);
  s.appendChild(r);
}

// v = マスの値（1〜）
export function blockIcon(v) {
  const [frame, band, center, hl] = PALETTE[wallOf(v)];
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('class', 'block-icon');
  s.setAttribute('shape-rendering', 'crispEdges');
  s.setAttribute('role', 'img'); s.setAttribute('aria-label', WALL_LABELS[wallOf(v)]);
  const t = document.createElementNS(NS, 'title'); t.textContent = WALL_LABELS[wallOf(v)]; s.appendChild(t);
  rect(s, 1, 1, 14, 14, frame);
  rect(s, 3, 3, 10, 10, band);
  rect(s, 5, 5, 6, 6, center);
  rect(s, 4, 3, 9, 1, hl);  // 上の明るい線
  rect(s, 12, 3, 1, 9, hl); // 右の明るい線
  return s;
}
