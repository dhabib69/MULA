// Keep the app current. Older releases registered a Blob service worker that
// cached unversioned HTML and JavaScript, which could leave the cashier UI
// stuck on an old modal even after a deployment.
const CACHE = 'mula-v183';

if ('serviceWorker' in navigator) {
  (async function () {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.indexOf('mula-') === 0).map(key => caches.delete(key)));
      }

      await navigator.serviceWorker.register('/mula-sw.js?v=183', { scope: '/' });
    } catch (error) {
      // The app remains usable when service workers are unavailable.
    }
  })();
}