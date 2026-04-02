/* ─────────────────────────────────────────────
   아파트 시세표 | sw.js  v7.0
   전략:
   - 정적 자산(HTML/CSS/JS/이미지): Cache-First (설치 시 사전 캐시)
   - CSV 데이터: Network-First → 실패 시 캐시 폴백
     (타임스탬프 쿼리가 붙어 오기 때문에 URL 매칭은 pathname 기준)
───────────────────────────────────────────── */

const CACHE_NAME    = 'apt-price-v7';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/common.css',
    './js/app.js',
    '../ico/map192.png',
    '../ico/map512.png',
];

/* ── 설치: 정적 자산 사전 캐시 ── */
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

/* ── 활성화: 구버전 캐시 정리 ── */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/* ── 요청 처리 ── */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // CSV 파일: Network-First (항상 최신 데이터 우선)
    // pathname 기준 매칭 (타임스탬프 쿼리 파라미터 무시)
    if (url.pathname.includes('/excel/') && url.pathname.endsWith('.csv')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // 정적 자산: Cache-First
    event.respondWith(cacheFirst(event.request));
});

/* Network-First: 네트워크 성공 → 캐시 업데이트, 실패 → 캐시 반환 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        // CSV는 타임스탬프가 다르므로 pathname 기준 key로 저장
        const cacheUrl = new URL(request.url);
        cacheUrl.search = ''; // 쿼리 제거
        const cacheRequest = new Request(cacheUrl.toString());
        cache.put(cacheRequest, response.clone());
        return response;
    } catch {
        // 오프라인: 쿼리 없는 URL로 캐시에서 찾기
        const cacheUrl = new URL(request.url);
        cacheUrl.search = '';
        const cached = await caches.match(new Request(cacheUrl.toString()));
        return cached || new Response('데이터를 불러올 수 없습니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

/* Cache-First: 캐시 히트 → 반환, 미스 → 네트워크 후 캐시 업데이트 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
    } catch {
        return new Response('오프라인 상태입니다.', { status: 503 });
    }
}
