const CDN = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/';
const CACHE_NAME = 'funkin-assets-v46';
let modBase = '';
let fontUrl = 'https://cdn.jsdelivr.net/gh/FunkinCrew/funkin.assets@main/fonts/vcr-bold.ttf';
let engine = 'official';
let runtimeBase = '';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'set-mod-base') modBase = String(event.data.base || '').replace(/\/$/,'') + (event.data.base ? '/' : '');
  if (event.data.type === 'set-font-url') fontUrl = String(event.data.url || '');
  if (event.data.type === 'set-engine') engine = String(event.data.engine || 'official');
  if (event.data.type === 'set-runtime-base') runtimeBase = String(event.data.base || '').replace(/\/$/,'') + (event.data.base ? '/' : '');
  if (event.ports && event.ports[0]) event.ports[0].postMessage({type:'settings-applied', setting:event.data.type});
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (/\/favicon\.svg$/i.test(requestUrl.pathname)) {
    event.respondWith(faviconSvg());
    return;
  }
  // These two root-level files are part of Kade's compiled preload list, but
  // are not guaranteed to be present while GitHub Pages is deploying. They
  // are informational only; never let them fail the Lime preload queue.
  const rootText = decodeURIComponent(requestUrl.pathname.split('/').pop() || '');
  if (rootText === 'do NOT readme.txt' || rootText === 'changelog.txt') {
    event.respondWith(new Response('', {status:200, headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}}));
    return;
  }
  // The Kade Web build requests this exact MP3, while the upstream repo only
  // ships freakyMenu.ogg. A Safari-compatible MP3 is committed locally; let
  // GitHub Pages serve it instead of routing the request to the OGG fallback.
  if (/\/assets\/music\/freakyMenu\.mp3$/i.test(requestUrl.pathname)) return;
  if (/\/assets\/images\/iconGrid\.png$/i.test(requestUrl.pathname)) return;
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
  else if ((engine === 'psych' || engine === 'kade') && /\.(txt|xml|json|mp3|ogg|wav|png|jpe?g|gif|ttf|otf|fnt)$/i.test(requestUrl.pathname)) relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/,''));
  else return;
  event.respondWith(resolveAsset(relativePath));
});

