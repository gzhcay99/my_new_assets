const CACHE_NAME = 'assethq-v2.4.1';
const ASSETS = [
  '/my_new_assets/',
  '/my_new_assets/index.html',
  '/my_new_assets/style.css',
  '/my_new_assets/script.js',
  '/my_new_assets/detail.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});