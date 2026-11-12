// 定数とアプリ全体の状態
import { hexToRgb } from './util.js';
import { PAINTS, COLORS, WALLS } from './paints.js';

export const MAX = 200;          // キャンバスの最大マス数
export const MIN_SCALE = 0.5;    // 表示倍率の下限
export const MAX_SCALE = 64;     // 表示倍率の上限
export const NPAINT = PAINTS.length; // ペンキの数（29）。マスの値は 0（透過）〜 NPAINT

// data の各マス: 0 = 透過, 1〜29 = PAINTS[値 - 1]
export const st = {
  // 作品
  workId: null, workName: '',
  W: 16, H: 16, data: new Uint8Array(16 * 16),
  // 色の見え方（描いた中身は変わらず、表示の色だけが変わる）
  colorMode: 'world',      // 'world' = ゲーム画面 / 'map' = 全体マップ
  gem: 'other',            // 'other' = ダイヤ以外 / 'diamond' = ダイヤ
  lit: false,              // 壁が光っているか
  rgbs: [], hex: [],       // ペンキごとの今の色（rgbs[値 - 1]）
  // 道具
  sel: 14, tool: 'pen', mirror: false,
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

// 今の見え方の色を作り直す
export function refreshRgb() {
  const row = COLORS[st.colorMode][wallIndex()];
  st.hex = row.map((h) => '#' + h);
  st.rgbs = st.hex.map(hexToRgb);
}

export function paintName(v) { return v ? PAINTS[v - 1] : '透過'; }