async function resolveAsset(relativePath) {
  // Lime/OpenFL Kade audio IDs use virtual prefixes such as songs:assets/songs/... .
  relativePath = relativePath.replace(/^[^:]+:assets\//i, '');
  const basename = relativePath.split('/').pop();
  const isFont = /\.(ttf|otf|woff2?)$/i.test(basename);
  const candidates = [];
  const kadeBase = runtimeBase || 'https://cdn.jsdelivr.net/gh/KadeArchive/Kade-Engine@stable/';
  const legacy = {'default.png':'preload/images/fonts/default.png','circle.png':'preload/images/pauseCircle.png','button.png':'preload/images/backButton.png','vcr-bmp.fnt':'fonts/vcr-bmp.fnt','vcr-bmp.png':'fonts/vcr-bmp.png','flixel.mp3':'preload/sounds/CS_select.mp3','beep.mp3':'preload/sounds/CS_select.mp3'};
  const isEngineFont = engine === 'psych' || engine === 'kade';
  const isOfficialVcr = /^vcr(?:-bold)?\.ttf$/i.test(basename);
  // Kade's compiled Lime bundle requests images/icons/icon-*.png, while the
  // repository stores the Freeplay sprites under assets/preload/images/icons.
  // Resolve that exact path first so a generic fallback cannot be used for a
  // Kade Freeplay icon.
  if (/^images\/icons\/icon-[^/]+\.png$/i.test(relativePath)) {
    // Kade icons are 300x150 two-frame PNGs. Do not let a failed icon request
    // fall through to alphabet/symbol or generic image candidates.
    const iconUrl = 'https://cdn.jsdelivr.net/gh/KadeArchive/Kade-Engine@stable/assets/preload/' + relativePath;
    const iconCache = await caches.open(CACHE_NAME);
    const iconCached = await iconCache.match(iconUrl);
    if (iconCached && isImageResponse(iconCached)) return iconCached;
    try {
      const iconResponse = await fetch(iconUrl, {mode:'cors', credentials:'omit', signal:AbortSignal.timeout(15000)});
      if (iconResponse.ok && isImageResponse(iconResponse)) {
        iconCache.put(iconUrl, iconResponse.clone()).catch(() => {});
        return iconResponse;
      }
    } catch (_) {}
    return transparentPng();
  }
  // Kade stores chart metadata below assets/preload/data/songs and gameplay
  // audio below assets/songs. These paths are requested through Lime's
  // virtual `data/...` and `songs/...` names when a song starts; resolve them
  // before the generic candidates to avoid a long chain of failed requests.
  if (engine === 'kade') {
    const chartMatch = relativePath.match(/^data\/([^/]+)\/([^/]+)\.json$/i);
    if (chartMatch) {
      const song = chartMatch[1];
      const chart = chartMatch[2];
      candidates.push(kadeBase + 'assets/preload/data/songs/' + song + '/' + chart + '.json');
    } else if (/^data\/songs\//i.test(relativePath)) {
      candidates.push(kadeBase + 'assets/preload/data/songs/' + relativePath.slice('data/songs/'.length));
    } else if (/^data\/[^/]+\//i.test(relativePath)) {
      candidates.push(kadeBase + 'assets/preload/data/' + relativePath.slice(5));
    } else if (/^songs\//i.test(relativePath)) {
      candidates.push(kadeBase + 'assets/' + relativePath);
    }
  }
  // Keep the engine's own VCR face on desktop; replacing vcr.ttf with a UI
  // font changes Canvas/Lime glyph metrics and makes the game look wrong.
  if (isEngineFont && runtimeBase && isFont) candidates.push(runtimeBase + relativePath, runtimeBase + 'assets/' + relativePath);
  if (fontUrl && isFont && !isEngineFont && !isOfficialVcr && (relativePath.startsWith('fonts/') || relativePath.startsWith('flixel/fonts/'))) candidates.push(fontUrl);
  if (modBase) candidates.push(modBase + relativePath);
  if (runtimeBase) {
    if (engine === 'psych') candidates.push(runtimeBase + 'assets/' + relativePath, runtimeBase + 'shared/' + relativePath, runtimeBase + relativePath);
    else if (engine === 'kade') {
      candidates.push(runtimeBase + 'assets/preload/' + relativePath, runtimeBase + 'assets/' + relativePath, runtimeBase + 'preload/' + relativePath, runtimeBase + relativePath);
      if (/^music\/.*\.mp3$/i.test(relativePath)) candidates.push(runtimeBase + 'assets/preload/' + relativePath.replace(/\.mp3$/i, '.ogg'));
    }
    else candidates.push(runtimeBase + relativePath);
  }
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
    if (cached && (!isImagePath(basename) || isImageResponse(cached))) return cached;
    try {
      // Psych Engine のスプライトシートは数MBになるため、短いタイムアウトで
      // 打ち切ると正常な画像を透明PNGへフォールバックして Lime が失敗する。
      const timeout = /\.(png|jpg|jpeg|gif|webp)$/i.test(basename) ? 15000 : 5000;
      const response = await fetch(url, {mode:'cors', credentials:'omit', signal:AbortSignal.timeout(timeout)});
      if (response.ok && (!isImagePath(basename) || isImageResponse(response))) {
        cache.put(url, response.clone()).catch(() => {});
        return response;
      }
    } catch (_) {}
  }
  if (/\.(png|jpg|jpeg|gif)$/i.test(basename)) return transparentPng();
  // OpenFL/Lime waits for a completion event for every queued asset. Returning
  // a 404 (or an empty audio body) for an optional legacy asset can leave the
  // final loading screen waiting forever. Use a tiny valid silent WAV so the
  // request still completes and keep JSON syntactically valid for optional
  // metadata files.
  if (/\.(mp3|ogg|wav)$/i.test(basename)) return silentWav();
  if (/\.json$/i.test(basename)) return new Response('{}', {status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  // Older song builds request optional dialogue, credits, and atlas files
  // that are not present in the current official asset repository. A 404
  // makes Lime's preload queue throw an uncaught exception after song select.
  if (/\.(txt|hxc)$/i.test(basename)) return new Response('', {status:200,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
  if (/\.xml$/i.test(basename)) return new Response('<root/>', {status:200,headers:{'Content-Type':'application/xml','Cache-Control':'no-store'}});
  if (engine === 'psych' || engine === 'kade') return new Response('', {status:200,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
  return new Response('Official asset not found: '+relativePath, {status:404,headers:{'Content-Type':'text/plain;charset=utf-8'}});
}
function isImagePath(name) { return /\.(png|jpg|jpeg|gif|webp)$/i.test(name); }
function isImageResponse(response) {
  return /^image\/(png|jpeg|gif|webp)(?:;|$)/i.test(response.headers.get('content-type') || '');
}
async function resolveManifest(name){
  if (engine === 'kade') return buildKadeManifest(name);
  const candidates = [];
  if (modBase) candidates.push(modBase + 'manifest/' + name);
  if (runtimeBase) {
    candidates.push(runtimeBase + 'manifest/' + name);
  }
  const cache = await caches.open(CACHE_NAME);
  for (const url of candidates) {
    const cached = await cache.match(url);
    if (cached) return cached;
    try {
      const response = await fetch(url, {mode:'cors', credentials:'omit', signal:AbortSignal.timeout(2500)});
      if (response.ok) {
        cache.put(url, response.clone()).catch(() => {});
        return response;
      }
    } catch (_) {}
  }
  return new Response(`Kade manifest not found: ${name}`, {
    status: 404,
    headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}
  });
}
async function buildKadeManifest(name){
  const library = String(name).replace(/\.json$/i,'').replace(/[^a-z0-9_-]/gi,'');
  const allowed = new Set(['songs','shared','week1','week2','week3','week4','week5','week6','tutorial','sm']);
  if (!allowed.has(library)) return kadeManifestResponse(library, []);
  try {
    const r = await fetch('https://api.github.com/repos/KadeArchive/Kade-Engine/git/trees/stable?recursive=1', {mode:'cors', credentials:'omit', signal:AbortSignal.timeout(10000)});
    if (!r.ok) throw new Error('tree '+r.status);
    const tree = await r.json();
    const cdn = 'https://cdn.jsdelivr.net/gh/KadeArchive/Kade-Engine@stable/';
    const assets = (tree.tree || []).filter(x => x.type === 'blob' && x.path.startsWith('assets/'+library+'/') && !/\.ogg$/i.test(x.path)).map(x => ({id:x.path,path:cdn+x.path,type:kadeAssetType(x.path),preload:false,size:1}));
    return kadeManifestResponse(library, assets);
  } catch (_) { return kadeManifestResponse(library, []); }
}
function kadeManifestResponse(name, assets){
  return new Response(JSON.stringify({version:3,name,assets,rootPath:null,libraryArgs:[],libraryType:null}), {status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
function kadeAssetType(path){
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(path)) return 'IMAGE';
  if (/\.(mp3|ogg|wav|flac|m4a)$/i.test(path)) return /\/music\//i.test(path) ? 'MUSIC' : 'SOUND';
  if (/\.(ttf|otf|woff2?)$/i.test(path)) return 'FONT';
  if (/\.(txt|json|xml|hx|lua|hscript|md)$/i.test(path)) return 'TEXT';
  return 'BINARY';
}
function transparentPng(){const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Response(bytes,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=31536000'}})}
function silentWav(){const bytes=Uint8Array.from(atob('UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAESEAAABAAgAZGF0YQAAAAAA'),c=>c.charCodeAt(0));return new Response(bytes,{status:200,headers:{'Content-Type':'audio/wav','Cache-Control':'public,max-age=31536000'}})}
function faviconSvg(){return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#171827"/><path d="M14 18h36v8H22v7h22v8H22v13h-8z" fill="#ff4fa3"/><circle cx="47" cy="47" r="6" fill="#43d9ff"/></svg>',{status:200,headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=31536000'}})}
