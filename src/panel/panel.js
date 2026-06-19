'use strict';
(function () {
  const { storage, api, outcome, render } = self.ML;
  const $ = (id) => document.getElementById(id);
  let cfg = { baseUrl: '', token: '' };
  let scan = null;

  function setConn(state, label) {
    const c = $('conn');
    c.textContent = '';
    const d = document.createElement('span');
    d.className = 'dot dot-' + state;
    const t = document.createElement('span');
    t.textContent = ' ' + label;
    c.appendChild(d); c.appendChild(t);
  }

  async function init() {
    const s = await storage.getSettings();
    cfg = { baseUrl: s.baseUrl, token: s.token };
    if (!cfg.baseUrl) {
      setConn('down', 'set monloader URL');
      $('scanhead').textContent = 'set your monloader URL in options';
      return;
    }
    refreshConn();
    watchScan();
    // Show the most recent scan immediately; watchScan swaps in a fresh one
    // when the background stores it (e.g. right after the popup's "scan page").
    scan = await storage.getScan();
    renderChooser();
  }

  // Re-render when the background stores a new scan, so re-scanning refreshes an
  // already-open panel instead of showing the previous results.
  function watchScan() {
    browser.storage.onChanged.addListener((changes) => {
      const sc = changes.lastScan && changes.lastScan.newValue;
      if (sc && Array.isArray(sc.items)) { scan = sc; renderChooser(); }
    });
  }

  async function refreshConn() {
    const h = await api.health(cfg);
    // Always probe the authed endpoint - monloader may require a token we lack.
    const authed = await api.listQueue(cfg, { limit: 1 });
    const st = outcome.connState(h, authed);
    setConn(st, st === 'ok' ? 'connected' : (st === 'rejected' ? 'token rejected' : 'unreachable'));
  }

  function renderChooser() {
    const grid = $('grid');
    grid.textContent = '';
    const su = $('scanurl');
    if (scan && scan.url) {
      $('scanUrl').textContent = scan.url;
      $('scanUrl').title = scan.url;
      su.hidden = false;
    } else {
      su.hidden = true;
    }
    if (!scan || !scan.items || !scan.items.length) {
      $('scanhead').textContent = scan ? 'no images found' : 'no scan yet - start a scan from the popup';
      updateSendBtn();
      return;
    }
    $('scanhead').textContent = 'scan: ' + scan.shown + (scan.truncated ? ' of ' + scan.total : '') + ' images';
    for (const item of scan.items) {
      const card = render.imageCard(document, item, { previews: scan.previews });
      const cb = card.querySelector('input.pick');
      if (cb) cb.addEventListener('change', updateSendBtn);
      grid.appendChild(card);
    }
    updateSendBtn();
  }

  function picked() {
    return Array.from(document.querySelectorAll('input.pick:checked')).map((c) => c.getAttribute('data-url'));
  }
  function selectable() {
    return Array.from(document.querySelectorAll('input.pick:not(:disabled)'));
  }
  function setSact(id, on) {
    const e = $(id);
    e.classList.toggle('disabled', !on);
    e.setAttribute('aria-disabled', String(!on));
  }
  function updateSendBtn() {
    const sel = selectable();
    const n = sel.filter((c) => c.checked).length;
    $('sendSel').textContent = 'send selected (' + n + ')';
    $('sendSel').disabled = n === 0;
    setSact('selNone', n > 0);
    setSact('selAll', sel.length > 0 && n < sel.length);
  }
  function selectAll() {
    selectable().forEach((c) => { c.checked = true; });
    updateSendBtn();
  }
  function clearSelection() {
    document.querySelectorAll('input.pick:checked').forEach((c) => { c.checked = false; });
    updateSendBtn();
  }
  async function sendSelected() {
    const urls = picked();
    if (!urls.length) return;
    $('sendSel').disabled = true;
    $('scanmsg').textContent = 'sending ' + urls.length + '...';
    const ids = [];
    await api.enqueueBatch(cfg, urls, {
      onEach: (u, r) => { const id = r.data && (r.data.job_id || r.data.id); if (id) ids.push(id); }
    });
    if (ids.length) await storage.addRecentJobIds(ids);
    const failed = urls.length - ids.length;
    const msg = failed
      ? 'sent ' + ids.length + ' of ' + urls.length + '; ' + failed + ' failed'
      : 'sent ' + ids.length + ' to the queue';
    const tone = failed ? (ids.length ? 'warning' : 'error') : 'dim';
    $('scanmsg').textContent = msg;
    await storage.setLastResult({ text: msg, tone });
    if (ids.length) browser.runtime.sendMessage({ type: 'queued', count: ids.length }).catch(() => {});
    // Keep failed picks selected so they can be re-sent; clear only a clean run.
    if (failed) updateSendBtn(); else clearSelection();
  }

  function openQueue() {
    if (cfg.baseUrl) browser.tabs.create({ url: cfg.baseUrl + '/queue' });
  }

  function onSact(id, fn) {
    const e = $(id);
    const go = () => { if (e.getAttribute('aria-disabled') !== 'true') fn(); };
    e.addEventListener('click', go);
    e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
  }

  $('brand').addEventListener('click', openQueue);
  $('brand').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openQueue(); } });
  onSact('selAll', selectAll);
  onSact('selNone', clearSelection);
  $('sendSel').addEventListener('click', sendSelected);
  init();
})();
