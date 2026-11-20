/* Te laat-balie, afspraak, notitie en mail per signaal of meldafspraak.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
  /* ===================================================================================== */
  /* Afspraak in Magister: Magisters eigen formulier, ingevuld; jij klikt op Opslaan        */
  /* ===================================================================================== */
  afspraakMaken(sn, { onderwerp, tekst, datum, tijd, minuten = 15 }) {
    const K = TardyKern, st = K.S.studenten[sn];
    const d = datum || K.volgendeSchooldag(K.vandaag()), t = tijd || K.S.instellingen.meldTijd || "08:30";
    const [hh, mm] = t.split(":").map(Number), eind = new Date(2000, 0, 1, hh, mm + minuten);
    const concept = { t: Date.now(), stamnr: String(sn), naam: K.naamVan(st), onderwerp, locatie: K.S.instellingen.lokaal || "", datum: K.dmy(d),
      van: t, tot: `${String(eind.getHours()).padStart(2, "0")}:${String(eind.getMinutes()).padStart(2, "0")}`, tekst, bron: "de Te laat-balie" };
    try { localStorage.setItem("dt-cb-afspraak", JSON.stringify(concept)); } catch {}
    window.open(`${location.origin}/op/#/afspraak/afspraak/nieuw`, "_blank");
    this.melding("Magister opent de nieuwe afspraak in een nieuw tabblad, al ingevuld. Controleer en klik daar op Opslaan.", "info", 7000);
  },

  /* Op #/afspraak/afspraak/nieuw: het concept invullen zoals een gebruiker dat zou doen. */
  vulAfspraak() { return DTForms.vulAfspraak("dt-cb-afspraak"); },


  /* ===================================================================================== */
  /* Drie acties per signaal: notitie in het dossier, mail, afspraak — afgevinkt na gebruik  */
  /* ===================================================================================== */
  /* Wat er per signaal al gedaan is staat in de gedeelde gegevens (S.cbActies[signaalsleutel]), zodat een
   * collega en de Tardy-app het ook zien. Opslaan in Magister doe je zelf in Magisters eigen formulier. */
  actieGedaan(key, soort) {
    const S = TardyKern.S;
    (S.cbActies ||= {})[key] = Object.assign({}, S.cbActies[key], { [soort]: new Date().toISOString() });
    this.bewaar();
  },

  /* Kleine iconknop voor de ingeklapte signaalregel; de naam staat in de tooltip en voor schermlezers. */
  IKOON: {
    notitie: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    afspraak: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    af: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    heropen: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/>',
    meld: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  },
  ikoonKnop(DT, soort, label, fn, { gedaan = false, uit = false, hoofd = false } = {}) {
    const b = DT.el("button", { type: "button", class: `dt-cb-ikoon${gedaan ? " is-gedaan" : ""}${hoofd ? " is-hoofd" : ""}`, title: label, "aria-label": label });
    b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${this.IKOON[soort]}</svg>${gedaan ? '<span class="dt-cb-vink" aria-hidden="true">✓</span>' : ""}`;
    if (uit) b.disabled = true;
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    return b;
  },

  actieTerug(key, soort) {
    const S = TardyKern.S, a = (S.cbActies || {})[key];
    if (!a) return;
    delete a[soort]; if (!Object.keys(a).length) delete S.cbActies[key];
    this.bewaar();
  },

  /* Notitie, mail en afspraak. Na een klik staat er een vinkje; met ↺ zet je hem terug op open (bijv. als je
   * de notitie in Magister hebt geannuleerd). kort = compacte knoppen voor de signaallijst. */
  actieKnoppen(DT, s, st, pid, naKlik = () => this.teken(), kort = false) {
    const K = TardyKern, gedaan = (K.S.cbActies || {})[s.key] || {};
    const mails = this.sigMails(s);
    const ontvangers = [...new Set(mails.map((t) => ({ student: "student", ouders: "ouders", mentor: "mentor", bureau: "verzuimbureau" })[(K.MAILSOORT[t] || {}).aan] || "mentor"))];
    const vars = this.signaalVars(DT, s, st, pid);
    const knop = (soort, label, uitleg, klaarLabel, fn, uit = false) => {
      const wanneer = gedaan[soort] ? new Date(gedaan[soort]) : null;
      const moment = wanneer ? `${wanneer.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} om ${wanneer.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "";
      if (kort) return this.ikoonKnop(DT, soort, wanneer ? `${klaarLabel} op ${moment}. Klik om het opnieuw te doen; klap de regel uit om terug te zetten.` : `${label}: ${uitleg}`,
        () => { fn(); this.actieGedaan(s.key, soort); naKlik(); }, { gedaan: !!wanneer, uit });
      const b = this.knop(DT, wanneer ? `✓ ${klaarLabel}` : label, () => { fn(); this.actieGedaan(s.key, soort); naKlik(); }, false, `klein${wanneer ? " stil" : ""}`);
      b.classList.add("dt-cb-actie"); if (wanneer) b.classList.add("is-gedaan");
      b.title = wanneer ? `${klaarLabel} op ${wanneer.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} om ${wanneer.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}. Klik om het opnieuw te doen.` : uitleg;
      if (uit) b.setAttribute("disabled", "");
      if (!wanneer) return b;
      const terug = DT.el("button", { type: "button", class: "dt-cb-terug", text: "↺", title: `Terugzetten naar open (bijvoorbeeld als je het in Magister of Outlook hebt geannuleerd)`, "aria-label": `${klaarLabel} terugzetten naar open` });
      terug.addEventListener("click", (e) => { e.stopPropagation(); this.actieTerug(s.key, soort); naKlik(); });
      return DT.el("span", { class: "dt-cb-actiegroep" }, [b, terug]);
    };
    return DT.el("div", { class: kort ? "dt-cb-acties-in" : "dt-cb-acties3" }, [
      knop("notitie", "Notitie in dossier", "Notitie in het dossier (logboek) in Magister", "Notitie", () => {
        const t = this.eigenTekst("notitie", vars);
        this.notitieMaken(s.stamnr, { omschrijving: t.onderwerp, tekst: t.body, type: DT.settings.cb?.logboekType || "Notitie" });
      }),
      knop("mail", mails.length ? `Mail ${ontvangers.join(", ")}` : "Geen mail", mails.length ? `Concept in je mailprogramma${this.oudersMet18(st) ? " (18+, met toestemming voor contact met ouders)" : ""}` : "Bij deze stap hoort geen mail", "Mail", () => this.mailsDirect(s, pid), !mails.length),
      knop("afspraak", "Afspraak in Magister", "Afspraak met de student in Magister", "Afspraak", () => {
        const t = this.eigenTekst("afspraak", vars);
        this.afspraakMaken(s.stamnr, { onderwerp: t.onderwerp, tekst: t.body, minuten: s.niveau >= 3 ? 30 : 15 });
      }),
    ]);
  },

  /* 18+ met toestemming voor contact met ouders (uit Magister). */
  oudersMet18(st) { return !!st && st.ouderToestemming === true && TardyKern.minderjarig(st) === false; },
  /* Signalen van 18+-studenten met toestemming voor contact met ouders: de maatregel zoals voor minderjarigen
   * (met ouders informeren) in plaats van de 18+-tekst, en de mails van de trede volledig. */
  met18(lijst) {
    const K = TardyKern;
    return lijst.map((s) => {
      if (!this.oudersMet18(K.S.studenten[s.stamnr])) return s;
      const tr = this.tredeVan(s);
      if (!tr) return s;
      const maatregel = K.vulIn(tr.maatregel) + (tr.bijMeer && s.telling > tr.vanaf ? K.vulIn(tr.bijMeer) : "");
      return Object.assign({}, s, { maatregel, mails: this.sigMails(s) });
    });
  },
  tredeVan(s) { return (TardyKern.protocolLadder(s.soort)?.treden || []).find((x) => x.vanaf === s.drempel && x.niveau === s.niveau && x.label === s.consequentie) || null; },
  /* De mails van een signaal. De kern laat mails aan ouders weg bij 18+; heeft de student in Magister
   * toestemming gegeven voor contact met ouders, dan nemen we de mails van de trede weer volledig mee. */
  sigMails(s) {
    const K = TardyKern, st = K.S.studenten[s.stamnr];
    if (!this.oudersMet18(st)) return s.mails;
    const tr = this.tredeVan(s);
    return tr ? [...new Set([...(tr.mails || []), ...s.mails])] : s.mails;
  },
  /* Meerdere adressen (ouders) in één mailto: elk adres apart gecodeerd, gescheiden door komma's. */
  adressen(aan) { return String(aan || "").split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean).map(encodeURIComponent).join(","); },

  /* E-mailadressen van ouders/verzorgers uit Magister (Basisgegevens › Ouders/verzorgers): de ouders van de
   * leerling en per ouder de contactgegevens van het type "emailadres". Bewaard als st.ouderEmail, het veld
   * dat Tardy ook gebruikt voor mails aan ouders. Alleen voor minderjarigen of als de student nog geen
   * leeftijd heeft; bij 18+ vallen de mails aan ouders volgens het protocol weg. */
  async ouderMails(st, id = null) {
    const K = TardyKern;
    id ||= st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; if (id) st.magisterId = id; }
    if (!id) return null;
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    if (!st.geboortedatum) {
      const p = await this.apiOpnieuw(`/api/leerlingen/${encodeURIComponent(id)}/personalia`);
      const d = p?.status === 200 ? String(p.json?.geboortedatum || "").slice(0, 10) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) st.geboortedatum = d;
    }
    const ouders = lijst(await this.apiOpnieuw(`/api/leerlingen/${encodeURIComponent(id)}/ouders`));
    if (!ouders) return null;
    /* Bij 18+ alleen ouders/verzorgers waarvoor de student toestemming gaf (in Magister per ouder:
     * heeftToestemming). Bij minderjarigen staat die altijd aan. */
    const volw = K.minderjarig(st) === false;
    const mag = ouders.filter((o) => !volw || o.heeftToestemming === true);
    if (volw) st.ouderToestemming = mag.length > 0; else delete st.ouderToestemming;
    const adressen = [];
    for (const o of mag.slice().sort((a, b) => (a.volgnummer || 9) - (b.volgnummer || 9))) {
      const c = lijst(await this.apiOpnieuw(`/api/ouders/${encodeURIComponent(o.id)}/contactgegevens`)) || [];
      for (const x of c) {
        const mail = String(x.emailadres || "").trim();
        if (x.type === "emailadres" && /@/.test(mail) && !adressen.some((a) => a.toLowerCase() === mail.toLowerCase())) adressen.push(mail);
      }
    }
    st.ouderEmailOp = K.vandaag();
    if (adressen.length) { st.ouderEmail = adressen.join(", "); st.ouderEmailBron = "magister"; }
    else if (st.ouderEmailBron === "magister") delete st.ouderEmail;   // toestemming ingetrokken of adres weg
    this.bewaar();
    return adressen;
  },
  /* Mentor uit Magister: de mentoren van de lopende aanmelding (/api/aanmeldingen/{id}/mentoren) en hun
   * schoolmailadres (/api/medewerkers/{id}/contactgegevens, "Email School"). Een klasmentor (type "groep") gaat
   * naar de klasmentoren in de gedeelde gegevens, een persoonlijke mentor naar de student. Wat met de hand
   * (of in Tardy) is ingevuld, blijft staan; alleen lege of eerder uit Magister gehaalde gegevens worden bijgewerkt. */
  async mentorUitMagister(st, id = null) {
    const K = TardyKern, nu = K.vandaag();
    id ||= st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; if (id) st.magisterId = id; }
    if (!id) return null;
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const am = lijst(await this.apiOpnieuw(`/api/leerlingen/${encodeURIComponent(id)}/aanmeldingen`)) || [];
    const loopt = am.filter((x) => (!x.begin || String(x.begin).slice(0, 10) <= nu) && (!x.einde || String(x.einde).slice(0, 10) >= nu));
    const a = loopt.find((x) => x.isHoofdAanmelding) || loopt[0] || am[0];
    if (!a) return null;
    const mentoren = (lijst(await this.apiOpnieuw(`/api/aanmeldingen/${a.id}/mentoren`)) || []).sort((x, y) => (x.volgnummer || 9) - (y.volgnummer || 9));
    this._mentorMail ||= {};
    const mail = async (m) => {
      if (m.id in this._mentorMail) return this._mentorMail[m.id];
      const c = lijst(await this.apiOpnieuw(`/api/medewerkers/${m.id}/contactgegevens`)) || [];
      const adressen = c.filter((x) => x.type === "emailadres" && /@/.test(x.emailadres || ""));
      return (this._mentorMail[m.id] = (adressen.find((x) => /school|werk/i.test(x.label || "")) || adressen[0])?.emailadres || "");
    };
    const naam = (m) => [m.roepnaam || m.voorletters, m.tussenvoegsel, m.achternaam].filter(Boolean).join(" ") || m.naam || "";
    const klas = a.groep?.code || st.klas;
    let gezet = false;
    const groep = mentoren.find((m) => [].concat(m.type || []).includes("groep"));
    const pers = mentoren.find((m) => [].concat(m.type || []).some((t) => /persoonlijk/i.test(t)));
    if (groep && klas) {
      const km = (K.S.instellingen.klasMentoren ||= {}), oud = km[klas];
      if (!oud || oud.bron === "magister" || (!oud.naam && !oud.email)) { km[klas] = { naam: naam(groep), email: await mail(groep), bron: "magister" }; gezet = true; }
    }
    if (pers && (st.mentorBron === "magister" || (!st.persoonlijkeMentor && !st.persoonlijkeMentorEmail))) {
      st.persoonlijkeMentor = naam(pers); st.persoonlijkeMentorEmail = await mail(pers); st.mentorBron = "magister"; gezet = true;
    }
    if (!st.klas && klas) st.klas = klas;
    if (gezet) this.bewaar();
    return K.mentorVan(st);
  },
  /* Vlak voor een mail aan ouders: adres ophalen als het er nog niet is (of ouder is dan een week). */
  async zorgOuders(st) {
    const K = TardyKern;
    if (!st || (st.ouderEmail && st.ouderEmailOp && st.ouderEmailOp >= K.plusDagen(K.vandaag(), -7))) return;
    if (st.ouderEmail && !st.ouderEmailOp) return;   // met de hand of uit een Tardy-import: laten staan
    if (!st.ouderEmail && st.ouderEmailOp === K.vandaag()) return;   // vandaag al gezocht, niets gevonden
    this.melding("E-mailadres van ouders/verzorgers ophalen uit Magister…");
    try {
      const r = await this.ouderMails(st);
      if (r && !r.length) this.melding("In Magister staat geen e-mailadres van ouders/verzorgers.", "err");
    } catch { this.melding("Ophalen van het adres van ouders/verzorgers lukte niet.", "err"); }
  },

  /* ---------- meldafspraken vanuit het protocol ---------- */
  /* De periode van een meldafspraak: waarin hij gemaakt is (de afspraak zelf kan al in de volgende periode vallen). */
  meldPid(m) { const K = TardyKern; return (K.periodeVanDatum(m.gemaaktOp || m.datum) || K.periodeVanDatum(m.datum))?.id || K.UI.periodeId; },
  openMeld(sn) { return TardyKern.S.meldafspraken.filter((m) => m.stamnr === sn && m.status === "open").sort((a, b) => a.datum.localeCompare(b.datum))[0] || null; },
  /* Vraagt deze stap (of een lichtere stap van dezelfde ladder die erin opgaat) om een meldafspraak? */
  meldNodig(s) {
    const K = TardyKern, l = K.protocolLadder(s.soort);
    return !!(l?.treden || []).some((tr) => tr.meldafspraak && tr.vanaf <= s.drempel && K.tredeTeller(l, tr) === K.tredeTeller(l, this.tredeVan(s) || tr)) || s.soort === "nietgemeld";
  },
  maakMeld(s, { datum, tijd } = {}) {
    const K = TardyKern;
    const m = { id: K.uid(), stamnr: s.stamnr, datum: datum || K.volgendeSchooldag(K.vandaag()), tijd: tijd || K.S.instellingen.meldTijd || "08:30",
      aanleiding: ["telaat", "ongeoorloofd", "nietgemeld"].includes(s.soort) ? s.soort : "handmatig", status: "open", gemaaktOp: K.vandaag(), gemaild: false, signaalKey: s.key };
    if (m.aanleiding === "handmatig") m.aanleidingTekst = s.titel;
    K.S.meldafspraken.push(m); this.bewaar();
    return m;
  },
  meldVars(m) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || {}, pid = this.meldPid(m), t = K.tellingen(m.stamnr, pid);
    const vorige = m.vorigeId && K.S.meldafspraken.find((x) => x.id === m.vorigeId);
    const aanleiding = m.aanleidingTekst || ({ telaat: `${t.teLaat}× te laat`, ongeoorloofd: `${t.ongeoorloofd}× ongeoorloofd`, nietgemeld: `niet verschenen bij de vorige meldafspraak${vorige ? ` (${K.langDatum(vorige.datum)})` : ""}` })[m.aanleiding] || "afspraak met de CB'er";
    const top = this.perStudent(this.met18(K.hoogsteTreden(K.signalenVoor(m.stamnr, pid))).filter((x) => !x.afgehandeld))[0];
    return { naam: K.naamVan(st), roepnaam: st.roepnaam || K.naamVan(st), klas: st.klas || "", datum: K.langDatum(m.datum), tijd: m.tijd || "", lokaal: K.S.instellingen.lokaal || "",
      aanleiding, stap: top ? `${top.consequentie} (${top.titel})` : "", vorige: vorige ? `${K.langDatum(vorige.datum)} om ${vorige.tijd || ""}` : "",
      stand: this.statsRegel(DT, m.stamnr)?.textContent || "", cb: K.S.instellingen.cbNaam || "de CB'er" };
  },
  /* De mails bij een meldafspraak: de uitnodiging aan de student, plus de mails van de protocolstap waar de afspraak uit voortkomt. */
  meldMails(m) {
    const K = TardyKern, pid = this.meldPid(m);
    const sigs = this.met18(K.hoogsteTreden(K.signalenVoor(m.stamnr, pid))).filter((x) => !x.afgehandeld);
    const s = sigs.find((x) => x.key === m.signaalKey) || sigs.find((x) => x.soort === m.aanleiding);
    return [...new Set(["student-meldafspraak", ...(s ? this.sigMails(s) : [])])];
  },
  /* Notitie, mail en afspraak bij een meldafspraak, met vinkjes (m.acties) zoals bij de signalen. */
  meldActies(DT, m, naKlik = () => this.teken(), kort = true) {
    const K = TardyKern, st = K.S.studenten[m.stamnr] || {}, pid = this.meldPid(m), gedaan = m.acties || {};
    const klaar = (soort) => { (m.acties ||= {})[soort] = new Date().toISOString(); this.bewaar(); naKlik(); };
    const terug = (soort) => { delete (m.acties || {})[soort]; this.bewaar(); naKlik(); };
    const mails = this.meldMails(m), vars = this.meldVars(m);
    const acties = [
      ["notitie", "Notitie in dossier", () => { const t = this.eigenTekst("meldafspraak", vars); this.notitieMaken(m.stamnr, { omschrijving: t.onderwerp, tekst: t.body, type: DT.settings.cb?.logboekType || "Notitie" }); }],
      ["mail", `Mail ${[...new Set(mails.map((x) => ({ student: "student", ouders: "ouders", mentor: "mentor", bureau: "verzuimbureau" })[(K.MAILSOORT[x] || {}).aan]))].join(", ")}`,
        async () => { await this.stuurMails(m.stamnr, mails, pid, { datum: m.datum, tijd: m.tijd, melding: m }); m.gemaild = true; }],
      ["afspraak", "Afspraak in Magister", () => { const t = this.eigenTekst("meldafspraakAgenda", vars); this.afspraakMaken(m.stamnr, { onderwerp: t.onderwerp, tekst: t.body, datum: m.datum, tijd: m.tijd }); }],
    ];
    return DT.el("div", { class: kort ? "dt-cb-acties-in" : "dt-cb-acties3" }, acties.map(([soort, label, fn]) => {
      const wanneer = gedaan[soort] ? new Date(gedaan[soort]) : null;
      const titel = wanneer ? `${label}: gedaan op ${wanneer.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} om ${wanneer.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}. Klik om het opnieuw te doen.` : label;
      const b = kort ? this.ikoonKnop(DT, soort, titel, async () => { await fn(); klaar(soort); }, { gedaan: !!wanneer })
        : this.knop(DT, wanneer ? `✓ ${label}` : label, async () => { await fn(); klaar(soort); }, false, `klein${wanneer ? " stil" : ""}`);
      if (!wanneer) return b;
      const r = DT.el("button", { type: "button", class: "dt-cb-terug", text: "↺", title: "Terugzetten naar open", "aria-label": `${label} terugzetten` });
      r.addEventListener("click", (e) => { e.stopPropagation(); terug(soort); });
      return DT.el("span", { class: "dt-cb-actiegroep" }, [b, r]);
    }));
  },

  /* Alle mails van deze trede als concept in het eigen mailprogramma (Outlook), en vastleggen in het dossier. */
  async mailsDirect(s, pid) { return this.stuurMails(s.stamnr, this.sigMails(s), pid); },
  /* Mails van de gegeven soorten voor één student: als concept in het mailprogramma, of (instelling) als
   * Magister-bericht voor student, ouders en mentor. extra gaat mee naar de mailtekst (datum/tijd van een meldafspraak). */
  async stuurMails(sn, soorten, pid, extra) {
    const K = TardyKern, st = K.S.studenten[sn], s = { stamnr: sn };
    if (soorten.some((t) => (K.MAILSOORT[t] || {}).aan === "ouders")) await this.zorgOuders(st);
    if (soorten.some((t) => (K.MAILSOORT[t] || {}).aan === "mentor") && !K.mentorVan(st).email) await this.mentorUitMagister(st).catch(() => {});
    const mails = soorten.map((type) => this.mailVan(type, s.stamnr, pid, extra));
    /* Via Magister-berichten (instelling): student, ouders en mentor als Magister-bericht; overige (verzuimbureau)
     * blijven een concept in het mailprogramma. */
    if (DT.settings.cb?.berichtenVia === "magister") {
      const via = mails.filter((m) => ["student", "ouders", "mentor"].includes((K.MAILSOORT[m.type] || {}).aan));
      via.forEach((m, i) => setTimeout(() => DTForms.bericht("dt-cb-bericht", { onderwerp: m.onderwerp, tekst: m.body, bron: "de Te laat-balie",
        ontvangers: [{ soort: { student: "student", ouders: "ouders", mentor: "mentoren" }[(K.MAILSOORT[m.type] || {}).aan], zoek: String(s.stamnr), naam: K.naamVan(st) }] }), i * 1200));
      const rest = mails.filter((m) => !via.includes(m));
      rest.forEach((m, i) => setTimeout(() => { const a = document.createElement("a"); a.href = `mailto:${this.adressen(m.aan)}?subject=${encodeURIComponent(m.onderwerp)}&body=${encodeURIComponent(m.body)}`; a.click(); }, (via.length + i) * 1200));
      mails.forEach((m) => K.S.mails.push({ id: K.uid(), stamnr: s.stamnr, type: m.type, aan: m.aan, onderwerp: m.onderwerp, op: K.vandaag(), via: via.includes(m) ? "magister" : "mail" }));
      this.melding(`${via.length ? `${via.length} Magister-${via.length === 1 ? "bericht opent" : "berichten openen"} in een nieuw tabblad` : ""}${via.length && rest.length ? "; " : ""}${rest.length ? `${rest.length} ${rest.length === 1 ? "mail" : "mails"} in je mailprogramma` : ""}. Controleer en verstuur zelf.`, "info", 8000);
      return;
    }
    mails.forEach((m, i) => setTimeout(() => {
      const a = document.createElement("a");
      a.href = `mailto:${this.adressen(m.aan)}?subject=${encodeURIComponent(m.onderwerp)}&body=${encodeURIComponent(m.body)}`;
      a.click();
    }, i * 900));
    mails.forEach((m) => K.S.mails.push({ id: K.uid(), stamnr: s.stamnr, type: m.type, aan: m.aan, onderwerp: m.onderwerp, op: K.vandaag() }));
    const zonder = mails.filter((m) => !m.aan).length;
    this.melding(`${mails.length} ${mails.length === 1 ? "mail staat" : "mails staan"} klaar in je mailprogramma${zonder ? `; bij ${zonder} ontbreekt het adres` : ""}.`, zonder ? "err" : "info", 7000);
  },

  /* Notitie: het logboek van de student openen in een nieuw tabblad; daar kiest de balie Toevoegen › Notitie
   * en vult omschrijving en inhoud in. Jij loopt de stappen na en klikt op Opslaan. */
  /* Plan van aanpak staat bij de begeleiding van de student (module pva.js). Vanuit een signaal: het logboek
   * openen en het formulier daar laten openen, met de aanleiding van het signaal. */
  async pvaOpenen(s, st) {
    const K = TardyKern;
    if (!DT.settings.pva?.enabled) return this.melding("Zet eerst de module Plan van aanpak aan (zijpaneel of instellingen).", "err");
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(s.stamnr)).find((x) => x.stamnr === String(s.stamnr)); id = hit?.magisterId; if (id) { st.magisterId = id; this.bewaar(); } }
    if (!id) return this.melding("Deze student is niet in Magister gevonden.", "err");
    const verzuim = ["telaat", "ongeoorloofd", "nietgemeld", "ziek", "medisch", "calamiteit"].includes(s.soort);
    DTForms.logboek("dt-pva-open", { magisterId: String(id), soort: /Blijf Bij Ma|BBM/i.test(`${s.consequentie} ${s.maatregel}`) ? "bbm" : "algemeen",
      redenen: [verzuim ? "verzuim" : "voortgang", ...(s.soort === "nietgemeld" ? ["afspraken"] : [])],
      toelichting: `${s.titel} in ${(K.periodeById(K.UI.periodeId) || {}).naam || "deze periode"} (peildatum ${K.langDatum(K.vandaag())}). Stap in het verzuimprotocol: ${s.consequentie}.` });
    const pid = await this.persoonId();
    const binnen = encodeURIComponent(encodeURIComponent(`/begeleiding-page/leerling/${id}/Alle%20rollen/${pid || ""}/logboek`));
    window.open(`${location.origin}/op/#/begeleiding/Alle%20rollen/leerling/${id}/////?innerUrl=${binnen}`, "_blank");
    this.melding("De begeleiding van de student opent in een nieuw tabblad, met het plan van aanpak.", "info", 6000);
  },
  async notitieMaken(sn, { omschrijving, tekst, type = "Notitie", bijlage = null }) {
    const K = TardyKern, st = K.S.studenten[sn];
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(sn)).find((x) => x.stamnr === String(sn)); id = hit?.magisterId; if (id) { st.magisterId = id; this.bewaar(); } }
    if (!id) return this.melding("Deze student is niet in Magister gevonden.", "err");
    const pid = await this.persoonId();
    try { localStorage.setItem("dt-cb-notitie", JSON.stringify({ t: Date.now(), magisterId: String(id), naam: K.naamVan(st), omschrijving, tekst, type, bijlage, bron: "de Te laat-balie" })); }
    catch { if (bijlage) { this.melding("De bijlage is te groot om door te geven; download het Word-document en voeg het zelf toe.", "err", 8000); bijlage = null; } }
    const binnen = encodeURIComponent(encodeURIComponent(`/begeleiding-page/leerling/${id}/Alle%20rollen/${pid || ""}/logboek`));
    window.open(`${location.origin}/op/#/begeleiding/Alle%20rollen/leerling/${id}/////?innerUrl=${binnen}`, "_blank");
    this.melding("Het logboek van de student opent in een nieuw tabblad met de notitie al ingevuld. Loop de stappen na en klik op Opslaan.", "info", 7000);
  },

  /* In het logboek-frame (magister-lvs): Toevoegen › Notitie kiezen en het formulier invullen. */
  vulNotitie() { return DTForms.vulLogboek("dt-cb-notitie"); },


  /* Weekrapport: per mentor wat er de afgelopen 7 dagen gebeurde (te laat, ongeoorloofd, niet verschenen bij de
   * meldafspraak), met de stap waar de student nu staat en de aanwezigheid uit Magister. */
  async weekrapport(DT) {
    const K = TardyKern, pid = K.UI.periodeId, van = K.plusDagen(K.vandaag(), -7), groepen = {};
    const alle = this.met18(K.hoogsteTreden(K.alleSignalen(pid)));
    const top = Object.fromEntries(this.perStudent(alle.filter((x) => !x.afgehandeld)).map((x) => [x.stamnr, x]));
    for (const st of Object.values(K.S.studenten).filter((x) => !x.archief)) {
      const regs = K.S.registraties.filter((r) => r.stamnr === st.stamnr && r.datum > van);
      const tl = regs.filter((r) => (K.SOORT[r.soort] || {}).g === "telaat").length, on = regs.filter((r) => (K.SOORT[r.soort] || {}).g === "ongeoorloofd").length;
      const nv = K.S.meldafspraken.filter((m) => m.stamnr === st.stamnr && m.status === "niet-verschenen" && m.datum > van).length;
      const s = top[st.stamnr];
      if (!tl && !on && !nv && !(s && s.niveau >= 3)) continue;
      if (!K.mentorVan(st).email) await this.mentorUitMagister(st).catch(() => {});
      const m = K.mentorVan(st), k = K.mentorSleutel(st) || "zonder-mentor";
      (groepen[k] ||= { mentor: m, regels: [] }).regels.push({ st, tl, on, nv, s, pct: K.S.lesreg[st.stamnr]?.perioden?.[pid]?.pct });
    }
    const mails = Object.values(groepen).map((g) => {
      const mnaam = g.mentor.naam || "collega";
      g.regels.sort((a, b) => (b.s?.niveau || 0) - (a.s?.niveau || 0) || (b.tl + b.on + b.nv) - (a.tl + a.on + a.nv));
      const lijnen = g.regels.map((r) => {
        const week = [r.tl && `${r.tl}× te laat`, r.on && `${r.on}× ongeoorloofd`, r.nv && `${r.nv}× niet verschenen bij de meldafspraak`].filter(Boolean).join(", ");
        return `• ${K.naamVan(r.st)} (${r.st.klas || "—"})${week ? ` — deze week: ${week}` : ""}${r.s ? `\n  Stand: ${r.s.consequentie} (${r.s.titel})` : ""}${r.pct != null ? ` · ${r.pct}% aanwezig` : ""}`;
      }).join("\n");
      return { aan: g.mentor.email || "", type: "mentor-overzicht", naam: `${mnaam} (${g.regels.length})`, stamnrs: g.regels.map((r) => r.st.stamnr),
        onderwerp: `Weekrapport verzuim ${K.kortDatum(K.plusDagen(van, 1))} – ${K.kortDatum(K.vandaag())}: ${g.regels.length} student(en)`,
        body: `Hoi ${mnaam},\n\nHierbij het weekrapport van de afgelopen week voor de studenten waarvan jij mentor bent:\n\n${lijnen}\n\nDe volledige registratie staat in Magister. Vragen of overleggen? Loop gerust even binnen in lokaal ${K.S.instellingen.lokaal || ""}.\n\n${K.ondertekening()}` };
    }).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!mails.length) return this.melding("Deze week is er niets te melden aan mentoren.");
    this.bewaar();
    this.mailLijst(DT, `Weekrapport voor ${mails.length} mentor(en)`, `${K.kortDatum(K.plusDagen(van, 1))} t/m ${K.kortDatum(K.vandaag())} · ${mails.reduce((n, m) => n + m.stamnrs.length, 0)} studenten`, mails);
  },

  /* Zoals "Overzicht per mentor" in Tardy: één mail per mentor met alle studenten waar actie nodig is. */
  mentorOverzicht(DT) {
    const K = TardyKern, pid = K.UI.periodeId, p = K.periodeById(pid), groepen = {};
    Object.values(K.S.studenten).filter((st) => !st.archief).forEach((st) => {
      const t = K.tellingen(st.stamnr, pid), alle = this.met18(K.signalenVoor(st.stamnr, pid)), sig = alle.filter((x) => !x.afgehandeld);
      if (!alle.length) return;
      const m = K.mentorVan(st), k = K.mentorSleutel(st) || "zonder-mentor";
      (groepen[k] ||= { mentor: m, regels: [] }).regels.push({ st, t, sig, reeks: K.langsteReeks(t.ziekDatums).lengte });
    });
    const mails = Object.values(groepen).map((g) => {
      const mnaam = g.mentor.naam || "collega";
      g.regels.sort((a, b) => (b.sig[0]?.niveau || 0) - (a.sig[0]?.niveau || 0) || b.t.teLaat - a.t.teLaat);
      const lijnen = g.regels.map((r) => {
        const d = [];
        if (r.t.teLaat) d.push(`${r.t.teLaat}× te laat`);
        if (r.t.nietGemeld) d.push(`${r.t.nietGemeld}× niet gemeld bij de CB’er`);
        if (r.t.ongeoorloofd) d.push(`${r.t.ongeoorloofd}× ongeoorloofd`);
        if (r.reeks > 1) d.push(`${r.reeks} schooldagen aaneen ziek`);
        if (r.t.medDatums.length) d.push(`${r.t.medDatums.length} medische afspraken onder lestijd`);
        const zw = r.sig.slice().sort((a, b) => b.niveau - a.niveau)[0];
        return `• ${K.naamVan(r.st)} (${r.st.klas || "—"}) — ${d.join(", ") || "aandachtspunt"}${zw ? `\n  Wat er van jou wordt verwacht: ${zw.maatregel}` : ""}`;
      }).join("\n");
      const per = p ? p.naam.toLowerCase() : "deze periode";
      return { aan: g.mentor.email || "", type: "mentor-overzicht", naam: `${mnaam} (${g.regels.length})`, stamnrs: g.regels.map((r) => r.st.stamnr),
        onderwerp: `Verzuimoverzicht ${per} — ${g.regels.length} student(en)`,
        body: `Hoi ${mnaam},\n\nHierbij het verzuimoverzicht van ${per}. Bij ${g.regels.length === 1 ? "één student" : `${g.regels.length} studenten`} waarvan jij mentor bent is actie nodig:\n\n${lijnen}\n\nDe volledige registratie staat in Magister. Loop gerust even binnen in lokaal ${K.S.instellingen.lokaal || ""} als je ergens over wilt sparren.\n\n${K.ondertekening()}` };
    }).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!mails.length) return this.melding("Er is op dit moment niets te melden aan mentoren.");
    this.mailLijst(DT, `Overzicht voor ${mails.length} mentor(en)`, `${p ? p.naam : ""} · ${mails.reduce((n, m) => n + m.stamnrs.length, 0)} studenten`, mails);
  },
});
