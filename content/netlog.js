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
    /* Eigen periode in Verzuim › Inzicht: het weekrapport van de eerste week wordt vervangen
     * door de optelsom van alle weken in de periode (zie periodeRapport hieronder). */
    try {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
      if (periode && u && periodeMatch(u)) return await periodeRapport(u, input, init);
    } catch (err) { console.warn("[Docent Tools] periode", err); }
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
      if (res.ok && /\/api\/leerlingen\/zoeken\?/.test(url)) res.clone().text().then((t) => llZoekAntwoord(url, t)).catch(() => {});
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
        if (this.__dt && /\/api\/leerlingen\/zoeken\?/.test(this.__dt.u) && this.status === 200 && (this.responseType === "" || this.responseType === "text")) llZoekAntwoord(this.__dt.u, this.responseText);
        else if (this.__dt && /\/api\/leerlingen\/zoeken\?/.test(this.__dt.u) && this.status === 200 && this.responseType === "json") llZoekAntwoord(this.__dt.u, this.response);
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
    const { id, url, full, blob } = e.data;
    /* blob=true: een afbeelding (bijv. een pasfoto) als data-URL teruggeven. */
    if (blob) {
      try {
        const res = await of(url, { method: "GET", credentials: "include", headers: { ...(lastHeaders || {}), Accept: "image/*" } });
        let data = null;
        if (res.ok && /^image\//.test(res.headers.get("content-type") || "")) {
          const b = await res.blob();
          data = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); });
        }
        reply(e, { type: "dt:api:result", id, status: res.status, data });
      } catch (err) { reply(e, { type: "dt:api:result", id, status: 0, error: String(err) }); }
      return;
    }
    try {
      const t0 = performance.now();
      const res = await of(url, { method: "GET", credentials: "include", headers: { Accept: "application/json", ...(lastHeaders || {}) } });
      let json = null, text = ""; try { text = await res.clone().text(); json = JSON.parse(text); } catch {}
      try { record("GET (Docent Tools)", url, res.status, text, performance.now() - t0); } catch {}
      reply(e, { type: "dt:api:result", id, status: res.status, shape: json ? shape(json) : null, json: full ? json : undefined, hadHeaders: !!lastHeaders });
    } catch (err) { reply(e, { type: "dt:api:result", id, status: 0, error: String(err) }); }
  });
  /* Op verzoek van de extensie naar een Magister-scherm gaan zoals Magister dat zelf doet
   * ($state.go), bijvoorbeeld de leerlingkaart. Antwoord ok=false als dat niet lukt. */
  /* Attributen opnieuw zetten vanuit de pagina zelf. Webcomponenten van Magister (zoals dna-link-card) reageren
   * niet op attributen die de extensie vanuit haar eigen wereld zet; vanuit de pagina wel. Zoekt ook in
   * open shadow roots. */
  window.addEventListener("message", (e) => {
    if (!(e.data && e.data.type === "dt:attr:opnieuw" && trusted(e))) return;
    const { selector, attr, diep = true } = e.data;
    const zoek = (r, uit = []) => { try { uit.push(...r.querySelectorAll(selector)); } catch {} if (diep) r.querySelectorAll("*").forEach((x) => x.shadowRoot && zoek(x.shadowRoot, uit)); return uit; };
    const namen = [].concat(attr);   // één attribuut of een lijst
    for (const el of zoek(document)) {
      for (const n of namen) {
        const v = el.getAttribute(n);
        if (v != null) { el.removeAttribute(n); el.setAttribute(n, v); }
      }
    }
  });
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

  /* ---- Eigen periodes in Magisters verzuimoverzichten ----
   * De extensie (periodes.js) stuurt { type: "dt:periode:set", target, periode: { start, end } | null }.
   * - att-dk-attendance (verzuimpagina van een leerling): Magister haalt registraties op met een vrije
   *   begin- en einddatum, dus het bereik wordt gewoon gezet en opnieuw geladen.
   * - att-insights-page (Verzuim › Inzicht): de server kent alleen week, maand en jaar. Het rapport van
   *   de eerste week wordt daarom vervangen door de optelsom van alle weken in de periode
   *   (randweken tellen helemaal mee). */
  let periode = null;
  const dag = 864e5;
  const isoWeekNr = (t) => { // Magisters eigen weeknummering (Dt6qgOfey8.js, functie u)
    const c = (d) => (d.getDay() === 0 ? 6 : d.getDay() - 1);
    const a = new Date(t.getFullYear(), t.getMonth(), t.getDate() - c(t));
    if (a.getMonth() === 11 && a.getDate() >= 29) return 1;
    const r = new Date(t.getFullYear(), 0, 4); r.setDate(4 - c(r));
    return Math.round((a - r) / 6048e5) + 1;
  };
  const maandag = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() === 0 ? 6 : x.getDay() - 1)); return x; };
  const plusDagen = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); // veilig rond zomer-/wintertijd
  const weekSleutel = (ma) => { const zo = plusDagen(ma, 6); return { year: ma.getFullYear() !== zo.getFullYear() ? zo.getFullYear() : ma.getFullYear(), number: isoWeekNr(ma) }; };
  const REPORT = /\/api\/v2\/report\/year\/(\d+)\/week\/(\d+)\/role\//;
  const periodeMatch = (u) => {
    const m = REPORT.exec(u); if (!m) return false;
    // Zoals Magister de URL bouwt voor ons bereik (Dt6qgOfey8.js, functie m): jaar van het einde als
    // begin en einde in verschillende jaren liggen, weeknummer van de begindatum.
    const s = new Date(periode.start), e = new Date(periode.end);
    return +m[1] === (s.getFullYear() !== e.getFullYear() ? e.getFullYear() : s.getFullYear()) && +m[2] === isoWeekNr(s);
  };
  const optel = (a, b) => {
    if (typeof a === "number" && typeof b === "number") return a + b;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const o = { ...a }; for (const k of Object.keys(b)) o[k] = k in a ? optel(a[k], b[k]) : b[k]; return o;
    }
    return a ?? b;
  };
  async function periodeRapport(url, input, init) {
    const weken = [];
    for (let ma = maandag(new Date(periode.start)); ma.getTime() <= periode.end; ma = plusDagen(ma, 7)) weken.push(weekSleutel(ma));
    const urls = weken.map((k) => url.replace(REPORT, (m) => m.replace(/year\/\d+\/week\/\d+/, `year/${k.year}/week/${k.number}`)));
    const haal = (u) => (typeof input === "string" || input instanceof URL ? of.call(window, u, init) : of.call(window, new Request(u, input)));
    const out = []; let status = 200;
    for (let i = 0; i < urls.length; i += 4) {
      const part = await Promise.all(urls.slice(i, i + 4).map(async (u) => { const r = await haal(u); if (!r.ok) { status = r.status; return null; } return r.json(); }));
      out.push(...part);
      if (status !== 200) break;
    }
    if (status !== 200) return haal(url);
    const per = new Map(); let basis = null;
    for (const j of out.filter(Boolean)) {
      basis = basis ? { ...basis, totals: optel(basis.totals, j.totals) } : { ...j };
      for (const it of j.items || []) {
        const key = String(it.student?.id ?? it.student?.studentNumber ?? it.id ?? JSON.stringify(it.student));
        per.set(key, per.has(key) ? optel(per.get(key), it) : it);
      }
    }
    basis = basis || { items: [], totals: {} };
    basis.items = [...per.values()]; basis.itemCount = basis.items.length;
    try { record("GET (Docent Tools, periode)", url, 200, "", 0); } catch {}
    return new Response(JSON.stringify(basis), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const zoek = (sel) => {
    const walk = (r) => { const hit = r.querySelector(sel); if (hit) return hit; for (const e of r.querySelectorAll("*")) if (e.shadowRoot) { const h = walk(e.shadowRoot); if (h) return h; } return null; };
    return walk(document);
  };
  const normaal = (unit) => { // Magisters eigen bereik voor week, maand of schooljaar rond vandaag
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (unit === "month") return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0) };
    if (unit === "year") return t.getMonth() < 7 ? { start: new Date(t.getFullYear() - 1, 7, 1), end: new Date(t.getFullYear(), 6, 31, 23, 59, 59, 999) } : { start: new Date(t.getFullYear(), 7, 1), end: new Date(t.getFullYear() + 1, 6, 31, 23, 59, 59, 999) };
    const s = maandag(t); const e = plusDagen(s, 6); e.setHours(23, 59, 59, 999); return { start: s, end: e };
  };
  window.addEventListener("message", async (e) => {
    if (!(e.data && e.data.type === "dt:periode:set" && trusted(e))) return;
    const { id, target, periode: p, herstel = true } = e.data;
    let ok = false, error = "";
    try {
      const el = zoek(target);
      if (!el) throw new Error(`${target} niet gevonden`);
      if (!p && !herstel) { periode = null; ok = true; }
      else {
        const range = p ? { start: new Date(p.start), end: new Date(p.end) } : normaal(el.selectedPeriod);
        if (target === "att-insights-page") {
          periode = p ? { start: +p.start, end: +p.end } : null;
          el.selectedDateRange = range; el.isLoading = true;
          await el.debounceNavigation(range, p ? "week" : el.selectedPeriod);
        } else {
          periode = null;
          el.loadingAfspraken = true; el.selectedDateRange = range;
          await el.debounceNavigation();
        }
        ok = true;
      }
    } catch (err) { error = String(err && err.message || err); }
    reply(e, { type: "dt:periode:result", id, ok, error });
  });

  /* ---- Leerlingenoverzicht (op-leerlingen): zoekresultaten en selectie ----
   * Magister houdt de selectie in zijn eigen store en toont de lijst met virtueel scrollen (alleen
   * zichtbare rijen bestaan). Daarom: de zoekresultaten uit /api/leerlingen/zoeken bewaren en de
   * vinkjes volgen die je zet. "Alles selecteren" = alle leerlingen van de zoekopdracht. */
  const llZoek = { key: null, total: 0, byId: new Map(), selected: new Set(), all: false, uit: new Set(), los: new Map() };
  function llZoekAntwoord(url, body) {
    let j = body; try { if (typeof body === "string") j = JSON.parse(body); } catch { return; }
    if (!j || !Array.isArray(j.items)) return;
    const u = new URL(url, location.href);
    const key = [...u.searchParams].filter(([k]) => !["top", "skip", "orderby", "velden"].includes(k)).map((x) => x.join("=")).sort().join("&");
    if (key !== llZoek.key) { llZoek.key = key; llZoek.byId.clear(); llZoek.selected.clear(); llZoek.uit.clear(); llZoek.los.clear(); llZoek.all = false; }
    if (typeof j.totalCount === "number") llZoek.total = j.totalCount;
    for (const it of j.items) if (it && it.id != null) llZoek.byId.set(it.id, it);
  }
  const llNaam = (x) => [x.roepnaam, x.tussenvoegsel, x.achternaam].filter(Boolean).join(" ");
  /* Stand van een vinkje, op meerdere manieren (eigenschap, attribuut, aria, ingebouwd invoerveld) */
  const llAan = (cb) => {
    if (!cb) return null;
    if (typeof cb.checked === "boolean") return cb.checked;
    const at = cb.getAttribute("checked"); if (at !== null) return at !== "false";
    const ar = cb.getAttribute("aria-checked") || cb.shadowRoot?.querySelector("[aria-checked]")?.getAttribute("aria-checked"); if (ar) return ar === "true";
    const inp = cb.shadowRoot?.querySelector("input[type=checkbox]") || cb.querySelector("input[type=checkbox]"); if (inp) return inp.checked;
    return null;
  };
  const llVak = (el) => el?.closest?.("td.select, th.select")?.querySelector("dna-checkbox, input[type=checkbox], [role=checkbox]") || null;
  /* Rij -> { code, naam } uit de cellen, en -> leerling uit de bewaarde zoekresultaten */
  const llCellen = (tr) => {
    const code = (tr.querySelector("td.stamnummer")?.textContent || "").trim();
    const av = tr.querySelector("td.naam dna-avatar");
    const naam = ((av && (av.displayName || av.getAttribute("display-name") || av.getAttribute("displayname"))) || tr.querySelector("td.naam")?.textContent || "").replace(/\s+/g, " ").trim();
    return { code, naam };
  };
  const llRij = (tr) => {
    const { code, naam } = llCellen(tr);
    if (code) for (const x of llZoek.byId.values()) if (String(x.code ?? x.stamnummer) === code) return x;
    if (naam) for (const x of llZoek.byId.values()) {
      const n = llNaam(x), m = [x.achternaam, x.tussenvoegsel, x.roepnaam].filter(Boolean).join(" "), k = `${[x.tussenvoegsel, x.achternaam].filter(Boolean).join(" ")}, ${x.roepnaam}`;
      if (naam.includes(n) || naam.includes(m) || naam.includes(k) || (x.achternaam && x.roepnaam && naam.includes(x.achternaam) && naam.includes(x.roepnaam))) return x;
    }
    return null;
  };
  const llZet = (x, aan) => {
    if (!x) return;
    if (llZoek.all) { if (aan) llZoek.uit.delete(x.id); else llZoek.uit.add(x.id); }
    else if (aan) llZoek.selected.add(x.id); else llZoek.selected.delete(x.id);
  };
  const llRijen = () => [...document.querySelectorAll("td.select")].map((td) => td.closest("tr")).filter((tr) => tr && !tr.closest("thead"));
  /* Zichtbare rijen bijwerken uit de vinkjes zelf; geeft aangevinkte rijen die (nog) niet te koppelen zijn terug */
  const llScan = () => {
    const kop = llVak(document.querySelector("th.select"));
    const kopAan = llAan(kop);
    if (kopAan === true && !(kop && kop.indeterminate)) { if (!llZoek.all) { llZoek.all = true; llZoek.uit.clear(); llZoek.selected.clear(); } }
    else if (kopAan === false && !(kop && kop.indeterminate) && !kop?.hasAttribute?.("indeterminate") && llZoek.all) { llZoek.all = false; llZoek.uit.clear(); llZoek.selected.clear(); llZoek.los.clear(); }
    let aangevinkt = 0, rijen = 0;
    for (const tr of llRijen()) {
      rijen++;
      const aan = llAan(llVak(tr.querySelector("td.select")));
      if (aan === null) continue;
      if (aan) aangevinkt++;
      const x = llRij(tr);
      if (x) { llZet(x, aan); continue; }
      /* Niet te koppelen (zoekresultaat niet gezien): op stamnummer/naam onthouden, ook buiten beeld */
      const c = llCellen(tr), k = c.code || c.naam;
      if (k) { if (aan) llZoek.los.set(k, c); else llZoek.los.delete(k); }
    }
    return { los: [...llZoek.los.values()], aangevinkt, rijen, kopAan };
  };
  if (/\/op-leerlingen\//.test(location.pathname)) {
    const opVinkje = (e) => {
      const td = e.target && e.target.closest ? e.target.closest("td.select, th.select") : null;
      if (!td) return;
      setTimeout(() => { try { llScan(); } catch {} }, 60);
      setTimeout(() => { try { llScan(); } catch {} }, 400);
    };
    document.addEventListener("change", opVinkje, true);
    document.addEventListener("click", opVinkje, true);
    document.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") opVinkje(e); }, true);
  }
  window.addEventListener("message", (e) => {
    if (!(e.data && e.data.type === "dt:llsel:get" && trusted(e))) return;
    let scan = { los: [], aangevinkt: 0, rijen: 0, kopAan: null };
    try { scan = llScan(); } catch {}
    const ids = llZoek.all ? [...llZoek.byId.keys()].filter((id) => !llZoek.uit.has(id)) : [...llZoek.selected];
    const lln = ids.map((id) => llZoek.byId.get(id)).filter(Boolean).map((x) => ({ id: x.id, naam: llNaam(x), achternaam: x.achternaam || "", stam: x.code ?? x.stamnummer ?? "", klas: Array.isArray(x.klassen) ? x.klassen.join(", ") : (x.klassen || x.stamklas || "") }));
    const verwacht = llZoek.all ? Math.max(0, llZoek.total - llZoek.uit.size) : lln.length;
    reply(e, { type: "dt:llsel:result", id: e.data.id, lln, los: scan.los, verwacht, geladen: llZoek.byId.size, totaal: llZoek.total, zichtbaar: scan.rijen, zichtbaarAan: scan.aangevinkt, alles: llZoek.all, kopAan: scan.kopAan });
  });
})();
