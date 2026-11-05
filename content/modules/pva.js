/* Plan van aanpak bij de begeleiding van een student (Begeleiding › Logboek), voor SLB'ers en docenten.
 *
 * Naast "+ Toevoegen" in het logboek staat een knop "Plan van aanpak". Het formulier volgt een PROFIEL: welke
 * leerlijnen en vakken, basisvaardigheden, redenen, het traject (bijv. Blijf Bij Ma met brief 1/2/3) en de
 * evaluatietermijnen. Het eerste profiel is MIP/MEP van het Mediacollege (met de eigen Word-templates); andere
 * opleidingen of scholen maken een eigen profiel, met een eigen Word-sjabloon met plaatshouders of het
 * standaard-Word, en delen het als bestand (exporteren/importeren).
 * Vooraf ingevuld uit Magister: naam, studentnummer, klas, geboortedatum, jij als SLB, minderjarig of 18+ met
 * toestemming, en de aanwezigheid (% van de lessen, ziek, ongeoorloofd, te laat).
 *  - Word downloaden: eigen sjabloon (PvaDocx.sjabloon), het ingebouwde MA-template (PvaDocx.vul) of standaard-Word.
 *  - Gespreksnotitie: Magisters "Gespreksnotitie" met een samenvatting en het plan als bijlage (DTForms).
 *  - Evaluatie inplannen: een nieuwe afspraak in Magister op de evaluatiedatum.
 * Plannen en profielen blijven in deze browser (chrome.storage.local); het definitieve plan staat als bijlage
 * bij de gespreksnotitie in Magister. Er wordt niets in Magister opgeslagen zonder dat jij op Opslaan klikt. */
