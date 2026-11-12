// 画像の入口（ファイル選択以外）: 貼り付けボタン・Ctrl+V・ドラッグ＆ドロップ
// どれも端末内だけで読み込み、外部には通信しない（ページ上の画像の URL を取りに行くこともしない）
import { $, toast } from '../util.js';

const isImage = (t) => /^image\//.test(t);

// 「貼り付け」ボタン: コピーしておいた画像をクリップボードから読む（スマホは長押し→コピーした画像）
async function pasteFromClipboard(load) {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    toast('この環境ではボタンから貼り付けできません。Ctrl+V で貼り付けてください');
    return;
  }
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find(isImage);
      if (type) { load(await item.getType(type)); return; }
    }
    toast('コピーされた画像がありません。画像を長押し（右クリック）して「コピー」してください');
  } catch (e) {
    toast('貼り付けできませんでした（貼り付けの許可が必要です）');
  }
}

export function initSources(load) {
  $('impPaste').addEventListener('click', () => pasteFromClipboard(load));

  // Ctrl+V（どの画面からでも）
  window.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => isImage(i.type));
    if (item) { e.preventDefault(); load(item.getAsFile()); }
  });

  // ドラッグ＆ドロップ（ファイル、または別のページからドラッグした画像）
  window.addEventListener('dragover', (e) => {
    const types = [...e.dataTransfer.types];
    if (types.includes('Files') || types.includes('text/uri-list')) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (!dt) return;
    e.preventDefault();
    const f = [...dt.files].find((x) => isImage(x.type));
    if (f) { load(f); return; }
    // ページの画像をドラッグした場合、ブラウザによってはファイルではなく URL だけが渡される。
    // URL を取りに行くと外部と通信してしまうので、コピー＆貼り付けをすすめる
    if (dt.types.includes('text/uri-list')) toast('この画像はドラッグでは読み込めません。右クリック→「画像をコピー」して貼り付けてください');
  });
}
