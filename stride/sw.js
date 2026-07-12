/* Stride service worker — app-shell caching so the app opens offline. */
var CACHE = 'stride-shell-v1';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Map tiles and other cross-origin requests go straight to the network —
  // OSM tiles must not be cached here (tile usage policy) and fail gracefully.
  if (url.origin !== location.origin) return;

  // SPA navigations always get the shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(function (hit) {
        return hit || fetch(req);
      })
    );
    return;
  }

  // Shell assets: cache-first, falling back to (and refreshing from) network.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
