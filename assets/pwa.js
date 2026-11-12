// Service Worker の登録（ホーム画面に追加・オフライン対応）。外部への通信はしない。sw.js はサイトのルートに置く
// swRegistration: 登録が済んだら registration（使えない環境では null）になる Promise
const root = new URL('../', import.meta.url);

function register() {
  return navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname }).then((reg) => {
    navigator.serviceWorker.ready.then((r) => {
      // このページで読み込んだ同じサイトのファイルをキャッシュしてもらう
      const urls = [location.href, ...performance.getEntriesByType('resource').map((e) => e.name)]
        .filter((u) => new URL(u).origin === location.origin);
      if (r.active) r.active.postMessage({ type: 'cache', urls });
    });
    return reg;
  });
}

export const swRegistration = !('serviceWorker' in navigator) ? Promise.resolve(null) : new Promise((resolve) => {
  const go = () => register().then(resolve, () => resolve(null));
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
});