DT.register({
  id: "pva",
  _stop: null,
  NOTITIE: "dt-pva-notitie",
  AFSPRAAK: "dt-pva-afspraak",
  OPEN: "dt-pva-open",   // gezet door de Te laat-balie: open het formulier bij deze student, met aanleiding
  MAAND: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],

  /* ---------- profielen ---------- */
  /* Ingebouwd: MIP/MEP (Mediacollege) en een algemeen startprofiel. Eigen profielen staan in chrome.storage.local
   * ("pva:profielen") en zijn te delen als .json (met eventuele eigen Word-sjablonen erin). */
  PROFIELEN: [
    {
      id: "ma-mipmep", naam: "MIP/MEP", school: "Mediacollege Amsterdam", ingebouwd: "ma", vast: true,
      soorten: {
        algemeen: { naam: "Plan van aanpak algemeen", sub: "studievoortgang en begeleiding" },
        bbm: { naam: "Plan van aanpak Blijf Bij Ma", kort: "Blijf Bij Ma", vervolg: true,
          stappen: [["brief1", "Brief 1: SLB"], ["brief2", "Brief 2: SLB en collega"], ["brief3", "Brief 3: SLB en opleidingsmanager"], ["vsa", "Na negatief VSA"]] },
      },
      redenen: [["voortgang", "studievoortgang"], ["verzuim", "verzuim"], ["werkhouding", "inzet en werkhouding"], ["afspraken", "afspraken niet nagekomen"], ["anders", "anders"]],
      kolommen: ["Vakvaardigheid", "Inzet en werkhouding"], opties: ["voldaan", "niet voldaan"],
      leerlijnenTitel: "Beroepsleerlijnen en vakken",
      leerlijnen: [
        { naam: "Adviseren over mediaproducten", vakken: ["Pitch"], kolommen: [2] },
        { naam: "Voorbereiden van de mediaproductie", vakken: ["PRM"], kolommen: [2] },
        { naam: "Coördineren van de mediaproductie", vakken: ["BO Branche in Beeld"], kolommen: [2] },
        { naam: "Professioneel handelen", tekst: "Alle vakken: inzet en werkhouding … van 9 voldaan (op koers vanaf 6) en {pct}% aanwezig (norm 80%)." },
        { naam: "Vakvaardigheden", vakken: ["Project", "Intro branche", "MarCom / Muziekmarketing & promotie", "Professional Skills", "Digital Tools", "Creatie"] },
      ],
      standen: ["stap 1 behaald", "stap 2 behaald", "op koers", "niet op koers", "niet behaald", "nog niet beoordeeld"],
      basisTitel: "Basisvaardigheden", basis: ["Nederlands", "Rekenen", "Engels"], basisVast: [["Burgerschap", "nog niet getoetst", "–", "telt nu niet mee"]],
      evaluatieDagen: { verzuim: 20, anders: 34 },
      hints: { leerlijnen: "De stand per leerlijn komt uit het leerlijndiagram in Simulise.",
        algemeen: "Eerste evaluatie na 4 tot 6 weken; bij verzuim eerder, na 2 tot 3 weken.",
        bbm: "Geef de student per brief 4 tot 6 weken. Doelen niet behaald: de volgende stap in Blijf Bij Ma." },
    },
    {
      id: "standaard", naam: "Standaard (leeg)", school: "", vast: true,
      soorten: { algemeen: { naam: "Plan van aanpak" }, bbm: { naam: "Plan van aanpak traject", kort: "Traject", vervolg: true, stappen: [["stap1", "Stap 1"], ["stap2", "Stap 2"], ["stap3", "Stap 3"]] } },
      redenen: [["voortgang", "studievoortgang"], ["verzuim", "verzuim"], ["werkhouding", "inzet en werkhouding"], ["afspraken", "afspraken niet nagekomen"], ["anders", "anders"]],
      kolommen: ["Resultaat", "Inzet en werkhouding"], opties: ["voldaan", "niet voldaan"], leerlijnenTitel: "Leerlijnen en vakken", leerlijnen: [],
      standen: ["op koers", "niet op koers", "behaald", "niet behaald"], basisTitel: "Basisvaardigheden", basis: ["Nederlands", "Engels", "Rekenen"],
      evaluatieDagen: { verzuim: 20, anders: 34 }, hints: {},
    },
  ],
  async profielen() { return [...this.PROFIELEN, ...((await this.opslag("pva:profielen")) || [])]; },
  async profiel(id = null) {
    const alle = await this.profielen(), gekozen = id || (await this.opslag("pva:profiel")) || "ma-mipmep";
    return alle.find((x) => x.id === gekozen) || alle[0];
  },
  async bewaarProfiel(pr) {
    const eigen = ((await this.opslag("pva:profielen")) || []).filter((x) => x.id !== pr.id);
    if (!pr.vast) eigen.push(pr);
    await this.opslag("pva:profielen", eigen);
  },
  soortVan(pr, p) { return (pr.soorten || {})[p.soort] || { naam: "Plan van aanpak" }; },

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
  async plannenVan(id) {
    /* Plannen van vóór de profielen (0.45) horen bij MIP/MEP en hadden vakken als {vv, iw}. */
    return ((await this.opslag(`pva:${id}`)) || []).map((p) => {
      if (p.profielId) return p;
      p.profielId = "ma-mipmep";
      for (const v of Object.values(p.vakken || {})) { if ("vv" in v || "iw" in v) { v[1] = v.vv; v[2] = v.iw; delete v.vv; delete v.iw; } }
      [["Pitch", 1], ["PRM", 2], ["BO Branche in Beeld", 3]].forEach(([vak, n]) => { const iw = p.leerlijnen?.[n]?.iw; if (iw) ((p.vakken ||= {})[vak] ||= {})[2] = iw; });
      return p;
    });
  },
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

  nieuwPlan(DT, s, a, pr, soort = "algemeen", extra = {}, eerder = []) {
    const vandaag = this.vandaag(), c = this._std || {};
    const stappen = (pr.soorten?.[soort]?.stappen || []).map(([k]) => k);
    const gehad = eerder.filter((p) => p.soort === soort && p.profielId === pr.id).map((p) => stappen.indexOf(p.stap)).filter((i) => i >= 0);
    const verzuim = (extra.redenen || []).includes("verzuim"), dagen = pr.evaluatieDagen || { verzuim: 20, anders: 34 };
    const leerlijnen = {};
    (pr.leerlijnen || []).forEach((l, i) => { leerlijnen[i + 1] = l.tekst ? { tekst: this.vulPct(l.tekst, a.pct) } : {}; });
    return {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, profielId: pr.id, magisterId: s.magisterId, naam: s.naam, achternaam: s.achternaam, roepnaam: s.roepnaam,
      stamnr: s.stamnr, klas: s.klas, geboortedatum: this.dmy(s.geboortedatum), soort,
      stap: stappen[Math.min(stappen.length - 1, gehad.length ? Math.max(...gehad) + 1 : 0)] || "",
      datum: vandaag, slb: c.slb || s.ik || "", om: c.om || "", coach: c.coach || "",
      aanwezig: { student: true, ouders: s.minderjarig !== false || s.ouderToestemming, collega: "" },
      redenen: (extra.redenen || []).filter((r) => (pr.redenen || []).some(([k]) => k === r)), anders: "", toelichting: extra.toelichting || "",
      leerlijnen, vakken: {}, basis: {}, aanwezigheid: a.tekst, pct: a.pct,
      doelen: [{}, {}, {}], acties: [{ wie: "Student" }, { wie: "Student" }, { wie: "SLB" }], woorden: {},
      evaluaties: [{ datum: this.schooldag(this.plusDagen(vandaag, verzuim ? dagen.verzuim : dagen.anders)) }, ...(soort === "algemeen" ? [{}] : [])],
      ouderNaam: "", aangemaakt: new Date().toISOString(),
    };
  },
  vulPct(t, pct) { return String(t || "").replace(/\{pct\}/g, pct ?? "…"); },
  titel(p, pr = this._pr) {
    const so = pr ? this.soortVan(pr, p) : { naam: "Plan van aanpak" };
    const stap = (so.stappen || []).find(([k]) => k === p.stap);
    return stap ? `${so.naam} · ${stap[1].replace(/:.*/, "")}` : so.naam;
  },

  /* ---------- openen: eerdere plannen of een nieuw plan ---------- */
  async openen(DT, id, vanBalie = null) {
    this.css();
    const laden = this.modal(DT, "Plan van aanpak", [DT.el("p", { class: "dt-pva-zacht", text: "Gegevens ophalen uit Magister…" })], []);
    try {
      const [s, a, eerder, std, pr] = await Promise.all([this.student(DT, id), this.aanwezigheid(DT, id), this.plannenVan(id), this.opslag("pva:standaard"), this.profiel()]);
      this._std = std || {}; this._s = s; this._a = a; this._pr = pr; this._id = id;
      if (vanBalie) {
        const soort = vanBalie.soort === "bbm" && pr.soorten?.bbm ? "bbm" : "algemeen";
        return this.formulier(DT, this.nieuwPlan(DT, s, a, pr, soort, vanBalie, eerder));
      }
      if (!eerder.length) return this.formulier(DT, this.nieuwPlan(DT, s, a, pr, "algemeen", {}, eerder));
      this.overzicht(DT);
    } catch (e) { laden.remove(); this.melding(`Ophalen uit Magister lukte niet: ${e.message || e}`); }
  },
  async overzicht(DT) {
    const s = this._s, a = this._a, pr = this._pr, eerder = await this.plannenVan(this._id), alle = await this.profielen();
    const rij = (p) => {
      const ev = (p.evaluaties || []).find((e) => e.datum && !e.doelen), ppr = alle.find((x) => x.id === p.profielId) || pr;
      const b = DT.el("button", { type: "button", class: "dt-pva-rij" }, [DT.el("b", { text: this.titel(p, ppr) }),
        DT.el("span", { text: `gesprek ${this.lang(p.datum)}${ev ? ` · evaluatie ${this.lang(ev.datum)}` : ""}${p.notitieOp ? " · notitie klaargezet" : ""}${ppr.id !== pr.id ? ` · profiel ${ppr.naam}` : ""}` })]);
      b.addEventListener("click", () => { this._pr = ppr; this.formulier(DT, p); });
      return b;
    };
    const nieuw = Object.entries(pr.soorten || {}).map(([k, so], i, l) => [`Nieuw: ${so.naam}`, () => this.formulier(DT, this.nieuwPlan(DT, s, a, pr, k, {}, eerder)), i === l.length - 1]);
    this.modal(DT, `Plan van aanpak: ${s.naam}`, [
      DT.el("p", { class: "dt-pva-zacht", text: `Profiel: ${pr.naam}${pr.school ? ` (${pr.school})` : ""}. Eerdere plannen staan in deze browser; het definitieve plan staat als bijlage bij de gespreksnotitie in het logboek.` }),
      eerder.length ? DT.el("div", { class: "dt-pva-lijst" }, eerder.slice().sort((x, y) => y.datum.localeCompare(x.datum)).map(rij)) : DT.el("p", { text: "Nog geen plannen voor deze student." }),
    ], [["Profielen", () => this.profielBeheer(DT)], ["Sluiten", null], ...nieuw]);
  },

  /* ---------- het formulier, opgebouwd volgens het profiel ---------- */
  formulier(DT, p) {
    const pr = this._pr, so = this.soortVan(pr, p), traject = p.soort !== "algemeen";
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
    let nr = 0;
    const sectie = (titel, ...inhoud) => DT.el("section", { class: "dt-pva-sectie" }, [DT.el("h3", {}, [DT.el("span", { class: "dt-pva-nr", text: String(++nr) }), ` ${titel}`]), ...inhoud.filter(Boolean)]);
    const tabel = (koppen, rijen) => DT.el("table", { class: "dt-pva-tabel" }, [DT.el("thead", {}, DT.el("tr", {}, koppen.map((t) => DT.el("th", { text: t })))), DT.el("tbody", {}, rijen)]);
    const OPT = [["", "—"], ...(pr.opties || ["voldaan", "niet voldaan"]).map((o) => [o, o]), ["–", "n.v.t."]];
    const s = this._s || {}, kolommen = pr.kolommen || [];
    const datalijsten = [
      DT.el("datalist", { id: "dt-pva-standen" }, (pr.standen || []).map((v) => DT.el("option", { value: v }))),
      DT.el("datalist", { id: "dt-pva-wie" }, ["Student", "SLB", "Docent", "Ouder/verzorger", "Begeleidingscoach", "Opleidingsmanager"].map((v) => DT.el("option", { value: v }))),
    ];
    const lijst = (k, kols, nieuw) => {
      const rijen = p[k] || (p[k] = []);
      return DT.el("div", {}, [
        tabel([...kols.map(([, t]) => t), ""], rijen.map((_, i) => DT.el("tr", {}, [...kols.map(([v, , opt]) => DT.el("td", {}, inp(`${k}.${i}.${v}`, opt || {}))),
          DT.el("td", {}, rijen.length > 1 ? (() => { const x = DT.el("button", { type: "button", class: "dt-pva-mini", text: "×", title: "Regel verwijderen" }); x.addEventListener("click", () => { rijen.splice(i, 1); bewaar(); opnieuw(); }); return x; })() : "")]))),
        (() => { const b = DT.el("button", { type: "button", class: "dt-pva-link", text: "+ Regel toevoegen" }); b.addEventListener("click", () => { rijen.push(nieuw()); bewaar(); opnieuw(); }); return b; })(),
      ]);
    };
    const ouderLabel = s.minderjarig === false ? (s.ouderToestemming ? "ouder(s)/verzorger(s) (18+, met toestemming)" : "ouder(s)/verzorger(s) (18+: alleen met toestemming)") : "ouder(s)/verzorger(s) (minderjarig: uitnodigen)";
    /* Leerlijnen en vakken volgens het profiel: per leerlijn de vakken met de kolommen, of een vrije tekst. */
    const llRijen = [];
    (pr.leerlijnen || []).forEach((l, i) => {
      const n = i + 1, kop = `${n}. ${l.naam}`;
      if (l.tekst || !(l.vakken || []).length) {
        llRijen.push(DT.el("tr", {}, [DT.el("td", { text: kop }), DT.el("td", {}, inp(`leerlijnen.${n}.stand`, { lijst: "dt-pva-standen" })),
          DT.el("td", { colspan: String(1 + kolommen.length) }, vak(`leerlijnen.${n}.tekst`, 2))]));
        return;
      }
      l.vakken.forEach((v, j) => llRijen.push(DT.el("tr", {}, [
        DT.el("td", { text: j ? "" : kop }), DT.el("td", {}, j ? "" : inp(`leerlijnen.${n}.stand`, { lijst: "dt-pva-standen" })), DT.el("td", { text: v }),
        ...kolommen.map((_, k) => DT.el("td", {}, !l.kolommen || l.kolommen.includes(k + 1) ? kies(`vakken.${v}.${k + 1}`, OPT) : "–")),
      ])));
    });
    const basis = [...(pr.basis || []).map((v) => DT.el("tr", {}, [DT.el("td", { text: v }), DT.el("td", {}, inp(`basis.${v}.getoetst`)), DT.el("td", {}, inp(`basis.${v}.behaald`)), DT.el("td", {}, inp(`basis.${v}.stand`, { lijst: "dt-pva-standen" }))])),
      ...(pr.basisVast || []).map((r) => DT.el("tr", {}, r.map((t) => DT.el("td", { text: t }))))];

    const inhoud = [
      ...datalijsten,
      DT.el("div", { class: "dt-pva-balk" }, [
        veld("Formulier", kies("soort", Object.entries(pr.soorten || {}).map(([k, x]) => [k, x.naam]), () => {
          const st = pr.soorten[p.soort]?.stappen || [];
          if (st.length && !st.some(([k]) => k === p.stap)) p.stap = st[0][0];
          if (p.soort === "algemeen" && p.evaluaties.length < 2) p.evaluaties.push({});
          bewaar(); opnieuw();
        })),
        (so.stappen || []).length ? veld("Stap", kies("stap", so.stappen)) : null,
        veld("Datum gesprek", inp("datum", { type: "date" })),
      ].filter(Boolean)),
      sectie("Gegevens",
        DT.el("div", { class: "dt-pva-grid" }, [vast("Naam", p.naam), vast("Studentnummer", p.stamnr), vast("Klas", p.klas), veld("Geboortedatum", inp("geboortedatum", { ph: "dd-mm-jjjj" })),
          veld("SLB", inp("slb")), ...(traject ? [veld("Opleidingsmanager", inp("om")), veld("Begeleidingscoach", inp("coach"))] : [])]),
        DT.el("div", { class: "dt-pva-vinkjes" }, [
          vinkje("student", p.aanwezig?.student, (v) => { pad("aanwezig").student = v; }),
          vinkje(ouderLabel, p.aanwezig?.ouders, (v) => { pad("aanwezig").ouders = v; }),
          DT.el("span", { class: "dt-pva-vink" }, [DT.el("span", { text: "collega:" }), inp("aanwezig.collega", { ph: "naam", breed: "200px" })]),
        ])),
      sectie("Aanleiding",
        DT.el("div", { class: "dt-pva-vinkjes" }, [...(pr.redenen || []).map(([k, t]) => vinkje(t, (p.redenen || []).includes(k), (v) => { p.redenen = (p.redenen || []).filter((x) => x !== k); if (v) p.redenen.push(k); })),
          (pr.redenen || []).some(([k]) => k === "anders") ? inp("anders", { ph: "anders: …", breed: "220px" }) : null].filter(Boolean)),
        veld("Toelichting", vak("toelichting", 3, "Twee of drie zinnen, alleen feiten, met een peildatum. Geen oordeel over de persoon."))),
      sectie("Waar sta je nu",
        llRijen.length ? tabel(["Leerlijn", "Stand", "Vak", ...kolommen], llRijen) : null,
        basis.length ? tabel([pr.basisTitel || "Basisvaardigheid", "Getoetst tot nu toe", "Behaald", "Stand"], basis) : null,
        veld("Aanwezigheid (uit Magister)", vak("aanwezigheid", 2)),
        pr.hints?.leerlijnen ? DT.el("p", { class: "dt-pva-zacht", text: pr.hints.leerlijnen }) : null),
      sectie("Wat ga je behalen", lijst("doelen", [["doel", "Doel", { ph: "meetbaar, gekoppeld aan vakken en toetsen" }], ["bewijs", "Waaraan zie je het"], ["uiterlijk", "Uiterlijk", { ph: "datum" }]], () => ({})),
        DT.el("p", { class: "dt-pva-zacht", text: "De student formuleert de doelen mee." })),
      sectie("Acties en afspraken", lijst("acties", [["wie", "Wie", { lijst: "dt-pva-wie" }], ["wat", "Doet wat"], ["wanneer", "Wanneer"]], () => ({ wie: "Student" }))),
      sectie("In jouw woorden",
        veld("Waardoor loopt het nu niet zoals je wilt?", vak("woorden.waardoor", 2)), veld("Wat ga jij vanaf nu anders doen?", vak("woorden.anders", 2)),
        veld("Wat heb je nodig van school of van thuis?", vak("woorden.nodig", 2)),
        DT.el("p", { class: "dt-pva-zacht", text: "Laat de student dit zelf invullen of formuleren; dit is de kern van het gesprek." })),
      sectie("Evaluatie",
        tabel(["Datum", "Doelen", traject && so.vervolg ? "Vervolg" : "Afspraak en vervolg"], (p.evaluaties || []).map((_, i) => DT.el("tr", {}, [
          DT.el("td", {}, inp(`evaluaties.${i}.datum`, { type: "date" })),
          DT.el("td", {}, kies(`evaluaties.${i}.doelen`, [["", "—"], ["behaald", "behaald"], ["deels", "deels"], ["niet", "niet"]])),
          DT.el("td", {}, traject && so.vervolg ? kies(`evaluaties.${i}.vervolg`, [["", "—"], ["afsluiten", "afsluiten"], ["nieuw", "nieuw plan"], ["volgende", "volgende stap"]]) : inp(`evaluaties.${i}.afspraak`)),
        ]))),
        pr.hints?.[p.soort] ? DT.el("p", { class: "dt-pva-zacht", text: pr.hints[p.soort] }) : null),
      sectie("Akkoord", DT.el("div", { class: "dt-pva-grid" }, [veld("Ouder/verzorger (bij minderjarige)", inp("ouderNaam", { ph: "naam" }))])),
    ].filter(Boolean);
    const status = [p.gedownload && "Word gedownload", p.notitieOp && "gespreksnotitie klaargezet", p.afspraakOp && "evaluatie ingepland"].filter(Boolean);
    this.modal(DT, `${this.titel(p)}: ${p.naam}`, [
      DT.el("p", { class: "dt-pva-zacht", text: `${p.klas} · ${p.stamnr} · profiel ${pr.naam}${status.length ? ` · ${status.join(" · ")}` : ""}. Wordt bewaard in deze browser.` }), ...inhoud,
    ], [
      ["Verwijderen", async () => { if (!confirm("Dit plan van aanpak uit deze browser verwijderen? Een notitie in Magister blijft bestaan.")) return; await this.verwijderPlan(p); this.overzicht(DT); }],
      ["Terug", () => this.overzicht(DT)],
      ["Word downloaden", () => this.download(p)],
      ["Evaluatie inplannen", () => this.evaluatie(p)],
      ["Gespreksnotitie in Magister", () => this.notitie(p), true],
    ]);
    this.bewaarPlan(p);
    /* SLB, opleidingsmanager en coach onthouden voor het volgende plan (in deze browser). */
    const std = { slb: p.slb || "", om: p.om || this._std?.om || "", coach: p.coach || this._std?.coach || "" };
    if (JSON.stringify(std) !== JSON.stringify(this._std || {})) { this._std = std; this.opslag("pva:standaard", std); }
  },

  /* ---------- profielen beheren: kiezen, kopiëren, bewerken, delen ---------- */
  async profielBeheer(DT) {
    const alle = await this.profielen(), actief = (await this.opslag("pva:profiel")) || "ma-mipmep";
    const rij = (pr) => {
      const kies = DT.el("input", { type: "radio", name: "dt-pva-profiel" }); kies.checked = pr.id === actief;
      kies.addEventListener("change", async () => { await this.opslag("pva:profiel", pr.id); this._pr = pr; this.melding(`Profiel ${pr.naam} gekozen.`); });
      const knop = (t, fn) => { const b = DT.el("button", { type: "button", class: "dt-pva-link", text: t }); b.addEventListener("click", fn); return b; };
      return DT.el("div", { class: "dt-pva-profielrij" }, [
        DT.el("label", { class: "dt-pva-vink" }, [kies, DT.el("span", {}, [DT.el("b", { text: pr.naam }), DT.el("small", { text: ` ${pr.school || ""}${pr.vast ? " · ingebouwd" : ""}${Object.values(pr.sjablonen || {}).some(Boolean) ? " · eigen Word-sjabloon" : pr.ingebouwd ? " · eigen templates" : ""}` })])]),
        DT.el("span", { class: "dt-pva-acties" }, [
          pr.vast ? null : knop("Bewerken", () => this.profielEditor(DT, pr)),
          knop("Kopiëren", async () => { const kopie = JSON.parse(JSON.stringify(pr)); Object.assign(kopie, { id: `p${Date.now().toString(36)}`, naam: `${pr.naam} (kopie)`, vast: false }); delete kopie.ingebouwd; await this.bewaarProfiel(kopie); this.profielEditor(DT, kopie); }),
          knop("Exporteren", () => this.bestand(`profiel_${pr.naam.replace(/[^\p{L}\p{N}]+/gu, "_")}.json`, JSON.stringify(Object.assign({ type: "docent-tools-pva-profiel", versie: 1 }, pr, { vast: false, ingebouwd: undefined }), null, 2), "application/json")),
          pr.vast ? null : knop("Verwijderen", async () => { if (!confirm(`Profiel ${pr.naam} verwijderen?`)) return; await this.opslag("pva:profielen", ((await this.opslag("pva:profielen")) || []).filter((x) => x.id !== pr.id)); this.profielBeheer(DT); }),
        ].filter(Boolean)),
      ]);
    };
    const imp = DT.el("input", { type: "file", accept: ".json,application/json", style: "display:none" });
    imp.addEventListener("change", async () => {
      try {
        const pr = JSON.parse(await imp.files[0].text());
        if (pr.type !== "docent-tools-pva-profiel" || !pr.soorten) throw new Error("dit is geen profiel voor Plan van aanpak");
        pr.vast = false; if (alle.some((x) => x.id === pr.id && x.vast)) pr.id = `p${Date.now().toString(36)}`;
        await this.bewaarProfiel(pr); await this.opslag("pva:profiel", pr.id); this._pr = pr;
        this.melding(`Profiel ${pr.naam} geïmporteerd en gekozen.`); this.profielBeheer(DT);
      } catch (e) { this.melding(`Importeren lukte niet: ${e.message || e}`); }
    });
    this.modal(DT, "Profielen voor Plan van aanpak", [
      DT.el("p", { class: "dt-pva-zacht", text: "Een profiel bepaalt de inhoud van het formulier: leerlijnen en vakken, basisvaardigheden, redenen, het traject en zijn stappen, evaluatietermijnen en het Word-sjabloon. Kies het profiel van jouw opleiding, kopieer een bestaand profiel om het aan te passen, of importeer het profielbestand van je team." }),
      DT.el("div", { class: "dt-pva-lijst" }, alle.map(rij)), imp,
    ], [["Profiel importeren…", () => imp.click()], ["Terug", () => (this._s ? this.overzicht(DT) : document.querySelector(".dt-pva-modal")?.remove())]]);
  },
  async profielEditor(DT, pr) {
    const bewaar = async () => { await this.bewaarProfiel(pr); if (this._pr?.id === pr.id) this._pr = pr; };
    const veld = (label, el, hint = "") => DT.el("label", { class: "dt-pva-label" }, [DT.el("span", {}, [label, hint ? DT.el("small", { class: "dt-pva-zacht", text: ` · ${hint}` }) : null].filter(Boolean)), el]);
    const tekst = (waarde, zet, { rijen = 0, ph = "" } = {}) => { const e = DT.el(rijen ? "textarea" : "input", { class: "dt-pva-veld", placeholder: ph, ...(rijen ? { rows: String(rijen) } : { type: "text" }) }); e.value = waarde ?? ""; e.addEventListener("change", () => { zet(e.value); bewaar(); }); return e; };
    const regels = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const sleutel = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 20) || `k${Math.random().toString(36).slice(2, 6)}`;
    const so = pr.soorten || (pr.soorten = { algemeen: { naam: "Plan van aanpak" } });
    const traject = so.bbm;
    const llTekst = (pr.leerlijnen || []).map((l) => l.tekst ? `${l.naam} = ${l.tekst}` : `${l.naam}: ${(l.vakken || []).join("; ")}${l.kolommen ? ` [${l.kolommen.join(",")}]` : ""}`).join("\n");
    const sjabloon = (k, naam) => {
      const huidig = pr.sjablonen?.[k];
      const kies = DT.el("input", { type: "file", accept: ".docx", style: "display:none" });
      kies.addEventListener("change", async () => {
        const f = kies.files[0]; if (!f) return;
        const b = new Uint8Array(await f.arrayBuffer()); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
        (pr.sjablonen ||= {})[k] = { naam: f.name, base64: btoa(bin) }; await bewaar(); this.profielEditor(DT, pr);
      });
      const knop = (t, fn) => { const b = DT.el("button", { type: "button", class: "dt-pva-link", text: t }); b.addEventListener("click", fn); return b; };
      return DT.el("div", { class: "dt-pva-profielrij" }, [DT.el("span", {}, [DT.el("b", { text: naam }), DT.el("small", { text: ` ${huidig ? `eigen sjabloon: ${huidig.naam}` : "standaard-Word"}` })]),
        DT.el("span", { class: "dt-pva-acties" }, [kies,
          knop("Voorbeeldsjabloon downloaden", () => this.bestand(`Sjabloon_${naam.replace(/[^\p{L}\p{N}]+/gu, "_")}.docx`, PvaDocx.standaardSjabloon(pr, k), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
          knop(huidig ? "Ander sjabloon…" : "Eigen sjabloon kiezen…", () => kies.click()),
          huidig ? knop("Standaard gebruiken", async () => { delete pr.sjablonen[k]; await bewaar(); this.profielEditor(DT, pr); }) : null].filter(Boolean))]);
    };
    this.modal(DT, `Profiel bewerken: ${pr.naam}`, [
      DT.el("div", { class: "dt-pva-grid" }, [veld("Naam van het profiel", tekst(pr.naam, (v) => { pr.naam = v || "Profiel"; })), veld("School", tekst(pr.school, (v) => { pr.school = v; })),
        veld("Logboektype in Magister", tekst(pr.logboekType || "Gespreksnotitie", (v) => { pr.logboekType = v.trim() || "Gespreksnotitie"; }), "zoals bij Begeleiding › Toevoegen")]),
      DT.el("h3", { class: "dt-pva-kopje", text: "Soorten plannen" }),
      DT.el("div", { class: "dt-pva-grid" }, [
        veld("Algemeen plan", tekst(so.algemeen?.naam, (v) => { (so.algemeen ||= {}).naam = v || "Plan van aanpak"; })),
        veld("Traject (leeg = geen traject)", tekst(traject?.naam, (v) => { if (!v) delete so.bbm; else (so.bbm ||= { vervolg: true, stappen: [] }).naam = v; }), "bijv. Blijf Bij Ma"),
      ]),
      traject ? veld("Stappen van het traject", tekst((traject.stappen || []).map(([, t]) => t).join("\n"), (v) => { traject.stappen = regels(v).map((t, i) => [traject.stappen?.[i]?.[0] || `${sleutel(t)}${i}`, t]); }, { rijen: 4 }), "één per regel") : null,
      DT.el("h3", { class: "dt-pva-kopje", text: "Aanleiding" }),
      veld("Redenen", tekst((pr.redenen || []).map(([, t]) => t).join("\n"), (v) => { pr.redenen = regels(v).map((t) => [/^anders/i.test(t) ? "anders" : /verzuim/i.test(t) ? "verzuim" : sleutel(t), t]); }, { rijen: 5 }), "één per regel; \"anders\" krijgt een invulveld"),
      DT.el("h3", { class: "dt-pva-kopje", text: "Waar sta je nu" }),
      DT.el("div", { class: "dt-pva-grid" }, [
        veld("Titel leerlijnen", tekst(pr.leerlijnenTitel, (v) => { pr.leerlijnenTitel = v; })),
        veld("Kolommen per vak", tekst((pr.kolommen || []).join(", "), (v) => { pr.kolommen = v.split(",").map((x) => x.trim()).filter(Boolean); }), "gescheiden door komma's"),
        veld("Keuzes in die kolommen", tekst((pr.opties || []).join(", "), (v) => { pr.opties = v.split(",").map((x) => x.trim()).filter(Boolean); })),
      ]),
      veld("Leerlijnen", tekst(llTekst, (v) => {
        pr.leerlijnen = regels(v).map((r) => {
          const vrij = r.match(/^(.+?)\s*=\s*(.*)$/); if (vrij) return { naam: vrij[1], tekst: vrij[2] };
          const m = r.match(/^(.+?)(?::\s*(.*?))?(?:\s*\[([\d,\s]+)\])?$/), vakken = (m[2] || "").split(";").map((x) => x.trim()).filter(Boolean);
          const l = { naam: m[1].trim(), vakken }; if (m[3]) l.kolommen = m[3].split(",").map(Number).filter(Boolean); return l;
        });
      }, { rijen: 7, ph: "Kerntaak 1: Vak A; Vak B\nProfessioneel handelen = Inzet … van 9 voldaan en {pct}% aanwezig" }),
        "per regel: Leerlijn: vak; vak  ·  [2] = alleen kolom 2 invullen  ·  Leerlijn = vrije tekst ({pct} = aanwezigheid)"),
      DT.el("div", { class: "dt-pva-grid" }, [
        veld("Titel basisvaardigheden", tekst(pr.basisTitel, (v) => { pr.basisTitel = v; })),
        veld("Basisvaardigheden", tekst((pr.basis || []).join(", "), (v) => { pr.basis = v.split(",").map((x) => x.trim()).filter(Boolean); }), "gescheiden door komma's"),
        veld("Keuzes voor de stand", tekst((pr.standen || []).join(", "), (v) => { pr.standen = v.split(",").map((x) => x.trim()).filter(Boolean); })),
        veld("Hulptekst onder Waar sta je nu", tekst(pr.hints?.leerlijnen, (v) => { (pr.hints ||= {}).leerlijnen = v; })),
      ]),
      DT.el("h3", { class: "dt-pva-kopje", text: "Evaluatie" }),
      DT.el("div", { class: "dt-pva-grid" }, [
        veld("Eerste evaluatie na (dagen) bij verzuim", tekst(pr.evaluatieDagen?.verzuim ?? 20, (v) => { (pr.evaluatieDagen ||= {}).verzuim = Math.max(1, parseInt(v, 10) || 20); })),
        veld("Eerste evaluatie na (dagen) anders", tekst(pr.evaluatieDagen?.anders ?? 34, (v) => { (pr.evaluatieDagen ||= {}).anders = Math.max(1, parseInt(v, 10) || 34); })),
        veld("Hulptekst evaluatie algemeen", tekst(pr.hints?.algemeen, (v) => { (pr.hints ||= {}).algemeen = v; })),
        traject ? veld("Hulptekst evaluatie traject", tekst(pr.hints?.bbm, (v) => { (pr.hints ||= {}).bbm = v; })) : null,
      ].filter(Boolean)),
      DT.el("h3", { class: "dt-pva-kopje", text: "Word-sjabloon" }),
      DT.el("p", { class: "dt-pva-zacht", text: "Zonder eigen sjabloon wordt een net standaard-Word gemaakt. Wil je je eigen huisstijl: download het voorbeeldsjabloon, maak het op in Word (logo, kleuren, volgorde) en laat de plaatshouders zoals {naam}, {klas}, {x:reden.verzuim} en {doel.doel} staan. Een tabelrij met {doel.…}, {actie.…}, {vak.…}, {basis.…} of {evaluatie.…} herhaalt zich voor elke regel. {x:…} wordt een aangevinkt of leeg vakje." }),
      sjabloon("algemeen", so.algemeen?.naam || "Algemeen"), traject ? sjabloon("bbm", traject.naam) : null,
    ].filter(Boolean), [["Terug", () => this.profielBeheer(DT)], ["Exporteren", () => this.bestand(`profiel_${pr.naam.replace(/[^\p{L}\p{N}]+/gu, "_")}.json`, JSON.stringify(Object.assign({ type: "docent-tools-pva-profiel", versie: 1 }, pr), null, 2), "application/json")]]);
  },
  bestand(naam, inhoud, type) {
    const url = URL.createObjectURL(new Blob([inhoud], { type }));
    const a = document.createElement("a"); a.href = url; a.download = naam; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },

  /* ---------- Word ---------- */
  /* Gegevens voor een eigen sjabloon of het standaard-Word (plaatshouders). */
  ctx(p, pr) {
    const so = this.soortVan(pr, p), kolommen = pr.kolommen || [];
    const velden = {
      naam: p.naam, studentnummer: p.stamnr, klas: p.klas, geboortedatum: p.geboortedatum, slb: p.slb, datum: this.lang(p.datum),
      opleidingsmanager: p.om, begeleidingscoach: p.coach, collega: p.aanwezig?.collega || "", anders: p.anders, toelichting: p.toelichting,
      aanwezigheid: p.aanwezigheid, pct: p.pct ?? "", ouder: p.ouderNaam, soort: so.naam, stap: (so.stappen || []).find(([k]) => k === p.stap)?.[1] || "",
      profiel: pr.naam, school: pr.school || "", evaluatie: this.lang((p.evaluaties || []).find((e) => e.datum)?.datum),
      "woorden.waardoor": p.woorden?.waardoor, "woorden.anders": p.woorden?.anders, "woorden.nodig": p.woorden?.nodig,
      redenen: (p.redenen || []).map((r) => (pr.redenen || []).find(([k]) => k === r)?.[1] || r).join(", "),
    };
    const vinkjes = { student: !!p.aanwezig?.student, ouders: !!p.aanwezig?.ouders, collega: !!p.aanwezig?.collega };
    for (const r of p.redenen || []) vinkjes[`reden.${r}`] = true;
    if (p.stap) vinkjes[`stap.${p.stap}`] = true;
    const vak = [];
    (pr.leerlijnen || []).forEach((l, i) => {
      const n = i + 1, ll = p.leerlijnen?.[n] || {};
      if (l.tekst || !(l.vakken || []).length) { vak.push({ leerlijn: `${n}. ${l.naam}`, stand: ll.stand, naam: this.vulPct(ll.tekst ?? l.tekst ?? "", p.pct) }); return; }
      l.vakken.forEach((v, j) => vak.push(Object.assign({ leerlijn: j ? "" : `${n}. ${l.naam}`, stand: j ? "" : ll.stand, naam: v },
        Object.fromEntries(kolommen.map((_, k) => [`k${k + 1}`, !l.kolommen || l.kolommen.includes(k + 1) ? (p.vakken?.[v]?.[k + 1] || "") : "–"])))));
    });
    const basis = [...(pr.basis || []).map((b) => Object.assign({ naam: b }, p.basis?.[b] || {})), ...(pr.basisVast || []).map(([naam, getoetst, behaald, stand]) => ({ naam, getoetst, behaald, stand }))];
    const evaluatie = (p.evaluaties || []).map((e) => ({ datum: this.lang(e.datum), afspraak: e.afspraak || "", doelen: e.doelen || "", vervolg: e.vervolg || "",
      x: { [`evaluatie.${e.doelen}`]: !!e.doelen, [`evaluatie.vervolg.${e.vervolg}`]: !!e.vervolg } }));
    return { velden, vinkjes, rijen: { vak, basis, doel: (p.doelen || []).filter((d) => d.doel || d.bewijs || d.uiterlijk), actie: (p.acties || []).filter((a) => a.wat || a.wanneer), evaluatie } };
  },
  /* Het ingebouwde MA-template verwacht de oude vorm (leerlijn 1–5, vakken met vv/iw). */
  maData(p, pr) {
    const ll = {}, vakken = {};
    (pr.leerlijnen || []).forEach((l, i) => {
      const n = i + 1, x = p.leerlijnen?.[n] || {};
      ll[n] = { stand: x.stand, tekst: l.tekst ? this.vulPct(x.tekst ?? l.tekst, p.pct) : undefined, iw: (l.vakken || []).length === 1 ? p.vakken?.[l.vakken[0]]?.[2] : undefined };
      for (const v of l.vakken || []) vakken[v] = { vv: p.vakken?.[v]?.[1], iw: p.vakken?.[v]?.[2] };
    });
    return Object.assign({}, p, { leerlijnen: ll, vakken, datumTekst: this.lang(p.datum), evaluaties: (p.evaluaties || []).map((e) => Object.assign({}, e, { datumTekst: this.lang(e.datum) })) });
  },
  async bytes(p) {
    const pr = (await this.profielen()).find((x) => x.id === p.profielId) || this._pr || (await this.profiel());
    const eigen = pr.sjablonen?.[p.soort];
    if (eigen?.base64) {
      const bin = atob(eigen.base64), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return PvaDocx.sjabloon(b, this.ctx(p, pr));
    }
    if (pr.ingebouwd === "ma") {
      const r = await fetch(chrome.runtime.getURL(`assets/pva/${p.soort === "bbm" ? "bbm" : "algemeen"}.docx`));
      if (!r.ok) throw new Error("template niet gevonden");
      return PvaDocx.vul(new Uint8Array(await r.arrayBuffer()), this.maData(p, pr));
    }
    return PvaDocx.sjabloon(PvaDocx.standaardSjabloon(pr, p.soort), this.ctx(p, pr));
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

  bestandsnaam(p) {
    const naam = [p.achternaam, p.roepnaam].filter(Boolean).join("_").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    const kort = (this._pr?.soorten?.[p.soort]?.kort || "").replace(/[^\p{L}\p{N}]+/gu, "");
    return `PvA_${p.soort !== "algemeen" ? `${kort || "traject"}_${p.stap ? `${p.stap}_` : ""}` : ""}${naam || p.stamnr}_${p.datum}.docx`;
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
    const r = [], redenen = (p.redenen || []).map((x) => (x === "anders" ? `anders: ${p.anders || ""}` : ((this._pr?.redenen || []).find(([k]) => k === x) || [, x])[1]));
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
      const ok = DTForms.logboek(this.NOTITIE, { magisterId: String(p.magisterId), naam: p.naam, type: (this._pr?.logboekType || "Gespreksnotitie"), omschrijving: this.titel(p),
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
      .dt-pva-kopje { margin: 8px 0 4px; font-size: 15px; font-weight: 700; color: #0b385c; }
      .dt-pva-profielrij { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 12px; padding: 10px 12px; border: 1px solid #c8d1da; border-radius: 4px; }
      .dt-pva-profielrij small { color: #59636e; } .dt-pva-acties { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; }
      .dt-pva-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px); opacity: 0; z-index: 2100; padding: 10px 16px; border-radius: 4px; background: #233243; color: #fff; font: 600 14px/20px open-sans, sans-serif; max-width: 80vw; transition: .2s; }
      .dt-pva-toast.is-aan { opacity: 1; transform: translate(-50%, 0); }
    `;
    document.head.append(st);
  },
});
