/* Te laat-balie, het tabblad Meldafspraken en de geschiedenis.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
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
        DT.el("td", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: n ? `trede ${n}` : "—" }), DT.el("small", { text: ` ${aantal}` }), ...this.bronChips(DT, m.stamnr, K.UI.periodeId)]),
        DT.el("td", { text: `${K.langDatum(m.datum)} ${m.tijd || ""}` }),
        DT.el("td", {}, this.meldActies(DT, m)),
        DT.el("td", { class: "dt-cb-acties" }, [
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
        DT.el("thead", {}, DT.el("tr", {}, [DT.el("th", {}, alles), ...["Student", "Aanleiding", "Ladder", "Wanneer", "Notitie · mail · agenda", ""].map((t) => DT.el("th", { text: t }))])),
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
    if (n) inhoud.push(DT.el("div", { class: "dt-cb-stapblok" }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("b", { text: `Nieuwe meldafspraak: ${K.langDatum(n.datum)} om ${n.tijd}` })]),
      DT.el("p", { class: "dt-cb-zacht", text: "Leg de nieuwe afspraak vast in het dossier, mail de student (en wie het protocol noemt) en zet hem in de agenda." }),
      this.meldActies(DT, n, opnieuw, false),
    ]));
    this.modal(`Volgende stap voor ${K.naamVan(st)}`, inhoud, [["Sluiten", () => this.sluitModal()]]);
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
});
