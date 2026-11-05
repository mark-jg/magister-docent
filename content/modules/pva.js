/* Plan van aanpak bij de begeleiding van een student (Begeleiding › Logboek), voor SLB'ers en docenten.
 *
 * Naast "+ Toevoegen" in het logboek staat een knop "Plan van aanpak". Die opent een formulier volgens de
 * templates en de instructie van MIP/MEP (algemeen of Blijf Bij Ma, brief 1/2/3 of na negatief VSA), vooraf
 * ingevuld met wat Magister weet: naam, studentnummer, klas, geboortedatum, jij als SLB, of de student
 * minderjarig is (ouders uitnodigen) of als 18+ toestemming gaf, en de aanwezigheid (% van de lessen, ziek,
 * ongeoorloofd, te laat) over de huidige periode of dit schooljaar.
 *  - Word downloaden: het eigen template ingevuld (PvaDocx, assets/pva/*.docx).
 *  - Gespreksnotitie: Magisters "07. Gespreksnotitie" met een samenvatting en het plan als bijlage (DTForms).
 *  - Evaluatie inplannen: een nieuwe afspraak in Magister op de evaluatiedatum.
 * Plannen (concepten) blijven in deze browser (chrome.storage.local); het definitieve plan staat als bijlage
 * bij de gespreksnotitie in Magister. Er wordt niets in Magister opgeslagen zonder dat jij op Opslaan klikt. */
