// Service worker: lets FlexiTime install as an app and open without a connection.
// The app page is fetched network-first so new deploys show up immediately;
// the Google Apps Script sync requests are never cached.
var CACHE = 'flexitime-v1';
var APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
var CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', function(event) {
    event.waitUntil(caches.open(CACHE).then(function(cache) { return cache.addAll(APP_SHELL); }));
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
        }).then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);

    if (url.origin === self.location.origin) {
        // Network first, fall back to cache when offline
        event.respondWith(
            fetch(req).then(function(res) {
                var copy = res.clone();
                caches.open(CACHE).then(function(cache) { cache.put(req, copy); });
                return res;
            }).catch(function() {
                return caches.match(req, { ignoreSearch: true }).then(function(hit) {
                    return hit || caches.match('./index.html');
                });
            })
        );
    } else if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
        // Styles and icon fonts: serve from cache, refresh in the background
        event.respondWith(
            caches.match(req).then(function(hit) {
                var update = fetch(req).then(function(res) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function(cache) { cache.put(req, copy); });
                    return res;
                });
                return hit || update;
            })
        );
    }
});
