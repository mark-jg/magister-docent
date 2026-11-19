/* Te laat-balie, het tabblad Melden, de briefjes en de bonprinter.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
  /* ===================================================================================== */
  /* Melden                                                                                 */
  /* ===================================================================================== */
  SNEL: { ongeoorloofd: ["TEL", "ONG", "UIT"], geoorloofd: ["CAL", "ZIE", "DOK", "TAN"] },

  melden(DT) {
    const K = TardyKern, h = this._scherm.hoofd;
    const zoek = DT.el("input", { type: "search", class: "dt-cb-zoek", placeholder: "Naam of stamnummer, of scan de pas…", autocomplete: "off", "aria-label": "Student zoeken" });
    const tijd = DT.el("input", { type: "time", class: "dt-cb-tijd", title: "Tijd van de melding; leeg = nu", "aria-label": "Tijd" });
    /* Datum van de melding: standaard vandaag; een eerdere dag kiezen kan (bijv. meldingen van een dag dat je er niet was
     * achteraf invoeren). De keuze blijft staan tot je hem terugzet, zodat je een hele dag achter elkaar kunt invoeren. */
    const vandaag = K.vandaag(), dag = this.meldDatum();
    const datum = DT.el("input", { type: "date", class: `dt-cb-tijd dt-cb-datum${dag !== vandaag ? " is-anders" : ""}`, value: dag, max: vandaag, min: (K.periodes()[0] || {}).start || "", title: "Datum van de melding", "aria-label": "Datum" });
    datum.addEventListener("change", () => { this._datum = datum.value && datum.value < vandaag ? datum.value : null; this.teken(); });
    if (dag !== vandaag) tijd.title = "Tijd van de melding (verplicht bij een andere datum)";
    const scan = this.knop(DT, "Scan pas", () => {});
    scan.title = "Studentenpas scannen met de camera";
    const lijst = DT.el("div", { class: "dt-cb-hits", role: "listbox" });
    const paneel = DT.el("div", { class: "dt-cb-paneel" });
    const log = DT.el("div", { class: "dt-cb-log" });
    h.replaceChildren(...[
      DT.el("div", { class: "dt-cb-zoekrij" }, [zoek, datum, tijd, scan]),
      dag !== vandaag ? DT.el("div", { class: "dt-cb-anderedag" }, [
        DT.el("span", { html: `Je meldt nu op <b>${K.esc(K.langDatum(dag))}</b>. Vul bij elke melding ook de tijd in.` }),
        this.knop(DT, "Terug naar vandaag", () => { this._datum = null; this.teken(); }, false, "klein")]) : null,
      lijst, paneel,
      DT.el("dna-card", { class: "dt-cb-kaart" }, [DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("h2", { text: dag === vandaag ? "Vandaag" : `Meldingen op ${K.langDatum(dag)}` }),
        this.knop(DT, "Controleren in Magister", () => { const sns = [...new Set(K.S.registraties.filter((r) => r.datum === dag).map((r) => r.stamnr))]; if (!sns.length) return this.melding(dag === vandaag ? "Nog niemand gemeld vandaag." : "Nog niemand gemeld op deze dag."); this.controleer(DT, sns, true); }, false, "stil"),
        this.knop(DT, dag === vandaag ? "Briefjes van vandaag printen" : "Briefjes van deze dag printen", () => this.print(K.S.registraties.filter((r) => r.datum === dag && ["telaat", "calamiteit"].includes((K.SOORT[r.soort] || {}).g)), true))]), log]),
    ].filter(Boolean));
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
        b.addEventListener("click", () => { if (this.registreer(st.stamnr, c, tijdVeld.value, this.meldDatum()) === false) return; tijdVeld.value = ""; this.teken(); });
        return b;
      };
      const meer = DT.el("select", { class: "dt-cb-meer", "aria-label": "Meer soorten" }, [DT.el("option", { value: "", text: "Meer soorten…" }),
        ...K.SOORTEN.filter((s) => ![...this.SNEL.ongeoorloofd, ...this.SNEL.geoorloofd].includes(s.c)).map((s) => DT.el("option", { value: s.c, text: s.n }))]);
      meer.addEventListener("change", () => { if (meer.value) { if (this.registreer(st.stamnr, meer.value, tijdVeld.value, this.meldDatum()) === false) { meer.value = ""; return; } tijdVeld.value = ""; this.teken(); } });
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
  meldDatum() { const v = TardyKern.vandaag(); return this._datum && this._datum < v ? this._datum : v; },
  registreer(stamnr, soort, tijd, datum = null) {
    const K = TardyKern, S = K.S;
    if (this._kijkt) return this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus er wordt niets geregistreerd.`, "err");
    const vandaag = K.vandaag(), groep = (K.SOORT[soort] || {}).g, d = datum && datum < vandaag ? datum : vandaag, eerder = d !== vandaag;
    /* Een melding op een andere dag heeft een echte tijd nodig (anders zou de tijd van nu erin komen). */
    if (eerder && !tijd) { this.melding("Vul bij een melding op een andere dag ook de tijd in.", "err"); return false; }
    /* Per ongeluk twee keer geklikt? Zelfde student en soort binnen 5 minuten: eerst vragen. */
    const nu = tijd || K.nuTijd(), min = (t) => { const [u, m] = String(t || "0:0").split(":").map(Number); return u * 60 + m; };
    const dubbel = S.registraties.find((r) => r.stamnr === stamnr && r.soort === soort && r.datum === d && Math.abs(min(r.tijd) - min(nu)) <= 5);
    if (dubbel && !confirm(`${K.naamVan(S.studenten[stamnr] || {})} is om ${dubbel.tijd} al gemeld als ${K.soortNaam(soort).toLowerCase()}. Nog een keer melden?`)) return null;
    const reg = { id: K.uid(), stamnr, datum: d, tijd: tijd || K.nuTijd(), soort, reden: "", notitie: "", paraaf: S.instellingen.cbParaaf || "",
      terug: (groep === "telaat" || groep === "calamiteit") ? false : undefined };
    S.registraties.push(reg);
    const pid = (K.periodeVanDatum(d) || K.huidigePeriode()).id, t = K.tellingen(stamnr, pid);
    const aantal = groep === "telaat" ? t.teLaat : groep === "ongeoorloofd" ? t.ongeoorloofd : groep === "calamiteit" ? t.calamiteit : 0;
    const g = K.gevolgVan(groep, aantal, this.oudersMet18(S.studenten[stamnr]) ? true : t.achttienMin);   // 18+ met toestemming: de tekst met ouders
    let meldDatum = null;
    if (g.meld && !S.meldafspraken.some((m) => m.stamnr === stamnr && m.status === "open")) {
      meldDatum = K.volgendeSchooldag(vandaag);   // ook bij een melding achteraf: de eerstvolgende schooldag vanaf vandaag
      S.meldafspraken.push({ id: K.uid(), stamnr, datum: meldDatum, tijd: S.instellingen.meldTijd, aanleiding: groep, aanleidingTekst: "", status: "open", gemaaktOp: d, gemaild: false });
    }
    const per = (K.periodeById(pid) || { naam: "deze periode" }).naam.toLowerCase();
    const telzin = groep === "calamiteit" ? `${t.calamiteit}× calamiteit in ${per}` : groep === "telaat" ? `${t.teLaat}× te laat in ${per}`
      : groep === "ongeoorloofd" ? `${t.ongeoorloofd}× ongeoorloofd in ${per}` : groep === "ziek" ? `${t.ziekDatums.length} ziekdagen in ${per}` : groep === "medisch" ? `${t.medDatums.length} medische afspraken in ${per}` : "";
    this._laatste = { id: reg.id, niveau: g.niveau, gevolg: g.tekst, meldDatum, telzin };
    this._gekozen = null;
    if (groep === "calamiteit" && aantal >= 4) this.melding(`${S.studenten[stamnr].roepnaam} staat op ${aantal}× calamiteit: gesprek voeren en mentor informeren.`, "info", 7000);
    this.bewaar();
    if (!eerder && S.instellingen.bonAuto && (groep === "telaat" || groep === "calamiteit")) this.print([reg]);
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
    const opmerking = `${K.soortNaam(reg.soort)} ${reg.datum !== K.vandaag() ? `${K.dmy(reg.datum)} ` : ""}${reg.tijd}${reg.reden ? ` – ${reg.reden}` : ""}${reg.paraaf ? ` (${reg.paraaf})` : ""}`;
    return DT.el("dna-card", { class: `dt-cb-kaart dt-cb-uitslag n${l.niveau || 0}` }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [
        DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: `${K.naamVan(st)} · ${K.soortNaam(reg.soort)} ${reg.datum !== K.vandaag() ? `${K.kortDatum(reg.datum)} ` : ""}${reg.tijd}` }), DT.el("small", { text: l.telzin || "" })]),
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
        this.magisterVink(DT, reg, "Aangepast in Magister"),
      ]),
    ]);
  },

  tekenLog(DT, log) {
    const K = TardyKern;
    const dag = this.meldDatum();
    const regs = K.S.registraties.filter((r) => r.datum === dag).sort((a, b) => (b.tijd || "").localeCompare(a.tijd || ""));
    const open = regs.filter((r) => r.terug === false).length;
    const nogMag = regs.filter((r) => this.nogInMagister(r)).length;
    if (!regs.length) return log.replaceChildren(DT.el("p", { class: "dt-cb-zacht", text: dag === K.vandaag() ? "Nog niemand gemeld vandaag." : `Nog niemand gemeld op ${K.langDatum(dag)}.` }));
    log.replaceChildren(
      DT.el("p", { class: "dt-cb-zacht", text: `${regs.length} ${regs.length === 1 ? "melding" : "meldingen"}${open ? ` · ${open} ${open === 1 ? "briefje" : "briefjes"} niet terug` : ""}${nogMag ? ` · ${nogMag} nog niet aangepast in Magister` : ""}` }),
      DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, ["Tijd", "Student", "Soort", "Reden", "Briefje terug", "In Magister", ""].map((t) => DT.el("th", { text: t })))),
        DT.el("tbody", {}, regs.map((r) => {
          const st = K.S.studenten[r.stamnr] || {};
          const terug = r.terug === undefined ? DT.el("span", { class: "dt-cb-zacht", text: "—" }) : DT.el("input", { type: "checkbox", "aria-label": `Briefje van ${K.naamVan(st)} terug` });
          if (r.terug !== undefined) { terug.checked = !!r.terug; terug.addEventListener("change", () => { r.terug = terug.checked; this.bewaar(); }); }
          const reden = DT.el("input", { type: "text", class: "dt-cb-veld klein", value: r.reden || "", "aria-label": "Reden" });
          reden.addEventListener("change", () => { r.reden = reden.value.trim(); this.bewaar(); });
          return DT.el("tr", {}, [DT.el("td", { text: r.tijd }), DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}` })]),
            DT.el("td", { text: K.soortNaam(r.soort) }), DT.el("td", {}, reden), DT.el("td", {}, terug), DT.el("td", {}, this.magisterVink(DT, r)),
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
});
