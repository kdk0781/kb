const CACHE_NAME = '0781_1';
const urlsToCache = [
  './index.html',
  './style.css',
  './script.js',
  './interest.json' // 매니페스트 파일명이 interest.json인지 확인 필요
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});