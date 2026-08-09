const CACHE_NAME = 'food-v3';

// Never hand respondWith() an undefined - a cache miss while offline must
// still resolve to a real Response or the page throws
// "Failed to convert value to 'Response'".
function offlineFallback(cached, kind) {
  if (cached) return cached;
  if (kind === 'html') {
    return new Response(
      '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title></head>' +
      '<body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 24px;color:#374151;">' +
      '<h2>Brak połączenia</h2><p>Ta strona nie jest jeszcze w pamięci. Połącz się i spróbuj ponownie.</p>' +
      '<p><a href="javascript:location.reload()" style="color:#3B82F6;">Retry</a></p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
  return new Response('', { status: 504 });
}

// App shell - cached on install so the app boots without any network
const PRECACHE_URLS = [
  '/js/htmx.min.js',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install - precache app shell, skip waiting immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Arkusz stylow celowo poza ta lista. Nazywa sie zawsze tak samo, wiec
// strategia "najpierw cache" potrafi podac wersje sprzed wdrozenia. Zdarzylo
// sie to 09.08.2026: przegladarka dostala arkusz z 24 regulami zamiast ponad
// stu i aplikacja wygladala jak goly HTML. Teraz idzie przez siec, a adres
// niesie skrot tresci, wiec i brzeg CDN nie poda starego pliku.
function isStaticAsset(pathname) {
  return pathname.startsWith('/js/') || pathname.startsWith('/icons/') ||
    pathname === '/manifest.json' || pathname === '/favicon.svg' || pathname === '/favicon.ico';
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Videos - don't cache at all (range requests cause issues)
  if (url.pathname.startsWith('/videos/') || url.pathname.startsWith('/r2-videos/')) {
    return; // Let browser handle videos normally
  }

  // Static assets - cache first (versioned by CACHE_NAME bump on deploy)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => offlineFallback(null, 'asset'))
    );
    return;
  }

  // API - network first, fall back to last-known data when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          return cached || new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }))
    );
    return;
  }

  // HTML pages - network first, fallback to cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => offlineFallback(cached, 'html')))
    );
    return;
  }

  // Default - network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => offlineFallback(cached, 'other'))
    )
  );
});
