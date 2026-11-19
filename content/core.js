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
  /* Gedeelde waarnemer voor DT.observe: één MutationObserver voor alle modules. */
  const waarnemers = new Set();
  let waarnemer = null;
  const alleWaarnemers = () => { for (const w of waarnemers) w.run(); };
  const zichtbaar = () => { if (!document.hidden) alleWaarnemers(); };

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

    /* Geeft false als het bewaren niet lukte (opslaglimiet van Chrome, of de extensie is net bijgewerkt).
     * De wijziging geldt dan nog wel in dit tabblad, en de gebruiker krijgt een melding in plaats van stilte. */
    async saveSettings(patch) {
      settings = deepMerge(settings, patch);
      let ok = true;
      try { await chrome.storage.sync.set({ settings }); }
      catch (e) {
        ok = false;
        console.warn("[DT] instellingen bewaren mislukt", e);
        const m = String(e?.message || e);
        try {
          DT.toast(/QUOTA_BYTES/i.test(m) ? "Instellingen niet bewaard: er staat te veel in (bijvoorbeeld veel links, coaches, periodes of verborgen elementen). Ruim iets op bij Instellingen."
            : /context invalidated/i.test(m) ? "Instellingen niet bewaard: de extensie is bijgewerkt. Herlaad dit tabblad."
            : /MAX_WRITE/i.test(m) ? "Instellingen niet bewaard: te veel wijzigingen kort na elkaar. Probeer het over een minuut opnieuw."
            : `Instellingen niet bewaard: ${m}`, "err", 8000);
        } catch {}
      }
      listeners.forEach((fn) => fn(settings));
      return ok;
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

    /* Letter of cijfer van een toets. Met Alt (Option op de Mac) maakt het toetsenbord er een ander teken
     * van (Option+D geeft "∂"); dan telt de fysieke toets. */
    keyOf(e) {
      const m = e.altKey ? /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code || "") : null;
      return m ? (m[1] || m[2]).toLowerCase() : String(e.key || "").toLowerCase();
    },

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
     * Geeft { status, shape, json? } terug. json alleen met full=true; met blob=true { status, data }
     * met een afbeelding als data-URL. */
    /* Met win een ander frame op hetzelfde domein (bijvoorbeeld window.parent): dat frame
     * doet dan de call met zíjn headers en antwoordt aan ons. */
    api(url, { full = false, blob = false, timeout = 15000, win = window } = {}) {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const h = (e) => { if (DT.sameOrigin(e.source) && e.data?.type === "dt:api:result" && e.data.id === id) { window.removeEventListener("message", h); resolve(e.data); } };
        window.addEventListener("message", h);
        try { win.postMessage({ type: "dt:api:get", id, url, full, blob }, location.origin); } catch { resolve({ status: 0, error: "frame onbereikbaar" }); }
        setTimeout(() => { window.removeEventListener("message", h); resolve({ status: 0, error: "time-out" }); }, timeout);
      });
    },

    /* Zoekt de laatste echte API-URL die de pagina zelf aanriep en op een patroon past.
     * Met all=true een lijst van alle passende URL's (nieuwste eerst). */
    apiFind(pattern, timeout = 3000, { win = window, all = false } = {}) {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const h = (e) => { if (DT.sameOrigin(e.source) && e.data?.type === "dt:api:found" && e.data.id === id) { window.removeEventListener("message", h); resolve(all ? (e.data.urls || []) : e.data.url); } };
        window.addEventListener("message", h);
        try { win.postMessage({ type: "dt:api:find", id, pattern, all }, location.origin); } catch { resolve(all ? [] : null); }
        setTimeout(() => { window.removeEventListener("message", h); resolve(all ? [] : null); }, timeout);
      });
    },

    /* Zoals DT.api (met de hele JSON), maar wacht en probeert opnieuw als Magister om rust vraagt (429) of
     * even niet kan (503): 1,5 s, 3 s, 6 s … hooguit zes pogingen. opWachten(poging) wordt vóór elke pauze
     * aangeroepen, bijvoorbeeld om het in een voortgangsregel te melden; gooit die een fout (de gebruiker
     * brak af), dan stopt het ophalen daarmee. */
    async apiRetry(url, { opWachten = null, pogingen = 6, basis = 1500, ...opties } = {}) {
      let r;
      for (let poging = 0; poging < pogingen; poging++) {
        r = await DT.api(url, { full: true, timeout: 25000, ...opties });
        if (r.status !== 429 && r.status !== 503) return r;
        if (poging === pogingen - 1) break;
        if (opWachten) opWachten(poging);
        await new Promise((ok) => setTimeout(ok, basis * 2 ** poging));
      }
      return r;
    },

    /* De rijen uit een API-antwoord (een lijst, of { items: [...] }); null als de aanvraag mislukte. */
    lijst(r) { return (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null; },

    /* Staat de module aan en is hij gestart? (DT.module geeft ook uitgeschakelde modules terug.) */
    actief(id) { return !!modules.get(id)?.active; },

    sameOrigin(w) { try { return w === window || (!!w && w.location.host === location.host); } catch { return false; } },

    /* Dit frame en alle bovenliggende frames op hetzelfde domein, binnenste eerst. */
    windows() {
      const out = [window];
      let w = window;
      while (w !== w.parent) { w = w.parent; if (!DT.sameOrigin(w)) break; out.push(w); }
      return out;
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

    /* Eigen periodes uit de instellingen, gesorteerd, met begin om 00:00 en einde om 23:59:59.
     * Ongeldige regels (geen datum of einde voor begin) vallen weg. */
    periodes() {
      const p = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
      return (settings?.periodes?.lijst || []).map((x) => {
        const b = p(x.begin), e = p(x.einde);
        if (!b || !e || e < b) return null;
        e.setHours(23, 59, 59, 999);
        return { id: String(x.id || x.begin), naam: String(x.naam || "Periode").trim() || "Periode", begin: b, einde: e };
      }).filter(Boolean).sort((a, b) => a.begin - b.begin);
    },
    periodeLabel(p, jaar = false) {
      const f = (d) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", ...(jaar ? { year: "numeric" } : {}) });
      return `${f(p.begin)} – ${f(p.einde)}`;
    },

    /* Reageert op DOM-wijzigingen. MutationObserver ziet geen shadow DOM, daarom wordt er daarnaast periodiek
     * gescand. Alle modules delen één MutationObserver. Het periodieke scannen pauzeert zolang het tabblad niet
     * in beeld is (ookVerborgen: true houdt het aan, voor formulieren die in een nieuw tabblad worden ingevuld)
     * en haalt het in zodra het tabblad weer zichtbaar wordt. Bij een aanhoudende stroom wijzigingen loopt de
     * callback toch minstens elke paar seconden (anders zou het uitstellen hem blijven wegduwen). */
    observe(callback, { debounce = 300, poll = 2000, ookVerborgen = false } = {}) {
      if (!document.body) return () => {};
      const maxWacht = Math.max(debounce * 6, 2000);
      const w = { timer: null, sinds: 0 };
      const vuur = () => {
        clearTimeout(w.timer); w.timer = null; w.sinds = 0;
        try { const r = callback(); if (r && typeof r.catch === "function") r.catch((e) => console.warn("[DT] waarnemer", e)); }
        catch (e) { console.warn("[DT] waarnemer", e); }
      };
      w.run = () => {
        const nu = Date.now(); if (!w.sinds) w.sinds = nu;
        clearTimeout(w.timer);
        w.timer = setTimeout(vuur, Math.max(0, Math.min(debounce, maxWacht - (nu - w.sinds))));
      };
      waarnemers.add(w);
      if (!waarnemer) {
        waarnemer = new MutationObserver(alleWaarnemers);
        waarnemer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("hashchange", alleWaarnemers);
        document.addEventListener("visibilitychange", zichtbaar);
      }
      const iv = poll ? setInterval(() => { if (ookVerborgen || !document.hidden) w.run(); }, poll) : null;
      callback();
      return () => {
        waarnemers.delete(w); clearTimeout(w.timer); clearInterval(iv);
        if (!waarnemers.size && waarnemer) {
          waarnemer.disconnect(); waarnemer = null;
          window.removeEventListener("hashchange", alleWaarnemers);
          document.removeEventListener("visibilitychange", zichtbaar);
        }
      };
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
