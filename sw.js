const CDN = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/';
const ROOTS = ['preload/', 'shared/', 'tutorial/', 'week1/', 'week2/', 'week3/', 'week4/', 'week5/', 'week6/', 'week7/', 'weekend1/'];
let modBase = '';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'set-mod-base') modBase = String(event.data.base || '').replace(/\/$/, '') + (event.data.base ? '/' : '');
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.includes('/assets/')) return;

  const marker = '/assets/';
  const relativePath = decodeURIComponent(requestUrl.pathname.slice(requestUrl.pathname.indexOf(marker) + marker.length));
  event.respondWith(resolveAsset(event.request, relativePath));
});

async function resolveAsset(originalRequest, relativePath) {
  if (modBase) {
    try {
      const modResponse = await fetch(modBase + relativePath, {mode: 'cors', credentials: 'omit'});
      if (modResponse.ok) return modResponse;
    } catch (_) {}
  }
  for (const root of ROOTS) {
    const url = CDN + root + relativePath;
    try {
      const response = await fetch(url, {mode: 'cors', credentials: 'omit'});
      if (response.ok) return response;
    } catch (_) {}
  }
  return new Response('Official asset not found: ' + relativePath, {
    status: 404,
    headers: {'Content-Type': 'text/plain; charset=utf-8'}
  });
}
