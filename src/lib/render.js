(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.ML = root.ML || {}).render = mod;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // Build a chooser card for one scan result. The preview is an <img>, or a
  // muted <video> for a video file; the URL is set with setAttribute and
  // scanned strings via textContent, never innerHTML, so a hostile scan string
  // can never become markup in the privileged panel.

  // A user-facing word for the thumbnail placeholder when there is no preview
  // or it failed to load; the raw URL is shown separately in the meta line.
  function kindLabel(kind) { return kind === 'video' ? 'video' : 'image'; }

  function shortUrl(u) {
    if (/^data:/i.test(u)) return 'data: (inline)';
    try {
      const x = new URL(u);
      const parts = x.pathname.split('/').filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] : x.hostname;
      return x.hostname.replace(/^www\./, '') + '/.../' + last;
    } catch (e) { return String(u).slice(0, 64); }
  }

  function fileExt(u) {
    try {
      const m = /\.([a-z0-9]{2,5})$/i.exec(new URL(u).pathname);
      return m ? m[1].toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function fileName(u) {
    if (/^data:/i.test(u)) return 'data:';
    try {
      const parts = new URL(u).pathname.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    } catch (e) { return ''; }
  }

  function placeholderText(item) { return fileName(item.url) || kindLabel(item.kind); }

  function imageCard(doc, item, opts) {
    opts = opts || {};
    const card = doc.createElement('div');
    card.className = 'card';

    const label = doc.createElement('label');
    label.className = 'cardlabel';

    const cb = doc.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'pick';
    cb.setAttribute('data-url', item.url);
    cb.value = item.url;

    const thumb = doc.createElement('div');
    thumb.className = 'thumb';
    if (opts.previews) {
      const video = item.kind === 'video';
      const media = doc.createElement(video ? 'video' : 'img');
      if (video) {
        media.muted = true;
        media.setAttribute('preload', 'metadata');
      } else {
        media.setAttribute('loading', 'lazy');
        media.setAttribute('referrerpolicy', 'no-referrer');
        media.setAttribute('alt', '');
      }
      // A hotlink-protected, stale, or undecodable URL leaves a blank tile; fall
      // back to the file name (textContent, so the scanned value stays text).
      media.addEventListener('error', () => { thumb.classList.add('noimg'); thumb.textContent = placeholderText(item); });
      media.setAttribute('src', item.url); // setAttribute, not innerHTML: never parsed as markup
      thumb.appendChild(media);
    } else {
      thumb.classList.add('noimg');
      thumb.textContent = placeholderText(item);
    }

    const meta = doc.createElement('div');
    meta.className = 'meta nowrap';
    meta.textContent = shortUrl(item.url);
    meta.title = item.url;

    label.appendChild(cb);
    label.appendChild(thumb);
    label.appendChild(meta);
    const bits = [];
    if (item.w && item.h) bits.push(item.w + '×' + item.h);
    const ext = fileExt(item.url);
    if (ext) bits.push(ext);
    if (bits.length) {
      const dim = doc.createElement('div');
      dim.className = 'dim';
      dim.textContent = bits.join(' · ');
      label.appendChild(dim);
    }
    card.appendChild(label);
    return card;
  }

  return { imageCard, shortUrl };
});
