/* Opleidingen: overzicht van de school per opleiding, leerjaar en klas.
 *
 * Eigen item "Opleidingen" onderaan Magisters hoofdmenu. De pagina ligt over het werkvlak van Magister (het menu
 * blijft staan) en sluit zodra je een ander menu-item kiest.
 *  - Inschrijvingen: hoeveel studenten per opleiding › leerjaar › klas, uitklapbaar, met het verloop over de
 *    schooljaren (de eerste van elke maand; 1 oktober is de landelijke teldatum) als grafiek.
 *  - Aanwezigheid: per klas, leerjaar en opleiding het aandeel aanwezig, te laat, ziek, absent (geoorloofd en
 *    ongeoorloofd), uitgestuurd en vrijstelling, per week en per weekdag, en hoeveel studenten onder de norm zitten.
 *    Dezelfde berekening als Inzicht en Lesregistraties (vzStats in verzuiminzicht.js).
 *  - Aandachtspunten (groei en krimp, kleine klassen, laagste aanwezigheid) en alles naar Excel.
 *
 * Bronnen, alles via je eigen Magister-sessie en dus alleen wat jij in Magister mag zien:
 *  - /api/leerlingen/zoeken/filters?peildatum=…   de klassen met hun aantal studenten op een datum (één aanvraag);
 *  - /api/leerlingen/zoeken?klassen=…             de studenten van een klas (opleiding, leerjaar, mentor);
 *  - /api/leerlingen/{id}/aanmeldingen            opleiding en leerjaar als het zoekresultaat die niet geeft;
 *  - registraties en rooster per student          voor de aanwezigheid (op verzoek, per klas of voor alles).
 * Er wordt niets in Magister gewijzigd. De aanwezigheid en de lessen staan in een jaaropslag per klas die bewaard
 * blijft en bij het openen wordt bijgewerkt, met een back-up in een map naar keuze (opleidingen-gegevens.js). Die
 * opslag bevat per student de naam en de lessen per week; de mutaties (in- en uitstroom) tonen die namen. */
