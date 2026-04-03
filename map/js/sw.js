/* ─────────────────────────────────────────────
   아파트 시세표 | sw.js  v8.0

   ★ 핵심 전략 변경: 모든 자산 Network-First
   ─────────────────────────────────────────────
   Cache-First 전략은 코드를 업데이트해도
   서비스워커가 구버전(캐시된 파일)을 계속 반환하는
   문제를 일으킵니다.

   → JS/CSS/HTML : Network-First + 캐시 폴백
   → CSV 데이터  : Network-First + 캐시 폴백 (pathname 키)
   → 네트워크 실패 시에만 캐시 사용 (오프라인 대응)
───────────────────────────────────────────── */

const CACHE_NAME = 'apt-price-v8';

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll([
                './index.html',
                './css/common.css',
                './js/app.js',
            ])
        ).catch(() => {})
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(networkFirst(event.request, url));
});

async function networkFirst(request, url) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            if (url.pathname.endsWith('.csv')) {
                const cleanUrl = url.origin + url.pathname;
                cache.put(new Request(cleanUrl), response.clone());
            } else {
                cache.put(request, response.clone());
            }
        }
        return response;
    } catch {
        const cached = await findInCache(request, url);
        if (cached) return cached;
        return new Response('오프라인 상태입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

async function findInCache(request, url) {
    const direct = await caches.match(request);
    if (direct) return direct;
    if (url.pathname.endsWith('.csv')) {
        const cleanUrl = url.origin + url.pathname;
        return caches.match(new Request(cleanUrl));
    }
    return null;
}
