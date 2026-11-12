// 色の見え方（ゲーム画面/全体マップ・壁・光）が変わったときの共通処理
import { applyColors } from './palette.js';
import { refreshNavi } from './navi/navi.js';
import { scheduleSave } from './works/store.js';

export function onColorsChanged() {
  applyColors();
  refreshNavi();
  scheduleSave();
}
