(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.ML = root.ML || {}).scanCore = mod;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const urls = (typeof module !== 'undefined' && module.exports) ? require('./urls.js') : (self.ML && self.ML.urls);

  // The page scan. Detection adapted from ushiro's content.js, made
  // page-wide and returning data (collect runs in the page via
  // scripting.executeScript; finalize is pure and runs in the caller). The
  // injection model is load-bearing: no standing content script.

  // srcset candidates as { url, w } (w is the Nw descriptor, 0 if none).
  function srcsetCands(srcset) {
    return String(srcset).split(',').map((s) => {
      const p = s.trim().split(/\s+/);
      const m = /^(\d+)w$/.exec(p[1] || '');
      return { url: p[0], w: m ? +m[1] : 0 };
    }).filter((c) => c.url);
  }

  // The largest variant the element offers: a srcset entry wider than the
  // rendered image, else the full src, else what the browser loaded.
  function bestUrl(n) {
    let best = null, bv = n.naturalWidth || 0;
    if (n.srcset) for (const c of srcsetCands(n.srcset)) {
      if (c.w > bv) { bv = c.w; best = c.url; }
    }
    return best || n.src || n.currentSrc;
  }

  // A pathological page can hold an enormous DOM; cap how many elements the
  // walk visits so the per-element getComputedStyle cannot stall the page. The
  // bound is far above any real gallery.
  const MAX_VISIT = 30000;

  // Walk the document (and shadow roots), collecting candidate image URLs as
  // absolute strings. doc/win are passed explicitly so this is testable under
  // jsdom and self-contained when injected.
  function collect(doc, win, opts) {
    const maxVisit = (opts && opts.maxVisit) || MAX_VISIT;
    const out = [];
    const seen = new Set();
    const baseURI = doc.baseURI;

    function add(raw, isData, tag, w, h) {
      if (!raw) return;
      let t = String(raw).trim();
      if (!t || t.startsWith('blob:')) return;
      if (!isData && !t.startsWith('data:')) {
        try { t = new win.URL(t, baseURI).href; } catch (e) { return; }
      }
      if (seen.has(t)) return;
      seen.add(t);
      out.push({ url: t, tag: tag || '', w: w || 0, h: h || 0 });
    }

    function svgToURL(el) {
      try {
        if (el.ownerDocument && el.ownerDocument.contentType === 'image/svg+xml') return el.ownerDocument.URL;
        const s = el.cloneNode(true);
        s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return 'data:image/svg+xml,' + encodeURIComponent(s.outerHTML);
      } catch (e) { return ''; }
    }

    function visit(n) {
      const nn = n.nodeName && n.nodeName.toUpperCase();
      if (nn === 'IMG' || nn === 'SOURCE' || nn === 'VIDEO' || nn === 'PICTURE') {
        // One URL per element: the largest variant it advertises. The browser
        // renders a downscaled srcset entry, but the full image may be there or
        // in src - bestUrl resolves it.
        add(bestUrl(n), false, nn,
          n.naturalWidth || n.videoWidth || n.width, n.naturalHeight || n.videoHeight || n.height);
        if (n.poster) add(n.poster, false, 'IMG');
      } else if (nn === 'SVG') {
        add(svgToURL(n), true, 'SVG');
      } else if (nn === 'A') {
        if (n.href && urls.isImageUrl(n.href)) add(n.href, false, 'A');
      }
      try {
        const cs = win.getComputedStyle(n);
        const bg = cs && cs.backgroundImage;
        if (bg && bg !== 'none') {
          const m = /url\((['"]?)(.+?)\1\)/.exec(bg);
          if (m && m[2]) add(m[2], m[2].startsWith('data:'), nn);
        }
      } catch (e) { /* computed style unavailable */ }
    }

    const q = [doc.body || doc.documentElement];
    let root, visited = 0;
    while ((root = q.shift())) {
      let it;
      try { it = doc.createNodeIterator(root, win.NodeFilter.SHOW_ELEMENT); } catch (e) { continue; }
      let n;
      while ((n = it.nextNode())) {
        if (++visited > maxVisit) return out;
        visit(n);
        if (n.shadowRoot) q.push(n.shadowRoot);
      }
    }
    return out;
  }

  function classify(url) {
    if (url.startsWith('data:')) return 'data';
    if (/^https?:/i.test(url)) {
      if (/\.svg(\?|#|$)/i.test(url)) return 'svg';
      if (/\.(webm|mp4|m4v|mov|mkv|avi|ogv)(\?|#|$)/i.test(url)) return 'video';
      return 'http';
    }
    return 'other';
  }

  // Dedupe, keep the http(s) image and video files monloader can fetch
  // (data: and inline svg are skipped, since they have no fetchable URL), cap.
  function finalize(raw, opts) {
    opts = opts || {};
    const cap = opts.cap || 100;
    const minSize = opts.minSize || 0;
    const seen = new Set();
    const all = [];
    for (const r of raw) {
      const url = r && r.url;
      if (!url || seen.has(url)) continue;
      const kind = classify(url);
      if (kind !== 'http' && kind !== 'video') continue;
      // drop icons/trackers when the size is known
      if (minSize && r.w && r.h && (r.w < minSize || r.h < minSize)) continue;
      seen.add(url);
      all.push({ url, tag: (r && r.tag) || '', kind, w: (r && r.w) || 0, h: (r && r.h) || 0 });
    }
    const items = all.slice(0, cap);
    return { items, total: all.length, shown: items.length, truncated: all.length > cap };
  }

  return { collect, classify, finalize };
});
