const CDN = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/';
const CACHE_NAME = 'funkin-assets-v13';
let modBase = '';
let fontUrl = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/fonts/vcr-bold.ttf';
let engine = 'official';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'set-mod-base') modBase = String(event.data.base || '').replace(/\/$/, '') + (event.data.base ? '/' : '');
  if (event.data.type === 'set-font-url') fontUrl = String(event.data.url || '');
  if (event.data.type === 'set-engine') engine = String(event.data.engine || 'official');
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (/\/favicon\.svg$/i.test(requestUrl.pathname)) {
    event.respondWith(faviconSvg());
    return;
  }
  if (requestUrl.pathname.includes('/manifest/') || requestUrl.pathname.includes('manifest/')) {
    const manifestName = requestUrl.pathname.slice(requestUrl.pathname.lastIndexOf('/manifest/') + 10);
    event.respondWith(resolveManifest(manifestName));
    return;
  }
  const marker = '/assets/';
  let relativePath = '';
  if (requestUrl.pathname.includes(marker)) relativePath = decodeURIComponent(requestUrl.pathname.slice(requestUrl.pathname.indexOf(marker) + marker.length));
  else if (requestUrl.pathname.includes('/flixel/')) relativePath = decodeURIComponent(requestUrl.pathname.slice(requestUrl.pathname.indexOf('/flixel/') + 1));
  else if (/\/(default|circle|diamond|square|diagonal_gradient|button)\.png$/i.test(requestUrl.pathname) || /\/vcr-bmp\.(fnt|png)$/i.test(requestUrl.pathname)) relativePath = decodeURIComponent(requestUrl.pathname.split('/').pop());
  else return;
  event.respondWith(resolveAsset(relativePath));
});

async function resolveAsset(relativePath) {
  const basename = relativePath.split('/').pop();
  const isFont = /\.(ttf|otf|woff2?)$/i.test(basename);
  const candidates = [];
  const legacy = {'default.png':'preload/images/fonts/default.png','circle.png':'preload/images/pauseCircle.png','button.png':'preload/images/backButton.png','vcr-bmp.fnt':'fonts/vcr-bmp.fnt','vcr-bmp.png':'fonts/vcr-bmp.png','flixel.mp3':'preload/sounds/CS_select.mp3','beep.mp3':'preload/sounds/CS_select.mp3'};
  const isOfficialVcr = /^vcr(?:-bold)?\.ttf$/i.test(basename);
  // Keep the engine's own VCR face on desktop; replacing vcr.ttf with a UI
  // font changes Canvas/Lime glyph metrics and makes the game look wrong.
  if (fontUrl && isFont && !isOfficialVcr && (relativePath.startsWith('fonts/') || relativePath.startsWith('flixel/fonts/'))) candidates.push(fontUrl);
  if (modBase) candidates.push(modBase + relativePath);
  if (legacy[basename]) candidates.push(CDN + legacy[basename]);
  if (relativePath.startsWith('fonts/')) candidates.push(CDN + relativePath);
  // Map the engine's virtual assets/data path directly to the official CDN.
  // This avoids waiting for several guaranteed 404 fallbacks on desktop.
  if (relativePath.startsWith('data/')) candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath, CDN + relativePath);
  else if (relativePath.startsWith('images/')) candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath, CDN + relativePath);
  else if (relativePath.startsWith('songs/')) candidates.push(CDN + relativePath, CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath);
  else if (relativePath.startsWith('music/') || relativePath.startsWith('sounds/')) candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath, CDN + relativePath);
  else if (/^(preload|shared|week\d+|weekend\d+)\//i.test(relativePath)) candidates.push(CDN + relativePath);
  else candidates.push(CDN + 'preload/' + relativePath, CDN + 'shared/' + relativePath);
  const cache = await caches.open(CACHE_NAME);
  for (const url of candidates) {
    const cached = await cache.match(url);
    if (cached) return cached;
    try {
      const response = await fetch(url, {mode:'cors', credentials:'omit'});
      if (response.ok) { cache.put(url, response.clone()).catch(() => {}); return response; }
    } catch (_) {}
  }
  if (/\.(png|jpg|jpeg|gif)$/i.test(basename)) return transparentPng();
  if (/\.(mp3|ogg|wav)$/i.test(basename)) return new Response('', {status:200,headers:{'Content-Type':'audio/mpeg'}});
  if (/\.json$/i.test(basename)) return new Response('{}', {status:200,headers:{'Content-Type':'application/json'}});
  return new Response('Official asset not found: '+relativePath, {status:404,headers:{'Content-Type':'text/plain;charset=utf-8'}});
}
async function resolveManifest(name){return resolveAsset('manifest/'+name)}
function transparentPng(){const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Response(bytes,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=31536000'}})}
function faviconSvg(){return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#171827"/><path d="M14 18h36v8H22v7h22v8H22v13h-8z" fill="#ff4fa3"/><circle cx="47" cy="47" r="6" fill="#43d9ff"/></svg>',{status:200,headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=31536000'}})}
