// 기본적인 서비스 워커 (캐싱 로직은 생략된 최소 버전)
self.addEventListener('install', (e) => {
    console.log('서비스 워커 설치됨');
});

self.addEventListener('fetch', (e) => {
    // 네트워크 요청을 가로채서 처리하는 곳 (기본은 통과)
});