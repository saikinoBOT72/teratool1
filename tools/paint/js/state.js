// 定数とアプリ全体の状態
import { hexToRgb } from './util.js';
import { PAINTS, COLORS, WALLS } from './paints.js';

export const MAX = 200;          // キャンバスの最大マス数
export const MIN_SCALE = 0.5;    // 表示倍率の下限
export const MAX_SCALE = 64;     // 表示倍率の上限
export const NPAINT = PAINTS.length;      // ペンキの数（29）
export const NWALL = WALLS.length;        // 壁の種類 × 光（4）
export const NVAL = NPAINT * NWALL;       // マスの値の最大（116）

// マスの値: 0 = 透過, 1〜116 = 壁 × 29 + ペンキ番号（1〜29）
//   壁: 0 = ダイヤ以外・光オフ, 1 = ダイヤ・光オフ, 2 = ダイヤ以外・光オン, 3 = ダイヤ・光オン（paints.js の WALLS の順）
// 1つの作品の中で、光オン・オフ、ダイヤ・ダイヤ以外を混ぜられる
export const cellValue = (paint, wall) => (paint ? wall * NPAINT + paint : 0);
export const paintOf = (v) => (v ? (v - 1) % NPAINT + 1 : 0);
export const wallOf = (v) => (v ? Math.floor((v - 1) / NPAINT) : 0);
export const WALL_LABELS = ['ダイヤ以外・光オフ', 'ダイヤ・光オフ', 'ダイヤ以外・光オン', 'ダイヤ・光オン'];
const WALL_SHORT = ['', 'ダイヤ', '光', 'ダイヤ光'];
export const st = {
  // 作品
  workId: null, workName: '',
  W: 16, H: 16, data: new Uint8Array(16 * 16),
  // 色の見え方（描いた中身は変わらず、表示の色だけが変わる）
  colorMode: 'world',      // 'world' = ゲーム画面 / 'map' = 全体マップ
  rgbs: [], hex: [],       // マスの値ごとの今の色（rgbs[値 - 1]、116個）
  // これから塗るもの: ペンキ（0 = 透過）と壁
  sel: 14,
  gem: 'other',            // 'other' = ダイヤ以外 / 'diamond' = ダイヤ
  lit: false,              // 光オン
  tool: 'pen', mirror: false,
  // 表示
  showGrid: true, showMajor: true,
  view: { x: 0, y: 0, s: 12 }, autoFit: true,
  hover: null, lastCell: null, spaceDown: false,
  dirty: true,
  // 建築ナビ
  mode: 'edit',            // 'edit' | 'navi'
  navRow: 0,               // いま見ている行（0 = 一番上）
  naviFromBottom: true,    // 下の行から作る
};

export function wallIndex() {
  return WALLS.findIndex((w) => w.gem === st.gem && w.lit === st.lit);
}

// これから塗る値（ペンキ × 壁）
export function brushValue() { return cellValue(st.sel, wallIndex()); }

// 今の見え方（ゲーム画面 / 全体マップ）の色を、全部の壁ぶん作り直す
export function refreshRgb() {
  st.hex = COLORS[st.colorMode].flat().map((h) => '#' + h);
  st.rgbs = st.hex.map(hexToRgb);
}

export function paintName(p) { return p ? PAINTS[p - 1] : '透過'; }
// 「濃い赤・ダイヤ光」のような短い名前と、「濃い赤（ダイヤ・光オン）」のような名前
export function shortName(v) { const s = WALL_SHORT[wallOf(v)]; return paintName(paintOf(v)) + (v && s ? '・' + s : ''); }
export function valueName(v) { return v ? `${paintName(paintOf(v))}（${WALL_LABELS[wallOf(v)]}）` : '透過'; }
