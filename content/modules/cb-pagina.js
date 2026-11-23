/* Te laat-balie, de pagina zelf (kop, tabbladen, vensters, meldingen) en studenten zoeken.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
  /* ===================================================================================== */
  /* De pagina: een subpagina van Aanwezigheid, opgebouwd uit Magisters eigen onderdelen     */
  /* ===================================================================================== */
  /* Paginakop (dna-page-header) met kruimelpad, tabbladen (dna-tabs), kaarten (dna-card) en knoppen
   * (dna-button), net als Meldingen of Registraties. Magisters onderdelen negeren attributen die de extensie
   * zet; componenten() laat het netwerk-script in de pagina ze opnieuw zetten. */
  VIEWS: [["melden", "Melden"], ["overzicht", "Overzicht"], ["meldafspraken", "Meldafspraken"], ["signalen", "Signalen"], ["protocol", "Protocol"], ["instellingen", "Instellingen"]],

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
    this.haken();
    if (!this._perUnsub && DT.onSettingsChange) this._perUnsub = DT.onSettingsChange(() => { if (this._scherm && this.volgPeriodes()) { this.teken(); this.melding("Periodes bijgewerkt volgens de plugin."); } });
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
    /* Tabblad of venster sluiten: de laatste wijziging nog wegschrijven en de bezetting vrijgeven (anders
     * blijft de balie 10 minuten "in gebruik"). Lukt het schrijven niet meer op tijd, dan staat de stand in
     * elk geval als reservekopie in deze browser. */
    if (!this._weg) {
      this._weg = () => {
        if (!this._scherm || !this._map || this._kijkt || !TardyKern.S) return;
        if (this._wacht) { try { this.kopie("afsluiten", JSON.stringify(this.splits(TardyKern.S))); } catch {} this.schrijfNu().finally(() => this.bezettingVrij()); }
        else this.bezettingVrij();
      };
      window.addEventListener("pagehide", this._weg);
    }
    uv.classList.add("dt-cb-open");
    uv.append(pagina);
    this._view = "melden";
    this._scherm = { laag: pagina, uv, bar, panelen, hoofd: panelen.melden };
    this.componenten();
    this.menu();
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
    this.menu();
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
    ({ melden: () => this.melden(DT), overzicht: () => this.overzicht(DT), meldafspraken: () => this.afspraken(DT), signalen: () => this.signalen(DT), protocol: () => this.protocol(DT), instellingen: () => this.instellingen(DT) })[this._view]();
    this.tekenStand();
    this.componenten();
    this.autoBijwerken(DT);
  },
  /* Eén keer per dag (per browser) het verzuim, de ouders en de mentoren uit Magister bijwerken, op de achtergrond,
   * voor de studenten die al aan Magister gekoppeld zijn. Uit te zetten bij Instellingen. */
  autoBijwerken(DT) {
    const K = TardyKern;
    if (this._autoGedaan || this._kijkt || !this._map || !K.S || DT.settings.cb?.autoBijwerken === false) return;
    this._autoGedaan = true;
    /* Gegevens van vóór de telling per les (zonder "lessen"): eenmalig opnieuw ophalen, ook als vandaag al is bijgewerkt. */
    if (Object.values(K.S.lesreg || {}).some((l) => l?.bron === "magister" && !Array.isArray(l.lessen))) return this.opnieuwOphalen("Nieuwe telling per les");
    let laatst = null; try { laatst = localStorage.getItem("dt-cb-auto"); } catch {}
    if (laatst === K.vandaag()) return;
    const sns = Object.values(K.S.studenten).filter((st) => !st.archief && (st.magisterId || K.S.lesreg[st.stamnr])).map((st) => st.stamnr);
    if (!sns.length) return;
    setTimeout(async () => {
      if (this._kijkt || this._haal) return;
      this.melding(`Verzuim van ${sns.length} studenten wordt op de achtergrond bijgewerkt uit Magister…`, "info", 5000);
      await this.haalMagister(DT, sns);
      try { localStorage.setItem("dt-cb-auto", K.vandaag()); } catch {}
    }, 4000);
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
});
