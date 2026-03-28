/* ======================================================
   KB 금리표 · sw.js  v0781_7
   
   ⚠️ 이 파일은 반드시 navigator.serviceWorker.register()로만 등록할 것
      <script src="sw.js"> 로 로드하면 self.skipWaiting() 에서 TypeError 크래시 발생
   ====================================================== */

// ── 버전 문자열: 배포 시 수동으로 올릴 것
//    Date.now() 사용 금지 — SW가 설치될 때마다 새 캐시 생성 → 용량 무한 증가 버그
const VERSION    = '0781_7';
const CACHE_NAME = VERSION;

// 캐싱할 정적 파일 목록
const PRECACHE_URLS = [
    './index.html',
    './style.css',
    './script.js',
    './interest.json'
];

/* ======================================================
   install : 정적 파일 선캐싱 + 즉시 활성화
   ====================================================== */
self.addEventListener('install', event => {
    console.log(`[SW] install: ${CACHE_NAME}`);
    self.skipWaiting(); // 기존 SW 즉시 교체

    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // addAll 대신 개별 fetch — 일부 실패 시 전체 중단 방지
            return Promise.allSettled(
                PRECACHE_URLS.map(url =>
                    fetch(url, { cache: 'no-store' })
                        .then(res => {
                            if (res.ok) cache.put(url, res);
                        })
                        .catch(err => console.warn(`[SW] 캐싱 실패: ${url}`, err))
                )
            );
        })
    );
});

/* ======================================================
   activate : 이전 버전 캐시 전부 삭제
   ====================================================== */
self.addEventListener('activate', event => {
    console.log(`[SW] activate: ${CACHE_NAME}`);
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // 즉시 페이지 제어 획득
            caches.keys().then(names =>
                Promise.all(
                    names
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log(`[SW] 이전 캐시 삭제: ${name}`);
                            return caches.delete(name);
                        })
                )
            )
        ])
    );
});

/* ======================================================
   fetch : 요청 처리 전략
   
   · HTML → Network First (항상 최신 HTML 확보)
   · CSS/JS → Stale-While-Revalidate (빠른 응답 + 백그라운드 갱신)
   · 그 외 → Cache First → Network 폴백
   ====================================================== */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 외부 도메인(폰트 CDN 등) → 패스스루
    if (url.origin !== self.location.origin) return;

    // GET 요청만 캐싱
    if (request.method !== 'GET') return;

    const isHTML = request.headers.get('accept')?.includes('text/html');
    const isAsset = /\.(css|js|json)(\?.*)?$/.test(url.pathname);

    if (isHTML) {
        // ── HTML: Network First
        event.respondWith(networkFirst(request));
    } else if (isAsset) {
        // ── CSS/JS/JSON: Stale-While-Revalidate
        event.respondWith(staleWhileRevalidate(request));
    } else {
        // ── 이미지 등: Cache First
        event.respondWith(cacheFirst(request));
    }
});

/* ======================================================
   전략 함수
   ====================================================== */

/** Network First: 네트워크 성공 → 캐시 저장 / 실패 → 캐시 폴백 */
async function networkFirst(request) {
    try {
        const networkRes = await fetch(request, { cache: 'no-store' });
        if (networkRes.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkRes.clone());
        }
        return networkRes;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('오프라인 상태입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

/** Stale-While-Revalidate: 캐시 즉시 반환 + 백그라운드 갱신 */
async function staleWhileRevalidate(request) {
    const cache  = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    // 백그라운드 갱신 (결과 기다리지 않음)
    const revalidate = fetch(request)
        .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => null);

    return cached || revalidate;
}

/** Cache First: 캐시 우선 / 없으면 네트워크 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request);
        if (res.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, res.clone());
        }
        return res;
    } catch {
        return new Response('', { status: 404 });
    }
}
