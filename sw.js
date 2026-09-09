const CDN = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/';
const CACHE_NAME = 'funkin-assets-v2';
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
  const candidates = [];
  if (modBase) candidates.push(modBase + relativePath);
  // The official web build's bundled assets are primarily in preload.
  // Try the common path first, then shared only when necessary.
  candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath);
  const cache = await caches.open(CACHE_NAME);
  for (const url of candidates) {
    const cached = await cache.match(url);
    if (cached) return cached;
    try {
      const response = await fetch(url, {mode: 'cors', credentials: 'omit'});
      if (response.ok) {
        // Cache successful assets so a second launch is substantially faster.
        eventlessCachePut(cache, url, response.clone());
        return response;
      }
    } catch (_) {}
  }
  return new Response('Official asset not found: ' + relativePath, {
    status: 404,
    headers: {'Content-Type': 'text/plain; charset=utf-8'}
  });
}

function eventlessCachePut(cache, url, response) {
  cache.put(url, response).catch(() => {});
}
