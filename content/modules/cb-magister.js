/* Te laat-balie, verzuim uit Magister ophalen en combineren met de eigen meldingen.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
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

  apiOpnieuw(url) {
    return DT.apiRetry(url);
  },

  async haalMagister(DT, stamnrs, { stil = false } = {}) {
    const K = TardyKern;
    if (this._haal) return stil ? false : this.melding("Er wordt al opgehaald.");
    if (this._kijkt) return this.melding("Je kijkt mee; ophalen kan pas als jij in Tardy werkt.", "err");
    const per = K.periodes().slice().sort((a, b) => a.start.localeCompare(b.start));
    const van = new Date(per[0].start + "T00:00:00"), nu = new Date(), vandaag = this.ymd(nu);
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
          const { regs, rooster } = await vzBron.haal(id, van, nu, { api: (u) => this.apiOpnieuw(u), pauze: 1, los: 0, vers: true });
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
          /* Elke les met een registratie (niet "aanwezig"), kort: datum, begintijd, categorie en bij ongeoorloofd de
           * uren. Daarmee combineren we de eigen meldingen met Magister (zie tellingenPlus en magisterStand). */
          const tijd = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          const lessen = jaar.lessen.filter((l) => l.cat && l.cat !== "OK").map((l) => Object.assign({ d: datum(l.begin), b: tijd(l.begin), c: l.cat },
            l.cat === "AB_NO" ? { u: Math.round(100 * Math.max(0.25, (l.einde - l.begin) / 3.6e6 || 1)) / 100 } : {}));
          K.S.lesreg[sn] = { op: vandaag, opUur: tijd(new Date()), bron: "magister", ziekDatums: [...ziek].sort(), medischDatums: [...med].sort(), onUren, perioden, lessen };
          if (!stil) { await this.ouderMails(st, id).catch(() => {}); await this.mentorUitMagister(st, id).catch(() => {}); }
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
    if (!stil) this.melding(`Verzuim van ${H.klaar - H.fout} ${H.klaar - H.fout === 1 ? "student" : "studenten"} uit Magister bijgewerkt${H.fout ? `, ${H.fout} niet gelukt` : ""}.`, H.fout ? "err" : "info", 7000);
    if (this._scherm) this.teken();
    return H.klaar - H.fout;
  },

  /* ===================================================================================== */
  /* Eigen invoer gecombineerd met Magister                                                 */
  /* ===================================================================================== */
  /* De telling van Tardy telt alleen de eigen meldingen. Hier vullen we aan met wat er in Magister staat:
   *  - te laat dat alleen in Magister staat (door een docent geregistreerd), per dag; een dag met een eigen
   *    melding (te laat of calamiteit) telt één keer;
   *  - ongeoorloofd in Magister zonder de lessen vóór een melding bij de balie: dat is dezelfde keer te laat,
   *    die nog niet is omgezet in Magister.
   * Via de haak in de kern rekenen de signalen, het gevolg bij een nieuwe melding, de meldafspraken en de
   * mailteksten allemaal met deze telling. */
  haken() {
    const K = TardyKern;
    K.H.tellingenPlus = (t, sn, pid) => this.tellingenPlus(t, sn, pid);
    /* "16 klokuren in 4 weken" en "ziek in 8 weken" keken altijd naar de laatste weken vanaf vandaag, ook bij een
     * andere periode. Nu: de weken tot het einde van de gekozen periode (of tot vandaag), en niets voor een periode
     * die nog moet beginnen. Standaard stopt het venster bij het begin van de periode; met de gedeelde instelling
     * vensterOverGrens (Instellingen › Signalen) loopt het door in de weken ervoor, zodat verzuim rond een
     * periodewissel ook de wettelijke grens kan halen. */
    const venster = (pid, dagen) => {
      const p = K.periodeById(pid), v = K.vandaag();
      if (!p || p.start > v) return null;
      const eind = p.eind < v ? p.eind : v, van = K.plusDagen(eind, -dagen);
      return { van: van < p.start && !K.S.instellingen.vensterOverGrens ? p.start : van, tot: eind };
    };
    const k4 = K.TELLERS.klokuren4w;
    if (k4 && !k4._dt) {
      k4._dt = true;
      k4.waarde = (sn, pid) => {
        const w = venster(pid, 28), ls = K.S.lesreg[sn]; if (!w || !ls) return null;
        const binnen = (d) => d >= w.van && d <= w.tot;
        if (Array.isArray(ls.lessen)) {
          const laat = this.laatDagen(sn, binnen);
          return ls.lessen.filter((l) => l.c === "AB_NO" && binnen(l.d) && !(laat.has(l.d) && l.b < laat.get(l.d))).reduce((a, l) => a + (l.u || 1), 0);
        }
        return (ls.onUren || []).filter((u) => binnen(u.datum)).reduce((a, u) => a + u.uren, 0);
      };
    }
    const z8 = K.TELLERS.ziek8w;
    if (z8 && !z8._dt) {
      z8._dt = true;
      z8.waarde = (sn, pid) => {
        const w = venster(pid, 56); if (!w) return null;
        const binnen = (d) => d >= w.van && d <= w.tot, set = new Set();
        K.S.registraties.filter((r) => r.stamnr === sn && (K.SOORT[r.soort] || {}).g === "ziek" && binnen(r.datum)).forEach((r) => set.add(r.datum));
        (K.S.lesreg[sn]?.ziekDatums || []).filter(binnen).forEach((d) => set.add(d));
        return set.size;
      };
    }
    const og = K.TELLERS.ongeoorloofd;
    if (og && !og._dt) {
      og._dt = true;
      og.titel = (w, t) => `${w}× ongeoorloofd verzuim${t?.ongeoorloofdAlleenBalie?.length ? ` (waarvan ${t.ongeoorloofdAlleenBalie.length} alleen bij de balie)` : ""}`;
    }
    const tl = K.TELLERS.telaat;
    if (tl && !tl._dt) {
      tl._dt = true;
      tl.titel = (w, t) => `${w}× te laat${t?.teLaatAlleenMagister?.length ? ` (waarvan ${t.teLaatAlleenMagister.length} alleen in Magister)` : ""}`;
    }
  },
  laatDagen(sn, inP) {
    const K = TardyKern, uit = new Map();   // datum -> laatste meldtijd bij de balie
    for (const r of K.S.registraties) {
      if (r.stamnr !== sn || !inP(r.datum)) continue;
      const g = (K.SOORT[r.soort] || {}).g;
      if (g !== "telaat" && g !== "calamiteit") continue;
      const tijd = r.tijd || "23:59", o = uit.get(r.datum);
      if (!o || tijd > o) uit.set(r.datum, tijd);
    }
    return uit;
  },
  tellingenPlus(t, sn, pid) {
    const K = TardyKern, ls = K.S?.lesreg?.[sn], p = K.periodeById(pid);
    if (!ls || ls.bron !== "magister" || !Array.isArray(ls.lessen) || !p) return t;
    const inP = (d) => d >= p.start && d <= p.eind;
    const laat = this.laatDagen(sn, inP), les = ls.lessen.filter((l) => inP(l.d));
    const alleenMag = [...new Set(les.filter((l) => l.c === "TL").map((l) => l.d))].filter((d) => !laat.has(d)).sort();
    const ab = les.filter((l) => l.c === "AB_NO");
    const on = ab.filter((l) => !(laat.has(l.d) && l.b < laat.get(l.d)));
    /* Eigen meldingen ongeoorloofd op een dag waarop Magister (nog) niets ongeoorloofd heeft, tellen erbij op
     * (één per dag). Staat het ook in Magister, dan telt het één keer: via Magister. */
    const magDagen = new Set(on.map((l) => l.d));
    const eigenOn = [...new Set(K.S.registraties.filter((r) => r.stamnr === sn && inP(r.datum) && (K.SOORT[r.soort] || {}).g === "ongeoorloofd").map((r) => r.datum))];
    const alleenBalie = eigenOn.filter((d) => !magDagen.has(d)).sort();
    return Object.assign({}, t, {
      teLaat: t.teLaat + alleenMag.length, teLaatBalie: t.teLaat, teLaatAlleenMagister: alleenMag,
      onMagister: on.length, ongeoorloofd: on.length + alleenBalie.length, ongeoorloofdAlleenBalie: alleenBalie, ongeoorloofdVoorMelding: ab.length - on.length,
      klokuren: on.reduce((a, l) => a + (l.u || 1), 0), klokurenExact: true,
    });
  },
  /* Wat Magister bij een eigen melding laat zien. bekend = er is opgehaald ná de melding. */
  magisterStand(r) {
    const K = TardyKern, ls = K.S.lesreg[r.stamnr], g = (K.SOORT[r.soort] || {}).g;
    if (!ls || ls.bron !== "magister" || !Array.isArray(ls.lessen) || `${ls.op} ${ls.opUur || "00:00"}` < `${r.datum} ${r.tijd || "00:00"}`) return { bekend: false };
    const dag = ls.lessen.filter((l) => l.d === r.datum), heeft = (...c) => dag.some((l) => c.includes(l.c));
    const st = { bekend: true, op: `${K.kortDatum(ls.op)} ${ls.opUur || ""}`.trim(), gezien: false, nogOngeoorloofd: false };
    if (g === "telaat" || g === "calamiteit") {
      st.gezien = g === "telaat" ? heeft("TL") : heeft("TL", "AB_OK");
      st.nogOngeoorloofd = !st.gezien && dag.some((l) => l.c === "AB_NO" && (!r.tijd || l.b < r.tijd));
    } else if (g === "ongeoorloofd") st.gezien = heeft("AB_NO");
    else if (g === "ziek") st.gezien = heeft("ZK");
    else if (g === "medisch" || g === "geoorloofd") st.gezien = heeft("AB_OK", "VR");
    else if (g === "incident") st.gezien = heeft("UI");
    return st;
  },
  telt(r) { const g = (TardyKern.SOORT[r.soort] || {}).g; return !!g && g !== "aanwezig" && g !== "overig"; },
  nogInMagister(r) { if (!this.telt(r)) return false; const m = this.magisterStand(r); return !m.gezien && (!r.magister || !!m.nogOngeoorloofd); },
  /* Vinkje "In Magister": zelf aanvinken als je het hebt aangepast; staat het (na ophalen) in Magister, dan staat
   * het vanzelf aan. Bij aanvinken wordt deze student meteen opnieuw opgehaald om het te controleren. */
  magisterVink(DT, r, tekst = "") {
    if (!this.telt(r)) return DT.el("span", { class: "dt-cb-zacht", text: "—" });
    const K = TardyKern, st = K.S.studenten[r.stamnr] || {}, m = this.magisterStand(r);
    const vink = DT.el("input", { type: "checkbox", "aria-label": `${K.soortNaam(r.soort)} van ${K.naamVan(st)} aangepast in Magister` });
    vink.checked = !!r.magister || m.gezien;
    if (m.gezien) vink.disabled = true;
    vink.addEventListener("change", () => { r.magister = vink.checked; this.bewaar(); this.teken(); if (vink.checked) this.controleer(DT, [r.stamnr]); });
    const sub = m.gezien ? "staat in Magister" : m.nogOngeoorloofd ? "Magister: nog ongeoorloofd" : r.magister && !m.bekend ? "nog niet gecontroleerd" : "";
    const titel = m.gezien ? `Staat in Magister (opgehaald ${m.op}).`
      : m.nogOngeoorloofd ? `Volgens Magister (opgehaald ${m.op}) staat ${st.roepnaam || "de student"} vóór ${r.tijd} nog op ongeoorloofd afwezig. Zet het om naar ${K.soortNaam(r.soort).toLowerCase()}.`
      : r.magister ? "Zelf aangevinkt. Bij de volgende keer ophalen wordt het in Magister gecontroleerd." : "Vink aan zodra je dit in Magister hebt aangepast.";
    return DT.el("label", { class: `dt-cb-magvink${m.gezien ? " is-ok" : m.nogOngeoorloofd ? " is-nok" : ""}`, title: titel },
      [vink, tekst ? DT.el("span", { text: tekst }) : null, sub ? DT.el("small", { text: sub }) : null].filter(Boolean));
  },
  async controleer(DT, sns, luid = false) {
    const K = TardyKern;
    if (this._kijkt) return luid && this.melding("Je kijkt mee; ophalen kan pas als jij in Tardy werkt.", "err");
    if (this._haal) return luid && this.melding("Er wordt al opgehaald; probeer het zo nog eens.");
    if (luid) this.melding(`${sns.length} ${sns.length === 1 ? "student" : "studenten"} controleren in Magister…`, "info", 4000);
    const n = await this.haalMagister(DT, sns, { stil: true });
    if (!luid) return;
    const nog = K.S.registraties.filter((r) => r.datum === K.vandaag() && sns.includes(r.stamnr) && this.nogInMagister(r)).length;
    this.melding(n === false ? "Ophalen lukte niet." : nog ? `Gecontroleerd: ${nog} ${nog === 1 ? "melding staat" : "meldingen staan"} nog niet goed in Magister.` : "Gecontroleerd: alles staat in Magister.", nog ? "err" : "info", 7000);
  },
  /* Bronnen van de telling deze periode: eigen meldingen (met briefje en Magister-stand) en te laat dat alleen in Magister staat. */
  bronnen(sn, pid) {
    const K = TardyKern, p = K.periodeById(pid); if (!p) return [];
    const inP = (d) => d >= p.start && d <= p.eind;
    const eigen = K.S.registraties.filter((r) => r.stamnr === sn && inP(r.datum) && this.telt(r)).map((r) => ({ datum: r.datum, tijd: r.tijd, soort: K.soortNaam(r.soort), r, m: this.magisterStand(r) }));
    const t = K.tellingen(sn, pid);
    const mag = (t.teLaatAlleenMagister || []).map((d) => ({ datum: d, tijd: (K.S.lesreg[sn].lessen.find((l) => l.d === d && l.c === "TL") || {}).b || "", soort: "Te laat", magister: true }));
    return eigen.concat(mag).sort((a, b) => `${b.datum} ${b.tijd}`.localeCompare(`${a.datum} ${a.tijd}`));
  },
  bronChips(DT, sn, pid) {
    const K = TardyKern, t = K.tellingen(sn, pid), uit = [];
    const nog = this.bronnen(sn, pid).filter((b) => b.r && this.nogInMagister(b.r));
    if (t.teLaatAlleenMagister?.length) uit.push(DT.el("span", { class: "dt-cb-pct", title: `Te laat in Magister zonder melding bij de balie: ${t.teLaatAlleenMagister.map((d) => K.kortDatum(d)).join(", ")}. Telt mee in de ladder.`, text: `${t.teLaatAlleenMagister.length}× te laat uit Magister` }));
    if (nog.length) uit.push(DT.el("span", { class: "dt-cb-magchip", title: `Nog niet (goed) in Magister:\n${nog.map((b) => `${K.kortDatum(b.datum)} ${b.tijd || ""} ${b.soort}${b.m.nogOngeoorloofd ? " (staat nog op ongeoorloofd)" : ""}`).join("\n")}`, text: `${nog.length} nog niet in Magister` }));
    return uit;
  },
  bronLijst(DT, sn, pid) {
    const K = TardyKern, lijst = this.bronnen(sn, pid);
    if (!lijst.length) return null;
    const t = K.tellingen(sn, pid);
    return DT.el("div", { class: "dt-cb-bronnen" }, [
      DT.el("b", { text: "Meldingen deze periode (balie en Magister)" }),
      t.ongeoorloofdVoorMelding ? DT.el("small", { class: "dt-cb-zacht", text: ` · ${t.ongeoorloofdVoorMelding} ${t.ongeoorloofdVoorMelding === 1 ? "les" : "lessen"} ongeoorloofd vóór een melding bij de balie tellen niet als ongeoorloofd` }) : null,
      DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, ["Datum", "Tijd", "Soort", "Bron", "Briefje", "In Magister"].map((x) => DT.el("th", { text: x })))),
        DT.el("tbody", {}, lijst.map((b) => DT.el("tr", {}, [
          DT.el("td", { text: K.kortDatum(b.datum) }), DT.el("td", { text: b.tijd || "" }), DT.el("td", { text: b.soort }),
          DT.el("td", { text: b.magister ? "Magister" : "balie" }),
          DT.el("td", { text: b.r ? (b.r.terug === undefined ? "—" : b.r.terug ? "terug" : "niet terug") : "—" }),
          DT.el("td", {}, b.r ? this.magisterVink(DT, b.r) : DT.el("span", { class: "dt-cb-zacht", text: "staat in Magister" })),
        ]))),
      ]),
    ].filter(Boolean));
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
          DT.el("small", { text: met.length ? `${met.length} van ${studenten.length} studenten bijgewerkt, laatst ${K.langDatum(laatst)}. Te laat (ook wat alleen in Magister staat), ongeoorloofd, klokuren, ziekte en medische afspraken tellen mee in de signalen, samen met de meldingen bij de balie.` : "Nog niet opgehaald. Haal de registraties op om ook signalen te krijgen op te laat dat alleen in Magister staat, ongeoorloofd verzuim, klokuren, ziekte en medische afspraken." })]),
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
});
