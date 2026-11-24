/* Opleidingen: de jaaropslag (aanwezigheid en lessen per klas), het automatisch bijwerken en de back-up in een map.
 * Deel van de module in opleidingen.js: voegt methoden toe.
 *
 * Per klas staat er één opslag voor het hele schooljaar (zie OplReken.voegSamen): per student per week de lessen
 * per categorie, en per week de lesmomenten van de klas. Die blijft bewaard in de extensie (chrome.storage.local)
 * en wordt bij het openen van de pagina één keer per dag bijgewerkt: alleen de laatste weken worden opnieuw
 * opgehaald (twee weken terug vanaf de vorige keer, omdat registraties achteraf nog wijzigen), de rest blijft staan.
 * De eerste keer wordt het hele schooljaar opgehaald; tot dat klaar is toont de pagina wat er nog in de eerdere
 * cache stond.
 *
 * Back-up: kies een map (op de computer of in OneDrive); na elke update schrijft de pagina daar één bestand met de
 * jaaropslag, de vastgelegde dagstanden en het verloop. Bij het openen wordt het bestand gelezen en per klas wint
 * de laatst bijgewerkte versie, zodat een andere computer met dezelfde map verder kan waar deze ophield.
 * Let op: de jaaropslag en de back-up bevatten namen van studenten met hun lessen per week. */