DT.register({
  id: "pva",
  _stop: null,
  NOTITIE: "dt-pva-notitie",
  AFSPRAAK: "dt-pva-afspraak",
  OPEN: "dt-pva-open",   // gezet door de Te laat-balie: open het formulier bij deze student, met aanleiding

  VAKKEN: ["Project", "Intro branche", "MarCom / Muziekmarketing & promotie", "Professional Skills", "Digital Tools", "Creatie"],
  LEERLIJNEN: ["Adviseren over mediaproducten", "Voorbereiden van de mediaproductie", "Coördineren van de mediaproductie", "Professioneel handelen", "Vakvaardigheden"],
  LEERLIJNVAK: { 1: "Pitch", 2: "PRM", 3: "BO Branche in Beeld" },
  REDENEN: [["voortgang", "studievoortgang"], ["verzuim", "verzuim"], ["werkhouding", "inzet en werkhouding"], ["afspraken", "afspraken niet nagekomen"], ["anders", "anders"]],
  STAPPEN: [["brief1", "Brief 1: SLB"], ["brief2", "Brief 2: SLB en collega"], ["brief3", "Brief 3: SLB en opleidingsmanager"], ["vsa", "Na negatief VSA"]],
  MAAND: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],

  init(DT) {
    if (/^\/magister-lvs\//.test(location.pathname)) {
      this._stop = DT.observe(() => { DTForms.vulLogboek(this.NOTITIE); this.knop(DT); }, { debounce: 250, poll: 1000 });
    } else if (DT.isTop) {
      this._stop = DT.observe(() => DTForms.vulAfspraak(this.AFSPRAAK), { debounce: 300, poll: 1500 });
    }
  },
  destroy() {
    this._stop && this._stop();
    document.getElementById("dt-pva-knop")?.remove();
    document.querySelector(".dt-pva-modal")?.remove();
  },

  /* ---------- hulpjes ---------- */
  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  vandaag() { return this.ymd(new Date()); },
  plusDagen(s, n) { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return this.ymd(d); },
  schooldag(s) { let d = s; while ([0, 6].includes(new Date(`${d}T12:00:00`).getDay())) d = this.plusDagen(d, 1); return d; },
  lang(s) { if (!s) return ""; const d = new Date(`${s}T12:00:00`); return `${d.getDate()} ${this.MAAND[d.getMonth()]} ${d.getFullYear()}`; },
  dmy(s) { return s ? String(s).slice(0, 10).split("-").reverse().join("-") : ""; },
  leeftijd(geb) { if (!geb) return null; const g = new Date(`${String(geb).slice(0, 10)}T12:00:00`), n = new Date(); let a = n.getFullYear() - g.getFullYear(); if (n < new Date(n.getFullYear(), g.getMonth(), g.getDate())) a--; return a; },
  naamVan(p) { return [p?.roepnaam || p?.voorletters, p?.tussenvoegsel, p?.achternaam].filter(Boolean).join(" "); },
  async opslag(sleutel, waarde) {
    if (waarde === undefined) return (await chrome.storage.local.get(sleutel))[sleutel];
    await chrome.storage.local.set({ [sleutel]: waarde });
  },
  async plannenVan(id) { return (await this.opslag(`pva:${id}`)) || []; },
  async bewaarPlan(p) {
    const lijst = await this.plannenVan(p.magisterId), i = lijst.findIndex((x) => x.id === p.id);
    p.gewijzigd = new Date().toISOString();
    if (i >= 0) lijst[i] = p; else lijst.push(p);
    await this.opslag(`pva:${p.magisterId}`, lijst);
  },
  async verwijderPlan(p) { await this.opslag(`pva:${p.magisterId}`, (await this.plannenVan(p.magisterId)).filter((x) => x.id !== p.id)); },

  /* ---------- knop in het logboek ---------- */
  studentId() { return (location.hash.match(/^#\/overview\/(\d+)/) || [])[1] || null; },
  knop(DT) {
    const id = this.studentId();
    const bestaand = document.getElementById("dt-pva-knop");
    if (!id) { bestaand?.remove(); return; }
    const toevoegen = [...document.querySelectorAll("dna-button")].find((b) => /Toevoegen/.test(b.textContent));
    if (!toevoegen) return;
    if (!bestaand || bestaand.dataset.id !== id) {
      bestaand?.remove();
      this.css();
      const b = DT.el("button", { type: "button", id: "dt-pva-knop", class: "dt-pva-knop", "data-id": id, text: "Plan van aanpak" });
      b.addEventListener("click", () => this.openen(DT, id));
      (toevoegen.closest("dna-overlay-trigger") || toevoegen).before(b);   // Toevoegen zit in een menu-trigger met shadow root
    }
    /* Vanuit de Te laat-balie: meteen openen met de aanleiding van het signaal. */
    const o = DTForms.lees(this.OPEN);
    if (o && String(o.magisterId) === id && !document.querySelector(".dt-pva-modal")) { DTForms.weg(this.OPEN); this.openen(DT, id, o); }
  },

  /* ---------- gegevens uit Magister ---------- */
  async student(DT, id) {
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const [ll, pers, ouders, acc, aanm] = await Promise.all([
      DT.api(`/api/leerlingen/${id}`, { full: true }), DT.api(`/api/leerlingen/${id}/personalia`, { full: true }),
      DT.api(`/api/leerlingen/${id}/ouders`, { full: true }), DT.api("/api/account", { full: true }),
      DT.api(`/api/leerlingen/${id}/aanmeldingen`, { full: true }),
    ]);
    /* Klas: de groep van de (hoofd)aanmelding die nu loopt. */
    const nu = this.vandaag(), am = lijst(aanm) || [];
    const huidig = am.filter((x) => (!x.begin || String(x.begin).slice(0, 10) <= nu) && (!x.einde || String(x.einde).slice(0, 10) >= nu));
    const aanmelding = huidig.find((x) => x.isHoofdAanmelding) || huidig[0] || am.find((x) => x.isHoofdAanmelding) || am[0];
    const l = ll.json || {}, geb = pers.json?.geboortedatum || l.geboortedatum || null, jaren = this.leeftijd(geb);
    const ou = lijst(ouders) || [];
    const a = acc.json?.Persoon || acc.json?.persoon || {};
    return {
      magisterId: id, naam: this.naamVan(l), roepnaam: l.roepnaam || "", achternaam: l.achternaam || "", stamnr: String(l.stamnummer ?? l.code ?? ""),
      klas: aanmelding?.groep?.code ?? l.stamklas?.code ?? "", geboortedatum: geb ? String(geb).slice(0, 10) : "", minderjarig: jaren == null ? null : jaren < 18,
      ouderToestemming: ou.some((o) => o.heeftToestemming === true),
      ik: [a.Roepnaam || a.roepnaam, a.Tussenvoegsel || a.tussenvoegsel, a.Achternaam || a.achternaam].filter(Boolean).join(" "),
    };
  },
  /* Aanwezigheid zoals het template vraagt, over de huidige eigen periode (instellingen › Periodes) of dit schooljaar. */
  async aanwezigheid(DT, id) {
    const nu = new Date(), per = (DT.periodes?.() || []).find((p) => p.begin <= nu && nu <= p.einde);
    const jaarBegin = new Date(nu.getMonth() >= 7 ? nu.getFullYear() : nu.getFullYear() - 1, 7, 1);
    const van = per ? per.begin : jaarBegin, label = per ? per.naam.toLowerCase() : "dit schooljaar";
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const [v, a] = await Promise.all([
      DT.api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${this.ymd(van)}&einde=${this.ymd(nu)}`, { full: true, timeout: 25000 }),
      DT.api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${this.ymd(van)}&einde=${this.ymd(nu)}`, { full: true, timeout: 25000 }),
    ]);
    const regs = lijst(v), rooster = lijst(a);
    if (!regs || !rooster || typeof vzStats !== "function") return { tekst: "", pct: null };
    const T = vzStats(regs, rooster, van, nu).totaal;
    const ong = Math.max(0, (T.ongeoorloofd || 0));
    return { pct: T.telt ? T.pct : null,
      tekst: `${T.telt ? `${T.pct}% (${T.telt - T.afwezig} van ${T.telt} lessen)` : "geen lessen"}, ${T.ziek || 0} ${T.ziek === 1 ? "les" : "lessen"} ziek, ${ong} ${ong === 1 ? "les" : "lessen"} ongeoorloofd, ${T.teLaat || 0}× te laat (${label}, peildatum ${this.lang(this.vandaag())})` };
  },

  nieuwPlan(DT, s, a, soort = "algemeen", extra = {}, eerder = []) {
    const vandaag = this.vandaag(), c = this._std || {};
    const bbm = eerder.filter((p) => p.soort === "bbm").map((p) => p.stap);
    const verzuim = (extra.redenen || []).includes("verzuim");
    return {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, magisterId: s.magisterId, naam: s.naam, achternaam: s.achternaam, roepnaam: s.roepnaam,
      stamnr: s.stamnr, klas: s.klas, geboortedatum: this.dmy(s.geboortedatum), soort,
      stap: bbm.includes("brief2") ? "brief3" : bbm.includes("brief1") ? "brief2" : "brief1",
      datum: vandaag, slb: c.slb || s.ik || "", om: c.om || "", coach: c.coach || "",
      aanwezig: { student: true, ouders: s.minderjarig !== false || s.ouderToestemming, collega: "" },
      redenen: extra.redenen || [], anders: "", toelichting: extra.toelichting || "",
      leerlijnen: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }, vakken: {}, basis: { Nederlands: {}, Rekenen: {}, Engels: {} },
      aanwezigheid: a.tekst, pct: a.pct,
      doelen: [{}, {}, {}], acties: [{ wie: "Student" }, { wie: "Student" }, { wie: "SLB" }], woorden: {},
      evaluaties: [{ datum: this.schooldag(this.plusDagen(vandaag, verzuim ? 20 : 34)) }, ...(soort === "bbm" ? [] : [{}])],
      ouderNaam: "", aangemaakt: new Date().toISOString(),
    };
  },
  titel(p) { return p.soort === "bbm" ? `Plan van aanpak Blijf Bij Ma · ${(this.STAPPEN.find(([k]) => k === p.stap) || [, ""])[1].replace(/:.*/, "")}` : "Plan van aanpak algemeen"; },

  /* ---------- openen: eerdere plannen of een nieuw plan ---------- */
  async openen(DT, id, vanBalie = null) {
    this.css();
    const laden = this.modal(DT, "Plan van aanpak", [DT.el("p", { class: "dt-pva-zacht", text: "Gegevens ophalen uit Magister…" })], []);
    try {
      const [s, a, eerder, std] = await Promise.all([this.student(DT, id), this.aanwezigheid(DT, id), this.plannenVan(id), this.opslag("pva:standaard")]);
      this._std = std || {};
      this._s = s; this._a = a;
      if (vanBalie) return this.formulier(DT, this.nieuwPlan(DT, s, a, vanBalie.soort || "algemeen", vanBalie, eerder));
      if (!eerder.length) return this.formulier(DT, this.nieuwPlan(DT, s, a, "algemeen", {}, eerder));
      const rij = (p) => {
        const ev = (p.evaluaties || []).find((e) => e.datum && !e.doelen);
        const b = DT.el("button", { type: "button", class: "dt-pva-rij" }, [DT.el("b", { text: this.titel(p) }),
          DT.el("span", { text: `gesprek ${this.lang(p.datum)}${ev ? ` · evaluatie ${this.lang(ev.datum)}` : ""}${p.notitieOp ? " · notitie klaargezet" : ""}` })]);
        b.addEventListener("click", () => this.formulier(DT, p));
        return b;
      };
      laden.remove();
      this.modal(DT, `Plan van aanpak: ${s.naam}`, [
        DT.el("p", { class: "dt-pva-zacht", text: "Eerdere plannen in deze browser. Het definitieve plan staat als bijlage bij de gespreksnotitie in het logboek." }),
        DT.el("div", { class: "dt-pva-lijst" }, eerder.slice().sort((x, y) => y.datum.localeCompare(x.datum)).map(rij)),
      ], [["Sluiten", null], ["Nieuw plan algemeen", () => this.formulier(DT, this.nieuwPlan(DT, s, a, "algemeen", {}, eerder))],
        ["Nieuw plan Blijf Bij Ma", () => this.formulier(DT, this.nieuwPlan(DT, s, a, "bbm", {}, eerder)), true]]);
    } catch (e) { laden.remove(); this.melding(`Ophalen uit Magister lukte niet: ${e.message || e}`); }
  },

  /* ---------- modal ---------- */
  modal(DT, titel, inhoud, knoppen = [["Sluiten", null]]) {
    document.querySelector(".dt-pva-modal")?.remove();
    const sluit = () => { m.remove(); document.removeEventListener("keydown", esc, true); };
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); sluit(); } };
    const kn = knoppen.map(([t, fn, hoofd]) => { const b = DT.el("button", { type: "button", class: `dt-pva-btn${hoofd ? " is-hoofd" : ""}${t === "Verwijderen" ? " is-weg" : ""}`, text: t }); b.addEventListener("click", () => (fn ? fn() : sluit())); return b; });
    const m = DT.el("div", { class: "dt-pva-modal", role: "dialog", "aria-label": titel }, DT.el("div", { class: "dt-pva-paneel" }, [
      DT.el("div", { class: "dt-pva-kop" }, [DT.el("h2", { text: titel }), (() => { const x = DT.el("button", { type: "button", class: "dt-pva-x", "aria-label": "Sluiten", text: "×" }); x.addEventListener("click", sluit); return x; })()]),
      DT.el("div", { class: "dt-pva-body" }, inhoud),
      kn.length ? DT.el("div", { class: "dt-pva-voet" }, kn) : null,
    ].filter(Boolean)));
    m.addEventListener("click", (e) => { if (e.target === m) sluit(); });
    document.addEventListener("keydown", esc, true);
    document.body.append(m);
    return m;
  },
  melding(tekst) {
    const t = document.createElement("div"); t.className = "dt-pva-toast"; t.textContent = tekst; document.body.append(t);
    setTimeout(() => t.classList.add("is-aan"), 10); setTimeout(() => { t.classList.remove("is-aan"); setTimeout(() => t.remove(), 300); }, 6000);
  },

  /* ---------- het formulier, opgebouwd zoals het template ---------- */
  formulier(DT, p) {
    const bewaar = () => { clearTimeout(this._bt); this._bt = setTimeout(() => this.bewaarPlan(p), 300); };
    const opnieuw = () => { const y = document.querySelector(".dt-pva-body")?.scrollTop || 0; this.formulier(DT, p); const b = document.querySelector(".dt-pva-body"); if (b) b.scrollTop = y; };
    const pad = (k) => k.split(".").reduce((o, x) => (o[x] ??= {}), p);
    const lees = (k) => { const d = k.split("."), l = d.pop(); return d.reduce((o, x) => o?.[x], p)?.[l]; };
    const schrijf = (k, v) => { const d = k.split("."), l = d.pop(); (d.length ? pad(d.join(".")) : p)[l] = v; bewaar(); };
    const inp = (k, { type = "text", ph = "", lijst = null, breed = "" } = {}) => {
      const e = DT.el("input", { type, class: "dt-pva-veld", placeholder: ph, ...(lijst ? { list: lijst } : {}), ...(breed ? { style: `width:${breed};flex:0 0 ${breed}` } : {}) });
      e.value = lees(k) ?? ""; e.addEventListener("input", () => schrijf(k, e.value)); return e;
    };
    const vak = (k, rijen = 2, ph = "") => { const e = DT.el("textarea", { class: "dt-pva-veld", rows: String(rijen), placeholder: ph }); e.value = lees(k) ?? ""; e.addEventListener("input", () => schrijf(k, e.value)); return e; };
    const kies = (k, opties, na = null) => { const e = DT.el("select", { class: "dt-pva-veld" }, opties.map(([v, t]) => DT.el("option", { value: v, text: t }))); e.value = lees(k) ?? ""; e.addEventListener("change", () => { schrijf(k, e.value); na?.(); }); return e; };
    const vinkje = (label, aan, zet) => { const c = DT.el("input", { type: "checkbox" }); c.checked = !!aan; c.addEventListener("change", () => { zet(c.checked); bewaar(); }); return DT.el("label", { class: "dt-pva-vink" }, [c, DT.el("span", { text: label })]); };
    const veld = (label, ...el) => DT.el("label", { class: "dt-pva-label" }, [DT.el("span", { text: label }), ...el]);
    const vast = (label, waarde) => veld(label, DT.el("input", { class: "dt-pva-veld", value: waarde || "", disabled: "" }));
    const sectie = (nr, titel, ...inhoud) => DT.el("section", { class: "dt-pva-sectie" }, [DT.el("h3", {}, [DT.el("span", { class: "dt-pva-nr", text: String(nr) }), ` ${titel}`]), ...inhoud]);
    const tabel = (koppen, rijen) => DT.el("table", { class: "dt-pva-tabel" }, [DT.el("thead", {}, DT.el("tr", {}, koppen.map((t) => DT.el("th", { text: t })))), DT.el("tbody", {}, rijen)]);
    const VV = [["", "—"], ["voldaan", "voldaan"], ["niet voldaan", "niet voldaan"], ["–", "n.v.t."]];
    const bbm = p.soort === "bbm", s = this._s || {};
    const datalijsten = [
      DT.el("datalist", { id: "dt-pva-standen" }, ["stap 1 behaald", "stap 2 behaald", "op koers", "niet op koers", "niet behaald", "nog niet beoordeeld"].map((v) => DT.el("option", { value: v }))),
      DT.el("datalist", { id: "dt-pva-wie" }, ["Student", "SLB", "Docent", "Ouder/verzorger", "Begeleidingscoach", "Opleidingsmanager"].map((v) => DT.el("option", { value: v }))),
    ];
    const lijst = (k, kolommen, nieuw) => {
      const rijen = p[k] || (p[k] = []);
      return DT.el("div", {}, [
        tabel([...kolommen.map(([, t]) => t), ""], rijen.map((_, i) => DT.el("tr", {}, [...kolommen.map(([v, , opt]) => DT.el("td", {}, inp(`${k}.${i}.${v}`, opt || {}))),
          DT.el("td", {}, rijen.length > 1 ? (() => { const x = DT.el("button", { type: "button", class: "dt-pva-mini", text: "×", title: "Regel verwijderen" }); x.addEventListener("click", () => { rijen.splice(i, 1); bewaar(); opnieuw(); }); return x; })() : "")]))),
        (() => { const b = DT.el("button", { type: "button", class: "dt-pva-link", text: "+ Regel toevoegen" }); b.addEventListener("click", () => { rijen.push(nieuw()); bewaar(); opnieuw(); }); return b; })(),
      ]);
    };
    const ouderLabel = s.minderjarig === false ? (s.ouderToestemming ? "ouder(s)/verzorger(s) (18+, met toestemming)" : "ouder(s)/verzorger(s) (18+: alleen met toestemming)") : "ouder(s)/verzorger(s) (minderjarig: uitnodigen)";

    const inhoud = [
      ...datalijsten,
      DT.el("div", { class: "dt-pva-balk" }, [
        veld("Formulier", kies("soort", [["algemeen", "Plan van aanpak algemeen"], ["bbm", "Plan van aanpak Blijf Bij Ma"]], () => {
          if (p.soort === "bbm") p.evaluaties = p.evaluaties.slice(0, 1); else if (p.evaluaties.length < 2) p.evaluaties.push({});
          bewaar(); opnieuw();
        })),
        bbm ? veld("Stap", kies("stap", this.STAPPEN)) : null,
        veld("Datum gesprek", inp("datum", { type: "date" })),
      ].filter(Boolean)),
      sectie(1, "Gegevens",
        DT.el("div", { class: "dt-pva-grid" }, [vast("Naam", p.naam), vast("Studentnummer", p.stamnr), vast("Klas", p.klas), veld("Geboortedatum", inp("geboortedatum", { ph: "dd-mm-jjjj" })),
          veld("SLB", inp("slb")), ...(bbm ? [veld("Opleidingsmanager", inp("om")), veld("Begeleidingscoach", inp("coach"))] : [])]),
        DT.el("div", { class: "dt-pva-vinkjes" }, [
          vinkje("student", p.aanwezig?.student, (v) => { pad("aanwezig").student = v; }),
          vinkje(ouderLabel, p.aanwezig?.ouders, (v) => { pad("aanwezig").ouders = v; }),
          DT.el("span", { class: "dt-pva-vink" }, [DT.el("span", { text: "collega:" }), inp("aanwezig.collega", { ph: "naam", breed: "200px" })]),
        ])),
      sectie(2, "Aanleiding",
        DT.el("div", { class: "dt-pva-vinkjes" }, [...this.REDENEN.map(([k, t]) => vinkje(t, (p.redenen || []).includes(k), (v) => { p.redenen = (p.redenen || []).filter((x) => x !== k); if (v) p.redenen.push(k); })),
          inp("anders", { ph: "anders: …", breed: "220px" })]),
        veld("Toelichting", vak("toelichting", 3, "Twee of drie zinnen, alleen feiten, met een peildatum. Geen oordeel over de persoon."))),
      sectie(3, "Waar sta je nu",
        tabel(["Leerlijn", "Stand", "Vak", "Vakvaardigheid", "Inzet en werkhouding"], [
          ...[1, 2, 3].map((n) => DT.el("tr", {}, [DT.el("td", { text: `${n}. ${this.LEERLIJNEN[n - 1]}` }), DT.el("td", {}, inp(`leerlijnen.${n}.stand`, { lijst: "dt-pva-standen" })),
            DT.el("td", { text: this.LEERLIJNVAK[n] }), DT.el("td", { text: "–" }), DT.el("td", {}, kies(`leerlijnen.${n}.iw`, VV))])),
          DT.el("tr", {}, [DT.el("td", { text: "4. Professioneel handelen" }), DT.el("td", {}, inp("leerlijnen.4.stand", { lijst: "dt-pva-standen" })),
            DT.el("td", { colspan: "3" }, [DT.el("span", { text: "Inzet en werkhouding " }), inp("leerlijnen.4.iwVoldaan", { type: "number", breed: "64px" }),
              DT.el("span", { text: ` van 9 voldaan (op koers vanaf 6) en ${p.pct ?? "…"}% aanwezig (norm 80%).` })])]),
          ...this.VAKKEN.map((v, i) => DT.el("tr", {}, [DT.el("td", { text: i ? "" : "5. Vakvaardigheden" }), DT.el("td", {}, i ? "" : inp("leerlijnen.5.stand", { lijst: "dt-pva-standen" })),
            DT.el("td", { text: v }), DT.el("td", {}, kies(`vakken.${v}.vv`, VV)), DT.el("td", {}, kies(`vakken.${v}.iw`, VV))])),
        ]),
        tabel(["Basisvaardigheid", "Getoetst tot nu toe", "Behaald", "Stand"], [
          ...["Nederlands", "Rekenen", "Engels"].map((v) => DT.el("tr", {}, [DT.el("td", { text: v }), DT.el("td", {}, inp(`basis.${v}.getoetst`)), DT.el("td", {}, inp(`basis.${v}.behaald`)), DT.el("td", {}, inp(`basis.${v}.stand`, { lijst: "dt-pva-standen" }))])),
          DT.el("tr", {}, [DT.el("td", { text: "Burgerschap" }), DT.el("td", { text: "nog niet getoetst" }), DT.el("td", { text: "–" }), DT.el("td", { text: "telt nu niet mee" })]),
        ]),
        veld("Aanwezigheid (uit Magister)", vak("aanwezigheid", 2)),
        DT.el("p", { class: "dt-pva-zacht", text: "De stand per leerlijn komt uit het leerlijndiagram in Simulise." })),
      sectie(4, "Wat ga je behalen", lijst("doelen", [["doel", "Doel", { ph: "meetbaar, gekoppeld aan vakken en toetsen" }], ["bewijs", "Waaraan zie je het"], ["uiterlijk", "Uiterlijk", { ph: "datum" }]], () => ({})),
        DT.el("p", { class: "dt-pva-zacht", text: "De student formuleert de doelen mee." })),
      sectie(5, "Acties en afspraken", lijst("acties", [["wie", "Wie", { lijst: "dt-pva-wie" }], ["wat", "Doet wat"], ["wanneer", "Wanneer"]], () => ({ wie: "Student" }))),
      sectie(6, "In jouw woorden",
        veld("Waardoor loopt het nu niet zoals je wilt?", vak("woorden.waardoor", 2)), veld("Wat ga jij vanaf nu anders doen?", vak("woorden.anders", 2)),
        veld("Wat heb je nodig van school of van thuis?", vak("woorden.nodig", 2)),
        DT.el("p", { class: "dt-pva-zacht", text: "Laat de student dit zelf invullen of formuleren; dit is de kern van het gesprek." })),
      sectie(7, "Evaluatie",
        tabel(["Datum", "Doelen", bbm ? "Vervolg" : "Afspraak en vervolg"], (p.evaluaties || []).map((_, i) => DT.el("tr", {}, [
          DT.el("td", {}, inp(`evaluaties.${i}.datum`, { type: "date" })),
          DT.el("td", {}, kies(`evaluaties.${i}.doelen`, [["", "—"], ["behaald", "behaald"], ["deels", "deels"], ["niet", "niet"]])),
          DT.el("td", {}, bbm ? kies(`evaluaties.${i}.vervolg`, [["", "—"], ["afsluiten", "afsluiten"], ["nieuw", "nieuw plan"], ["volgende", "volgende brief"]]) : inp(`evaluaties.${i}.afspraak`)),
        ]))),
        DT.el("p", { class: "dt-pva-zacht", text: bbm ? "Geef de student per brief 4 tot 6 weken. Doelen niet behaald: de volgende stap in Blijf Bij Ma." : "Eerste evaluatie na 4 tot 6 weken; bij verzuim eerder, na 2 tot 3 weken." })),
      sectie(8, "Akkoord", DT.el("div", { class: "dt-pva-grid" }, [veld("Ouder/verzorger (bij minderjarige)", inp("ouderNaam", { ph: "naam" })),
        DT.el("p", { class: "dt-pva-zacht", text: bbm && p.stap === "brief3" ? "Student, SLB en opleidingsmanager tekenen; de student ondertekent verplicht." : "Student en SLB tekenen altijd." })])),
    ];
    const status = [p.gedownload && "Word gedownload", p.notitieOp && "gespreksnotitie klaargezet", p.afspraakOp && "evaluatie ingepland"].filter(Boolean);
    this.modal(DT, `${this.titel(p)}: ${p.naam}`, [
      DT.el("p", { class: "dt-pva-zacht", text: `${p.klas} · ${p.stamnr}${status.length ? ` · ${status.join(" · ")}` : ""}. Wordt bewaard in deze browser.` }), ...inhoud,
    ], [
      ["Verwijderen", async () => { if (!confirm("Dit plan van aanpak uit deze browser verwijderen? Een notitie in Magister blijft bestaan.")) return; await this.verwijderPlan(p); document.querySelector(".dt-pva-modal")?.remove(); }],
      ["Sluiten", null],
      ["Word downloaden", () => this.download(p)],
      ["Evaluatie inplannen", () => this.evaluatie(p)],
      ["Gespreksnotitie in Magister", () => this.notitie(p), true],
    ]);
    this.bewaarPlan(p);
    /* SLB, opleidingsmanager en coach onthouden voor het volgende plan (in deze browser). */
    const std = { slb: p.slb || "", om: p.om || this._std?.om || "", coach: p.coach || this._std?.coach || "" };
    if (JSON.stringify(std) !== JSON.stringify(this._std || {})) { this._std = std; this.opslag("pva:standaard", std); }
  },

  /* ---------- export en Magister ---------- */
  docData(p) { return Object.assign({}, p, { datumTekst: this.lang(p.datum), evaluaties: (p.evaluaties || []).map((e) => Object.assign({}, e, { datumTekst: this.lang(e.datum) })) }); },
  async bytes(p) {
    const r = await fetch(chrome.runtime.getURL(`assets/pva/${p.soort === "bbm" ? "bbm" : "algemeen"}.docx`));
    if (!r.ok) throw new Error("template niet gevonden");
    return PvaDocx.vul(new Uint8Array(await r.arrayBuffer()), this.docData(p));
  },
  bestandsnaam(p) {
    const naam = [p.achternaam, p.roepnaam].filter(Boolean).join("_").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    return `PvA_${p.soort === "bbm" ? `BBM_${p.stap}_` : ""}${naam || p.stamnr}_${p.datum}.docx`;
  },
  async download(p) {
    try {
      const url = URL.createObjectURL(new Blob([await this.bytes(p)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = document.createElement("a"); a.href = url; a.download = this.bestandsnaam(p); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      p.gedownload = new Date().toISOString(); this.bewaarPlan(p);
    } catch (e) { this.melding(`Het Word-document maken lukte niet: ${e.message || e}`); }
  },
  samenvatting(p) {
    const r = [], redenen = (p.redenen || []).map((x) => (x === "anders" ? `anders: ${p.anders || ""}` : (this.REDENEN.find(([k]) => k === x) || [, x])[1]));
    r.push(`${this.titel(p)}, besproken op ${this.lang(p.datum)}.`);
    const aanw = [p.aanwezig?.student && "student", p.aanwezig?.ouders && "ouder(s)/verzorger(s)", p.aanwezig?.collega && `collega: ${p.aanwezig.collega}`].filter(Boolean);
    if (aanw.length) r.push(`Aanwezig: ${aanw.join(", ")}.`);
    if (redenen.length) r.push(`Reden: ${redenen.join(", ")}.`);
    if (p.toelichting) r.push("", `Aanleiding: ${p.toelichting}`);
    if (p.aanwezigheid) r.push(`Aanwezigheid: ${p.aanwezigheid}`);
    const doelen = (p.doelen || []).filter((d) => d.doel);
    if (doelen.length) r.push("", "Doelen:", ...doelen.map((d) => `- ${d.doel}${d.bewijs ? ` (${d.bewijs})` : ""}${d.uiterlijk ? `, uiterlijk ${d.uiterlijk}` : ""}`));
    const acties = (p.acties || []).filter((x) => x.wat);
    if (acties.length) r.push("", "Afspraken:", ...acties.map((x) => `- ${x.wie || "?"}: ${x.wat}${x.wanneer ? ` (${x.wanneer})` : ""}`));
    const ev = (p.evaluaties || []).find((e) => e.datum);
    if (ev) r.push("", `Evaluatie: ${this.lang(ev.datum)}.`);
    r.push("", "Het volledige plan van aanpak zit als bijlage bij deze notitie.");
    return r.join("\n");
  },
  async notitie(p) {
    try {
      const bytes = await this.bytes(p);
      let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const ok = DTForms.logboek(this.NOTITIE, { magisterId: String(p.magisterId), naam: p.naam, type: "Gespreksnotitie", omschrijving: this.titel(p),
        tekst: this.samenvatting(p), bijlage: { naam: this.bestandsnaam(p), base64: btoa(bin) }, bron: "Plan van aanpak" });
      if (!ok) return this.melding("De bijlage is te groot om door te geven; download het Word-document en voeg het zelf toe.");
      p.notitieOp = new Date().toISOString(); await this.bewaarPlan(p);
      document.querySelector(".dt-pva-modal")?.remove();
      if (this.studentId() !== String(p.magisterId)) location.hash = `#/overview/${p.magisterId}`;
      DTForms.vulLogboek(this.NOTITIE);   // we staan al in het logboek: Toevoegen › Gespreksnotitie
    } catch (e) { this.melding(`De gespreksnotitie voorbereiden lukte niet: ${e.message || e}`); }
  },
  evaluatie(p) {
    const ev = (p.evaluaties || []).find((e) => e.datum && !e.doelen) || (p.evaluaties || []).find((e) => e.datum);
    if (!ev) return this.melding("Vul eerst een evaluatiedatum in.");
    DTForms.afspraak(this.AFSPRAAK, { stamnr: p.stamnr, naam: p.naam, onderwerp: `Evaluatie ${this.titel(p).toLowerCase()}: ${p.naam}`, datum: ev.datum, tijd: "09:00", minuten: 30, bron: "Plan van aanpak",
      tekst: `Evaluatie van het ${this.titel(p).toLowerCase()} van ${this.lang(p.datum)}.\n\nDoelen:\n${(p.doelen || []).filter((d) => d.doel).map((d) => `- ${d.doel}`).join("\n") || "-"}` });
    this.melding("Magister opent een nieuwe afspraak in een nieuw tabblad, al ingevuld. Controleer en klik daar op Opslaan.");
    p.afspraakOp = new Date().toISOString(); this.bewaarPlan(p);
  },

  css() {
    if (document.getElementById("dt-pva-style")) return;
    const st = document.createElement("style");
    st.id = "dt-pva-style";
    st.textContent = `
      .dt-pva-knop { margin-right: 8px; height: 32px; padding: 0 14px; border: 1px solid var(--sl-color-border-primary-plain, #056dc2); border-radius: var(--sl-size-borderRadius-default, 4px);
        background: var(--sl-color-background-input-plain, #fff); color: var(--sl-color-link-idle, #056dc2); font: 600 14px/30px open-sans, sans-serif; cursor: pointer; }
      .dt-pva-knop:hover { background: var(--sl-color-palette-blue-100, #ddeffe); }
      .dt-pva-modal { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; background: rgba(34,34,34,.55); font: 14px/20px open-sans, sans-serif; color: #25292f; }
      .dt-pva-paneel { width: min(1080px, calc(100vw - 32px)); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #fff; border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.25); overflow: hidden; }
      .dt-pva-kop { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #e0e6ea; }
      .dt-pva-kop h2 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 700; color: #0b385c; }
      .dt-pva-x { border: 0; background: none; font-size: 24px; line-height: 1; cursor: pointer; color: #59636e; }
      .dt-pva-body { padding: 12px 20px 20px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
      .dt-pva-voet { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid #e0e6ea; background: #f6f8fa; }
      .dt-pva-btn { height: 34px; padding: 0 14px; border: 1px solid #056dc2; border-radius: 4px; background: #fff; color: #056dc2; font: 600 14px/32px open-sans, sans-serif; cursor: pointer; }
      .dt-pva-btn:hover { background: #ddeffe; } .dt-pva-btn.is-hoofd { background: #056dc2; color: #fff; } .dt-pva-btn.is-hoofd:hover { background: #04579a; }
      .dt-pva-btn.is-weg { margin-right: auto; border-color: transparent; color: #c70e13; }
      .dt-pva-zacht { margin: 0; color: #59636e; font-size: 13px; }
      .dt-pva-balk { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 12px; padding: 12px; border-radius: 4px; background: #f6f8fa; }
      .dt-pva-sectie { border-top: 1px solid #e0e6ea; padding-top: 12px; }
      .dt-pva-sectie h3 { margin: 0 0 10px; font-size: 16px; line-height: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
      .dt-pva-nr { display: inline-grid; place-items: center; width: 24px; height: 24px; background: #222; color: #fff; font-size: 13px; border-radius: 2px; }
      .dt-pva-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 12px; }
      .dt-pva-label { display: flex; flex-direction: column; gap: 4px; margin: 0 0 10px; font-size: 13px; font-weight: 600; }
      .dt-pva-veld { box-sizing: border-box; width: 100%; min-height: 32px; padding: 4px 8px; border: 1px solid #818b98; border-radius: 4px; background: #fff; color: #25292f; font: 400 14px/20px open-sans, sans-serif; }
      .dt-pva-veld:focus { outline: 2px solid #1f97f9; outline-offset: 0; border-color: #1f97f9; } .dt-pva-veld:disabled { background: #f0f2f5; color: #393f46; }
      textarea.dt-pva-veld { resize: vertical; }
      .dt-pva-vinkjes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin: 0 0 10px; }
      .dt-pva-vink { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
      .dt-pva-tabel { width: 100%; border-collapse: collapse; margin: 0 0 10px; }
      .dt-pva-tabel th { text-align: left; font-size: 12px; color: #59636e; padding: 6px 8px; border-bottom: 1px solid #c8d1da; }
      .dt-pva-tabel td { padding: 4px 8px; border-bottom: 1px solid #f0f2f5; font-size: 13px; vertical-align: middle; }
      .dt-pva-mini { border: 0; background: none; color: #59636e; font-size: 18px; cursor: pointer; }
      .dt-pva-link { border: 0; background: none; padding: 4px 0; color: #056dc2; font: 600 13px open-sans, sans-serif; cursor: pointer; }
      .dt-pva-lijst { display: flex; flex-direction: column; gap: 8px; }
      .dt-pva-rij { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border: 1px solid #c8d1da; border-radius: 4px; background: #fff; text-align: left; font: inherit; cursor: pointer; }
      .dt-pva-rij:hover { border-color: #056dc2; background: #f0f8ff; } .dt-pva-rij span { color: #59636e; font-size: 13px; }
      .dt-pva-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px); opacity: 0; z-index: 2100; padding: 10px 16px; border-radius: 4px; background: #233243; color: #fff; font: 600 14px/20px open-sans, sans-serif; max-width: 80vw; transition: .2s; }
      .dt-pva-toast.is-aan { opacity: 1; transform: translate(-50%, 0); }
    `;
    document.head.append(st);
  },
});
