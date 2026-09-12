/* Kade/Funkin HTML5 diagnostics. Enable with game.html?debug=1. */
(() => {
  const enabled = new URLSearchParams(location.search).has('debug') || localStorage.getItem('funkin-debug') === '1';
  if (!enabled) return;

  const startedAt = performance.now();
  const events = [];
  const errorEvents = [];
  const original = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    fetch: window.fetch.bind(window)
  };
  const clean = value => {
    try {
      if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`;
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    } catch (_) { return String(value); }
  };
  const isErrorType = type => /error|rejection|timeout|failed|exception/i.test(type);
  const add = (type, data) => {
    const event = {time: Math.round(performance.now() - startedAt), type, data};
    events.push(event);
    if (isErrorType(type)) errorEvents.push(event);
    if (events.length > 1000) events.shift();
    if (errorEvents.length > 300) errorEvents.shift();
    render();
  };
  const captureConsole = (level, originalFn) => (...args) => {
    const message = args.map(clean).join(' ');
    add(`console.${level}`, message);
    originalFn(...args);
  };
  console.error = captureConsole('error', original.error);
  console.warn = captureConsole('warn', original.warn);
  console.info = captureConsole('info', original.info);
  console.log = captureConsole('log', original.log);

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window) {
      add('resource.error', {url: target.src || target.href || '', tag: target.tagName, message: 'resource failed'});
    } else {
      add('window.error', {message: event.message, file: event.filename, line: event.lineno, column: event.colno, stack: clean(event.error)});
    }
  }, true);
  window.addEventListener('unhandledrejection', event => {
    add('unhandledrejection', {reason: clean(event.reason), promise: String(event.promise)});
  });

  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const begin = performance.now();
    const timeoutMs = 12000;
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Debug fetch timeout after ${timeoutMs}ms: ${url}`)), timeoutMs);
      });
      const response = await Promise.race([original.fetch(...args), timeout]);
      clearTimeout(timer);
      const ms = Math.round(performance.now() - begin);
      const detail = {url, status: response.status, ok: response.ok, type: response.headers.get('content-type'), bytes: response.headers.get('content-length'), ms};
      if (/songs|data|icon-|manifest/i.test(url) || !response.ok || ms > 3000) add(response.ok ? 'fetch' : 'fetch.error', detail);
      return response;
    } catch (error) {
      clearTimeout(timer);
      add(error.message.includes('timeout') ? 'fetch.timeout' : 'fetch.error', {url, error: clean(error), ms: Math.round(performance.now() - begin)});
      throw error;
    }
  };

  const panel = document.createElement('details');
  panel.id = 'kade-debug-panel';
  panel.open = true;
  panel.innerHTML = `<summary>Kade Debug <span data-role="error-count"></span></summary><div class="kade-debug-actions"><button data-action="song">Test bopeebo</button><button data-action="verify">Verify body</button><button data-action="errors">Errors only</button><button data-action="all">All logs</button><button data-action="download">Download log</button><button data-action="clear">Clear</button></div><pre></pre>`;
  const style = document.createElement('style');
  style.textContent = '#kade-debug-panel{position:fixed;z-index:10000;left:8px;bottom:8px;width:min(760px,calc(100vw - 16px));max-height:52vh;background:#10131ded;color:#d7f9ff;border:1px solid #49d9ff;border-radius:6px;font:12px/1.35 monospace;box-shadow:0 4px 20px #0008}#kade-debug-panel summary{cursor:pointer;padding:6px;font-weight:bold;background:#123946}#kade-debug-panel [data-role=error-count]{color:#ff8b8b;margin-left:8px}#kade-debug-panel pre{margin:0;padding:6px;max-height:38vh;overflow:auto;white-space:pre-wrap;word-break:break-word}.kade-debug-actions{display:flex;flex-wrap:wrap;gap:5px;padding:5px}.kade-debug-actions button{background:#1e5362;color:#fff;border:1px solid #75eaff;border-radius:3px;padding:5px 7px;cursor:pointer;touch-action:manipulation}';
  document.head.appendChild(style);
  document.body.appendChild(panel);
  const pre = panel.querySelector('pre');
  let mode = 'all';
  const render = () => {
    if (!pre) return;
    const list = mode === 'errors' ? errorEvents : events;
    pre.textContent = list.slice(-120).map(e => `[${String(e.time).padStart(6)}ms] ${e.type} ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}`).join('\n');
    panel.querySelector('[data-role=error-count]').textContent = errorEvents.length ? `Errors: ${errorEvents.length}` : 'Errors: 0';
  };
  const save = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const resourceSnapshot = () => performance.getEntriesByType('resource').map(entry => ({name: entry.name, duration: Math.round(entry.duration), size: entry.transferSize || 0, kind: entry.initiatorType}));
  const testKadeSong = async (song = 'bopeebo') => {
    const base = `assets/songs/${song}`;
    const paths = [`assets/preload/data/songs/${song}/${song}.json`, `${base}/Inst.mp3`, `${base}/Voices.mp3`, `assets/preload/images/icons/icon-bf.png`];
    const results = [];
    for (const path of paths) {
      const begin = performance.now();
      try {
        const response = await original.fetch(path, {cache: 'no-store'});
        const body = await response.arrayBuffer();
        results.push({path, status: response.status, ok: response.ok, type: response.headers.get('content-type'), bytes: body.byteLength, ms: Math.round(performance.now() - begin)});
        if (!response.ok) add('song.test.error', results.at(-1));
      } catch (error) {
        results.push({path, error: clean(error), ms: Math.round(performance.now() - begin)});
        add('song.test.error', results.at(-1));
      }
    }
    add('song.test', results);
    return results;
  };
  const verifyKadeBodies = async () => {
    const paths = ['assets/data/freeplaySonglist.txt', 'assets/data/bopeebo/bopeebo.json', 'assets/data/bopeebo/bopeebo-easy.json', 'assets/data/bopeebo/bopeebo-hard.json'];
    const results = [];
    for (const path of paths) {
      const begin = performance.now();
      try {
        const response = await original.fetch(`${path}?bodyCheck=${Date.now()}`, {cache: 'no-store'});
        const text = await response.text();
        const result = {path, status: response.status, ok: response.ok, contentType: response.headers.get('content-type'), contentLength: response.headers.get('content-length'), bodyChars: text.length, bodyBytes: new TextEncoder().encode(text).byteLength, startsWith: text.slice(0, 120), ms: Math.round(performance.now() - begin)};
        if (/\.json$/i.test(path)) {
          try { const parsed = JSON.parse(text); result.jsonSongKeys = parsed.song ? Object.keys(parsed.song) : null; }
          catch (error) { result.jsonError = error.message; }
        }
        results.push(result);
      } catch (error) { results.push({path, error: clean(error), ms: Math.round(performance.now() - begin)}); }
    }
    add('body.verify', results);
    return results;
  };
  window.FunkinDebug = {
    events, errors: errorEvents, testKadeSong, verifyKadeBodies,
    snapshot: () => ({config: localStorage.getItem('funkin-html-editor'), errors: errorEvents, events, resources: resourceSnapshot()}),
    download: () => save(`funkin-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, window.FunkinDebug.snapshot()),
    clear: () => { events.length = 0; errorEvents.length = 0; render(); }
  };
  panel.addEventListener('click', event => {
    const action = event.target.dataset.action;
    if (action === 'song') testKadeSong();
    if (action === 'verify') verifyKadeBodies();
    if (action === 'errors') { mode = 'errors'; render(); }
    if (action === 'all') { mode = 'all'; render(); }
    if (action === 'download') window.FunkinDebug.download();
    if (action === 'clear') window.FunkinDebug.clear();
  });
  add('debug.start', {url: location.href, userAgent: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, online: navigator.onLine});
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (/songs|data|icon-|manifest/i.test(entry.name) || entry.duration > 3000) add('resource', {url: entry.name, ms: Math.round(entry.duration), size: entry.transferSize || 0, kind: entry.initiatorType});
    }
  }).observe({type: 'resource', buffered: true});
})();