DT.register({
  id: "opleidingen",
  _pagina: null, _run: 0, _d: null, _jaren: 0, _per: "4w", _weergave: "opleiding",
  ICOON: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zM5 13.2V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.8l-7 3.8-7-3.8z"/></svg>`,

  init(DT) {
    if (!DT.isTop) return;
    this._open = new Set(); this._uit = new Set();
    try { const j = localStorage.getItem("dt-opl-jaren"); if (j != null && j !== "") this._jaren = Number(j) || 0; } catch {}
    this._stop = DT.observe(() => this.menu(DT), { debounce: 300, poll: 2000 });
    /* Een ander adres: de pagina sluit, behalve als we met Terug of Vooruit juist op deze pagina uitkomen. */
    this._hash = () => { if (!DT.route.nu("opleidingen")) this.sluit(true); };
    window.addEventListener("hashchange", this._hash);
    this._routeStop = DT.route.luister("opleidingen", (r) => this.vanRoute(DT, r));
  },
  destroy() {
    this._stop && this._stop(); window.removeEventListener("hashchange", this._hash); this._routeStop && this._routeStop();
    this.sluit(); document.querySelectorAll("#dt-menu-opleidingen").forEach((el) => el.remove());
  },

  /* ---------- menu-item ---------- */
  menu(DT) {
    const ul = document.querySelector("ul.main-menu"); if (!ul) return;
    if (!ul._dtOpl) {
      ul._dtOpl = true;
      /* Een ander menu-item gekozen: de pagina sluit, ook als Magister daarbij niet van adres wisselt. */
      ul.addEventListener("click", (e) => { if (this._pagina && e.target.closest?.("a") && !e.target.closest("#dt-menu-opleidingen")) this.sluitNaKlik(); }, true);
    }
    /* Na herladen: de geschiedenis weet nog dat deze pagina open stond. */
    if (!this._routeGestart) { this._routeGestart = true; const r = DT.route.nu("opleidingen"); if (r) this.vanRoute(DT, r); }
    if (ul.querySelector(":scope > #dt-menu-opleidingen")) return;
    const li = DT.menuItem({ id: "dt-menu-opleidingen", titel: "Opleidingen", tip: "Opleidingen (Docentdeck)", icoon: this.ICOON, href: "#/opleidingen", klik: () => this.open(DT) });
    if (li && this._pagina) li.classList.add("active");
  },

  /* ---------- route: Terug en Vooruit in de browser ---------- */
  /* Elke weergave (tabblad, details van een klas) is een stap in de geschiedenis van de browser. */
  route(vervang = false) { DT.route.zet("opleidingen", { tab: this._tab || "overzicht", zoom: this._zoom || null }, vervang); },
  /* Terug of Vooruit: r is de route van deze pagina, of null als de stap bij een andere pagina hoort. */
  vanRoute(DT, r) {
    if (!r) { this.sluit(true); return; }
    const tab = r.tab || "overzicht", zoom = r.zoom || null;
    if (this._pagina && tab === (this._tab || "overzicht") && zoom === (this._zoom || null)) return;   // onze eigen stap: er verandert niets
    this._tab = tab; this._zoom = zoom;
    if (!this._pagina) this.open(DT, true);
    else { this.teken(DT); this._pagina.scrollTop = 0; }
  },
  /* Gesloten door een klik in het menu. Wisselt Magister daarbij niet van adres, dan krijgt de geschiedenis zelf
   * een stap "geen eigen pagina", zodat Terug weer hier uitkomt. */
  sluitNaKlik() {
    this.sluit(true);
    setTimeout(() => { if (!this._pagina && DT.route.nu("opleidingen")) DT.route.zet(null); }, 300);
  },

  /* ---------- pagina ---------- */
  open(DT, vanRoute = false) {
    if (this._pagina) return;
    this.css();
    const view = document.querySelector('ui-view[name="main"]') || document.querySelector(".container > ui-view") || document.querySelector("ui-view");
    const kop = DT.el("dna-page-header", { heading: "Opleidingen" });
    const echt = DT.deepQuery("dna-page-header");
    if (!echt || echt.hasAttribute("invert")) kop.setAttribute("invert", "");
    kop.append(DT.el("dna-breadcrumb", { slot: "breadcrumb", text: "Opleidingen" }),
      DT.el("span", { slot: "actions", class: "dt-opl-acties" }, [
        DT.el("dna-button", { class: "dt-opl-dna", "data-act": "vernieuw", text: "Vernieuwen" }),
        DT.el("dna-button", { class: "dt-opl-dna", "data-act": "excel", variant: "primary", text: "Naar Excel" })]));
    this._statusEl = DT.el("div", { class: "dt-opl-status", role: "status", "aria-live": "polite" });
    this._lijf = DT.el("div", { class: "dt-opl-lijf" });
    this._tip = DT.el("div", { class: "dt-opl-tip", role: "tooltip" });
    const pagina = this._pagina = DT.el("section", { id: "dt-oplp", class: "dt-opl", "aria-label": "Opleidingen", tabindex: "-1" }, [kop, DT.el("div", { class: "dt-opl-inhoud" }, [this._statusEl, this._lijf]), this._tip]);
    /* Over het werkvlak van Magister heen (vast, op de maat van Magisters eigen weergave); die weergave zelf wordt
     * onzichtbaar, zodat de ondergrond van het thema zichtbaar blijft. */
    const plaats = () => {
      const r = view?.getBoundingClientRect(), menu = document.querySelector(".menu-host")?.getBoundingClientRect();
      const ok = r && r.width > 200;
      pagina.style.left = `${Math.max(0, Math.round(ok ? r.left : (menu?.right || 0)))}px`;
      pagina.style.top = `${Math.max(0, Math.round(ok ? r.top : 0))}px`;
    };
    this._plaats = plaats;
    this._ro = new ResizeObserver(plaats);
    for (const el of [view, document.querySelector(".menu-host"), document.documentElement]) if (el) this._ro.observe(el);
    window.addEventListener("resize", plaats);
    this._view = view; view?.classList.add("dt-opl-achter");
    document.body.append(pagina); plaats();
    const ul = document.querySelector("ul.main-menu");
    this._wasActief = ul?.querySelector(":scope > li.active:not(#dt-menu-opleidingen)") || null;
    this._wasActief?.classList.remove("active");
    ul?.querySelector(":scope > #dt-menu-opleidingen")?.classList.add("active");
    /* Magisters onderdelen negeren attributen die de extensie zet; het netwerk-script zet ze opnieuw. Bestaan de
     * onderdelen op deze pagina niet, dan valt de pagina terug op eigen opmaak. */
    window.postMessage({ type: "dt:attr:opnieuw", diep: false, selector: "#dt-oplp :is(dna-page-header, dna-button)", attr: ["heading", "invert", "variant"] }, "*");
    setTimeout(() => { if (this._pagina === pagina && !kop.shadowRoot) { pagina.classList.add("is-kaal"); kop.prepend(DT.el("h1", { text: "Opleidingen" })); } }, 1500);
    pagina.addEventListener("click", (e) => this.klik(DT, e));
    pagina.addEventListener("change", (e) => this.kies(DT, e));
    pagina.addEventListener("mousemove", (e) => this.tip(e));
    pagina.addEventListener("mouseleave", () => this._tip.classList.remove("is-aan"));
    pagina.focus({ preventScroll: true });
    if (!vanRoute) this.route();
    this.laad(DT);
  },
  sluit(vanRoute = false) {
    if (!this._pagina) return;
    if (!vanRoute && DT.route.nu("opleidingen")) DT.route.zet(null);
    this._run++; this._stopAanw = true;
    this._ro?.disconnect(); window.removeEventListener("resize", this._plaats);
    this._view?.classList.remove("dt-opl-achter");
    this._pagina.remove(); this._pagina = null;
    document.querySelector("#dt-menu-opleidingen")?.classList.remove("active");
    /* Magister zet zijn eigen actieve item bij een wissel van pagina; bleef je op dezelfde, dan zetten wij het terug. */
    setTimeout(() => { if (!this._pagina && this._wasActief?.isConnected && !document.querySelector("ul.main-menu > li.active")) this._wasActief.classList.add("active"); }, 150);
  },

  /* ---------- klein gereedschap ---------- */
  esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); },
  getal(n) { return n == null ? "—" : Number(n).toLocaleString("nl-NL"); },
  pct(p) { return p == null ? "—" : `${String(p).replace(".", ",")}%`; },
  kort(datum, jaar = true) { const d = OplReken.datum(datum); return d ? d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", ...(jaar ? { year: "numeric" } : {}) }) : ""; },
  wacht(ms) { return new Promise((r) => setTimeout(r, ms)); },
  api(url) { return DT.apiRetry(url, { opWachten: () => this.status("Even wachten: Magister vraagt om rustiger aan te doen…") }); },
  async parallel(items, fn, n = 2) { const werk = items.slice(); await Promise.all(Array.from({ length: n }, async () => { while (werk.length) await fn(werk.shift()); })); },
  sleutel(naam) { return `dt-opl:${location.host}:${naam}`; },
  async opslag(naam) { try { const k = this.sleutel(naam); return (await chrome.storage.local.get(k))[k] || {}; } catch { return {}; } },
  async bewaar(naam, waarde) { try { await chrome.storage.local.set({ [this.sleutel(naam)]: waarde }); } catch (e) { console.warn("[DT] opleidingen: bewaren mislukt", e); } },
  status(tekst, fout = false, deel = null, stop = false) {
    if (!this._statusEl) return;
    this._statusEl.classList.toggle("is-fout", !!fout);
    this._statusEl.innerHTML = tekst ? `<span>${this.esc(tekst)}</span>${stop ? `<button type="button" class="dt-opl-knop" data-act="stop">Stoppen</button>` : ""}${deel == null ? "" : `<i class="dt-opl-voortgang"><b style="width:${Math.round(100 * Math.min(1, deel))}%"></b></i>`}` : "";
  },
  periodes() {
    const nu = new Date(), sj = OplReken.sjStart(nu), dag = (n) => new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - n);
    const uit = [{ key: "1w", naam: "Laatste week", van: dag(7), tot: nu }, { key: "4w", naam: "Laatste 4 weken", van: dag(28), tot: nu }, { key: "8w", naam: "Laatste 8 weken", van: dag(56), tot: nu },
      { key: "jaar", naam: `Dit schooljaar (${OplReken.sjNaam(nu)})`, van: sj, tot: nu }];
    for (const p of DT.periodes?.() || []) if (p.begin <= nu) uit.push({ key: `p:${p.id}`, naam: p.naam, van: p.begin, tot: p.einde < nu ? p.einde : nu });
    return uit;
  },
  periode() { const alle = this.periodes(); return alle.find((p) => p.key === this._per) || alle[1]; },

  /* ---------- ophalen: inschrijvingen ---------- */
  /* Klassen met hun aantal studenten op een datum: { klas: aantal } (aantal null als Magister het niet meegeeft);
   * null als de aanvraag mislukte. Eerst alles wat je mag zien, anders alleen je eigen klassen (rol docent). */
  async telling(peil) {
    const haal = (rol) => this.api(`/api/leerlingen/zoeken/filters?q=**${rol ? "&rol=Docent" : ""}&peildatum=${peil}`);
    let r = await haal(this._rol), kl = r.status === 200 ? (r.json?.klassen || []) : null;
    if (!this._rol && !(kl || []).length) { const r2 = await haal(true), k2 = r2.status === 200 ? (r2.json?.klassen || []) : null; if ((k2 || []).length) { this._rol = true; r = r2; kl = k2; } }
    if (!kl) return null;
    const uit = {};
    for (const k of kl) if (k && k.naam) uit[k.naam] = typeof k.aantal === "number" ? k.aantal : null;
    return uit;
  },
  /* Opleiding, leerjaar, mentor en aantal van één klas op een datum, uit de studenten van die klas. */
  async indelingVan(klas, peil) {
    const R = OplReken, basis = `/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam&velden=KlassenMentor1`;
    /* Elke student komt terug met zijn studies (de studiecode); een leerjaar geeft Magister hier niet. */
    const z = await this.api(basis);
    const lln = DT.lijst(z); if (!lln) return null;
    let studie = R.meeste(lln.map((x) => R.studie(x))), leerjaar = R.meeste(lln.map((x) => R.leerjaar(x)));
    const mentor = R.meeste(lln.map((x) => R.naam(x.klassenMentor1 ?? x.KlassenMentor1)));
    for (const l of lln.slice(0, 2)) {
      if (studie) break;
      const a = R.aanmeldingOp(DT.lijst(await this.api(`/api/leerlingen/${encodeURIComponent(l.id)}/aanmeldingen`)), peil);
      if (a) { studie ||= R.studie(a); leerjaar ??= R.leerjaar(a); }
    }
    /* Per studiecode het aantal studenten: zo tellen ook studenten van een ander cohort in dezelfde klas goed mee. */
    const codes = {};
    for (const x of lln) { const s = R.studie(x); if (s) codes[s] = (codes[s] || 0) + 1; }
    if (!Object.keys(codes).length && studie) codes[studie] = lln.length;
    return { studie: studie || "", lj: leerjaar ?? null, mentor: mentor || "", aantal: lln.length, codes };
  },

  async laad(DT, vers = false) {
    const run = ++this._run, R = OplReken, nu = new Date(), vandaag = R.ymd(nu), leeft = () => run === this._run && !!this._pagina;
    const nl = (a, b) => a.localeCompare(b, "nl", { numeric: true });
    try {
      this.status("Klassen ophalen…");
      /* Eerst de back-up in de map (als die er is) samenvoegen met wat de extensie zelf bewaart. */
      await this.mapLaden(); await this.backupLezen();
      const tel = await this.opslag("tel"), ind = await this.opslag("indeling2"), sj = R.sjNaam(nu), sjJaar = R.sjStart(nu).getFullYear();
      if (vers) delete ind[sj];
      const ruwTel = await this.telling(vandaag);
      if (!leeft()) return;
      /* Welke opleidingen doen mee? Bij veel klassen eerst kiezen, vóór er verder iets wordt opgehaald. */
      const eerstKiezen = ruwTel && Object.keys(ruwTel).length ? await this.keuzeLaden(ruwTel) : false;
      const nuTel = ruwTel && this.kiesFilter(ruwTel);
      if (ruwTel && Object.keys(ruwTel).length && (eerstKiezen || !Object.keys(nuTel).length)) { this._d = null; this.status(""); this._lijf.innerHTML = this.keuzeKaart(true); this.keuzeTotaal(); return; }
      if (!nuTel) { this._lijf.replaceChildren(); return this.status("Klassen ophalen lukte niet. Herlaad Magister en probeer het opnieuw.", true); }
      if (!Object.keys(nuTel).length) {
        /* Geen klassen op de datum van vandaag: Magister staat waarschijnlijk op een eerder schooljaar. Dan leggen we
         * de peildatums van dat jaar vast; ze blijven bewaard en staan in het verloop zodra je terugschakelt. */
        this._d = null; this._lijf.replaceChildren();
        const r = await this.punten(run, tel, vers); if (!r) return;
        const jaren = [...new Set(Object.values(r.gevonden).map((p) => p.sj))].sort(), kaart = {};
        for (const k of Object.keys(ind.oud || {})) kaart[k] = true;
        for (const k of Object.keys(ind[sj] || {})) kaart[k] = true;
        await this.deelOud(run, Object.values(r.gevonden), kaart, ind);
        if (!leeft()) return;
        this._lijf.innerHTML = `<p class="dt-opl-melding">Klopt dit niet? <button type="button" class="dt-opl-knop" data-act="diagnose">Diagnose kopiëren</button> zet op het klembord wat Magister teruggeeft (alleen veldnamen, aantallen en statuscodes, geen namen).</p>`;
        return this.status(jaren.length ? `Magister geeft voor vandaag geen klassen terug: het staat op een ander schooljaar. Vastgelegd voor het verloop: ${jaren.join(", ")} (${Object.keys(r.gevonden).length} peildatums). Schakel in Magister terug naar het lopende schooljaar en open Opleidingen opnieuw: de grafiek loopt dan door over deze jaren.` : "Magister geeft voor jouw account geen klassen terug.", !jaren.length);
      }
      const bekend = ind[sj] || {}, namen = Object.keys(nuTel).sort(nl), werk = namen.filter((k) => !bekend[k] || nuTel[k] == null);
      let klaar = 0;
      await this.parallel(werk, async (k) => {
        if (!leeft()) return;
        const i = await this.indelingVan(k, vandaag);
        if (i) { bekend[k] = { studie: i.studie, lj: i.lj, mentor: i.mentor, codes: i.codes }; if (nuTel[k] == null) nuTel[k] = i.aantal; }
        if (leeft()) this.status(`Opleiding en leerjaar ophalen: klas ${++klaar} van ${werk.length}…`, false, klaar / werk.length);
      });
      if (!leeft()) return;
      ind[sj] = bekend; await this.bewaar("indeling2", ind);
      /* De stand van vandaag bewaren: Magister geeft eerdere schooljaren niet altijd terug, dus het verloop groeit
       * ook uit wat de extensie zelf bij elk bezoek vastlegt (alleen aantallen per klas, in deze browser). */
      const mom = await this.opslag("momenten");
      mom[vandaag] = { ...ruwTel, ...nuTel };
      for (const k of Object.keys(mom).sort().slice(0, -1500)) delete mom[k];
      await this.bewaar("momenten", mom);
      const kaart = {};
      for (const [k, o] of Object.entries(ind.oud || {})) kaart[k] = R.indeel(o, k, o.jaar || sjJaar);
      for (const k of namen) kaart[k] = R.indeel(bekend[k], k, sjJaar);
      const klassen = namen.map((k) => ({ naam: k, aantal: nuTel[k] || 0, ...kaart[k] }));
      const boom = R.boom(klassen);
      this._d = { vandaag, sj, nu: nuTel, klassen, boom, knopen: R.plat(boom), kaart, cohorten: R.cohorten(namen.map((k) => bekend[k]?.codes)), tellingen: [{ datum: vandaag, vandaag: true, klassen: nuTel }], aanw: {}, verloopKlaar: false };
      await this.gegevensLaden();
      this.status(""); this.teken(DT);
      await this.verloop(DT, run, tel, ind, vers);
    } catch (e) { console.warn("[DT] opleidingen", e); if (leeft()) this.status(`Er ging iets mis: ${e?.message || e}`, true); }
  },

  /* De peildatums van het verloop, van nu terug in de tijd: { gevonden: { datum: { …, klassen } }, zonder }.
   * Wat Magister teruggeeft blijft bewaard, ook als het later niet meer op te vragen is. Geeft Magister voor een
   * datum niets terug, dan slaan we de rest van dat schooljaar over (zonder: true) en gaan verder met het jaar
   * ervoor: welk schooljaar Magister laat zien hangt af van het schooljaar dat je in Magister hebt gekozen. Met
   * vers worden bewaarde punten opnieuw opgehaald, maar nooit door een leeg antwoord vervangen. */
  async punten(run, tel, vers = false) {
    const R = OplReken, leeft = () => run === this._run && !!this._pagina, alle = R.peildata(new Date(), this._jaren).filter((x) => !x.vandaag).reverse();
    const gevonden = {}; let i = 0, nieuw = false, zonder = false, leegJaar = null;
    for (const p of alle) {
      if (!leeft()) return null;
      i++;
      let t = vers || p.sj === leegJaar ? null : tel[p.datum];
      if (!t && p.sj !== leegJaar) {
        this.status(`Verloop ophalen: peildatum ${i} van ${alle.length} (${this.kort(p.datum)})…`, false, i / alle.length);
        t = await this.telling(p.datum);
        /* Geeft Magister geen aantallen mee, dan tellen we de studenten per klas, alleen op de teldatum. */
        if (t && Object.values(t).some((v) => v == null)) {
          if (!p.teldatum) t = null;
          else await this.parallel(Object.keys(t).filter((k) => t[k] == null), async (k) => { if (leeft()) t[k] = (await this.indelingVan(k, p.datum))?.aantal ?? 0; });
        }
        if (!leeft()) return null;
        if (t && Object.values(t).some((n) => n)) { tel[p.datum] = t; nieuw = true; } else { t = null; zonder = true; leegJaar = p.sj; }
        await this.wacht(120);
      }
      t ||= tel[p.datum];
      if (t) gevonden[p.datum] = { ...p, klassen: this.kiesFilter(t) };
    }
    if (nieuw) await this.bewaar("tel", tel);
    return { gevonden, zonder, nieuw };
  },
  /* Klassen in de tellingen die nog niet in de kaart staan (ze bestaan nu niet meer): opzoeken bij welke opleiding
   * ze hoorden, op een datum waarop ze bestonden. Hooguit 200; lukt het niet, dan proberen we het een volgende keer. */
  async deelOud(run, tellingen, kaart, ind) {
    const R = OplReken, leeft = () => run === this._run && !!this._pagina, laatst = new Map();
    for (const t of tellingen) for (const k of Object.keys(t.klassen)) if (!kaart[k] && t.klassen[k]) laatst.set(k, t.datum);
    const oud = (ind.oud ||= {}), zoek = [...laatst.entries()].slice(0, 200); let klaar = 0, gelukt = 0;
    await this.parallel(zoek, async ([k, datum]) => {
      if (!leeft()) return;
      const x = await this.indelingVan(k, datum);
      if (x && x.studie) { oud[k] = { studie: x.studie, lj: x.lj, jaar: R.sjStart(R.datum(datum)).getFullYear() }; kaart[k] = R.indeel(oud[k], k, oud[k].jaar); gelukt++; }
      if (leeft()) this.status(`Klassen van eerdere jaren indelen: ${++klaar} van ${zoek.length}…`, false, klaar / zoek.length);
    });
    if (gelukt && leeft()) await this.bewaar("indeling2", ind);
  },
  /* Het verloop op de pagina: de peildatums uit Magister, aangevuld met wat de extensie zelf heeft vastgelegd. */
  async verloop(DT, run, tel, ind, vers = false) {
    const R = OplReken, d = this._d, leeft = () => run === this._run && !!this._pagina;
    const r = await this.punten(run, tel, vers); if (!r) return;
    d.zonderEerder = r.zonder;
    const gevonden = r.gevonden, begin = R.peildata(new Date(), this._jaren)[0].datum;
    /* Wat de extensie zelf op eerdere dagen heeft vastgelegd gaat voor op wat Magister achteraf teruggeeft. */
    for (const [datum, klassen] of Object.entries(await this.opslag("momenten"))) if (datum >= begin && datum < d.vandaag) gevonden[datum] = { datum, teldatum: datum.slice(5) === "10-01", sj: R.sjNaam(R.datum(datum)), klassen: this.kiesFilter(klassen) };
    d.tellingen = [...Object.values(gevonden).sort((x, y) => x.datum.localeCompare(y.datum)), { datum: d.vandaag, vandaag: true, teldatum: d.vandaag.slice(5) === "10-01", klassen: d.nu }];
    await this.deelOud(run, d.tellingen, d.kaart, ind);
    if (!leeft()) return;
    d.verloopKlaar = true;
    this.status(""); this.teken(DT);
    await this.backupSchrijven();
    this.autoBijwerken(DT);
  },

  /* Studenten per week van een knoop, op een vaste rij weken (zodat reeksen naast elkaar passen). */
  lesVan(knoop, weken = null) { const d = this._d; return OplReken.lesReeks(knoop.klassen.map((k) => d.les[k] && OplReken.lesPunten(d.les[k].weken)), weken); },
  lesWekenAlle(klasNamen) { const d = this._d; return [...new Set(klasNamen.flatMap((k) => Object.keys(d.les[k] ? OplReken.lesPunten(d.les[k].weken) : {})))].sort(); },

  /* ---------- bediening ---------- */
  klik(DT, e) {
    const el = e.target.closest?.("[data-act]"); if (!el || el.localName === "select") return;
    const d = this._d, knoop = d && el.dataset.i != null ? d.knopen[+el.dataset.i] : null;
    switch (el.dataset.act) {
      case "open": if (knoop) { this._open.has(knoop.id) ? this._open.delete(knoop.id) : this._open.add(knoop.id); this.teken(DT); } break;
      case "alles-open": { const alle = d.knopen.filter((k) => k.soort !== "klas"); const dicht = alle.some((k) => !this._open.has(k.id)); for (const k of alle) dicht ? this._open.add(k.id) : this._open.delete(k.id); this.teken(DT); break; }
      case "aanw": case "les": if (knoop) this.bijwerken(DT, knoop.klassen); break;
      case "aanw-alles": case "les-alles": case "bijwerk": if (d) this.bijwerken(DT, Object.keys(d.nu)); break;
      case "les-opnieuw": if (d) this.bijwerken(DT, Object.keys(d.nu), { vol: true }); break;
      case "map-kies": this.kiesMap(DT); break;
      case "map-toegang": this.mapToegang(DT); break;
      case "map-los": this.mapLos(DT); break;
      case "filter": { const o = d?.boom[+el.dataset.s]; if (o) { this._uit.has(o.studie) ? this._uit.delete(o.studie) : this._uit.add(o.studie); this.teken(DT); } break; }
      case "filter-alles": this._uit.clear(); this.teken(DT); break;
      case "ga": case "zoom": if (knoop) { if (!this._zoom) this._terug = this._pagina.scrollTop; this._zoom = knoop.id; this.route(); this.teken(DT); this._pagina.scrollTop = 0; } break;
      case "terug": this._zoom = null; this.route(); this.teken(DT); this._pagina.scrollTop = this._terug || 0; break;
      case "keuze-ok": this.keuzeBewaar(DT); break;
      case "keuze-alles": case "keuze-niets": for (const x of this._pagina.querySelectorAll("input[data-klas]")) x.checked = el.dataset.act === "keuze-alles"; this.keuzeTotaal(); break;
      case "keuze-open": this._tab = "opslag"; this._zoom = null; this.route(); this.teken(DT); this._pagina.scrollTop = 0; break;
      case "tab": this._tab = el.dataset.t; this._zoom = null; this.route(); this.teken(DT); this._pagina.scrollTop = 0; break;
      case "mut-soort": this._mutSoort = el.dataset.w || null; this._mutAlles = false; this.teken(DT); break;
      case "mut-alles": this._mutAlles = !this._mutAlles; this.teken(DT); break;
      case "stop": this._stopAanw = true; this.status("Stoppen…"); break;
      case "weergave": this._weergave = el.dataset.w; this.teken(DT); break;
      case "vernieuw": if (!this._aanwBezig) this.laad(DT, true); break;
      case "excel": this.excel(DT); break;
      case "diagnose": this.diagnose(DT); break;
      case "diag-mut": this.diagnoseMutaties(DT); break;
    }
  },
  kies(DT, e) {
    if (e.target.matches?.("input[data-groep]")) for (const x of e.target.closest("details").querySelectorAll("input[data-klas]")) x.checked = e.target.checked;
    if (e.target.matches?.("input[data-groep], input[data-klas]")) return this.keuzeTotaal();
    const el = e.target.closest?.("select[data-act]"); if (!el) return;
    if (el.dataset.act === "periode") { this._per = el.value; this.herbereken(); this.teken(DT); }
    if (el.dataset.act === "jaren") { this._jaren = Number(el.value) || 0; try { localStorage.setItem("dt-opl-jaren", String(this._jaren)); } catch {} if (!this._aanwBezig) this.laad(DT); }
  },
  tip(e) {
    const el = e.target.closest?.("[data-tip]"), t = this._tip;
    if (!el) return t.classList.remove("is-aan");
    if (t._voor !== el) { t._voor = el; t.textContent = el.dataset.tip; }
    t.classList.add("is-aan");
    const r = t.getBoundingClientRect(), x = Math.min(window.innerWidth - r.width - 8, e.clientX + 14), y = e.clientY + 16 + r.height > window.innerHeight ? e.clientY - r.height - 10 : e.clientY + 16;
    t.style.left = `${Math.max(8, x)}px`; t.style.top = `${Math.max(8, y)}px`;
  },

  /* ---------- rekenen op de geladen gegevens ---------- */
  reeksVan(knoop) { const d = this._d; return OplReken.reeks(OplReken.klassenVan(knoop, d.kaart), d.tellingen); },
  totaalReeks() { return this._d.tellingen.map((t) => ({ datum: t.datum, n: Object.values(t.klassen).reduce((n, v) => n + (v || 0), 0) })); },
  aanwVan(klasNamen) { const d = this._d; return OplReken.som(klasNamen.map((k) => d.aanw[k])); },
  /* Peildatum voor "sinds": 1 oktober van dit schooljaar als die voorbij is, anders die van vorig schooljaar. */
  sinds() { const y = OplReken.sjStart().getFullYear(), dit = `${y}-10-01`; return dit < this._d.vandaag ? dit : `${y - 1}-10-01`; },
  /* Vaste kleur per reeks: plek 1 t/m 7 voor de grootste, de rest samen als "Overig". */
  /* alle: de volledige rij waaruit knopen een keuze is; de kleur hangt aan de plek in die rij, zodat een opleiding
   * zijn kleur houdt als je andere wegfiltert. */
  plekken(alle) { const top = alle.slice().sort((a, b) => b.aantal - a.aantal).slice(0, alle.length > 8 ? 7 : 8); return alle.filter((k) => top.includes(k)); },
  kleurVan(k, alle) { const i = this.plekken(alle).indexOf(k); return i < 0 ? "var(--opl-s0)" : `var(--opl-s${i + 1})`; },
  reeksen(knopen, van = (k) => this.reeksVan(k), alle = knopen) {
    const top = this.plekken(alle), uit = knopen.filter((k) => top.includes(k)).map((k) => ({ naam: k.naam, kleur: this.kleurVan(k, alle), punten: van(k) }));
    const rest = knopen.filter((k) => !top.includes(k));
    if (rest.length) { const rs = rest.map((k) => van(k)); uit.push({ naam: `Overig (${rest.length})`, kleur: "var(--opl-s0)", punten: rs[0].map((p, i) => ({ datum: p.datum, n: rs.reduce((n, x) => n + x[i].n, 0) })) }); }
    return uit;
  },

  /* ---------- grafieken (SVG) ---------- */
  lijn(reeksen, { hoogte = 230, week = false } = {}) {
    const E = (s) => this.esc(s), R = OplReken, data = reeksen[0]?.punten || [];
    if (data.length < 2) return `<p class="dt-opl-zacht">Nog geen verloop: er is maar één ${week ? "week" : "peildatum"}.</p>`;
    const wk = (d) => (typeof isoWeek === "function" ? isoWeek(d).w : "");
    const labels = reeksen.length > 1 && reeksen.length <= 4, W = 760, H = hoogte, L = 44, Rr = labels ? 150 : 14, T = 12, B = 26;
    const t0 = R.datum(data[0].datum).getTime(), t1 = R.datum(data[data.length - 1].datum).getTime();
    const max = Math.max(1, ...reeksen.flatMap((r) => r.punten.map((p) => p.n)));
    /* Liggen alle waarden dicht bij elkaar (de kleinste is meer dan de helft van de grootste), dan begint de as
     * niet bij nul: anders is een verschil van een paar studenten niet te zien. */
    const min = Math.min(...reeksen.flatMap((r) => r.punten.map((p) => p.n))), dicht = min > 0 && min / max > 0.5, onder = dicht ? Math.max(0, min - Math.max(2, (max - min) * 0.5)) : 0;
    const stap = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => (Math.ceil(max / s) * s - Math.floor(onder / s) * s) / s <= 6) || 10000;
    const basis = Math.floor(onder / stap) * stap, top = Math.max(basis + stap, Math.ceil(max / stap) * stap);
    const x = (datum) => L + (W - L - Rr) * (R.datum(datum).getTime() - t0) / Math.max(1, t1 - t0), y = (n) => T + (H - T - B) * (1 - (n - basis) / (top - basis));
    let s = `<svg class="dt-opl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aantal studenten per ${week ? "week" : "peildatum"}">`;
    for (let v = basis; v <= top; v += stap) s += `<line class="raster" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text class="as" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${this.getal(v)}</text>`;
    const wijd = (W - L - Rr) / (data.length - 1), elk = Math.ceil(60 / wijd / 3) * 3 || 3;
    data.forEach((p, i) => {
      const d = R.datum(p.datum), okt = !week && d.getMonth() === 9 && d.getDate() === 1;
      if (week) { if (i % Math.max(1, Math.ceil(44 / wijd)) === 0) s += `<text class="as" x="${x(p.datum)}" y="${H - 8}" text-anchor="middle">wk ${wk(d)}</text>`; return; }
      if (okt) s += `<line class="teldatum" x1="${x(p.datum)}" x2="${x(p.datum)}" y1="${T}" y2="${H - B}"/>`;
      if (okt || (i % elk === 0 && wijd * elk >= 40 && d.getDate() === 1 && ![8, 10].includes(d.getMonth()))) s += `<text class="as" x="${x(p.datum)}" y="${H - 8}" text-anchor="middle">${E(d.toLocaleDateString("nl-NL", { month: "short" }))} ’${String(d.getFullYear()).slice(2)}</text>`;
    });
    for (const r of reeksen) s += `<polyline fill="none" stroke="${r.kleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${r.punten.map((p) => `${x(p.datum).toFixed(1)},${y(p.n).toFixed(1)}`).join(" ")}"/>`;
    if (labels) {
      /* Naam aan het eind van de lijn; liggen ze te dicht op elkaar, dan schuiven ze uiteen. */
      const eind = reeksen.map((r) => ({ r, y: y(r.punten[r.punten.length - 1].n) })).sort((a, b) => a.y - b.y);
      eind.forEach((e, i) => { if (i && e.y - eind[i - 1].y < 13) e.y = eind[i - 1].y + 13; });
      for (const e of eind) s += `<circle cx="${W - Rr + 8}" cy="${e.y}" r="4" fill="${e.r.kleur}"/><text class="eind" x="${W - Rr + 16}" y="${e.y + 4}">${E(e.r.naam.length > 21 ? e.r.naam.slice(0, 20) + "…" : e.r.naam)}</text>`;
    } else if (reeksen.length === 1) { const p = data[data.length - 1]; s += `<circle class="punt" cx="${x(p.datum)}" cy="${y(p.n)}" r="4" fill="${reeksen[0].kleur}"/>`; }
    /* Aanwijzen: per peildatum een onzichtbare kolom met een leeslijn, de punten en de waarden. */
    data.forEach((p, i) => {
      const d = R.datum(p.datum), tip = [week ? `Week ${wk(d)} (vanaf ${this.kort(p.datum, false)})` : `${this.kort(p.datum)}${d.getMonth() === 9 && d.getDate() === 1 ? " · teldatum" : i === data.length - 1 ? " · vandaag" : ""}`,
        ...reeksen.map((r) => ({ naam: r.naam, n: r.punten[i].n })).sort((a, b) => b.n - a.n).map((r) => `${r.naam}: ${this.getal(r.n)}`)].join("\n");
      s += `<g class="kolom" data-tip="${E(tip)}"><rect x="${x(p.datum) - wijd / 2}" y="${T}" width="${wijd}" height="${H - T - B}" fill="transparent"/><line class="kruis" x1="${x(p.datum)}" x2="${x(p.datum)}" y1="${T}" y2="${H - B}"/>${reeksen.map((r) => `<circle class="punt" cx="${x(p.datum)}" cy="${y(r.punten[i].n)}" r="4" fill="${r.kleur}"/>`).join("")}</g>`;
    });
    s += `</svg>`;
    if (basis > 0) s += `<p class="dt-opl-zacht dt-opl-asnoot">De as begint bij ${this.getal(basis)}, niet bij nul.</p>`;
    if (reeksen.length > 1) s += `<div class="dt-opl-legenda">${reeksen.map((r) => `<span><i style="background:${r.kleur}"></i>${E(r.naam)}</span>`).join("")}</div>`;
    return s;
  },
  vonk(reeks) {
    if (reeks.length < 2) return "";
    const W = 96, H = 24, max = Math.max(1, ...reeks.map((p) => p.n)), min = Math.min(...reeks.map((p) => p.n)), span = Math.max(1, max - min);
    const pt = reeks.map((p, i) => [2 + (W - 8) * i / (reeks.length - 1), 3 + (H - 6) * (1 - (p.n - min) / span)]);
    return `<svg class="dt-opl-vonk" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline fill="none" stroke="var(--opl-s1)" stroke-width="1.5" stroke-linejoin="round" points="${pt.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/><circle cx="${pt[pt.length - 1][0]}" cy="${pt[pt.length - 1][1]}" r="2.5" fill="var(--opl-s1)"/></svg>`;
  },
  /* Liggende balk met de verdeling over de categorieën (vrijstelling telt niet mee en staat alleen in de tip). */
  verdeling(c) {
    const R = OplReken, tip = [`Aanwezig (met te laat): ${this.pct(c.pct)}`, ...R.CATS.map(([k, naam]) => `${naam}: ${this.pct(c.cat[k].pct)} (${this.getal(c.cat[k].n)})`)].join("\n");
    return `<span class="dt-opl-verd" data-tip="${this.esc(tip)}">${R.CATS.filter(([k]) => k !== "VR" && c.cat[k].n).map(([k, , kleur]) => `<i style="flex:${c.cat[k].n} 0 0;background:${kleur}"></i>`).join("")}</span>`;
  },
  weken(agg) {
    const R = OplReken, E = (s) => this.esc(s), ws = Object.keys(agg.weken).sort().map((k) => ({ k, c: R.cijfers(agg.weken[k]) })).filter((w) => w.c.telt);
    if (!ws.length) return `<p class="dt-opl-zacht">Geen lessen in deze periode.</p>`;
    const W = 760, H = 170, L = 44, T = 10, B = 24, breed = (W - L - 10) / ws.length, staaf = Math.min(46, breed - 2), y = (p) => T + (H - T - B) * (1 - p / 100);
    let s = `<svg class="dt-opl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aanwezigheid per week">`;
    for (const v of [0, 25, 50, 75, 100]) s += `<line class="raster" x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}"/><text class="as" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}%</text>`;
    const elk = Math.ceil(34 / breed);
    ws.forEach((w, i) => {
      const x0 = L + breed * i + (breed - staaf) / 2, wk = typeof isoWeek === "function" ? isoWeek(R.datum(w.k)).w : "";
      let onder = 0, staven = "";
      for (const [k, , kleur] of R.CATS) {
        if (k === "VR" || !w.c.cat[k].n) continue;
        const deel = 100 * w.c.cat[k].n / w.c.telt, h = Math.max(0, y(onder) - y(onder + deel) - 2);
        if (h > 0) staven += `<rect x="${x0.toFixed(1)}" y="${(y(onder + deel) + 1).toFixed(1)}" width="${staaf.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${kleur}"/>`;
        onder += deel;
      }
      const tip = [`Week ${wk} (vanaf ${this.kort(w.k, false)})`, ...(agg.actief?.[w.k] ? [`Studenten met lessen: ${this.getal(agg.actief[w.k])}`] : []), `Aanwezig (met te laat): ${this.pct(w.c.pct)}`, ...R.CATS.filter(([k]) => w.c.cat[k].n).map(([k, naam]) => `${naam}: ${this.pct(w.c.cat[k].pct)} (${this.getal(w.c.cat[k].n)})`)].join("\n");
      s += `<g class="kolom" data-tip="${E(tip)}"><rect x="${L + breed * i}" y="${T}" width="${breed}" height="${H - T - B}" fill="transparent"/>${staven}</g>`;
      if (i % elk === 0) s += `<text class="as" x="${x0 + staaf / 2}" y="${H - 8}" text-anchor="middle">wk ${wk}</text>`;
    });
    return s + `<line class="norm" x1="${L}" x2="${W - 10}" y1="${y(80)}" y2="${y(80)}"/><text class="as" x="${W - 12}" y="${y(80) - 4}" text-anchor="end">norm 80%</text></svg>`;
  },
  legendaCats() { return `<div class="dt-opl-legenda">${OplReken.CATS.map(([, naam, kleur]) => `<span><i style="background:${kleur}"></i>${naam}</span>`).join("")}</div>`; },

  /* ---------- tekenen ---------- */
  teken(DT) {
    const d = this._d; if (!d || !this._pagina) return;
    const R = OplReken, E = (s) => this.esc(s), per = this.periode(), stand = d.verloopKlaar ? R.verloopStand(d.tellingen) : "ok";
    const totaal = d.klassen.reduce((n, k) => n + k.aantal, 0), tot = this.totaalReeks(), sinds = this.sinds(), dTot = R.verschil(tot, sinds);
    const alle = this.aanwVan(Object.keys(d.nu)), cAlle = alle ? R.cijfers(alle.per) : null, geladen = Object.keys(d.aanw).length;
    const delta = (n) => n == null ? "" : `<span class="dt-opl-delta ${n > 0 ? "is-op" : n < 0 ? "is-neer" : ""}">${n > 0 ? "▲ +" : n < 0 ? "▼ −" : "= "}${this.getal(Math.abs(n))}</span>`;
    const kpi = (label, waarde, sub = "") => `<dna-card class="dt-opl-kaart dt-opl-kpi"><small>${label}</small><b>${waarde}</b><span>${sub}</span></dna-card>`;
    const kpis = `<div class="dt-opl-kpis">
      ${kpi("Studenten", this.getal(totaal), dTot == null || stand === "leeg" ? "ingeschreven op dit moment" : `${delta(dTot)} sinds ${E(this.kort(sinds))}`)}
      ${kpi("Opleidingen", this.getal(d.boom.length), `${this.getal(d.boom.reduce((n, o) => n + o.kinderen.length, 0))} leerjaren`)}
      ${kpi("Klassen", this.getal(d.klassen.length), `gemiddeld ${this.getal(Math.round(10 * totaal / Math.max(1, d.klassen.length)) / 10)} studenten per klas`)}
      ${kpi("Aanwezigheid", cAlle ? this.pct(cAlle.pct) : "—", cAlle ? `${E(per.naam.toLowerCase())} · ${geladen} van ${d.klassen.length} klassen` : "nog niet opgehaald")}
      ${kpi("Onder de norm", alle ? this.getal(alle.onder) : "—", alle ? `van ${this.getal(alle.studenten)} studenten onder 80% aanwezig` : "studenten onder 80% aanwezig")}
    </div>`;

    /* Verloop van de inschrijvingen */
    const perOpl = this._weergave === "opleiding" && d.boom.length > 1;
    /* Opleidingen aan en uit zetten: de knoppen zijn meteen de legenda (de kleur hoort bij de opleiding). */
    for (const st of [...this._uit]) if (!d.boom.some((o) => o.studie === st)) this._uit.delete(st);
    const zicht = d.boom.filter((o) => !this._uit.has(o.studie)), somReeks = (rs) => (rs[0] || []).map((p, i) => ({ datum: p.datum, n: rs.reduce((n, x) => n + x[i].n, 0) }));
    const filter = d.boom.length > 1 ? `<div class="dt-opl-filter" role="group" aria-label="Opleidingen tonen">${d.boom.map((o, i) => `<button type="button" class="dt-opl-chip" data-act="filter" data-s="${i}" aria-pressed="${!this._uit.has(o.studie)}"><i style="background:${this.kleurVan(o, d.boom)}"></i>${E(o.naam)}</button>`).join("")}${this._uit.size ? `<button type="button" class="dt-opl-knop is-stil" data-act="filter-alles">Alles tonen</button>` : ""}</div>` : "";
    const seg = (w, naam) => `<button type="button" class="dt-opl-seg" data-act="weergave" data-w="${w}" aria-pressed="${String(this._weergave === w || (w === "totaal" && !perOpl))}">${naam}</button>`;
    const verloopKaart = `<dna-card class="dt-opl-kaart"><div class="dt-opl-kaartkop"><div><h2>Verloop van de inschrijvingen</h2><p class="dt-opl-zacht">Aantal ingeschreven studenten op de eerste van elke maand. De stippellijn staat op 1 oktober, de landelijke teldatum.</p></div>
      <div class="dt-opl-rij">${d.boom.length > 1 ? `<span class="dt-opl-segs">${seg("opleiding", "Per opleiding")}${seg("totaal", "Totaal")}</span>` : ""}
      <label class="dt-opl-zacht">Terug tot <select class="dt-opl-veld" data-act="jaren">${[0, 1, 2, 3, 5].map((j) => `<option value="${j}"${j === this._jaren ? " selected" : ""}>${j === 0 ? "alleen dit schooljaar" : `${j} ${j === 1 ? "schooljaar" : "schooljaren"} terug`}</option>`).join("")}</select></label></div></div>
      ${filter}
      ${!d.verloopKlaar ? `<p class="dt-opl-zacht">Verloop wordt opgehaald…</p>` : stand === "leeg" ? "" : !zicht.length ? `<p class="dt-opl-zacht">Kies hierboven minstens één opleiding.</p>` : this.lijn(perOpl ? this.reeksen(zicht, undefined, d.boom) : [{ naam: this._uit.size ? `Selectie (${zicht.length} opleidingen)` : "Alle studenten", kleur: "var(--opl-s1)", punten: this._uit.size ? somReeks(zicht.map((o) => this.reeksVan(o))) : tot }])}
      ${d.verloopKlaar ? this.verloopNoot(stand) : ""}</dna-card>`;

    /* Boom: opleiding › leerjaar › klas */
    const maxAantal = Math.max(1, ...d.boom.map((o) => o.aantal)), verouderd = d.klassen.filter((k) => this.verouderd(d.jaar[k.naam])).length;
    const uitCache = d.klassen.filter((k) => !d.jaar[k.naam] && (d.oud.aanw[k.naam] || d.oud.les[k.naam])).length;
    const rij = (k, diep) => {
      const i = d.knopen.indexOf(k), open = this._open.has(k.id), reeks = this.reeksVan(k), agg = this.aanwVan(k.klassen), c = agg ? R.cijfers(agg.per) : null;
      const nGeladen = k.klassen.filter((x) => d.aanw[x]).length, dk = R.verschil(reeks, sinds);
      const sub = (k.soort === "opleiding" && k.crebo ? `crebo ${E(k.crebo)} · ` : k.soort === "leerjaar" && k.cohort ? `cohort ${k.cohort} · ` : "") + (k.soort === "opleiding" ? `${k.kinderen.length} leerja${k.kinderen.length === 1 ? "ar" : "ren"} · ${k.klassen.length} klas${k.klassen.length === 1 ? "" : "sen"}` : k.soort === "leerjaar" ? `${k.klassen.length} klas${k.klassen.length === 1 ? "" : "sen"}` : (k.mentor ? `mentor ${E(k.mentor)}` : ""));
      const blad = !k.kinderen.length;
      let r = `<tr id="dt-opl-r${i}" class="is-${k.soort}${open ? " is-open" : ""}"><td class="naam" style="padding-left:${8 + diep * 22}px"><button type="button" class="dt-opl-klap" data-act="${blad ? "zoom" : "open"}" data-i="${i}"${blad ? ` title="Details van ${E(k.naam)}"` : ` aria-expanded="${open}"`}><span class="pijl" aria-hidden="true">${blad ? "" : "▸"}</span><span><b>${E(k.naam)}</b>${sub ? `<small>${sub}</small>` : ""}</span></button></td>
        <td class="getal"><b>${this.getal(k.aantal)}</b></td><td class="aandeel"><span class="dt-opl-pbalk"><i style="width:${Math.round(100 * k.aantal / maxAantal)}%"></i></span></td>
        <td class="vonk">${stand !== "leeg" ? this.vonk(reeks) : ""}</td><td class="getal">${stand !== "leeg" ? delta(dk) : ""}</td>
        <td class="aanw">${c && c.telt ? `${this.verdeling(c)}<b class="${c.pct < 80 ? "is-laag" : ""}">${this.pct(c.pct)}</b>${nGeladen < k.klassen.length ? `<small>${nGeladen}/${k.klassen.length} klassen</small>` : ""}` : `<button type="button" class="dt-opl-knop" data-act="aanw" data-i="${i}"${this._aanwBezig ? " disabled" : ""}>Ophalen</button>`}</td>
        <td class="getal"><button type="button" class="dt-opl-knop is-stil" data-act="zoom" data-i="${i}" title="Verloop, aanwezigheid en mutaties van ${E(k.naam)}">Details ›</button></td></tr>`;
      if (open) for (const kind of k.kinderen) r += rij(kind, diep + 1);
      return r;
    };
    const boomKaart = (wortels, titel, uitleg) => `<dna-card class="dt-opl-kaart"><div class="dt-opl-kaartkop"><div><h2>${titel}</h2><p class="dt-opl-zacht">${uitleg}</p></div>
      <div class="dt-opl-rij"><label class="dt-opl-zacht">Aanwezigheid over <select class="dt-opl-veld" data-act="periode">${this.periodes().map((p) => `<option value="${E(p.key)}"${p.key === per.key ? " selected" : ""}>${E(p.naam)}</option>`).join("")}</select></label>
      ${verouderd ? `<button type="button" class="dt-opl-knop" data-act="aanw-alles"${this._aanwBezig ? " disabled" : ""} title="Haalt alleen op wat vandaag nog niet is bijgewerkt">Bijwerken (${verouderd} ${verouderd === 1 ? "klas" : "klassen"})</button>` : ""}
      ${wortels.some((o) => o.kinderen.length) ? `<button type="button" class="dt-opl-knop is-stil" data-act="alles-open">Alles in- of uitklappen</button>` : ""}</div></div>
      <div class="dt-opl-scroll"><table class="dt-opl-tabel"><thead><tr><th>Opleiding › leerjaar › klas</th><th class="getal">Studenten</th><th></th><th>${stand !== "leeg" ? "Verloop" : ""}</th><th class="getal">${stand !== "leeg" ? `Sinds ${E(this.kort(sinds, false))}` : ""}</th><th>Aanwezigheid (${E(per.naam.toLowerCase())})</th><th></th></tr></thead><tbody>${wortels.map((o) => rij(o, 0)).join("")}</tbody></table></div>
      ${this.legendaCats()}${uitCache ? `<p class="dt-opl-zacht">${uitCache} ${uitCache === 1 ? "klas toont" : "klassen tonen"} nog wat er eerder is opgehaald; dat wordt vervangen zodra het bijwerken klaar is.</p>` : ""}</dna-card>`;

    /* Weergaven: vier tabbladen, en een eigen weergave per opleiding, leerjaar of klas ("Details"). */
    const nMut = Object.values(d.mut || {}).reduce((n, m) => n + m.length, 0), zoom = this._zoom ? d.knopen.find((k) => k.id === this._zoom) : null;
    if (!zoom) this._zoom = null;
    const TABS = [["overzicht", "Overzicht"], ["verloop", "Verloop"], ["mutaties", `Mutaties${nMut ? ` <small>${this.getal(nMut)}</small>` : ""}`], ["opslag", "Keuze en opslag"]];
    if (!TABS.some(([t]) => t === this._tab)) this._tab = "overzicht";
    let h = `<div class="dt-opl-tabs" role="tablist" aria-label="Weergave">${TABS.map(([t, naam]) => `<button type="button" role="tab" class="dt-opl-tab" data-act="tab" data-t="${t}" aria-selected="${String(!zoom && this._tab === t)}">${naam}</button>`).join("")}${zoom ? `<button type="button" role="tab" class="dt-opl-tab" aria-selected="true">${E(zoom.naam)}</button>` : ""}</div>`;
    if (zoom) h += this.zoomWeergave(zoom, { stand, sinds, delta, kpi, boomKaart });
    else if (this._tab === "verloop") h += verloopKaart + this.lesKaart(perOpl, zicht) + this.cohortKaart();
    else if (this._tab === "mutaties") h += this.mutatieKaart();
    else if (this._tab === "opslag") h += this.keuzeKaart() + this.opslagKaart();
    else h += (this._kies ? `<p class="dt-opl-melding">${E(this.keuzeTekst())} <button type="button" class="dt-opl-knop is-stil" data-act="keuze-open">Wijzigen</button></p>` : "") + kpis + boomKaart(d.boom, "Opleidingen, leerjaren en klassen", "Klik op een opleiding of leerjaar om uit te klappen, of op Details voor het verloop, de aanwezigheid en de mutaties.") + this.aandacht(sinds);
    h += `<p class="dt-opl-zacht dt-opl-voet">Uit Magister, met jouw rechten: je ziet de klassen die jij in Magister mag zien. Aanwezig % = aanwezig en te laat, gedeeld door de lessen die meetellen; een vrijstelling telt niet mee (zoals Inzicht). Het verloop per opleiding gaat ervan uit dat een klas elk jaar bij dezelfde opleiding en hetzelfde leerjaar hoort. De aanwezigheid gaat over hele weken en over de studenten die nu in de klas zitten.</p>`;
    const top = this._pagina.scrollTop;
    this._lijf.innerHTML = h;
    this.keuzeTotaal();
    this._pagina.scrollTop = top;
  },

  /* Eigen weergave van één opleiding, leerjaar of klas: kerncijfers, verloop, aanwezigheid, mutaties en wat eronder valt. */
  zoomWeergave(k, { stand, sinds, delta, kpi, boomKaart }) {
    const d = this._d, R = OplReken, E = (s) => this.esc(s), per = this.periode(), i = d.knopen.indexOf(k);
    const reeks = this.reeksVan(k), agg = this.aanwVan(k.klassen), c = agg ? R.cijfers(agg.per) : null, nGeladen = k.klassen.filter((x) => d.aanw[x]).length, dk = R.verschil(reeks, sinds);
    const mut = k.klassen.flatMap((x) => d.mut[x] || []), n = (srt) => mut.filter((m) => m.soort === srt).length;
    const boven = d.knopen.filter((x) => x !== k && x.klassen.length > k.klassen.length && k.klassen.every((y) => x.klassen.includes(y))).sort((a, b) => b.klassen.length - a.klassen.length);
    const SOORT = { opleiding: "Opleiding", leerjaar: "Leerjaar", klas: "Klas" };
    return `<div class="dt-opl-zoomkop"><button type="button" class="dt-opl-knop" data-act="terug">‹ Terug</button>
        <div><h2>${E(k.naam)}</h2><p class="dt-opl-zacht">${SOORT[k.soort] || ""}${boven.map((x) => ` · <button type="button" class="dt-opl-ga" data-act="zoom" data-i="${d.knopen.indexOf(x)}">${E(x.naam)}</button>`).join("")}${k.crebo ? ` · crebo ${E(k.crebo)}` : ""}${k.cohort ? ` · cohort ${E(k.cohort)}` : ""}${k.mentor ? ` · mentor ${E(k.mentor)}` : ""}</p></div>
        <label class="dt-opl-zacht">Aanwezigheid over <select class="dt-opl-veld" data-act="periode">${this.periodes().map((p) => `<option value="${E(p.key)}"${p.key === per.key ? " selected" : ""}>${E(p.naam)}</option>`).join("")}</select></label></div>
      <div class="dt-opl-kpis">
        ${kpi("Studenten", this.getal(k.aantal), dk == null || stand === "leeg" ? `${k.klassen.length} klas${k.klassen.length === 1 ? "" : "sen"}` : `${delta(dk)} sinds ${E(this.kort(sinds))}`)}
        ${kpi("Aanwezigheid", c && c.telt ? this.pct(c.pct) : "—", c && c.telt ? E(per.naam.toLowerCase()) : "nog niet opgehaald")}
        ${kpi("Onder de norm", agg ? this.getal(agg.onder) : "—", agg ? `van ${this.getal(agg.studenten)} studenten onder 80% aanwezig` : "studenten onder 80% aanwezig")}
        ${kpi("Ingestroomd", this.getal(n("in")), "later begonnen dan de klas")}
        ${kpi("Uit de klas", this.getal(n("uit")), "dit schooljaar")}
      </div>
      <dna-card class="dt-opl-kaart dt-opl-zoom">${this.detail(k, i, stand !== "leeg" ? reeks : null, agg, c, nGeladen)}</dna-card>
      ${k.kinderen.length ? boomKaart(k.kinderen, `${k.soort === "opleiding" ? "Leerjaren en klassen" : "Klassen"} van ${E(k.naam)}`, "Klik op Details om verder in te zoomen.") : ""}`;
  },

  /* Het verloop (gesplitst naar wat eronder valt), de aanwezigheid en de mutaties van één knoop. */
  detail(k, i, reeks, agg, c, nGeladen) {
    const R = OplReken, E = (s) => this.esc(s), per = this.periode();
    let h = `<div class="dt-opl-detail">`;
    if (reeks) {
      const lijnen = k.kinderen.length > 1 ? this.reeksen(k.kinderen) : [{ naam: k.naam, kleur: "var(--opl-s1)", punten: reeks }];
      h += `<section class="breed"><h3>Verloop ${E(k.naam)}${k.kinderen.length > 1 ? ` per ${k.soort === "opleiding" ? "leerjaar" : "klas"}` : ""}</h3>${this.lijn(lijnen, { hoogte: 200 })}</section>`;
    }
    const lesKl = k.klassen.filter((x) => this._d.les[x]);
    if (lesKl.length) {
      const weken = this.lesWekenAlle(lesKl), kinderen = k.kinderen.filter((x) => x.klassen.some((y) => this._d.les[y]));
      h += `<section class="breed"><h3>Studenten per week (uit de lessen)${lesKl.length < k.klassen.length ? ` <span class="dt-opl-zacht">· ${lesKl.length} van ${k.klassen.length} klassen <button type="button" class="dt-opl-knop" data-act="les" data-i="${i}"${this._aanwBezig ? " disabled" : ""}>Rest ophalen</button></span>` : ""}</h3>${this.lijn(kinderen.length > 1 ? this.reeksen(kinderen, (x) => this.lesVan(x, weken)) : [{ naam: k.naam, kleur: "var(--opl-s1)", punten: this.lesVan(k, weken) }], { hoogte: 200, week: true })}</section>`;
      const mut = k.klassen.flatMap((x) => (this._d.mut[x] || []).map((m) => ({ ...m, klas: x })));
      if (mut.length) h += `<section class="breed"><h3>Mutaties uit de lessen</h3>${this.mutatieTabel(mut.sort((a, b) => String(b.week || "").localeCompare(String(a.week || ""))), k.soort !== "klas")}</section>`;
    } else h += `<section class="breed"><h3>Studenten per week (uit de lessen)</h3><p class="dt-opl-zacht">Nog niet opgehaald. <button type="button" class="dt-opl-knop" data-act="les" data-i="${i}"${this._aanwBezig ? " disabled" : ""}>Lessen van dit schooljaar ophalen (${this.getal(k.aantal)} studenten)</button></p></section>`;
    if (!c || !c.telt) {
      h += `<section class="breed"><h3>Aanwezigheid</h3><p class="dt-opl-zacht">${agg ? "Geen lessen in deze periode." : `Nog niet opgehaald voor ${E(per.naam.toLowerCase())}.`} ${agg ? "" : `<button type="button" class="dt-opl-knop" data-act="aanw" data-i="${i}"${this._aanwBezig ? " disabled" : ""}>Ophalen (${this.getal(k.aantal)} studenten)</button>`}</p></section></div>`;
      return h;
    }
    const deels = nGeladen < k.klassen.length ? ` <span class="dt-opl-zacht">· ${nGeladen} van ${k.klassen.length} klassen opgehaald <button type="button" class="dt-opl-knop" data-act="aanw" data-i="${i}"${this._aanwBezig ? " disabled" : ""}>Rest ophalen</button></span>` : "";
    h += `<section><h3>Aanwezigheid · ${E(per.naam.toLowerCase())}${deels}</h3><table class="dt-opl-cats"><tbody>
      ${R.CATS.map(([key, naam, kleur]) => `<tr><td><i style="background:${kleur}"></i>${naam}</td><td class="getal">${this.getal(c.cat[key].n)}</td><td class="getal"><b>${this.pct(c.cat[key].pct)}</b></td></tr>`).join("")}
      <tr class="som"><td>Aanwezig (met te laat)</td><td class="getal">${this.getal(c.aanwezig)} / ${this.getal(c.telt)}</td><td class="getal"><b class="${c.pct < 80 ? "is-laag" : ""}">${this.pct(c.pct)}</b></td></tr></tbody></table>
      <p class="dt-opl-zacht">${this.getal(agg.studenten)} studenten, ${this.getal(c.lessen)} lessen. Vrijstelling is een deel van alle lessen; de rest van de lessen die meetellen.${agg.fout ? ` Van ${agg.fout} student${agg.fout === 1 ? "" : "en"} lukte het ophalen niet.` : ""}</p></section>`;
    const metLes = agg.studenten - agg.zonder, DAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
    const balk = (label, p, n, kleur, tip) => `<div class="dt-opl-hbalk" data-tip="${E(tip)}"><span>${label}</span><i><b style="width:${Math.max(0, Math.min(100, p))}%;background:${kleur}"></b></i><em>${n}</em></div>`;
    h += `<section><h3>Studenten naar aanwezigheid</h3>${R.BANDEN.map((naam, b) => balk(naam, metLes ? 100 * agg.banden[b] / metLes : 0, this.getal(agg.banden[b]), ["#e5484d", "#f5a524", "#9bc53d", "#2fa36b"][b], `${naam}: ${agg.banden[b]} van ${metLes} studenten`)).join("")}
      <p class="dt-opl-zacht"><b class="${agg.onder ? "is-laag" : ""}">${this.getal(agg.onder)}</b> van ${this.getal(metLes)} onder de norm van 80%${agg.zonder ? ` · ${agg.zonder} zonder lessen` : ""}.</p>
      <h3>Per weekdag</h3>${[1, 2, 3, 4, 5, 6, 0].filter((dg) => agg.dagen[dg]).map((dg) => { const cd = R.cijfers(agg.dagen[dg]); return balk(DAG[dg], cd.pct ?? 0, this.pct(cd.pct), "var(--opl-s1)", `${DAG[dg]}: ${this.pct(cd.pct)} aanwezig van ${this.getal(cd.telt)} lessen`); }).join("")}</section>
      <section class="breed"><h3>Per week</h3>${this.weken(agg)}</section></div>`;
    return h;
  },

  /* Studenten per week, geteld uit de lessen van dit schooljaar. zicht: de opleidingen die het filter laat staan. */
  lesKaart(perOpl, zicht) {
    const d = this._d, E = (s) => this.esc(s), namen = Object.keys(d.nu), met = namen.filter((k) => d.les[k]);
    let h = `<dna-card class="dt-opl-kaart"><div class="dt-opl-kaartkop"><div><h2>Studenten per week, uit de lessen</h2><p class="dt-opl-zacht">Per week het aantal studenten dat les had, geteld uit de roosters van dit schooljaar. Weken met weinig lessen (vakantie, toetsweek, stage) tellen niet mee.</p></div></div>`;
    if (!met.length) return h + `<p class="dt-opl-zacht">${this._aanwBezig ? "De lessen van dit schooljaar worden opgehaald…" : `Nog niet opgehaald. <button type="button" class="dt-opl-knop" data-act="les-alles">Lessen van dit schooljaar ophalen</button>`}</p></dna-card>`;
    const knopen = zicht.filter((o) => o.klassen.some((k) => d.les[k])), kl = knopen.flatMap((o) => o.klassen).filter((k) => d.les[k]), weken = this.lesWekenAlle(kl);
    h += !knopen.length ? `<p class="dt-opl-zacht">Geen lessen opgehaald voor de gekozen opleidingen.</p>`
      : this.lijn(perOpl && d.boom.length > 1 ? this.reeksen(knopen, (k) => this.lesVan(k, weken), d.boom) : [{ naam: this._uit.size ? `Selectie (${knopen.length} opleidingen)` : "Alle studenten", kleur: "var(--opl-s1)", punten: OplReken.lesReeks(kl.map((k) => OplReken.lesPunten(d.les[k].weken)), weken) }], { week: true });
    const weg = met.reduce((s, k) => s + (d.les[k].weg || 0), 0);
    h += `<p class="dt-opl-zacht">${met.length} van ${namen.length} klassen. ${weg ? `${this.getal(weg)} student${weg === 1 ? " staat" : "en staan"} inmiddels niet meer in hun klas en ${weg === 1 ? "telt" : "tellen"} mee tot de laatste les; zie het tabblad Mutaties.` : "Tot nu toe is niemand uit een klas verdwenen."} Een student telt in een week mee zodra die minstens één les in het rooster had.</p>`;
    return h + `</dna-card>`;
  },

  /* Toelichting onder het verloop: tot waar Magister teruggaat, en dat de extensie de stand zelf bijhoudt. */
  verloopNoot(stand) {
    const d = this._d, eerste = d.tellingen[0]?.datum, delen = [];
    if (stand === "leeg") delen.push("Magister geeft voor eerdere datums geen klassen terug, dus er is nog geen verloop.");
    else if (d.zonderEerder) delen.push(`Het verloop begint op ${this.esc(this.kort(eerste))}: Magister geeft alleen het lopende schooljaar terug. Staat in Magister het schakelen naar een eerder schooljaar aan, dan legt deze pagina dat jaar vast zodra je haar in dat schooljaar opent.`);
    if (stand === "vlak") delen.push("Alle peildatums geven dezelfde aantallen als vandaag: er is sindsdien niets veranderd, of Magister toont steeds de huidige stand.");
    delen.push("Vanaf nu legt de extensie bij elk bezoek aan deze pagina de stand van die dag vast (alleen aantallen, in deze browser), zodat het verloop vanzelf aangroeit. Hieronder staan de studenten per cohort.");
    return `<p class="dt-opl-melding">${delen.join(" ")} <button type="button" class="dt-opl-knop is-stil" data-act="diagnose" title="Zet op het klembord wat Magister teruggeeft: alleen veldnamen, aantallen en statuscodes, geen namen">Diagnose kopiëren</button></p>`;
  },

  /* Studenten per opleiding en cohort (het jaar van instroom uit de studiecode): een tabel met een balk per cel. */
  cohortKaart() {
    const d = this._d, E = (s) => this.esc(s), c = d.cohorten;
    if (!c || !c.cohorten.length) return "";
    const max = Math.max(1, ...c.rijen.flatMap((r) => Object.values(r.per))), sjJaar = OplReken.sjStart().getFullYear();
    const naam = (studie) => d.boom.find((o) => o.studie === studie)?.naam || studie;
    return `<dna-card class="dt-opl-kaart"><h2>Studenten per cohort</h2><p class="dt-opl-zacht">Hoeveel studenten van elk instroomjaar nu nog ingeschreven staan, uit de studiecode van elke student (opleiding, crebo, cohort).</p>
      <div class="dt-opl-scroll dt-opl-cohort"><table class="dt-opl-tabel"><thead><tr><th>Opleiding</th>${c.cohorten.map((j) => `<th>Cohort ${j}<small>${sjJaar - j + 1 >= 1 ? `leerjaar ${sjJaar - j + 1}` : "start nog"}</small></th>`).join("")}<th class="getal">Totaal</th></tr></thead><tbody>
      ${c.rijen.map((r) => `<tr><td><b>${E(naam(r.studie))}</b></td>${c.cohorten.map((j) => `<td>${r.per[j] ? `<span class="dt-opl-cel" data-tip="${E(`${naam(r.studie)}, cohort ${j}: ${r.per[j]} studenten`)}"><i><b style="width:${Math.round(100 * r.per[j] / max)}%"></b></i><em>${this.getal(r.per[j])}</em></span>` : `<span class="dt-opl-zacht">—</span>`}</td>`).join("")}<td class="getal"><b>${this.getal(r.totaal)}</b></td></tr>`).join("")}
      </tbody></table></div></dna-card>`;
  },

  /* Diagnose: wat geeft Magister terug voor vandaag en voor een eerdere datum? Alleen veldnamen, aantallen en
   * statuscodes, geen namen of nummers. Gaat naar het klembord. */
  async diagnose(DT) {
    const R = OplReken, d = this._d || { vandaag: R.ymd(new Date()), klassen: [], nu: {} };
    this.status("Diagnose maken…");
    const y = R.sjStart().getFullYear(), datums = [d.vandaag, `${y}-10-01`, `${y - 1}-10-01`, `${y - 1}-03-01`].filter((x, i) => i === 0 || x < d.vandaag);
    const som = (o) => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0), vorm = (v) => JSON.stringify(v ?? null);
    let klas = d.klassen.slice().sort((a, b) => b.aantal - a.aantal)[0]?.naam, velden = false;
    const uit = [`Diagnose Opleidingen (Docentdeck ${DT.version}), ${d.vandaag}`, `Klassen vandaag: ${d.klassen.length}, studenten: ${som(d.nu)}, alleen eigen klassen: ${this._rol ? "ja" : "nee"}`, ""];
    let eerste = null;
    for (const peil of datums) {
      const f = await DT.api(`/api/leerlingen/zoeken/filters?q=**${this._rol ? "&rol=Docent" : ""}&peildatum=${peil}`, { full: true, timeout: 20000 });
      const kl = f.status === 200 ? (f.json?.klassen || []) : [], t = Object.fromEntries(kl.map((k) => [k.naam, k.aantal]));
      uit.push(`filters ${peil}: status ${f.status}, ${kl.length} klassen, som aantal ${som(t)}, gelijk aan vandaag: ${kl.length && kl.every((k) => d.nu[k.naam] === k.aantal) && kl.length === d.klassen.length ? "ja" : "nee"}, klassen die vandaag niet bestaan: ${kl.filter((k) => !(k.naam in d.nu)).length}`);
      if (peil === d.vandaag) uit.push(`  velden filters: ${vorm(f.shape)}`);
      klas ||= kl.slice().sort((a, b) => (b.aantal || 0) - (a.aantal || 0))[0]?.naam;
      if (klas) {
        const z = await DT.api(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam`, { full: true, timeout: 20000 });
        const lln = DT.lijst(z) || [];
        uit.push(`zoeken grootste klas ${peil}: status ${z.status}, ${lln.length} studenten${z.json && !Array.isArray(z.json) ? `, overige velden: ${Object.keys(z.json).filter((k) => k !== "items").join(", ") || "geen"}` : ""}`);
        if (!velden && lln.length) { velden = true; uit.push(`  velden student: ${vorm(Array.isArray(z.shape) ? z.shape[0] : z.shape?.items?.[0])}`); eerste = lln[0].id; }
      }
      await this.wacht(150);
    }
    /* Hoe geeft Magister het gekozen schooljaar door? De namen van de kopregels die de pagina meestuurt en de
     * adressen die de pagina zelf aanriep, zonder waarden (cijfers en zoektekst weggehaald). */
    const kop = await DT.api("/api/account", { timeout: 10000 });
    uit.push("", `kopregels die Magister meestuurt: ${(kop.kopnamen || []).join(", ") || "onbekend"}`);
    const eigen = await DT.apiFind("leerlingen|lesperiode|schooljaar|aanmelding|studie", 3000, { all: true });
    const kaal = (u) => { try { const x = new URL(u, location.origin); return x.pathname.replace(/\d+/g, "#") + (x.search ? "?" + [...x.searchParams].map(([k, v]) => (/datum|periode|jaar|begin|einde|rol/i.test(k) ? `${k}=${v}` : k)).join("&") : ""); } catch { return ""; } };
    uit.push(`adressen van de pagina zelf: ${[...new Set(eigen.map(kaal).filter(Boolean))].join("  |  ") || "geen"}`);
    if (eerste != null) {
      const a = await DT.api(`/api/leerlingen/${encodeURIComponent(eerste)}/aanmeldingen`, { full: true, timeout: 20000 }), am = DT.lijst(a) || [];
      uit.push("", `aanmeldingen (één student): status ${a.status}, ${am.length} aanmeldingen, beginjaren: ${am.map((x) => String(x.begin ?? x.start ?? "").slice(0, 4)).join(", ")}`, `  velden aanmelding: ${vorm(Array.isArray(a.shape) ? a.shape[0] : a.shape?.items?.[0])}`);
    }
    this.status("");
    await DT.copy(uit.join("\n"));
  },

  /* Aandachtspunten: wat opvalt in aantallen en aanwezigheid. Elke regel springt naar de klas in de boom. */
  aandacht(sinds) {
    const d = this._d, R = OplReken, E = (s) => this.esc(s), klassen = d.knopen.filter((k) => k.soort === "klas"), naamOpl = (k) => d.boom.find((o) => o.studie === k.studie)?.naam || k.studie;
    const lijst = (titel, rijen, uitleg) => rijen.length ? `<section><h3>${titel}</h3><ul>${rijen.map(([k, waarde, sub]) => `<li><button type="button" class="dt-opl-ga" data-act="ga" data-i="${d.knopen.indexOf(k)}" title="Details van ${E(k.naam)}">${E(k.naam)}${sub ? ` <small>${E(sub)}</small>` : ""}</button><b>${waarde}</b></li>`).join("")}</ul>${uitleg ? `<p class="dt-opl-zacht">${uitleg}</p>` : ""}</section>` : "";
    const metDelta = R.verloopStand(d.tellingen) !== "leeg" ? klassen.map((k) => ({ k, n: R.verschil(this.reeksVan(k), sinds) })).filter((x) => x.n) : [];
    const teken = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
    const metAanw = klassen.map((k) => ({ k, agg: d.aanw[k.naam], c: d.aanw[k.naam] ? R.cijfers(d.aanw[k.naam].per) : null })).filter((x) => x.c && x.c.telt);
    const mut = klassen.map((k) => ({ k, in: (d.mut[k.naam] || []).filter((m) => m.soort === "in").length, uit: (d.mut[k.naam] || []).filter((m) => m.soort === "uit").length }));
    const cat = (key, titel) => lijst(titel, metAanw.filter((x) => x.c.cat[key].n).sort((a, b) => b.c.cat[key].pct - a.c.cat[key].pct).slice(0, 5).map((x) => [x.k, this.pct(x.c.cat[key].pct), `${this.getal(x.c.cat[key].n)} lessen`]), "");
    const delen = [
      lijst("Uit de klas (uit de lessen)", mut.filter((x) => x.uit).sort((a, b) => b.uit - a.uit).slice(0, 5).map((x) => [x.k, this.getal(x.uit), naamOpl(x.k)]), "Studenten die dit schooljaar lessen hadden en nu niet meer in de klas staan."),
      lijst("Later ingestroomd (uit de lessen)", mut.filter((x) => x.in).sort((a, b) => b.in - a.in).slice(0, 5).map((x) => [x.k, this.getal(x.in), naamOpl(x.k)]), ""),
      lijst("Meeste uitstroom (peildatums)", metDelta.filter((x) => x.n < 0).sort((a, b) => a.n - b.n).slice(0, 5).map((x) => [x.k, teken(x.n), naamOpl(x.k)]), `Verschil in aantal studenten sinds ${E(this.kort(sinds))}.`),
      lijst("Meeste instroom (peildatums)", metDelta.filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5).map((x) => [x.k, teken(x.n), naamOpl(x.k)]), ""),
      lijst("Kleinste klassen", klassen.filter((k) => k.aantal > 0).sort((a, b) => a.aantal - b.aantal).slice(0, 5).map((k) => [k, this.getal(k.aantal), naamOpl(k)]), ""),
      lijst("Grootste klassen", klassen.slice().sort((a, b) => b.aantal - a.aantal).slice(0, 5).map((k) => [k, this.getal(k.aantal), naamOpl(k)]), ""),
      lijst("Laagste aanwezigheid", metAanw.slice().sort((a, b) => a.c.pct - b.c.pct).slice(0, 5).map((x) => [x.k, this.pct(x.c.pct), `${x.agg.onder} onder de norm`]), ""),
      cat("AB_NO", "Meeste ongeoorloofd absent"), cat("ZK", "Meeste ziek"), cat("TL", "Meeste te laat"),
    ].filter(Boolean);
    return delen.length ? `<dna-card class="dt-opl-kaart"><h2>Aandachtspunten</h2><p class="dt-opl-zacht">Klik op een klas voor de details.</p><div class="dt-opl-aandacht">${delen.join("")}</div></dna-card>` : "";
  },
  /* Mutaties uit de lessen: wie later begon, wie uit de klas is en wie geen lessen meer heeft. */
  mutatieTabel(rijen, metKlas = true) {
    const d = this._d, E = (s) => this.esc(s), R = OplReken, wk = (w) => (w ? `wk ${typeof isoWeek === "function" ? isoWeek(R.datum(w)).w : ""} · ${this.kort(w, false)}` : "—");
    const SOORT = { in: ["Ingestroomd", "eerste les in", "is-in"], uit: ["Uit de klas", "laatste les in", "is-uit"] };
    return `<div class="dt-opl-scroll"><table class="dt-opl-tabel dt-opl-mut"><thead><tr><th>Mutatie</th><th>Student</th>${metKlas ? "<th>Klas</th>" : ""}<th>Week</th></tr></thead><tbody>${rijen.map((m) => { const k = d.knopen.find((x) => x.soort === "klas" && x.naam === m.klas);
      return `<tr><td><span class="dt-opl-label ${SOORT[m.soort][2]}">${SOORT[m.soort][0]}</span></td><td>${E(m.naam && m.naam !== "Onbekende student" ? m.naam : "Naam onbekend")}${m.naar ? ` <small class="dt-opl-zacht">naar ${E(m.naar)}</small>` : ""}</td>${metKlas ? `<td>${k ? `<button type="button" class="dt-opl-ga" data-act="ga" data-i="${d.knopen.indexOf(k)}">${E(m.klas)}</button>` : E(m.klas)}</td>` : ""}<td>${m.bron === "aanmelding" ? `aangemeld per ${E(this.kort(m.datum))}` : m.week ? `${SOORT[m.soort][1]} ${E(wk(m.week))}${m.datum ? `, aangemeld per ${E(this.kort(m.datum))}` : ""}` : "geen lessen dit schooljaar"}</td></tr>`; }).join("")}</tbody></table></div>`;
  },
  mutatieKaart() {
    const d = this._d, E = (x) => this.esc(x), alle = Object.keys(d.mut || {}).flatMap((k) => d.mut[k].map((m) => ({ ...m, klas: k }))).sort((a, b) => String(b.week || "").localeCompare(String(a.week || "")) || a.klas.localeCompare(b.klas, "nl", { numeric: true }));
    if (!Object.keys(d.jaar).length) return `<dna-card class="dt-opl-kaart"><h2>Mutaties uit de lessen</h2><p class="dt-opl-zacht">${this._aanwBezig ? "De lessen van dit schooljaar worden opgehaald…" : `Nog niet opgehaald. <button type="button" class="dt-opl-knop" data-act="les-alles">Lessen van dit schooljaar ophalen</button>`}</p></dna-card>`;
    const oudeVersie = Object.values(d.jaar).filter((o) => o.v !== this.VERSIE).length;
    const n = (s) => alle.filter((m) => m.soort === s).length, keuze = this._mutSoort ? alle.filter((m) => m.soort === this._mutSoort) : alle, toon = this._mutAlles ? keuze : keuze.slice(0, 50);
    const chip = (w, naam) => `<button type="button" class="dt-opl-seg" data-act="mut-soort" data-w="${w}" aria-pressed="${String((this._mutSoort || "") === w)}">${naam} · ${w ? n(w) : alle.length}</button>`;
    return `<dna-card class="dt-opl-kaart"><div class="dt-opl-kaartkop"><div><h2>Mutaties uit de lessen</h2><p class="dt-opl-zacht">${alle.length ? `${alle.filter((m) => m.soort === "uit" && m.naar).length} van de vertrekkers gingen naar een andere klas.` : "Geen mutaties gevonden in de lessen van dit schooljaar."} Uit de klas: wie volgens Magister in de lessen van de klas zat en er nu niet meer in staat (per week worden een paar lessen bekeken). Ingestroomd: een eerste les na de start van de klas, of een aanmelding die later begint. Een stage of een rooster dat later begint kan er ook als mutatie uitzien.${this._namenFout ? ` Namen van vertrekkers: ${E(this._namenFout)}.` : ""}${oudeVersie ? ` <b>${oudeVersie} ${oudeVersie === 1 ? "klas is" : "klassen zijn"} nog niet opnieuw opgehaald; daar ontbreken de vertrekkers nog.</b>` : ""}</p></div>
      <button type="button" class="dt-opl-knop is-stil" data-act="diag-mut" title="Zet op het klembord wat Magister over in- en uitstroom teruggeeft: alleen aantallen, datums, veldnamen en statuscodes, geen namen">Diagnose mutaties</button></div>
      ${alle.length ? `<div class="dt-opl-filter" role="group" aria-label="Soort mutatie"><span class="dt-opl-segs">${chip("", "Alle")}${chip("in", "Ingestroomd")}${chip("uit", "Uit de klas")}</span></div>${this.mutatieTabel(toon)}` : ""}
      ${keuze.length > 50 ? `<p><button type="button" class="dt-opl-knop is-stil" data-act="mut-alles">${this._mutAlles ? "Alleen de nieuwste 50" : `Alle ${keuze.length} tonen`}</button></p>` : ""}</dna-card>`;
  },

  /* ---------- Excel ---------- */
  excel(DT) {
    const d = this._d, R = OplReken;
    if (!d) return DT.toast("Er is nog niets om te exporteren.", "err");
    if (typeof XLSX === "undefined") return DT.toast("Excel-bibliotheek niet geladen", "err");
    const per = this.periode(), sinds = this.sinds(), p = (v) => (v == null ? "" : { t: "n", v: v / 100, z: "0.0%" });
    const blad = (rijen, breedtes) => { const ws = XLSX.utils.aoa_to_sheet(rijen); ws["!cols"] = breedtes.map((w) => ({ wch: w })); return ws; };
    const kopAanw = ["Lessen", ...R.CATS.map((c) => c[1]), "Aanwezig %", ...R.CATS.slice(1).map((c) => `${c[1]} %`), "Studenten onder 80%"];
    const aanw = (agg) => { if (!agg) return []; const c = R.cijfers(agg.per); return [c.lessen, ...R.CATS.map(([k]) => c.cat[k].n), p(c.pct), ...R.CATS.slice(1).map(([k]) => p(c.cat[k].pct)), agg.onder]; };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, blad([["Opleidingen"], ["Gemaakt", new Date().toLocaleString("nl-NL")], ["Peildatum", this.kort(d.vandaag)], ["Aanwezigheid over", `${per.naam} (${this.kort(R.ymd(per.van))} t/m ${this.kort(R.ymd(per.tot))})`], [],
      ["Aanwezig % = aanwezig en te laat, gedeeld door de lessen die meetellen; vrijstelling telt niet mee en is een deel van alle lessen."], ["Het verloop toont het aantal studenten op de eerste van elke maand; 1 oktober is de landelijke teldatum."], ["Het blad Mutaties bevat namen van studenten; de andere bladen alleen aantallen."]], [20, 90]), "Toelichting");
    XLSX.utils.book_append_sheet(wb, blad([["Niveau", "Opleiding", "Crebo", "Cohort", "Leerjaar", "Klas", "Mentor", "Studenten", `Verschil sinds ${this.kort(sinds)}`, ...kopAanw],
      ...d.knopen.map((k) => [k.soort, d.boom.find((o) => o.studie === k.studie)?.naam || k.studie, k.crebo || "", k.cohort ?? "", k.leerjaar ?? "", k.soort === "klas" ? k.naam : "", k.mentor || "", k.aantal, R.verschil(this.reeksVan(k), sinds) ?? "", ...aanw(this.aanwVan(k.klassen))])],
      [11, 34, 9, 8, 9, 12, 24, 10, 16, ...kopAanw.map(() => 13)]), "Overzicht");
    const tot = this.totaalReeks(), klasNamen = [...new Set(d.tellingen.flatMap((t) => Object.keys(t.klassen)))].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
    XLSX.utils.book_append_sheet(wb, blad([["Peildatum", "Teldatum", "Totaal", ...d.boom.map((o) => o.naam)], ...d.tellingen.map((t, i) => [t.datum, t.teldatum ? "ja" : "", tot[i].n, ...d.boom.map((o) => this.reeksVan(o)[i].n)])], [12, 9, 9, ...d.boom.map(() => 22)]), "Verloop per opleiding");
    XLSX.utils.book_append_sheet(wb, blad([["Peildatum", ...klasNamen], ...d.tellingen.map((t) => [t.datum, ...klasNamen.map((k) => t.klassen[k] ?? "")])], [12, ...klasNamen.map(() => 9)]), "Verloop per klas");
    if (d.cohorten?.cohorten.length) XLSX.utils.book_append_sheet(wb, blad([["Opleiding", ...d.cohorten.cohorten.map((j) => `Cohort ${j}`), "Totaal"], ...d.cohorten.rijen.map((r) => [d.boom.find((o) => o.studie === r.studie)?.naam || r.studie, ...d.cohorten.cohorten.map((j) => r.per[j] || 0), r.totaal])], [26, ...d.cohorten.cohorten.map(() => 12), 9]), "Per cohort");
    const metLes = Object.keys(d.nu).filter((k) => d.les[k]).sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
    if (metLes.length) {
      const weken = [...new Set(metLes.flatMap((k) => Object.keys(d.les[k].weken)))].sort();
      XLSX.utils.book_append_sheet(wb, blad([["Week vanaf", "Totaal (zonder weken met weinig lessen)", ...metLes.flatMap((k) => [`${k} studenten`, `${k} lessen`, `${k} grootste les`])],
        ...weken.map((w) => [w, R.lesReeks(metLes.map((k) => R.lesPunten(d.les[k].weken)), [w])[0].n, ...metLes.flatMap((k) => { const x = d.les[k].weken[w]; return x ? [x.actief, x.lessen, x.grootste] : ["", "", ""]; })])], [12, 16, ...metLes.flatMap(() => [12, 10, 12])]), "Studenten per week");
    }
    const mut = Object.keys(d.mut || {}).flatMap((k) => d.mut[k].map((m) => [{ in: "Ingestroomd", uit: "Uit de klas" }[m.soort], m.naam, k, d.boom.find((o) => o.klassen.includes(k))?.naam || "", m.week || "", m.bron === "aanmelding" ? "begin aanmelding" : m.soort === "in" ? "eerste les" : "laatste les", m.naar || "", m.datum || ""]));
    if (mut.length) XLSX.utils.book_append_sheet(wb, blad([["Mutatie", "Student", "Klas", "Opleiding", "Week vanaf", "Betekenis van de week", "Naar klas", "Begin aanmelding"], ...mut.sort((a, b) => String(b[4]).localeCompare(String(a[4])))], [18, 28, 10, 20, 12, 16, 10, 16]), "Mutaties");
    const alle = this.aanwVan(Object.keys(d.nu));
    if (alle) XLSX.utils.book_append_sheet(wb, blad([["Week vanaf", "Lessen", ...R.CATS.map((c) => c[1]), "Aanwezig %"], ...Object.keys(alle.weken).sort().map((w) => { const c = R.cijfers(alle.weken[w]); return [w, c.lessen, ...R.CATS.map(([k]) => c.cat[k].n), p(c.pct)]; })], [12, 9, ...R.CATS.map(() => 13), 11]), "Aanwezigheid per week");
    XLSX.writeFile(wb, `Opleidingen ${d.vandaag}.xlsx`);
    DT.toast("Excel-bestand gedownload", "ok");
  },

  /* ---------- opmaak ---------- */
  css() {
    if (document.getElementById("dt-opl-style")) return;
    const st = document.createElement("style"); st.id = "dt-opl-style";
    /* Op Magisters eigen ontwerptokens (--sl-…), net als Lesregistraties: zo kleurt de pagina mee met elk thema. De
     * kleuren van de reeksen (--opl-s1…8) zijn een vast palet met een eigen stap voor donker. */
    st.textContent = `
      .dt-opl-achter { visibility: hidden !important; }
      #dt-oplp {
        --opl-fg: var(--sl-color-tab-default-foreground, #233243); --opl-zacht: color-mix(in srgb, var(--opl-fg) 64%, transparent);
        --opl-lijn: var(--sl-color-card-border, #bcbcbc); --opl-lijnzacht: color-mix(in srgb, var(--opl-lijn) 45%, transparent);
        --opl-kaart: var(--sl-color-card-background, #fefefe); --opl-acc: var(--sl-color-button-primary-solid-idle-background, var(--dt-accent, #056dc2));
        --opl-hover: var(--sl-color-tab-hover-background, #ddeffe); --opl-actief: var(--sl-color-tab-active-background, #b7defd);
        --opl-rood: var(--sl-color-border-accent-red-bold, #d7263d); --opl-r: var(--sl-size-borderRadius-default, 4px);
        --opl-s0: #8a8f98; --opl-s1: #2a78d6; --opl-s2: #eb6834; --opl-s3: #1baf7a; --opl-s4: #eda100; --opl-s5: #e87ba4; --opl-s6: #008300; --opl-s7: #6250d6; --opl-s8: #e34948;
        position: fixed; right: 0; bottom: 0; left: 0; top: 0; z-index: 3; overflow: auto; outline: 0; min-width: 0;
        --dna-page-layout-max-width: min(100%, calc(100% - 2 * 2rem));
        background: var(--sl-elevation-surface-base-default, #f2f6fa);
        color: var(--opl-fg); font-family: var(--sl-text-typeset-font-family-body, open-sans), sans-serif; font-size: 14px; line-height: 20px; }
      html.dt-dark #dt-oplp { --opl-s0: #9a9fa8; --opl-s1: #3987e5; --opl-s2: #d95926; --opl-s3: #199e70; --opl-s4: #c98500; --opl-s5: #d55181; --opl-s6: #0ca30c; --opl-s7: #9085e9; --opl-s8: #e66767; }
      #dt-oplp * { box-sizing: border-box; } #dt-oplp button, #dt-oplp select { font-family: inherit; }
      #dt-oplp dna-page-header { --_padding-block: .5rem 1rem; --padding-block: .5rem 1rem; display: block; }
      #dt-oplp dna-page-header > h1 { margin: 0; padding: 20px 2rem 12px; font-size: 24px; line-height: 32px; font-weight: 700; }
      .dt-opl-acties { display: inline-flex; gap: 8px; }
      #dt-oplp.is-kaal dna-button { display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); background: var(--opl-kaart); cursor: pointer; font-weight: 600; }
      #dt-oplp.is-kaal dna-card.dt-opl-kaart { background: var(--opl-kaart); border: 1px solid var(--opl-lijnzacht); border-radius: 8px; padding: 16px; }
      #dt-oplp.is-kaal dna-breadcrumb { display: none; }
      .dt-opl-inhoud { width: min(1280px, calc(100% - 4rem)); margin: 0 auto; padding: 16px 0 40px; min-width: 0; }
      .dt-opl-lijf { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .dt-opl-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--opl-zacht); margin-bottom: 12px; min-height: 0; }
      .dt-opl-status:empty { display: none; } .dt-opl-status.is-fout { color: var(--opl-rood); font-weight: 600; }
      .dt-opl-voortgang { flex: 1 1 100%; height: 4px; border-radius: 2px; background: var(--opl-lijnzacht); overflow: hidden; } .dt-opl-voortgang b { display: block; height: 100%; background: var(--opl-acc); transition: width .2s; }
      dna-card.dt-opl-kaart { display: block; min-width: 0; }
      .dt-opl-kaart h2 { margin: 0; font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 16px; line-height: 24px; font-weight: 700; color: var(--opl-fg); }
      .dt-opl-kaart h3 { margin: 0 0 8px; font-size: 13px; line-height: 18px; font-weight: 700; color: var(--opl-fg); }
      .dt-opl-zacht { color: var(--opl-zacht); font-size: 13px; margin: 2px 0 0; } .dt-opl-voet { max-width: 90ch; }
      .dt-opl-kaartkop { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; margin-bottom: 12px; }
      .dt-opl-rij { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
      .dt-opl-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
      .dt-opl-kpi small { display: block; font-size: 13px; font-weight: 600; color: var(--opl-zacht); }
      .dt-opl-kpi > b { display: block; font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 28px; line-height: 36px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .dt-opl-kpi > span { display: block; font-size: 13px; color: var(--opl-zacht); }
      .dt-opl-delta { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; color: var(--opl-zacht); } .dt-opl-delta.is-op { color: #1e8a4c; } .dt-opl-delta.is-neer { color: var(--opl-rood); }
      html.dt-dark .dt-opl-delta.is-op { color: #4cc38a; }
      .dt-opl-veld { height: 32px; padding: 0 8px; margin-left: 4px; border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); background: var(--opl-kaart); color: var(--opl-fg); font-size: 13px; }
      .dt-opl-knop { appearance: none; height: 28px; padding: 0 10px; border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); background: var(--opl-kaart); color: var(--opl-fg); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
      .dt-opl-knop:hover:not(:disabled) { background: var(--opl-hover); } .dt-opl-knop:disabled { opacity: .5; cursor: default; } .dt-opl-knop.is-stil { border-color: transparent; background: transparent; color: var(--opl-acc); }
      .dt-opl-knop:focus-visible, .dt-opl-klap:focus-visible, .dt-opl-seg:focus-visible, .dt-opl-veld:focus-visible { outline: 2px solid var(--opl-acc); outline-offset: 1px; }
      .dt-opl-segs { display: inline-flex; border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); overflow: hidden; }
      .dt-opl-seg { appearance: none; border: 0; height: 30px; padding: 0 12px; background: var(--opl-kaart); color: var(--opl-fg); font-size: 13px; cursor: pointer; } .dt-opl-seg + .dt-opl-seg { border-left: 1px solid var(--opl-lijn); }
      .dt-opl-seg[aria-pressed="true"] { background: var(--opl-actief); font-weight: 700; }
      .dt-opl-svg { width: 100%; height: auto; display: block; overflow: visible; }
      .dt-opl-svg .raster { stroke: var(--opl-lijnzacht); stroke-width: 1; } .dt-opl-svg .teldatum { stroke: var(--opl-lijn); stroke-width: 1; stroke-dasharray: 2 4; }
      .dt-opl-svg .norm { stroke: var(--opl-fg); stroke-width: 1; stroke-dasharray: 4 3; opacity: .7; }
      .dt-opl-svg .as { font-size: 11px; fill: var(--opl-zacht); } .dt-opl-svg .eind { font-size: 12px; fill: var(--opl-fg); }
      .dt-opl-svg .punt { stroke: var(--opl-kaart); stroke-width: 2; } .dt-opl-svg .kolom .punt, .dt-opl-svg .kruis { opacity: 0; } .dt-opl-svg .kruis { stroke: var(--opl-zacht); stroke-width: 1; }
      .dt-opl-svg .kolom:hover .punt, .dt-opl-svg .kolom:hover .kruis { opacity: 1; } .dt-opl-svg .kolom:hover rect[rx] { opacity: .82; }
      .dt-opl-legenda { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; font-size: 13px; color: var(--opl-zacht); }
      .dt-opl-legenda i, .dt-opl-cats i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
      .dt-opl-scroll { overflow-x: auto; border: 1px solid var(--opl-lijnzacht); border-radius: var(--opl-r); }
      .dt-opl-tabel { width: 100%; border-collapse: collapse; min-width: 860px; }
      .dt-opl-tabel th { text-align: left; font-size: 12px; font-weight: 700; color: var(--opl-zacht); padding: 8px; border-bottom: 1px solid var(--opl-lijn); white-space: nowrap; }
      .dt-opl-tabel td { padding: 6px 8px; border-bottom: 1px solid var(--opl-lijnzacht); vertical-align: middle; }
      .dt-opl-tabel tbody tr:last-child td { border-bottom: 0; }
      .dt-opl-tabel tr:not(.detail):hover td { background: color-mix(in srgb, var(--opl-hover) 45%, transparent); }
      .dt-opl-tabel .getal, .dt-opl-cats .getal { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dt-opl-tabel tr.is-opleiding > td { font-size: 15px; } .dt-opl-tabel tr.is-klas > td.naam b { font-weight: 600; }
      .dt-opl-tabel tr.is-open:not(.is-klas) > td { background: color-mix(in srgb, var(--opl-actief) 30%, transparent); }
      .dt-opl-klap { appearance: none; border: 0; background: none; padding: 2px 0; color: inherit; font: inherit; cursor: pointer; display: flex; align-items: center; gap: 8px; text-align: left; width: 100%; }
      .dt-opl-klap .pijl { display: inline-block; width: 14px; color: var(--opl-zacht); transition: transform .12s; } .dt-opl-klap[aria-expanded="true"] .pijl { transform: rotate(90deg); }
      .dt-opl-klap small { display: block; font-size: 12px; font-weight: 400; color: var(--opl-zacht); }
      .dt-opl-tabel td.aandeel { width: 14%; min-width: 90px; }
      .dt-opl-pbalk { display: block; height: 8px; border-radius: 4px; background: var(--opl-lijnzacht); overflow: hidden; } .dt-opl-pbalk i { display: block; height: 100%; border-radius: 4px; background: var(--opl-s1); }
      .dt-opl-tabel td.aanw { white-space: nowrap; min-width: 250px; } .dt-opl-tabel td.aanw b { margin-left: 8px; font-variant-numeric: tabular-nums; } .dt-opl-tabel td.aanw small { margin-left: 6px; color: var(--opl-zacht); font-size: 12px; }
      .dt-opl-verd { display: inline-flex; gap: 2px; width: 150px; height: 10px; vertical-align: middle; } .dt-opl-verd i { display: block; height: 100%; min-width: 2px; border-radius: 2px; }
      #dt-oplp .is-laag { color: var(--opl-rood); font-weight: 700; }
      .dt-opl-tabel tr.detail > td { background: color-mix(in srgb, var(--opl-lijnzacht) 30%, transparent); padding-top: 12px; padding-bottom: 16px; }
      .dt-opl-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 32px; max-width: 1000px; }
      .dt-opl-detail .breed { grid-column: 1 / -1; min-width: 0; } .dt-opl-detail section { min-width: 0; } .dt-opl-detail h3:not(:first-child) { margin-top: 16px; }
      .dt-opl-cats { width: 100%; border-collapse: collapse; } .dt-opl-cats td { padding: 3px 8px 3px 0; border: 0; font-size: 13px; background: none !important; }
      .dt-opl-cats tr.som td { border-top: 1px solid var(--opl-lijn); padding-top: 6px; font-weight: 600; }
      .dt-opl-hbalk { display: grid; grid-template-columns: 92px 1fr 52px; align-items: center; gap: 8px; font-size: 13px; padding: 2px 0; }
      .dt-opl-hbalk i { display: block; height: 10px; border-radius: 4px; background: var(--opl-lijnzacht); overflow: hidden; } .dt-opl-hbalk i b { display: block; height: 100%; border-radius: 4px; }
      .dt-opl-hbalk em { font-style: normal; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
      .dt-opl-aandacht { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px 32px; margin-top: 12px; }
      .dt-opl-aandacht ul { list-style: none; margin: 0; padding: 0; } .dt-opl-aandacht li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--opl-lijnzacht); }
      .dt-opl-aandacht li small { color: var(--opl-zacht); font-size: 12px; } .dt-opl-aandacht li b { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dt-opl-melding { margin: 4px 0 0; padding: 10px 12px; border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); background: color-mix(in srgb, var(--opl-hover) 50%, transparent); font-size: 13px; }
      .dt-opl-melding .dt-opl-knop { margin-left: 8px; }
      .dt-opl-cohort { margin-top: 12px; } .dt-opl-cohort .dt-opl-tabel { min-width: 0; } .dt-opl-cohort th small { display: block; font-weight: 400; }
      .dt-opl-cel { display: grid; grid-template-columns: minmax(40px, 1fr) 34px; align-items: center; gap: 8px; } .dt-opl-cel i { display: block; height: 10px; border-radius: 4px; background: var(--opl-lijnzacht); overflow: hidden; }
      .dt-opl-cel i b { display: block; height: 100%; border-radius: 4px; background: var(--opl-s1); } .dt-opl-cel em { font-style: normal; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
      .dt-opl-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
      .dt-opl-chip { appearance: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--opl-lijn); border-radius: 999px; background: var(--opl-kaart); color: var(--opl-fg); font-size: 13px; cursor: pointer; }
      .dt-opl-chip i { width: 10px; height: 10px; border-radius: 2px; } .dt-opl-chip:hover { background: var(--opl-hover); } .dt-opl-chip:focus-visible, .dt-opl-ga:focus-visible { outline: 2px solid var(--opl-acc); outline-offset: 1px; }
      .dt-opl-chip[aria-pressed="false"] { color: var(--opl-zacht); text-decoration: line-through; border-style: dashed; } .dt-opl-chip[aria-pressed="false"] i { opacity: .25; }
      .dt-opl-ga { appearance: none; border: 0; background: none; padding: 0; color: var(--opl-acc); font: inherit; font-weight: 600; cursor: pointer; text-align: left; } .dt-opl-ga:hover { text-decoration: underline; } .dt-opl-ga small { font-weight: 400; }
      .dt-opl-kies { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px 16px; margin: 12px 0; align-items: start; }
      .dt-opl-kiesgroep { border: 1px solid var(--opl-lijn); border-radius: var(--opl-r); } .dt-opl-kiesgroep[open] { grid-column: 1 / -1; }
      .dt-opl-kiesgroep summary { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: var(--opl-r); cursor: pointer; list-style: none; } .dt-opl-kiesgroep summary:hover { background: var(--opl-hover); }
      .dt-opl-kiesgroep summary::-webkit-details-marker { display: none; } .dt-opl-kiesgroep summary:focus-visible { outline: 2px solid var(--opl-acc); outline-offset: 1px; }
      .dt-opl-kiesgroep summary::before { content: ""; width: 6px; height: 6px; margin: 0 2px; border: solid var(--opl-zacht); border-width: 0 2px 2px 0; transform: rotate(-45deg); transition: transform .15s; } .dt-opl-kiesgroep[open] > summary::before { transform: rotate(45deg); }
      .dt-opl-kiesgroep summary small { margin-left: auto; } .dt-opl-kiesgroep > div { display: flex; flex-wrap: wrap; gap: 6px 20px; padding: 4px 10px 10px 34px; }
      .dt-opl-kies label { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
      .dt-opl-kies small { color: var(--opl-zacht); font-size: 12px; white-space: nowrap; } .dt-opl-kies input { accent-color: var(--opl-acc); }
      @media (prefers-reduced-motion: reduce) { .dt-opl-kiesgroep summary::before { transition: none; } }
      .dt-opl-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--opl-lijn); margin-bottom: 16px; }
      .dt-opl-tab { appearance: none; border: 0; border-bottom: 3px solid transparent; background: none; padding: 8px 14px; margin-bottom: -1px; color: var(--opl-zacht); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border-radius: var(--opl-r) var(--opl-r) 0 0; }
      .dt-opl-tab:hover { background: var(--opl-hover); color: var(--opl-fg); } .dt-opl-tab[aria-selected="true"] { color: var(--opl-fg); border-bottom-color: var(--opl-acc); }
      .dt-opl-tab:focus-visible { outline: 2px solid var(--opl-acc); outline-offset: -2px; } .dt-opl-tab small { font-weight: 400; margin-left: 4px; padding: 1px 6px; border-radius: 999px; background: var(--opl-actief); color: var(--opl-fg); }
      .dt-opl-zoomkop { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; } .dt-opl-zoomkop > div { flex: 1; min-width: 200px; } .dt-opl-zoomkop h2 { margin: 0; } .dt-opl-zoomkop p { margin: 2px 0 0; }
      .dt-opl-zoom .dt-opl-detail { max-width: none; }
      .dt-opl-mut { min-width: 0; } .dt-opl-label { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: 12px; line-height: 20px; font-weight: 600; border: 1px solid var(--opl-lijn); white-space: nowrap; }
      .dt-opl-label.is-in::before { content: "▲ "; color: #1e8a4c; } .dt-opl-label.is-uit::before { content: "▼ "; color: var(--opl-rood); } .dt-opl-label.is-stil::before { content: "● "; color: #d27d00; }
      .dt-opl-kaart p .dt-opl-knop { margin-left: 6px; }
      .dt-opl-tip { position: fixed; z-index: 5; max-width: 320px; padding: 8px 10px; border-radius: 6px; background: #1f2933; color: #fff; font-size: 12px; line-height: 17px; white-space: pre-line; pointer-events: none; opacity: 0; box-shadow: 0 4px 14px rgba(0,0,0,.25); font-variant-numeric: tabular-nums; }
      .dt-opl-tip.is-aan { opacity: 1; }
      @media (max-width: 900px) { .dt-opl-inhoud { width: calc(100% - 2rem); } .dt-opl-detail { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { #dt-oplp * { transition: none !important; } }
    `;
    document.head.append(st);
  },
});
