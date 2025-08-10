const CACHE_NAME = 'zutsu-log-cache-v13';
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    const currentCaches = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
        }).then(cachesToDelete => {
            return Promise.all(cachesToDelete.map(cacheToDelete => {
                return caches.delete(cacheToDelete);
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // 同一オリジンからのリクエスト、かつGETメソッドのみを対象
    if (event.request.url.startsWith(self.location.origin) && event.request.method === 'GET') {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    // キャッシュがあればキャッシュを返し、なければネットワークから取得
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        // ネットワークから取得成功したらキャッシュに保存して返す
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
    // 外部オリジンのリクエストはそのままネットワークに流す
});