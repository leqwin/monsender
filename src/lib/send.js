(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.ML = root.ML || {}).send = mod;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // Shared "read settings -> enqueue -> interpret" used by the background
  // (keyboard command, context menu) and the popup. Depends on the other lib
  // modules through the ML namespace (assembled in the browser by the script
  // tags / importScripts; set on globalThis in node tests).
  const G = typeof self !== 'undefined' ? self : globalThis;
  function ns() { return G.ML; }

  async function settings() { return ns().storage.getSettings(); }
  function cfgOf(s) { return { baseUrl: s.baseUrl, token: s.token }; }

  async function isConfigured() {
    const s = await settings();
    return !!s.baseUrl;
  }

  // Send one URL and wait for the outcome. Returns
  // { configured, result, job, jobId, outcome } where outcome is a
  // { kind, text, tone } line. A network failure or 401 are mapped
  // to their own kinds so the caller never has to inspect the raw result.
  async function sendOne(url, opts) {
    opts = opts || {};
    const s = await settings();
    if (!s.baseUrl) return { configured: false };
    const cfg = cfgOf(s);
    const wait = opts.wait != null ? opts.wait : s.waitSeconds;
    const result = await ns().api.enqueue(cfg, url, { wait, options: opts.options });

    let outcome;
    if (result.networkError || result.status === 0) {
      outcome = { kind: 'down', text: 'monloader unreachable', tone: 'error' };
    } else if (result.status === 401) {
      outcome = { kind: 'rejected', text: 'monloader rejected the token', tone: 'error' };
    } else if (result.status === 200) {
      outcome = ns().outcome.singleOutcome(result.data);
    } else if (result.status === 202) {
      outcome = ns().outcome.singleOutcome(null); // wait timed out: the job is queued
    } else {
      outcome = { kind: 'failed', text: 'send failed (HTTP ' + result.status + ')', tone: 'error' };
    }
    const job = result.status === 200 ? result.data : null;
    const jobId = job ? job.id : (result.data && result.data.job_id);
    return { configured: true, result, job, jobId, outcome };
  }

  return { settings, cfgOf, isConfigured, sendOne };
});
