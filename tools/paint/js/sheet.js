// 下から出るシート（ダイアログ）の開閉。同時に開くのは1枚だけ
let current = null, lastFocus = null;
const closeHandlers = new Map();

export function sheetOpen() { return !!current; }

export function openSheet(el) {
  if (current === el) return;
  if (current) closeSheet(false);
  else lastFocus = document.activeElement;
  el.hidden = false;
  current = el;
  const btn = el.querySelector('[data-close]');
  if (btn) btn.focus();
}

export function closeSheet(restoreFocus = true) {
  if (!current) return;
  const el = current;
  el.hidden = true;
  current = null;
  const fn = closeHandlers.get(el);
  if (fn) fn();
  if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus();
}

export function onSheetClose(el, fn) { closeHandlers.set(el, fn); }

// 閉じるボタンと背景タップで閉じられるようにする
export function wireSheet(el) {
  el.addEventListener('pointerdown', (e) => { if (e.target === el) closeSheet(); });
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
}

const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// JS からシートを作る。bodyHtml は信頼できる固定の文字列のみ（利用者の入力を入れない）
export function makeSheet(id, title, bodyHtml) {
  const el = document.createElement('div');
  el.className = 'scrim'; el.id = id; el.hidden = true;
  el.innerHTML =
    `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}Title">` +
    `<div class="sheet-head"><h2 id="${id}Title">${title}</h2>` +
    `<button class="ib" type="button" data-close aria-label="閉じる">${CLOSE_SVG}</button></div>` +
    bodyHtml + '</div>';
  document.body.appendChild(el);
  wireSheet(el);
  return el;
}
