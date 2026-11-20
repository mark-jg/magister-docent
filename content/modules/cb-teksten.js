/* Te laat-balie, eigen bericht- en mailteksten en het tabblad Instellingen.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
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
    meldafspraak: { onderwerp: "Meldafspraak {datum}: {naam}", body: "{naam} ({klas}) meldt zich op {datum} om {tijd} uur bij de CB'er (lokaal {lokaal}).\nAanleiding: {aanleiding}.\n{stap}\n{stand}\n\nVastgelegd vanuit de Te laat-balie (Tardy) door {cb}." },
    meldafspraakAgenda: { onderwerp: "Meldafspraak bij de CB'er: {naam}", body: "Meldafspraak: {aanleiding}.\n{stap}\n\nAangemaakt vanuit de Te laat-balie (Tardy)." },
  },
  CB_TEKSTNAAM: { notitie: "Notitie in dossier (signaal)", afspraak: "Afspraak in Magister (signaal)", meldafspraak: "Notitie bij een meldafspraak", meldafspraakAgenda: "Afspraak in Magister (meldafspraak)" },
  VUL_MELD: ["naam", "roepnaam", "klas", "datum", "tijd", "lokaal", "aanleiding", "stap", "vorige", "stand", "cb"],
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
      const meld = K.S.meldafspraken.slice(-1)[0];
      if (isEigen && /^meld/.test(keuze)) t = meld ? this.eigenTekst(keuze, this.meldVars(meld)) : { onderwerp: "", body: "Nog geen meldafspraak voor een voorbeeld." };
      else if (isEigen) t = sig ? this.eigenTekst(keuze, this.signaalVars(DT, sig, K.S.studenten[sig.stamnr], K.UI.periodeId)) : { onderwerp: "", body: "Nog geen signaal voor een voorbeeld." };
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
    const lijst = isEigen ? (/^meld/.test(keuze) ? this.VUL_MELD : this.VUL_SIGNAAL) : [...this.VUL_MAIL, ...this.VUL_MAIL_EXTRA];
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

  /* Versturen via Outlook of via Magister-berichten, en wat Magister bij jullie toestaat (scherminstellingen). */
  berichtenKaart(DT) {
    const c = DT.settings.cb || {};
    const kies = DT.el("select", { class: "dt-cb-veld" }, [DT.el("option", { value: "outlook", text: "Concept in mijn mailprogramma (Outlook)" }), DT.el("option", { value: "magister", text: "Magister-bericht (student, ouders, mentor)" })]);
    kies.value = c.berichtenVia || "outlook";
    kies.addEventListener("change", async () => { await DT.saveSettings({ cb: { berichtenVia: kies.value } }); this.melding("Bewaard."); });
    const status = DT.el("p", { class: "dt-cb-zacht", text: "Rechten in Magister controleren…" });
    (async () => {
      const r = await DT.api("/api/m6/scherminstellingen", { full: true, timeout: 10000 });
      const rollen = (r.json?.items || []).filter((x) => ["Docent", "Mentor"].includes(x.rol)).map((x) => x.instellingen || {});
      const mag = (k) => rollen.some((x) => x[k] === true);
      if (!rollen.length) { status.textContent = "Kon de rechten in Magister niet ophalen."; return; }
      status.textContent = `In Magister: berichten schrijven ${mag("berichtenSchrijven") ? "aan" : "uit"}, berichten aan ouders ${mag("berichtenAanOuders") ? "aan" : "uit"}, terugkommaatregelen aanmaken ${mag("terugkommaatregelAanmaken") ? "aan" : "uit (meldafspraken blijven in de balie)"}.`;
    })();
    const auto = DT.el("input", { type: "checkbox" }); auto.checked = c.autoBijwerken !== false;
    auto.addEventListener("change", async () => { await DT.saveSettings({ cb: { autoBijwerken: auto.checked } }); this.melding("Bewaard."); });
    return DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Magister, mails en berichten" }),
      DT.el("label", { class: "dt-cb-schakel" }, [auto, DT.el("span", { text: "Elke dag automatisch bijwerken uit Magister (verzuim, ouders, mentoren), de eerste keer dat de balie opent" })]),
      DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: "Versturen via" }), kies, DT.el("small", { text: "mails aan het verzuimbureau gaan altijd via je mailprogramma" })]),
      DT.el("p", { class: "dt-cb-zacht", text: "Met Magister-berichten opent per mail een nieuw bericht in Magister met de ontvanger (de student, \"Ouders/verzorgers van\" of \"Mentoren van\"), het onderwerp en de tekst al ingevuld. Je klikt zelf op Verzenden." }),
      status]);
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
    const overGrens = DT.el("input", { type: "checkbox" }); overGrens.checked = !!i.vensterOverGrens;
    overGrens.addEventListener("change", () => { i.vensterOverGrens = overGrens.checked; this.bewaar(); this.melding(overGrens.checked ? "Bewaard: de termijnen tellen nu door over het begin van de periode." : "Bewaard: de termijnen tellen alleen binnen de periode."); });
    const printer = i.bonPrinter?.naam;
    h.replaceChildren(
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Gedeelde map" }),
        DT.el("p", { text: this._map ? `In gebruik: "${this._map.name}" · revisie ${this._basis}${this._door ? ` · laatst opgeslagen door ${this._door} ${this.moment(this._op)}` : ""}.` : "Nog geen map gekozen." }),
        DT.el("p", { class: "dt-cb-zacht", text: "Dezelfde map als de Tardy-app: tardy-gegevens.json en tardy-in-gebruik.json. Jullie werken om de beurt. Een kopie van de stand blijft ook in deze browser bewaard (hooguit één per uur, de laatste 40, en bij een conflict)." }),
        DT.el("div", { class: "dt-cb-rij" }, [this.knop(DT, "Andere map kiezen", () => this.kiesMap(DT)), this.knop(DT, "Meldingen overnemen uit ander bestand…", () => this.importeer(DT)), this.knop(DT, "Reservekopieën…", () => this.kopieVenster(DT)), this.knop(DT, "Map loskoppelen", async () => { if (!confirm("De balie loskoppelen van deze map? De map zelf blijft staan.")) return; await this.bezettingVrij(); await this.kv("map", null); this._map = null; this.koppel(DT); }, false, "stil")])]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Jij" }), DT.el("p", { class: "dt-cb-zacht", text: "Alleen in deze browser, niet in de gedeelde map (zoals in Tardy)." }),
        veld("Naam", "naam"), veld("Paraaf", "paraaf"), veld("E-mail", "email", "email"), veld("Lokaal", "lokaal", "text", c.lokaal || i.lokaal || "", "staat in mails en op het briefje"),
        (() => { const r = veld("Logboektype bij Notitie", "logboekType", "text", c.logboekType || "Notitie", "zoals in Magister › Begeleiding › Toevoegen, bijv. Notitie of Gespreksnotitie");
          const l = DT.el("datalist", { id: "dt-cb-logboektypes" }, ["Notitie", "Gespreksnotitie", "Afspraak", "Incident"].map((v) => DT.el("option", { value: v })));
          r.querySelector("input").setAttribute("list", "dt-cb-logboektypes"); r.append(l); return r; })()]),
      this.berichtenKaart(DT),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Meldafspraken" }),
        DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: "Meldtijd" }), meldtijd, DT.el("small", { text: "gedeeld met Tardy" })]),
        DT.el("p", { class: "dt-cb-zacht", text: `Periodes, mentoren en mailteksten komen uit de gedeelde gegevens en pas je aan in de Tardy-app. Het protocol (${K.protocol().naam || "standaardprotocol"}) pas je aan op het tabblad Protocol.` })]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Signalen" }),
        DT.el("label", { class: "dt-cb-schakel" }, [overGrens, DT.el("span", { text: "Wettelijke termijnen laten doortellen over het begin van de periode" })]),
        DT.el("p", { class: "dt-cb-zacht", text: "Geldt voor \"16 klokuren ongeoorloofd in 4 weken\" en \"ziek in 8 weken\". Uit: alleen de weken binnen de gekozen periode tellen. Aan: de laatste 4 of 8 weken tellen helemaal mee, ook de weken vóór het begin van de periode; verzuim van vlak voor de periodewissel kan dan in beide periodes een signaal geven. Deze keuze staat in de gedeelde gegevens en geldt voor alle collega's." })]),
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
});
