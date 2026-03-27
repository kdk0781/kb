// [수정] 날짜나 숫자를 조합해 매번 고유한 이름을 갖게 하면 업데이트가 더 확실합니다.
const CACHE_NAME = 'kb-interest-0781-v' + Date.now(); 
const urlsToCache = [
  './index.html',
  './style.css',
  './script.js',
  './interest.json'
];

// 1. 서비스 워커 설치 (새 파일 다운로드)
self.addEventListener('install', event => {
  // 대기 상태를 건너뛰고 즉시 새 버전으로 전환
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('최신 파일 캐싱 중...');
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. 서비스 워커 활성화 (오래된 캐시 삭제)
self.addEventListener('activate', event => {
  // 설치 즉시 페이지 제어권을 가져옴
  event.waitUntil(self.clients.claim());
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 현재 CACHE_NAME과 다른 옛날 캐시는 모두 삭제
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. 파일 요청 시 응답 로직
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // 캐시에 있으면 캐시 파일 사용, 없으면 네트워크에서 가져옴
      return response || fetch(event.request);
    })
  );
});
