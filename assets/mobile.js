// スマホ向けの調整（全ページ共通）。CSS（assets/mobile.css）で止めきれないものを止める
const editable = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
const savable = (t) => t && t.closest && t.closest('img.savable');

// 長押しメニュー（右クリックメニュー）を出さない。入力欄と保存用の画像は除く
document.addEventListener('contextmenu', (e) => { if (!editable(e.target) && !savable(e.target)) e.preventDefault(); });

// 長押し・ダブルクリックで文字を選択しない
document.addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('dblclick', (e) => { if (!editable(e.target)) e.preventDefault(); }, { passive: false });

// iOS Safari: ページ全体のピンチ拡大（ジェスチャー）を止める。キャンバスの2本指操作はポインタイベントで別に扱う
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// 2本指以上でのページの拡大を止める（キャンバス以外）
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 && !(e.target && e.target.closest && e.target.closest('canvas'))) e.preventDefault();
}, { passive: false });
