// 見え方（ゲーム画面 / 全体マップ）の切り替え。色の一覧とメニューの両方に置く
// （ダイヤ・光の違いは色の一覧で直接選ぶので、ここにはない）
import { st } from './state.js';
import { el } from './util.js';

const GROUPS = [
  { key: 'colorMode', label: '見え方', opts: [['world', 'ゲーム画面'], ['map', '全体マップ']] },
];
const buttons = [];

export function syncColorControls() {
  for (const { b, key, val } of buttons) b.setAttribute('aria-pressed', String(st[key] === val));
}

// onChange: 見え方が変わったときに呼ぶ（色の作り直し・保存など）
export function buildColorControls(container, onChange) {
  for (const g of GROUPS) {
    const box = el('div', 'segs');
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', g.label);
    for (const [val, label] of g.opts) {
      const b = el('button', null, label); b.type = 'button';
      b.addEventListener('click', () => {
        if (st[g.key] === val) return;
        st[g.key] = val; syncColorControls(); onChange();
      });
      buttons.push({ b, key: g.key, val });
      box.appendChild(b);
    }
    container.appendChild(box);
  }
  syncColorControls();
}

// キーボードの V: ゲーム画面 ⇔ 全体マップ
export function toggleColorMode(onChange) {
  st.colorMode = st.colorMode === 'world' ? 'map' : 'world';
  syncColorControls(); onChange();
}
