/* Cache the application shell only. Auth, records and API responses never enter this cache. */
const CACHE = 'batchlight-shell-v1';
const SCOPE = new URL('./', self.location.href).pathname;
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('batchlight-shell-') && key !== CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith(SCOPE + 'api/')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          }
          return response;
        })
        .catch(() => caches.match(SCOPE, { ignoreVary: true })),
    );
    return;
  }
  if (
    url.pathname.startsWith(SCOPE + 'assets/') ||
    url.pathname.startsWith(SCOPE + 'samples/') ||
    [SCOPE + 'icon.svg', SCOPE + 'manifest.webmanifest'].includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
