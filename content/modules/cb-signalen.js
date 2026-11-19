/* Te laat-balie, de tabbladen Signalen en Overzicht.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
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
      const meldMaken = () => { const m = this.maakMeld(s); this.teken(); this.melding(`Meldafspraak op ${K.langDatum(m.datum)} om ${m.tijd} staat bij Meldafspraken. Daar maak je ook de notitie en de mail.`, "info", 7000); };
      const pct = K.S.lesreg[s.stamnr]?.perioden?.[pid]?.pct;
      const wat = DT.el("div", { class: "dt-cb-sigwat" }, [
        DT.el("div", { class: "dt-cb-sigregel" }, [
          DT.el("span", { class: `dt-cb-niveau n${s.niveau}`, text: s.consequentie }),
          DT.el("span", { class: "dt-cb-sigtitel", text: s.titel }),
          s.ook.length ? DT.el("span", { class: "dt-cb-ookchip", title: s.ook.map((x) => `${ladderNaam(x.soort)}: ${x.consequentie} (${x.titel})`).join("\n"), text: `+${s.ook.length} ${s.ook.length === 1 ? "ladder" : "ladders"}` }) : null,
          pct != null ? DT.el("span", { class: "dt-cb-pct", title: "Aanwezig volgens Magister, deze periode", text: `${pct}%` }) : null,
          (() => { const m = this.openMeld(s.stamnr); return m ? DT.el("span", { class: "dt-cb-meldchip", title: "Meldafspraak gepland (zie Meldafspraken)", text: `meldt zich ${K.kortDatum(m.datum)} ${m.tijd || ""}` }) : null; })(),
          this.oudersMet18(st) ? DT.el("span", { class: "dt-cb-pct", title: "18+, maar de student gaf in Magister toestemming voor contact met ouders/verzorgers: de mails aan ouders gaan mee", text: "18+ · ouders ✓" }) : null,
          ...this.bronChips(DT, s.stamnr, pid),
        ].filter(Boolean)),
        DT.el("div", { class: "dt-cb-sigmaat", title: s.maatregel, text: s.maatregel }),
      ]);
      wat.addEventListener("click", klap);
      const regel = DT.el("div", { class: "dt-cb-sigrij" }, [
        pijl,
        DT.el("div", { class: "dt-cb-sigwie" }, [this.naamKnop(DT, st), DT.el("small", { text: st.klas || "" })]),
        wat,
        isOpen ? null : DT.el("div", { class: "dt-cb-sigknoppen" }, [
          !s.afgehandeld && this.meldNodig(s) && !this.openMeld(s.stamnr) ? this.ikoonKnop(DT, "meld", "Meldafspraak maken (volgens het protocol): komt in de lijst Meldafspraken", () => meldMaken()) : null,
          this.actieKnoppen(DT, s, st, pid, undefined, true),
          s.afgehandeld ? this.ikoonKnop(DT, "heropen", "Heropen", heropen) : this.ikoonKnop(DT, "af", "Afgehandeld", afhandelen, { hoofd: true }),
        ]),
      ].filter(Boolean));
      const detail = isOpen ? DT.el("div", { class: "dt-cb-sigdetail" }, [
        DT.el("p", { text: s.maatregel }),
        this.meldNodig(s) || this.openMeld(s.stamnr) ? DT.el("div", { class: "dt-cb-meldregel" }, (() => {
          const m = this.openMeld(s.stamnr);
          if (!m) return [DT.el("span", { text: "Volgens het protocol meldt de student zich bij de CB'er. " }), this.knop(DT, "Meldafspraak maken", () => meldMaken(), true, "klein")];
          return [DT.el("span", { text: `Meldafspraak: ${K.langDatum(m.datum)} om ${m.tijd || ""}. ` }), this.meldActies(DT, m, undefined, false),
            this.knop(DT, "Naar Meldafspraken", () => this._scherm.bar.querySelector('[data-view="meldafspraken"]')?.click(), false, "klein stil")];
        })()) : null,
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
        this.bronLijst(DT, s.stamnr, pid),
        DT.el("div", { class: "dt-cb-rij" }, [
          this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st), false, "klein stil"),
          this.knop(DT, "Plan van aanpak", () => this.pvaOpenen(s, st), false, "klein stil"),
          this.sigMails(s).length ? this.knop(DT, "Mailteksten bekijken", async () => (this.sigMails(s).some((t) => (K.MAILSOORT[t] || {}).aan === "ouders") && await this.zorgOuders(st), this.mailLijst(DT, "Mails bij deze stap", `${K.naamVan(st)} · ${s.titel}`,
            this.sigMails(s).map((type) => Object.assign(this.mailVan(type, s.stamnr, pid), { naam: `${K.naamVan(st)} · ${(K.MAILSOORT[type] || { label: type }).label}` })))), false, "klein stil") : null,
          K.S.meldafspraken.some((m) => m.stamnr === s.stamnr) ? this.knop(DT, "Meldafspraken", () => this.studentHistorie(DT, s.stamnr), false, "klein stil") : null,
        ].filter(Boolean)),
      ].filter(Boolean)) : null;
      return DT.el("div", { class: `dt-cb-sig n${s.niveau}${s.afgehandeld ? " is-af" : ""}${isOpen ? " is-open" : ""}` }, [regel, detail].filter(Boolean));
    };
    const perNiveau = [4, 3, 2, 1].map((n) => [n, zicht.filter((s) => s.niveau === n)]).filter(([, l]) => l.length);
    h.replaceChildren(...[
      this.magisterKaart(DT),
      this.anderePeriode(DT, pid),
      this.periodeAfKaart(DT, pid),
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("span", { class: "dt-cb-zacht", text: `${open.length} ${open.length === 1 ? "student" : "studenten"} met een open stap in ${(K.periodeById(pid) || {}).naam || ""}` }), toggle,
        this.knop(DT, "Overzicht per mentor…", () => this.mentorOverzicht(DT)), this.knop(DT, "Weekrapport mentoren…", () => this.weekrapport(DT)), this.knop(DT, "Protocol bekijken", () => this._scherm.bar.querySelector('[data-view="protocol"]')?.click(), false, "stil")]),
      ...(perNiveau.length ? perNiveau.map(([n, l]) => DT.el("dna-card", { class: "dt-cb-kaart dt-cb-niveaugroep" }, [
        DT.el("h2", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: `${n}` }), DT.el("span", { text: ` ${K.NIVEAUNAAM[n]} (${l.length})` })]),
        DT.el("div", { class: "dt-cb-siglijst" }, l.map(rij))]))
        : [DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Geen signalen in deze periode." }))]),
    ].filter(Boolean));
  },

  /* Kijk je naar een andere periode dan de huidige, dan staan nieuwe meldingen hier niet: zeg dat, met een knop terug. */
  anderePeriode(DT, pid) {
    const K = TardyKern, nu = K.periodeVanDatum(K.vandaag());
    if (!nu || nu.id === pid) return null;
    const p = K.periodeById(pid) || {};
    return DT.el("div", { class: "dt-cb-anderedag" }, [
      DT.el("span", { html: `Je bekijkt <b>${K.esc(p.naam || pid)}</b>. Meldingen van nu staan in ${K.esc(nu.naam)}.` }),
      this.knop(DT, `Naar ${nu.naam}`, () => { K.UI.periodeId = nu.id; this._periode.value = nu.id; this.teken(); }, false, "klein")]);
  },
  /* Een afgelopen periode in één keer afsluiten: alle open signalen (ook de lichtere stappen) afgehandeld en
   * open meldafspraken uit die periode vervallen. De geschiedenis blijft bewaard; heropenen kan per signaal. */
  periodeAfKaart(DT, pid) {
    const K = TardyKern, p = K.periodeById(pid);
    if (!p || p.eind >= K.vandaag()) return null;
    const sigs = K.alleSignalen(pid).filter((s) => !s.afgehandeld);
    const mafs = K.S.meldafspraken.filter((m) => m.status === "open" && (m.datum <= p.eind) && ((m.gemaaktOp || m.datum) >= p.start));
    if (!sigs.length && !mafs.length) return null;
    const studenten = new Set(sigs.map((s) => s.stamnr)).size;
    const doe = () => {
      if (this._kijkt) return this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus er wordt niets afgehandeld.`, "err");
      const wat = [sigs.length ? `${sigs.length} open ${sigs.length === 1 ? "signaal" : "signalen"} (${studenten} ${studenten === 1 ? "student" : "studenten"})` : "", mafs.length ? `${mafs.length} open ${mafs.length === 1 ? "meldafspraak" : "meldafspraken"}` : ""].filter(Boolean).join(" en ");
      if (!confirm(`${p.naam} is afgelopen. ${wat} afhandelen?

Signalen krijgen de status afgehandeld, meldafspraken vervallen. Je kunt ze later per stuk heropenen.`)) return;
      const op = K.vandaag();
      for (const s of sigs) K.S.afhandelingen[s.key] = { status: "gedaan", op, notitie: `${p.naam} afgesloten` };
      for (const m of mafs) this.rondAf(m, "vervallen", { notitie: `${p.naam} afgesloten` });
      this.bewaar(); this.teken();
      this.melding(`${p.naam} afgesloten: ${wat} afgehandeld.`, "info", 7000);
    };
    return DT.el("dna-card", { class: "dt-cb-kaart dt-cb-periodeaf" }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [
        DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: `${p.naam} is afgelopen` }),
          DT.el("small", { text: `Nog open: ${sigs.length} ${sigs.length === 1 ? "signaal" : "signalen"} bij ${studenten} ${studenten === 1 ? "student" : "studenten"}${mafs.length ? ` en ${mafs.length} ${mafs.length === 1 ? "meldafspraak" : "meldafspraken"}` : ""}. Na de periode mag alles in één keer worden afgehandeld.` })]),
        this.knop(DT, "Alles afhandelen", doe, true),
      ]),
    ]);
  },

  /* Meldingen uit een ander Tardy-bestand overnemen (bijv. een oudere tardy-gegevens.json van vóór de gedeelde
   * map). Alleen wat er nog niet is: zelfde id, of zelfde student, datum, tijd en soort, wordt overgeslagen. */
  importeer(DT) {
    const K = TardyKern;
    if (this._kijkt) return this.melding("Je kijkt mee; overnemen kan pas als jij in Tardy werkt.", "err");
    const inp = DT.el("input", { type: "file", accept: ".json,application/json" });
    inp.addEventListener("change", async () => {
      let g; try { g = JSON.parse(await inp.files[0].text()); } catch { return this.melding("Dit is geen leesbaar Tardy-bestand.", "err"); }
      if (!g || !Array.isArray(g.registraties)) return this.melding("In dit bestand staan geen meldingen van Tardy.", "err");
      const S = K.S, sl = (r) => `${r.stamnr}|${r.datum}|${r.tijd}|${r.soort}`;
      const ids = new Set(S.registraties.map((r) => r.id)), sleutels = new Set(S.registraties.map(sl));
      const regs = g.registraties.filter((r) => r && r.stamnr && r.datum && r.soort && !ids.has(r.id) && !sleutels.has(sl(r)));
      const mIds = new Set(S.meldafspraken.map((m) => m.id)), mSl = new Set(S.meldafspraken.map((m) => `${m.stamnr}|${m.datum}|${m.aanleiding}`));
      const mafs = (Array.isArray(g.meldafspraken) ? g.meldafspraken : []).filter((m) => m && m.stamnr && !mIds.has(m.id) && !mSl.has(`${m.stamnr}|${m.datum}|${m.aanleiding}`));
      const nodig = new Set([...regs, ...mafs].map((x) => x.stamnr));
      const nieuweSt = [...nodig].filter((sn) => !S.studenten[sn] && g.studenten?.[sn]);
      const zonder = [...nodig].filter((sn) => !S.studenten[sn] && !g.studenten?.[sn]);
      if (!regs.length && !mafs.length) return this.melding("Alles uit dit bestand staat al in de gedeelde map.");
      const ds = regs.map((r) => r.datum).sort();
      const per = {}; for (const r of regs) { const n = (K.periodeVanDatum(r.datum) || { naam: "buiten de periodes" }).naam; per[n] = (per[n] || 0) + 1; }
      this.modal("Meldingen overnemen", [
        DT.el("p", { text: `Uit "${inp.files[0].name}":` }),
        DT.el("ul", {}, [
          regs.length ? DT.el("li", { text: `${regs.length} ${regs.length === 1 ? "melding" : "meldingen"} (${K.kortDatum(ds[0])} t/m ${K.kortDatum(ds[ds.length - 1])}; ${Object.entries(per).map(([n, a]) => `${n}: ${a}`).join(", ")})` }) : null,
          mafs.length ? DT.el("li", { text: `${mafs.length} ${mafs.length === 1 ? "meldafspraak" : "meldafspraken"}` }) : null,
          nieuweSt.length ? DT.el("li", { text: `${nieuweSt.length} ${nieuweSt.length === 1 ? "student" : "studenten"} die nog niet in de gedeelde map ${nieuweSt.length === 1 ? "staat" : "staan"} (worden toegevoegd)` }) : null,
          zonder.length ? DT.el("li", { text: `${zonder.length} stamnummer(s) zonder studentgegevens: die meldingen worden wel overgenomen` }) : null,
        ].filter(Boolean)),
        DT.el("p", { class: "dt-cb-zacht", text: "Wat er al is (zelfde melding) wordt overgeslagen. Er verdwijnt niets uit de gedeelde map; signalen en meldafspraken tellen de overgenomen meldingen direct mee." }),
      ], [["Annuleren", () => this.sluitModal()], ["Overnemen", () => {
        for (const sn of nieuweSt) S.studenten[sn] = g.studenten[sn];
        S.registraties.push(...regs.map((r) => Object.assign({}, r, { overgenomen: inp.files[0].name })));
        S.meldafspraken.push(...mafs);
        K.normaliseer();
        this.sluitModal(); this.bewaar(); this.teken();
        this.melding(`${regs.length} ${regs.length === 1 ? "melding" : "meldingen"}${mafs.length ? ` en ${mafs.length} ${mafs.length === 1 ? "meldafspraak" : "meldafspraken"}` : ""} overgenomen.`, "info", 7000);
      }, true]]);
    });
    inp.click();
  },

  /* ===================================================================================== */
  /* Overzicht: waar is de student, en alles wat er op een dag geregistreerd is                */
  /* ===================================================================================== */
  overzicht(DT) {
    const K = TardyKern, h = this._scherm.hoofd, vandaag = K.vandaag();
    const dag = this._ovDag && this._ovDag <= vandaag ? this._ovDag : vandaag;
    /* ---- Waar is …? ---- */
    const zoek = DT.el("input", { type: "search", class: "dt-cb-zoek", placeholder: "Waar is…? Naam of stamnummer", autocomplete: "off", "aria-label": "Student zoeken" });
    const hits = DT.el("div", { class: "dt-cb-hits", role: "listbox" });
    const waar = DT.el("div", { class: "dt-cb-waar" });
    const kies = (st) => { zoek.value = ""; hits.replaceChildren(); this._waar = st; this.waarIs(DT, waar, st); };
    const toonHits = (lokaal, mag = []) => hits.replaceChildren(...[...lokaal.map((st) => ({ st })), ...mag.filter((m) => !K.S.studenten[m.stamnr]).map((m) => ({ st: m, m: true }))].slice(0, 8).map(({ st, m }) => {
      const b = DT.el("button", { type: "button", role: "option", class: "dt-cb-hit" }, [
        DT.el("span", { class: "dt-cb-mono", text: ((st.roepnaam || "")[0] || "") + ((st.achternaam || "")[0] || "") }),
        DT.el("span", { class: "dt-cb-hitnaam" }, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: `${st.klas || "geen klas"} · ${st.stamnr}${m ? " · uit Magister" : ""}` })])]);
      b.addEventListener("click", () => kies(st)); return b;
    }));
    let nr = 0;
    zoek.addEventListener("input", () => {
      const q = zoek.value.trim(); toonHits(this.zoekLokaal(q)); clearTimeout(this._ovT);
      if (q.length >= 3) { const n = ++nr; this._ovT = setTimeout(async () => { const m = await this.zoekMagister(q); if (n === nr && zoek.value.trim() === q) toonHits(this.zoekLokaal(q), m); }, 350); }
    });
    zoek.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); hits.querySelector(".dt-cb-hit")?.click(); } });
    /* ---- Registraties op een dag ---- */
    const datum = DT.el("input", { type: "date", class: "dt-cb-veld dt-cb-datum", value: dag, max: vandaag, "aria-label": "Datum" });
    datum.addEventListener("change", () => { this._ovDag = datum.value || null; this.teken(); });
    const stap = (n) => { const d = K.plusDagen(dag, n); if (d <= vandaag) { this._ovDag = d; this.teken(); } };
    const GROEP = [["", "Alles"], ["telaat", "Te laat"], ["ongeoorloofd", "Ongeoorloofd"], ["ziek", "Ziek"], ["medisch", "Medisch"], ["calamiteit", "Calamiteit"], ["geoorloofd", "Geoorloofd"], ["meld", "Meldafspraken"]];
    const soort = DT.el("select", { class: "dt-cb-veld", "aria-label": "Soort" }, GROEP.map(([v, t]) => DT.el("option", { value: v, text: t })));
    soort.value = this._ovSoort || "";
    soort.addEventListener("change", () => { this._ovSoort = soort.value; this.teken(); });
    const filter = DT.el("input", { type: "search", class: "dt-cb-veld", placeholder: "Filter op naam of klas", value: this._ovFilter || "", "aria-label": "Filter" });
    filter.addEventListener("input", () => { this._ovFilter = filter.value; clearTimeout(this._ovF); this._ovF = setTimeout(() => { this.teken(); setTimeout(() => { const f = this._scherm?.hoofd.querySelector(".dt-cb-ovfilter"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 0); }, 250); });
    filter.classList.add("dt-cb-ovfilter");
    const past = (st) => { const q = (this._ovFilter || "").trim().toLowerCase(); return !q || K.naamVan(st).toLowerCase().includes(q) || String(st.klas || "").toLowerCase().includes(q) || String(st.stamnr).includes(q); };
    const regs = K.S.registraties.filter((r) => r.datum === dag);
    const mafs = K.S.meldafspraken.filter((m) => m.datum === dag);
    const telG = (g) => regs.filter((r) => (K.SOORT[r.soort] || {}).g === g).length;
    const rijen = [
      ...regs.filter((r) => !this._ovSoort || this._ovSoort === (K.SOORT[r.soort] || {}).g).map((r) => ({ tijd: r.tijd || "", sn: r.stamnr, r })),
      ...(!this._ovSoort || this._ovSoort === "meld" ? mafs.map((m) => ({ tijd: m.tijd || "", sn: m.stamnr, m })) : []),
    ].filter((x) => past(K.S.studenten[x.sn] || { stamnr: x.sn })).sort((a, b) => (a.tijd || "").localeCompare(b.tijd || ""));
    const chip = (n, t, kl = "") => n ? DT.el("span", { class: `dt-cb-ovchip ${kl}`, text: `${n} ${t}` }) : null;
    const verschenen = mafs.filter((m) => m.status === "verschenen").length;
    const tabel = rijen.length ? DT.el("table", { class: "dt-cb-tabel dt-cb-ovtabel" }, [
      DT.el("thead", {}, DT.el("tr", {}, ["Tijd", "Student", "Wat", "Reden / status", "Briefje", "In Magister", ""].map((t) => DT.el("th", { text: t })))),
      DT.el("tbody", {}, rijen.map((x) => {
        const st = K.S.studenten[x.sn] || { stamnr: x.sn, roepnaam: x.sn };
        const waarKnop = this.knop(DT, "Waar is…?", () => { this._waar = st; this.waarIs(DT, waar, st); waar.scrollIntoView({ block: "start", behavior: "smooth" }); }, false, "klein stil");
        if (x.r) {
          const g = (K.SOORT[x.r.soort] || {}).g;
          return DT.el("tr", {}, [DT.el("td", { text: x.tijd }), DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}` })]),
            DT.el("td", {}, DT.el("span", { class: `dt-cb-ovsoort g-${g}`, text: K.soortNaam(x.r.soort) })), DT.el("td", { text: x.r.reden || "" }),
            DT.el("td", { text: x.r.terug === undefined ? "—" : x.r.terug ? "terug" : "niet terug" }), DT.el("td", {}, this.magisterVink(DT, x.r)), DT.el("td", {}, waarKnop)]);
        }
        const u = this.uitkomst(x.m);
        return DT.el("tr", {}, [DT.el("td", { text: x.tijd }), DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}` })]),
          DT.el("td", {}, DT.el("span", { class: "dt-cb-ovsoort g-meld", text: "Meldafspraak" })), DT.el("td", {}, DT.el("span", { class: `dt-cb-uitkomst ${u.k}`, text: `${u.tekst}${x.m.aanleiding ? ` · ${K.AANLEIDING[x.m.aanleiding] || x.m.aanleiding}` : ""}` })),
          DT.el("td", { text: "—" }), DT.el("td", { text: "—" }), DT.el("td", {}, waarKnop)]);
      })),
    ]) : DT.el("p", { class: "dt-cb-zacht", text: regs.length || mafs.length ? "Niets dat past bij dit filter." : `Geen meldingen of meldafspraken op ${dag === vandaag ? "vandaag" : K.langDatum(dag)}.` });
    h.replaceChildren(...[
      DT.el("dna-card", { class: "dt-cb-kaart" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: "Waar is de student?" }), DT.el("small", { text: "Zoek een student: je ziet de les en het lokaal van nu, het rooster van vandaag met de registraties uit Magister, en wat er bij de balie is gemeld." })])]),
        zoek, hits, waar]),
      DT.el("dna-card", { class: "dt-cb-kaart" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: dag === vandaag ? "Registraties vandaag" : `Registraties op ${K.langDatum(dag)}` }),
          DT.el("small", { text: "Alle meldingen bij de balie en de meldafspraken van die dag, met en zonder meldafspraak." })])]),
        DT.el("div", { class: "dt-cb-rij dt-cb-ovbalk" }, [
          this.knop(DT, "‹", () => stap(-1), false, "klein"), datum, this.knop(DT, "›", () => stap(1), false, "klein"),
          dag !== vandaag ? this.knop(DT, "Vandaag", () => { this._ovDag = null; this.teken(); }, false, "klein stil") : null, soort, filter].filter(Boolean)),
        DT.el("div", { class: "dt-cb-rij dt-cb-ovchips" }, [chip(telG("telaat"), "te laat"), chip(telG("ongeoorloofd"), "ongeoorloofd", "nok"), chip(telG("ziek"), "ziek"), chip(telG("medisch"), "medisch"), chip(telG("calamiteit"), "calamiteit"),
          chip(mafs.length, `${mafs.length === 1 ? "meldafspraak" : "meldafspraken"}${mafs.length ? ` (${verschenen} verschenen)` : ""}`, "meld"), regs.length || mafs.length ? null : DT.el("span", { class: "dt-cb-zacht", text: "Niets geregistreerd." })].filter(Boolean)),
        tabel]),
    ]);
    if (this._waar) this.waarIs(DT, waar, this._waar);
  },
  /* Rooster en registraties van vandaag uit Magister (live), plus wat de balie weet. */
  async waarIs(DT, doel, st) {
    const K = TardyKern, vandaag = K.vandaag(), nu = new Date();
    const regs = K.S.registraties.filter((r) => r.stamnr === st.stamnr && r.datum === vandaag).sort((a, b) => (a.tijd || "").localeCompare(b.tijd || ""));
    const maf = K.S.meldafspraken.filter((m) => m.stamnr === st.stamnr && m.datum === vandaag);
    const kop = DT.el("div", { class: "dt-cb-kaartkop" }, [
      DT.el("div", { class: "dt-cb-wie" }, [DT.el("h3", { text: K.naamVan(st) }), DT.el("small", { text: [st.klas || "geen klas", st.stamnr].filter(Boolean).join(" · ") })]),
      this.knop(DT, "Opnieuw", () => this.waarIs(DT, doel, st), false, "klein stil"),
      this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st), false, "klein stil"),
      this.knop(DT, "Sluiten", () => { this._waar = null; doel.replaceChildren(); }, false, "klein stil")]);
    const balie = DT.el("div", { class: "dt-cb-rij" }, [
      DT.el("b", { text: "Balie vandaag:" }),
      ...(regs.length ? regs.map((r) => DT.el("span", { class: `dt-cb-ovsoort g-${(K.SOORT[r.soort] || {}).g}`, text: `${K.soortNaam(r.soort)} ${r.tijd || ""}${r.reden ? ` (${r.reden})` : ""}` })) : [DT.el("span", { class: "dt-cb-zacht", text: "niets gemeld" })]),
      ...maf.map((m) => DT.el("span", { class: "dt-cb-ovsoort g-meld", text: `Meldafspraak ${m.tijd || ""}: ${this.uitkomst(m).tekst.toLowerCase()}` }))]);
    doel.replaceChildren(kop, balie, DT.el("p", { class: "dt-cb-zacht", text: "Rooster en registraties uit Magister ophalen…" }));
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; }
    if (!id) return doel.replaceChildren(kop, balie, DT.el("p", { class: "dt-cb-zacht", text: "Deze student is niet gevonden in Magister." }));
    const lijst = (x) => (x && x.status === 200 && x.json) ? (Array.isArray(x.json) ? x.json : x.json.items || []) : null;
    const [a, v] = await Promise.all([DT.api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${vandaag}&einde=${vandaag}`, { full: true, timeout: 15000 }), DT.api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${vandaag}&einde=${vandaag}`, { full: true, timeout: 15000 })]);
    if (this._waar !== st || !doel.isConnected) return;
    const rooster = lijst(a), vr = lijst(v) || [];
    if (!rooster) return doel.replaceChildren(kop, balie, DT.el("p", { class: "dt-cb-zacht", text: `Het rooster kon niet worden opgehaald (${a.status}).` }));
    const tijd = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const lokaal = new Map(rooster.map((x) => [String(x.id), (x.locaties || x.lokalen || []).map((l) => l.code || l.naam || l.omschrijving).filter(Boolean).join(", ") || x.locatie || ""]));
    const begin = new Date(`${vandaag}T00:00:00`), eind = new Date(`${vandaag}T23:59:59`);
    const S = typeof vzStats === "function" ? vzStats(vr, rooster, begin, eind) : { lessen: [] };
    const lessen = S.lessen.slice().sort((x, y) => x.begin - y.begin);
    const NAAM = { OK: "", TL: "te laat", AB_OK: "absent (geoorloofd)", AB_NO: "absent (ongeoorloofd)", ZK: "ziek", UI: "uitgestuurd", VR: "vrijstelling" };
    const huidig = lessen.find((l) => l.begin <= nu && nu < l.einde), volgende = lessen.find((l) => l.begin > nu);
    const lesTekst = (l) => `${l.vak}${lokaal.get(String(l.id)) ? ` in ${lokaal.get(String(l.id))}` : ""}${l.docent ? ` bij ${l.docent}` : ""}`;
    const afwezigNu = huidig && ["AB_OK", "AB_NO", "ZK", "UI"].includes(huidig.cat);
    const ziekBalie = regs.some((r) => ["ziek", "medisch", "geoorloofd"].includes((K.SOORT[r.soort] || {}).g));
    const nuRegel = huidig
      ? DT.el("div", { class: `dt-cb-nu${afwezigNu ? " is-weg" : ""}` }, [DT.el("small", { text: `Nu (${tijd(huidig.begin)}–${tijd(huidig.einde)})` }), DT.el("b", { text: lesTekst(huidig) }),
          huidig.cat !== "OK" ? DT.el("span", { text: `Magister: ${NAAM[huidig.cat] || huidig.regs}` }) : DT.el("span", { class: "dt-cb-zacht", text: "nog geen registratie in deze les" })])
      : DT.el("div", { class: "dt-cb-nu is-leeg" }, [DT.el("small", { text: "Nu" }), DT.el("b", { text: lessen.length ? (volgende ? "Geen les op dit moment" : "De lessen van vandaag zijn voorbij") : "Geen lessen vandaag" }),
          volgende ? DT.el("span", { text: `Volgende: ${tijd(volgende.begin)} ${lesTekst(volgende)}` }) : null].filter(Boolean));
    const aanwezigTekst = afwezigNu ? "Afwezig volgens Magister" : ziekBalie ? "Afgemeld bij de balie" : lessen.some((l) => l.einde <= nu && ["AB_OK", "AB_NO", "ZK", "UI"].includes(l.cat)) ? "Eerder vandaag afwezig" : lessen.some((l) => l.cat === "TL") || regs.some((r) => (K.SOORT[r.soort] || {}).g === "telaat") ? "Aanwezig (te laat)" : "Geen afwezigheid geregistreerd";
    const tabel = lessen.length ? DT.el("table", { class: "dt-cb-tabel dt-cb-rooster" }, [
      DT.el("thead", {}, DT.el("tr", {}, ["Tijd", "Vak", "Lokaal", "Docent", "Magister"].map((t) => DT.el("th", { text: t })))),
      DT.el("tbody", {}, lessen.map((l) => DT.el("tr", { class: `${l === huidig ? "is-nu" : ""}${l.einde <= nu ? " is-voorbij" : ""}` }, [
        DT.el("td", { text: `${tijd(l.begin)}–${tijd(l.einde)}` }), DT.el("td", { text: l.vak }), DT.el("td", { text: lokaal.get(String(l.id)) || "—" }), DT.el("td", { text: l.docent || "—" }),
        DT.el("td", {}, l.cat !== "OK" ? DT.el("span", { class: `dt-cb-ovsoort c-${l.cat}`, text: NAAM[l.cat] || l.regs }) : DT.el("span", { class: "dt-cb-zacht", text: l.einde <= nu ? "geen registratie" : "—" }))]))),
    ]) : null;
    doel.replaceChildren(...[kop, DT.el("p", { class: `dt-cb-aanwezig${afwezigNu || ziekBalie ? " is-weg" : ""}`, text: aanwezigTekst }), nuRegel, balie, tabel,
      DT.el("p", { class: "dt-cb-zacht", text: `Rooster en registraties live uit Magister (${tijd(nu)}). "Geen registratie" betekent dat de docent niemand afwezig heeft gemeld, of nog niet heeft geregistreerd.` })].filter(Boolean));
  },
});
