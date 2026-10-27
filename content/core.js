/* Docent Tools voor Magister: kern.
 * Bevat het modulesysteem, instellingenbeheer, en gedeelde helpers.
 * Modules registreren zich via DT.register({ id, init, destroy }).
 */
(() => {
  if (window.DT) return;

  const DEFAULTS = globalThis.DT_DEFAULTS;

  const modules = new Map();
  let settings = structuredClone(DEFAULTS);
  const listeners = new Set();

  const DT = {
    version: chrome.runtime.getManifest().version,
    isTop: window === window.top,
    get settings() { return settings; },

    register(mod) {
      if (!mod || !mod.id) throw new Error("Module zonder id");
      modules.set(mod.id, { ...mod, active: false });
    },

    async loadSettings() {
      const stored = (await chrome.storage.sync.get("settings")).settings || {};
      settings = deepMerge(structuredClone(DEFAULTS), stored);
      return settings;
    },

    async saveSettings(patch) {
      settings = deepMerge(settings, patch);
      await chrome.storage.sync.set({ settings });
      listeners.forEach((fn) => fn(settings));
    },

    onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    notify() { listeners.forEach((fn) => fn(settings)); },

    startAll() {
      for (const mod of modules.values()) {
        const enabled = settings[mod.id] ? settings[mod.id].enabled !== false : true;
        if (enabled && !mod.active) {
          try { mod.init(DT); mod.active = true; }
          catch (e) { console.warn(`[DT] module ${mod.id} faalde`, e); }
        } else if (!enabled && mod.active) {
          try { mod.destroy && mod.destroy(DT); } catch (e) {}
          mod.active = false;
        }
      }
    },

    module(id) { return modules.get(id); },

    /* ---------- Helpers ---------- */

    el(tag, attrs = {}, children = []) {
      const node = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
      }
      for (const c of [].concat(children)) {
        if (c === null || c === undefined) continue;
        node.append(typeof c === "string" ? document.createTextNode(c) : c);
      }
      return node;
    },

    toast(msg, kind = "info", ms = 2800) {
      let host = document.getElementById("dt-toasts");
      if (!host) {
        host = DT.el("div", { id: "dt-toasts" });
        document.body.append(host);
      }
      const t = DT.el("div", { class: `dt-toast dt-toast-${kind}`, text: msg });
      host.append(t);
      requestAnimationFrame(() => t.classList.add("dt-show"));
      setTimeout(() => { t.classList.remove("dt-show"); setTimeout(() => t.remove(), 250); }, ms);
    },

    async copy(text) {
      try { await navigator.clipboard.writeText(text); DT.toast("Gekopieerd naar klembord", "ok"); return true; }
      catch { DT.toast("Kopiëren mislukt", "err"); return false; }
    },

    download(filename, content, mime = "text/plain;charset=utf-8") {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      const a = DT.el("a", { href: URL.createObjectURL(blob), download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    /* Vraagt de pagina om een Magister-API-call te doen met haar eigen headers.
     * Geeft { status, shape, json? } terug. json alleen met full=true. */
    api(url, { full = false, timeout = 15000 } = {}) {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const h = (e) => { if (e.source === window && e.data?.type === "dt:api:result" && e.data.id === id) { window.removeEventListener("message", h); resolve(e.data); } };
        window.addEventListener("message", h);
        window.postMessage({ type: "dt:api:get", id, url, full }, "*");
        setTimeout(() => { window.removeEventListener("message", h); resolve({ status: 0, error: "time-out" }); }, timeout);
      });
    },

    /* Zoekt de laatste echte API-URL die de pagina zelf aanriep en op een patroon past. */
    apiFind(pattern, timeout = 3000) {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const h = (e) => { if (e.source === window && e.data?.type === "dt:api:found" && e.data.id === id) { window.removeEventListener("message", h); resolve(e.data.url); } };
        window.addEventListener("message", h);
        window.postMessage({ type: "dt:api:find", id, pattern }, "*");
        setTimeout(() => { window.removeEventListener("message", h); resolve(null); }, timeout);
      });
    },

    /* Doorzoekt ook alle open shadow roots (Magister OP gebruikt webcomponenten). */
    deepQueryAll(selector, root = document) {
      const out = [];
      const walk = (r) => {
        try { out.push(...r.querySelectorAll(selector)); } catch {}
        r.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) walk(e.shadowRoot); });
      };
      walk(root);
      return out;
    },
    deepQuery(selector, root = document) { return DT.deepQueryAll(selector, root)[0] || null; },

    /* Reageert op DOM-wijzigingen. MutationObserver ziet geen shadow DOM,
     * daarom wordt er daarnaast periodiek gescand. */
    observe(callback, { debounce = 300, poll = 2000 } = {}) {
      let timer = null;
      const run = () => { clearTimeout(timer); timer = setTimeout(callback, debounce); };
      const obs = new MutationObserver(run);
      obs.observe(document.body, { childList: true, subtree: true });
      const iv = poll ? setInterval(run, poll) : null;
      window.addEventListener("hashchange", run);
      callback();
      return () => { obs.disconnect(); clearInterval(iv); window.removeEventListener("hashchange", run); };
    },

    /* Routewijzigingen in de SPA volgen. */
    onRoute(callback) {
      let last = location.href;
      const check = () => { if (location.href !== last) { last = location.href; callback(location.href); } };
      const push = history.pushState, replace = history.replaceState;
      history.pushState = function () { push.apply(this, arguments); check(); };
      history.replaceState = function () { replace.apply(this, arguments); check(); };
      window.addEventListener("popstate", check);
      callback(location.href);
    },

    /* Tekst van een cel, inclusief waarden van invoervelden, vinkjes en keuzelijsten. */
    cellText(c) {
      const field = c.querySelector("input, select, textarea");
      if (field && !c.querySelector("a")) {
        if (field.type === "checkbox" || field.type === "radio") return field.checked ? "ja" : "nee";
        if (field.tagName === "SELECT") return field.selectedOptions[0]?.text || "";
        if (field.value) return field.value.trim();
      }
      return (c.innerText ?? c.textContent ?? "").replace(/\s+/g, " ").trim();
    },

    /* Leest een HTML-tabel uit naar een 2D-array. */
    tableToMatrix(table) {
      const rows = [];
      const trs = table.querySelectorAll("tr").length ? table.querySelectorAll("tr") : table.querySelectorAll("[role=row], .ui-grid-row");
      const cellSel = "th, td, [role=columnheader], [role=gridcell], [role=cell], [role=rowheader], .ui-grid-cell";
      for (const tr of trs) {
        // Geneste cellen (ui-grid zet role=columnheader op twee niveaus) maar één keer tellen.
        const cells = [...tr.querySelectorAll(cellSel)]
          .filter((c) => { const p = c.parentElement?.closest(cellSel); return !p || !tr.contains(p); })
          .map(DT.cellText);
        if (cells.some((c) => c !== "")) rows.push(cells);
      }
      return rows;
    },

    /* Unieke, leesbare CSS-selector voor een element (voor de Inspector). */
    selectorFor(el) {
      if (!el || el.nodeType !== 1) return "";
      if (el.id && !/\d{3,}/.test(el.id)) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && parts.length < 6) {
        let part = node.localName;
        const cls = [...node.classList].filter((c) => !/^(ng-|_ng|dt-)/.test(c) && !/\d{3,}/.test(c)).slice(0, 2);
        if (cls.length) part += "." + cls.map(CSS.escape).join(".");
        const attr = ["data-testid", "data-test", "name", "aria-label", "role"].find((a) => node.getAttribute(a));
        if (attr) part += `[${attr}="${node.getAttribute(attr).replace(/"/g, '\\"')}"]`;
        if (!cls.length && !attr) {
          const sibs = [...node.parentElement?.children || []].filter((s) => s.localName === node.localName);
          if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        if (node.id && !/\d{3,}/.test(node.id)) { parts[0] = `#${CSS.escape(node.id)}`; break; }
        node = node.parentElement;
      }
      return parts.join(" > ");
    }
  };

  function deepMerge(base, patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        deepMerge(base[k], v);
      } else {
        base[k] = v;
      }
    }
    return base;
  }

  window.DT = DT;
})();
