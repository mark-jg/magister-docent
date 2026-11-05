/* Te laat-balie voor de community builder (CB'er): Tardy in Magister.
 *
 * Aan te zetten bij Instellingen › Community builder. Een subpagina van Aanwezigheid, net als Meldingen of
 * Registraties: tegel "Te laat-balie", kruimelpad Aanwezigheid › Te laat-balie, en opgebouwd uit Magisters eigen
 * paginakop, tabbladen, kaarten en knoppen (ook via het zijpaneel te openen). Rekent met de kern van Tardy (cb-kern.js, gegenereerd uit Tardy):
 * dezelfde soorten, tellingen, het verzuimprotocol met zijn ladders, de meldafspraken en mailteksten.
 *
 * Gegevens: dezelfde gedeelde map als de Tardy-app (OneDrive of Teams), met dezelfde bestanden:
 *  - tardy-gegevens.json   de gedeelde stand, met revisieteller (revisie, gewijzigdDoor, gewijzigdOp)
 *  - tardy-in-gebruik.json wie er nu werkt (naam, apparaat, apparaatNaam, sinds, bijgewerkt)
 * Om de beurt, zoals in Tardy: werkt een ander (teken van leven < 10 minuten), dan kies je tussen alleen
 * bekijken en zelf verder. Heeft een ander intussen opgeslagen, dan overschrijft de balie niets: de eigen
 * versie gaat naar een conflictkopie in deze browser en de nieuwere stand wordt geladen.
 * Persoonlijke instellingen (naam, paraaf, e-mail, lokaal, printer) staan niet in de gedeelde map maar in de
 * extensie, net als Tardy ze op de eigen Mac bewaart.
 *
 * Magister: de balie zoekt studenten op in Magister en vult ze aan in de gedeelde gegevens. Er wordt niets
 * in Magister geschreven; de balie zegt wat je in Magister zet en opent de verzuimpagina van de student.
 * Briefjes: op een gewone printer, of op het Bluetooth-bonprintertje van Tardy (Web Bluetooth). */
