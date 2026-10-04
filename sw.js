// Offline support: serve from cache, refresh cache in the background.
// Cache is named after APP_VERSION (js/version.js): bumping it ships a release.
importScripts('js/version.js');
const CACHE = `cube-timer-v${self.APP_VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/version.js',
  'js/main.js',
  'js/timer.js',
  'js/store.js',
  'js/stats.js',
  'js/scramble.js',
  'js/format.js',
  'js/ui.js',
  'js/settings.js',
  'js/wakelock.js',
  'js/confetti.js',
  'js/progress.js',
  'js/chart.js',
  'js/statsview.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
