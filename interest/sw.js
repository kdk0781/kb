const CACHE_NAME = 'kb-interest-v2';
const urlsToCache = [
  '/kb/interest/index.html',
  '/kb/interest/style.css',
  '/kb/interest/script.js',
  '/kb/interest/interest.json'
];

// 서비스 워커 설치
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// fetch 이벤트 (이 로직이 있어야 설치 팝업이 뜹니다)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// 활성화 및 이전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});