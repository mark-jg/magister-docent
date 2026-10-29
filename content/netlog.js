/* Netwerklog (draait in de pagina zelf, niet in de extensie-sandbox).
 * Registreert welke API-calls Magister doet en welke veldnamen terugkomen.
 * Alleen structuur: URL-patroon, methode, status en de namen van velden.
 * Geen waarden, geen inhoud. Gebruikt door de Inspector (Alt+I, dan N).
 */
(() => {
  if (window.__dtNetlog) return;
  const log = []; window.__dtNetlog = log;
  const MAX = 200;
  const anon = (u) => String(u).replace(/\d{3,}/g, "{id}").replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "{guid}").slice(0, 600);
  // Headers van de laatste geslaagde API-call van Magister zelf; nodig om dezelfde API te mogen bevragen.
  let lastHeaders = null;
  const sameApi = (u) => { try { const x = new URL(u, location.href); return x.host === location.host && /\/api\//.test(x.pathname); } catch { return false; } };
  const shape = (data, depth = 0) => {
    if (depth > 2 || data === null || typeof data !== "object") return typeof data;
    if (Array.isArray(data)) return data.length ? [shape(data[0], depth + 1)] : [];
    const out = {}; let n = 0;
    for (const k of Object.keys(data)) { if (n++ > 60) { out["…"] = "meer velden"; break; } out[k] = shape(data[k], depth + 1); }
    return out;
  };
  const raw = []; // exacte URL's, blijven in de pagina en komen nooit in een rapport
  const record = (method, url, status, text, ms, error) => {
    if (raw.length >= MAX) raw.shift();
    raw.push({ method, url: String(url), status });
    if (log.length >= MAX) log.shift();
    let fields = null;
    // Grote antwoorden niet parsen (kost tijd op de hoofddraad); de structuur is dan niet nodig.
    try { if (text && text.length < 400000 && /^[\[{]/.test(text.trim())) fields = shape(JSON.parse(text)); } catch {}
    log.push({ t: Date.now(), method, url: anon(url), status, fields, ms: ms == null ? undefined : Math.round(ms), size: text ? text.length : undefined, error });
  };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const t0 = performance.now();
    let res;
    try { res = await of.apply(this, arguments); }
    catch (err) {
      try { const u = typeof input === "string" ? input : input.url; if (/magister\.net/.test(new URL(u, location.href).host)) record((init && init.method) || "GET", u, 0, null, performance.now() - t0, String(err)); } catch {}
      throw err;
    }
    try {
      const url = typeof input === "string" ? input : input.url;
      if (res.ok && sameApi(url) && (init?.headers || input?.headers)) {
        const h = {}; new Headers(init?.headers || input.headers).forEach((v, k) => { h[k] = v; }); lastHeaders = h;
      }
      if (/magister\.net/.test(new URL(url, location.href).host) && /api|\.json|graphql/i.test(url)) {
        res.clone().text().then((t) => record((init && init.method) || "GET", url, res.status, t, performance.now() - t0)).catch(() => {});
      }
    } catch {}
    return res;
  };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  const osh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u) { this.__dt = { m, u, h: {} }; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (this.__dt) this.__dt.h[k] = v; return osh.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    const t0 = performance.now();
    this.addEventListener("loadend", () => {
      try {
        if (this.__dt && /api|\.json|graphql/i.test(this.__dt.u) && (this.responseType === "" || this.responseType === "text")) record(this.__dt.m, this.__dt.u, this.status, this.responseText, performance.now() - t0, this.status === 0 ? "mislukt" : undefined);
        if (this.__dt && this.status >= 200 && this.status < 300 && sameApi(this.__dt.u) && Object.keys(this.__dt.h).length) lastHeaders = { ...this.__dt.h };
      } catch {}
    });
    return os.apply(this, arguments);
  };

  /* Verzoeken komen van dit frame zelf of van een frame op hetzelfde domein (de extensie in
   * het logboek-frame vraagt zo de API-calls op die de bovenliggende detailkaart deed). */
  const trusted = (e) => { try { return e.source === window || (e.source && e.source.location.host === location.host); } catch { return false; } };
  const reply = (e, msg) => { try { e.source.postMessage(msg, e.origin || "*"); } catch {} };

  /* Laatste echte URL die op een patroon past (voor de probe); met all=true alle (max 12). */
  window.addEventListener("message", (e) => {
    if (!(e.data && e.data.type === "dt:api:find" && trusted(e))) return;
    let found = null; const urls = [];
    try {
      const re = new RegExp(e.data.pattern, "i");
      for (let i = raw.length - 1; i >= 0 && urls.length < 12; i--) {
        if (re.test(raw[i].url) && raw[i].status < 300 && !urls.includes(raw[i].url)) { urls.push(raw[i].url); found ??= raw[i].url; }
      }
    } catch {}
    reply(e, { type: "dt:api:found", id: e.data.id, url: found, urls: e.data.all ? urls : undefined });
  });

  /* Op verzoek van de extensie één API-call doen met Magister's eigen headers.
   * Antwoord: status en veldnamen (shape), of met full=true de hele JSON. */
  window.addEventListener("message", async (e) => {
    if (!(e.data && e.data.type === "dt:api:get" && trusted(e))) return;
    const { id, url, full } = e.data;
    try {
      const res = await of(url, { method: "GET", credentials: "include", headers: { Accept: "application/json", ...(lastHeaders || {}) } });
      let json = null; try { json = await res.clone().json(); } catch {}
      reply(e, { type: "dt:api:result", id, status: res.status, shape: json ? shape(json) : null, json: full ? json : undefined, hadHeaders: !!lastHeaders });
    } catch (err) { reply(e, { type: "dt:api:result", id, status: 0, error: String(err) }); }
  });
  /* Op verzoek van de extensie naar een Magister-scherm gaan zoals Magister dat zelf doet
   * ($state.go), bijvoorbeeld de leerlingkaart. Antwoord ok=false als dat niet lukt. */
  window.addEventListener("message", (e) => {
    if (!(e.data && e.data.type === "dt:state:go" && trusted(e))) return;
    let ok = false, error = "";
    try {
      const inj = window.angular && window.angular.element(document.body).injector();
      const $state = inj && inj.get("$state");
      if ($state) { $state.go(e.data.name, e.data.params || {}); ok = true; }
      else error = "geen AngularJS-injector";
    } catch (err) { error = String(err); }
    reply(e, { type: "dt:state:result", id: e.data.id, ok, error });
  });
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "dt:netlog:get" && e.source) {
      try { e.source.postMessage({ type: "dt:netlog:data", frame: (window === window.top ? "hoofdpagina" : location.host + location.pathname.replace(/\d{3,}/g, "{id}")), log }, "*"); } catch {}
    }
  });
})();
