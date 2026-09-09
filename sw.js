const CDN = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/';
const CACHE_NAME = 'funkin-assets-v5';
let modBase = '';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'set-mod-base') {
    modBase = String(event.data.base || '').replace(/\/$/, '') + (event.data.base ? '/' : '');
  }
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const marker = '/assets/';
  let relativePath = '';
  if (requestUrl.pathname.includes(marker)) {
    relativePath = decodeURIComponent(requestUrl.pathname.slice(requestUrl.pathname.indexOf(marker) + marker.length));
  } else if (requestUrl.pathname.includes('/flixel/')) {
    relativePath = decodeURIComponent(requestUrl.pathname.slice(requestUrl.pathname.indexOf('/flixel/') + 1));
  } else if (/\/(default|circle|diamond|square|diagonal_gradient|button)\.png$/i.test(requestUrl.pathname) || /\/vcr-bmp\.(fnt|png)$/i.test(requestUrl.pathname)) {
    relativePath = decodeURIComponent(requestUrl.pathname.split('/').pop());
  } else return;

  event.respondWith(resolveAsset(relativePath));
});

async function resolveAsset(relativePath) {
  const candidates = [];
  if (modBase) candidates.push(modBase + relativePath);
  const basename = relativePath.split('/').pop();

  // Compatibility paths used by older Funkin.js / Flixel bundles.
  const legacy = {
    'default.png': 'preload/images/fonts/default.png',
    'circle.png': 'preload/images/pauseCircle.png',
    'button.png': 'preload/images/backButton.png',
    'vcr-bmp.fnt': 'fonts/vcr-bmp.fnt',
    'vcr-bmp.png': 'fonts/vcr-bmp.png',
    'flixel.mp3': 'preload/sounds/CS_select.mp3',
    'beep.mp3': 'preload/sounds/CS_select.mp3'
  };
  if (legacy[basename]) candidates.push(CDN + legacy[basename]);
  if (relativePath.startsWith('fonts/')) candidates.push(CDN + relativePath);

  // Most current official assets are in preload; shared is the fallback.
  candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath);
  const cache = await caches.open(CACHE_NAME);
  for (const url of candidates) {
    const cached = await cache.match(url);
    if (cached) return cached;
    try {
      const response = await fetch(url, {mode: 'cors', credentials: 'omit'});
      if (response.ok) {
        cache.put(url, response.clone()).catch(() => {});
        return response;
      }
    } catch (_) {}
  }

  // Old decorative textures are absent from the current official asset tree.
  if (/\.(png|jpg|jpeg|gif)$/i.test(basename)) return transparentPng();
  // Missing legacy Flixel sound files should not abort the asset preloader.
  if (/\.(mp3|ogg|wav)$/i.test(basename)) return new Response('', {status: 200, headers: {'Content-Type': 'audio/mpeg'}});
  return new Response('Official asset not found: ' + relativePath, {
    status: 404,
    headers: {'Content-Type': 'text/plain; charset=utf-8'}
  });
}

function transparentPng() {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));
  return new Response(bytes, {status: 200, headers: {'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000'}});
}
