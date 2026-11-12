// 定数とアプリ全体の状態
import { hexToRgb } from './util.js';

export const MAX = 200;          // キャンバスの最大マス数
export const MIN_SCALE = 0.5;    // 表示倍率の下限
export const MAX_SCALE = 64;     // 表示倍率の上限

// 濃いペンキ12色 + 濃い版がない黒・白・グレー・茶。見た目は白いブロックに塗った想定の近似値（手で調整したもの）。
export const DEFAULTS = [
  ['濃い赤', '#ff0000'], ['濃いオレンジ', '#ff8000'], ['濃い黄', '#ffff00'], ['濃いライム', '#80ff00'],
  ['濃い緑', '#00ff00'], ['濃いティール', '#00ff80'], ['濃いシアン', '#00ffff'], ['濃い空色', '#0080ff'],
  ['濃い青', '#0000ff'], ['濃い紫', '#8000ff'], ['濃いバイオレット', '#ff00ff'], ['濃いピンク', '#ff0080'],
  ['黒', '#101010'], ['白', '#ffffff'], ['グレー', '#808080'], ['茶', '#8a5a2b'],
];

// data の各マス: 0 = 空, 1〜16 = DEFAULTS の番号 + 1
export const st = {
  // 作品
  workId: null, workName: '',
  W: 16, H: 16, data: new Uint8Array(16 * 16),
  // 色・道具
  pal: DEFAULTS.map((d) => d[1]), rgbs: [],
  sel: 1, tool: 'pen', mirror: false,
  // 表示
  showGrid: true, showMajor: true,
  view: { x: 0, y: 0, s: 12 }, autoFit: true,
  hover: null, lastCell: null, spaceDown: false,
  dirty: true,
  // 建築ナビ
  mode: 'edit',            // 'edit' | 'navi'
  navRow: 0,               // いま見ている行（0 = 一番上）
  done: new Set(),         // 完了した行
  naviFromBottom: true,    // 下の行から作る
};

export function refreshRgb() { st.rgbs = st.pal.map(hexToRgb); }
