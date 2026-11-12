// 古い保存形式のマスの値を、今の形式（p: 4 = 壁 × 28 + ペンキ 1〜28、0 = 透過）に置きかえる
//   p なし … 旧16色（濃い12色 + 黒・白・グレー・茶）。壁は全体で1つ
//   p: 2   … 塗り無し入り29色（1〜29）。壁は全体で1つ
//   p: 3   … 壁 × 29 + 塗り無し入り29色
// 「塗り無し」は色ではなくなったので透過にする。壁が全体で1つだった版は、そのとき選んでいた壁として扱う
import { WALLS } from '../paints.js';

export const PAINT_VERSION = 4;
const P29 = 29;
// 旧16色 → 塗り無し入り29色での番号
const OLD16 = { 1: 14, 2: 18, 3: 17, 4: 25, 5: 24, 6: 23, 7: 22, 8: 21, 9: 20, 10: 19, 11: 16, 12: 15, 13: 27, 14: 28, 15: 29, 16: 26 };

// その版で取りうる値の最大
export function maxValue(ver) { return ver === PAINT_VERSION ? 112 : ver === 3 ? 4 * P29 : ver === 2 ? P29 : 16; }

// 塗り無し入り29色の番号と壁 → 今の値
function from29(p29, wall) { return !p29 || p29 === 1 ? 0 : wall * 28 + (p29 - 1); }

export function convertValue(v, ver, wall) {
  if (!v || ver === PAINT_VERSION) return v;
  if (ver === 3) return from29((v - 1) % P29 + 1, Math.floor((v - 1) / P29));
  if (ver === 2) return from29(v, wall);
  return from29(OLD16[v], wall);
}

// 設定 v3 では「塗る壁」を gem / lit で全体に1つ持っていた
export function legacyWall(settings) {
  if (!settings) return 0;
  const i = WALLS.findIndex((w) => w.gem === settings.gem && w.lit === !!settings.lit);
  return i < 0 ? 0 : i;
}

// 古い設定の「選択中の色」→ 今の値（なければ null）
export function convertSel(settings) {
  const s = settings && settings.sel;
  if (!Number.isInteger(s) || s < 0) return null;
  if (settings.v >= 4) return s <= 112 ? s : null;
  const wall = legacyWall(settings);
  if (settings.v === 3) return s <= P29 ? (from29(s, wall) || (s ? null : 0)) : null;
  return OLD16[s] ? from29(OLD16[s], wall) : null;
}
