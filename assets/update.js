// タイトル画面: 新しい版があれば「アップデート」ボタンを出す。版の番号と「更新を確認」も表示する
import { swRegistration } from './pwa.js';

const $ = (id) => document.getElementById(id);
let updating = false;

function showUpdate(reg) {
  $('update').hidden = false;
  $('updateBtn').onclick = () => {
    updating = true;
    $('updateBtn').disabled = true; $('updateBtn').textContent = '更新中…';
    if (reg.waiting) reg.waiting.postMessage({ type: 'skipWaiting' }); else location.reload();
  };
}

// 新しい版が入り終わるのを待って、ボタンを出す。見つからなければ false
function watch(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) { showUpdate(reg); return Promise.resolve(true); }
  const w = reg.installing;
  if (!w) return Promise.resolve(false);
  return new Promise((resolve) => {
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) { showUpdate(reg); resolve(true); }
      if (w.state === 'redundant' || w.state === 'activated') resolve(false);
    });
  });
}

swRegistration.then((reg) => {
  if (!reg) { $('appVersion').textContent = ''; $('checkUpdate').hidden = true; return; }
  // 新しい版に切り替わったら読み込み直す（ボタンを押したときだけ）
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'version') $('appVersion').textContent = 'バージョン ' + e.data.version;
  });
  navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage({ type: 'version' }));

  watch(reg);
  reg.addEventListener('updatefound', () => watch(reg));
  const check = () => reg.update().catch(() => {});
  check();
  // アプリに戻ってきたときにも確認する
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  $('checkUpdate').addEventListener('click', async () => {
    $('updateMsg').textContent = '確認中…';
    try { await reg.update(); } catch (e) { $('updateMsg').textContent = '確認できませんでした（オフライン？）'; return; }
    $('updateMsg').textContent = (await watch(reg)) ? '' : 'これが最新です';
  });
});
