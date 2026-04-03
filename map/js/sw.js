/* ─────────────────────────────────────────────
   아파트 시세표 | sw.js  v9.0

   CSV : 절대 캐시 안 함 → 항상 네트워크 직통
   정적 자산 (HTML/JS/CSS) : Network-First + 캐시 폴백
───────────────────────────────────────────── */

const CACHE_NAME = 'apt-price-v9';
const STATIC = ['./index.html', './css/common.css', './js/app.js'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(STATIC))
            .catch(() => {})
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // CSV: 캐시 완전 우회 → 네트워크 직통
    if (url.pathname.endsWith('.csv')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).catch(() =>
                new Response('오프라인: CSV를 불러올 수 없습니다.', { status: 503 })
            )
        );
        return;
    }

    // 정적 자산: Network-First + 캐시 폴백
    event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('오프라인 상태입니다.', { status: 503 });
    }
}
