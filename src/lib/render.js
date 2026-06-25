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

  // Shorten a long file name for the no-preview tile so it does not fill the
  // card; keep the head and the extension, drop the middle.
  function trimName(name, max) {
    const s = String(name);
    max = max || 28;
    if (s.length <= max) return s;
    const dot = s.lastIndexOf('.');
    const ext = (dot > 0 && s.length - dot <= 6) ? s.slice(dot) : '';
    return s.slice(0, max - ext.length - 3) + '...' + ext;
  }

  // Best-effort pixel width from a CDN URL that encodes one (.../1500x0/...,
  // photo-1500x1000.jpg), so a variant with no srcset descriptor still shows its
  // resolution instead of a bare "src". 0 when the URL carries no clear size.
  function urlWidth(u) {
    const s = String(u);
    const m = /\/(\d{3,5})x\d{1,5}\//.exec(s) || /[-_](\d{3,5})x\d{1,5}\.[a-z]/i.exec(s);
    return m ? +m[1] : 0;
  }

  function placeholderText(item) { return trimName(fileName(item.url)) || kindLabel(item.kind); }

  // The no-preview tile: the (trimmed) file name, prefixed with a "preview
  // blocked" note when a load failed, so a host that blocks hotlinking reads
  // differently from previews being turned off. textContent only, so a scanned
  // name can never become markup.
  function fillNoPreview(doc, thumb, item, blocked) {
    thumb.textContent = '';
    thumb.classList.add('noimg');
    if (blocked) {
      thumb.classList.add('blocked');
      const note = doc.createElement('div');
      note.className = 'phnote';
      note.textContent = 'preview blocked';
      thumb.appendChild(note);
    }
    const name = doc.createElement('div');
    name.className = 'phname';
    name.textContent = placeholderText(item);
    thumb.appendChild(name);
  }

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

    // Dimensions start from the scanned size, then correct to the preview's own
    // size once it loads, since a src/srcset variant can differ from the
    // rendered image the scan measured.
    let ext = fileExt(item.url);
    let dim = null;
    function showDims(w, h) {
      const bits = [];
      if (w && h) bits.push(w + '×' + h);
      if (ext) bits.push(ext);
      if (!bits.length) return;
      if (!dim) { dim = doc.createElement('div'); dim.className = 'dim'; label.appendChild(dim); }
      dim.textContent = bits.join(' · ');
    }

    const thumb = doc.createElement('div');
    thumb.className = 'thumb';
    let media = null;
    let activeSize = null;
    function onLoad(w, h) {
      showDims(w, h);
      // The loaded width is authoritative, so a no-descriptor src stops reading
      // "src" and shows its real resolution like the rest.
      if (activeSize && w) activeSize.textContent = w + 'w';
    }
    if (opts.previews) {
      const video = item.kind === 'video';
      media = doc.createElement(video ? 'video' : 'img');
      if (video) {
        media.muted = true;
        media.setAttribute('preload', 'metadata');
      } else {
        media.setAttribute('loading', 'lazy');
        media.setAttribute('referrerpolicy', 'no-referrer');
        media.setAttribute('alt', '');
        media.addEventListener('load', () => onLoad(media.naturalWidth, media.naturalHeight));
      }
      // A hotlink-protected, stale, or undecodable URL leaves a blank tile; show
      // it as blocked so the user sees why the preview is missing.
      media.addEventListener('error', () => fillNoPreview(doc, thumb, item, true));
      media.setAttribute('src', item.url); // setAttribute, not innerHTML: never parsed as markup
      thumb.appendChild(media);
    } else {
      fillNoPreview(doc, thumb, item, false);
    }

    const meta = doc.createElement('div');
    meta.className = 'meta nowrap';
    meta.textContent = shortUrl(item.url);
    meta.title = item.url;

    label.appendChild(cb);
    label.appendChild(thumb);
    label.appendChild(meta);
    showDims(item.w, item.h);
    card.appendChild(label);

    // One clickable token per resolution, outside the label so a click never
    // toggles the pick. Choosing one repoints the pick and reloads the preview;
    // onLoad then labels it with the real loaded width.
    if (item.variants && item.variants.length > 1) {
      const sizes = doc.createElement('div');
      sizes.className = 'sizes';
      const tokens = item.variants.map((v) => {
        const t = doc.createElement('span');
        t.className = 'size';
        t.setAttribute('data-url', v.url);
        t.setAttribute('role', 'button');
        t.setAttribute('tabindex', '0');
        const w = v.w || urlWidth(v.url);
        t.textContent = w ? w + 'w' : 'src';
        sizes.appendChild(t);
        return t;
      });
      const activate = (t) => {
        tokens.forEach((x) => x.classList.toggle('active', x === t));
        activeSize = t;
        const u = t.getAttribute('data-url');
        cb.setAttribute('data-url', u);
        cb.value = u;
        ext = fileExt(u);
        if (media) media.setAttribute('src', u);
      };
      tokens.forEach((t) => {
        t.addEventListener('click', () => activate(t));
        t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t); } });
      });
      const def = tokens.find((t) => t.getAttribute('data-url') === item.url) || tokens[0];
      def.classList.add('active');
      activeSize = def;
      card.appendChild(sizes);
    }
    return card;
  }

  return { imageCard, shortUrl };
});
