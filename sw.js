// オフライン対応（Service Worker）
//   - 通信できるときは常に最新を取りに行き、取れたものをキャッシュに入れる（ネットワーク優先）
//   - 通信できないときはキャッシュから返す
//   - 同じサイト内のファイルだけを扱い、外部には一切通信しない
// ファイル一覧を手で管理しなくて済むよう、各ページは読み込んだファイルの一覧を送ってくる（assets/pwa.js）
const CACHE = 'teratool1-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('teratool1-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !sameOrigin(req.url)) return;
  e.respondWith(
    fetch(req)
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

// ページから「このファイルたちをキャッシュして」と頼まれる（初回表示で読み込んだ分）
self.addEventListener('message', (e) => {
  const urls = e.data && e.data.type === 'cache' && Array.isArray(e.data.urls) ? e.data.urls.filter(sameOrigin) : [];
  if (!urls.length) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => {})))));
});
