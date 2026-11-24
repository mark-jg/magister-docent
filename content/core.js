/* Docentdeck voor Magister: kern.
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
  /* De schaduw-DOM's van het document. Ze opzoeken betekent het hele document doorlopen; omdat elke module dat
   * meermaals per controle vraagt, blijft de lijst kort bruikbaar: tot de pagina verandert, en hooguit 400 ms
   * (wijzigingen binnen een schaduw-DOM ziet de MutationObserver niet). */
  let rootsLijst = null, rootsOp = 0, rootsVuil = true;
  const alleRoots = () => {
    const nu = Date.now();
    if (rootsLijst && !rootsVuil && nu - rootsOp < 400) return rootsLijst;
    const uit = [document];
    const walk = (r) => { r.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) { uit.push(e.shadowRoot); walk(e.shadowRoot); } }); };
    walk(document);
    rootsLijst = uit; rootsOp = nu; rootsVuil = false;
    return uit;
  };
  const alleWaarnemers = () => { rootsVuil = true; for (const w of waarnemers) w.run(); };
  const zichtbaar = () => { if (!document.hidden) alleWaarnemers(); };
  /* Wordt de extensie herladen of bijgewerkt terwijl Magister openstaat, dan blijft dit script in het tabblad
   * draaien zonder verbinding met de extensie: elke aanroep van chrome.* geeft dan "Extension context
   * invalidated". Dan stoppen alle waarnemers, één keer, met een melding om het tabblad te herladen. */
  const levend = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  let gestopt = false;
  const stopAlles = () => {
    if (gestopt) return;
    gestopt = true;
    for (const w of waarnemers) { clearTimeout(w.timer); clearInterval(w.iv); }
    waarnemers.clear();
    if (waarnemer) { waarnemer.disconnect(); waarnemer = null; }
    window.removeEventListener("hashchange", alleWaarnemers);
    document.removeEventListener("visibilitychange", zichtbaar);
    if (window === window.top) { try { DT.toast("Docentdeck is bijgewerkt of herladen. Herlaad dit tabblad om verder te werken.", "info", 12000); } catch {} }
  };
  const verlopen = (e) => !levend() || /context invalidated/i.test(String(e?.message || e));

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
      globalThis.DT_THEMA_MIGRATIE?.(settings.theme);   // oude themakeuze (t/m 0.60) omzetten
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
          DT.toast(/QUOTA_BYTES/i.test(m) ? "Instellingen niet bewaard: er staat te veel in (bijvoorbeeld veel links, periodes of verborgen elementen). Ruim iets op bij Instellingen."
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

    /* Zoals DT.api (met de hele JSON), maar in een rustig tempo (zie DT.tempo) en het wacht en probeert opnieuw
     * als Magister om rust vraagt (429) of even niet kan (503): 1,5 s, 3 s, 6 s …, of zo lang als Magister zelf
     * vraagt (Retry-After), hooguit zes pogingen. opWachten(poging) wordt vóór elke pauze
     * aangeroepen, bijvoorbeeld om het in een voortgangsregel te melden; gooit die een fout (de gebruiker
     * brak af), dan stopt het ophalen daarmee. */
    async apiRetry(url, { opWachten = null, pogingen = 6, basis = 1500, ...opties } = {}) {
      const t = DT.tempo;
      let r;
      for (let poging = 0; poging < pogingen; poging++) {
        await DT.beurt();
        const begin = Date.now();
        r = await DT.api(url, { full: true, timeout: 25000, ...opties });
        if (r.status !== 429 && r.status !== 503) {
          /* Het gaat goed: na een reeks antwoorden weer iets vlotter, maar niet sneller dan wat eerder te snel bleek. */
          if (++t.goed >= 25) { t.goed = 0; if (Date.now() - (DT.druk || 0) > 10 * 60e3) t.vloer = t.BASIS; t.tussen = Math.max(t.vloer, Math.round(t.tussen * 0.85)); }
          return r;
        }
        const nu = Date.now(), gevraagd = Number(r.retryAfter) > 0 ? Math.min(60, Number(r.retryAfter)) * 1000 : 0;
        DT.druk = nu;   // Magister vraagt om rust: wie veel ophaalt doet het daarna een tijd kalmer aan (vzBron)
        /* Alle aanvragen houden even in, niet alleen deze. Het tempo gaat omlaag; antwoorden op aanvragen die al
         * onderweg waren toen dat gebeurde tellen niet nog eens mee. */
        t.rust = Math.max(t.rust, nu + Math.max(gevraagd, basis * 2 ** poging));
        if (begin >= t.sinds) { t.sinds = nu; t.goed = 0; t.vloer = Math.min(1000, Math.max(t.vloer, Math.round(t.tussen * 1.5))); t.tussen = Math.min(t.MAX, t.tussen * 2); }
        if (poging === pogingen - 1) break;
        if (opWachten) opWachten(poging);
      }
      return r;
    },

    /* Het tempo voor wie veel bij Magister ophaalt (alles wat via apiRetry gaat, dus ook vzBron): tussen het begin
     * van twee aanvragen zit minstens `tussen` ms, voor alle modules samen. Vraagt Magister om rust, dan wacht
     * iedereen tot `rust` en verdubbelt de tussentijd (hooguit MAX); `vloer` onthoudt tien minuten lang welk tempo
     * te snel was, zodat het daarna niet meteen weer tegen dezelfde grens loopt. */
    tempo: { BASIS: 150, MAX: 2400, tussen: 150, vloer: 150, volgende: 0, rust: 0, sinds: 0, goed: 0 },
    async beurt() {
      const t = DT.tempo;
      for (;;) {
        const nu = Date.now(), start = Math.max(nu, t.volgende, t.rust);
        t.volgende = start + t.tussen;
        if (start > nu) await new Promise((ok) => setTimeout(ok, start - nu));
        if (Date.now() >= t.rust) return;   // intussen vroeg Magister om rust: opnieuw aansluiten
      }
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
      if (root === document) {
        for (const r of alleRoots()) { if (r !== document && !r.host.isConnected) continue; try { out.push(...r.querySelectorAll(selector)); } catch {} }
        return out;
      }
      const walk = (r) => {
        try { out.push(...r.querySelectorAll(selector)); } catch {}
        r.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) walk(e.shadowRoot); });
      };
      walk(root);
      return out;
    },
    deepQuery(selector, root = document) { return DT.deepQueryAll(selector, root)[0] || null; },

    /* Routes voor de eigen pagina's (Opleidingen, Leaderboard, Lesregistraties, …), zodat Terug en Vooruit in de
     * browser ermee werken en de adresbalk laat zien waar je bent. Magister kent die pagina's niet en zou bij een
     * eigen adres terugspringen naar zijn startpagina. De route staat daarom als toevoeging achter Magisters eigen
     * adres, zoals Magister dat zelf ook doet (#/begeleiding/…?innerUrl=…):
     *     #/vandaag?dt=opleidingen&dt.tab=mutaties
     * dt is de pagina, dt.<naam> de rest (tabblad, klas, week). Dezelfde route staat ook in history.state.dt, voor
     * het geval het adres niet mag: haalt Magister de toevoeging weg, dan schakelt de plugin voor deze sessie terug
     * naar alleen de geschiedenis (het adres blijft dan staan, Terug en Vooruit werken nog).
     *   zet(p, extra, vervang)  een nieuwe stap (of de huidige vervangen); p null = geen eigen pagina
     *   nu(p)                   de route van pagina p als die nu geldt, anders null
     *   pad()                   Magisters eigen adres (#/aanwezigheid), zonder toevoegingen
     *   luister(p, fn)          fn(route of null) bij Terug, Vooruit of een ander adres; geeft een functie om te stoppen */
    route: {
      delen() { const h = location.hash || "", i = h.indexOf("?"); return { pad: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? "" : h.slice(i + 1)) }; },
      pad() { return this.delen().pad; },
      uitAdres() {
        const q = this.delen().q, p = q.get("dt"); if (!p) return null;
        const r = { p };
        for (const [k, v] of q) if (k.startsWith("dt.") && k.length > 3) r[k.slice(3)] = v;
        return r;
      },
      huidig() { let s = null; try { s = history.state?.dt || null; } catch {} return this.uitAdres() || s; },
      nu(p) { const s = this.huidig(); return s && s.p === p ? s : null; },
      adresAan() { try { return sessionStorage.getItem("dt-route-adres") !== "uit"; } catch { return true; } },
      /* Alles als tekst, zonder lege waarden, op vaste volgorde: zo zijn twee routes te vergelijken. */
      vorm(p, extra) { if (!p) return null; const r = { p: String(p) }; for (const k of Object.keys(extra || {}).sort()) if (extra[k] != null && extra[k] !== "") r[k] = String(extra[k]); return r; },
      zet(p, extra = {}, vervang = false) {
        try {
          const dt = this.vorm(p, extra), nu = this.huidig();
          if (JSON.stringify(nu ? this.vorm(nu.p, Object.fromEntries(Object.entries(nu).filter(([k]) => k !== "p"))) : null) === JSON.stringify(dt)) return;
          const oud = history.state && typeof history.state === "object" ? history.state : {};
          if (this.adresAan()) {
            /* Magisters eigen toevoegingen blijven letterlijk staan; alleen die van ons (dt en dt.*) worden vervangen. */
            const h = location.hash || "", i = h.indexOf("?"), pad = i < 0 ? h : h.slice(0, i);
            const delen = (i < 0 ? "" : h.slice(i + 1)).split("&").filter((x) => x && !/^dt(=|\.|$)/.test(x));
            const code = (v) => encodeURIComponent(v).replace(/%3A/gi, ":").replace(/%2F/gi, "/").replace(/%2C/gi, ",");
            if (dt) { delen.push(`dt=${code(dt.p)}`); for (const [k, v] of Object.entries(dt)) if (k !== "p") delen.push(`dt.${k}=${code(v)}`); }
            const hash = (pad || "#/") + (delen.length ? `?${delen.join("&")}` : "");
            if (hash !== (location.hash || "")) {
              /* Via het adres zelf, zodat Magister de wijziging ziet (een stille wijziging draait het terug). */
              /* De browser meldt deze stap soms meteen (popstate), midden in het werk van de aanroeper: die melding
               * slaan we over. De module weet het al. */
              this._zelf = true;
              try { if (vervang) location.replace(location.href.split("#")[0] + hash); else location.hash = hash; history.replaceState({ ...oud, dt }, ""); }
              finally { this._zelf = false; }
              if (dt) this.controle(hash);
              return;
            }
          }
          history[vervang ? "replaceState" : "pushState"]({ ...oud, dt }, "");
        } catch (e) { console.warn("[DT] route zetten mislukt", e); }
      },
      /* Staat de toevoeging er even later niet meer terwijl wij niets veranderden, dan heeft Magister hem weggehaald. */
      controle(hash) {
        clearTimeout(this._timer); this._verwacht = hash;
        this._timer = setTimeout(() => {
          if (this._verwacht !== hash || location.hash === hash || this.uitAdres()) return;
          try { sessionStorage.setItem("dt-route-adres", "uit"); } catch {}
          console.warn("[DT] Magister haalde de route uit het adres; verder alleen via de geschiedenis");
        }, 900);
      },
      luister(p, fn) {
        const h = () => { if (!this._zelf) fn(this.nu(p)); };
        window.addEventListener("popstate", h); window.addEventListener("hashchange", h);
        return () => { window.removeEventListener("popstate", h); window.removeEventListener("hashchange", h); };
      },
    },

    /* Lopend werk zichtbaar onderin Magisters hoofdmenu, net boven de knop om het menu in te klappen: zo zie je
     * ook op een andere pagina dat de plugin nog bezig is. Staat het menu er niet, dan linksonder in beeld.
     *   DT.taak(id, { titel, tekst, deel, klaar, fout, open, stop })   tonen of bijwerken
     *   DT.taak(id, null)                                              weghalen
     * deel: 0..1 voor de voortgangsring (weglaten: draaiend); klaar of fout: het werk loopt niet meer, het blok
     * blijft staan tot erop geklikt of het gesloten wordt. open(): klik op het blok; stop(): klik op het kruisje
     * terwijl het loopt. */
    _taken: new Map(),
    taak(id, t) {
      if (t) DT._taken.set(id, t); else DT._taken.delete(id);
      if (DT._taken.size && !DT._taakStop) DT._taakStop = DT.observe(() => DT.taakTeken(), { debounce: 300, poll: 2000 });
      else if (!DT._taken.size && DT._taakStop) { DT._taakStop(); DT._taakStop = null; }
      DT.taakTeken();
    },
    /* De tekstkleur van het blok: die van een gewoon menu-item. Niet van het actieve item of het item onder de
     * muis, want dat is vaak wit op een gekleurd vlak en wisselt met de pagina. Is die kleur op de achtergrond
     * van het menu toch slecht te lezen (of onbekend), dan donker of licht naar gelang die achtergrond. */
    rgb(tekst) { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/.exec(String(tekst || "")); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4] } : null; },
    helder(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); },
    contrast(a, b) { const x = DT.helder(a), y = DT.helder(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
    taakKleur(host, ul) {
      let achter = null;
      for (let el = host.parentElement; el && !achter; el = el.parentElement) { const c = DT.rgb(getComputedStyle(el).backgroundColor); if (c && c.a > 0.5) achter = c; }
      achter ||= { r: 255, g: 255, b: 255 };
      const links = ul ? [...ul.querySelectorAll(":scope > li > a")] : [];
      const gewoon = links.filter((a) => !a.matches(":hover, .active, .selected, [aria-current]") && !a.parentElement.matches(".active, .selected, .expanded, [class*='active'], [class*='selected']"));
      for (const a of gewoon) { const c = DT.rgb(getComputedStyle(a).color); if (c && c.a > 0.5 && DT.contrast(c, achter) >= 4.5) return `rgb(${c.r}, ${c.g}, ${c.b})`; }
      return DT.helder(achter) > 0.4 ? "#1d1d1f" : "#ffffff";
    },
    taakTeken() {
      let host = document.getElementById("dt-taken");
      if (!DT._taken.size) { host?.remove(); DT._taakBeeld = ""; return; }
      const ul = document.querySelector("ul.main-menu"), voet = document.querySelector(".menu-footer") || null;
      const ouder = voet?.parentElement || ul?.parentElement || document.body;
      if (!host) { host = DT.el("div", { id: "dt-taken", role: "status", "aria-live": "polite" }); DT._taakBeeld = ""; }
      if (host.parentElement !== ouder || (voet && host.nextElementSibling !== voet)) { if (voet) voet.before(host); else ouder.append(host); }
      host.classList.toggle("is-los", ouder === document.body);
      /* Staat de voet vast onderin, dan komt het blok er vast boven; de kleur is die van de menu-items. */
      const vast = !!voet && /absolute|fixed/.test(getComputedStyle(voet).position);
      const plek = vast ? `${voet.offsetHeight}px` : "", kleur = ouder === document.body ? "" : DT.taakKleur(host, ul);
      if (host.classList.contains("is-vast") !== vast) host.classList.toggle("is-vast", vast);
      if (host.style.bottom !== plek) host.style.bottom = plek;
      if (host.dataset.kleur !== kleur) { host.dataset.kleur = kleur; host.style.color = kleur; }
      /* Alleen opnieuw opbouwen als er iets veranderd is: de waarnemer ziet ook onze eigen wijzigingen. */
      const beeld = JSON.stringify([...DT._taken].map(([id, t]) => [id, t.titel, t.tekst, t.deel == null ? null : Math.round(t.deel * 100), !!t.klaar, !!t.fout, !!t.stop]));
      if (beeld === DT._taakBeeld) return;
      DT._taakBeeld = beeld;
      host.replaceChildren(...[...DT._taken].map(([id, t]) => {
        const loopt = !t.klaar && !t.fout;
        const ring = DT.el("span", { class: "dt-taak-ring", "aria-hidden": "true", ...(loopt && t.deel != null ? { style: `--dt-deel:${Math.round(Math.max(0, Math.min(1, t.deel)) * 100)}%` } : {}) });
        const open = DT.el("button", { type: "button", class: "dt-taak-open", title: `${t.titel}: ${t.tekst || ""}` }, [ring, DT.el("span", { class: "dt-taak-tekst" }, [DT.el("b", { text: t.titel }), DT.el("small", { text: t.tekst || "" })])]);
        open.addEventListener("click", () => { const nu = DT._taken.get(id); if (nu && (nu.klaar || nu.fout)) DT.taak(id, null); t.open?.(); });
        const weg = loopt && !t.stop ? null : DT.el("button", { type: "button", class: "dt-taak-weg", title: loopt ? "Stoppen" : "Sluiten", "aria-label": `${t.titel}: ${loopt ? "stoppen" : "sluiten"}`, text: "×" });
        weg?.addEventListener("click", () => { if (loopt) t.stop(); else DT.taak(id, null); });
        return DT.el("div", { class: `dt-taak${t.klaar ? " is-klaar" : t.fout ? " is-fout" : t.deel == null ? " is-draait" : ""}` }, [open, weg]);
      }));
    },

    /* Een eigen item onderaan Magisters hoofdmenu: een kopie van een bestaand item (zo klopt de opmaak in elk
     * thema), met eigen icoon, tekst en klik. Aanroepen bij elke ronde van DT.observe: het item wordt één keer
     * gemaakt (Magister bouwt het menu soms opnieuw op). Geeft het <li>, of null als het menu er nog niet is.
     *   icoon: een <svg> van 24 bij 24 met fill of stroke "currentColor". */
    menuItem({ id, titel, tip = titel, icoon, href = "#", klik }) {
      const ul = document.querySelector("ul.main-menu"); if (!ul) return null;
      const al = ul.querySelector(`:scope > #${id}`); if (al) return al;
      const items = [...ul.querySelectorAll(":scope > li:not([id^='dt-menu-'])")].filter((li) => [...li.children].some((c) => c.localName === "a"));
      const bron = items.filter((li) => !li.querySelector("ul")).pop() || items.pop(); if (!bron) return null;
      const li = bron.cloneNode(true);
      for (const n of [li, ...li.querySelectorAll("*")]) for (const a of [...n.attributes]) if (/^(id|ng-|data-ng-|ui-|data-ui-|target|title|aria-current)/.test(a.name)) n.removeAttribute(a.name);
      li.querySelectorAll("ul, .popup-menu, .dot, .badge").forEach((x) => x.remove());
      li.id = id; li.classList.remove("active", "expanded", "selected");
      const a = [...li.children].find((c) => c.localName === "a");
      a.setAttribute("href", href); a.setAttribute("title", tip); a.classList.remove("active", "selected");
      const tekst = a.querySelector("span.caption") || [...a.children].find((c) => c.localName === "span");
      if (tekst) tekst.textContent = titel; else a.append(DT.el("span", { class: "caption", text: titel }));
      /* Icoon: op de plek en in de maat van het icoon van het voorbeeld. */
      const oud = [...a.children].find((c) => c !== tekst), maat = [...bron.querySelectorAll(":scope > a > *")].find((c) => !c.matches("span.caption"));
      const ico = DT.el("i", { class: "dt-menu-ico", "aria-hidden": "true", html: icoon });
      const r = maat?.getBoundingClientRect(), cs = maat ? getComputedStyle(maat) : null;
      ico.style.cssText = `display:inline-flex;align-items:center;justify-content:center;flex:none;vertical-align:middle;width:${Math.round(r?.width || 20)}px;height:${Math.round(r?.height || 20)}px;${cs ? `margin:${cs.margin};float:${cs.float};` : ""}`;
      const svg = ico.querySelector("svg"); if (svg) svg.style.cssText = "width:100%;height:100%;max-width:20px;max-height:20px;";
      if (oud) oud.replaceWith(ico); else a.prepend(ico);
      a.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); klik(); }, true);
      ul.append(li);
      return li;
    },

    /* Eigen tegel tussen Magisters tegels (bv. op Aanwezigheid). Magister bouwt die met mc-nav-tile uit een eigen
     * (scoped) registry: een element dat de extensie zelf maakt wordt daar niet opgebouwd. Daarom zetten we een
     * leeg element met data-dt-upgrade neer en laat netlog.js (in de pagina) het via de shadow root opnieuw maken;
     * zo is het precies hetzelfde onderdeel als Magisters eigen tegels. Staat er op de pagina nog het oudere
     * dna-link-card, dan gebruiken we dat. Aanroepen bij elke ronde van DT.observe: de tegel wordt één keer
     * gemaakt en krijgt zijn klik zodra hij is opgebouwd.
     *   icoon: de inhoud van een <svg viewBox="0 0 512 512">; gebruik fill="var(--sl-icon-fill-accent)" voor de
     *   lichte laag en fill="var(--sl-icon-fill-default)" voor de donkere. */
    navTegel(wrap, { id, titel, tekst, icoon, viewBox = "0 0 512 512", open }) {
      if (!wrap) return null;
      const nieuw = !!wrap.querySelector("mc-nav-tile") || !wrap.querySelector("dna-link-card");
      let c = wrap.querySelector("#" + id);
      if (c && (c.localName === "mc-nav-tile") !== nieuw) { c.remove(); c = null; }   // Magister wisselde van onderdeel
      if (!c) {
        c = document.createElement(nieuw ? "mc-nav-tile" : "dna-link-card");
        c.id = id; c.setAttribute("heading", titel); c.style.cursor = "pointer";
        const svg = `<svg viewBox="${viewBox}" aria-hidden="true" style="inline-size:var(--sl-icon-size,4rem);block-size:var(--sl-icon-size,4rem);--sl-icon-fill-accent:var(--sl-color-background-info-subtle,#cfe3fb);--sl-icon-fill-default:var(--sl-color-background-info-bold,#2a6ac0)">${icoon}</svg>`;
        if (nieuw) {
          c.setAttribute("description", tekst);
          c.setAttribute("href", location.hash || "#");   // met een href tekent de tegel zijn pijl; de klik vangen we zelf af
          c.setAttribute("data-dt-upgrade", "");
          c.innerHTML = svg;
        } else {
          c.setAttribute("tabindex", "0"); c.setAttribute("role", "link");
          const oms = document.createElement("div"); oms.slot = "description"; oms.textContent = tekst;
          const ico = document.createElement("span"); ico.slot = "icon"; ico.innerHTML = svg;
          c.append(oms, ico);
        }
        wrap.append(c);
        if (nieuw) { window.postMessage({ type: "dt:upgrade" }, location.origin); return null; }   // de volgende ronde is hij opgebouwd
      }
      if (c.hasAttribute("data-dt-upgrade")) { window.postMessage({ type: "dt:upgrade" }, location.origin); return null; }
      if (!nieuw && c.shadowRoot?.querySelector("h1") && c.shadowRoot.querySelector("h1").textContent.trim() !== titel)
        window.postMessage({ type: "dt:attr:opnieuw", selector: "#" + id, attr: "heading" }, location.origin);
      if (!c._dtKlik) {
        c._dtKlik = true;
        const ga = (e) => { e.preventDefault(); e.stopPropagation(); open(e); };
        c.addEventListener("click", ga, true);   // vangfase: de tegel handelt klikken in zijn eigen schaduw-DOM af
        c.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) ga(e); }, true);
      }
      return c;
    },

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
      if (!document.body || gestopt) return () => {};
      const maxWacht = Math.max(debounce * 6, 2000);
      const w = { timer: null, sinds: 0 };
      const vuur = () => {
        clearTimeout(w.timer); w.timer = null; w.sinds = 0;
        if (!levend()) return stopAlles();
        const fout = (e) => { if (verlopen(e)) stopAlles(); else console.warn("[DT] waarnemer", e); };
        try { const r = callback(); if (r && typeof r.catch === "function") r.catch(fout); }
        catch (e) { fout(e); }
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
      const iv = w.iv = poll ? setInterval(() => { if (ookVerborgen || !document.hidden) w.run(); }, poll) : null;
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
