/* Te laat-balie, het tabblad Protocol: lezen en aanpassen.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
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
});