DT.register({
  id: "cb",
  _stop: null,
  _scherm: null,

  init(DT) {
    /* In het logboek-frame van Magister (magister-lvs): alleen de notitie invullen. */
    if (!DT.isTop) {
      if (/^\/magister-lvs\//.test(location.pathname)) this._stop = DT.observe(() => this.vulNotitie(), { debounce: 250, poll: 1000 });
      return;
    }
    this._stop = DT.observe(() => { this.tegel(DT); this.vulAfspraak(); }, { debounce: 300, poll: 1500 });
    /* Weg van Aanwezigheid: de balie sluit, net als elke andere subpagina. */
    this._hash = () => { if (this._scherm && !/^#\/aanwezigheid\/?$/.test(location.hash)) this.sluit(); };
    window.addEventListener("hashchange", this._hash);
  },

  destroy() {
    this._stop && this._stop();
    window.removeEventListener("hashchange", this._hash);
    this.sluit();
    DT.deepQueryAll("#dt-cb-tegel").forEach((el) => el.remove());
  },

  /* ---------- tegel op Aanwezigheid ---------- */
  tegel(DT) {
    const wrap = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector(".wrapper");
    if (!wrap) return;
    /* Na herladen of via het zijpaneel: de balie staat nog open voor deze sessie. */
    let nogOpen = false; try { nogOpen = sessionStorage.getItem("dt-cb-open") === "1"; } catch {}
    if (nogOpen && !this._scherm && /^#\/aanwezigheid\/?$/.test(location.hash) && document.querySelector("mg-att-tiles")) this.open(DT);
    const oud = wrap.querySelector("#dt-cb-tegel");
    if (oud) {
      if (oud.shadowRoot?.querySelector("h1")?.textContent.trim() !== "Te laat-balie") window.postMessage({ type: "dt:attr:opnieuw", selector: "#dt-cb-tegel", attr: "heading" }, "*");
      return;
    }
    const c = document.createElement("dna-link-card");
    c.id = "dt-cb-tegel"; c.setAttribute("heading", "Te laat-balie");
    c.setAttribute("tabindex", "0"); c.setAttribute("role", "link"); c.style.cursor = "pointer";
    const oms = document.createElement("div"); oms.slot = "description";
    oms.textContent = "Melden, briefjes, meldafspraken en signalen volgens het verzuimprotocol (Tardy)";
    const ico = document.createElement("span"); ico.slot = "icon";
    ico.style.cssText = "display:inline-grid;place-items:center;inline-size:3.75rem;block-size:3.75rem;border-radius:16px;background:color-mix(in srgb,var(--dt-accent,#007aff) 13%,transparent);color:var(--dt-accent,#007aff)";
    ico.innerHTML = `<svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="17" r="10" opacity=".35"/><path d="M16 11v6l4 3M12 3h8M16 3v4"/></svg>`;
    c.append(oms, ico);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); this.open(DT); };
    c.addEventListener("click", open, true);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
    wrap.append(c);
  },

  /* ===================================================================================== */
  /* Gedeelde map (zelfde bestanden en afspraken als Tardy)                                 */
  /* ===================================================================================== */
  BESTAND: "tardy-gegevens.json",
  BEZET: "tardy-in-gebruik.json",
  BEZET_VERLOOPT: 10 * 60 * 1000,
  PERSOONLIJK: ["cbNaam", "cbParaaf", "cbEmail", "lokaal", "bonPrinter", "bonZwarting", "bonAuto", "takenOpen", "detailOpen", "railOpen"],

  db() {
    return this._db ||= new Promise((ok, nee) => {
      const r = indexedDB.open("dt-cb", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("kopie", { autoIncrement: true }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  async kv(sleutel, waarde) {
    const db = await this.db();
    return new Promise((ok, nee) => {
      const tx = db.transaction("kv", waarde === undefined ? "readonly" : "readwrite"), st = tx.objectStore("kv");
      const r = waarde === undefined ? st.get(sleutel) : waarde === null ? st.delete(sleutel) : st.put(waarde, sleutel);
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  /* Kopie in deze browser: bij een conflict en hooguit één keer per uur als back-up (laatste 40). */
  async kopie(soort, json) {
    try {
      const db = await this.db();
      await new Promise((ok) => { const tx = db.transaction("kopie", "readwrite"); tx.objectStore("kopie").add({ soort, op: new Date().toISOString(), json }); tx.oncomplete = ok; tx.onerror = ok; });
      await new Promise((ok) => {
        const tx = db.transaction("kopie", "readwrite"), st = tx.objectStore("kopie"), r = st.getAllKeys();
        r.onsuccess = () => { r.result.slice(0, Math.max(0, r.result.length - 40)).forEach((k) => st.delete(k)); };
        tx.oncomplete = ok; tx.onerror = ok;
      });
    } catch {}
  },
  apparaat() {
    let id = null; try { id = localStorage.getItem("dt-cb-apparaat"); } catch {}
    if (!id) { id = "chrome-" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem("dt-cb-apparaat", id); } catch {} }
    return id;
  },
  async lees(naam) {
    try { const f = await (await this._map.getFileHandle(naam)).getFile(); return await f.text(); } catch { return null; }
  },
  async schrijf(naam, tekst) {
    const w = await (await this._map.getFileHandle(naam, { create: true })).createWritable();
    await w.write(tekst); await w.close();
  },
  mijnNaam() { return DT.settings.cb?.naam || "Community builder (Chrome)"; },
  persoonlijk() {
    const c = DT.settings.cb || {};
    return { cbNaam: c.naam || "", cbParaaf: c.paraaf || "", cbEmail: c.email || "", lokaal: c.lokaal || "", bonZwarting: c.zwarting || 3, bonAuto: !!c.autoPrint, bonPrinter: c.printer || null };
  },
  splits(S) {
    const inst = Object.assign({}, S.instellingen || {});
    this.PERSOONLIJK.forEach((k) => delete inst[k]);
    const g = Object.assign({}, S, { instellingen: inst });
    delete g.revisie; delete g.gewijzigdDoor; delete g.gewijzigdOp;
    return g;
  },
  laadStand(g) {
    const K = TardyKern;
    const lokaal = g.instellingen?.lokaal;
    K.S = g; K.normaliseer();
    const p = this.persoonlijk();
    Object.assign(K.S.instellingen, p);
    if (!p.lokaal && lokaal) K.S.instellingen.lokaal = lokaal;   // oude bestanden met lokaal in de gedeelde stand
    this._basis = g.revisie || 0; this._door = g.gewijzigdDoor || ""; this._op = g.gewijzigdOp || "";
    if (!K.UI.periodeId || !K.periodeById(K.UI.periodeId)) K.UI.periodeId = K.huidigePeriode().id;
  },
  async bezetting() { try { return JSON.parse(await this.lees(this.BEZET) || "null"); } catch { return null; } },
  bezetDoorAnder(b) { return !!(b && b.apparaat && b.apparaat !== this.apparaat() && (Date.now() - Date.parse(b.bijgewerkt || 0)) < this.BEZET_VERLOOPT); },
  async bezettingZet() {
    const oud = await this.bezetting(), nu = new Date().toISOString();
    const sinds = oud && oud.apparaat === this.apparaat() && oud.sinds ? oud.sinds : nu;
    await this.schrijf(this.BEZET, JSON.stringify({ naam: this.mijnNaam(), apparaat: this.apparaat(), apparaatNaam: "Chrome · Magister", sinds, bijgewerkt: nu })).catch(() => {});
  },
  async bezettingVrij() {
    const b = await this.bezetting();
    if (b && b.apparaat === this.apparaat()) { try { await this._map.removeEntry(this.BEZET); } catch {} }
  },

  bewaar() {
    clearTimeout(this._schrijfTimer);
    this._schrijfTimer = setTimeout(() => this.schrijfNu(), 250);
  },
  async schrijfNu() {
    clearTimeout(this._schrijfTimer);
    if (!this._map || !TardyKern.S) return;
    if (this._kijkt) { this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus deze wijziging wordt niet bewaard.`, "err"); return this.herlaad(); }
    if (this._bezig) return this.bewaar();
    this._bezig = true;
    try {
      const opSchijf = JSON.parse(await this.lees(this.BESTAND) || "null");
      if (opSchijf && (opSchijf.revisie || 0) > this._basis) {
        await this.kopie("conflict", JSON.stringify(this.splits(TardyKern.S)));
        this.laadStand(opSchijf); this.teken();
        this.melding(`${opSchijf.gewijzigdDoor || "Je collega"} heeft intussen opgeslagen. Die stand zie je nu; jouw laatste wijziging staat als conflictkopie in deze browser.`, "err", 9000);
        return;
      }
      const g = this.splits(TardyKern.S);
      g.revisie = this._basis + 1; g.gewijzigdDoor = this.mijnNaam(); g.gewijzigdOp = new Date().toISOString();
      const json = JSON.stringify(g);
      await this.schrijf(this.BESTAND, json);
      this._basis = g.revisie; this._door = g.gewijzigdDoor; this._op = g.gewijzigdOp;
      if (!this._laatsteKopie || Date.now() - this._laatsteKopie > 3600e3) { this._laatsteKopie = Date.now(); this.kopie("uurlijks", json); }
      this.tekenStand();
    } catch (e) {
      this.melding(`Opslaan in de gedeelde map lukte niet: ${e.message || e}`, "err", 9000);
    } finally { this._bezig = false; }
  },
  async herlaad() {
    const g = JSON.parse(await this.lees(this.BESTAND) || "null");
    if (g) { this.laadStand(g); this.teken(); }
  },
  /* Elke 30 seconden: bijwerken als een ander opsloeg, bezetting bijhouden. */
  async controle() {
    if (!this._map || !this._scherm) return;
    const b = await this.bezetting();
    const tekst = await this.lees(this.BESTAND);
    const rev = (() => { try { return JSON.parse(tekst || "null")?.revisie || 0; } catch { return 0; } })();
    if (this._kijkt) {
      if (rev > this._basis) await this.herlaad();
      if (!this.bezetDoorAnder(b)) { this._ander = null; this.tekenStand(); }
    } else if (this.bezetDoorAnder(b)) {
      this._kijkt = true; this._ander = b; await this.herlaad();
      this.melding(`${b.naam || "Je collega"} heeft Tardy overgenomen. Je kijkt nu mee.`, "info", 8000);
    } else {
      if ((this._tik = (this._tik || 0) + 1) % 2 === 0) this.bezettingZet();
      if (rev > this._basis && !this._bezig) { await this.herlaad(); this.melding(`Bijgewerkt met wijzigingen van ${JSON.parse(tekst).gewijzigdDoor || "je collega"}.`); }
    }
    this.tekenStand();
  },

  /* ===================================================================================== */
  /* De pagina: een subpagina van Aanwezigheid, opgebouwd uit Magisters eigen onderdelen     */
  /* ===================================================================================== */
  /* Paginakop (dna-page-header) met kruimelpad, tabbladen (dna-tabs), kaarten (dna-card) en knoppen
   * (dna-button), net als Meldingen of Registraties. Magisters onderdelen negeren attributen die de extensie
   * zet; componenten() laat het netwerk-script in de pagina ze opnieuw zetten. */
  VIEWS: [["melden", "Melden"], ["meldafspraken", "Meldafspraken"], ["signalen", "Signalen"], ["protocol", "Protocol"], ["instellingen", "Instellingen"]],

  componenten() {
    window.postMessage({ type: "dt:attr:opnieuw", diep: false, selector: ":is(#dt-cbp, .dt-cb-modal) :is(dna-page-header, dna-tabs, dna-tab-bar, dna-button, dna-card)",
      attr: ["heading", "invert", "orientation", "variant", "fill", "size"] }, "*");
  },

  async open(DT) {
    if (this._scherm) return;
    try { sessionStorage.setItem("dt-cb-open", "1"); } catch {}
    const tiles = document.querySelector("mg-att-tiles"), uv = tiles?.parentElement;
    if (!uv || !/^#\/aanwezigheid\/?$/.test(location.hash)) { location.hash = "#/aanwezigheid"; return; }   // tegel() opent zodra de pagina er is
    this.css();
    const K = TardyKern;
    K.H.bewaar = () => this.bewaar();
    K.H.toon = (t) => this.melding(t);
    const pagina = DT.el("section", { id: "dt-cbp", class: "dt-cb", "aria-label": "Te laat-balie" });
    const kop = DT.el("dna-page-header", { heading: "Te laat-balie" });
    const echt = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector("dna-page-header");
    if (!echt || echt.hasAttribute("invert")) kop.setAttribute("invert", "");
    const terug = DT.el("a", { href: "#/aanwezigheid", text: "Aanwezigheid" });
    terug.addEventListener("click", (e) => { e.preventDefault(); this.sluit(); });
    kop.append(DT.el("dna-breadcrumb", { slot: "breadcrumb" }, terug), DT.el("dna-breadcrumb", { slot: "breadcrumb", text: "Te laat-balie" }),
      DT.el("span", { slot: "actions", class: "dt-cb-tardy", text: "powered by Tardy" }));
    const tabs = DT.el("dna-tabs", { orientation: "horizontal" });
    const bar = DT.el("dna-tab-bar", { slot: "tab-bar", orientation: "horizontal" });
    const panelen = {};
    tabs.append(bar);
    for (const [id, naam] of this.VIEWS) {
      bar.append(DT.el("dna-tab-button", { "data-view": id }, [DT.el("span", { text: naam }), DT.el("span", { class: "dt-cb-tel" })]));
      const inhoud = DT.el("div", { class: "dt-cb-inhoud" });
      tabs.append(DT.el("dna-tab", { slot: "tab", "data-view": id }, DT.el("div", { class: "dt-cb-tabblad" }, inhoud)));
      panelen[id] = inhoud;
    }
    bar.addEventListener("click", (e) => { const b = e.target.closest("dna-tab-button"); if (b && b.dataset.view !== this._view) { this._view = b.dataset.view; this.teken(); } });
    /* Balk boven elk tabblad: stand van de gedeelde map en de periode */
    this._stand = DT.el("span", { class: "dt-cb-stand" });
    this._periode = DT.el("select", { class: "dt-cb-veld dt-cb-periode", "aria-label": "Periode" });
    this._periode.addEventListener("change", () => { K.UI.periodeId = this._periode.value; this.teken(); });
    this._balk = DT.el("div", { class: "dt-cb-balk" }, [this._stand, this._periode]);
    this._toast = DT.el("div", { class: "dt-cb-vars dt-cb-toast", role: "status", "aria-live": "polite" });
    pagina.append(kop, tabs);
    document.body.append(this._toast);
    this._toets = (e) => { if (e.key === "Escape" && this._modal) { e.preventDefault(); this.sluitModal(); } };
    document.addEventListener("keydown", this._toets, true);
    uv.classList.add("dt-cb-open");
    uv.append(pagina);
    this._view = "melden";
    this._scherm = { laag: pagina, uv, bar, panelen, hoofd: panelen.melden };
    this.componenten();
    await this.koppel(DT);
  },

  /* Terug naar Aanwezigheid (kruimelpad), of weg van de pagina. */
  sluit() {
    try { sessionStorage.removeItem("dt-cb-open"); } catch {}
    if (!this._scherm) return;
    clearInterval(this._timer);
    if (this._map && !this._kijkt) { this.schrijfNu().finally(() => this.bezettingVrij()); }
    this.scanStop();
    this.sluitModal();
    document.removeEventListener("keydown", this._toets, true);
    this._scherm.uv.classList.remove("dt-cb-open");
    this._scherm.laag.remove(); this._toast?.remove(); this._toast = null;
    this._scherm = null;
  },

  /* Map openen of kiezen; daarna gegevens laden en de bezetting regelen. */
  async koppel(DT) {
    const h = this._scherm.hoofd;
    this._map = null;
    const handle = await this.kv("map").catch(() => null);
    if (!handle) return this.mapScherm(DT, "Kies de gedeelde map van Tardy", "Kies de map in je OneDrive of Teams waarin tardy-gegevens.json staat, dezelfde map die de Tardy-app gebruikt. Staat er nog niets, dan begint de balie daar met lege gegevens.");
    let mag = "prompt";
    try { mag = await handle.queryPermission({ mode: "readwrite" }); } catch {}
    if (mag !== "granted") {
      return this.mapScherm(DT, `Map "${handle.name}" openen`, "Chrome vraagt één keer per sessie of de balie deze map mag gebruiken.", async () => {
        const r = await handle.requestPermission({ mode: "readwrite" }).catch(() => "denied");
        if (r === "granted") return this.koppel(DT);
        this.melding("Zonder toegang tot de map kan de balie niets bewaren.", "err");
      }, "Map openen");
    }
    this._map = handle;
    const tekst = await this.lees(this.BESTAND);
    if (!tekst) {
      return this.mapScherm(DT, "Nog geen Tardy-gegevens in deze map", `In "${handle.name}" staat geen tardy-gegevens.json. Kies de map waarin Tardy al werkt, of begin hier met lege gegevens.`, async () => {
        const g = this.splits(TardyKern.leegeState());
        g.revisie = 1; g.gewijzigdDoor = this.mijnNaam(); g.gewijzigdOp = new Date().toISOString();
        await this.schrijf(this.BESTAND, JSON.stringify(g)).catch((e) => this.melding(String(e), "err"));
        return this.koppel(DT);
      }, "Beginnen met lege gegevens", true);
    }
    try { this.laadStand(JSON.parse(tekst)); }
    catch { return this.mapScherm(DT, "tardy-gegevens.json is niet te lezen", "Het bestand is beschadigd of nog niet helemaal gesynchroniseerd. Wacht even op OneDrive en probeer het opnieuw.", () => this.koppel(DT), "Opnieuw proberen"); }
    const b = await this.bezetting();
    this._kijkt = false; this._ander = null;
    if (this.bezetDoorAnder(b)) {
      this._ander = b; this._kijkt = true;
      this.modal("Tardy is in gebruik", [
        DT.el("p", { html: `<b>${TardyKern.esc(b.naam || "Een collega")}</b> werkt sinds ${TardyKern.esc(this.moment(b.sinds))} in Tardy${b.apparaatNaam ? `, op ${TardyKern.esc(b.apparaatNaam)}` : ""}.` }),
        DT.el("p", { class: "dt-cb-zacht", text: "Jullie werken om de beurt. Kijk je mee, dan zie je alles en blijft het bijgewerkt, maar bewaart de balie geen wijzigingen." }),
      ], [["Alleen bekijken", () => this.sluitModal()], ["Toch zelf verder", async () => { this._kijkt = false; this._ander = null; await this.herlaad(); await this.bezettingZet(); this.sluitModal(); this.teken(); }, true]]);
    } else await this.bezettingZet();
    clearInterval(this._timer); this._timer = setInterval(() => this.controle(), 30000);
    this.teken();
  },

  mapScherm(DT, titel, uitleg, actie = null, knop = "Map kiezen", ookKiezen = false) {
    const h = this._scherm.hoofd = this._scherm.panelen[this._view];
    const kies = this.knop(DT, actie ? knop : "Map kiezen", actie || (() => this.kiesMap(DT)), true);
    const extra = ookKiezen || actie ? this.knop(DT, "Andere map kiezen", () => this.kiesMap(DT)) : null;
    h.replaceChildren(DT.el("dna-card", { class: "dt-cb-kaart dt-cb-leeg" }, [DT.el("h2", { text: titel }), DT.el("p", { text: uitleg }), DT.el("div", { class: "dt-cb-rij" }, [kies, extra])]));
    this.componenten();
  },

  async kiesMap(DT) {
    if (!window.showDirectoryPicker) return this.melding("Deze browser kan geen map openen. Gebruik Chrome of Edge op een computer.", "err");
    try {
      const h = await window.showDirectoryPicker({ id: "dt-cb-tardy", mode: "readwrite" });
      await this.kv("map", h);
      await this.koppel(DT);
    } catch (e) { if (e?.name !== "AbortError") this.melding(`Map kiezen lukte niet: ${e.message || e}`, "err"); }
  },

  melding(tekst, soort = "info", ms = 4200) {
    if (!this._toast) return DT.toast(tekst, soort === "err" ? "err" : "info", ms);
    this._toast.textContent = tekst; this._toast.dataset.soort = soort; this._toast.classList.add("is-aan");
    clearTimeout(this._toastT); this._toastT = setTimeout(() => this._toast?.classList.remove("is-aan"), ms);
  },
  moment(isoTijd) {
    const d = new Date(isoTijd); if (isNaN(d)) return "onbekend";
    const vandaag = new Date().toDateString() === d.toDateString();
    return (vandaag ? "vandaag" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })) + " om " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  },

  modal(titel, inhoud, knoppen = [["Sluiten", () => this.sluitModal()]]) {
    this.sluitModal();
    const kn = knoppen.map(([t, fn, hoofd]) => this.knop(DT, t, fn, hoofd));
    const m = DT.el("div", { class: "dt-cb-vars dt-cb-modal" }, DT.el("dna-card", { class: "dt-cb-modalin", role: "dialog", "aria-label": titel }, [DT.el("h2", { text: titel }), ...[].concat(inhoud), DT.el("div", { class: "dt-cb-rij eind" }, kn)]));
    m.addEventListener("click", (e) => { if (e.target === m) this.sluitModal(); });
    document.body.append(m); this._modal = m;
    this.componenten();
    setTimeout(() => (kn[kn.length - 1] || m).focus?.(), 50);
    return m;
  },
  sluitModal() { this._modal?.remove(); this._modal = null; },

  tekenStand() {
    if (!this._stand) return;
    const K = TardyKern;
    const tekst = !this._map ? "Geen map gekozen"
      : this._kijkt ? `Alleen bekijken: ${this._ander?.naam || "een collega"} werkt nu in Tardy. Wijzigingen worden niet bewaard.`
      : `Gedeelde map "${this._map.name}"${this._op ? ` · opgeslagen ${this.moment(this._op)}${this._door ? ` door ${this._door}` : ""}` : ""}`;
    this._stand.textContent = tekst;
    this._stand.classList.toggle("is-kijk", !!this._kijkt);
    if (K.S && this._scherm) {
      const zet = (v, n) => { const i = this._scherm.bar.querySelector(`[data-view="${v}"] .dt-cb-tel`); if (i) i.textContent = n ? String(n) : ""; };
      zet("meldafspraken", K.meldLijst().filter((m) => m.datum <= K.vandaag()).length);
      zet("signalen", this.perStudent(K.hoogsteTreden(K.alleSignalen(K.UI.periodeId)).filter((s) => !s.afgehandeld)).length);
    }
  },

  teken() {
    if (!this._scherm) return;
    const K = TardyKern;
    if (!K.S || !this._map) return;
    this._scherm.hoofd = this._scherm.panelen[this._view];
    this._scherm.hoofd.before(this._balk);
    this._periode.replaceChildren(...K.periodes().map((p) => DT.el("option", { value: p.id, text: `${p.naam} · ${K.kortDatum(p.start)} – ${K.kortDatum(p.eind)}` })));
    this._periode.value = K.UI.periodeId;
    this._scherm.laag.classList.toggle("is-kijk", !!this._kijkt);
    ({ melden: () => this.melden(DT), meldafspraken: () => this.afspraken(DT), signalen: () => this.signalen(DT), protocol: () => this.protocol(DT), instellingen: () => this.instellingen(DT) })[this._view]();
    this.tekenStand();
    this.componenten();
  },

  /* ===================================================================================== */
  /* Studenten: gedeelde gegevens + Magister                                                */
  /* ===================================================================================== */
  zoekLokaal(q) {
    const K = TardyKern, s = q.trim().toLowerCase(); if (!s) return [];
    const kaal = s.replace(/^0+/, "");
    return Object.values(K.S.studenten).filter((st) => !st.archief).map((st) => {
      const naam = K.naamVan(st).toLowerCase(), nr = String(st.stamnr || ""), pas = String(st.pasnummer || "");
      const score = nr === s || nr.replace(/^0+/, "") === kaal || pas === s ? 0 : naam.startsWith(s) || (st.achternaam || "").toLowerCase().startsWith(s) ? 1 : naam.includes(s) || nr.includes(s) || (st.klas || "").toLowerCase() === s ? 2 : 9;
      return { st, score };
    }).filter((x) => x.score < 9).sort((a, b) => a.score - b.score || K.naamVan(a.st).localeCompare(K.naamVan(b.st), "nl")).slice(0, 12).map((x) => x.st);
  },
  async zoekMagister(q) {
    const peil = TardyKern.vandaag();
    const velden = ["stamnummer", "naam", "klassen", "emailadres", "KlassenMentor1", "PersoonlijkeMentor1"].map((v) => `&velden=${v}`).join("");
    const r = await DT.api(`/api/leerlingen/zoeken?q=${encodeURIComponent(q)}&top=8&skip=0&peildatum=${peil}${velden}`, { full: true, timeout: 10000 });
    const items = r.status === 200 && r.json ? (r.json.items || []) : [];
    return items.map((x) => ({
      magisterId: x.id, stamnr: String(x.code ?? x.stamnummer ?? ""), roepnaam: x.roepnaam || x.voorletters || "", tussenvoegsel: x.tussenvoegsel || "",
      achternaam: x.achternaam || "", klas: Array.isArray(x.klassen) ? (x.klassen[0] || "") : (x.klassen || ""),
      email: x.emailadres || "", klasMentor: x.klassenMentor1 || "", persMentor: x.persoonlijkeMentor1 || "",
    })).filter((x) => x.stamnr);
  },
  /* Student uit Magister in de gedeelde gegevens zetten (of de koppeling aanvullen). */
  async neemOver(m) {
    const K = TardyKern;
    let st = K.S.studenten[m.stamnr];
    if (!st) {
      st = K.S.studenten[m.stamnr] = { stamnr: m.stamnr, roepnaam: m.roepnaam, tussenvoegsel: m.tussenvoegsel || null, achternaam: m.achternaam, klas: m.klas };
      if (m.email) st.email = m.email;
      if (m.persMentor) st.persoonlijkeMentor = m.persMentor;
      /* Mentoren staan in Magister: is de klassenmentor nog onbekend in de gedeelde gegevens, dan de naam
       * overnemen (het e-mailadres vul je zo nodig in Tardy of in je mailprogramma aan). */
      const km = K.S.instellingen.klasMentoren ||= {};
      if (m.klas && m.klasMentor && !km[m.klas]) km[m.klas] = { naam: m.klasMentor, email: "" };
      const r = await DT.api(`/api/leerlingen/${encodeURIComponent(m.magisterId)}`, { full: true, timeout: 8000 });
      const p = r.status === 200 && r.json ? (r.json.persoon || r.json) : null;
      if (p) {
        const gb = p.geboortedatum || p.geboorteDatum;
        if (gb) st.geboortedatum = String(gb).slice(0, 10);
        const mail = p.emailadres || p.email;
        if (mail && !st.email) st.email = mail;
      }
      this.bewaar();
    }
    if (m.magisterId && st.magisterId !== m.magisterId) { st.magisterId = m.magisterId; this.bewaar(); }
    return st;
  },
  async persoonId() {
    if (this._persoonId !== undefined) return this._persoonId;
    const r = await DT.api("/api/account", { full: true, timeout: 8000 });
    return (this._persoonId = r.status === 200 && r.json ? (r.json.Persoon?.Id ?? r.json.persoon?.id ?? null) : null);
  },
  async openInMagister(st) {
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; if (id) { st.magisterId = id; this.bewaar(); } }
    if (!id) return this.melding("Deze student is niet in Magister gevonden.", "err");
    const pid = await this.persoonId();
    window.open(`${location.origin}/op/#/att-verzuim/${id}/Alle%20rollen/${pid || ""}`, "_blank");
  },

  /* ===================================================================================== */
  /* Melden                                                                                 */
  /* ===================================================================================== */
  SNEL: { ongeoorloofd: ["TEL", "ONG", "UIT"], geoorloofd: ["CAL", "ZIE", "DOK", "TAN"] },

  melden(DT) {
    const K = TardyKern, h = this._scherm.hoofd;
    const zoek = DT.el("input", { type: "search", class: "dt-cb-zoek", placeholder: "Naam of stamnummer, of scan de pas…", autocomplete: "off", "aria-label": "Student zoeken" });
    const tijd = DT.el("input", { type: "time", class: "dt-cb-tijd", title: "Tijd van de melding; leeg = nu", "aria-label": "Tijd" });
    const scan = this.knop(DT, "Scan pas", () => {});
    scan.title = "Studentenpas scannen met de camera";
    const lijst = DT.el("div", { class: "dt-cb-hits", role: "listbox" });
    const paneel = DT.el("div", { class: "dt-cb-paneel" });
    const log = DT.el("div", { class: "dt-cb-log" });
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-zoekrij" }, [zoek, tijd, scan]),
      lijst, paneel,
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("h2", { text: "Vandaag" }), this.knop(DT, "Briefjes van vandaag printen", () => this.print(K.S.registraties.filter((r) => r.datum === K.vandaag() && ["telaat", "calamiteit"].includes((K.SOORT[r.soort] || {}).g)), true))]), log]),
    );
    let hits = [], sel = 0, mzoek = 0;
    const tekenHits = (lokaal, magister = []) => {
      hits = [...lokaal.map((st) => ({ st })), ...magister.filter((m) => !K.S.studenten[m.stamnr]).map((m) => ({ m }))];
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      lijst.replaceChildren(...hits.map((x, i) => {
        const st = x.st || x.m, t = x.st ? K.tellingen(st.stamnr, K.UI.periodeId) : null;
        const b = DT.el("button", { type: "button", role: "option", class: "dt-cb-hit", "aria-selected": String(i === sel) }, [
          DT.el("span", { class: "dt-cb-mono", text: ((st.roepnaam || "")[0] || "") + ((st.achternaam || "")[0] || "") }),
          DT.el("span", { class: "dt-cb-hitnaam" }, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: `${st.klas || "geen klas"} · ${st.stamnr}${x.m ? " · uit Magister" : ""}` })]),
          t ? DT.el("span", { class: "dt-cb-hitstand", text: t.teLaat ? `${t.teLaat}× te laat` : "" }) : null,
        ]);
        b.addEventListener("click", () => kies(x));
        return b;
      }));
    };
    const kies = async (x) => {
      const st = x.st || await this.neemOver(x.m);
      this._gekozen = st.stamnr; zoek.value = ""; lijst.replaceChildren(); hits = [];
      this.tekenPaneel(DT, paneel, tijd);
    };
    zoek.addEventListener("input", () => {
      const q = zoek.value.trim(); sel = 0;
      const lokaal = this.zoekLokaal(q); tekenHits(lokaal);
      clearTimeout(this._zt);
      if (q.length >= 3) {
        const nr = ++mzoek;
        this._zt = setTimeout(async () => { const m = await this.zoekMagister(q); if (nr === mzoek && zoek.value.trim() === q) tekenHits(this.zoekLokaal(q), m); }, 350);
      }
    });
    zoek.addEventListener("keydown", async (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); tekenHits(hits.filter((x) => x.st).map((x) => x.st), hits.filter((x) => x.m).map((x) => x.m)); }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); tekenHits(hits.filter((x) => x.st).map((x) => x.st), hits.filter((x) => x.m).map((x) => x.m)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const q = zoek.value.trim();
        /* Pas of stamnummer (ook van een kaartlezer die als toetsenbord werkt): direct die student. */
        if (/^\d{3,}$/.test(q)) {
          const st = this.zoekLokaal(q)[0];
          if (st && (String(st.stamnr) === q || String(st.stamnr).replace(/^0+/, "") === q.replace(/^0+/, "") || String(st.pasnummer || "") === q)) return kies({ st });
          const m = (await this.zoekMagister(q)).find((x) => x.stamnr === q || x.stamnr.replace(/^0+/, "") === q.replace(/^0+/, ""));
          if (m) return kies(K.S.studenten[m.stamnr] ? { st: K.S.studenten[m.stamnr] } : { m });
        }
        if (hits[sel]) kies(hits[sel]);
      }
    });
    scan.addEventListener("click", () => this.scan(DT, (code) => { zoek.value = code; zoek.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }));
    this.tekenPaneel(DT, paneel, tijd);
    this.tekenLog(DT, log);
    setTimeout(() => zoek.focus(), 30);
  },

  /* Magisters eigen knop: primair (gevuld), gewoon (omlijnd) of stil (alleen tekst); klein = size sm. */
  knop(DT, tekst, fn, hoofd = false, extra = "") {
    const b = DT.el("dna-button", { class: "dt-cb-knop", text: tekst, ...(hoofd ? { variant: "primary" } : {}), ...(/stil/.test(extra) ? { fill: "clear" } : {}), ...(/klein/.test(extra) ? { size: "sm" } : {}) });
    b.addEventListener("click", fn); return b;
  },

  tekenPaneel(DT, paneel, tijdVeld) {
    const K = TardyKern, st = this._gekozen && K.S.studenten[this._gekozen];
    const laatste = this._laatste && K.S.registraties.find((r) => r.id === this._laatste.id);
    const delen = [];
    if (laatste) delen.push(this.uitslag(DT, laatste));
    if (st) {
      const t = K.tellingen(st.stamnr, K.UI.periodeId), min18 = t.achttienMin, mentor = K.mentorVan(st);
      const tel = (c) => { const g = (K.SOORT[c] || {}).g; return g === "telaat" ? t.teLaat : g === "ongeoorloofd" ? t.ongeoorloofd : g === "calamiteit" ? t.calamiteit : g === "ziek" ? t.ziekDatums.length : g === "medisch" ? t.medDatums.length : 0; };
      const soortKnop = (c) => {
        const so = K.SOORT[c], n = tel(c);
        const b = DT.el("button", { type: "button", class: `dt-cb-soort ${so.ok ? "ok" : "nok"}` }, [DT.el("b", { text: so.n }), DT.el("small", { text: n ? `${n}× deze periode` : "nog niet" })]);
        b.addEventListener("click", () => { this.registreer(st.stamnr, c, tijdVeld.value); tijdVeld.value = ""; this.teken(); });
        return b;
      };
      const meer = DT.el("select", { class: "dt-cb-meer", "aria-label": "Meer soorten" }, [DT.el("option", { value: "", text: "Meer soorten…" }),
        ...K.SOORTEN.filter((s) => ![...this.SNEL.ongeoorloofd, ...this.SNEL.geoorloofd].includes(s.c)).map((s) => DT.el("option", { value: s.c, text: s.n }))]);
      meer.addEventListener("change", () => { if (meer.value) { this.registreer(st.stamnr, meer.value, tijdVeld.value); tijdVeld.value = ""; this.teken(); } });
      delen.push(DT.el("dna-card", { class: "dt-cb-kaart dt-cb-student" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [
          DT.el("div", { class: "dt-cb-wie" }, [
            DT.el("h2", { text: K.naamVan(st) }),
            DT.el("small", { text: [st.klas || "geen klas", st.stamnr, min18 === true ? "18−" : min18 === false ? "18+" : "leeftijd onbekend", mentor.naam ? `mentor ${mentor.naam}` : ""].filter(Boolean).join(" · ") }),
          ]),
          this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st)),
          this.knop(DT, "Sluiten", () => { this._gekozen = null; this.teken(); }, false, "stil"),
        ]),
        this.statsRegel(DT, st.stamnr),
        DT.el("div", { class: "dt-cb-soorten" }, [
          DT.el("div", { class: "dt-cb-groep nok" }, [DT.el("span", { text: "Ongeoorloofd" }), ...this.SNEL.ongeoorloofd.map(soortKnop)]),
          DT.el("div", { class: "dt-cb-groep ok" }, [DT.el("span", { text: "Geoorloofd" }), ...this.SNEL.geoorloofd.map(soortKnop)]),
        ]),
        meer,
      ]));
    }
    paneel.replaceChildren(...delen);
  },

  /* Zoals meldNu in Tardy: registratie, telling, gevolg volgens het protocol en zo nodig een meldafspraak. */
  registreer(stamnr, soort, tijd) {
    const K = TardyKern, S = K.S;
    if (this._kijkt) return this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus er wordt niets geregistreerd.`, "err");
    const groep = (K.SOORT[soort] || {}).g, d = K.vandaag();
    const reg = { id: K.uid(), stamnr, datum: d, tijd: tijd || K.nuTijd(), soort, reden: "", notitie: "", paraaf: S.instellingen.cbParaaf || "",
      terug: (groep === "telaat" || groep === "calamiteit") ? false : undefined };
    S.registraties.push(reg);
    const pid = (K.periodeVanDatum(d) || K.huidigePeriode()).id, t = K.tellingen(stamnr, pid);
    const aantal = groep === "telaat" ? t.teLaat : groep === "ongeoorloofd" ? t.ongeoorloofd : groep === "calamiteit" ? t.calamiteit : 0;
    const g = K.gevolgVan(groep, aantal, this.oudersMet18(S.studenten[stamnr]) ? true : t.achttienMin);   // 18+ met toestemming: de tekst met ouders
    let meldDatum = null;
    if (g.meld && !S.meldafspraken.some((m) => m.stamnr === stamnr && m.status === "open")) {
      meldDatum = K.volgendeSchooldag(d);
      S.meldafspraken.push({ id: K.uid(), stamnr, datum: meldDatum, tijd: S.instellingen.meldTijd, aanleiding: groep, aanleidingTekst: "", status: "open", gemaaktOp: d, gemaild: false });
    }
    const per = (K.periodeById(pid) || { naam: "deze periode" }).naam.toLowerCase();
    const telzin = groep === "calamiteit" ? `${t.calamiteit}× calamiteit in ${per}` : groep === "telaat" ? `${t.teLaat}× te laat in ${per}`
      : groep === "ongeoorloofd" ? `${t.ongeoorloofd}× ongeoorloofd in ${per}` : groep === "ziek" ? `${t.ziekDatums.length} ziekdagen in ${per}` : groep === "medisch" ? `${t.medDatums.length} medische afspraken in ${per}` : "";
    this._laatste = { id: reg.id, niveau: g.niveau, gevolg: g.tekst, meldDatum, telzin };
    this._gekozen = null;
    if (groep === "calamiteit" && aantal >= 4) this.melding(`${S.studenten[stamnr].roepnaam} staat op ${aantal}× calamiteit: gesprek voeren en mentor informeren.`, "info", 7000);
    this.bewaar();
    if (S.instellingen.bonAuto && (groep === "telaat" || groep === "calamiteit")) this.print([reg]);
    return reg;
  },

  uitslag(DT, reg) {
    const K = TardyKern, st = K.S.studenten[reg.stamnr] || {}, l = this._laatste || {};
    const groep = (K.SOORT[reg.soort] || {}).g;
    const redenen = DT.el("div", { class: "dt-cb-chips" }, K.redenLijst(groep).map((r) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-chip", "aria-pressed": String(reg.reden === r), text: r });
      b.addEventListener("click", () => { reg.reden = reg.reden === r ? "" : r; this.bewaar(); this.teken(); });
      return b;
    }));
    const eigen = DT.el("input", { type: "text", class: "dt-cb-veld", placeholder: "Eigen reden of notitie", value: K.REDENEN.concat(K.REDENEN_CAL).includes(reg.reden) ? "" : reg.reden || "" });
    eigen.addEventListener("change", () => { reg.reden = eigen.value.trim(); this.bewaar(); this.teken(); });
    const opmerking = `${K.soortNaam(reg.soort)} ${reg.tijd}${reg.reden ? ` – ${reg.reden}` : ""}${reg.paraaf ? ` (${reg.paraaf})` : ""}`;
    return DT.el("dna-card", { class: `dt-cb-kaart dt-cb-uitslag n${l.niveau || 0}` }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [
        DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: `${K.naamVan(st)} · ${K.soortNaam(reg.soort)} ${reg.tijd}` }), DT.el("small", { text: l.telzin || "" })]),
        this.knop(DT, "Briefje printen", () => this.print([reg])),
        this.knop(DT, "Ongedaan maken", () => { K.S.registraties = K.S.registraties.filter((r) => r.id !== reg.id); if (l.meldDatum) K.S.meldafspraken = K.S.meldafspraken.filter((m) => !(m.stamnr === reg.stamnr && m.datum === l.meldDatum && m.gemaaktOp === reg.datum && m.status === "open")); this._laatste = null; this.bewaar(); this.teken(); }, false, "stil"),
      ]),
      l.gevolg ? DT.el("p", { class: "dt-cb-gevolg" }, [l.niveau ? DT.el("span", { class: `dt-cb-niveau n${l.niveau}`, text: K.NIVEAUNAAM[l.niveau] }) : null, DT.el("span", { text: l.gevolg })]) : null,
      l.meldDatum ? DT.el("p", { class: "dt-cb-afspraak", text: `Meldafspraak: ${K.langDatum(l.meldDatum)} om ${K.S.instellingen.meldTijd} uur, lokaal ${K.S.instellingen.lokaal || "—"}.` }) : null,
      DT.el("div", { class: "dt-cb-redenrij" }, [DT.el("span", { class: "dt-cb-label", text: "Reden" }), redenen, eigen]),
      DT.el("div", { class: "dt-cb-magister" }, [
        DT.el("span", { html: `In Magister: zet ${TardyKern.esc(st.roepnaam || "de student")} op <b>${TardyKern.esc(K.soortNaam(reg.soort))}</b>, met als opmerking:` }),
        DT.el("code", { text: opmerking }),
        this.knop(DT, "Kopieer opmerking", () => navigator.clipboard.writeText(opmerking).then(() => this.melding("Opmerking gekopieerd.")).catch(() => this.melding("Kopiëren lukte niet.", "err"))),
        this.knop(DT, "Open verzuim", () => this.openInMagister(st)),
      ]),
    ]);
  },

  tekenLog(DT, log) {
    const K = TardyKern;
    const regs = K.S.registraties.filter((r) => r.datum === K.vandaag()).sort((a, b) => (b.tijd || "").localeCompare(a.tijd || ""));
    const open = regs.filter((r) => r.terug === false).length;
    if (!regs.length) return log.replaceChildren(DT.el("p", { class: "dt-cb-zacht", text: "Nog niemand gemeld vandaag." }));
    log.replaceChildren(
      DT.el("p", { class: "dt-cb-zacht", text: `${regs.length} ${regs.length === 1 ? "melding" : "meldingen"}${open ? ` · ${open} ${open === 1 ? "briefje" : "briefjes"} niet terug` : ""}` }),
      DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, ["Tijd", "Student", "Soort", "Reden", "Briefje terug", ""].map((t) => DT.el("th", { text: t })))),
        DT.el("tbody", {}, regs.map((r) => {
          const st = K.S.studenten[r.stamnr] || {};
          const terug = r.terug === undefined ? DT.el("span", { class: "dt-cb-zacht", text: "—" }) : DT.el("input", { type: "checkbox", "aria-label": `Briefje van ${K.naamVan(st)} terug` });
          if (r.terug !== undefined) { terug.checked = !!r.terug; terug.addEventListener("change", () => { r.terug = terug.checked; this.bewaar(); }); }
          const reden = DT.el("input", { type: "text", class: "dt-cb-veld klein", value: r.reden || "", "aria-label": "Reden" });
          reden.addEventListener("change", () => { r.reden = reden.value.trim(); this.bewaar(); });
          return DT.el("tr", {}, [DT.el("td", { text: r.tijd }), DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}` })]),
            DT.el("td", { text: K.soortNaam(r.soort) }), DT.el("td", {}, reden), DT.el("td", {}, terug),
            DT.el("td", { class: "dt-cb-acties" }, [this.knop(DT, "Print", () => this.print([r]), false, "klein"),
              this.knop(DT, "Wis", () => { if (confirm(`Registratie van ${K.naamVan(st)} (${r.tijd}) verwijderen?`)) { K.S.registraties = K.S.registraties.filter((x) => x.id !== r.id); this.bewaar(); this.teken(); } }, false, "klein stil")])]);
        })),
      ]));
  },

  /* ---------- scannen: studentenpas met de camera ---------- */
  async scan(DT, klaar) {
    if (!("BarcodeDetector" in window)) return this.melding("Deze browser kan geen streepjescodes lezen met de camera (Chrome op een Mac wel). Een USB-scanner werkt altijd: scan in het zoekveld.", "err", 8000);
    let det; try { det = new BarcodeDetector(); } catch { return this.melding("Streepjescodes lezen lukt hier niet.", "err"); }
    const video = DT.el("video", { autoplay: "", playsinline: "", muted: "" });
    const m = this.modal("Pas scannen", [DT.el("div", { class: "dt-cb-scanvak" }, [video, DT.el("i")]), DT.el("p", { class: "dt-cb-zacht", text: "Houd de pas met de streepjescode voor de camera. Het beeld wordt niet bewaard." })], [["Stoppen", () => { this.scanStop(); this.sluitModal(); }]]);
    try { this._camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
    catch { this.sluitModal(); return this.melding("Geen toegang tot de camera.", "err"); }
    video.srcObject = this._camera;
    const kijk = async () => {
      if (!this._camera || !m.isConnected) return;
      try {
        const res = await det.detect(video);
        const code = res.find((x) => x.rawValue)?.rawValue;
        if (code) { this.scanStop(); this.sluitModal(); return klaar(code.trim()); }
      } catch {}
      this._scanT = setTimeout(kijk, 250);
    };
    video.addEventListener("loadeddata", kijk, { once: true });
  },
  scanStop() { clearTimeout(this._scanT); this._camera?.getTracks().forEach((t) => t.stop()); this._camera = null; },

  /* ---------- briefjes ---------- */
  async print(regs, a4 = false) {
    if (!regs.length) return this.melding("Geen briefjes om te printen.");
    const S = TardyKern.S;
    if (!a4 && S.instellingen.bonPrinter && navigator.bluetooth) {
      try { await this.bonPrint(regs); return this.melding(regs.length === 1 ? "Briefje geprint." : `${regs.length} briefjes geprint.`); }
      catch (e) { this.melding(`Bonprinter: ${e.message || e}. Ik print op de gewone printer.`, "err", 7000); }
    }
    const fr = DT.el("iframe", { style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0", "aria-hidden": "true" });
    document.body.append(fr);
    fr.srcdoc = TardyKern.briefjesHtml(regs);
    fr.addEventListener("load", () => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); }, { once: true });
  },

  /* Bonprintertje uit de Tiny Print-familie via Web Bluetooth, zelfde protocol als Tardy (dienst AE30,
   * schrijven op AE01, AE02 meldt "buffer vol" en "weer ruimte"). Blokken van 180 bytes. */
  async bonApparaat(nieuw = false) {
    if (!navigator.bluetooth) throw new Error("deze browser kan geen Bluetooth gebruiken");
    const naam = TardyKern.S.instellingen.bonPrinter?.naam;
    if (!nieuw && this._bon?.gatt) return this._bon;
    if (!nieuw && naam && navigator.bluetooth.getDevices) {
      const bekend = (await navigator.bluetooth.getDevices().catch(() => [])).find((d) => d.name === naam);
      if (bekend) return (this._bon = bekend);
    }
    const d = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0xae30] });
    this._bon = d;
    return d;
  },
  async bonPrint(regs) {
    const K = TardyKern, d = await this.bonApparaat();
    const server = d.gatt.connected ? d.gatt : await d.gatt.connect();
    const dienst = await server.getPrimaryService(0xae30).catch(() => { throw new Error("dit apparaat is geen bonprinter (dienst AE30 ontbreekt)"); });
    const schrijf = await dienst.getCharacteristic(0xae01);
    let pauze = false;
    try {
      const meld = await dienst.getCharacteristic(0xae02);
      await meld.startNotifications();
      meld.addEventListener("characteristicvaluechanged", (e) => {
        const v = new Uint8Array(e.target.value.buffer);
        if (v[0] === 0x51 && v[1] === 0x78 && v[2] === 0xae) pauze = v[6] === 0x10;
      });
    } catch {}
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const reg of regs) {
      const b = await K.bonBeeld(reg);
      const data = K.bonOpdracht(b.pix, b.breedte, b.hoogte, { zwarting: +K.S.instellingen.bonZwarting || 3 });
      for (let i = 0; i < data.length; i += 180) {
        let n = 0; while (pauze && n++ < 3000) await wacht(5);
        await (schrijf.writeValueWithoutResponse ? schrijf.writeValueWithoutResponse(data.subarray(i, i + 180)) : schrijf.writeValue(data.subarray(i, i + 180)));
        await wacht(4);
      }
      await wacht(600);
    }
    clearTimeout(this._bonLos); this._bonLos = setTimeout(() => { try { d.gatt.disconnect(); } catch {} }, 30000);
  },

  /* ===================================================================================== */
  /* Meldafspraken                                                                          */
  /* ===================================================================================== */
  afspraken(DT) {
    const K = TardyKern, h = this._scherm.hoofd, d = K.vandaag();
    if (this._mafModus === "geschiedenis") return this.geschiedenis(DT);
    const lijst = K.meldLijst();
    this._kies = new Set([...(this._kies || [])].filter((id) => lijst.some((m) => m.id === id)));
    const datum = DT.el("input", { type: "date", value: K.volgendeSchooldag(d) }), tijd = DT.el("input", { type: "time", value: K.S.instellingen.meldTijd || "08:30" });
    const balk = DT.el("div", { class: "dt-cb-bulk" }, [
      DT.el("b", { text: `${this._kies.size} gekozen` }), DT.el("label", {}, ["Datum ", datum]), DT.el("label", {}, ["Tijd ", tijd]),
      this.knop(DT, "Verzetten", () => { this.gekozenAfspraken().forEach((m) => { m.datum = datum.value; m.tijd = tijd.value; }); this.bewaar(); this.teken(); }),
      this.knop(DT, "Mails aanmaken", () => this.mailsMeldafspraak(DT, datum.value, tijd.value), true),
      this.knop(DT, "Verschenen", () => { this.gekozenAfspraken().forEach((m) => this.rondAf(m, "verschenen")); this._kies.clear(); this.bewaar(); this.teken(); }),
      this.knop(DT, "Niet verschenen", () => { this.gekozenAfspraken().forEach((m) => this.nietVerschenen(m)); this._kies.clear(); this.bewaar(); this.teken(); }),
    ]);
    balk.hidden = !this._kies.size;
    const rij = (m) => {
      const st = K.S.studenten[m.stamnr], t = K.tellingen(m.stamnr, K.UI.periodeId), n = K.hoogsteNiveau(m.stamnr, K.UI.periodeId);
      const vink = DT.el("input", { type: "checkbox", "aria-label": `Kies ${K.naamVan(st)}` }); vink.checked = this._kies.has(m.id);
      vink.addEventListener("change", () => { vink.checked ? this._kies.add(m.id) : this._kies.delete(m.id); this.teken(); });
      const aantal = m.aanleiding === "ongeoorloofd" ? `${t.ongeoorloofd}× ongeoorloofd` : `${t.teLaat}× te laat`;
      return DT.el("tr", {}, [DT.el("td", {}, vink),
        DT.el("td", {}, [this.naamKnop(DT, st), DT.el("small", { text: ` ${st.klas || ""}${K.minderjarig(st) === true ? " · 18−" : ""}` }),
          m.vorigeId ? DT.el("small", { class: "dt-cb-vervolg", text: ` · ${this.vervolgTekst(m)}` }) : null].filter(Boolean)),
        DT.el("td", { text: K.AANLEIDING[m.aanleiding] || m.aanleiding }),
        DT.el("td", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: n ? `trede ${n}` : "—" }), DT.el("small", { text: ` ${aantal}` })]),
        DT.el("td", { text: `${K.langDatum(m.datum)} ${m.tijd || ""}` }),
        DT.el("td", { text: m.gemaild ? "gemaild" : st.email ? "nog niet gemaild" : "geen e-mailadres" }),
        DT.el("td", { class: "dt-cb-acties" }, [
          this.knop(DT, "In Magister", () => this.afspraakMaken(m.stamnr, { onderwerp: `Meldafspraak bij de CB'er: ${K.naamVan(st)}`, datum: m.datum, tijd: m.tijd,
            tekst: `Meldafspraak (${(K.AANLEIDING[m.aanleiding] || m.aanleiding).toLowerCase()}): ${aantal}.${m.aanleidingTekst ? `\n${m.aanleidingTekst}` : ""}\n\nAangemaakt vanuit de Te laat-balie (Tardy).` }), false, "klein"),
          this.knop(DT, "Verschenen", () => { this.rondAf(m, "verschenen"); this.bewaar(); this.teken(); }, false, "klein"),
          this.knop(DT, "Niet", () => this.nietModal(DT, m), false, "klein"),
          this.knop(DT, "Vervalt", () => { this.rondAf(m, "vervallen"); this.bewaar(); this.teken(); }, false, "klein stil")]),
      ]);
    };
    const groepen = [["Verlopen", lijst.filter((m) => m.datum < d)], ["Vandaag", lijst.filter((m) => m.datum === d)], ["Komende dagen", lijst.filter((m) => m.datum > d)]].filter(([, r]) => r.length);
    const alles = DT.el("input", { type: "checkbox", "aria-label": "Alles kiezen" }); alles.checked = !!lijst.length && this._kies.size === lijst.length;
    alles.addEventListener("change", () => { this._kies = new Set(alles.checked ? lijst.map((m) => m.id) : []); this.teken(); });
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-rij" }, [this.mafSchakel(DT), DT.el("span", { class: "dt-cb-zacht", text: `${lijst.length} ${lijst.length === 1 ? "afspraak" : "afspraken"}` }), this.knop(DT, "Student toevoegen", () => this.handmatigeAfspraak(DT))]),
      balk,
      lijst.length ? DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, [DT.el("th", {}, alles), ...["Student", "Aanleiding", "Ladder", "Wanneer", "Mail", ""].map((t) => DT.el("th", { text: t }))])),
        ...groepen.map(([titel, r]) => DT.el("tbody", {}, [DT.el("tr", { class: "dt-cb-groepkop" }, DT.el("td", { colspan: "7", text: `${titel} (${r.length})` })), ...r.map(rij)])),
      ]) : DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Niemand hoeft zich te melden. Registraties op Melden vullen deze lijst vanzelf." })),
    );
  },
  gekozenAfspraken() { return TardyKern.meldLijst().filter((m) => this._kies.has(m.id)); },
  /* ---------- afronden en vervolg: alles blijft bewaard, zodat de geschiedenis compleet is ---------- */
  /* Statussen: open, verschenen, niet-verschenen (telt mee in de ladder "Niet verschenen"), verzet (kon niet,
   * buiten de student om; telt niet mee) en vervallen. vorigeId/vervolgId koppelen een afspraak aan de
   * afspraak die erop volgt. Tardy kijkt alleen naar open en niet-verschenen, dus dit werkt daar ook. */
  rondAf(m, status, extra = {}) {
    const K = TardyKern;
    Object.assign(m, { status, afgerondOp: new Date().toISOString(), afgerondDoor: K.S.instellingen.cbNaam || "" }, extra);
  },
  vervolg(m, { datum, tijd, aanleiding, tekst }) {
    const K = TardyKern;
    let n = K.S.meldafspraken.find((x) => x.stamnr === m.stamnr && x.datum === datum && x.status === "open" && x.id !== m.id);
    if (!n) {
      n = { id: K.uid(), stamnr: m.stamnr, datum, tijd: tijd || K.S.instellingen.meldTijd, aanleiding, status: "open", gemaaktOp: K.vandaag(), gemaild: false };
      if (tekst) n.aanleidingTekst = tekst;
      K.S.meldafspraken.push(n);
    }
    n.vorigeId = m.id; m.vervolgId = n.id;
    return n;
  },
  eersteDag(m) { const K = TardyKern; return K.volgendeSchooldag(K.vandaag() > m.datum ? K.vandaag() : m.datum); },
  /* Weggebleven: telt mee in het protocol, en direct een nieuwe meldafspraak. */
  nietVerschenen(m, datum = null, tijd = null, notitie = "") {
    this.rondAf(m, "niet-verschenen", notitie ? { notitie } : {});
    return this.vervolg(m, { datum: datum || this.eersteDag(m), tijd, aanleiding: "nietgemeld" });
  },

  nietModal(DT, m) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || {};
    const datum = DT.el("input", { type: "date", class: "dt-cb-veld klein", value: this.eersteDag(m) });
    const tijd = DT.el("input", { type: "time", class: "dt-cb-veld klein", value: m.tijd || K.S.instellingen.meldTijd || "08:30" });
    const reden = DT.el("input", { type: "text", class: "dt-cb-veld", placeholder: "Wat was er? bijv. toets liep uit, door docent vastgehouden, CB'er afwezig" });
    const keuze = (titel, tekst) => DT.el("div", { class: "dt-cb-keuze" }, [DT.el("b", { text: titel }), DT.el("small", { text: tekst })]);
    this.modal(`${K.naamVan(st)} is niet verschenen`, [
      DT.el("p", { class: "dt-cb-zacht", text: `Meldafspraak van ${K.langDatum(m.datum)} ${m.tijd || ""} (${(K.AANLEIDING[m.aanleiding] || m.aanleiding).toLowerCase()}).` }),
      keuze("Weggebleven", "Telt mee in de ladder “Niet verschenen bij de meldafspraak”. Er komt meteen een nieuwe meldafspraak en je ziet welke stap het protocol nu vraagt."),
      keuze("Buiten de student om", "Telt niet mee. Er komt een nieuwe afspraak; de reden blijft in de geschiedenis staan."),
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("label", {}, ["Nieuwe afspraak ", datum]), DT.el("label", {}, ["om ", tijd])]),
      DT.el("label", { class: "dt-cb-protveld" }, [DT.el("span", { text: "Reden of notitie" }), reden]),
    ], [
      ["Annuleren", () => this.sluitModal()],
      ["Buiten de student om", () => {
        if (!reden.value.trim()) { reden.focus(); return this.melding("Vul kort in wat er was; dat blijft in de geschiedenis staan.", "err"); }
        this.rondAf(m, "verzet", { reden: reden.value.trim() });
        const n = this.vervolg(m, { datum: datum.value, tijd: tijd.value, aanleiding: m.aanleiding, tekst: m.aanleidingTekst });
        this.bewaar(); this.teken(); this.sluitModal();
        this.melding(`Nieuwe afspraak op ${K.langDatum(n.datum)} om ${n.tijd}. Telt niet mee in het protocol.`);
      }],
      ["Weggebleven", () => {
        const n = this.nietVerschenen(m, datum.value, tijd.value, reden.value.trim());
        this.bewaar(); this.teken(); this.stapModal(DT, m, n);
      }, true],
    ]);
  },

  /* Na wegblijven: wat het protocol nu vraagt, met de drie actieknoppen en de nieuwe afspraak. */
  stapModal(DT, m, n = null) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || {}, pid = K.periodeVanDatum(m.datum)?.id || K.UI.periodeId;
    n ||= K.S.meldafspraken.find((x) => x.id === m.vervolgId) || null;
    const sigs = this.met18(K.hoogsteTreden(K.signalenVoor(m.stamnr, pid)));
    const s = sigs.find((x) => x.soort === "nietgemeld"), hoogst = this.perStudent(sigs.filter((x) => !x.afgehandeld))[0];
    const opnieuw = () => { this.teken(); this.stapModal(DT, m, n); };
    const inhoud = [
      DT.el("p", { text: `Vastgelegd: niet verschenen op ${K.langDatum(m.datum)}.${n ? ` Nieuwe meldafspraak op ${K.langDatum(n.datum)} om ${n.tijd}.` : ""}` }),
      s ? DT.el("div", { class: `dt-cb-stapblok n${s.niveau}` }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("b", { text: s.titel }), DT.el("span", { class: `dt-cb-niveau n${s.niveau}`, text: s.consequentie })]),
        DT.el("p", { text: s.maatregel }),
        this.actieKnoppen(DT, s, st, pid, opnieuw),
      ]) : DT.el("p", { class: "dt-cb-zacht", text: "Het protocol vraagt bij deze telling nog geen extra stap." }),
      hoogst && s && hoogst.key !== s.key && hoogst.niveau > s.niveau
        ? DT.el("p", { class: "dt-cb-waarschuw", text: `Let op: op een andere ladder staat ${K.naamVan(st)} al op ${hoogst.consequentie} (${hoogst.titel}). Die zwaardere stap gaat voor; zie Signalen.` }) : null,
    ].filter(Boolean);
    const knoppen = [["Sluiten", () => this.sluitModal()]];
    if (n) {
      knoppen.unshift(["Afspraak in Magister", () => this.afspraakMaken(m.stamnr, { onderwerp: `Meldafspraak bij de CB'er: ${K.naamVan(st)}`, datum: n.datum, tijd: n.tijd,
        tekst: `Nieuwe meldafspraak: niet verschenen op ${K.langDatum(m.datum)}.\n\nAangemaakt vanuit de Te laat-balie (Tardy).` })]);
      knoppen.unshift([n.gemaild ? "✓ Student gemaild" : "Mail student over nieuwe afspraak", () => {
        const t = this.mailVan("student-meldafspraak", m.stamnr, pid, { datum: n.datum, tijd: n.tijd, melding: n });
        const a = document.createElement("a");
        a.href = `mailto:${this.adressen(t.aan)}?subject=${encodeURIComponent(t.onderwerp)}&body=${encodeURIComponent(t.body)}`; a.click();
        n.gemaild = true; K.S.mails.push({ id: K.uid(), stamnr: m.stamnr, type: t.type, aan: t.aan, onderwerp: t.onderwerp, op: K.vandaag() });
        this.bewaar(); opnieuw();
      }]);
    }
    this.modal(`Volgende stap voor ${K.naamVan(st)}`, inhoud, knoppen);
  },

  nieuweAfspraakModal(DT, m) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || {};
    const datum = DT.el("input", { type: "date", class: "dt-cb-veld klein", value: K.volgendeSchooldag(K.vandaag()) });
    const tijd = DT.el("input", { type: "time", class: "dt-cb-veld klein", value: K.S.instellingen.meldTijd || "08:30" });
    this.modal(`Nieuwe meldafspraak voor ${K.naamVan(st)}`, [
      DT.el("p", { class: "dt-cb-zacht", text: `Volgt op de afspraak van ${K.langDatum(m.datum)} (${this.uitkomst(m).tekst.toLowerCase()}).` }),
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("label", {}, ["Datum ", datum]), DT.el("label", {}, ["om ", tijd])]),
    ], [["Annuleren", () => this.sluitModal()], ["Afspraak maken", () => {
      const n = this.vervolg(m, { datum: datum.value, tijd: tijd.value, aanleiding: m.status === "niet-verschenen" ? "nietgemeld" : m.aanleiding, tekst: m.aanleidingTekst });
      this.bewaar(); this.sluitModal(); this.teken(); this.melding(`Meldafspraak op ${K.langDatum(n.datum)} om ${n.tijd}.`);
    }, true]]);
  },

  /* ---------- geschiedenis: per schooljaar en periode ---------- */
  schooljaarVan(d) { const y = +d.slice(0, 4), mnd = +d.slice(5, 7); return mnd >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`; },
  /* De periodes in de gedeelde gegevens gelden voor één schooljaar. Die bewaren we per schooljaar, zodat oudere
   * afspraken later nog in hun eigen periode staan als Tardy al op het nieuwe schooljaar is gezet. */
  periodesVan(sj) {
    const K = TardyKern, nu = K.periodes();
    if (nu.length && this.schooljaarVan(nu[0].start) === sj) return nu;
    return (K.S.cbPeriodes || {})[sj] || [];
  },
  bewaarPeriodes() {
    const K = TardyKern, nu = K.periodes(); if (!nu.length || this._kijkt) return;
    const sj = this.schooljaarVan(nu[0].start), arch = (K.S.cbPeriodes ||= {});
    if (JSON.stringify(arch[sj]) !== JSON.stringify(nu)) { arch[sj] = JSON.parse(JSON.stringify(nu)); this.bewaar(); }
  },
  periodeVan(d) { return this.periodesVan(this.schooljaarVan(d)).find((p) => d >= p.start && d <= p.eind) || null; },
  uitkomst(m) {
    const d = TardyKern.vandaag();
    return ({ verschenen: { k: "ok", tekst: "Verschenen" }, "niet-verschenen": { k: "nok", tekst: "Niet verschenen" }, verzet: { k: "verzet", tekst: "Verzet, buiten de student om" },
      vervallen: { k: "weg", tekst: "Vervallen" } })[m.status] || (m.datum < d ? { k: "open", tekst: "Nog niet afgerond" } : { k: "gepland", tekst: m.datum === d ? "Vandaag" : "Gepland" });
  },
  vervolgTekst(m) {
    const K = TardyKern, byId = (id) => K.S.meldafspraken.find((x) => x.id === id);
    const v = m.vervolgId && byId(m.vervolgId), w = m.vorigeId && byId(m.vorigeId);
    return [w ? `volgt op ${K.kortDatum(w.datum)} (${this.uitkomst(w).tekst.toLowerCase()})` : "", v ? `→ nieuwe afspraak ${K.kortDatum(v.datum)} (${this.uitkomst(v).tekst.toLowerCase()})` : ""].filter(Boolean).join(" · ");
  },
  naamKnop(DT, st) {
    const b = DT.el("button", { type: "button", class: "dt-cb-naamknop", text: TardyKern.naamVan(st), title: "Meldafspraken van deze student" });
    b.addEventListener("click", () => this.studentHistorie(DT, st.stamnr)); return b;
  },
  mafSchakel(DT) {
    const groep = DT.el("div", { class: "dt-cb-chips", role: "group", "aria-label": "Weergave" });
    for (const [id, t] of [["open", "Openstaand"], ["geschiedenis", "Geschiedenis"]]) {
      const b = DT.el("button", { type: "button", class: "dt-cb-chip", "aria-pressed": String((this._mafModus || "open") === id), text: t });
      b.addEventListener("click", () => { this._mafModus = id; this.teken(); }); groep.append(b);
    }
    return groep;
  },
  telling(lijst) {
    const n = (st) => lijst.filter((m) => m.status === st).length, ok = n("verschenen"), nok = n("niet-verschenen");
    return { totaal: lijst.length, ok, nok, verzet: n("verzet"), weg: n("vervallen"), open: lijst.filter((m) => m.status === "open").length, pct: ok + nok ? Math.round((100 * ok) / (ok + nok)) : null };
  },
  tellingRegel(DT, t) {
    return DT.el("div", { class: "dt-cb-telregel" }, [
      DT.el("span", { text: `${t.totaal} ${t.totaal === 1 ? "afspraak" : "afspraken"}` }),
      DT.el("span", { class: "ok", text: `${t.ok} verschenen` }), DT.el("span", { class: "nok", text: `${t.nok} niet verschenen` }),
      t.verzet ? DT.el("span", { text: `${t.verzet} verzet` }) : null, t.weg ? DT.el("span", { text: `${t.weg} vervallen` }) : null,
      t.open ? DT.el("span", { text: `${t.open} open` }) : null,
      t.pct != null ? DT.el("b", { text: `${t.pct}% nagekomen` }) : null,
    ].filter(Boolean));
  },
  histRij(DT, m, metStudent = true) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || { stamnr: m.stamnr, roepnaam: m.stamnr }, u = this.uitkomst(m);
    const open = m.vervolgId && K.S.meldafspraken.some((x) => x.id === m.vervolgId && x.status === "open");
    const acties = [];
    if (m.status === "open") {
      acties.push(this.knop(DT, "Verschenen", () => { this.rondAf(m, "verschenen"); this.bewaar(); this.teken(); this.vernieuwModal(DT); }, false, "klein"),
        this.knop(DT, "Niet", () => this.nietModal(DT, m), false, "klein"));
    } else {
      if (m.status === "niet-verschenen") acties.push(this.knop(DT, "Volgende stap", () => this.stapModal(DT, m), false, "klein"));
      if (!open && m.status !== "verschenen") acties.push(this.knop(DT, "Nieuwe afspraak", () => this.nieuweAfspraakModal(DT, m), false, "klein"));
      if (!m.vervolgId) acties.push(this.knop(DT, "Terugzetten", () => {
        if (!confirm("Deze afspraak weer op open zetten? De uitkomst vervalt.")) return;
        m.status = "open"; delete m.afgerondOp; delete m.afgerondDoor; delete m.reden; this.bewaar(); this.teken(); this.vernieuwModal(DT);
      }, false, "klein stil"));
    }
    const wie = m.afgerondOp ? `${m.afgerondDoor ? `${m.afgerondDoor}, ` : ""}${new Date(m.afgerondOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` : "";
    return DT.el("tr", { "data-zoek": `${K.naamVan(st)} ${st.klas || ""} ${m.stamnr}`.toLowerCase() }, [
      DT.el("td", {}, [DT.el("b", { text: K.kortDatum(m.datum) }), DT.el("small", { text: ` ${m.tijd || ""}` })]),
      metStudent ? DT.el("td", {}, [this.naamKnop(DT, st), DT.el("small", { text: ` ${st.klas || ""}` })]) : null,
      DT.el("td", {}, [DT.el("span", { text: K.AANLEIDING[m.aanleiding] || m.aanleiding }), m.aanleidingTekst ? DT.el("small", { class: "dt-cb-blok", text: m.aanleidingTekst }) : null].filter(Boolean)),
      DT.el("td", {}, [DT.el("span", { class: `dt-cb-uitkomst ${u.k}`, text: u.tekst }), m.reden || m.notitie ? DT.el("small", { class: "dt-cb-blok", text: m.reden || m.notitie }) : null,
        wie ? DT.el("small", { class: "dt-cb-blok dt-cb-zacht", text: wie }) : null].filter(Boolean)),
      DT.el("td", {}, DT.el("small", { text: this.vervolgTekst(m) || "—" })),
      DT.el("td", { class: "dt-cb-acties" }, acties),
    ].filter(Boolean));
  },
  histTabel(DT, lijst, perPeriode, metStudent = true) {
    const kop = ["Datum", ...(metStudent ? ["Student"] : []), "Aanleiding", "Uitkomst", "Vervolg", ""];
    const groepen = [];
    if (perPeriode) {
      for (const m of lijst) {
        const sj = this.schooljaarVan(m.datum), p = this.periodeVan(m.datum), k = `${sj} · ${p ? p.naam : "buiten de periodes"}`;
        let g = groepen.find((x) => x[0] === k); if (!g) groepen.push(g = [k, []]); g[1].push(m);
      }
    } else groepen.push([null, lijst]);
    return DT.el("table", { class: "dt-cb-tabel dt-cb-hist" }, [
      DT.el("thead", {}, DT.el("tr", {}, kop.map((t) => DT.el("th", { text: t })))),
      ...groepen.map(([titel, r]) => DT.el("tbody", {}, [
        titel ? DT.el("tr", { class: "dt-cb-groepkop" }, DT.el("td", { colspan: String(kop.length) }, [DT.el("span", { text: titel }), this.tellingRegel(DT, this.telling(r))])) : null,
        ...r.map((m) => this.histRij(DT, m, metStudent))].filter(Boolean))),
    ]);
  },

  geschiedenis(DT) {
    const K = TardyKern, h = this._scherm.hoofd;
    this.bewaarPeriodes();
    const alle = K.S.meldafspraken.filter((m) => m.datum).slice().sort((a, b) => (b.datum + (b.tijd || "")).localeCompare(a.datum + (a.tijd || "")));
    const jaren = [...new Set([this.schooljaarVan(K.vandaag()), ...alle.map((m) => this.schooljaarVan(m.datum))])].sort().reverse();
    if (!jaren.includes(this._hJaar)) this._hJaar = jaren[0];
    const pers = this.periodesVan(this._hJaar);
    if (this._hPer && !pers.some((p) => p.id === this._hPer)) this._hPer = "";
    const kies = (opties, waarde, zet, label) => {
      const sel = DT.el("select", { class: "dt-cb-veld klein", "aria-label": label }, opties.map(([v, t]) => DT.el("option", { value: v, text: t })));
      sel.value = waarde; sel.addEventListener("change", () => { zet(sel.value); this.teken(); }); return sel;
    };
    const p = pers.find((x) => x.id === this._hPer);
    let lijst = alle.filter((m) => this.schooljaarVan(m.datum) === this._hJaar && (!p || (m.datum >= p.start && m.datum <= p.eind)));
    const uit = this._hUit || "";
    if (uit) lijst = lijst.filter((m) => uit === "open" ? m.status === "open" : m.status === uit);
    const zoek = DT.el("input", { type: "search", class: "dt-cb-veld klein", placeholder: "Zoek student of klas", value: this._hZoek || "" });
    const tabel = lijst.length ? this.histTabel(DT, lijst, true) : DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Geen meldafspraken in deze selectie." }));
    const filter = () => {
      const q = (this._hZoek = zoek.value.trim().toLowerCase());
      tabel.querySelectorAll?.("tbody tr[data-zoek]").forEach((tr) => { tr.hidden = !!q && !tr.dataset.zoek.includes(q); });
    };
    zoek.addEventListener("input", filter);
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-rij" }, [this.mafSchakel(DT),
        kies(jaren.map((j) => [j, `Schooljaar ${j}`]), this._hJaar, (v) => { this._hJaar = v; this._hPer = ""; }, "Schooljaar"),
        kies([["", "Alle periodes"], ...pers.map((x) => [x.id, `${x.naam} · ${K.kortDatum(x.start)} – ${K.kortDatum(x.eind)}`])], this._hPer || "", (v) => { this._hPer = v; }, "Periode"),
        kies([["", "Alle uitkomsten"], ["verschenen", "Verschenen"], ["niet-verschenen", "Niet verschenen"], ["verzet", "Verzet"], ["vervallen", "Vervallen"], ["open", "Open"]], uit, (v) => { this._hUit = v; }, "Uitkomst"),
        zoek]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: `${p ? p.naam : "Schooljaar"} ${this._hJaar}` }), this.tellingRegel(DT, this.telling(lijst)),
        pers.length ? null : DT.el("p", { class: "dt-cb-zacht", text: "Van dit schooljaar zijn de periodes niet bewaard; de afspraken staan per schooljaar." })].filter(Boolean)),
      tabel,
    );
    filter();
  },

  /* Alles van één student: per schooljaar en periode, met de stand van te laat en niet verschenen. */
  studentHistorie(DT, sn) {
    const K = TardyKern, st = K.S.studenten[sn] || { stamnr: sn, roepnaam: sn };
    this._histStudent = sn;
    const lijst = K.S.meldafspraken.filter((m) => m.stamnr === sn && m.datum).sort((a, b) => (b.datum + (b.tijd || "")).localeCompare(a.datum + (a.tijd || "")));
    const reg = K.S.registraties.filter((r) => r.stamnr === sn);
    const t = this.telling(lijst);
    const m = this.modal(`Meldafspraken van ${K.naamVan(st)}`, [
      DT.el("p", { class: "dt-cb-zacht", text: `${st.klas || ""} · ${sn} · ${reg.length} registraties in de balie` }),
      this.tellingRegel(DT, t),
      lijst.length ? this.histTabel(DT, lijst, true, false) : DT.el("p", { text: "Nog geen meldafspraken." }),
    ], [["Nieuwe meldafspraak", () => {
      if (K.S.meldafspraken.some((x) => x.stamnr === sn && x.status === "open")) return this.melding("Er staat al een open meldafspraak.");
      K.S.meldafspraken.push({ id: K.uid(), stamnr: sn, datum: K.volgendeSchooldag(K.vandaag()), tijd: K.S.instellingen.meldTijd, aanleiding: "handmatig", status: "open", gemaaktOp: K.vandaag(), gemaild: false });
      this.bewaar(); this.teken(); this.studentHistorie(DT, sn);
    }], ["Sluiten", () => { this._histStudent = null; this.sluitModal(); }, true]]);
    m.classList.add("breed");
  },
  vernieuwModal(DT) { if (this._histStudent && this._modal?.classList.contains("breed")) this.studentHistorie(DT, this._histStudent); },
  handmatigeAfspraak(DT) {
    const K = TardyKern;
    const reden = DT.el("input", { type: "text", class: "dt-cb-veld", placeholder: "Reden (komt in de mail), bijv. je hebt je afspraak met de mentor gemist" });
    const zoek = DT.el("input", { type: "search", class: "dt-cb-veld", placeholder: "Zoek student op naam of stamnummer" });
    const hits = DT.el("div", { class: "dt-cb-hits klein" });
    zoek.addEventListener("input", () => hits.replaceChildren(...this.zoekLokaal(zoek.value).map((st) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-hit" }, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""} · ${st.stamnr}` })]);
      b.addEventListener("click", () => {
        if (K.S.meldafspraken.some((m) => m.stamnr === st.stamnr && m.status === "open")) return this.melding("Staat al op de lijst.");
        K.S.meldafspraken.push({ id: K.uid(), stamnr: st.stamnr, datum: K.volgendeSchooldag(K.vandaag()), tijd: K.S.instellingen.meldTijd, aanleiding: "handmatig", aanleidingTekst: reden.value.trim(), status: "open", gemaaktOp: K.vandaag(), gemaild: false });
        this.bewaar(); this.sluitModal(); this.teken(); this.melding(`${K.naamVan(st)} toegevoegd aan de meldlijst.`);
      });
      return b;
    })));
    this.modal("Student laten melden", [reden, zoek, hits]);
    setTimeout(() => zoek.focus(), 30);
  },

  /* ---------- mails ---------- */
  mailsMeldafspraak(DT, datum, tijd) {
    const K = TardyKern, sel = this.gekozenAfspraken();
    if (!sel.length) return this.melding("Kies eerst studenten.");
    const mails = sel.map((m) => Object.assign(this.mailVan("student-meldafspraak", m.stamnr, K.UI.periodeId, { datum, tijd, melding: m }), { meldId: m.id, naam: K.naamVan(K.S.studenten[m.stamnr]) }));
    this.mailLijst(DT, `${mails.length} meldafspraak-mails`, `${K.langDatum(datum)} om ${tijd} uur · lokaal ${K.S.instellingen.lokaal || ""}`, mails, { datum, tijd });
  },
  mailLijst(DT, titel, sub, mails, afspraak = null) {
    const K = TardyKern, zonder = mails.filter((m) => !m.aan).length;
    const vastleggen = () => {
      mails.forEach((m) => {
        if (m.meldId) { const a = K.S.meldafspraken.find((x) => x.id === m.meldId); if (a) { if (afspraak) { a.datum = afspraak.datum; a.tijd = afspraak.tijd; } a.gemaild = true; } }
        (m.stamnrs || (m.stamnr ? [m.stamnr] : [])).forEach((sn) => K.S.mails.push({ id: K.uid(), stamnr: sn, type: m.type || "student-meldafspraak", aan: m.aan, onderwerp: m.onderwerp, op: K.vandaag() }));
      });
      this.bewaar(); this.sluitModal(); this.teken(); this.melding(`${mails.length} ${mails.length === 1 ? "mail" : "mails"} vastgelegd in de dossiers.`);
    };
    const open = (m) => { const a = document.createElement("a"); a.href = `mailto:${this.adressen(m.aan)}?subject=${encodeURIComponent(m.onderwerp)}&body=${encodeURIComponent(m.body)}`; a.click(); };
    const kaarten = mails.map((m) => DT.el("div", { class: "dt-cb-mail" }, [
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("b", { text: `${m.naam || ""} → ${m.aan || "geen e-mailadres"}` }),
        this.knop(DT, "Open", () => open(m), false, "klein"), this.knop(DT, "Kopieer", () => navigator.clipboard.writeText(`${m.onderwerp}\n\n${m.body}`).then(() => this.melding("Gekopieerd.")), false, "klein")]),
      DT.el("div", { class: "dt-cb-onderwerp", text: m.onderwerp }), DT.el("pre", { text: m.body })]));
    this.modal(titel, [DT.el("p", { class: "dt-cb-zacht", text: sub }),
      zonder ? DT.el("p", { class: "dt-cb-waarschuw", text: `${zonder} ontvanger(s) zonder e-mailadres: vul het adres zelf in je mailprogramma in.` }) : null,
      DT.el("div", { class: "dt-cb-mails" }, kaarten)].filter(Boolean),
      [["Sluiten", () => this.sluitModal()], ["Alleen vastleggen", vastleggen],
       ["Alle openen in mailprogramma", () => { mails.forEach((m, i) => setTimeout(() => open(m), i * 800)); setTimeout(vastleggen, mails.length * 800 + 200); }, true]]);
  },

  /* ===================================================================================== */
  /* Signalen                                                                               */
  /* ===================================================================================== */
  /* Eén kaart per student, op de hoogste stap waar die nu staat. De zwaardere maatregel omvat de lichtere: wie
   * bij stap 4 (verzuimbureau/BBM) staat, hoort niet ook nog in stap 1 of 2. Binnen een ladder doet de kern dat
   * al (hoogsteTreden); hier gaat het ook over ladders heen. Wat er op andere ladders openstaat, staat klein
   * op dezelfde kaart en wordt met "Afgehandeld" meegenomen. */
  perStudent(lijst) {
    const per = new Map();
    for (const s of lijst) { if (!per.has(s.stamnr)) per.set(s.stamnr, []); per.get(s.stamnr).push(s); }
    return [...per.values()].map((l) => {
      l.sort((a, b) => (a.afgehandeld ? 1 : 0) - (b.afgehandeld ? 1 : 0) || b.niveau - a.niveau || b.telling - a.telling);
      return Object.assign({}, l[0], { ook: l.slice(1) });
    });
  },

  signalen(DT) {
    const K = TardyKern, h = this._scherm.hoofd, pid = K.UI.periodeId;
    const alle = this.met18(K.hoogsteTreden(K.alleSignalen(pid)));
    const zicht = this.perStudent(alle.filter((s) => this._metAfgehandeld || !s.afgehandeld));
    const open = this.perStudent(alle.filter((s) => !s.afgehandeld));
    this._sigOpen ||= new Set();
    const toggle = DT.el("label", { class: "dt-cb-schakel" }, [DT.el("input", { type: "checkbox" }), DT.el("span", { text: "Ook afgehandeld" })]);
    toggle.firstChild.checked = !!this._metAfgehandeld;
    toggle.firstChild.addEventListener("change", (e) => { this._metAfgehandeld = e.target.checked; this.teken(); });
    const ladderNaam = (id) => (K.protocolLadder(id)?.titel || id).replace(/\s+[—-]\s+per periode$/i, "");
    /* Eén regel per student: naam, stap en wat er moet gebeuren, en de knoppen. Details (andere ladders,
     * Magister-cijfers, links) klap je uit met het pijltje of een klik op de regel. */
    const rij = (s) => {
      const st = K.S.studenten[s.stamnr] || {};
      const ookOpen = s.ook.filter((x) => !x.afgehandeld);
      const omvat = s.onderliggend + s.ook.reduce((n, x) => n + 1 + (x.onderliggend || 0), 0);
      const isOpen = this._sigOpen.has(s.key);
      const klap = () => { isOpen ? this._sigOpen.delete(s.key) : this._sigOpen.add(s.key); this.teken(); };
      const pijl = DT.el("button", { type: "button", class: "dt-cb-sigpijl", "aria-expanded": String(isOpen), "aria-label": `Details van ${K.naamVan(st)}`, text: isOpen ? "▾" : "▸" });
      pijl.addEventListener("click", klap);
      const afhandelen = () => {
        let mee = K.handelAf(s.key);
        for (const x of ookOpen) mee += 1 + K.handelAf(x.key);
        this.teken();
        this.melding(mee ? `Afgehandeld, met ${mee} lichtere ${mee === 1 ? "stap" : "stappen"} die hierin ${mee === 1 ? "opgaat" : "opgaan"}.` : "Afgehandeld.");
      };
      const heropen = () => { K.zetAfh(s.key, null); this.teken(); };
      const pct = K.S.lesreg[s.stamnr]?.perioden?.[pid]?.pct;
      const wat = DT.el("div", { class: "dt-cb-sigwat" }, [
        DT.el("div", { class: "dt-cb-sigregel" }, [
          DT.el("span", { class: `dt-cb-niveau n${s.niveau}`, text: s.consequentie }),
          DT.el("span", { class: "dt-cb-sigtitel", text: s.titel }),
          s.ook.length ? DT.el("span", { class: "dt-cb-ookchip", title: s.ook.map((x) => `${ladderNaam(x.soort)}: ${x.consequentie} (${x.titel})`).join("\n"), text: `+${s.ook.length} ${s.ook.length === 1 ? "ladder" : "ladders"}` }) : null,
          pct != null ? DT.el("span", { class: "dt-cb-pct", title: "Aanwezig volgens Magister, deze periode", text: `${pct}%` }) : null,
          this.oudersMet18(st) ? DT.el("span", { class: "dt-cb-pct", title: "18+, maar de student gaf in Magister toestemming voor contact met ouders/verzorgers: de mails aan ouders gaan mee", text: "18+ · ouders ✓" }) : null,
        ].filter(Boolean)),
        DT.el("div", { class: "dt-cb-sigmaat", title: s.maatregel, text: s.maatregel }),
      ]);
      wat.addEventListener("click", klap);
      const regel = DT.el("div", { class: "dt-cb-sigrij" }, [
        pijl,
        DT.el("div", { class: "dt-cb-sigwie" }, [this.naamKnop(DT, st), DT.el("small", { text: st.klas || "" })]),
        wat,
        isOpen ? null : DT.el("div", { class: "dt-cb-sigknoppen" }, [
          this.actieKnoppen(DT, s, st, pid, undefined, true),
          s.afgehandeld ? this.ikoonKnop(DT, "heropen", "Heropen", heropen) : this.ikoonKnop(DT, "af", "Afgehandeld", afhandelen, { hoofd: true }),
        ]),
      ].filter(Boolean));
      const detail = isOpen ? DT.el("div", { class: "dt-cb-sigdetail" }, [
        DT.el("p", { text: s.maatregel }),
        DT.el("div", { class: "dt-cb-rij dt-cb-detailknoppen" }, [
          this.actieKnoppen(DT, s, st, pid),
          s.afgehandeld ? this.knop(DT, "Heropen", heropen, false, "klein") : this.knop(DT, "Afgehandeld", afhandelen, true, "klein"),
        ]),
        omvat ? DT.el("p", { class: "dt-cb-zacht", text: `Omvat ${omvat} lichtere ${omvat === 1 ? "stap" : "stappen"}; die worden met Afgehandeld meegenomen.` }) : null,
        ...s.ook.map((x) => DT.el("div", { class: `dt-cb-ookregel${x.afgehandeld ? " is-af" : ""}` }, [
          DT.el("span", { class: `dt-cb-niveau n${x.niveau}`, text: x.consequentie }),
          DT.el("div", {}, [DT.el("b", { text: `${ladderNaam(x.soort)}: ${x.titel}` }), DT.el("small", { text: x.maatregel })]),
        ])),
        this.statsRegel(DT, s.stamnr),
        DT.el("div", { class: "dt-cb-rij" }, [
          this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st), false, "klein stil"),
          this.sigMails(s).length ? this.knop(DT, "Mailteksten bekijken", async () => (this.sigMails(s).some((t) => (K.MAILSOORT[t] || {}).aan === "ouders") && await this.zorgOuders(st), this.mailLijst(DT, "Mails bij deze stap", `${K.naamVan(st)} · ${s.titel}`,
            this.sigMails(s).map((type) => Object.assign(this.mailVan(type, s.stamnr, pid), { naam: `${K.naamVan(st)} · ${(K.MAILSOORT[type] || { label: type }).label}` })))), false, "klein stil") : null,
          K.S.meldafspraken.some((m) => m.stamnr === s.stamnr) ? this.knop(DT, "Meldafspraken", () => this.studentHistorie(DT, s.stamnr), false, "klein stil") : null,
        ].filter(Boolean)),
      ].filter(Boolean)) : null;
      return DT.el("div", { class: `dt-cb-sig n${s.niveau}${s.afgehandeld ? " is-af" : ""}${isOpen ? " is-open" : ""}` }, [regel, detail].filter(Boolean));
    };
    const perNiveau = [4, 3, 2, 1].map((n) => [n, zicht.filter((s) => s.niveau === n)]).filter(([, l]) => l.length);
    h.replaceChildren(
      this.magisterKaart(DT),
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("span", { class: "dt-cb-zacht", text: `${open.length} ${open.length === 1 ? "student" : "studenten"} met een open stap in ${(K.periodeById(pid) || {}).naam || ""}` }), toggle,
        this.knop(DT, "Overzicht per mentor…", () => this.mentorOverzicht(DT)), this.knop(DT, "Protocol bekijken", () => this._scherm.bar.querySelector('[data-view="protocol"]')?.click(), false, "stil")]),
      ...(perNiveau.length ? perNiveau.map(([n, l]) => DT.el("dna-card", { class: "dt-cb-kaart dt-cb-niveaugroep" }, [
        DT.el("h2", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: `${n}` }), DT.el("span", { text: ` ${K.NIVEAUNAAM[n]} (${l.length})` })]),
        DT.el("div", { class: "dt-cb-siglijst" }, l.map(rij))]))
        : [DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Geen signalen in deze periode." }))]),
    );
  },

  /* ===================================================================================== */
  /* Verzuim uit Magister → Tardy's telling                                                 */
  /* ===================================================================================== */
  /* Per student één keer de registraties en het rooster van dit schooljaar ophalen (dezelfde bron als het
   * tabblad Inzicht en het leerlingoverzicht). Daaruit vullen we precies wat Tardy uit de Magister-exports
   * haalt, zodat de signalen van Tardy er vanzelf op werken (ook in de Tardy-app):
   *  - snapshots: per periode per student TL, ON (ongeoorloofd incl. te laat), GE, ZK, AB, UI, VR
   *  - lesreg: ziekdagen, medische afspraken en exacte klokuren ongeoorloofd
   * Plus per periode het aanwezigheidspercentage, voor de regel "Magister: …" op de kaarten. */
  MAGISTER_TITEL: "Magister · Te laat-balie",
  MEDISCH: /(dokter|huisarts|tandarts|orthodont|ziekenhuis|specialist|fysio|therapie|arts)/i,

  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },

  async apiOpnieuw(url) {
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    let r;
    for (let poging = 0; poging < 6; poging++) {
      r = await DT.api(url, { full: true, timeout: 25000 });
      if (r.status !== 429 && r.status !== 503) return r;
      await wacht(1500 * 2 ** poging);
    }
    return r;
  },

  async haalMagister(DT, stamnrs) {
    const K = TardyKern;
    if (this._haal) return this.melding("Er wordt al opgehaald.");
    if (this._kijkt) return this.melding("Je kijkt mee; ophalen kan pas als jij in Tardy werkt.", "err");
    const per = K.periodes().slice().sort((a, b) => a.start.localeCompare(b.start));
    const van = new Date(per[0].start + "T00:00:00"), nu = new Date(), vandaag = this.ymd(nu);
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const H = this._haal = { klaar: 0, totaal: stamnrs.length, fout: 0 };
    const rijen = {};   // periodeId -> { stamnr: {…} }
    const werk = stamnrs.slice();
    const doe = async () => {
      while (werk.length && this._haal === H) {
        const sn = werk.shift(), st = K.S.studenten[sn];
        try {
          let id = st.magisterId;
          if (!id) { const hit = (await this.zoekMagister(sn)).find((x) => x.stamnr === String(sn)); id = hit?.magisterId; if (id) st.magisterId = id; }
          if (!id) { H.fout++; continue; }
          const v = await this.apiOpnieuw(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${this.ymd(van)}&einde=${vandaag}`);
          const a = await this.apiOpnieuw(`/api/leerlingen/${id}/afspraken?status=actief&begin=${this.ymd(van)}&einde=${vandaag}`);
          const regs = lijst(v), rooster = lijst(a);
          if (!regs || !rooster) { H.fout++; continue; }
          /* Lessen met hun categorie via dezelfde berekening als Inzicht (vzStats) */
          const jaar = vzStats(regs, rooster, van, nu);
          const datum = (d) => this.ymd(d);
          const ziek = new Set(), med = new Set(), onUren = [];
          for (const l of jaar.lessen) {
            if (l.cat === "ZK") ziek.add(datum(l.begin));
            if (l.cat === "AB_NO") onUren.push({ datum: datum(l.begin), uren: Math.max(0.25, (l.einde - l.begin) / 3.6e6) || 1 });
          }
          for (const it of regs) {
            const af = it.afspraak || it.appointment || it, b = new Date(af.begin || af.start);
            if (isNaN(b)) continue;
            for (const r of it.verantwoordingen || it.registraties || []) {
              const code = String(r.reden?.code || r.code || "").toUpperCase(), oms = String(r.reden?.omschrijving || r.omschrijving || "");
              if (code === "D" || code === "T" || this.MEDISCH.test(oms)) med.add(datum(b));
            }
          }
          const perioden = {};
          for (const p of per) {
            const pv = new Date(p.start + "T00:00:00"), pt = new Date(Math.min(new Date(p.eind + "T23:59:59"), nu));
            if (pv > nu) continue;
            const ps = vzStats(regs, rooster, pv, pt), t = ps.totaal, c = t.per || {};
            perioden[p.id] = { pct: t.telt ? t.pct : null, telt: t.telt, afwezig: t.afwezig };
            (rijen[p.id] ||= {})[sn] = { TL: c.TL || 0, ON: (c.AB_NO || 0) + (c.TL || 0), GE: c.AB_OK || 0, ZK: c.ZK || 0, AB: (c.AB_OK || 0) + (c.AB_NO || 0), UI: c.UI || 0, VR: c.VR || 0 };
          }
          K.S.lesreg[sn] = { op: vandaag, bron: "magister", ziekDatums: [...ziek].sort(), medischDatums: [...med].sort(), onUren, perioden };
          await this.ouderMails(st, id).catch(() => {});
        } catch { H.fout++; }
        H.klaar++;
        if (this._view === "signalen" && this._scherm) this.tekenHaal();
      }
    };
    this.tekenHaal();
    await Promise.all([doe(), doe()]);
    if (this._haal !== H) return;
    /* Eén snapshot per periode met deze titel; studenten die nu niet zijn opgehaald blijven staan. */
    for (const p of per) {
      if (!rijen[p.id]) continue;
      const oud = K.S.snapshots.find((s) => s.periodeId === p.id && s.titel === this.MAGISTER_TITEL);
      K.S.snapshots = K.S.snapshots.filter((s) => !(s.periodeId === p.id && s.titel === this.MAGISTER_TITEL));
      K.S.snapshots.push({ id: K.uid(), periodeId: p.id, titel: this.MAGISTER_TITEL, van: p.start, tot: p.eind < vandaag ? p.eind : vandaag, op: vandaag, bestand: "magister",
        rijen: Object.assign({}, oud?.rijen || {}, rijen[p.id]) });
    }
    this._haal = null;
    this.bewaar();
    this.melding(`Verzuim van ${H.klaar - H.fout} ${H.klaar - H.fout === 1 ? "student" : "studenten"} uit Magister bijgewerkt${H.fout ? `, ${H.fout} niet gelukt` : ""}.`, H.fout ? "err" : "info", 7000);
    if (this._scherm) this.teken();
  },

  tekenHaal() {
    const el = this._scherm?.laag.querySelector(".dt-cb-haal"); if (!el) return;
    const H = this._haal;
    el.hidden = !H;
    if (H) { el.querySelector("span").textContent = `Verzuim uit Magister ophalen: ${H.klaar} van ${H.totaal}`; el.querySelector("i").style.width = `${Math.round(100 * H.klaar / Math.max(1, H.totaal))}%`; }
  },

  /* Kaart bovenaan Signalen: stand, bijwerken, klassen toevoegen. */
  magisterKaart(DT) {
    const K = TardyKern, studenten = Object.values(K.S.studenten).filter((st) => !st.archief);
    const met = studenten.filter((st) => K.S.lesreg[st.stamnr]?.bron === "magister");
    const laatst = met.map((st) => K.S.lesreg[st.stamnr].op).sort().pop();
    const klassen = [...new Set(studenten.map((st) => st.klas).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
    const klasSel = DT.el("select", { class: "dt-cb-veld", "aria-label": "Klas" }, [DT.el("option", { value: "", text: `Alle studenten (${studenten.length})` }), ...klassen.map((k) => DT.el("option", { value: k, text: k }))]);
    return DT.el("dna-card", { class: "dt-cb-kaart" }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [
        DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: "Verzuim uit Magister" }),
          DT.el("small", { text: met.length ? `${met.length} van ${studenten.length} studenten bijgewerkt, laatst ${K.langDatum(laatst)}. Ongeoorloofd, klokuren, ziekte en medische afspraken tellen mee in de signalen.` : "Nog niet opgehaald. Haal de registraties op om ook signalen te krijgen op ongeoorloofd verzuim, klokuren, ziekte en medische afspraken." })]),
      ]),
      DT.el("div", { class: "dt-cb-rij" }, [klasSel,
        this.knop(DT, "Bijwerken uit Magister", () => this.haalMagister(DT, studenten.filter((st) => !klasSel.value || st.klas === klasSel.value).map((st) => st.stamnr)), true),
        this.knop(DT, "Klas toevoegen uit Magister…", () => this.klasToevoegen(DT))]),
      DT.el("div", { class: "dt-cb-haal", hidden: "" }, [DT.el("span"), DT.el("b", {}, DT.el("i"))]),
    ]);
  },

  /* Studenten van een of meer klassen uit Magister in de gedeelde gegevens zetten. */
  async klasToevoegen(DT) {
    const peil = TardyKern.vandaag();
    let r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&peildatum=${peil}`, { full: true, timeout: 12000 });
    let klassen = r.status === 200 ? (r.json?.klassen || []) : [];
    if (!klassen.length) { r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&rol=Docent&peildatum=${peil}`, { full: true, timeout: 12000 }); klassen = r.status === 200 ? (r.json?.klassen || []) : []; }
    if (!klassen.length) return this.melding("Geen klassen gevonden in Magister.", "err");
    const gekozen = new Set();
    const chips = DT.el("div", { class: "dt-cb-chips" }, klassen.sort((a, b) => a.naam.localeCompare(b.naam, "nl", { numeric: true })).map((k) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-chip", "aria-pressed": "false", text: `${k.naam} (${k.aantal})` });
      b.addEventListener("click", () => { gekozen.has(k.naam) ? gekozen.delete(k.naam) : gekozen.add(k.naam); b.setAttribute("aria-pressed", String(gekozen.has(k.naam))); });
      return b;
    }));
    this.modal("Klassen toevoegen uit Magister", [DT.el("p", { class: "dt-cb-zacht", text: "De studenten komen in de gedeelde gegevens (naam, klas, stamnummer, geboortedatum, e-mail, mentor). Daarna kun je hun verzuim ophalen." }), chips],
      [["Annuleren", () => this.sluitModal()], ["Toevoegen", async () => {
        if (!gekozen.size) return;
        this.sluitModal();
        const velden = ["stamnummer", "naam", "klassen", "emailadres", "KlassenMentor1", "PersoonlijkeMentor1"].map((v) => `&velden=${v}`).join("");
        let n = 0;
        for (const klas of gekozen) {
          const z = await DT.api(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}${velden}`, { full: true, timeout: 20000 });
          for (const x of (z.status === 200 ? z.json?.items || [] : [])) {
            const m = { magisterId: x.id, stamnr: String(x.code ?? ""), roepnaam: x.roepnaam || x.voorletters || "", tussenvoegsel: x.tussenvoegsel || "", achternaam: x.achternaam || "", klas,
              email: x.emailadres || "", klasMentor: x.klassenMentor1 || "", persMentor: x.persoonlijkeMentor1 || "" };
            if (!m.stamnr) continue;
            if (!TardyKern.S.studenten[m.stamnr]) n++;
            await this.neemOver(m);
          }
        }
        this.bewaar(); this.teken(); this.melding(`${n} ${n === 1 ? "student" : "studenten"} toegevoegd.`);
      }, true]]);
  },

  /* "Magister: 87% aanwezig · 4× ongeoorloofd (6 u) · 2× te laat · 3 ziekdagen" voor deze periode. */
  statsRegel(DT, sn) {
    const K = TardyKern, ls = K.S.lesreg[sn], pid = K.UI.periodeId, p = K.periodeById(pid);
    if (!ls || ls.bron !== "magister") return null;
    const pr = ls.perioden?.[pid], snap = K.S.snapshots.find((s) => s.periodeId === pid && s.titel === this.MAGISTER_TITEL), rij = snap?.rijen?.[sn] || {};
    const inP = (d) => p && d >= p.start && d <= p.eind;
    const uren = ls.onUren.filter((u) => inP(u.datum)).reduce((s, u) => s + u.uren, 0);
    const delen = [
      pr?.pct != null ? `${pr.pct}% aanwezig` : null,
      rij.ON - (rij.TL || 0) > 0 ? `${rij.ON - (rij.TL || 0)}× ongeoorloofd (${Math.round(uren)} u)` : null,
      rij.TL ? `${rij.TL}× te laat` : null,
      ls.ziekDatums.filter(inP).length ? `${ls.ziekDatums.filter(inP).length} ${ls.ziekDatums.filter(inP).length === 1 ? "ziekdag" : "ziekdagen"}` : null,
      ls.medischDatums.filter(inP).length ? `${ls.medischDatums.filter(inP).length} medisch` : null,
    ].filter(Boolean);
    return DT.el("p", { class: "dt-cb-stats", title: `Uit Magister, bijgewerkt ${K.langDatum(ls.op)}` }, [DT.el("b", { text: "Magister " }), DT.el("span", { text: delen.join(" · ") || "geen verzuim in deze periode" })]);
  },

  /* ===================================================================================== */
  /* Afspraak in Magister: Magisters eigen formulier, ingevuld; jij klikt op Opslaan        */
  /* ===================================================================================== */
  afspraakMaken(sn, { onderwerp, tekst, datum, tijd, minuten = 15 }) {
    const K = TardyKern, st = K.S.studenten[sn];
    const d = datum || K.volgendeSchooldag(K.vandaag()), t = tijd || K.S.instellingen.meldTijd || "08:30";
    const [hh, mm] = t.split(":").map(Number), eind = new Date(2000, 0, 1, hh, mm + minuten);
    const concept = { t: Date.now(), stamnr: String(sn), naam: K.naamVan(st), onderwerp, locatie: K.S.instellingen.lokaal || "", datum: K.dmy(d),
      van: t, tot: `${String(eind.getHours()).padStart(2, "0")}:${String(eind.getMinutes()).padStart(2, "0")}`, tekst };
    try { localStorage.setItem("dt-cb-afspraak", JSON.stringify(concept)); } catch {}
    window.open(`${location.origin}/op/#/afspraak/afspraak/nieuw`, "_blank");
    this.melding("Magister opent de nieuwe afspraak in een nieuw tabblad, al ingevuld. Controleer en klik daar op Opslaan.", "info", 7000);
  },

  /* Op #/afspraak/afspraak/nieuw: het concept invullen zoals een gebruiker dat zou doen. */
  async vulAfspraak() {
    if (this._vult || !/^#\/afspraak\/afspraak\/nieuw/.test(location.hash)) return;
    let c = null; try { c = JSON.parse(localStorage.getItem("dt-cb-afspraak") || "null"); } catch {}
    if (!c || Date.now() - c.t > 3 * 60000) return;
    const onderwerp = document.getElementById("onderwerp"); if (!onderwerp) return;
    this._vult = true;
    try { localStorage.removeItem("dt-cb-afspraak"); } catch {}
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    const zet = (el, v) => { if (!el) return; el.focus(); el.value = v; for (const t of ["input", "change", "blur"]) el.dispatchEvent(new Event(t, { bubbles: true })); };
    const hoofd = document.querySelector("ui-view[name=main]");
    /* Deelnemer: zoeken op stamnummer (anders op naam) en de juiste uit de lijst kiezen. */
    const zoek = document.getElementById("search-field");
    let gevonden = false;
    for (const q of [c.stamnr, c.naam]) {
      if (!zoek || gevonden) break;
      zet(zoek, q); zoek.focus();
      for (let i = 0; i < 25 && !hoofd.querySelector("li.item.person"); i++) await wacht(200);
      const items = [...hoofd.querySelectorAll("li.item.person")];
      const doel = items.find((li) => li.textContent.includes(c.stamnr)) || (items.length === 1 ? items[0] : null);
      if (!doel) continue;
      for (let i = 0; i < 12 && !doel.classList.contains("selected"); i++) { zoek.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, which: 40, bubbles: true })); await wacht(80); }
      for (const t of ["keydown", "keyup"]) zoek.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      gevonden = true; await wacht(300);
    }
    zet(onderwerp, c.onderwerp); zet(document.getElementById("locatie"), c.locatie);
    zet(document.getElementById("Startdatum"), c.datum); zet(document.getElementById("Einddatum"), c.datum);
    const tijden = [...hoofd.querySelectorAll("input.time-input")];
    zet(tijden[0], c.van); zet(tijden[1], c.tot);
    const ed = hoofd.querySelector(".ta-bind[contenteditable=true]");
    if (ed && c.tekst) {
      ed.focus();
      ed.innerHTML = c.tekst.split("\n").map((r) => `<p>${TardyKern.esc(r) || "<br>"}</p>`).join("");
      for (const t of ["input", "keyup", "blur"]) ed.dispatchEvent(new Event(t, { bubbles: true }));
    }
    const titel = hoofd.querySelector("h1, h2");
    const melding = DT.el("div", { class: "dt-cb-vars dt-cb-afspraakmelding" }, [DT.el("b", { text: "Ingevuld door de Te laat-balie." }),
      DT.el("span", { text: gevonden ? ` ${c.naam} staat bij de deelnemers. Controleer datum, tijd en tekst en klik op Opslaan.` : ` ${c.naam} is niet automatisch gevonden: voeg de student zelf toe bij Deelnemers en klik daarna op Opslaan.` })]);
    (titel?.parentElement || hoofd).insertBefore(melding, titel?.nextSibling || hoofd.firstChild);
    this.css();
    this._vult = false;
  },

  /* ===================================================================================== */
  /* Drie acties per signaal: notitie in het dossier, mail, afspraak — afgevinkt na gebruik  */
  /* ===================================================================================== */
  /* Wat er per signaal al gedaan is staat in de gedeelde gegevens (S.cbActies[signaalsleutel]), zodat een
   * collega en de Tardy-app het ook zien. Opslaan in Magister doe je zelf in Magisters eigen formulier. */
  actieGedaan(key, soort) {
    const S = TardyKern.S;
    (S.cbActies ||= {})[key] = Object.assign({}, S.cbActies[key], { [soort]: new Date().toISOString() });
    this.bewaar();
  },

  /* Kleine iconknop voor de ingeklapte signaalregel; de naam staat in de tooltip en voor schermlezers. */
  IKOON: {
    notitie: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    afspraak: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    af: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    heropen: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/>',
  },
  ikoonKnop(DT, soort, label, fn, { gedaan = false, uit = false, hoofd = false } = {}) {
    const b = DT.el("button", { type: "button", class: `dt-cb-ikoon${gedaan ? " is-gedaan" : ""}${hoofd ? " is-hoofd" : ""}`, title: label, "aria-label": label });
    b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${this.IKOON[soort]}</svg>${gedaan ? '<span class="dt-cb-vink" aria-hidden="true">✓</span>' : ""}`;
    if (uit) b.disabled = true;
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
  },

  actieTerug(key, soort) {
    const S = TardyKern.S, a = (S.cbActies || {})[key];
    if (!a) return;
    delete a[soort]; if (!Object.keys(a).length) delete S.cbActies[key];
    this.bewaar();
  },

  /* Notitie, mail en afspraak. Na een klik staat er een vinkje; met ↺ zet je hem terug op open (bijv. als je
   * de notitie in Magister hebt geannuleerd). kort = compacte knoppen voor de signaallijst. */
  actieKnoppen(DT, s, st, pid, naKlik = () => this.teken(), kort = false) {
    const K = TardyKern, gedaan = (K.S.cbActies || {})[s.key] || {};
    const mails = this.sigMails(s);
    const ontvangers = [...new Set(mails.map((t) => ({ student: "student", ouders: "ouders", mentor: "mentor", bureau: "verzuimbureau" })[(K.MAILSOORT[t] || {}).aan] || "mentor"))];
    const vars = this.signaalVars(DT, s, st, pid);
    const knop = (soort, label, uitleg, klaarLabel, fn, uit = false) => {
      const wanneer = gedaan[soort] ? new Date(gedaan[soort]) : null;
      const moment = wanneer ? `${wanneer.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} om ${wanneer.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "";
      if (kort) return this.ikoonKnop(DT, soort, wanneer ? `${klaarLabel} op ${moment}. Klik om het opnieuw te doen; klap de regel uit om terug te zetten.` : `${label}: ${uitleg}`,
        () => { fn(); this.actieGedaan(s.key, soort); naKlik(); }, { gedaan: !!wanneer, uit });
      const b = this.knop(DT, wanneer ? `✓ ${klaarLabel}` : label, () => { fn(); this.actieGedaan(s.key, soort); naKlik(); }, false, `klein${wanneer ? " stil" : ""}`);
      b.classList.add("dt-cb-actie"); if (wanneer) b.classList.add("is-gedaan");
      b.title = wanneer ? `${klaarLabel} op ${wanneer.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} om ${wanneer.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}. Klik om het opnieuw te doen.` : uitleg;
      if (uit) b.setAttribute("disabled", "");
      if (!wanneer) return b;
      const terug = DT.el("button", { type: "button", class: "dt-cb-terug", text: "↺", title: `Terugzetten naar open (bijvoorbeeld als je het in Magister of Outlook hebt geannuleerd)`, "aria-label": `${klaarLabel} terugzetten naar open` });
      terug.addEventListener("click", (e) => { e.stopPropagation(); this.actieTerug(s.key, soort); naKlik(); });
      return DT.el("span", { class: "dt-cb-actiegroep" }, [b, terug]);
    };
    return DT.el("div", { class: kort ? "dt-cb-acties-in" : "dt-cb-acties3" }, [
      knop("notitie", "Notitie in dossier", "Notitie in het dossier (logboek) in Magister", "Notitie", () => {
        const t = this.eigenTekst("notitie", vars);
        this.notitieMaken(s.stamnr, { omschrijving: t.onderwerp, tekst: t.body });
      }),
      knop("mail", mails.length ? `Mail ${ontvangers.join(", ")}` : "Geen mail", mails.length ? `Concept in je mailprogramma${this.oudersMet18(st) ? " (18+, met toestemming voor contact met ouders)" : ""}` : "Bij deze stap hoort geen mail", "Mail", () => this.mailsDirect(s, pid), !mails.length),
      knop("afspraak", "Afspraak in Magister", "Afspraak met de student in Magister", "Afspraak", () => {
        const t = this.eigenTekst("afspraak", vars);
        this.afspraakMaken(s.stamnr, { onderwerp: t.onderwerp, tekst: t.body, minuten: s.niveau >= 3 ? 30 : 15 });
      }),
    ]);
  },

  /* 18+ met toestemming voor contact met ouders (uit Magister). */
  oudersMet18(st) { return !!st && st.ouderToestemming === true && TardyKern.minderjarig(st) === false; },
  /* Signalen van 18+-studenten met toestemming voor contact met ouders: de maatregel zoals voor minderjarigen
   * (met ouders informeren) in plaats van de 18+-tekst, en de mails van de trede volledig. */
  met18(lijst) {
    const K = TardyKern;
    return lijst.map((s) => {
      if (!this.oudersMet18(K.S.studenten[s.stamnr])) return s;
      const tr = this.tredeVan(s);
      if (!tr) return s;
      const maatregel = K.vulIn(tr.maatregel) + (tr.bijMeer && s.telling > tr.vanaf ? K.vulIn(tr.bijMeer) : "");
      return Object.assign({}, s, { maatregel, mails: this.sigMails(s) });
    });
  },
  tredeVan(s) { return (TardyKern.protocolLadder(s.soort)?.treden || []).find((x) => x.vanaf === s.drempel && x.niveau === s.niveau && x.label === s.consequentie) || null; },
  /* De mails van een signaal. De kern laat mails aan ouders weg bij 18+; heeft de student in Magister
   * toestemming gegeven voor contact met ouders, dan nemen we de mails van de trede weer volledig mee. */
  sigMails(s) {
    const K = TardyKern, st = K.S.studenten[s.stamnr];
    if (!this.oudersMet18(st)) return s.mails;
    const tr = this.tredeVan(s);
    return tr ? [...new Set([...(tr.mails || []), ...s.mails])] : s.mails;
  },
  /* Meerdere adressen (ouders) in één mailto: elk adres apart gecodeerd, gescheiden door komma's. */
  adressen(aan) { return String(aan || "").split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean).map(encodeURIComponent).join(","); },

  /* E-mailadressen van ouders/verzorgers uit Magister (Basisgegevens › Ouders/verzorgers): de ouders van de
   * leerling en per ouder de contactgegevens van het type "emailadres". Bewaard als st.ouderEmail, het veld
   * dat Tardy ook gebruikt voor mails aan ouders. Alleen voor minderjarigen of als de student nog geen
   * leeftijd heeft; bij 18+ vallen de mails aan ouders volgens het protocol weg. */
  async ouderMails(st, id = null) {
    const K = TardyKern;
    id ||= st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; if (id) st.magisterId = id; }
    if (!id) return null;
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    if (!st.geboortedatum) {
      const p = await this.apiOpnieuw(`/api/leerlingen/${encodeURIComponent(id)}/personalia`);
      const d = p?.status === 200 ? String(p.json?.geboortedatum || "").slice(0, 10) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) st.geboortedatum = d;
    }
    const ouders = lijst(await this.apiOpnieuw(`/api/leerlingen/${encodeURIComponent(id)}/ouders`));
    if (!ouders) return null;
    /* Bij 18+ alleen ouders/verzorgers waarvoor de student toestemming gaf (in Magister per ouder:
     * heeftToestemming). Bij minderjarigen staat die altijd aan. */
    const volw = K.minderjarig(st) === false;
    const mag = ouders.filter((o) => !volw || o.heeftToestemming === true);
    if (volw) st.ouderToestemming = mag.length > 0; else delete st.ouderToestemming;
    const adressen = [];
    for (const o of mag.slice().sort((a, b) => (a.volgnummer || 9) - (b.volgnummer || 9))) {
      const c = lijst(await this.apiOpnieuw(`/api/ouders/${encodeURIComponent(o.id)}/contactgegevens`)) || [];
      for (const x of c) {
        const mail = String(x.emailadres || "").trim();
        if (x.type === "emailadres" && /@/.test(mail) && !adressen.some((a) => a.toLowerCase() === mail.toLowerCase())) adressen.push(mail);
      }
    }
    st.ouderEmailOp = K.vandaag();
    if (adressen.length) { st.ouderEmail = adressen.join(", "); st.ouderEmailBron = "magister"; }
    else if (st.ouderEmailBron === "magister") delete st.ouderEmail;   // toestemming ingetrokken of adres weg
    this.bewaar();
    return adressen;
  },
  /* Vlak voor een mail aan ouders: adres ophalen als het er nog niet is (of ouder is dan een week). */
  async zorgOuders(st) {
    const K = TardyKern;
    if (!st || (st.ouderEmail && st.ouderEmailOp && st.ouderEmailOp >= K.plusDagen(K.vandaag(), -7))) return;
    if (st.ouderEmail && !st.ouderEmailOp) return;   // met de hand of uit een Tardy-import: laten staan
    if (!st.ouderEmail && st.ouderEmailOp === K.vandaag()) return;   // vandaag al gezocht, niets gevonden
    this.melding("E-mailadres van ouders/verzorgers ophalen uit Magister…");
    try {
      const r = await this.ouderMails(st);
      if (r && !r.length) this.melding("In Magister staat geen e-mailadres van ouders/verzorgers.", "err");
    } catch { this.melding("Ophalen van het adres van ouders/verzorgers lukte niet.", "err"); }
  },

  /* Alle mails van deze trede als concept in het eigen mailprogramma (Outlook), en vastleggen in het dossier. */
  async mailsDirect(s, pid) {
    const K = TardyKern, st = K.S.studenten[s.stamnr];
    const soorten = this.sigMails(s);
    if (soorten.some((t) => (K.MAILSOORT[t] || {}).aan === "ouders")) await this.zorgOuders(st);
    const mails = soorten.map((type) => this.mailVan(type, s.stamnr, pid));
    mails.forEach((m, i) => setTimeout(() => {
      const a = document.createElement("a");
      a.href = `mailto:${this.adressen(m.aan)}?subject=${encodeURIComponent(m.onderwerp)}&body=${encodeURIComponent(m.body)}`;
      a.click();
    }, i * 900));
    mails.forEach((m) => K.S.mails.push({ id: K.uid(), stamnr: s.stamnr, type: m.type, aan: m.aan, onderwerp: m.onderwerp, op: K.vandaag() }));
    const zonder = mails.filter((m) => !m.aan).length;
    this.melding(`${mails.length} ${mails.length === 1 ? "mail staat" : "mails staan"} klaar in je mailprogramma${zonder ? `; bij ${zonder} ontbreekt het adres` : ""}.`, zonder ? "err" : "info", 7000);
  },

  /* Notitie: het logboek van de student openen in een nieuw tabblad; daar kiest de balie Toevoegen › Notitie
   * en vult omschrijving en inhoud in. Jij loopt de stappen na en klikt op Opslaan. */
  async notitieMaken(sn, { omschrijving, tekst, type = "Notitie" }) {
    const K = TardyKern, st = K.S.studenten[sn];
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(sn)).find((x) => x.stamnr === String(sn)); id = hit?.magisterId; if (id) { st.magisterId = id; this.bewaar(); } }
    if (!id) return this.melding("Deze student is niet in Magister gevonden.", "err");
    const pid = await this.persoonId();
    try { localStorage.setItem("dt-cb-notitie", JSON.stringify({ t: Date.now(), magisterId: String(id), naam: K.naamVan(st), omschrijving, tekst, type })); } catch {}
    const binnen = encodeURIComponent(encodeURIComponent(`/begeleiding-page/leerling/${id}/Alle%20rollen/${pid || ""}/logboek`));
    window.open(`${location.origin}/op/#/begeleiding/Alle%20rollen/leerling/${id}/////?innerUrl=${binnen}`, "_blank");
    this.melding("Het logboek van de student opent in een nieuw tabblad met de notitie al ingevuld. Loop de stappen na en klik op Opslaan.", "info", 7000);
  },

  /* In het logboek-frame (magister-lvs): Toevoegen › Notitie kiezen en het formulier invullen. */
  async vulNotitie() {
    if (this._vultN) return;
    let c = null; try { c = JSON.parse(localStorage.getItem("dt-cb-notitie") || "null"); } catch {}
    if (!c || Date.now() - c.t > 3 * 60000) return;
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = location.hash;
    if (!c.gekozen && new RegExp(`^#/overview/${c.magisterId}\\b`).test(h)) {
      const knop = [...document.querySelectorAll("dna-button")].find((b) => /Toevoegen/.test(b.textContent));
      if (!knop) return;
      this._vultN = true;
      knop.click();
      let item = null;
      for (let i = 0; i < 20 && !item; i++) {
        await wacht(150);
        item = [...document.querySelectorAll("dna-menu-item")].find((m) => new RegExp(`(^|\\s)${c.type}$`, "i").test(m.textContent.trim()));
      }
      if (item) { c.gekozen = true; try { localStorage.setItem("dt-cb-notitie", JSON.stringify(c)); } catch {} item.click(); }
      this._vultN = false;
      return;
    }
    if (c.gekozen && /^#\/create\//.test(h)) {
      const veld = document.querySelector("input[formcontrolname=omschrijving]");
      const ed = document.querySelector(".ProseMirror[contenteditable=true]");
      if (!veld || !ed) return;
      this._vultN = true;
      try { localStorage.removeItem("dt-cb-notitie"); } catch {}
      veld.focus(); veld.value = c.omschrijving;
      for (const t of ["input", "change", "blur"]) veld.dispatchEvent(new Event(t, { bubbles: true }));
      ed.focus();
      c.tekst.split("\n").forEach((regel, i) => {
        if (i) document.execCommand("insertParagraph");
        if (regel) document.execCommand("insertText", false, regel);
      });
      const melding = DT.el("div", { style: "margin:0 0 12px;padding:10px 14px;border-radius:4px;background:#ddeffe;border-left:4px solid #056dc2;font:14px/20px open-sans,sans-serif;color:#233243" },
        [DT.el("b", { text: "Ingevuld door de Te laat-balie. " }), DT.el("span", { text: `Notitie voor ${c.naam}: controleer de tekst, loop de stappen na met Volgende en klik op Opslaan.` })]);
      const form = veld.closest("form") || veld.closest("dna-card") || document.body;
      form.parentElement?.insertBefore(melding, form);
      this._vultN = false;
    }
  },

  /* Zoals "Overzicht per mentor" in Tardy: één mail per mentor met alle studenten waar actie nodig is. */
  mentorOverzicht(DT) {
    const K = TardyKern, pid = K.UI.periodeId, p = K.periodeById(pid), groepen = {};
    Object.values(K.S.studenten).filter((st) => !st.archief).forEach((st) => {
      const t = K.tellingen(st.stamnr, pid), alle = this.met18(K.signalenVoor(st.stamnr, pid)), sig = alle.filter((x) => !x.afgehandeld);
      if (!alle.length) return;
      const m = K.mentorVan(st), k = K.mentorSleutel(st) || "zonder-mentor";
      (groepen[k] ||= { mentor: m, regels: [] }).regels.push({ st, t, sig, reeks: K.langsteReeks(t.ziekDatums).lengte });
    });
    const mails = Object.values(groepen).map((g) => {
      const mnaam = g.mentor.naam || "collega";
      g.regels.sort((a, b) => (b.sig[0]?.niveau || 0) - (a.sig[0]?.niveau || 0) || b.t.teLaat - a.t.teLaat);
      const lijnen = g.regels.map((r) => {
        const d = [];
        if (r.t.teLaat) d.push(`${r.t.teLaat}× te laat`);
        if (r.t.nietGemeld) d.push(`${r.t.nietGemeld}× niet gemeld bij de CB’er`);
        if (r.t.ongeoorloofd) d.push(`${r.t.ongeoorloofd}× ongeoorloofd`);
        if (r.reeks > 1) d.push(`${r.reeks} schooldagen aaneen ziek`);
        if (r.t.medDatums.length) d.push(`${r.t.medDatums.length} medische afspraken onder lestijd`);
        const zw = r.sig.slice().sort((a, b) => b.niveau - a.niveau)[0];
        return `• ${K.naamVan(r.st)} (${r.st.klas || "—"}) — ${d.join(", ") || "aandachtspunt"}${zw ? `\n  Wat er van jou wordt verwacht: ${zw.maatregel}` : ""}`;
      }).join("\n");
      const per = p ? p.naam.toLowerCase() : "deze periode";
      return { aan: g.mentor.email || "", type: "mentor-overzicht", naam: `${mnaam} (${g.regels.length})`, stamnrs: g.regels.map((r) => r.st.stamnr),
        onderwerp: `Verzuimoverzicht ${per} — ${g.regels.length} student(en)`,
        body: `Hoi ${mnaam},\n\nHierbij het verzuimoverzicht van ${per}. Bij ${g.regels.length === 1 ? "één student" : `${g.regels.length} studenten`} waarvan jij mentor bent is actie nodig:\n\n${lijnen}\n\nDe volledige registratie staat in Magister. Loop gerust even binnen in lokaal ${K.S.instellingen.lokaal || ""} als je ergens over wilt sparren.\n\n${K.ondertekening()}` };
    }).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!mails.length) return this.melding("Er is op dit moment niets te melden aan mentoren.");
    this.mailLijst(DT, `Overzicht voor ${mails.length} mentor(en)`, `${p ? p.naam : ""} · ${mails.reduce((n, m) => n + m.stamnrs.length, 0)} studenten`, mails);
  },

  /* ===================================================================================== */
  /* Protocol: lezen en aanpassen (zelfde gegevens als de Protocolpagina in Tardy)           */
  /* ===================================================================================== */
  /* Het protocol staat in de gedeelde gegevens (S.instellingen.protocol); zonder eigen versie geldt de standaard
   * uit Tardy. Wijzigingen gelden meteen voor de signalen, hier én in de Tardy-app. Alleen teksten en getallen:
   * wat er geteld kan worden ligt vast in de kern (TELLERS). */
  protBewerkbaar() {
    const K = TardyKern, i = K.S.instellingen;
    if (!i.protocol) i.protocol = JSON.parse(JSON.stringify(K.PROTOCOL_STANDAARD));
    return i.protocol;
  },
  protIsStandaard() { const p = TardyKern.S.instellingen.protocol; return !p || JSON.stringify(p) === JSON.stringify(TardyKern.PROTOCOL_STANDAARD); },
  protTekst(DT, t) {   // {meldtijd} invullen, **vet** als <b>, verder platte tekst
    const delen = String(TardyKern.vulIn(t || "")).split(/\*\*(.+?)\*\*/g);
    return delen.map((d, i) => (i % 2 ? DT.el("b", { text: d }) : document.createTextNode(d)));
  },
  protLabel(l, tr) { const K = TardyKern, tel = K.TELLERS[K.tredeTeller(l, tr)]; return tel ? tel.label(tr.vanaf, tr.vergelijking) : String(tr.vanaf); },
  protMeter(DT, n) { return DT.el("span", { class: `dt-cb-meter m${n}` }, [1, 2, 3, 4].map(() => DT.el("i"))); },

  protocol(DT) {
    const K = TardyKern, h = this._scherm.hoofd, P = K.protocol(), bewerk = !!this._protBewerk, eigen = !this.protIsStandaard();
    const balk = DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("div", { class: "dt-cb-rij" }, [
      DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: P.naam || "Verzuimprotocol" }),
        DT.el("small", { text: bewerk ? "Aanpassen · elke wijziging wordt meteen bewaard in de gedeelde map en geldt ook in de Tardy-app" : eigen ? "Aangepast door de school" : "Standaardprotocol uit Tardy" })]),
      DT.el("span", { style: "flex:1" }),
      bewerk && eigen ? this.knop(DT, "Standaard terugzetten", () => {
        if (!confirm(`Het protocol terugzetten naar de standaard (${K.PROTOCOL_STANDAARD.naam})? Jullie eigen aanpassingen verdwijnen.`)) return;
        delete K.S.instellingen.protocol; this._protOpen = null; this.bewaar(); this.teken(); this.melding("Standaardprotocol teruggezet.");
      }, false, "stil") : null,
      bewerk ? this.knop(DT, "Klaar", () => { this._protBewerk = false; this._protOpen = null; this.teken(); this.melding("Protocol bewaard. Signalen volgen het nu."); }, true)
        : this.knop(DT, "Aanpassen", () => {
          if (this._kijkt) return this.melding("Een collega werkt nu in Tardy; aanpassen kan zodra die klaar is.", "err");
          this._protBewerk = true; this._protOpen = null; this.teken();
        }),
    ].filter(Boolean))]);
    h.replaceChildren(balk, ...(bewerk ? this.protEditor(DT) : this.protLezen(DT, P)));
  },

  protLezen(DT, P) {
    const stap = (n, niv, kop, label, tekst, tekst18) => DT.el("div", { class: `dt-cb-stap s${niv}` }, [
      DT.el("span", { class: `dt-cb-stapn${niv ? ` dt-cb-niveau n${niv}` : ""}`, text: n }),
      DT.el("div", {}, [DT.el("b", {}, this.protTekst(DT, kop)),
        DT.el("p", {}, [label ? DT.el("span", { class: "dt-cb-zacht", text: `${label}. ` }) : null, ...this.protTekst(DT, tekst)].filter(Boolean)),
        tekst18 ? DT.el("p", { class: "dt-cb-zacht" }, [DT.el("b", { text: "18+: " }), ...this.protTekst(DT, tekst18)]) : null].filter(Boolean)),
    ]);
    const w = P.werkwijze || { regels: [] };
    return [
      (w.regels || []).length ? DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: w.titel || "Werkwijze" }),
        DT.el("ol", { class: "dt-cb-proc" }, w.regels.map((r) => DT.el("li", {}, this.protTekst(DT, r))))]) : null,
      ...P.ladders.map((l) => DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: l.titel }),
        l.intro ? DT.el("p", { class: "dt-cb-zacht" }, this.protTekst(DT, l.intro)) : null,
        DT.el("div", { class: "dt-cb-ladder" }, [
          l.elkeKeer && l.elkeKeer.opPagina ? stap("Elke keer", 0, l.elkeKeer.kort || "", null, l.elkeKeer.maatregel, l.elkeKeer.maatregel18) : null,
          ...(l.treden || []).map((tr) => stap(this.protLabel(l, tr), tr.niveau, tr.kort || tr.label, tr.label, tr.maatregel, tr.maatregel18)),
        ].filter(Boolean))].filter(Boolean))),
      ...(P.extra || []).map((x) => DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: x.titel }), DT.el("p", {}, this.protTekst(DT, x.tekst))])),
    ].filter(Boolean);
  },

  protEditor(DT) {
    const K = TardyKern, P = this.protBewerkbaar();
    const bewaar = (opnieuw = false) => { this.bewaar(); if (opnieuw) this.teken(); };
    const invoer = (label, waarde, zet, { hint = "", rijen = 0, ph = "", type = "text", opnieuw = false } = {}) => {
      const inp = rijen ? DT.el("textarea", { class: "dt-cb-veld dt-cb-tekstvak", rows: String(rijen), placeholder: ph }) : DT.el("input", { type, class: "dt-cb-veld", placeholder: ph, ...(type === "number" ? { min: "1", step: "1" } : {}) });
      inp.value = waarde ?? "";
      inp.addEventListener(rijen || type === "text" ? "input" : "change", () => { zet(inp.value); bewaar(false); });
      if (opnieuw) inp.addEventListener("change", () => this.teken());
      return DT.el("label", { class: "dt-cb-protveld" }, [DT.el("span", {}, [label, hint ? DT.el("small", { class: "dt-cb-zacht", text: ` · ${hint}` }) : null].filter(Boolean)), inp]);
    };
    const keuze = (label, opties, waarde, zet) => {
      const sel = DT.el("select", { class: "dt-cb-veld" }, opties.map(([v, t]) => DT.el("option", { value: String(v), text: t })));
      sel.value = String(waarde); sel.addEventListener("change", () => { zet(sel.value); bewaar(true); });
      return DT.el("label", { class: "dt-cb-protveld" }, [DT.el("span", { text: label }), sel]);
    };
    const vink = (label, aan, zet) => {
      const c = DT.el("input", { type: "checkbox" }); c.checked = !!aan;
      c.addEventListener("change", () => { zet(c.checked); bewaar(true); });
      return DT.el("label", { class: "dt-cb-schakel" }, [c, DT.el("span", { text: label })]);
    };
    const vlag = (doel, veld) => (v) => { if (v) doel[veld] = true; else delete doel[veld]; };
    const leegWeg = (doel, veld) => (v) => { if (String(v).trim()) doel[veld] = v; else delete doel[veld]; };
    const niveauOpties = [1, 2, 3, 4].map((k) => [k, `${k} · ${K.NIVEAUNAAM[k]}`]);
    const tellerOpties = Object.keys(K.TELLERS).map((k) => [k, K.TELLERS[k].naam]);
    const mailNaam = (m) => {
      const label = (K.MAILSOORT[m] || { label: m }).label;
      if (Object.keys(K.MAILSOORT).filter((k) => K.MAILSOORT[k].label === label).length < 2) return label;
      const deel = { telaat: "te laat", nietgemeld: "niet gemeld", ongeoorloofd: "ongeoorloofd", verbeterafspraken: "algemeen" }[m.split("-").slice(1).join("-")];
      return label + (deel ? ` (${deel})` : "");
    };
    const sorteer = (l, tr, li) => {   // treden op volgorde: eerst de eigen telling van de ladder, dan per telling oplopend
      const volgorde = []; l.treden.forEach((x) => { const k = K.tredeTeller(l, x); if (!volgorde.includes(k)) volgorde.push(k); });
      l.treden.sort((a, b) => (volgorde.indexOf(K.tredeTeller(l, a)) - volgorde.indexOf(K.tredeTeller(l, b))) || a.vanaf - b.vanaf);
      this._protOpen = `${li}:${l.treden.indexOf(tr)}`;
    };
    const tredeForm = (l, li, tr, ti) => {
      const eigenTeller = K.tredeTeller(l, tr);
      const dubbel = l.treden.some((x, xi) => xi !== ti && x.vanaf === tr.vanaf && K.tredeTeller(l, x) === eigenTeller);
      const getal = invoer("Aantal", tr.vanaf, (v) => { tr.vanaf = Math.max(1, parseInt(v, 10) || 1); }, { type: "number" });
      getal.querySelector("input").addEventListener("change", () => { sorteer(l, tr, li); bewaar(true); });
      return DT.el("div", { class: "dt-cb-protform" }, [
        dubbel ? DT.el("p", { class: "dt-cb-waarschuw", text: "Twee treden met dezelfde drempel en dezelfde telling. Kies een ander getal, anders lopen hun signalen door elkaar." }) : null,
        DT.el("div", { class: "dt-cb-protrij" }, [
          keuze("Telt", tellerOpties, eigenTeller, (v) => { if (v === l.teller) delete tr.teller; else tr.teller = v; sorteer(l, tr, li); }),
          keuze("Wanneer", [[">=", "vanaf"], [">", "meer dan"]], tr.vergelijking || ">=", (v) => { if (v === ">") tr.vergelijking = ">"; else delete tr.vergelijking; }),
          getal,
          keuze("Niveau", niveauOpties, tr.niveau, (v) => { tr.niveau = Math.min(4, Math.max(1, parseInt(v, 10) || 1)); }),
        ]),
        invoer("Kop (op de protocolpagina)", tr.kort, (v) => { tr.kort = v; }, { ph: "bijv. Volgende schooldag {meldtijd} melden bij CB'er" }),
        invoer("Naam van de maatregel", tr.label, (v) => { tr.label = v; }, { ph: "bijv. Registratie waarschuwing" }),
        invoer("Wat er moet gebeuren", tr.maatregel, (v) => { tr.maatregel = v; }, { rijen: 3, hint: "zie je bij Signalen, in de notitie en na het melden" }),
        invoer("Anders voor 18+", tr.maatregel18, leegWeg(tr, "maatregel18"), { rijen: 2, hint: "leeg laten als het hetzelfde is" }),
        tr.doorlopend ? invoer("Extra zin vanaf de volgende keer", tr.bijMeer, leegWeg(tr, "bijMeer"), { ph: "bijv. Elke volgende keer vraagt opnieuw om een melding." }) : null,
        DT.el("div", { class: "dt-cb-protsub", text: "Mails bij deze trede (mails aan ouders vervallen vanzelf bij 18+)" }),
        DT.el("div", { class: "dt-cb-protvinkjes" }, Object.keys(K.MAILSOORT).filter((m) => m !== "mentor-overzicht").map((m) =>
          vink(mailNaam(m), (tr.mails || []).includes(m), (aan) => { tr.mails = (tr.mails || []).filter((x) => x !== m); if (aan) tr.mails.push(m); }))),
        DT.el("div", { class: "dt-cb-protsub", text: "Verder" }),
        DT.el("div", { class: "dt-cb-protvinkjes" }, [
          l.teller === eigenTeller && ["telaat", "ongeoorloofd", "calamiteit"].includes(l.teller) ? vink("Meldafspraak maken bij het melden", tr.meldafspraak, vlag(tr, "meldafspraak")) : null,
          vink("Elke volgende keer een nieuw signaal", tr.doorlopend, vlag(tr, "doorlopend")),
          vink("Alleen voor studenten jonger dan 18", tr.alleenMinderjarig, vlag(tr, "alleenMinderjarig")),
        ].filter(Boolean)),
        DT.el("div", { class: "dt-cb-rij eind" }, this.knop(DT, "Trede verwijderen", () => {
          if (!confirm(`Trede “${tr.kort || tr.label || this.protLabel(l, tr)}” verwijderen?`)) return;
          l.treden.splice(ti, 1); this._protOpen = null; bewaar(true);
        }, false, "klein stil")),
      ].filter(Boolean));
    };
    const rij = (l, li, sleutel, n, niv, naam, sub, form) => {
      const open = this._protOpen === `${li}:${sleutel}`;
      const kop = DT.el("button", { type: "button", class: "dt-cb-protkop", "aria-expanded": String(open) }, [
        DT.el("span", { class: `dt-cb-stapn${niv ? ` dt-cb-niveau n${niv}` : ""}`, text: n }), this.protMeter(DT, niv),
        DT.el("span", { class: "dt-cb-protnaam" }, [DT.el("b", {}, this.protTekst(DT, naam)), DT.el("small", { text: sub })]),
        DT.el("span", { class: "dt-cb-pijl", text: open ? "▴" : "▾" }),
      ]);
      kop.addEventListener("click", () => { this._protOpen = open ? null : `${li}:${sleutel}`; this.teken(); });
      return DT.el("div", { class: `dt-cb-trede${open ? " open" : ""}` }, [kop, open ? form() : null].filter(Boolean));
    };
    const w = P.werkwijze || (P.werkwijze = { titel: "", regels: [] });
    return [
      DT.el("p", { class: "dt-cb-zacht", text: "Wijzigingen gelden meteen voor alle studenten. Verander je een drempel, dan kan een signaal dat al was afgehandeld opnieuw verschijnen. In teksten kun je {meldtijd} gebruiken (de meldtijd uit Instellingen); **woord** wordt vet." }),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Algemeen" }),
        invoer("Naam van het protocol", P.naam, (v) => { P.naam = v; }),
        DT.el("div", { class: "dt-cb-protsub", text: "Namen van de vier niveaus" }),
        DT.el("div", { class: "dt-cb-protrij" }, [1, 2, 3, 4].map((k) => invoer(`Niveau ${k}`, K.NIVEAUNAAM[k], (v) => { (P.niveaus ||= {})[k] = v.trim() || K.NIVEAU_STANDAARD[k]; })))]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: w.titel || "Werkwijze" }),
        invoer("Titel", w.titel, (v) => { w.titel = v; }),
        invoer("Stappen", (w.regels || []).join("\n"), (v) => { w.regels = v.split("\n").map((x) => x.trim()).filter(Boolean); }, { rijen: Math.max(4, (w.regels || []).length + 1), hint: "één stap per regel" })]),
      ...P.ladders.map((l, li) => DT.el("dna-card", { class: "dt-cb-kaart" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("h2", { text: l.titel }), DT.el("small", { class: "dt-cb-zacht", text: `telt ${(K.TELLERS[l.teller] || { naam: l.teller }).naam}` })]),
        invoer("Titel", l.titel, (v) => { l.titel = v; }),
        invoer("Toelichting", l.intro, (v) => { l.intro = v; }, { rijen: 2, hint: "optioneel" }),
        DT.el("div", { class: "dt-cb-treden" }, [
          l.elkeKeer ? rij(l, li, "e", "Elke keer", 0, l.elkeKeer.kort || l.elkeKeer.maatregel || "Nog geen tekst", `voordat de eerste trede is bereikt${l.elkeKeer.opPagina ? "" : " · niet op de pagina"}`, () => {
            const e = l.elkeKeer;
            return DT.el("div", { class: "dt-cb-protform" }, [
              invoer("Kop (op de protocolpagina)", e.kort, (v) => { e.kort = v; }, { ph: "bijv. Zelfde dag vóór 12:00 bellen" }),
              invoer("Wat er moet gebeuren", e.maatregel, (v) => { e.maatregel = v; }, { rijen: 2, hint: "zie je na het melden" }),
              invoer("Anders voor 18+", e.maatregel18, leegWeg(e, "maatregel18"), { rijen: 2, hint: "leeg laten als het hetzelfde is" }),
              DT.el("div", { class: "dt-cb-protvinkjes" }, vink("Tonen op de protocolpagina", e.opPagina, vlag(e, "opPagina"))),
            ]);
          }) : null,
          ...(l.treden || []).map((tr, ti) => rij(l, li, ti, this.protLabel(l, tr), tr.niveau, tr.kort || tr.label || "Nieuwe trede",
            [tr.label, (tr.mails || []).length ? (tr.mails.length === 1 ? "1 mail" : `${tr.mails.length} mails`) : "", tr.meldafspraak ? "meldafspraak" : ""].filter(Boolean).join(" · "),
            () => tredeForm(l, li, tr, ti))),
        ].filter(Boolean)),
        DT.el("div", { class: "dt-cb-rij" }, [
          this.knop(DT, "Trede toevoegen", () => {
            l.treden ||= [];
            const eigen = l.treden.filter((x) => K.tredeTeller(l, x) === l.teller), laatste = eigen[eigen.length - 1];
            const hoogste = eigen.reduce((m, x) => Math.max(m, x.vanaf), 0), plek = laatste ? l.treden.indexOf(laatste) + 1 : 0;
            l.treden.splice(plek, 0, { vanaf: hoogste + 1, niveau: Math.min(4, laatste ? laatste.niveau + 1 : 1), label: "", kort: "", maatregel: "", mails: [] });
            this._protOpen = `${li}:${plek}`; bewaar(true);
          }, false, "klein"),
          l.elkeKeer ? null : this.knop(DT, "Tekst voor “elke keer” toevoegen", () => { l.elkeKeer = { kort: "", maatregel: "", opPagina: true }; this._protOpen = `${li}:e`; bewaar(true); }, false, "klein stil"),
        ].filter(Boolean)),
      ])),
      ...(P.extra || []).map((x, xi) => DT.el("dna-card", { class: "dt-cb-kaart" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("h2", { text: x.titel || "Blok" }), DT.el("span", { style: "flex:1" }),
          this.knop(DT, "Verwijderen", () => { if (confirm("Dit tekstblok verwijderen?")) { P.extra.splice(xi, 1); bewaar(true); } }, false, "klein stil")]),
        invoer("Titel", x.titel, (v) => { x.titel = v; }), invoer("Tekst", x.tekst, (v) => { x.tekst = v; }, { rijen: 4 })])),
      DT.el("div", { class: "dt-cb-rij" }, this.knop(DT, "Tekstblok toevoegen", () => { (P.extra ||= []).push({ titel: "Nieuw blok", tekst: "" }); bewaar(true); })),
    ];
  },

  /* ===================================================================================== */
  /* Berichten en mails: eigen teksten met plaatshouders                                    */
  /* ===================================================================================== */
  /* Mails: dezelfde eigen teksten als in Tardy (S.instellingen.mailteksten, plaatshouders {naam}). In de editor
   * tonen we ze als %naam%. De standaardtekst wordt met plaatshouders getoond: we laten Tardy's mailTekst
   * rekenen met een voorbeeldstudent en voorbeeldgetallen, en zetten die terug in plaatshouders.
   * Notitie en afspraak zijn teksten van de extensie zelf (S.instellingen.cbTeksten). */
  CB_TEKST: {
    notitie: { onderwerp: "{stap}: {titel}", body: "{titel} in {periode}.\n{stand}\n\nMaatregel volgens het verzuimprotocol: {maatregel}\n\nVastgelegd vanuit de Te laat-balie (Tardy) door {cb}." },
    afspraak: { onderwerp: "{stap}: {naam}", body: "{titel} in {periode}.\n\n{maatregel}\n\nAangemaakt vanuit de Te laat-balie (Tardy)." },
  },
  CB_TEKSTNAAM: { notitie: "Notitie in dossier", afspraak: "Afspraak in Magister" },
  VUL_SIGNAAL: ["naam", "roepnaam", "klas", "stap", "niveau", "titel", "aantal", "maatregel", "periode", "stand", "cb", "datum"],
  VUL_MAIL: ["naam", "roepnaam", "klas", "mentor", "periode", "telaat", "ongeoorloofd", "nietgemeld", "calamiteit", "ziek", "medisch", "datum", "tijd", "lokaal", "school", "cb", "ondertekening"],
  VUL_MAIL_EXTRA: ["klokuren", "medischdatums", "ziek8w"],   // alleen in de extensie; Tardy laat ze staan
  naarProcent(t) { return String(t || "").replace(/\{(\w+)\}/g, "%$1%"); },
  naarAccolade(t) { return String(t || "").replace(/%(\w+)%/g, "{$1}"); },

  signaalVars(DT, s, st, pid) {
    const K = TardyKern;
    return { naam: K.naamVan(st), roepnaam: st.roepnaam || K.naamVan(st), klas: st.klas || "", stap: s.consequentie, niveau: K.NIVEAUNAAM[s.niveau] || "",
      titel: s.titel, aantal: s.telling, maatregel: s.maatregel, periode: (K.periodeById(pid) || {}).naam || "deze periode",
      stand: this.statsRegel(DT, s.stamnr)?.textContent || "", cb: K.S.instellingen.cbNaam || "de CB'er", datum: K.langDatum(K.vandaag()) };
  },
  eigenTekst(soort, vars) {
    const t = (TardyKern.S.instellingen.cbTeksten || {})[soort] || this.CB_TEKST[soort];
    const vul = (x) => String(x || "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)).replace(/\n{3,}/g, "\n\n").trim();
    return { onderwerp: vul(t.onderwerp), body: vul(t.body) };
  },
  /* Tardy's mailtekst, plus de plaatshouders die alleen de extensie kent. */
  mailVan(type, sn, pid, extra) {
    const K = TardyKern, m = K.mailTekst(type, sn, pid, extra);
    if (!/\{(klokuren|medischdatums|ziek8w)\}/.test(m.onderwerp + m.body)) return m;
    const t = K.tellingen(sn, pid);
    const vul = { klokuren: Math.round(t.klokuren), medischdatums: (t.medDatums || []).map(K.dmy).join(", "), ziek8w: K.TELLERS.ziek8w.waarde(sn, pid, t) };
    const z = (x) => x.replace(/\{(klokuren|medischdatums|ziek8w)\}/g, (_, k) => String(vul[k]));
    return Object.assign(m, { onderwerp: z(m.onderwerp), body: z(m.body) });
  },
  /* De standaardmail van dit type met plaatshouders in plaats van gegevens. */
  sjabloon(type) {
    const K = TardyKern, S = K.S, i = S.instellingen, X = (k) => `\u0001${k}\u0001`, VB = "__voorbeeld";
    const pid = K.UI.periodeId, p = K.periodeById(pid), oud = { lokaal: i.lokaal, school: i.school, cbNaam: i.cbNaam, cbEmail: i.cbEmail, meldTijd: i.meldTijd, mailteksten: i.mailteksten };
    const datum = "2099-03-02";
    S.studenten[VB] = { stamnr: VB, roepnaam: X("R"), achternaam: X("A"), klas: X("K"), persoonlijkeMentor: X("M"), persoonlijkeMentorEmail: "" };
    Object.assign(i, { lokaal: X("L"), school: X("S"), cbNaam: X("C"), cbEmail: "", meldTijd: X("T"), mailteksten: null });
    K.H.tellingen = (sn, pi) => Object.assign({}, K.tellingen(sn, pi), { teLaat: 9101, ongeoorloofd: 9102, calamiteit: 9103, nietGemeld: 9104,
      ziekDatums: { length: 9105 }, medDatums: { length: 9106, map: () => [X("MD")] }, klokuren: 9107, klokurenExact: true, achttienMin: true });
    try {
      const m = K.mailTekst(type, VB, pid, { datum, tijd: X("T"), aantal: 9108 });
      const ond = K.ondertekening();
      const paren = [[ond, "{ondertekening}"], [`${X("R")} ${X("A")}`, "{naam}"], [X("R"), "{roepnaam}"], [X("A"), "{naam}"], [X("K"), "{klas}"], [X("M"), "{mentor}"],
        [K.langDatum(datum), "{datum}"], [X("T"), "{tijd}"], [X("L"), "{lokaal}"], [X("S"), "{school}"], [X("C"), "{cb}"], [X("MD"), "{medischdatums}"],
        ...(p ? [[p.naam.toLowerCase(), "{periode}"], [p.naam, "{periode}"]] : []),
        ["9101", "{telaat}"], ["9102", "{ongeoorloofd}"], ["9103", "{calamiteit}"], ["9104", "{nietgemeld}"], ["9105", "{ziek}"], ["9106", "{medisch}"], ["9107", "{klokuren}"], ["9108", "{ziek8w}"]];
      const z = (t) => paren.reduce((a, [van, naar]) => a.split(van).join(naar), t).replace(/\u0001\w*\u0001/g, "");
      return { onderwerp: z(m.onderwerp), body: z(m.body) };
    } catch { return { onderwerp: "", body: "" }; }
    finally { delete S.studenten[VB]; Object.assign(i, oud); K.H.tellingen = null; }
  },

  tekstenKaart(DT) {
    const K = TardyKern, i = K.S.instellingen;
    const mails = Object.keys(K.MAILSOORT).filter((m) => m !== "mentor-overzicht");
    const keuze = this._tekstKeuze ||= "notitie";
    const isEigen = keuze in this.CB_TEKST;
    const standaard = isEigen ? this.CB_TEKST[keuze] : this.sjabloon(keuze);
    const huidig = isEigen ? (i.cbTeksten || {})[keuze] : (i.mailteksten || {})[keuze];
    const aangepast = !!(huidig && ((huidig.onderwerp || "").trim() || (huidig.body || "").trim()));
    const sel = DT.el("select", { class: "dt-cb-veld", "aria-label": "Welk bericht" }, [
      DT.el("optgroup", { label: "Vanuit Signalen" }, Object.keys(this.CB_TEKST).map((k) => DT.el("option", { value: k, text: this.CB_TEKSTNAAM[k] }))),
      DT.el("optgroup", { label: "Mails (gedeeld met de Tardy-app)" }, mails.map((m) => DT.el("option", { value: m, text: K.MAILSOORT[m].label }))),
    ]);
    sel.value = keuze;
    sel.addEventListener("change", () => { this._tekstKeuze = sel.value; this.teken(); });
    const onderwerp = DT.el("input", { type: "text", class: "dt-cb-veld" });
    const body = DT.el("textarea", { class: "dt-cb-veld dt-cb-tekstvak", rows: "12" });
    onderwerp.value = this.naarProcent(aangepast ? huidig.onderwerp || standaard.onderwerp : standaard.onderwerp);
    body.value = this.naarProcent(aangepast ? huidig.body || standaard.body : standaard.body);
    const status = DT.el("span", { class: `dt-cb-uitkomst ${aangepast ? "verzet" : "weg"}`, text: aangepast ? "Aangepast" : "Standaardtekst" });
    const voorbeeld = DT.el("pre", { class: "dt-cb-voorbeeld" });
    const toonVoorbeeld = () => {
      const sig = this.met18(K.hoogsteTreden(K.alleSignalen(K.UI.periodeId)))[0], sn = sig?.stamnr || Object.keys(K.S.studenten)[0];
      if (!sn) { voorbeeld.textContent = "Nog geen studenten voor een voorbeeld."; return; }
      let t;
      if (isEigen) t = sig ? this.eigenTekst(keuze, this.signaalVars(DT, sig, K.S.studenten[sig.stamnr], K.UI.periodeId)) : { onderwerp: "", body: "Nog geen signaal voor een voorbeeld." };
      else t = this.mailVan(keuze, sn, K.UI.periodeId);
      voorbeeld.textContent = `${t.onderwerp}\n\n${t.body}`;
    };
    const opslaan = () => {
      const nieuw = { onderwerp: this.naarAccolade(onderwerp.value), body: this.naarAccolade(body.value) };
      const zelfde = nieuw.onderwerp === standaard.onderwerp && nieuw.body === standaard.body;
      const doel = isEigen ? (i.cbTeksten ||= {}) : (i.mailteksten ||= {});
      if (zelfde) delete doel[keuze]; else doel[keuze] = nieuw;
      status.textContent = zelfde ? "Standaardtekst" : "Aangepast"; status.className = `dt-cb-uitkomst ${zelfde ? "weg" : "verzet"}`;
      terug.style.display = zelfde ? "none" : "";
      this.bewaar(); toonVoorbeeld();
    };
    let laatste = body;
    for (const v of [onderwerp, body]) { v.addEventListener("input", opslaan); v.addEventListener("focus", () => { laatste = v; }); }
    const lijst = isEigen ? this.VUL_SIGNAAL : [...this.VUL_MAIL, ...this.VUL_MAIL_EXTRA];
    const chips = DT.el("div", { class: "dt-cb-chips" }, lijst.map((k) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-chip", text: `%${k}%`, title: this.VUL_MAIL_EXTRA.includes(k) ? "Werkt alleen in de extensie; de Tardy-app laat deze plaatshouder staan" : `Invoegen op de plek van de cursor` });
      if (!isEigen && this.VUL_MAIL_EXTRA.includes(k)) b.classList.add("is-extra");
      b.addEventListener("click", () => {
        const v = laatste, a = v.selectionStart ?? v.value.length, e = v.selectionEnd ?? a, ins = `%${k}%`;
        v.value = v.value.slice(0, a) + ins + v.value.slice(e); v.focus(); v.setSelectionRange(a + ins.length, a + ins.length); opslaan();
      });
      return b;
    }));
    const terug = this.knop(DT, "Terug naar standaard", () => {
      const doel = isEigen ? i.cbTeksten : i.mailteksten; if (doel) delete doel[keuze];
      this.bewaar(); this.teken(); this.melding("Terug naar de standaardtekst.");
    }, false, "klein stil");
    terug.style.display = aangepast ? "" : "none";
    setTimeout(toonVoorbeeld, 0);
    return DT.el("dna-card", { class: "dt-cb-kaart" }, [
      DT.el("h2", { text: "Berichten en mails" }),
      DT.el("p", { class: "dt-cb-zacht", text: "Kies een bericht en pas de tekst aan. Gegevens zet je erin met plaatshouders zoals %naam% en %telaat%; klik op een plaatshouder om hem in te voegen. Wijzigingen worden meteen bewaard; mails gelden ook in de Tardy-app. Een eigen tekst past zich niet aan bij 18+, de standaardtekst wel." }),
      DT.el("div", { class: "dt-cb-rij" }, [sel, status, terug]),
      DT.el("label", { class: "dt-cb-protveld" }, [DT.el("span", { text: isEigen && keuze === "notitie" ? "Omschrijving" : "Onderwerp" }), onderwerp]),
      DT.el("label", { class: "dt-cb-protveld" }, [DT.el("span", { text: "Tekst" }), body]),
      DT.el("div", { class: "dt-cb-protsub", text: "Plaatshouders" }), chips,
      DT.el("div", { class: "dt-cb-protsub", text: "Voorbeeld" }), voorbeeld,
    ]);
  },

  /* ===================================================================================== */
  /* Instellingen                                                                           */
  /* ===================================================================================== */
  instellingen(DT) {
    const K = TardyKern, h = this._scherm.hoofd, i = K.S.instellingen, c = DT.settings.cb || {};
    const veld = (label, sleutel, type = "text", waarde = c[sleutel] || "", hint = "") => {
      const inp = DT.el("input", { type, class: "dt-cb-veld", value: waarde });
      inp.addEventListener("change", async () => { await DT.saveSettings({ cb: { [sleutel]: inp.value.trim() } }); Object.assign(K.S.instellingen, this.persoonlijk()); this.melding("Bewaard."); });
      return DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: label }), inp, hint ? DT.el("small", { text: hint }) : null]);
    };
    const meldtijd = DT.el("input", { type: "time", class: "dt-cb-veld", value: i.meldTijd || "08:30" });
    meldtijd.addEventListener("change", () => { i.meldTijd = meldtijd.value; this.bewaar(); this.melding("Meldtijd bewaard in de gedeelde gegevens."); });
    const zwarting = DT.el("select", { class: "dt-cb-veld" }, [1, 2, 3, 4, 5].map((n) => DT.el("option", { value: String(n), text: `Zwarting ${n}` })));
    zwarting.value = String(c.zwarting || 3);
    zwarting.addEventListener("change", async () => { await DT.saveSettings({ cb: { zwarting: +zwarting.value } }); Object.assign(K.S.instellingen, this.persoonlijk()); });
    const auto = DT.el("input", { type: "checkbox" }); auto.checked = !!c.autoPrint;
    auto.addEventListener("change", async () => { await DT.saveSettings({ cb: { autoPrint: auto.checked } }); Object.assign(K.S.instellingen, this.persoonlijk()); });
    const printer = i.bonPrinter?.naam;
    h.replaceChildren(
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Gedeelde map" }),
        DT.el("p", { text: this._map ? `In gebruik: "${this._map.name}" · revisie ${this._basis}${this._door ? ` · laatst opgeslagen door ${this._door} ${this.moment(this._op)}` : ""}.` : "Nog geen map gekozen." }),
        DT.el("p", { class: "dt-cb-zacht", text: "Dezelfde map als de Tardy-app: tardy-gegevens.json en tardy-in-gebruik.json. Jullie werken om de beurt. Een kopie van de stand blijft ook in deze browser bewaard (hooguit één per uur, de laatste 40, en bij een conflict)." }),
        DT.el("div", { class: "dt-cb-rij" }, [this.knop(DT, "Andere map kiezen", () => this.kiesMap(DT)), this.knop(DT, "Map loskoppelen", async () => { if (!confirm("De balie loskoppelen van deze map? De map zelf blijft staan.")) return; await this.bezettingVrij(); await this.kv("map", null); this._map = null; this.koppel(DT); }, false, "stil")])]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Jij" }), DT.el("p", { class: "dt-cb-zacht", text: "Alleen in deze browser, niet in de gedeelde map (zoals in Tardy)." }),
        veld("Naam", "naam"), veld("Paraaf", "paraaf"), veld("E-mail", "email", "email"), veld("Lokaal", "lokaal", "text", c.lokaal || i.lokaal || "", "staat in mails en op het briefje")]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Meldafspraken" }),
        DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: "Meldtijd" }), meldtijd, DT.el("small", { text: "gedeeld met Tardy" })]),
        DT.el("p", { class: "dt-cb-zacht", text: `Periodes, mentoren en mailteksten komen uit de gedeelde gegevens en pas je aan in de Tardy-app. Het protocol (${K.protocol().naam || "standaardprotocol"}) pas je aan op het tabblad Protocol.` })]),
      this.tekstenKaart(DT),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Briefjes" }),
        DT.el("p", { text: printer ? `Bonprinter: ${printer}.` : "Geen bonprinter gekoppeld: briefjes gaan naar de gewone printer (twee per rij op A4)." }),
        DT.el("div", { class: "dt-cb-rij" }, [
          this.knop(DT, printer ? "Andere bonprinter" : "Bonprinter koppelen", async () => {
            try { const d = await this.bonApparaat(true); await DT.saveSettings({ cb: { printer: { naam: d.name || "Bonprinter", id: d.id } } }); Object.assign(K.S.instellingen, this.persoonlijk()); this.teken(); this.melding(`Gekoppeld: ${d.name || "bonprinter"}.`); }
            catch (e) { if (e?.name !== "NotFoundError") this.melding(`Koppelen lukte niet: ${e.message || e}`, "err"); }
          }),
          printer ? this.knop(DT, "Ontkoppelen", async () => { await DT.saveSettings({ cb: { printer: null } }); Object.assign(K.S.instellingen, this.persoonlijk()); this._bon = null; this.teken(); }, false, "stil") : null,
          this.knop(DT, "Testbriefje", () => this.print([{ id: "test", stamnr: "", datum: K.vandaag(), tijd: K.nuTijd(), soort: "TEL", reden: "Testbriefje", paraaf: i.cbParaaf || "" }])),
        ].filter(Boolean)),
        printer ? DT.el("div", { class: "dt-cb-rij" }, [zwarting, DT.el("label", { class: "dt-cb-schakel" }, [auto, DT.el("span", { text: "Automatisch printen na melden (te laat en calamiteit)" })])]) : null,
      ].filter(Boolean)),
    );
  },

  /* ===================================================================================== */
  css() {
    if (document.getElementById("dt-cb-style")) return;
    const st = document.createElement("style"); st.id = "dt-cb-style";
    /* Alles op Magisters eigen ontwerptokens (--sl-…), zodat de balie meekleurt met Magister en met het thema. */
    st.textContent = `
      ui-view.dt-cb-open > mg-att-tiles { display: none !important; }
      .dt-cb, .dt-cb-vars {
        --cb-fg: var(--sl-color-tab-default-foreground, #233243); --cb-zacht: color-mix(in srgb, var(--cb-fg) 62%, transparent);
        --cb-lijn: var(--sl-color-card-border, #bcbcbc); --cb-lijnzacht: color-mix(in srgb, var(--cb-lijn) 45%, transparent);
        --cb-kaart: var(--sl-color-card-background, #fefefe); --cb-vlak: var(--sl-elevation-surface-raised-sunken, #f6f8fa);
        --cb-acc: var(--sl-color-button-primary-solid-idle-background, var(--dt-accent, #056dc2));
        --cb-hover: var(--sl-color-tab-hover-background, #ddeffe); --cb-actief: var(--sl-color-tab-active-background, #b7defd);
        --cb-rood: var(--sl-color-border-accent-red-bold, #d7263d); --cb-groen: #1e8a4c;
        --cb-r: var(--sl-size-borderRadius-default, 4px); --cb-rl: var(--sl-size-borderRadius-lg, 8px);
        --cb-schaduw: var(--sl-elevation-shadow-sm, 0 2px 4px rgba(34,34,34,.08));
        color: var(--cb-fg); font-family: var(--sl-text-typeset-font-family-body, open-sans), sans-serif; font-size: 14px; line-height: 20px; }
      .dt-cb * , .dt-cb-vars * { box-sizing: border-box; }
      /* Zelfde maten als Magisters eigen subpagina's: kop en tabbalk 2rem van de rand (dezelfde variabele die
       * Magister op Meldingen zet), inhoud hooguit 1200px breed en gecentreerd. */
      #dt-cbp { display: block; --dna-page-layout-max-width: min(100%, calc(100% - 2 * 2rem)); min-width: 0; }
      #dt-cbp dna-tabs { display: block; }
      #dt-cbp dna-tab { width: 100%; justify-self: stretch; }
      .dt-cb-tardy { font-size: 12px; opacity: .8; letter-spacing: .02em; white-space: nowrap; }
      .dt-cb-tel { margin-left: 6px; min-width: 18px; padding: 0 6px; border-radius: 999px; font-size: 11px; line-height: 18px; font-weight: 700; text-align: center; background: var(--cb-acc); color: #fff; }
      .dt-cb-tel:empty { display: none; }
      .dt-cb-tabblad { width: min(1200px, calc(100% - 4rem)); margin: 0 auto; padding: 16px 0 32px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .dt-cb-paneel { display: flex; flex-direction: column; gap: 16px; }
      .dt-cb-paneel:empty { display: none; }
      .dt-cb-inhoud { display: flex; flex-direction: column; gap: 16px; }
      .dt-cb-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .dt-cb-stand { color: var(--cb-zacht); font-size: 13px; }
      .dt-cb-stand.is-kijk { color: var(--cb-rood); font-weight: 600; }
      .dt-cb-periode { min-width: 240px; }
      dna-card.dt-cb-kaart { display: block; min-width: 0; }
      .dt-cb-kaart, .dt-cb-kaart p, .dt-cb-kaart label, .dt-cb-kaart span, .dt-cb-kaart small, .dt-cb-kaart td, .dt-cb-modalin p { font-size: 14px; line-height: 20px; }
      .dt-cb-kaart p, .dt-cb-modalin p { margin: 0 0 8px; overflow-wrap: anywhere; }
      .dt-cb-kaart h2 + p { margin-top: 4px; }
      .dt-cb-kaart small, .dt-cb-wie small, .dt-cb-tabel td small { font-size: 13px; }
      .dt-cb input, .dt-cb select, .dt-cb-vars input, .dt-cb-vars select { font-family: inherit; font-size: 14px; }
      .dt-cb-kaart h2, .dt-cb-kaart h3, .dt-cb-modalin h2 { margin: 0; font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 16px; line-height: 24px; font-weight: 700; color: var(--cb-fg); }
      .dt-cb-kaartkop { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .dt-cb-wie { flex: 1; min-width: 200px; } .dt-cb-wie small { display: block; color: var(--cb-zacht); font-size: 13px; }
      .dt-cb-rij { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .dt-cb-rij.eind { justify-content: flex-end; margin-top: 16px; }
      .dt-cb-zacht { color: var(--cb-zacht); margin: 0; } .dt-cb-waarschuw { color: var(--cb-rood); font-weight: 600; margin: 0; }
      .dt-cb-leeg { text-align: center; } .dt-cb-leeg p { color: var(--cb-zacht); } .dt-cb-leeg .dt-cb-rij { justify-content: center; }
      .dt-cb-veld, .dt-cb-meer, .dt-cb-bulk input { height: 36px; padding: 0 10px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-fg); font: inherit; min-width: 220px; }
      .dt-cb-veld.klein { height: 30px; min-width: 140px; }
      .dt-cb-redenrij .dt-cb-veld { flex: 0 1 320px; background: var(--cb-kaart) !important; }
      .dt-cb-veld:focus, .dt-cb-zoek:focus, .dt-cb-tijd:focus, .dt-cb-meer:focus { outline: none; border-color: var(--cb-acc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--cb-acc) 30%, transparent); }
      .dt-cb input[type="checkbox"], .dt-cb-vars input[type="checkbox"] { appearance: auto !important; -webkit-appearance: checkbox !important; width: 16px !important; height: 16px !important; margin: 0 !important; opacity: 1 !important; position: static !important; accent-color: var(--cb-acc); cursor: pointer; }
      .dt-cb-zoekrij { display: flex; gap: 8px; align-items: center; }
      .dt-cb-zoek { flex: 1; height: 44px; padding: 0 14px 0 40px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart) no-repeat 14px 50% / 16px
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='5' fill='none' stroke='%23778899' stroke-width='1.6'/%3E%3Cpath d='m11 11 3.5 3.5' stroke='%23778899' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
        color: var(--cb-fg); font: inherit; font-size: 16px; }
      .dt-cb-tijd { height: 44px; width: 120px; padding: 0 10px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-fg); font: inherit; }
      .dt-cb-hits { display: flex; flex-direction: column; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); overflow: hidden; box-shadow: var(--cb-schaduw); }
      .dt-cb-hits:empty { display: none; }
      .dt-cb-hit { appearance: none; border: 0; border-top: 1px solid var(--cb-lijnzacht); display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .dt-cb-hit:first-child { border-top: 0; }
      .dt-cb-hit[aria-selected="true"], .dt-cb-hit:hover { background: var(--cb-hover); }
      .dt-cb-hitnaam { flex: 1; display: flex; flex-direction: column; } .dt-cb-hitnaam small, .dt-cb-hitstand { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-mono { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; background: var(--cb-actief); color: var(--cb-fg); }
      .dt-cb-soorten { display: grid; grid-template-columns: 3fr 4fr; gap: 16px; }
      .dt-cb-groep { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; padding: 12px; border-radius: var(--cb-rl); border: 1px solid var(--cb-lijnzacht); }
      .dt-cb-groep > span { grid-column: 1 / -1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .dt-cb-groep.nok > span { color: var(--cb-rood); } .dt-cb-groep.ok > span { color: var(--cb-groen); }
      .dt-cb-groep.nok { background: color-mix(in srgb, var(--cb-rood) 5%, var(--cb-kaart)); } .dt-cb-groep.ok { background: color-mix(in srgb, var(--cb-groen) 5%, var(--cb-kaart)); }
      .dt-cb-soort { appearance: none; min-height: 60px; padding: 8px 12px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
      .dt-cb-soort b { font-size: 14px; font-weight: 700; } .dt-cb-soort small { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-soort:hover { background: var(--cb-hover); border-color: var(--cb-acc); }
      .dt-cb-soort.nok:hover { border-color: var(--cb-rood); } .dt-cb-soort.ok:hover { border-color: var(--cb-groen); }
      .dt-cb-meer { margin-top: 12px; min-width: 200px; }
      .dt-cb-uitslag, .dt-cb-signaal { border-left: 4px solid var(--cb-lijn); }
      .dt-cb-uitslag.n1, .dt-cb-signaal.n1 { border-left-color: #f2c400; } .dt-cb-uitslag.n2, .dt-cb-signaal.n2 { border-left-color: #f08a00; }
      .dt-cb-uitslag.n3, .dt-cb-signaal.n3 { border-left-color: #d7263d; } .dt-cb-uitslag.n4, .dt-cb-signaal.n4 { border-left-color: #8e44ad; }
      .dt-cb-signaal.is-af { opacity: .6; } .dt-cb-signaal p { margin: 0 0 12px; }
      .dt-cb-stats { margin: 0 0 12px !important; padding: 6px 10px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px !important; }
      .dt-cb-stats b { font-weight: 700; }
      .dt-cb-haal { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-haal[hidden] { display: none; }
      .dt-cb-haal b { flex: 0 0 200px; height: 6px; border-radius: 3px; background: var(--cb-lijnzacht); overflow: hidden; }
      .dt-cb-haal i { display: block; height: 100%; background: var(--cb-acc); transition: width .3s; }
      .dt-cb-afspraakmelding { margin: 8px 0 12px; padding: 10px 14px; border-radius: var(--cb-r); background: var(--cb-hover); border-left: 4px solid var(--cb-acc); font-size: 14px; }
      .dt-cb-ook { margin: 0 0 12px; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px; }
      .dt-cb-ook summary { cursor: pointer; color: var(--cb-zacht); font-size: 13px; line-height: 20px; }
      .dt-cb-ookregel { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; } .dt-cb-ookregel.is-af { opacity: .6; }
      .dt-cb-ookregel b, .dt-cb-ookregel small { display: block; font-size: 13px; line-height: 18px; } .dt-cb-ookregel small { color: var(--cb-zacht); }
      .dt-cb-proc { margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 22px; }
      .dt-cb-ladder { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .dt-cb-stap { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: start; padding: 10px 12px; border-radius: var(--cb-r); border: 1px solid var(--cb-lijnzacht); border-left: 4px solid var(--cb-lijn); }
      .dt-cb-stap.s1 { border-left-color: #f2c400; } .dt-cb-stap.s2 { border-left-color: #f08a00; } .dt-cb-stap.s3 { border-left-color: #d7263d; } .dt-cb-stap.s4 { border-left-color: #8e44ad; }
      .dt-cb-stap b { font-size: 14px; line-height: 20px; } .dt-cb-stap p { margin: 2px 0 0 !important; }
      .dt-cb-stapn { justify-self: start; font-size: 12px; font-weight: 700; line-height: 20px; white-space: nowrap; }
      .dt-cb-meter { display: inline-flex; gap: 2px; } .dt-cb-meter i { width: 6px; height: 14px; border-radius: 2px; background: var(--cb-lijnzacht); }
      .dt-cb-meter.m1 i:nth-child(-n+1), .dt-cb-meter.m2 i:nth-child(-n+2), .dt-cb-meter.m3 i:nth-child(-n+3), .dt-cb-meter.m4 i { background: var(--cb-acc); }
      .dt-cb-treden { display: flex; flex-direction: column; margin: 12px 0; border: 1px solid var(--cb-lijnzacht); border-radius: var(--cb-r); overflow: hidden; }
      .dt-cb-trede + .dt-cb-trede { border-top: 1px solid var(--cb-lijnzacht); }
      .dt-cb-protkop { appearance: none; width: 100%; display: grid; grid-template-columns: 110px auto 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border: 0; background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .dt-cb-protkop:hover, .dt-cb-trede.open .dt-cb-protkop { background: var(--cb-hover); }
      .dt-cb-protnaam b, .dt-cb-protnaam small { display: block; font-size: 14px; line-height: 20px; } .dt-cb-protnaam small { font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-pijl { color: var(--cb-zacht); }
      .dt-cb-protform { padding: 12px 16px 16px; background: var(--cb-vlak); border-top: 1px solid var(--cb-lijnzacht); }
      .dt-cb-protveld { display: flex; flex-direction: column; gap: 4px; margin: 0 0 12px; font-size: 13px; font-weight: 600; }
      .dt-cb-protveld .dt-cb-veld { min-width: 0; width: 100%; box-sizing: border-box; font-weight: 400; }
      .dt-cb-tekstvak { height: auto !important; padding: 8px 10px !important; line-height: 20px; resize: vertical; }
      .dt-cb-protrij { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 12px; }
      .dt-cb-protsub { margin: 4px 0 8px; font-size: 13px; font-weight: 700; }
      .dt-cb-protvinkjes { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 12px; }
      .dt-cb-naamknop { appearance: none; border: 0; padding: 0; background: none; font: inherit; font-weight: 700; color: var(--cb-acc); cursor: pointer; text-align: left; }
      .dt-cb-naamknop:hover { text-decoration: underline; }
      .dt-cb-vervolg { color: var(--cb-zacht); } .dt-cb-blok { display: block; }
      .dt-cb-uitkomst { display: inline-flex; padding: 0 8px; border-radius: var(--cb-r); font-size: 12px; line-height: 20px; font-weight: 700; white-space: nowrap; background: var(--cb-vlak); }
      .dt-cb-uitkomst.ok { background: #d9f2e3; color: #145c33; } .dt-cb-uitkomst.nok { background: #fdd8dc; color: #9b1424; }
      .dt-cb-uitkomst.verzet { background: #ddeffe; color: #0b4f8a; } .dt-cb-uitkomst.open { background: #ffe3c2; color: #7a4100; } .dt-cb-uitkomst.weg { color: var(--cb-zacht); }
      .dt-cb-telregel { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--cb-zacht); margin: 4px 0 0; }
      .dt-cb-telregel .ok { color: var(--cb-groen); } .dt-cb-telregel .nok { color: var(--cb-rood); } .dt-cb-telregel b { color: var(--cb-fg); }
      .dt-cb-groepkop td .dt-cb-telregel { font-weight: 400; }
      .dt-cb-hist td { vertical-align: top; }
      .dt-cb-keuze { padding: 8px 12px; margin: 0 0 8px; border-radius: var(--cb-r); background: var(--cb-vlak); } .dt-cb-keuze b, .dt-cb-keuze small { display: block; font-size: 14px; line-height: 20px; } .dt-cb-keuze small { font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-stapblok { margin: 8px 0; padding: 12px; border-radius: var(--cb-r); border: 1px solid var(--cb-lijnzacht); border-left: 4px solid var(--cb-lijn); }
      .dt-cb-stapblok.n1 { border-left-color: #f2c400; } .dt-cb-stapblok.n2 { border-left-color: #f08a00; } .dt-cb-stapblok.n3 { border-left-color: #d7263d; } .dt-cb-stapblok.n4 { border-left-color: #8e44ad; }
      .dt-cb-modal.breed .dt-cb-modalin { width: min(1000px, calc(100vw - 48px)); max-height: calc(100vh - 64px); overflow: auto; }
      .dt-cb-niveaugroep { padding-bottom: 4px; } .dt-cb-niveaugroep h2 { margin-bottom: 4px !important; }
      .dt-cb-siglijst { display: flex; flex-direction: column; margin: 0 -16px; }
      .dt-cb-sig { border-top: 1px solid var(--cb-lijnzacht); border-left: 3px solid transparent; }
      .dt-cb-sig.n1 { border-left-color: #f2c400; } .dt-cb-sig.n2 { border-left-color: #f08a00; } .dt-cb-sig.n3 { border-left-color: #d7263d; } .dt-cb-sig.n4 { border-left-color: #8e44ad; }
      .dt-cb-sig.is-af { opacity: .6; } .dt-cb-sig.is-open { background: var(--cb-vlak); }
      .dt-cb-sigrij { display: grid; grid-template-columns: 24px minmax(140px, 190px) minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 6px 13px; }
      .dt-cb-sigrij:hover { background: var(--cb-hover); }
      .dt-cb-sigpijl { appearance: none; border: 0; background: none; padding: 0; width: 24px; height: 24px; color: var(--cb-zacht); cursor: pointer; font-size: 12px; }
      .dt-cb-sigwie { min-width: 0; display: flex; flex-direction: column; } .dt-cb-sigwie small { font-size: 12px !important; color: var(--cb-zacht); line-height: 16px; }
      .dt-cb-sigwie .dt-cb-naamknop { font-size: 14px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-cb-sigwat { min-width: 0; cursor: pointer; }
      .dt-cb-sigregel { display: flex; gap: 8px; align-items: center; min-width: 0; }
      .dt-cb-sigtitel { font-size: 13px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-sigmaat { font-size: 12px; line-height: 18px; color: var(--cb-zacht); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-ookchip, .dt-cb-pct { flex: none; font-size: 12px !important; line-height: 18px; padding: 0 6px; border-radius: 999px; border: 1px solid var(--cb-lijnzacht); color: var(--cb-zacht); }
      .dt-cb-sigknoppen { display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
      .dt-cb-acties-in { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
      .dt-cb-actiegroep { display: inline-flex; align-items: center; }
      .dt-cb-terug { appearance: none; border: 0; background: none; width: 26px; height: 26px; border-radius: 50%; color: var(--cb-zacht); cursor: pointer; font-size: 17px; line-height: 26px; padding: 0; }
      .dt-cb-terug:hover { background: var(--cb-hover); color: var(--cb-fg); }
      .dt-cb-sigdetail { padding: 0 16px 12px 52px; } .dt-cb-sigdetail p { margin: 0 0 8px !important; font-size: 14px; }
      .dt-cb-sigdetail .dt-cb-ookregel { margin: 0 0 8px; }
      .dt-cb-siglijst { container-type: inline-size; }
      .dt-cb-sigregel { overflow: hidden; } .dt-cb-sigregel .dt-cb-niveau { min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-sigtitel { flex: 0 1 auto; min-width: 0; }
      @container (max-width: 720px) {
        .dt-cb-sigrij { grid-template-columns: 24px minmax(0, 1fr) auto; }
        .dt-cb-sigwie { grid-column: 2; grid-row: 1; } .dt-cb-sigknoppen { grid-column: 3; grid-row: 1; }
        .dt-cb-sigwat { grid-column: 2 / 4; grid-row: 2; }
        .dt-cb-sigdetail { padding-left: 16px; }
      }
      .dt-cb-ikoon { position: relative; appearance: none; width: 34px; height: 32px; display: inline-grid; place-items: center; padding: 0; border: 1px solid var(--cb-acc); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-acc); cursor: pointer; }
      .dt-cb-ikoon:hover { background: var(--cb-hover); }
      .dt-cb-ikoon:focus-visible { outline: 2px solid var(--cb-acc); outline-offset: 2px; }
      .dt-cb-ikoon.is-hoofd { background: var(--cb-acc); color: #fff; } .dt-cb-ikoon.is-hoofd:hover { filter: brightness(1.1); }
      .dt-cb-ikoon.is-gedaan { border-color: var(--cb-groen); color: var(--cb-groen); background: color-mix(in srgb, var(--cb-groen) 8%, var(--cb-kaart)); }
      .dt-cb-ikoon:disabled { border-color: var(--cb-lijnzacht); color: var(--cb-lijn); cursor: default; background: none; }
      .dt-cb-vink { position: absolute; right: -5px; top: -6px; width: 15px; height: 15px; border-radius: 50%; background: var(--cb-groen); color: #fff; font-size: 10px; line-height: 15px; text-align: center; font-weight: 700; }
      .dt-cb-sigknoppen .dt-cb-acties-in { gap: 6px; }
      .dt-cb-sig.is-open .dt-cb-sigmaat { display: none; }
      .dt-cb-detailknoppen { margin: 0 0 10px; } .dt-cb-detailknoppen .dt-cb-acties3 { margin: 0; }
      .dt-cb-voorbeeld { margin: 0; padding: 12px; border-radius: var(--cb-r); background: var(--cb-vlak); border: 1px solid var(--cb-lijnzacht); white-space: pre-wrap; font: 13px/19px var(--sl-text-typeset-font-family-body, open-sans), sans-serif; max-height: 320px; overflow: auto; }
      .dt-cb-chip.is-extra { border-style: dashed; }
      .dt-cb-acties3 { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; padding: 8px; border-radius: var(--cb-r); border: 1px dashed var(--cb-lijnzacht); }
      .dt-cb-actie.is-gedaan { color: var(--cb-groen); }
      .dt-cb-gevolg { display: flex; gap: 8px; align-items: baseline; margin: 0 0 8px; }
      .dt-cb-afspraak { margin: 0 0 8px; font-weight: 600; }
      .dt-cb-niveau { display: inline-flex; align-items: center; padding: 0 8px; border-radius: var(--cb-r); font-size: 12px; line-height: 20px; font-weight: 700; white-space: nowrap; background: var(--cb-vlak); }
      .dt-cb-niveau.n1 { background: #fff4c2; color: #6b5200; } .dt-cb-niveau.n2 { background: #ffe3c2; color: #7a4100; } .dt-cb-niveau.n3 { background: #fdd8dc; color: #9b1424; } .dt-cb-niveau.n4 { background: #ecdcf5; color: #5e2a7e; }
      .dt-cb-redenrij { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
      .dt-cb-label { font-size: 12px; font-weight: 700; color: var(--cb-zacht); text-transform: uppercase; letter-spacing: .04em; }
      .dt-cb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dt-cb-chip { appearance: none; height: 30px; padding: 0 12px; border: 1px solid var(--cb-lijn); border-radius: 999px; background: var(--cb-kaart); color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
      .dt-cb-chip:hover { background: var(--cb-hover); }
      .dt-cb-chip[aria-pressed="true"] { background: var(--cb-actief); border-color: var(--cb-acc); font-weight: 700; }
      .dt-cb-magister { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px; }
      .dt-cb-magister code { padding: 2px 6px; border-radius: var(--cb-r); background: var(--cb-kaart); border: 1px solid var(--cb-lijnzacht); font: 600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .dt-cb-tabel { width: 100%; border-collapse: collapse; }
      .dt-cb-tabel th { text-align: left; font-size: 12px; font-weight: 700; color: var(--cb-zacht); padding: 8px; border-bottom: 1px solid var(--cb-lijn); }
      .dt-cb-tabel td { padding: 6px 8px; border-bottom: 1px solid var(--cb-lijnzacht); vertical-align: middle; }
      .dt-cb-tabel tr:hover td { background: color-mix(in srgb, var(--cb-hover) 50%, transparent); }
      .dt-cb-tabel td small { color: var(--cb-zacht); }
      .dt-cb-groepkop td { font-weight: 700; background: var(--cb-vlak); }
      .dt-cb-acties { white-space: nowrap; text-align: right; }
      .dt-cb-bulk { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-hover); }
      .dt-cb-bulk[hidden] { display: none; }
      .dt-cb-bulk input { min-width: 0; }
      .dt-cb-niveaugroep { display: flex; flex-direction: column; gap: 8px; } .dt-cb-niveaugroep h2 { display: flex; gap: 8px; align-items: center; margin: 4px 0 0; font-size: 15px; }
      .dt-cb-schakel { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
      .dt-cb-veldrij { display: grid; grid-template-columns: 140px minmax(200px, 340px) 1fr; gap: 12px; align-items: center; margin: 8px 0; }
      .dt-cb-veldrij .dt-cb-veld { width: 100%; min-width: 0; }
      .dt-cb-veldrij small { color: var(--cb-zacht); }
      .dt-cb-modal { position: fixed; inset: 0; z-index: 1350; display: grid; place-items: center; background: rgba(34,34,34,.4); }
      .dt-cb-modalin { display: flex; flex-direction: column; gap: 12px; width: min(720px, 92vw); max-height: 86vh; overflow: auto; box-shadow: var(--sl-elevation-shadow-overlay, 0 12px 32px rgba(0,0,0,.2)); }
      .dt-cb-modalin .dt-cb-veld { width: 100%; }
      .dt-cb-mails { display: flex; flex-direction: column; gap: 8px; }
      .dt-cb-mail { border: 1px solid var(--cb-lijnzacht); border-radius: var(--cb-r); padding: 8px 12px; }
      .dt-cb-mail .dt-cb-rij b { flex: 1; } .dt-cb-onderwerp { font-weight: 700; margin: 4px 0; }
      .dt-cb-mail pre { margin: 0; white-space: pre-wrap; font: inherit; font-size: 13px; color: var(--cb-zacht); max-height: 220px; overflow: auto; }
      .dt-cb-scanvak { position: relative; border-radius: var(--cb-rl); overflow: hidden; background: #000; aspect-ratio: 4 / 3; }
      .dt-cb-scanvak video { width: 100%; height: 100%; object-fit: cover; }
      .dt-cb-scanvak i { position: absolute; inset: 30% 12%; border: 3px solid rgba(255,255,255,.85); border-radius: var(--cb-rl); }
      .dt-cb-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px); opacity: 0; pointer-events: none; padding: 10px 16px; border-radius: var(--cb-r); background: #233243; color: #fff; font-weight: 600; max-width: 80vw; transition: opacity .2s, transform .2s; z-index: 1400; box-shadow: var(--sl-elevation-shadow-overlay, 0 8px 24px rgba(0,0,0,.2)); }
      .dt-cb-toast.is-aan { opacity: 1; transform: translate(-50%, 0); } .dt-cb-toast[data-soort="err"] { background: var(--cb-rood); }
      @media (max-width: 900px) { .dt-cb-soorten { grid-template-columns: 1fr; } .dt-cb-tabblad { width: calc(100% - 2rem); } }
    `;
    document.head.append(st);
  },
});
