// オフライン対応とアップデート（Service Worker）
//   - 通信できるときは常にサーバーに確認して最新を取り、取れたものをキャッシュに入れる（ネットワーク優先）
//   - 通信できないときはキャッシュから返す
//   - 同じサイト内のファイルだけを扱い、外部には一切通信しない
//   - 新しい版はすぐには切り替えず、タイトル画面の「アップデート」ボタンで切り替える
// ★ main に反映するたびに VERSION を上げる（これが変わるとブラウザが「新しい版がある」と気づく）
const VERSION = '2026.11.12.9';
const CACHE = 'teratool1-v1'; // キャッシュの仕組み自体を変えたときだけ上げる

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('teratool1-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

// ブラウザの HTTP キャッシュも使わず、毎回サーバーに確認する（変わっていなければ 304 で軽い）
function fromNetwork(req) {
  if (req.mode === 'navigate') return fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
  return fetch(req, { cache: 'no-cache' });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !sameOrigin(req.url)) return;
  e.respondWith(
    fromNetwork(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
  );
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  // アップデートボタンが押された → 待っている新しい版に切り替える
  if (d.type === 'skipWaiting') { self.skipWaiting(); return; }
  // 版の番号を教える
  if (d.type === 'version') { if (e.source) e.source.postMessage({ type: 'version', version: VERSION }); return; }
  // ページが読み込んだファイル（初回表示の分）をキャッシュする
  const urls = d.type === 'cache' && Array.isArray(d.urls) ? d.urls.filter(sameOrigin) : [];
  if (!urls.length) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => {})))));
});
