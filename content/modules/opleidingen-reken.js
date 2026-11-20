/* Opleidingen: de rekenfuncties (zonder pagina en zonder netwerk), los te testen in tests/opleidingen.test.js.
 * De pagina zelf staat in opleidingen.js.
 *
 * Indeling: elke klas hoort bij één opleiding (studie) en één leerjaar; de boom is opleiding › leerjaar › klas.
 * Aanwezigheid: per klas één optelling ("agg") zonder namen: lessen per categorie, per week (maandag) en per
 * weekdag, en hoeveel studenten in welke band van aanwezigheid vallen. Optellingen van klassen tel je bij elkaar op
 * voor een leerjaar, een opleiding of de hele school. */
var OplReken = {
  /* Categorieën van vzStats (verzuiminzicht.js), in de volgorde van de balken. Dezelfde kleuren als Lesregistraties. */
  CATS: [["OK", "Aanwezig", "#2fa36b"], ["TL", "Te laat", "#f5a524"], ["ZK", "Ziek", "#7b8ea6"], ["AB_OK", "Absent geoorloofd", "#8fb8e8"],
    ["AB_NO", "Absent ongeoorloofd", "#e5484d"], ["UI", "Uitgestuurd", "#7b33ff"], ["VR", "Vrijstelling", "#32ade6"]],
  BANDEN: ["onder 70%", "70–79%", "80–89%", "90% of meer"],
  ONBEKEND: "Opleiding onbekend",

  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  datum(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
  /* Schooljaar: 1 augustus t/m 31 juli. */
  sjStart(d = new Date()) { return new Date(d.getFullYear() - (d.getMonth() < 7 ? 1 : 0), 7, 1); },
  sjNaam(d = new Date()) { const y = this.sjStart(d).getFullYear(); return `${y}–${y + 1}`; },

  /* Peildatums voor het verloop: de eerste van elke maand (september t/m juli) vanaf `jaren` schooljaren terug, en
   * vandaag. 1 oktober is de landelijke teldatum en krijgt teldatum: true. Augustus slaan we over: dan lopen oude
   * en nieuwe inschrijvingen door elkaar. */
  peildata(nu = new Date(), jaren = 2) {
    const uit = [], vandaag = this.ymd(nu);
    for (let d = new Date(this.sjStart(nu).getFullYear() - jaren, 8, 1); d <= nu; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      if (d.getMonth() === 7) continue;
      uit.push({ datum: this.ymd(d), teldatum: d.getMonth() === 9, sj: this.sjNaam(d) });
    }
    if (!uit.length || uit[uit.length - 1].datum !== vandaag) uit.push({ datum: vandaag, teldatum: false, sj: this.sjNaam(nu), vandaag: true });
    else uit[uit.length - 1].vandaag = true;
    return uit;
  },

  /* Naam uit een veld dat Magister als tekst, als lijst of als object ({ omschrijving, naam, code }) geeft. */
  naam(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return this.naam(v[0]);
    if (typeof v === "object") return String(v.omschrijving || v.naam || v.code || v.afkorting || "").trim();
    return String(v).trim();
  },
  /* Het veld van een leerling of aanmelding waarvan de naam op het patroon past (hoofdletters maken niet uit). */
  veld(x, patroon) { if (!x || typeof x !== "object") return undefined; const k = Object.keys(x).find((n) => patroon.test(n)); return k ? x[k] : undefined; },
  studie(x) { return this.naam(this.veld(x, /^(studie|studies|studienaam|opleiding|opleidingen|opleidingsnaam)$/i)); },
  leerjaar(x) {
    const s = this.veld(x, /^(studie|opleiding)$/i);
    const v = this.veld(x, /^leerjaar$/i) ?? (s && typeof s === "object" ? this.veld(s, /^leerjaar$/i) : undefined);
    const n = parseInt(this.naam(v), 10);
    return Number.isFinite(n) && n > 0 && n < 20 ? n : null;
  },
  /* Een studiecode als "MI-25881-25" is opleiding, crebo en cohort (het jaar van instroom). Past de tekst niet op
   * dat patroon, dan is de hele tekst de opleiding. */
  code(s) {
    const t = String(s || "").trim(), m = /^([A-Za-z]{1,8})[-_ .]?(\d{5})[-_ .]?(\d{4}|\d{2})$/.exec(t);
    if (!m) return { opleiding: t, crebo: "", cohort: null };
    return { opleiding: m[1].toUpperCase(), crebo: m[2], cohort: +m[3] < 100 ? 2000 + +m[3] : +m[3] };
  },
  /* Wat Magister over een klas gaf ({ studie, lj, mentor }) omzetten naar opleiding, crebo, cohort en leerjaar.
   * Leerjaar: uit Magister, anders uit het cohort (cohort 2025 is in schooljaar 2026–2027 leerjaar 2), anders het
   * eerste cijfer in de klasnaam. */
  indeel(ruw, klas, sjJaar) {
    const c = this.code(ruw?.studie), uitCohort = c.cohort ? sjJaar - c.cohort + 1 : null;
    const leerjaar = ruw?.lj ?? (uitCohort >= 1 && uitCohort <= 9 ? uitCohort : null) ?? (c.cohort ? null : this.leerjaarUitKlas(klas));
    return { studie: c.opleiding, crebo: c.crebo, cohort: c.cohort, leerjaar, mentor: ruw?.mentor || "" };
  },
  /* Het gezamenlijke begin (alleen letters) van een rij klasnamen: MIP1A en MIP2B → MIP. */
  voorvoegsel(namen) {
    let p = String(namen[0] || "");
    for (const n of namen) while (p && !String(n).toUpperCase().startsWith(p.toUpperCase())) p = p.slice(0, -1);
    return (/^[A-Za-z]+/.exec(p) || [""])[0];
  },
  /* Geen leerjaar uit Magister: het eerste cijfer in de klasnaam (MV2A → 2). */
  leerjaarUitKlas(klas) { const m = /[1-9]/.exec(String(klas || "")); return m ? +m[0] : null; },
  /* De aanmelding die op de peildatum loopt (de hoofdaanmelding eerst); anders de laatste. */
  aanmeldingOp(lijst, peil) {
    const am = (lijst || []).filter(Boolean), dag = (v) => String(v || "").slice(0, 10);
    const loopt = am.filter((a) => (!dag(a.begin ?? a.start) || dag(a.begin ?? a.start) <= peil) && (!dag(a.einde ?? a.eind) || dag(a.einde ?? a.eind) >= peil));
    return loopt.find((a) => a.isHoofdAanmelding) || loopt[0] || am.slice().sort((a, b) => dag(b.begin ?? b.start).localeCompare(dag(a.begin ?? a.start)))[0] || null;
  },
  /* De waarde die het vaakst voorkomt (lege waarden tellen niet). */
  meeste(waarden) {
    const tel = new Map(); let beste = null;
    for (const w of waarden) { if (w == null || w === "") continue; const n = (tel.get(w) || 0) + 1; tel.set(w, n); if (beste == null || n > tel.get(beste)) beste = w; }
    return beste;
  },

  /* Boom opleiding › leerjaar › klas uit [{ naam, aantal, studie, leerjaar, mentor }]. Elke knoop heeft een id, het
   * aantal studenten en de namen van alle klassen eronder. */
  boom(klassen) {
    const nl = (a, b) => String(a).localeCompare(String(b), "nl", { numeric: true });
    const perStudie = new Map();
    for (const k of klassen) {
      const s = k.studie || this.ONBEKEND, j = k.leerjaar ?? 0;
      if (!perStudie.has(s)) perStudie.set(s, new Map());
      const jaren = perStudie.get(s); if (!jaren.has(j)) jaren.set(j, []);
      jaren.get(j).push(k);
    }
    const som = (lijst) => lijst.reduce((n, x) => n + (x.aantal || 0), 0);
    return [...perStudie.entries()].sort((a, b) => (a[0] === this.ONBEKEND) - (b[0] === this.ONBEKEND) || nl(a[0], b[0])).map(([studie, jaren]) => {
      const kinderen = [...jaren.entries()].sort((a, b) => (a[0] || 99) - (b[0] || 99)).map(([j, kl]) => {
        const bladen = kl.slice().sort((a, b) => nl(a.naam, b.naam)).map((k) => ({ id: `k:${k.naam}`, soort: "klas", studie, leerjaar: j || null, crebo: k.crebo || "", cohort: k.cohort ?? null, naam: k.naam, aantal: k.aantal || 0, mentor: k.mentor || "", klassen: [k.naam], kinderen: [] }));
        return { id: `o:${studie}|j:${j}`, soort: "leerjaar", studie, leerjaar: j || null, cohort: this.meeste(kl.map((k) => k.cohort)), naam: j ? `Leerjaar ${j}` : "Leerjaar onbekend", aantal: som(bladen), klassen: bladen.map((b) => b.naam), kinderen: bladen };
      });
      /* Staat de opleiding als code in Magister (MI) en beginnen alle klassen met een langere naam (MIP), dan
       * tonen we die naam. */
      const alle = kinderen.flatMap((x) => x.klassen), voor = this.voorvoegsel(alle);
      const naam = voor.length > studie.length && voor.toUpperCase().startsWith(studie.toUpperCase()) ? voor : studie;
      const crebo = [...new Set([...jaren.values()].flat().map((k) => k.crebo).filter(Boolean))].sort();
      return { id: `o:${studie}`, soort: "opleiding", studie, crebo: crebo.join(", "), naam, aantal: som(kinderen), klassen: kinderen.flatMap((x) => x.klassen), kinderen };
    });
  },
  /* De klassen (ook van vroeger) die bij een knoop horen, uit een kaart { klas: { studie, leerjaar } }. */
  klassenVan(knoop, kaart) {
    if (knoop.soort === "klas") return [knoop.naam];
    return Object.keys(kaart).filter((k) => (kaart[k].studie || this.ONBEKEND) === knoop.studie && (knoop.soort === "opleiding" || (kaart[k].leerjaar ?? null) === knoop.leerjaar));
  },
  /* Studenten per opleiding en cohort, uit per klas de telling per studiecode ({ "MI-25881-25": 18, … }).
   * Geeft { cohorten: [2024, 2025], rijen: [{ studie, per: { 2025: 18 }, totaal }] }; codes zonder cohort vallen weg. */
  cohorten(tellingenPerKlas) {
    const per = new Map(), jaren = new Set();
    for (const codes of tellingenPerKlas) for (const [ruw, n] of Object.entries(codes || {})) {
      const c = this.code(ruw); if (!c.cohort) continue;
      if (!per.has(c.opleiding)) per.set(c.opleiding, {});
      per.get(c.opleiding)[c.cohort] = (per.get(c.opleiding)[c.cohort] || 0) + n; jaren.add(c.cohort);
    }
    return { cohorten: [...jaren].sort(), rijen: [...per.entries()].sort((a, b) => a[0].localeCompare(b[0], "nl")).map(([studie, p]) => ({ studie, per: p, totaal: Object.values(p).reduce((a, b) => a + b, 0) })) };
  },
  /* Zegt of het verloop bruikbaar is: "leeg" (geen eerdere peildatum gaf klassen), "vlak" (elke eerdere peildatum
   * geeft precies de aantallen van vandaag: Magister negeert dan de datum) of "ok". */
  verloopStand(tellingen) {
    const eerder = tellingen.filter((t) => !t.vandaag && Object.values(t.klassen).some((n) => n)), nu = tellingen.find((t) => t.vandaag);
    if (!eerder.length) return "leeg";
    const zelfde = (a, b) => { const ka = Object.keys(a).filter((k) => a[k]), kb = Object.keys(b).filter((k) => b[k]); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };
    return nu && eerder.length >= 3 && eerder.every((t) => zelfde(t.klassen, nu.klassen)) ? "vlak" : "ok";
  },
  /* Alle knopen van een boom, plat. */
  plat(boom) { const uit = []; const loop = (n) => { uit.push(n); n.kinderen.forEach(loop); }; boom.forEach(loop); return uit; },

  /* Verloop van een groep klassen over de tellingen ([{ datum, klassen: { naam: aantal } }], oplopend). */
  reeks(klasNamen, tellingen) {
    return tellingen.map((t) => ({ datum: t.datum, n: klasNamen.reduce((n, k) => n + (t.klassen[k] || 0), 0) }));
  },
  /* Verschil tussen het laatste punt en het punt op of vlak voor `datum` (null als dat er niet is). */
  verschil(reeks, datum) {
    const eerder = reeks.filter((p) => p.datum <= datum).pop(), laatst = reeks[reeks.length - 1];
    return eerder && laatst && eerder !== laatst ? laatst.n - eerder.n : null;
  },

  /* ---------- aanwezigheid ---------- */
  leeg() { return { studenten: 0, zonder: 0, fout: 0, onder: 0, per: {}, weken: {}, dagen: {}, actief: {}, banden: [0, 0, 0, 0] }; },
  maandag(d) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return this.ymd(m); },
  /* Eén student erbij: zijn lessen ([{ begin: Date, cat }], uit vzStats) of null als het ophalen mislukte. */
  voegStudent(agg, lessen, norm = 80) {
    if (!lessen) { agg.fout++; return agg; }
    agg.studenten++;
    let telt = 0, aanwezig = 0;
    const plus = (o, k) => { o[k] = (o[k] || 0) + 1; }, weken = new Set();
    for (const l of lessen) {
      const w = this.maandag(l.begin);
      /* actief: per week het aantal studenten dat die week lessen had. */
      if (!weken.has(w)) { weken.add(w); plus((agg.actief ||= {}), w); }
      plus(agg.per, l.cat);
      plus((agg.weken[w] ||= {}), l.cat);
      plus((agg.dagen[l.begin.getDay()] ||= {}), l.cat);
      if (l.cat !== "VR") { telt++; if (l.cat === "OK" || l.cat === "TL") aanwezig++; }
    }
    if (!telt) { agg.zonder++; return agg; }
    const pct = 100 * aanwezig / telt;
    agg.banden[pct < 70 ? 0 : pct < 80 ? 1 : pct < 90 ? 2 : 3]++;
    if (pct < norm) agg.onder++;
    return agg;
  },
  /* ---------- studenten per week, uit de lessen ---------- */
  /* Per klas tellen we uit de roosters van de studenten per lesmoment (zelfde begin, vak en docent) hoeveel
   * studenten van de klas die les hadden, en per week hoeveel verschillende studenten les hadden. */
  lesLeeg() { return { momenten: {}, actief: {} }; },
  voegLessen(acc, lessen) {
    const weken = new Set();
    for (const l of lessen || []) {
      const k = `${l.begin.getTime()}|${l.vak || ""}|${l.docent || ""}`, w = this.maandag(l.begin);
      acc.momenten[k] = (acc.momenten[k] || 0) + 1;
      if (!weken.has(w)) { weken.add(w); acc.actief[w] = (acc.actief[w] || 0) + 1; }
    }
    return acc;
  },
  /* Per week (maandag): actief = studenten met minstens één les, lessen = aantal lesmomenten, grootste = de
   * drukst bezette les. */
  lesWeken(acc) {
    const uit = {};
    for (const [k, n] of Object.entries(acc.momenten)) {
      const w = this.maandag(new Date(+k.split("|")[0])), x = (uit[w] ||= { actief: acc.actief[w] || 0, lessen: 0, grootste: 0 });
      x.lessen++; if (n > x.grootste) x.grootste = n;
    }
    return uit;
  },
  /* Het studentenaantal per week van één klas: { maandag: aantal }. Weken met weinig lessen (minder dan 30% van
   * een gewone week: vakantie, toetsweek, stage) zeggen niets over het aantal studenten en vallen weg. */
  lesPunten(weken) {
    const ks = Object.keys(weken || {}).sort(); if (!ks.length) return {};
    const aantallen = ks.map((k) => weken[k].lessen).sort((a, b) => a - b), drempel = Math.max(1, 0.3 * aantallen[Math.floor(aantallen.length / 2)]);
    const uit = {};
    for (const k of ks) if (weken[k].lessen >= drempel) uit[k] = weken[k].actief;
    return uit;
  },
  /* Klassen bij elkaar opgeteld, per week. Heeft een klas voor een week geen punt, dan telt zijn laatste eerdere
   * punt (of, vóór zijn eerste week, zijn eerste): een klas op stage is niet leeg. weken: de weken om te tonen
   * (standaard alle weken waarvoor een klas een punt heeft). */
  lesReeks(perKlas, weken = null) {
    const lijst = perKlas.filter((p) => p && Object.keys(p).length).map((p) => ({ p, ks: Object.keys(p).sort() }));
    const alle = weken || [...new Set(lijst.flatMap((x) => x.ks))].sort();
    return alle.map((w) => ({ datum: w, n: lijst.reduce((s, x) => s + x.p[x.ks.filter((k) => k <= w).pop() ?? x.ks[0]], 0) }));
  },

  /* ---------- jaaropslag per klas ---------- */
  /* Eén bewaarde opslag per klas voor het hele schooljaar, die per week wordt bijgewerkt:
   *   { sj, op, tot, studenten: { id: { naam, nu, w: { maandag: [aantal per categorie, in de volgorde van CATS] } } },
   *     mom: { maandag: { lessen, grootste } }, dagen: { maandag: { weekdag: [aantal per categorie] } } }
   * nu: staat de student vandaag nog in de klas. Daaruit volgt alles: aanwezigheid over elke periode van hele
   * weken, studenten per week, en wie er in- of uitstroomde. */
  catIndex(cat) { const i = this.CATS.findIndex((c) => c[0] === cat); return i < 0 ? 0 : i; },
  /* De lessen van één student (uit vzStats) per week. */
  studentWeken(lessen) {
    const w = {};
    for (const l of lessen || []) (w[this.maandag(l.begin)] ||= [0, 0, 0, 0, 0, 0, 0])[this.catIndex(l.cat)]++;
    return w;
  },
  /* Lesmomenten en weekdagen van een klas uit de lessen van al zijn studenten ([[les, …], …]), vanaf een week. */
  klasWeken(lessenPerStudent, vanaf = "") {
    const tel = {}, mom = {}, dagen = {};
    for (const lessen of lessenPerStudent) for (const l of lessen || []) {
      const w = this.maandag(l.begin); if (w < vanaf) continue;
      const k = `${l.begin.getTime()}|${l.vak || ""}|${l.docent || ""}`;
      tel[k] = (tel[k] || 0) + 1;
      ((dagen[w] ||= {})[l.begin.getDay()] ||= [0, 0, 0, 0, 0, 0, 0])[this.catIndex(l.cat)]++;
    }
    for (const [k, n] of Object.entries(tel)) { const x = (mom[this.maandag(new Date(+k.split("|")[0]))] ||= { lessen: 0, grootste: 0 }); x.lessen++; if (n > x.grootste) x.grootste = n; }
    return { mom, dagen };
  },
  /* Nieuwe gegevens in de opslag van een klas zetten. nieuw: { studenten: { id: { naam, nu, w, vanaf } }, mom, dagen };
   * per student vervangen de nieuwe weken alles vanaf zijn `vanaf` (de week vanaf waar hij opnieuw is opgehaald),
   * voor de klas alles vanaf `vanaf`. Wie niet in nieuw staat, blijft bewaard met nu: false (uit de klas). */
  voegSamen(oud, nieuw, vanaf) {
    const uit = { studenten: {}, mom: {}, dagen: {} };
    for (const soort of ["mom", "dagen"]) {
      for (const [w, v] of Object.entries(oud?.[soort] || {})) if (w < vanaf) uit[soort][w] = v;
      Object.assign(uit[soort], nieuw[soort] || {});
    }
    /* b: begindatum van de aanmelding; naar: de klas waar de student nu staat (overstap). */
    const extra = (naar, ...van) => { for (const k of ["b", "naar"]) { const v = van.map((x) => x?.[k]).find((x) => x != null && x !== ""); if (v) naar[k] = v; } return naar; };
    for (const [id, st] of Object.entries(oud?.studenten || {})) uit.studenten[id] = extra({ naam: st.naam, nu: false, w: { ...st.w } }, st);
    for (const [id, st] of Object.entries(nieuw.studenten || {})) {
      const w = {}, grens = st.vanaf ?? vanaf, was = uit.studenten[id];
      for (const [wk, v] of Object.entries(was?.w || {})) if (wk < grens) w[wk] = v;
      uit.studenten[id] = extra({ naam: st.naam || was?.naam || "", nu: st.nu !== false, w: st.w ? Object.assign(w, st.w) : (was?.w || {}) }, st, st.nu !== false ? { b: was?.b } : was);
    }
    return uit;
  },
  /* De aanwezigheid van een klas over de weken van..tot (maandagen, inclusief), als optelling zoals leeg(). Alleen
   * de studenten die nu in de klas zitten. */
  aggUit(opslag, van, tot, norm = 80) {
    const agg = this.leeg(), plus = (naar, rij) => { rij.forEach((n, i) => { if (n) naar[this.CATS[i][0]] = (naar[this.CATS[i][0]] || 0) + n; }); };
    for (const st of Object.values(opslag?.studenten || {})) {
      if (!st.nu) continue;
      agg.studenten++;
      let telt = 0, aanwezig = 0;
      for (const [w, rij] of Object.entries(st.w || {})) {
        if (w < van || w > tot) continue;
        plus(agg.per, rij); plus((agg.weken[w] ||= {}), rij);
        if (rij.some((n) => n)) agg.actief[w] = (agg.actief[w] || 0) + 1;
        telt += rij[0] + rij[1] + rij[2] + rij[3] + rij[4] + rij[5]; aanwezig += rij[0] + rij[1];
      }
      if (!telt) { agg.zonder++; continue; }
      const pct = 100 * aanwezig / telt;
      agg.banden[pct < 70 ? 0 : pct < 80 ? 1 : pct < 90 ? 2 : 3]++;
      if (pct < norm) agg.onder++;
    }
    for (const [w, perDag] of Object.entries(opslag?.dagen || {})) if (w >= van && w <= tot) for (const [dag, rij] of Object.entries(perDag)) plus((agg.dagen[dag] ||= {}), rij);
    return agg;
  },
  /* Per week: actief = studenten (ook wie inmiddels weg is) met minstens één les, plus de lesmomenten van de klas. */
  lesWekenUit(opslag) {
    const uit = {};
    for (const [w, m] of Object.entries(opslag?.mom || {})) uit[w] = { actief: 0, lessen: m.lessen, grootste: m.grootste };
    for (const st of Object.values(opslag?.studenten || {})) for (const [w, rij] of Object.entries(st.w || {})) if (rij.some((n) => n) && uit[w]) uit[w].actief++;
    return uit;
  },
  /* ---------- deelnemers per les ---------- */
  /* Welke lessen vragen we op om te zien wie er toen in de klas zat? Per week de lessen die de meeste studenten
   * van de klas hadden, liefst op verschillende dagen. lessenPerStudent: [[{ id, begin }, …], …]. */
  lesKeuze(lessenPerStudent, vanaf = "", perWeek = 3) {
    const tel = new Map();
    for (const lessen of lessenPerStudent) for (const l of lessen || []) {
      if (l.id == null) continue;
      const week = this.maandag(l.begin); if (week < vanaf) continue;
      const x = tel.get(String(l.id)) || { id: String(l.id), week, dag: l.begin.getDay(), n: 0 };
      x.n++; tel.set(x.id, x);
    }
    const perWk = {}, uit = [];
    for (const x of tel.values()) (perWk[x.week] ||= []).push(x);
    for (const week of Object.keys(perWk).sort()) {
      const lijst = perWk[week].sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)), dagen = new Set(), kies = [];
      for (const x of lijst) if (kies.length < perWeek && !dagen.has(x.dag)) { dagen.add(x.dag); kies.push(x); }
      for (const x of lijst) if (kies.length < perWeek && !kies.includes(x)) kies.push(x);
      uit.push(...kies.map(({ id, n }) => ({ id, week, n })));
    }
    return uit;
  },
  /* Wie zat er in de lessen van de klas zonder er nu in te staan? lessen: [{ week, n, ids }] (n: zoveel studenten
   * van de klas hadden de les in hun rooster; ids: de deelnemers volgens Magister). eigen: de studenten van de klas
   * nu; klasVan: id → klas voor alle studenten van nu; grootte: klas → aantal.
   *  - Een les waar minder dan de helft van de eigen studenten in staat, slaan we over (niet te vertrouwen).
   *  - Staat een flink deel van een andere klas erbij (30%, minstens 3), dan is het een gezamenlijke les en zijn
   *    dat gasten. Een enkeling uit een andere klas zat toen in deze klas: een overstapper (naar: de klas van nu).
   *  - Wie nu nergens meer staat, is weg van school; die rekenen we tot deze klas als deze klas de grootste groep
   *    in de les is.
   * Geeft { id: { weken: [maandag, …], n: aantal lessen, naar: klas of null } }. */
  gasten(lessen, eigen, klasVan, grootte, klas) {
    const uit = {};
    for (const les of lessen || []) {
      const ids = [...new Set(les.ids || [])], eigenN = ids.filter((i) => eigen.has(i)).length;
      if (!eigenN || eigenN < 0.5 * (les.n || 1)) continue;
      const per = {};
      for (const i of ids) { const k = klasVan.get(i); if (k && k !== klas && !eigen.has(i)) per[k] = (per[k] || 0) + 1; }
      const samen = new Set(Object.keys(per).filter((k) => per[k] >= Math.max(3, 0.3 * (grootte[k] || 0))));
      const grootste = eigenN >= Math.max(0, ...Object.values(per));
      for (const i of ids) {
        if (eigen.has(i)) continue;
        const k = klasVan.get(i);
        if (k ? samen.has(k) : !grootste) continue;
        const x = (uit[i] ||= { weken: [], n: 0, naar: k || null });
        x.n++; if (!x.weken.includes(les.week)) x.weken.push(les.week);
      }
    }
    for (const x of Object.values(uit)) x.weken.sort();
    return uit;
  },
  /* Mutaties: wie later begon dan de klas ("in": uit de eerste les, of anders uit de begindatum van de aanmelding),
   * wie uit de klas is ("uit", met de week van de laatste les; naar: de klas van nu bij een overstap) en wie nog
   * in de klas staat maar de laatste twee gewone lesweken geen lessen had ("stil"). De klas begint in de eerste
   * week waarin minstens de helft van de studenten les had. Gewone lesweken: de weken die lesPunten laat staan.
   * Nieuwste eerst. */
  mutaties(opslag) {
    const weken = this.lesWekenUit(opslag), gewoon = Object.keys(this.lesPunten(weken)).sort(), uit = [];
    const alle = Object.keys(weken).sort(); if (!alle.length) return uit;
    const top = Math.max(...alle.map((w) => weken[w].actief)), eerste = alle.find((w) => weken[w].actief >= 0.5 * top) || alle[0];
    const set = new Set(gewoon), voorlaatste = gewoon.length > 1 ? gewoon[gewoon.length - 2] : null;
    for (const [id, st] of Object.entries(opslag?.studenten || {})) {
      const wk = Object.keys(st.w || {}).filter((w) => st.w[w].some((n) => n)).sort(), basis = { id, naam: st.naam };
      const begin = st.b && this.maandag(this.datum(st.b)) > eerste ? st.b : null;
      if (wk.length && wk[0] > eerste) uit.push({ ...basis, soort: "in", week: wk[0], bron: "les", ...(begin ? { datum: begin } : {}) });
      else if (begin && st.nu) uit.push({ ...basis, soort: "in", week: this.maandag(this.datum(begin)), bron: "aanmelding", datum: begin });
      if (!st.nu) uit.push({ ...basis, soort: "uit", week: wk[wk.length - 1] || null, ...(st.naar ? { naar: st.naar } : {}) });
      else if (voorlaatste && wk.length && (wk.filter((w) => set.has(w)).pop() || "") < voorlaatste) uit.push({ ...basis, soort: "stil", week: wk[wk.length - 1] });
    }
    return uit.sort((a, b) => String(b.week || "").localeCompare(String(a.week || "")) || a.naam.localeCompare(b.naam, "nl"));
  },
  /* Twee back-ups of opslagen samenvoegen: per klas wint de laatst bijgewerkte (op). */
  nieuwste(a, b) {
    const uit = { ...(a || {}) };
    for (const [k, v] of Object.entries(b || {})) if (!uit[k] || (v?.op || 0) > (uit[k]?.op || 0)) uit[k] = v;
    return uit;
  },

  /* Optellingen bij elkaar (lege of ontbrekende worden overgeslagen); null als er geen enkele is. */
  som(aggs) {
    const lijst = aggs.filter(Boolean); if (!lijst.length) return null;
    const uit = this.leeg(), tel = (naar, van) => { for (const [k, v] of Object.entries(van || {})) naar[k] = (naar[k] || 0) + v; };
    for (const a of lijst) {
      for (const k of ["studenten", "zonder", "fout", "onder"]) uit[k] += a[k] || 0;
      tel(uit.per, a.per); tel(uit.actief, a.actief);
      for (const [w, p] of Object.entries(a.weken || {})) tel((uit.weken[w] ||= {}), p);
      for (const [d, p] of Object.entries(a.dagen || {})) tel((uit.dagen[d] ||= {}), p);
      (a.banden || []).forEach((n, i) => { uit.banden[i] += n || 0; });
    }
    return uit;
  },
  /* Cijfers uit een telling per categorie: lessen, telt (zonder vrijstelling), aanwezig (met te laat) en per
   * categorie het aantal en het aandeel. Vrijstelling is een aandeel van alle lessen, de rest van de lessen die
   * meetellen (zoals Inzicht). pct is null zonder lessen. */
  cijfers(per) {
    const n = (k) => (per && per[k]) || 0;
    const lessen = this.CATS.reduce((s, [k]) => s + n(k), 0), telt = lessen - n("VR"), aanwezig = n("OK") + n("TL");
    const uit = { lessen, telt, aanwezig, afwezig: telt - aanwezig, pct: telt ? Math.round(1000 * aanwezig / telt) / 10 : null, cat: {} };
    for (const [k] of this.CATS) uit.cat[k] = { n: n(k), pct: k === "VR" ? (lessen ? Math.round(1000 * n(k) / lessen) / 10 : null) : (telt ? Math.round(1000 * n(k) / telt) / 10 : null) };
    return uit;
  },
};
