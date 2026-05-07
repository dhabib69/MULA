if('serviceWorker' in navigator){
  const swCode = `const CACHE = 'mula-v17';
const ASSETS = ['/', '/index.html', '/assets/css/mula.css', '/assets/js/01-platform.js', '/assets/js/02-menu-data.js', '/assets/js/03-app-state.js', '/assets/js/04-dashboard.js', '/assets/js/05-printing.js', '/assets/js/06-checkout.js', '/assets/js/07-guest-view.js', '/assets/js/mula-sw-register.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('firebasedatabase.app') || e.request.url.includes('firebaseio.com') || e.request.url.includes('gstatic.com')) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});`;
  const blob = new Blob([swCode], {type:'text/javascript'});
  const url = URL.createObjectURL(blob);
  navigator.serviceWorker.register(url).catch(()=>{});
}
