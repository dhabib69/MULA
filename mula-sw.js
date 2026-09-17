// v183 deliberately does not cache application responses. Versioned asset URLs
// in index.html let normal browser caching work without trapping the cashier UI
// or menu search on an old deployed script.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.indexOf('mula-') === 0).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});