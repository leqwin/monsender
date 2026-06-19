(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.ML = root.ML || {}).perms = mod;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // The monloader origin is the single host the extension ever reaches. It is
  // user-configured, so it is granted at runtime as an optional host
  // permission, never declared broadly.

  // originPattern("http://monloader.lan:8081/queue") -> "http://monloader.lan:8081/*"
  function originPattern(url) {
    const u = new URL(url);
    return u.origin + '/*';
  }

  async function hasOrigin(url) {
    try {
      return await browser.permissions.contains({ origins: [originPattern(url)] });
    } catch (e) {
      return false;
    }
  }

  async function requestOrigin(url) {
    return browser.permissions.request({ origins: [originPattern(url)] });
  }

  // Grant the new origin and drop the previously-granted one if it changed.
  async function syncOrigin(newUrl, oldUrl) {
    let ok = true;
    if (newUrl) ok = await requestOrigin(newUrl);
    if (ok && oldUrl) {
      try {
        const oldP = originPattern(oldUrl);
        if (!newUrl || oldP !== originPattern(newUrl)) {
          await browser.permissions.remove({ origins: [oldP] });
        }
      } catch (e) { /* ignore */ }
    }
    return ok;
  }

  return { originPattern, hasOrigin, requestOrigin, syncOrigin };
});
