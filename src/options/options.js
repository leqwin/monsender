'use strict';
(function () {
  const { storage, perms, api, outcome, urls } = self.ML;
  const $ = (id) => document.getElementById(id);
  let lastSavedUrl = '';

  function setFlash(msg, cls) {
    const f = $('flash');
    f.textContent = msg || '';
    f.className = msg ? 'flash ' + cls : '';
  }

  function setConn(state, label) {
    const c = $('conn');
    c.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'dot dot-' + state;
    const txt = document.createElement('span');
    txt.textContent = ' ' + label;
    c.appendChild(dot);
    c.appendChild(txt);
  }

  function clampInt(v, lo, hi, dflt) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  }

  const normalizeUrl = urls.normalizeUrl;

  async function load() {
    const s = await storage.getSettings();
    $('baseUrl').value = s.baseUrl;
    $('token').value = '';
    $('token').placeholder = s.token ? '(set - leave blank to keep)' : '(not set)';
    $('wait').value = s.waitSeconds;
    $('scanCap').value = s.scanCap;
    $('minSize').value = s.minImageSize;
    $('previews').checked = s.previews;
    lastSavedUrl = s.baseUrl;
  }

  function readForm() {
    const patch = {
      waitSeconds: clampInt($('wait').value, 0, 60, 20),
      scanCap: clampInt($('scanCap').value, 1, 1000, 100),
      minImageSize: clampInt($('minSize').value, 0, 4000, 64),
      previews: $('previews').checked
    };
    const token = $('token').value;
    if (token) patch.token = token; // keep existing unless a new one is typed
    return patch;
  }

  async function cfgFromForm() {
    const s = await storage.getSettings();
    return {
      baseUrl: normalizeUrl($('baseUrl').value) || s.baseUrl,
      token: $('token').value || s.token
    };
  }

  async function save() {
    const url = normalizeUrl($('baseUrl').value);
    $('baseUrl').value = url;
    if (!url) { setFlash('set a monloader URL first', 'flash-err'); return; }

    let granted = true;
    try {
      const oldUrl = lastSavedUrl && lastSavedUrl !== url ? lastSavedUrl : null;
      granted = await perms.syncOrigin(url, oldUrl);
    } catch (e) { granted = false; }
    if (!granted) {
      setFlash('host access for ' + url + ' was not granted; monloader cannot be reached until you allow it', 'flash-warn');
    }

    const patch = readForm();
    patch.baseUrl = url;
    const saved = await storage.setSettings(patch);
    lastSavedUrl = saved.baseUrl;
    $('token').value = '';
    $('token').placeholder = saved.token ? '(set - leave blank to keep)' : '(not set)';
    if (granted) setFlash('saved', 'flash-ok');
    // Always refresh the dot: when the grant was denied, test() short-circuits
    // to the "allow host access" state instead of leaving a stale indicator.
    test();
  }

  async function test() {
    const cfg = await cfgFromForm();
    if (!cfg.baseUrl) { setConn('down', 'no URL'); return; }
    setConn('checking', 'checking');
    try {
      if (!(await perms.hasOrigin(cfg.baseUrl))) { setConn('down', 'allow host access (save first)'); return; }
    } catch (e) { /* fall through */ }
    const h = await api.health(cfg);
    // Always probe the authed endpoint - monloader may require a token we lack.
    const authed = await api.listQueue(cfg, { limit: 1 });
    const state = outcome.connState(h, authed);
    if (state === 'ok') {
      const v = (h.data && h.data.version) || '?';
      const g = (h.data && h.data.gallerydl_version) || '?';
      setConn('ok', 'monloader ' + v + ' / gallery-dl ' + g);
    } else if (state === 'rejected') {
      setConn('rejected', 'token rejected');
    } else {
      setConn('down', 'unreachable');
    }
  }

  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);

  // Scripts are at the end of <body>, so the DOM above exists. Init now.
  load().then(test);
})();