Object.assign(DT.module("opleidingen"), {
  /* ---------- welke opleidingen doen mee ---------- */
  /* Wie veel klassen mag zien, vraagt bij het laden veel van Magister (per student drie aanvragen, per klas tientallen
   * lessen). Daarom kun je vooraf kiezen welke opleidingen meedoen: alleen die worden opgehaald en getoond. De keuze
   * gaat op het begin van de klasnaam (MIP1A → MIP); dat is bekend na één aanvraag. Bij meer dan DREMPEL klassen
   * vraagt de pagina het vóór er iets wordt opgehaald. Een opleiding kan in haar geheel meedoen, of alleen een
   * paar klassen ervan. _kies: de opleidingen die geheel meedoen, of null voor alles; _kiesKl: de losse klassen. */
  DREMPEL: 30,
  async keuzeLaden(telling) {
    const k = await this.opslag("keuze"), alle = OplReken.groepen(telling), bestaat = new Set(alle.map((g) => g.groep));
    const gekozen = Array.isArray(k.groepen) ? k.groepen.filter((g) => bestaat.has(g)) : [];
    const los = Array.isArray(k.klassen) ? k.klassen.filter((x) => x in telling && !gekozen.includes(OplReken.groep(x))) : [];
    this._groepen = alle;
    this._kies = los.length || (gekozen.length && gekozen.length < alle.length) ? new Set(gekozen) : null;
    this._kiesKl = new Set(los);
    return !k.gezien && Object.keys(telling).length > this.DREMPEL;   // true: eerst kiezen
  },
  kiesFilter(telling) {
    if (!this._kies) return { ...telling };
    return Object.fromEntries(Object.entries(telling).filter(([k]) => this._kies.has(OplReken.groep(k)) || this._kiesKl?.has(k)));
  },
  keuzeTekst() {
    const heel = [...this._kies].sort(), los = [...(this._kiesKl || [])].sort(), delen = [];
    if (heel.length) delen.push(`${heel.length} van de ${this._groepen.length} opleidingen (${heel.join(", ")})`);
    if (los.length) delen.push(`${los.length} losse ${los.length === 1 ? "klas" : "klassen"} (${los.join(", ")})`);
    return `Je ziet ${delen.join(" en ")}.`;
  },
  /* Na elke wijziging: het vakje van de opleiding volgt haar klassen (aan, uit of deels), en de optelling eronder. */
  keuzeTotaal() {
    const el = this._pagina.querySelector(".dt-opl-kiestotaal"); if (!el) return;
    let n = 0, kl = 0;
    for (const g of this._pagina.querySelectorAll("input[data-groep]")) {
      const vakjes = [...g.closest("details").querySelectorAll("input[data-klas]")], aan = vakjes.filter((x) => x.checked);
      g.checked = aan.length === vakjes.length; g.indeterminate = aan.length > 0 && aan.length < vakjes.length;
      g.closest("summary").querySelector("small").textContent = g.indeterminate ? `${aan.length} van ${vakjes.length} klassen` : `${vakjes.length} ${vakjes.length === 1 ? "klas" : "klassen"} · ${this.getal(+g.dataset.n || 0)}`;
      kl += aan.length; n += aan.reduce((s, x) => s + (+x.dataset.n || 0), 0);
    }
    el.textContent = kl ? `${this.getal(kl)} ${kl === 1 ? "klas" : "klassen"} gekozen, ${this.getal(n)} studenten. De eerste keer zijn dat ongeveer ${this.getal(3 * n + 30 * kl)} aanvragen aan Magister; daarna per dag ongeveer ${this.getal(2 * n + 6 * kl)}.` : "Kies minstens één opleiding of klas.";
  },
  async keuzeBewaar(DT) {
    const aan = new Set([...this._pagina.querySelectorAll("input[data-klas]:checked")].map((x) => x.dataset.klas));
    if (!aan.size) return DT.toast("Kies minstens één opleiding of klas.", "err", 3500);
    if (this._aanwBezig) { this._stopAanw = true; while (this._aanwBezig) await this.wacht(150); }
    await this.bewaar("keuze", { gezien: true, ...OplReken.keuze(this._groepen, aan) });
    this._autoUit = false; this._tab = "overzicht"; this._zoom = null; this.route();
    this.laad(DT);
  },
  /* eerst: de pagina heeft nog niets opgehaald en wacht op de keuze. */
  keuzeKaart(eerst = false) {
    const E = (s) => this.esc(s), alle = this._groepen || [];
    if (!eerst && alle.reduce((n, g) => n + g.klassen, 0) < 2) return "";
    const aan = (g, l) => !eerst && (!this._kies || this._kies.has(g.groep) || !!this._kiesKl?.has(l.naam));
    const groep = (g) => {
      const n = g.leden.filter((l) => aan(g, l)).length;
      return `<details class="dt-opl-kiesgroep"${(n && n < g.leden.length) || alle.length === 1 ? " open" : ""}><summary><label><input type="checkbox" data-groep="${E(g.groep)}" data-n="${g.studenten}"${n === g.leden.length ? " checked" : ""}><b>${E(g.groep)}</b></label><small></small></summary>
        <div>${g.leden.map((l) => `<label><input type="checkbox" data-klas="${E(l.naam)}" data-n="${l.aantal || 0}"${aan(g, l) ? " checked" : ""}>${E(l.naam)}${l.aantal ? `<small>${l.aantal}</small>` : ""}</label>`).join("")}</div></details>`;
    };
    return `<dna-card class="dt-opl-kaart"><h2>${eerst ? "Kies eerst welke opleidingen je wilt zien" : "Welke opleidingen doen mee"}</h2>
      <p class="dt-opl-zacht">${eerst ? `Je mag ${alle.reduce((n, g) => n + g.klassen, 0)} klassen zien. Alles ophalen vraagt veel van Magister, dus er is nog niets opgehaald. ` : ""}Vink een hele opleiding aan, of klap haar open om losse klassen te kiezen. Alleen wat je kiest wordt opgehaald, bijgewerkt en getoond. De indeling gaat op het begin van de klasnaam. Wat al is opgehaald blijft bewaard als je iets uitzet.</p>
      <div class="dt-opl-kies">${alle.map(groep).join("")}</div>
      <p class="dt-opl-zacht dt-opl-kiestotaal"></p>
      <p><button type="button" class="dt-opl-knop" data-act="keuze-ok">${eerst ? "Ophalen" : "Keuze opslaan en opnieuw laden"}</button><button type="button" class="dt-opl-knop is-stil" data-act="keuze-alles">Alles aan</button><button type="button" class="dt-opl-knop is-stil" data-act="keuze-niets">Alles uit</button></p></dna-card>`;
  },

  /* ---------- uit de opslag naar de pagina ---------- */
  async gegevensLaden() {
    const d = this._d; if (!d) return;
    const jaar = await this.opslag("jaar"), oudA = await this.opslag("aanw"), oudL = await this.opslag("les");
    d.jaar = {}; d.oud = { aanw: {}, les: {} };
    for (const k of Object.keys(d.nu)) {
      if (jaar[k]?.sj === d.sj) d.jaar[k] = jaar[k];
      if (d.jaar[k]) continue;
      /* Nog geen jaaropslag: wat de vorige versie bewaarde (de laatst opgehaalde aanwezigheid en de lesweken). */
      const laatst = Object.entries(oudA).filter(([s, v]) => s.startsWith(`${k}|`) && v?.agg).sort((a, b) => (b[1].op || 0) - (a[1].op || 0))[0];
      if (laatst) d.oud.aanw[k] = laatst[1].agg;
      if (oudL[k]?.sj === d.sj) d.oud.les[k] = oudL[k];
    }
    this.herbereken();
  },
  /* Uit de jaaropslag: de aanwezigheid over de gekozen periode (hele weken), de studenten per week en de mutaties. */
  herbereken() {
    const d = this._d, R = OplReken; if (!d) return;
    const per = this.periode(), van = R.maandag(per.van), tot = R.maandag(per.tot);
    d.aanw = {}; d.les = {}; d.mut = {};
    for (const k of Object.keys(d.nu)) {
      const o = d.jaar[k];
      if (o) {
        const st = Object.values(o.studenten || {});
        d.aanw[k] = R.aggUit(o, van, tot);
        d.les[k] = { op: o.op, weken: R.lesWekenUit(o), studenten: st.length, weg: st.filter((s) => !s.nu).length };
        d.mut[k] = R.mutaties(o);
      } else {
        if (d.oud.aanw[k]) d.aanw[k] = d.oud.aanw[k];
        if (d.oud.les[k]) d.les[k] = d.oud.les[k];
      }
    }
    /* Wie van school is en in de lessen van meer dan één klas voorkwam, telt bij de klas waar hij het langst zat. */
    const beste = {};
    for (const [k, o] of Object.entries(d.jaar)) for (const [id, st] of Object.entries(o.studenten || {})) {
      if (st.nu || st.naar) continue;
      const n = Object.keys(st.w || {}).length;
      if (!beste[id] || n > beste[id].n) beste[id] = { k, n };
    }
    for (const k of Object.keys(d.mut)) d.mut[k] = d.mut[k].filter((m) => m.soort !== "uit" || m.naar || !beste[m.id] || beste[m.id].k === k);
  },

  /* ---------- bijwerken ---------- */
  /* VERSIE 2: met de deelnemers per les en de begindatum van de aanmelding. Een opslag van vóór die versie blijft
   * zichtbaar, maar wordt bij de eerstvolgende update helemaal opnieuw opgehaald. */
  VERSIE: 2,
  verouderd(o) { return !o || o.v !== this.VERSIE || OplReken.ymd(new Date(o.op)) !== OplReken.ymd(new Date()); },
  /* Bij het openen: klassen die vandaag nog niet zijn bijgewerkt. Na Stoppen niet opnieuw tot de pagina weer opent. */
  autoBijwerken(DT) {
    const d = this._d; if (!d || this._autoUit || this._aanwBezig) return;
    const werk = Object.keys(d.nu).filter((k) => this.verouderd(d.jaar[k]));
    if (werk.length) this.bijwerken(DT, werk, { auto: true });
    else if (!this._namenGedaan) this.namenAanvullen(DT).then((n) => { if (n) { this.herbereken(); this.teken(DT); this.backupSchrijven(); } });
  },
  async bijwerken(DT, klasNamen, { vol = false, auto = false } = {}) {
    const R = OplReken, d = this._d;
    if (!d || this._aanwBezig) return;
    if (typeof vzStats !== "function") { if (!auto) DT.toast("Zet de module Inzicht verzuim aan: die leest de lessen en registraties.", "err", 6000); return; }
    const werk = klasNamen.filter((k) => vol || this.verouderd(d.jaar[k]));
    if (!werk.length) { if (!auto) DT.toast("Deze klassen zijn vandaag al bijgewerkt.", "info", 3500); return; }
    const sjVan = R.sjStart(), nu = new Date(), pagina = this._pagina, door = () => !this._stopAanw && this._pagina === pagina;
    const naam = (x) => [x.roepnaam || x.voorletters, x.tussenvoegsel, x.achternaam].filter(Boolean).join(" ");
    const zoek = async (klas, peil) => DT.lijst(await this.api(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam`));
    const totaal = Math.max(1, werk.reduce((n, k) => n + (d.nu[k] || 0), 0)); let klaar = 0, fouten = 0;
    this._aanwBezig = true; this._stopAanw = false; this.teken(DT);
    const opslag = await this.opslag("jaar");
    try {
      /* Alle studenten van nu, per klas: om in de lessen te zien wie er niet (meer) bij hoort. */
      this.status("Klassen ophalen…", false, 0, true);
      const leden = {}, klasVan = new Map(), naamVan = new Map();
      for (const k of Object.keys(d.nu)) {
        if (!door()) break;
        leden[k] = await zoek(k, d.vandaag);
        for (const l of leden[k] || []) { klasVan.set(String(l.id), k); naamVan.set(String(l.id), naam(l)); }
      }
      for (const klas of werk) {
        if (!door()) break;
        const oud = !vol && opslag[klas]?.sj === d.sj && opslag[klas].v === this.VERSIE ? opslag[klas] : null;
        const wat = oud ? "Bijwerken" : "Schooljaar ophalen";
        this.status(`${wat}: klas ${klas}…`, false, klaar / totaal, true);
        const lln = leden[klas];
        if (!lln) { fouten++; continue; }
        const ids = new Map(lln.map((l) => [String(l.id), { naam: naam(l), nu: true }]));
        const vanaf = oud ? R.maandag(new Date(R.datum(oud.tot).getTime() - 14 * 864e5)) : "";
        const nieuw = { studenten: {} }, alleLessen = [];
        await this.parallel([...ids.keys()], async (id) => {
          if (!door()) return;
          const info = ids.get(id), bekend = !!oud?.studenten?.[id], begin = bekend ? R.datum(vanaf) : sjVan;   // een nieuwe student: het hele schooljaar
          const { regs, rooster } = await vzBron.haal(id, begin, nu, { api: (u) => this.api(u), pauze: 120, los: 0, vers: true });
          if (regs && rooster) {
            const lessen = vzStats(regs, rooster, begin, nu).lessen;
            alleLessen.push(lessen);
            nieuw.studenten[id] = { naam: info.naam, nu: info.nu, w: R.studentWeken(lessen), vanaf: bekend ? vanaf : "" };
          } else { fouten++; nieuw.studenten[id] = { naam: info.naam, nu: info.nu }; }   // mislukt: wat er stond blijft staan
          /* De begindatum van de aanmelding: één keer per student. */
          if (!oud?.studenten?.[id]?.b && door()) {
            const am = R.aanmeldingOp(DT.lijst(await this.api(`/api/leerlingen/${id}/aanmeldingen`)), d.vandaag), b = String(am?.begin ?? am?.start ?? "").slice(0, 10); await this.wacht(120);
            if (b) nieuw.studenten[id].b = b;
          }
          if (door()) this.status(`${wat}: klas ${klas}, student ${++klaar} van ongeveer ${totaal}…`, false, klaar / totaal, true);
        });
        if (!door()) break;   // een halve klas bewaren we niet
        /* Wie zat er in de lessen zonder nu in de klas te staan? Per week een paar lessen: Magister geeft per les
         * de deelnemers van toen. */
        const keuze = R.lesKeuze(alleLessen, vanaf), gezien = []; let lesKlaar = 0;
        await this.parallel(keuze, async (les) => {
          if (!door()) return;
          const rijen = DT.lijst(await this.api(`/api/medewerkers/afspraken/${les.id}/verantwoordingen`)); await this.wacht(120);
          if (rijen) gezien.push({ week: les.week, n: les.n, ids: rijen.map((x) => String(x.persoonId ?? "")).filter(Boolean) }); else fouten++;
          if (door()) this.status(`${wat}: klas ${klas}, deelnemers van les ${++lesKlaar} van ${keuze.length}…`, false, klaar / totaal, true);
        });
        if (!door()) break;
        const gast = R.gasten(gezien, new Set(ids.keys()), klasVan, d.nu, klas);
        /* Wie eerder in deze klas stond en nu in een andere: een overstap. */
        for (const [id, st] of Object.entries(oud?.studenten || {})) if (!ids.has(id) && klasVan.has(id) && (st.nu || st.naar)) nieuw.studenten[id] = { naam: st.naam, nu: false, naar: klasVan.get(id) };
        for (const [id, g] of Object.entries(gast)) {
          let wie = naamVan.get(id) || oud?.studenten?.[id]?.naam || "";
          if (!wie) {   // weg van school: de naam staat nog bij de student zelf, als we die mogen zien
            const p = await DT.api(`/api/leerlingen/${id}`, { full: true, timeout: 15000 }); await this.wacht(120);
            if (p.status === 200 && p.json) wie = naam(p.json);
            else if (g.n < 2) continue;   // één keer gezien en geen student te vinden: geen bewijs
          }
          nieuw.studenten[id] = { naam: wie || oud?.studenten?.[id]?.naam || "", nu: false, w: Object.fromEntries(g.weken.map((w) => [w, [1, 0, 0, 0, 0, 0, 0]])), vanaf, ...(g.naar ? { naar: g.naar } : {}) };
        }
        Object.assign(nieuw, R.klasWeken(alleLessen, vanaf));
        opslag[klas] = d.jaar[klas] = { sj: d.sj, v: this.VERSIE, op: Date.now(), tot: d.vandaag, ...R.voegSamen(oud, nieuw, vanaf) };
        await this.bewaar("jaar", opslag);
        this.herbereken(); this.teken(DT);
      }
      if (door() && await this.namenAanvullen(DT, opslag)) { this.herbereken(); this.teken(DT); }
    } finally {
      this._aanwBezig = false;
      if (this._stopAanw) this._autoUit = true;
      await this.backupSchrijven();
      if (this._pagina === pagina) { this.status(fouten ? `Bijgewerkt, maar ${fouten} aanvra${fouten === 1 ? "ag" : "gen"} mislukte${fouten === 1 ? "" : "n"}; die gegevens zijn niet vernieuwd.` : "", !!fouten); this.teken(DT); }
    }
  },

  /* ---------- namen van vertrekkers ---------- */
  /* Wie van school is, geeft Magister niet meer als student terug; de naam staat nog wel in de deelnemerslijst van
   * een les van toen (/api/medewerkers/{eigen nummer}/afspraken/{les}/deelnemers). Per klas met naamloze
   * vertrekkers: het rooster van één huidige student in de laatste week van de vertrekker, en van een paar lessen
   * daaruit de deelnemers. Geeft het aantal gevonden namen. */
  zonderNaam(st) { return !st.nu && (!st.naam || st.naam === "Onbekende student"); },
  persoonNaam(x) { return [x.roepnaam || x.voorletters, x.tussenvoegsel, x.achternaam].filter(Boolean).join(" "); },
  async namenAanvullen(DT, opslag = null) {
    const R = OplReken, d = this._d; if (!d) return 0;
    this._namenGedaan = true;
    opslag ||= await this.opslag("jaar");
    const klassen = Object.keys(d.nu).filter((k) => opslag[k]?.sj === d.sj && Object.values(opslag[k].studenten || {}).some((st) => this.zonderNaam(st)));
    if (!klassen.length) return 0;
    const acc = await DT.api("/api/account", { full: true, timeout: 10000 }), mid = acc.json?.Persoon?.Id ?? acc.json?.persoon?.id ?? null;
    this._namenFout = mid == null ? "eigen medewerkernummer niet gevonden" : null;
    if (mid == null) return 0;
    const pagina = this._pagina, door = () => !this._stopAanw && this._pagina === pagina;
    let gevonden = 0, laatsteStatus = null;
    for (const klas of klassen) {
      const o = opslag[klas], open = new Map(Object.entries(o.studenten).filter(([, st]) => this.zonderNaam(st)));
      const vast = Object.keys(o.studenten).find((id) => o.studenten[id].nu); if (!vast) continue;
      const weken = [...new Set([...open.values()].flatMap((st) => Object.keys(st.w || {}).sort().slice(-1)))].sort();
      for (const week of weken) {
        if (!door() || !open.size) break;
        this.status(`Namen van vertrekkers zoeken: klas ${klas}…`, false, null, true);
        const ma = R.datum(week), zo = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 6);
        const rooster = DT.lijst(await this.api(`/api/leerlingen/${vast}/afspraken?status=actief&begin=${R.ymd(ma)}&einde=${R.ymd(zo)}`)) || []; await this.wacht(120);
        for (const les of rooster.filter((a) => a.id != null && a.onderwijstijd != null).slice(0, 6)) {
          if (!door() || ![...open.values()].some((st) => st.w?.[week])) break;
          const r = await this.api(`/api/medewerkers/${mid}/afspraken/${les.id}/deelnemers?type=leerling`); await this.wacht(120);
          laatsteStatus = r.status;
          for (const x of DT.lijst(r) || []) {
            const id = String(x.id ?? x.persoonId ?? ""), st = open.get(id), wie = this.persoonNaam(x);
            if (st && wie) { st.naam = wie; open.delete(id); gevonden++; }
          }
        }
      }
      if (d.jaar[klas]) d.jaar[klas] = o;
    }
    const over = klassen.reduce((n, k) => n + Object.values(opslag[k].studenten).filter((st) => this.zonderNaam(st)).length, 0);
    this._namenFout = over ? `${over} zonder naam${laatsteStatus && laatsteStatus !== 200 ? ` (Magister antwoordde ${laatsteStatus} op de deelnemers van een les)` : ""}` : null;
    if (gevonden) await this.bewaar("jaar", opslag);
    if (this._pagina === pagina && !this._aanwBezig) this.status("");
    return gevonden;
  },

  /* ---------- diagnose van de mutaties ---------- */
  /* Welke bron in Magister kent de in- en uitstroom van dit schooljaar? Probeert voor de grootste klas: de klas op
   * elke maandag (peildatum), de begin- en einddatum van de aanmeldingen, de eerste lesweek per student uit de
   * opslag, en de deelnemers van één les uit de eerste weken. Alleen aantallen, datums, veldnamen en statuscodes,
   * geen namen of nummers. Gaat naar het klembord. */
  async diagnoseMutaties(DT) {
    const R = OplReken, d = this._d; if (!d) return;
    const vorm = (v) => JSON.stringify(v ?? null), kort = (u, o = {}) => DT.api(u, { full: true, timeout: 20000, ...o });
    const tel = (lijst) => { const t = {}; for (const x of lijst) t[x] = (t[x] || 0) + 1; return Object.keys(t).sort().map((k) => `${k}: ${t[k]}`).join(", ") || "geen"; };
    const klas = Object.keys(d.nu).sort((a, b) => d.nu[b] - d.nu[a])[0], sjVan = R.sjStart(), nu = new Date();
    const met = Object.keys(d.nu).filter((k) => d.jaar[k]);
    const uit = [`Diagnose mutaties (Docent Tools ${DT.version}), ${d.vandaag}`, `Vertrekkers zonder naam: ${Object.values(d.jaar).reduce((n, o) => n + Object.values(o.studenten || {}).filter((st) => this.zonderNaam(st)).length, 0)}${this._namenFout ? `; ${this._namenFout}` : ""}`, `Klassen: ${Object.keys(d.nu).length}, met jaaropslag: ${met.length}, vandaag bijgewerkt: ${met.filter((k) => !this.verouderd(d.jaar[k])).length}`,
      `Mutaties nu: ${tel(Object.values(d.mut || {}).flat().map((m) => m.soort))}`, `Studenten in de opslag: ${met.reduce((n, k) => n + Object.keys(d.jaar[k].studenten || {}).length, 0)}, waarvan niet meer in de klas: ${met.reduce((n, k) => n + Object.values(d.jaar[k].studenten || {}).filter((s) => !s.nu).length, 0)}`, ""];
    if (!klas) { await DT.copy(uit.join("\n")); return; }
    this.status("Diagnose mutaties: peildatums…", false, 0, false);
    /* 1. De klas op elke maandag van dit schooljaar. */
    const zoek = async (peil) => DT.lijst(await kort(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam`)) || null;
    const vandaag = await zoek(d.vandaag) || [], nuIds = new Set(vandaag.map((l) => String(l.id))), ooit = new Set(nuIds);
    uit.push(`1. Grootste klas op elke maandag (vandaag ${vandaag.length} studenten): aantal / niet meer in de klas / toen nog niet in de klas`);
    const regels = [];
    for (let m = R.datum(R.maandag(sjVan)); m <= nu; m = new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7)) {
      const lln = await zoek(R.ymd(m)); await this.wacht(120);
      if (!lln) { regels.push(`${R.ymd(m)}: mislukt`); continue; }
      const ids = new Set(lln.map((l) => String(l.id))); ids.forEach((i) => ooit.add(i));
      regels.push(`${R.ymd(m)}: ${lln.length} / ${[...ids].filter((i) => !nuIds.has(i)).length} / ${[...nuIds].filter((i) => !ids.has(i)).length}`);
    }
    uit.push(`  ${regels.join("  |  ")}`, `  verschillende studenten over alle maandagen: ${ooit.size}`, "");
    /* 2. Aanmeldingen van de studenten van de klas. */
    this.status("Diagnose mutaties: aanmeldingen…", false, 0.3, false);
    const begin = [], einde = [], aantal = [], groep = []; let amVorm = null, amFout = 0;
    await this.parallel(vandaag.slice(0, 40), async (l) => {
      const a = await kort(`/api/leerlingen/${encodeURIComponent(l.id)}/aanmeldingen`), am = DT.lijst(a); await this.wacht(120);
      if (!am) { amFout++; return; }
      amVorm ||= Array.isArray(a.shape) ? a.shape[0] : a.shape?.items?.[0];
      aantal.push(am.length);
      for (const x of am) {
        if (String(x.einde ?? "") < R.ymd(sjVan)) continue;
        begin.push(String(x.begin ?? x.start ?? "").slice(0, 10)); einde.push(String(x.einde ?? "").slice(0, 10) || "leeg");
        groep.push(R.naam(x.groep) === klas ? "deze klas" : "andere klas");
      }
    });
    uit.push(`2. Aanmeldingen van ${Math.min(40, vandaag.length)} studenten (mislukt: ${amFout})`, `  aantal aanmeldingen per student: ${tel(aantal)}`, `  begindatums (dit schooljaar): ${tel(begin)}`, `  einddatums: ${tel(einde)}`, `  groep: ${tel(groep)}`, `  velden: ${vorm(amVorm)}`, "");
    /* 3. Wat de opslag van deze klas zegt. */
    const o = d.jaar[klas];
    if (o) {
      const gewoon = Object.keys(R.lesPunten(R.lesWekenUit(o))).sort(), alleWk = Object.keys(o.mom || {}).sort();
      const eerste = Object.values(o.studenten || {}).map((s) => Object.keys(s.w || {}).filter((w) => s.w[w].some((n) => n)).sort()[0] || "geen lessen");
      const laatste = Object.values(o.studenten || {}).map((s) => Object.keys(s.w || {}).filter((w) => s.w[w].some((n) => n)).sort().pop() || "geen lessen");
      uit.push(`3. Opslag van de klas: ${Object.keys(o.studenten || {}).length} studenten, ${alleWk.length} weken met lessen (${alleWk[0] || "-"} t/m ${alleWk[alleWk.length - 1] || "-"}), gewone lesweken: ${gewoon.length} (eerste ${gewoon[0] || "-"})`,
        `  lessen per week: ${alleWk.map((w) => `${w.slice(5)}: ${o.mom[w].lessen}`).join(", ")}`, `  eerste lesweek per student: ${tel(eerste)}`, `  laatste lesweek per student: ${tel(laatste)}`, "");
    } else uit.push("3. Opslag van de klas: nog niet opgehaald", "");
    /* 4. De deelnemers van één les uit de eerste weken. */
    this.status("Diagnose mutaties: deelnemers van een les…", false, 0.7, false);
    const st = vandaag[0];
    if (st) {
      const tot = new Date(sjVan.getFullYear(), sjVan.getMonth(), sjVan.getDate() + 63);
      const a = await kort(`/api/leerlingen/${encodeURIComponent(st.id)}/afspraken?status=actief&begin=${R.ymd(sjVan)}&einde=${R.ymd(tot)}`), rooster = DT.lijst(a) || [];
      const les = rooster.find((x) => x.onderwijstijd != null) || rooster[0];
      uit.push(`4. Rooster van één student, eerste negen weken: status ${a.status}, ${rooster.length} afspraken, met onderwijstijd: ${rooster.filter((x) => x.onderwijstijd != null).length}`, `  velden afspraak: ${vorm(Array.isArray(a.shape) ? a.shape[0] : a.shape?.items?.[0])}`);
      if (les?.id != null) {
        const acc = await DT.api("/api/account", { full: true, timeout: 10000 }), mid = acc.json?.Persoon?.Id ?? acc.json?.persoon?.id ?? null;
        const probeer = async (naam, url) => {
          const r = await kort(url), lijst = DT.lijst(r); await this.wacht(150);
          const ids = (lijst || []).map((x) => String(x.persoonId ?? x.leerling?.id ?? x.leerlingId ?? x.persoon?.id ?? x.id ?? ""));
          uit.push(`  ${naam}: status ${r.status}${lijst ? `, ${lijst.length} regels, niet in de klas van vandaag: ${ids.filter((i) => i && !nuIds.has(i)).length}` : ""}`, `    velden: ${vorm(Array.isArray(r.shape) ? r.shape[0] : r.shape?.items?.[0] ?? r.shape)}`);
        };
        uit.push(`  les van ${String(les.start || les.begin || "").slice(0, 10)}`);
        await probeer("afspraak via leerling", `/api/leerlingen/${encodeURIComponent(st.id)}/afspraken/${les.id}`);
        if (mid != null) await probeer("deelnemers", `/api/medewerkers/${mid}/afspraken/${les.id}/deelnemers?type=leerling`);
        else uit.push("  deelnemers: eigen medewerkernummer niet gevonden");
        await probeer("verantwoordingen van de les", `/api/medewerkers/afspraken/${les.id}/verantwoordingen`);
        await probeer("afspraak via medewerker", `/api/medewerkers/afspraken/${les.id}`);
      }
    }
    this.status("");
    await DT.copy(uit.join("\n"));
  },

  /* ---------- back-up in een map ---------- */
  mapDb() {
    return new Promise((ok, nee) => {
      const r = indexedDB.open("dt-opl", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  async kv(sleutel, waarde) {
    const db = await this.mapDb();
    return new Promise((ok, nee) => {
      const tx = db.transaction("kv", waarde === undefined ? "readonly" : "readwrite"), st = tx.objectStore("kv");
      const r = waarde === undefined ? st.get(sleutel) : waarde === null ? st.delete(sleutel) : st.put(waarde, sleutel);
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  bestand() { return `docent-tools-opleidingen-${location.host.replace(/[^a-z0-9.-]/gi, "_")}.json`; },
  /* De gekozen map: _map als Chrome toegang geeft, anders _mapWacht (toegang vraagt een klik, eens per sessie). */
  async mapLaden() {
    this._map = null; this._mapWacht = null;
    try {
      const h = await this.kv("map"); if (!h) return;
      const mag = await h.queryPermission({ mode: "readwrite" });
      if (mag === "granted") this._map = h; else this._mapWacht = h;
    } catch {}
  },
  /* Het bestand in de map samenvoegen met wat er in de extensie staat. */
  async backupLezen() {
    if (!this._map) return false;
    try {
      const b = JSON.parse(await (await (await this._map.getFileHandle(this.bestand())).getFile()).text());
      if (!b || b.host !== location.host) return false;
      await this.bewaar("jaar", OplReken.nieuwste(await this.opslag("jaar"), b.jaar));
      for (const naam of ["momenten", "tel", "indeling2"]) await this.bewaar(naam, { ...(b[naam] || {}), ...(await this.opslag(naam)) });
      this._mapOp = b.op || null;
      return true;
    } catch { return false; }   // nog geen bestand, of niet te lezen (OneDrive synchroniseert nog)
  },
  async backupSchrijven() {
    if (!this._map) return;
    try {
      const b = { versie: 1, host: location.host, op: Date.now() };
      for (const naam of ["jaar", "momenten", "tel", "indeling2"]) b[naam] = await this.opslag(naam);
      const w = await (await this._map.getFileHandle(this.bestand(), { create: true })).createWritable();
      await w.write(JSON.stringify(b)); await w.close();
      this._mapOp = b.op; this._mapFout = null;
    } catch (e) { this._mapFout = String(e?.message || e); console.warn("[DT] opleidingen: back-up schrijven mislukt", e); }
  },
  async kiesMap(DT) {
    if (!window.showDirectoryPicker) return DT.toast("Deze browser kan geen map openen. Gebruik Chrome of Edge op een computer.", "err", 5000);
    try {
      const h = await window.showDirectoryPicker({ id: "dt-opl", mode: "readwrite" });
      await this.kv("map", h); this._map = h; this._mapWacht = null;
      const gelezen = await this.backupLezen();
      await this.backupSchrijven();
      DT.toast(gelezen ? `Back-up in "${h.name}" ingelezen en bijgewerkt` : `Back-up staat nu in "${h.name}"`, "ok", 4000);
      this.laad(DT);
    } catch (e) { if (e?.name !== "AbortError") DT.toast(`Map kiezen lukte niet: ${e?.message || e}`, "err", 5000); }
  },
  async mapToegang(DT) {
    const h = this._mapWacht; if (!h) return;
    if (await h.requestPermission({ mode: "readwrite" }).catch(() => "denied") !== "granted") return DT.toast("Zonder toegang tot de map is er geen back-up.", "err", 4000);
    this._map = h; this._mapWacht = null;
    await this.backupLezen(); await this.backupSchrijven();
    this.laad(DT);
  },
  async mapLos(DT) { await this.kv("map", null).catch(() => {}); this._map = this._mapWacht = null; this.teken(DT); },

  /* Kaart onderaan: wanneer is er bijgewerkt en waar staat de back-up. */
  opslagKaart() {
    const d = this._d, E = (s) => this.esc(s), namen = Object.keys(d.nu), met = namen.filter((k) => d.jaar[k]), oud = namen.filter((k) => this.verouderd(d.jaar[k]));
    const moment = (t) => new Date(t).toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }), uit = this._aanwBezig ? " disabled" : "";
    const stand = !met.length ? "Nog niets opgehaald." : `${met.length} van ${namen.length} klassen bewaard, laatst bijgewerkt op ${E(moment(Math.max(...met.map((k) => d.jaar[k].op))))}.${oud.length ? ` ${oud.length} ${oud.length === 1 ? "klas is" : "klassen zijn"} vandaag nog niet bijgewerkt.` : ""}`;
    const map = this._map ? `Back-up in de map "${E(this._map.name)}" (${E(this.bestand())})${this._mapFout ? `: schrijven mislukte (${E(this._mapFout)})` : this._mapOp ? `, laatst geschreven op ${E(moment(this._mapOp))}` : ""}. <button type="button" class="dt-opl-knop is-stil" data-act="map-kies">Andere map</button><button type="button" class="dt-opl-knop is-stil" data-act="map-los">Ontkoppelen</button>`
      : this._mapWacht ? `Back-up in de map "${E(this._mapWacht.name)}": Chrome vraagt per sessie één keer toestemming. <button type="button" class="dt-opl-knop" data-act="map-toegang">Map openen</button>`
      : `Nog geen back-up. Kies een map op deze computer of in OneDrive; dan staat daar na elke update een kopie, en kan een andere computer met dezelfde map verder. <button type="button" class="dt-opl-knop" data-act="map-kies">Map kiezen</button>`;
    return `<dna-card class="dt-opl-kaart"><h2>Opslag en back-up</h2>
      <p class="dt-opl-zacht">Aanwezigheid en lessen blijven bewaard en worden bij het openen van deze pagina één keer per dag bijgewerkt (alleen de laatste weken). ${stand}
      <button type="button" class="dt-opl-knop" data-act="bijwerk"${uit}>Nu bijwerken</button><button type="button" class="dt-opl-knop is-stil" data-act="les-opnieuw"${uit} title="Haalt het hele schooljaar opnieuw op: per student twee aanvragen">Alles opnieuw ophalen</button></p>
      <p class="dt-opl-zacht">${map}</p>
      <p class="dt-opl-zacht">De opslag en de back-up bevatten per student de naam en het aantal lessen per week en categorie. Bewaar de back-up alleen op een plek die daarvoor is toegestaan.</p></dna-card>`;
  },
});
