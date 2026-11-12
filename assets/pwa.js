// Service Worker の登録（ホーム画面に追加・オフライン対応）
// 外部への通信はしない。sw.js はサイトのルートに置く
if ('serviceWorker' in navigator) {
  const root = new URL('../', import.meta.url);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // このページで読み込んだ同じサイトのファイルをキャッシュしてもらう
        const urls = [location.href, ...performance.getEntriesByType('resource').map((e) => e.name)]
          .filter((u) => new URL(u).origin === location.origin);
        if (reg.active) reg.active.postMessage({ type: 'cache', urls });
      })
      .catch(() => { /* 対応していない環境では何もしない */ });
  });
}
