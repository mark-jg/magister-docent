/* Shadow roots (draait in de pagina zelf, vóór alles, in de hoofdwereld).
 * Magister bouwt steeds meer schermen uit webcomponenten met shadow DOM. Thema-CSS van buiten
 * komt daar niet in, en zoeken achteraf mist roots die later ontstaan of gesloten zijn.
 * Daarom: elke shadow root krijgt bij het aanmaken meteen een <style> met de themastijl.
 * De stijl komt uit <script type="text/x-dt-css" id="dt-shadow-src"> in <head>, dat de
 * themamodule (extensiewereld) bijhoudt; wijzigt die, dan worden alle roots bijgewerkt. */
(() => {
  if (window.__dtShadowRoots) return;
  const roots = new Set(); // WeakRefs naar shadow roots
  window.__dtShadowRoots = true;
  const srcEl = () => document.getElementById("dt-shadow-src");
  const apply = (sr) => {
    const text = srcEl()?.textContent || "";
    let st = sr.getElementById ? sr.getElementById("dt-shadow-tokens") : null;
    if (!text) { st?.remove(); return; }
    if (!st) { st = document.createElement("style"); st.id = "dt-shadow-tokens"; sr.append(st); }
    if (st.textContent !== text) st.textContent = text;
  };
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const sr = orig.call(this, init);
    try {
      roots.add(new WeakRef(sr));
      apply(sr);
      // Componenten die hun root vullen met innerHTML gooien de <style> weg: dan opnieuw zetten.
      new MutationObserver(() => { if (!sr.getElementById("dt-shadow-tokens")) apply(sr); }).observe(sr, { childList: true });
    } catch {}
    return sr;
  };
  const sync = () => {
    for (const ref of roots) {
      const sr = ref.deref();
      if (!sr) { roots.delete(ref); continue; }
      try { apply(sr); } catch {}
    }
  };
  const watch = () => {
    const el = srcEl();
    if (!el) return false;
    new MutationObserver(sync).observe(el, { childList: true, characterData: true, subtree: true });
    sync();
    return true;
  };
  if (!watch()) {
    const mo = new MutationObserver(() => { if (watch()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
