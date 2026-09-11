/* Kade/Funkin HTML5 diagnostics. Enable with game.html?debug=1. */
(() => {
  const enabled = new URLSearchParams(location.search).has('debug') || localStorage.getItem('funkin-debug') === '1';
  if (!enabled) return;

  const startedAt = performance.now();
  const events = [];
  const original = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    fetch: window.fetch.bind(window)
  };
  const clean = value => {
    try {
      if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`;
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    } catch (_) { return String(value); }
  };
  const add = (type, data) => {
    const event = {time: Math.round(performance.now() - startedAt), type, data};
    events.push(event);
    if (events.length > 500) events.shift();
    render();
  };
  console.error = (...args) => { add('console.error', args.map(clean).join(' ')); original.error(...args); };
  console.warn = (...args) => { add('console.warn', args.map(clean).join(' ')); original.warn(...args); };
  window.addEventListener('error', event => add('window.error', clean(event.error || event.message)));
  window.addEventListener('unhandledrejection', event => add('unhandledrejection', clean(event.reason)));
  window.addEventListener('resourceerror', event => add('resourceerror', clean(event.target?.src || event.target?.href || event)));

  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const begin = performance.now();
    try {
      const response = await original.fetch(...args);
      if (/songs|data|icon-|manifest/i.test(url) || !response.ok) {
        add('fetch', {url, status: response.status, type: response.headers.get('content-type'), ms: Math.round(performance.now() - begin)});
      }
      return response;
    } catch (error) {
      add('fetch.error', {url, error: clean(error), ms: Math.round(performance.now() - begin)});
      throw error;
    }
  };

  const panel = document.createElement('details');
  panel.id = 'kade-debug-panel';
  panel.open = true;
  panel.innerHTML = `<summary>Kade Debug</summary><div class="kade-debug-actions"><button data-action="song">Test bopeebo</button><button data-action="download">Download log</button><button data-action="clear">Clear</button></div><pre></pre>`;
  const style = document.createElement('style');
  style.textContent = '#kade-debug-panel{position:fixed;z-index:10000;left:8px;bottom:8px;width:min(720px,calc(100vw - 16px));max-height:45vh;background:#10131ddd;color:#d7f9ff;border:1px solid #49d9ff;border-radius:6px;font:12px/1.35 monospace;box-shadow:0 4px 20px #0008}#kade-debug-panel summary{cursor:pointer;padding:6px;font-weight:bold;background:#123946}#kade-debug-panel pre{margin:0;padding:6px;max-height:34vh;overflow:auto;white-space:pre-wrap;word-break:break-word}.kade-debug-actions{display:flex;gap:5px;padding:5px}.kade-debug-actions button{background:#1e5362;color:#fff;border:1px solid #75eaff;border-radius:3px;padding:3px 7px;cursor:pointer}';
  document.head.appendChild(style);
  document.body.appendChild(panel);
  const pre = panel.querySelector('pre');
  const render = () => {
    if (!pre) return;
    pre.textContent = events.slice(-80).map(e => `[${String(e.time).padStart(6)}ms] ${e.type} ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}`).join('\n');
  };
  const save = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const resourceSnapshot = () => performance.getEntriesByType('resource').map(entry => ({
    name: entry.name, duration: Math.round(entry.duration), size: entry.transferSize || 0,
    kind: entry.initiatorType
  }));
  const testKadeSong = async (song = 'bopeebo') => {
    const base = `assets/songs/${song}`;
    const paths = [
      `assets/preload/data/songs/${song}/${song}.json`,
      `${base}/Inst.mp3`, `${base}/Voices.mp3`,
      `assets/preload/images/icons/icon-bf.png`
    ];
    const results = [];
    for (const path of paths) {
      const begin = performance.now();
      try {
        const response = await original.fetch(path, {cache: 'no-store'});
        const body = await response.arrayBuffer();
        results.push({path, status: response.status, type: response.headers.get('content-type'), bytes: body.byteLength, ms: Math.round(performance.now() - begin)});
      } catch (error) {
        results.push({path, error: clean(error), ms: Math.round(performance.now() - begin)});
      }
    }
    add('song.test', results);
    return results;
  };
  window.FunkinDebug = {
    events, testKadeSong, snapshot: () => ({config: localStorage.getItem('funkin-html-editor'), events, resources: resourceSnapshot()}),
    download: () => save(`funkin-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, window.FunkinDebug.snapshot()),
    clear: () => { events.length = 0; render(); }
  };
  panel.addEventListener('click', event => {
    const action = event.target.dataset.action;
    if (action === 'song') testKadeSong();
    if (action === 'download') window.FunkinDebug.download();
    if (action === 'clear') window.FunkinDebug.clear();
  });
  add('debug.start', {url: location.href, userAgent: navigator.userAgent});
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (/songs|data|icon-|manifest/i.test(entry.name) || entry.duration > 3000) {
        add('resource', {url: entry.name, ms: Math.round(entry.duration), size: entry.transferSize || 0, kind: entry.initiatorType});
      }
    }
  }).observe({type: 'resource', buffered: true});
})();
