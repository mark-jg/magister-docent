/* Lestools: extra tegels op het tabblad Hulpmiddelen van een les (naast Magisters Groepjes, Wie is wie?,
 * Timer en Wie heeft de beurt?). Elke tool opent schermvullend, geschikt voor het digibord.
 *
 *  - Stille safari: geluidsmeter via de microfoon. Wordt het te druk, dan verstoppen de dieren zich achter
 *    de struiken; is het een poosje rustig, dan komen ze één voor één terug. Het geluid blijft in de
 *    browser: er wordt niets opgenomen of verstuurd.
 *  - Kaartenpakje: open een pakje kaarten om de volgende beurt of groepjes bekend te maken. Beurten gaan
 *    zonder herhaling tot iedereen geweest is.
 *  - Lesbord: opdracht, stappen, werkgeluid en een timer op één scherm; per vak en klas onthouden.
 *
 * Leerlingen: de deelnemers van deze les (/api/medewerkers/{id}/afspraken/{id}/deelnemers) en de
 * registraties (/api/medewerkers/afspraken/{id}/verantwoordingen); afwezig, ziek of uitgestuurd doet niet
 * mee. Pasfoto's optioneel, zoals in het leaderboard. */
DT.register({
  id: "lestools",
  _stop: null,
  _scherm: null,
  _beurten: new Map(),   // afspraak-id -> { stapel: [ids], geweest: [ids] }
  _foto: new Map(),

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 300, poll: 1500 });
  },

  destroy() {
    this._stop && this._stop();
    this._scherm?.sluit();
    document.querySelectorAll(".dt-lt-tegel").forEach((el) => el.remove());
    document.getElementById("dt-lt-style")?.remove();
  },

  /* ---------- tegels ---------- */
  TOOLS: [
    { id: "safari", titel: "Stille safari", tekst: "Geluidsmeter: wordt het te druk, dan verstoppen de dieren zich",
      ico: `<path d="M5 25c3-6 7-9 11-9s8 3 11 9" opacity=".35"/><circle cx="12" cy="11" r="2.2"/><circle cx="20" cy="11" r="2.2"/><path d="M9 7.5 7.5 4M23 7.5 24.5 4"/><path d="M10 16.5c1.6 1.4 3.6 2 6 2s4.4-.6 6-2"/>` },
    { id: "pakje", titel: "Kaartenpakje", tekst: "Open een pakje voor de volgende beurt of nieuwe groepjes",
      ico: `<rect x="6" y="6" width="14" height="20" rx="2.5" opacity=".35"/><rect x="12" y="4" width="14" height="20" rx="2.5" transform="rotate(10 19 14)"/><path d="m19 11 1.2 2.5 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z" transform="rotate(10 19 14)"/>` },
    { id: "bord", titel: "Lesbord", tekst: "Opdracht, stappen, werkgeluid en timer op één scherm",
      ico: `<rect x="4" y="5" width="24" height="17" rx="2.5" opacity=".35"/><path d="M9 11h9M9 15h6"/><circle cx="22.5" cy="14" r="3.2"/><path d="M22.5 12.4V14l1 .8M16 22v4M11 26h10"/>` },
  ],

  mount(DT) {
    const grid = document.querySelector("ld-hulpmiddelen .hulpmiddelen-grid");
    if (!grid) { if (this._scherm && !/\/hulpmiddelen/.test(location.hash)) this._scherm.sluit(); return; }
    /* De kaarten worden in de extensie gemaakt, vaak voordat Magisters dna-link-card klaar is; dan negeert
     * de kaart het heading-attribuut en toont "Heading". Opnieuw zetten laat de kaart het alsnog oppakken. */
    for (const c of grid.querySelectorAll(".dt-lt-tegel")) {
      const h = c.getAttribute("heading"), h1 = c.shadowRoot?.querySelector("h1");
      if (h1 && h1.textContent.trim() !== h) { c.removeAttribute("heading"); c.setAttribute("heading", h); }
    }
    if (grid.querySelector(".dt-lt-tegel")) return;
    this.css();
    for (const t of this.TOOLS) {
      const c = document.createElement("dna-link-card");
      c.className = "dt-lt-tegel"; c.setAttribute("heading", t.titel);
      c.setAttribute("tabindex", "0"); c.setAttribute("role", "button");
      const oms = document.createElement("div"); oms.slot = "description"; oms.textContent = t.tekst;
      const ico = document.createElement("span"); ico.slot = "icon"; ico.className = "dt-lt-ico";
      ico.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t.ico}</svg>`;
      c.append(oms, ico);
      const open = (e) => { e.preventDefault(); e.stopPropagation(); this.open(DT, t.id); };
      /* In de vangfase: de kaart zelf handelt klikken in haar schaduw-DOM af. */
      c.addEventListener("click", open, true);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
      grid.append(c);
    }
  },

  /* ---------- leerlingen van deze les ---------- */
  async leerlingen(DT) {
    const afspraak = (location.hash.match(/afspraak\/(\d+)/) || [])[1];
    if (!afspraak) return { fout: "Open eerst een les." };
    let du = await DT.apiFind(`/afspraken/${afspraak}/deelnemers\\?type=leerling`);
    if (!du) {
      const iets = await DT.apiFind(`/api/medewerkers/\\d+/afspraken/${afspraak}`);
      const mid = iets && (iets.match(/medewerkers\/(\d+)\//) || [])[1];
      if (mid) du = `/api/medewerkers/${mid}/afspraken/${afspraak}/deelnemers?type=leerling`;
    }
    if (!du) return { fout: "De leerlingen van deze les zijn nog niet geladen. Open even de leerlinglijst en probeer het opnieuw." };
    const vu = await DT.apiFind(`/medewerkers/afspraken/${afspraak}/verantwoordingen`) || `/api/medewerkers/afspraken/${afspraak}/verantwoordingen`;
    const [d, v] = await Promise.all([DT.api(du, { full: true, timeout: 15000 }), DT.api(vu, { full: true, timeout: 15000 })]);
    const items = d.status === 200 && d.json ? (Array.isArray(d.json) ? d.json : d.json.items || []) : null;
    if (!items) return { fout: `De leerlingen ophalen lukte niet (Magister antwoordde ${d.status}).` };
    const weg = new Set();
    for (const it of (v.status === 200 && v.json ? (Array.isArray(v.json) ? v.json : v.json.items || []) : [])) {
      const types = (it.verantwoordingen || []).map((x) => String(x.reden?.type || x.reden?.code || "").toLowerCase());
      if (types.some((t) => /^(absent|ab|ziek|zk|uitgestuurd|ui)$/.test(t))) weg.add(String(it.persoonId));
    }
    const lln = items.map((x) => ({
      id: String(x.id), voornaam: x.roepnaam || x.voorletters || "", achternaam: [x.tussenvoegsel, x.achternaam].filter(Boolean).join(" "),
      init: ((x.roepnaam || "")[0] || "") + ((x.achternaam || "")[0] || ""), weg: weg.has(String(x.id)),
    })).filter((x) => x.id !== "undefined");
    /* Dubbele voornamen: eerste letter van de achternaam erbij. */
    const tel = {}; for (const l of lln) tel[l.voornaam] = (tel[l.voornaam] || 0) + 1;
    for (const l of lln) l.naam = tel[l.voornaam] > 1 && l.achternaam ? `${l.voornaam} ${l.achternaam.split(" ").pop()[0]}.` : l.voornaam;
    const titel = document.querySelector("ld-hulpmiddelen .head-bar h1, ui-view[name=main] > .head-bar h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
    return { afspraak, lln, titel };
  },

  /* ---------- gedeelde schermschil ---------- */
  open(DT, tool) {
    if (this._scherm) return;
    this.css();
    const laag = DT.el("div", { class: `dt-lt dt-lt-tool-${tool}`, role: "dialog", "aria-modal": "true" });
    const knoppen = DT.el("div", { class: "dt-lt-knoppen" });
    const vol = DT.el("button", { type: "button", class: "dt-lt-knop", title: "Volledig scherm", "aria-label": "Volledig scherm",
      html: `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` });
    const dicht = DT.el("button", { type: "button", class: "dt-lt-knop", title: "Sluiten (Esc)", "aria-label": "Sluiten",
      html: `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` });
    const extra = DT.el("div", { class: "dt-lt-extra" });
    knoppen.append(extra, vol, dicht);
    const inhoud = DT.el("div", { class: "dt-lt-inhoud" });
    laag.append(inhoud, knoppen);
    let opruimen = [];
    const toets = (e) => { if (e.key === "Escape" && !document.fullscreenElement && !e.target.closest?.("[contenteditable=true]")) { e.preventDefault(); this._scherm?.sluit(); } };
    this._scherm = {
      laag, inhoud, extra,
      bijSluiten: (fn) => opruimen.push(fn),
      sluit: () => {
        for (const fn of opruimen) { try { fn(); } catch {} }
        opruimen = [];
        document.removeEventListener("keydown", toets, true);
        if (document.fullscreenElement === laag) document.exitFullscreen().catch(() => {});
        laag.remove(); this._scherm = null;
      },
    };
    vol.addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else laag.requestFullscreen?.().catch(() => {}); });
    dicht.addEventListener("click", () => this._scherm?.sluit());
    document.addEventListener("keydown", toets, true);
    document.body.append(laag);
    ({ safari: () => this.safari(DT), pakje: () => this.pakje(DT), bord: () => this.lesbord(DT) })[tool]();
  },

  melding(tekst) {
    this._scherm?.inhoud.replaceChildren(DT.el("div", { class: "dt-lt-melding" }, DT.el("p", { text: tekst })));
  },

  /* ---------- foto's (zelfde voorkeur als het leaderboard) ---------- */
  fotosAan() { try { return localStorage.getItem("dt-lb-fotos") === "1"; } catch { return false; } },
  fotoKnop(DT, opnieuw) {
    const b = DT.el("button", { type: "button", class: "dt-lt-pil", "aria-pressed": String(this.fotosAan()), text: "Foto's",
      title: "Pasfoto's uit Magister tonen. Houd je aan de afspraken van je school over beeldmateriaal." });
    b.addEventListener("click", () => {
      const aan = !this.fotosAan();
      try { localStorage.setItem("dt-lb-fotos", aan ? "1" : "0"); } catch {}
      b.setAttribute("aria-pressed", String(aan)); opnieuw();
    });
    return b;
  },
  async fotos(DT, lln) {
    if (!this.fotosAan()) return;
    for (const l of lln) {
      if (this._foto.has(l.id)) continue;
      const r = await DT.api(`/api/leerlingen/${encodeURIComponent(l.id)}/foto?redirect_type=body`, { blob: true, timeout: 10000 });
      if (r.status) this._foto.set(l.id, r.data || null);
    }
  },
  gezicht(DT, l, cls = "dt-lt-gezicht") {
    const url = this.fotosAan() ? this._foto.get(l.id) : null;
    const a = DT.el("span", { class: cls, text: url ? "" : l.init });
    if (url) a.append(DT.el("img", { src: url, alt: "" }));
    return a;
  },

  /* ===================================================================================== */
  /* Stille safari                                                                          */
  /* ===================================================================================== */
  DIEREN: ["🦁", "🦒", "🐘", "🦓", "🦛", "🐒", "🦏"],
  NIVEAUS: [{ naam: "Stil", drempel: 30 }, { naam: "Fluisteren", drempel: 46 }, { naam: "Overleggen", drempel: 62 }],

  async safari(DT) {
    const s = this._scherm, rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let niveau = 1; try { niveau = Math.min(2, Math.max(0, +localStorage.getItem("dt-lt-safari-niveau") || 1)); } catch {}
    let drempel = this.NIVEAUS[niveau].drempel;
    /* Bediening: niveau en fijnafstelling */
    const seg = DT.el("div", { class: "dt-lt-seg", role: "radiogroup", "aria-label": "Werkgeluid" });
    const schuif = DT.el("input", { type: "range", min: "10", max: "90", value: String(drempel), "aria-label": "Gevoeligheid", title: "Hoe hard mag het zijn?" });
    const zetNiveau = (i) => {
      niveau = i; drempel = this.NIVEAUS[i].drempel; schuif.value = String(drempel);
      try { localStorage.setItem("dt-lt-safari-niveau", String(i)); } catch {}
      [...seg.children].forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
      teken();
    };
    this.NIVEAUS.forEach((n, i) => { const b = DT.el("button", { type: "button", role: "radio", text: n.naam }); b.addEventListener("click", () => zetNiveau(i)); seg.append(b); });
    schuif.addEventListener("input", () => { drempel = +schuif.value; teken(); });
    s.extra.append(seg, DT.el("label", { class: "dt-lt-schuif" }, [DT.el("span", { text: "Gevoeligheid" }), schuif]));

    /* Landschap */
    const N = 6;
    const dieren = this.DIEREN.slice().sort(() => Math.random() - .5).slice(0, N);
    const slots = dieren.map((d, i) => {
      const dier = DT.el("span", { class: "dt-lt-dier" }, DT.el("span", { text: d, style: `animation-delay:${(i * .37).toFixed(2)}s` }));
      const slot = DT.el("div", { class: "dt-lt-slot", style: `--i:${i}` }, [dier, DT.el("span", { class: "dt-lt-roep", text: "!" }), DT.el("span", { class: "dt-lt-struik" })]);
      return { slot, verstopt: false };
    });
    const meterVul = DT.el("i"), meterLijn = DT.el("b");
    const telling = DT.el("span", { class: "dt-lt-telling" }), stilTijd = DT.el("span", { class: "dt-lt-stiltijd" });
    s.inhoud.append(
      DT.el("div", { class: "dt-lt-lucht", "aria-hidden": "true" }, [DT.el("span", { class: "dt-lt-zon" }), DT.el("span", { class: "dt-lt-wolk w1" }), DT.el("span", { class: "dt-lt-wolk w2" })]),
      DT.el("div", { class: "dt-lt-heuvels", "aria-hidden": "true", html: `<svg viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="M0 230c180-60 330-70 520-30s360 40 520-10 360-50 560 10v200H0z" fill="#E7B66B"/><path d="M0 300c220-50 420-40 640-5s420 30 620-10 260-20 340-5v120H0z" fill="#D9A148"/></svg>
        <svg class="dt-lt-boom b1" viewBox="0 0 200 160"><path d="M98 160V86M98 98 70 76M98 92l30-20" stroke="#5B3E22" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="62" rx="96" ry="22" fill="#4E6B2C"/><ellipse cx="72" cy="52" rx="48" ry="14" fill="#5E7E34"/><ellipse cx="130" cy="54" rx="52" ry="15" fill="#5E7E34"/></svg>
        <svg class="dt-lt-boom b2" viewBox="0 0 200 160"><path d="M98 160V86M98 98 70 76M98 92l30-20" stroke="#5B3E22" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="62" rx="96" ry="22" fill="#4E6B2C"/><ellipse cx="72" cy="52" rx="48" ry="14" fill="#5E7E34"/><ellipse cx="130" cy="54" rx="52" ry="15" fill="#5E7E34"/></svg>` }),
      DT.el("div", { class: "dt-lt-savanne" }, slots.map((x) => x.slot)),
      DT.el("div", { class: "dt-lt-status" }, [telling, stilTijd]),
      DT.el("div", { class: "dt-lt-meter", "aria-hidden": "true" }, [DT.el("span", { text: "🔈" }), DT.el("div", { class: "dt-lt-meterbalk" }, [meterVul, meterLijn]), DT.el("span", { text: "🔊" })]),
    );
    const teken = () => {
      const zicht = slots.filter((x) => !x.verstopt).length;
      telling.textContent = zicht === N ? "Alle dieren durven te kijken" : zicht === 0 ? "Sssst… alle dieren zijn verstopt" : `${zicht} van de ${N} dieren durven te kijken`;
      meterLijn.style.left = `${drempel}%`;
    };
    zetNiveau(niveau);

    /* Microfoon */
    let stream, ctx;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      telling.textContent = "Geen toegang tot de microfoon. Sta de microfoon toe voor magister.net (slotje in de adresbalk) en open de safari opnieuw.";
      return;
    }
    if (!this._scherm || this._scherm !== s) { stream.getTracks().forEach((t) => t.stop()); return; }
    ctx = new AudioContext();
    const bron = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
    an.fftSize = 2048; bron.connect(an);
    const buf = new Float32Array(an.fftSize);
    let niv = 0, boven = 0, onder = 0, laatsteActie = 0, stil = 0, vorige = performance.now(), raf = 0;
    const stap = (t) => {
      const dt = Math.min(.1, (t - vorige) / 1000); vorige = t;
      an.getFloatTimeDomainData(buf);
      let som = 0; for (let i = 0; i < buf.length; i++) som += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(som / buf.length) + 1e-9);
      const nu = Math.max(0, Math.min(100, (db + 62) / 52 * 100));
      niv = nu > niv ? niv * .6 + nu * .4 : niv * .92 + nu * .08;   // snel omhoog, rustig omlaag
      meterVul.style.width = `${niv.toFixed(1)}%`;
      meterVul.className = niv > drempel ? "is-hard" : niv > drempel * .8 ? "is-bijna" : "";
      laatsteActie += dt;
      if (niv > drempel) {
        boven += dt; onder = 0;
        const tempo = niv > drempel + 15 ? .25 : .6;
        if (boven > .35 && laatsteActie > tempo) {
          const zicht = slots.filter((x) => !x.verstopt);
          if (zicht.length) {
            const x = zicht[Math.floor(Math.random() * zicht.length)];
            x.verstopt = true; x.slot.classList.add("is-weg", "is-schrik");
            setTimeout(() => x.slot.classList.remove("is-schrik"), 700);
            laatsteActie = 0; teken();
          }
        }
      } else {
        onder += dt; boven = 0; stil += dt;
        if (onder > 3 && laatsteActie > 1.4) {
          const weg = slots.filter((x) => x.verstopt);
          if (weg.length) { const x = weg[Math.floor(Math.random() * weg.length)]; x.verstopt = false; x.slot.classList.remove("is-weg"); laatsteActie = 0; teken(); }
        }
      }
      const m = Math.floor(stil / 60), sec = Math.floor(stil % 60);
      stilTijd.textContent = `Rustig: ${m}:${String(sec).padStart(2, "0")}`;
      raf = requestAnimationFrame(stap);
    };
    raf = requestAnimationFrame(stap);
    if (rustig) s.laag.classList.add("is-rustig");
    s.bijSluiten(() => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); });
  },

  /* ===================================================================================== */
  /* Kaartenpakje                                                                           */
  /* ===================================================================================== */
  TEAMS: [["Leeuwen", "🦁", "#FF9F0A"], ["Zebra's", "🦓", "#8E8E93"], ["Giraffen", "🦒", "#FFCC00"], ["Olifanten", "🐘", "#64D2FF"], ["Flamingo's", "🦩", "#FF6482"],
    ["Pinguïns", "🐧", "#5E5CE6"], ["Vossen", "🦊", "#FF6B2C"], ["Uilen", "🦉", "#AC8E68"], ["Dolfijnen", "🐬", "#0A84FF"], ["Kikkers", "🐸", "#30D158"],
    ["Pandas", "🐼", "#D1D1D6"], ["Tijgers", "🐯", "#FF9500"], ["Koala's", "🐨", "#98989D"], ["Haaien", "🦈", "#409CFF"], ["Papegaaien", "🦜", "#34C759"]],

  async pakje(DT) {
    const s = this._scherm;
    this.melding("Leerlingen ophalen…");
    const res = await this.leerlingen(DT);
    if (this._scherm !== s) return;
    if (res.fout) return this.melding(res.fout);
    let modus = "beurt", grootte = 3, alleenAanwezig = true;
    try { modus = localStorage.getItem("dt-lt-pakje-modus") || "beurt"; grootte = +localStorage.getItem("dt-lt-pakje-grootte") || 3; } catch {}
    const deelnemers = () => res.lln.filter((l) => !alleenAanwezig || !l.weg);

    const seg = DT.el("div", { class: "dt-lt-seg", role: "radiogroup", "aria-label": "Wat wil je trekken?" });
    for (const [k, t] of [["beurt", "Volgende beurt"], ["groepjes", "Groepjes"]]) {
      const b = DT.el("button", { type: "button", role: "radio", "data-k": k, text: t });
      b.addEventListener("click", () => { modus = k; try { localStorage.setItem("dt-lt-pakje-modus", k); } catch {} bouw(); });
      seg.append(b);
    }
    const maat = DT.el("label", { class: "dt-lt-maat" }, [DT.el("span", { text: "Per groepje" })]);
    const maatSel = DT.el("select", {}, [2, 3, 4, 5, 6].map((n) => DT.el("option", { value: String(n), text: String(n) })));
    maatSel.value = String(grootte);
    maatSel.addEventListener("change", () => { grootte = +maatSel.value; try { localStorage.setItem("dt-lt-pakje-grootte", maatSel.value); } catch {} bouw(); });
    maat.append(maatSel);
    const aanw = DT.el("button", { type: "button", class: "dt-lt-pil", "aria-pressed": "true", text: "Alleen aanwezigen", title: "Afwezige, zieke en uitgestuurde leerlingen doen niet mee" });
    aanw.addEventListener("click", () => { alleenAanwezig = !alleenAanwezig; aanw.setAttribute("aria-pressed", String(alleenAanwezig)); bouw(); });
    s.extra.append(seg, maat, aanw, this.fotoKnop(DT, () => this.fotos(DT, res.lln).then(() => bouw())));
    await this.fotos(DT, res.lln);
    if (this._scherm !== s) return;

    /* Beurten zonder herhaling, per les onthouden zolang Magister openstaat. */
    const beurten = () => {
      let b = this._beurten.get(res.afspraak);
      if (!b) { b = { geweest: [] }; this._beurten.set(res.afspraak, b); }
      return b;
    };
    const klas = (res.titel.match(/\s-\s([^(]+?)\s*\(/) || [])[1] || "";
    let toets = null;

    const bouw = () => {
      [...seg.children].forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === modus)));
      maat.hidden = modus !== "groepjes";
      const lijst = deelnemers();
      const podium = DT.el("div", { class: "dt-lt-tafel" });
      const onder = DT.el("div", { class: "dt-lt-onder" });
      s.inhoud.replaceChildren(DT.el("div", { class: "dt-lt-spot", "aria-hidden": "true" }), podium, onder);
      if (!lijst.length) { podium.append(DT.el("p", { class: "dt-lt-leeg", text: "Er doen geen leerlingen mee." })); return; }
      const pak = this.maakPakje(DT, modus === "beurt" ? "Volgende beurt" : `Groepjes van ${grootte}`, klas);
      podium.append(pak);
      const hint = DT.el("p", { class: "dt-lt-hint", text: "Klik op het pakje of druk op de spatiebalk" });
      onder.append(hint);
      let open = false;
      const openen = () => {
        if (open) return; open = true; hint.remove();
        if (modus === "beurt") {
          const b = beurten();
          const ids = new Set(lijst.map((l) => l.id));
          b.geweest = b.geweest.filter((id) => ids.has(id));
          let pot = lijst.filter((l) => !b.geweest.includes(l.id));
          if (!pot.length) { b.geweest = []; pot = lijst.slice(); }
          const wie = pot[Math.floor(Math.random() * pot.length)];
          b.geweest.push(wie.id);
          this.scheur(pak, () => {
            const kaart = this.kaart(DT, wie, { groot: true });
            podium.append(kaart);
            requestAnimationFrame(() => kaart.classList.add("is-uit"));
            setTimeout(() => this.vonken(DT, podium), 650);
            const rest = lijst.length - b.geweest.length;
            const volgende = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: rest ? "Volgende beurt" : "Iedereen is geweest · opnieuw" });
            volgende.addEventListener("click", bouw);
            onder.append(
              DT.el("p", { class: "dt-lt-stand", text: rest ? `Nog ${rest} ${rest === 1 ? "leerling" : "leerlingen"} in de stapel` : "Iedereen heeft een beurt gehad" }),
              volgende);
            setTimeout(() => volgende.focus(), 900);
          });
        } else {
          const groepen = this.verdeel(lijst, grootte);
          const teams = this.TEAMS.slice().sort(() => Math.random() - .5);
          this.scheur(pak, () => {
            pak.remove();
            const veld = DT.el("div", { class: "dt-lt-groepen", style: `--n:${groepen.length}` });
            podium.replaceWith(veld);
            let k = 0;
            groepen.forEach((g, gi) => {
              const [naam, emoji, kleur] = teams[gi % teams.length];
              const vak = DT.el("section", { class: "dt-lt-groep", style: `--kleur:${kleur};animation-delay:${gi * 90}ms` }, [
                DT.el("h3", {}, [DT.el("span", { class: "dt-lt-teamemoji", text: emoji }), DT.el("span", { text: naam })]),
                DT.el("div", { class: "dt-lt-groepkaarten" }, g.map((l) => { const c = this.kaart(DT, l); c.style.setProperty("--d", `${400 + (k++) * 140}ms`); return c; })),
              ]);
              veld.append(vak);
            });
            requestAnimationFrame(() => veld.querySelectorAll(".dt-lt-kaart").forEach((c) => c.classList.add("is-uit")));
            const opnieuw = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: "Nieuwe groepjes" });
            opnieuw.addEventListener("click", bouw);
            onder.append(DT.el("p", { class: "dt-lt-stand", text: `${lijst.length} leerlingen in ${groepen.length} groepjes` }), opnieuw);
          });
        }
      };
      pak.addEventListener("click", openen);
      if (toets) document.removeEventListener("keydown", toets);
      toets = (e) => {
        if (e.key !== " " || e.target.closest?.("select, input, textarea, [contenteditable=true]")) return;
        e.preventDefault();
        if (!open) openen(); else s.inhoud.querySelector(".dt-lt-hoofdknop")?.click();
      };
      document.addEventListener("keydown", toets);
    };
    s.bijSluiten(() => toets && document.removeEventListener("keydown", toets));
    bouw();
  },

  /* Gelijk verdelen: aantal groepjes zo dicht mogelijk bij de gekozen grootte; verschil hooguit 1. */
  verdeel(lijst, grootte) {
    const pot = lijst.slice().sort(() => Math.random() - .5);
    const n = Math.max(1, Math.round(pot.length / grootte));
    const groepen = Array.from({ length: n }, () => []);
    pot.forEach((l, i) => groepen[i % n].push(l));
    return groepen;
  },

  maakPakje(DT, label, klas) {
    return DT.el("button", { type: "button", class: "dt-lt-pakje", "aria-label": `${label}: pakje openen` }, [
      DT.el("span", { class: "dt-lt-flap" }),
      DT.el("span", { class: "dt-lt-folie" }, [
        DT.el("span", { class: "dt-lt-pakster", text: "★" }),
        DT.el("span", { class: "dt-lt-paklabel", text: label }),
        DT.el("span", { class: "dt-lt-pakklas", text: klas }),
      ]),
    ]);
  },

  scheur(pak, daarna) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { pak.classList.add("is-open"); daarna(); return; }
    pak.classList.add("is-schud");
    setTimeout(() => { pak.classList.remove("is-schud"); pak.classList.add("is-open"); }, 650);
    setTimeout(daarna, 950);
  },

  kaart(DT, l, { groot = false } = {}) {
    return DT.el("div", { class: `dt-lt-kaart${groot ? " is-groot" : ""}` }, DT.el("div", { class: "dt-lt-kaartbinnen" }, [
      DT.el("div", { class: "dt-lt-kaartachter" }, DT.el("span", { text: "★" })),
      DT.el("div", { class: "dt-lt-kaartvoor" }, [this.gezicht(DT, l), DT.el("span", { class: "dt-lt-kaartnaam", text: l.naam })]),
    ]));
  },

  vonken(DT, waar) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const laag = DT.el("div", { class: "dt-lt-vonken", "aria-hidden": "true" });
    const kleur = ["#FFD54A", "#FF6482", "#64D2FF", "#30D158", "#BF5AF2", "#FFFFFF"];
    for (let i = 0; i < 40; i++) {
      const h = Math.random() * Math.PI * 2, k = 120 + Math.random() * 220;
      const e = DT.el("i");
      e.style.cssText = `--x:${Math.round(Math.cos(h) * k)}px;--y:${Math.round(Math.sin(h) * k)}px;background:${kleur[i % kleur.length]};animation-delay:${Math.round(Math.random() * 120)}ms`;
      laag.append(e);
    }
    waar.append(laag);
    setTimeout(() => laag.remove(), 1600);
  },

  /* ===================================================================================== */
  /* Lesbord                                                                                */
  /* ===================================================================================== */
  GELUID: [["stil", "Stil", "🤫", "Je werkt alleen en zegt niets"], ["fluister", "Fluisteren", "🗣️", "Alleen je buurman of buurvrouw hoort je"], ["overleg", "Overleggen", "💬", "Praten met je groepje, op normale toon"]],

  lesbord(DT) {
    const s = this._scherm;
    const titel = document.querySelector("ld-hulpmiddelen .head-bar h1, ui-view[name=main] > .head-bar h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
    const vakKlas = (titel.match(/\s([A-Z0-9][^\s]*\s-\s[^(]+?)\s*\(/) || [])[1] || titel || "les";
    const sleutel = `dt-lt-bord:${vakKlas}`;
    let data = { opdracht: "Waar werk je aan?", stappen: ["Lees de opdracht", "Werk de stappen uit", "Laat je werk zien"], klaar: "Klaar? Help een klasgenoot of kijk je werk na.", geluid: "fluister", minuten: 10 };
    try { Object.assign(data, JSON.parse(localStorage.getItem(sleutel) || "{}")); } catch {}
    const bewaar = () => { try { localStorage.setItem(sleutel, JSON.stringify(data)); } catch {} };

    const bewerk = DT.el("button", { type: "button", class: "dt-lt-pil", "aria-pressed": "false", text: "Bewerken" });
    s.extra.append(DT.el("span", { class: "dt-lt-vakklas", text: vakKlas }), bewerk);

    const h1 = DT.el("h1", { class: "dt-lt-opdracht", text: data.opdracht });
    const ol = DT.el("ol", { class: "dt-lt-stappen" });
    const klaar = DT.el("p", { class: "dt-lt-klaar", text: data.klaar });
    const tekenStappen = () => ol.replaceChildren(...data.stappen.map((t) => DT.el("li", { text: t })));
    tekenStappen();
    const velden = () => [h1, klaar, ...ol.children];
    const leesIn = () => {
      data.opdracht = h1.textContent.trim() || "Opdracht";
      data.stappen = [...ol.children].map((li) => li.textContent.trim()).filter(Boolean);
      data.klaar = klaar.textContent.trim();
      bewaar();
    };
    let bewerken = false;
    const zetBewerken = (aan) => {
      bewerken = aan; bewerk.setAttribute("aria-pressed", String(aan)); bewerk.textContent = aan ? "Klaar met bewerken" : "Bewerken";
      s.laag.classList.toggle("is-bewerken", aan);
      if (!aan) { leesIn(); tekenStappen(); if (!data.stappen.length) { data.stappen = ["Nieuwe stap"]; tekenStappen(); } }
      for (const el of velden()) el.contentEditable = aan ? "true" : "false";
      if (aan) h1.focus();
    };
    bewerk.addEventListener("click", () => zetBewerken(!bewerken));
    ol.addEventListener("keydown", (e) => {
      if (!bewerken) return;
      const li = e.target.closest("li"); if (!li) return;
      if (e.key === "Enter") { e.preventDefault(); const n = DT.el("li", { contenteditable: "true" }); li.after(n); n.focus(); }
      if (e.key === "Backspace" && !li.textContent && ol.children.length > 1) { e.preventDefault(); const p = li.previousElementSibling || li.nextElementSibling; li.remove(); p?.focus(); }
    });
    s.laag.addEventListener("input", () => bewerken && leesIn());

    /* Werkgeluid */
    const geluid = DT.el("div", { class: "dt-lt-geluid", role: "radiogroup", "aria-label": "Werkgeluid" });
    const tekenGeluid = () => [...geluid.children].forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === data.geluid)));
    for (const [k, naam, emoji, uitleg] of this.GELUID) {
      const b = DT.el("button", { type: "button", role: "radio", "data-k": k }, [DT.el("span", { class: "dt-lt-gemoji", text: emoji }), DT.el("b", { text: naam }), DT.el("small", { text: uitleg })]);
      b.addEventListener("click", () => { data.geluid = k; bewaar(); tekenGeluid(); });
      geluid.append(b);
    }
    tekenGeluid();

    /* Timer */
    const R = 54, OMTREK = 2 * Math.PI * R;
    const ring = DT.el("div", { class: "dt-lt-ring", html: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" class="spoor"/><circle cx="60" cy="60" r="${R}" class="voortgang" stroke-dasharray="${OMTREK}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>` });
    const tijd = DT.el("span", { class: "dt-lt-tijd", role: "timer", "aria-live": "off" });
    ring.append(tijd);
    const voortgang = ring.querySelector(".voortgang");
    const presets = DT.el("div", { class: "dt-lt-presets" });
    const start = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: "Start" });
    const reset = DT.el("button", { type: "button", class: "dt-lt-pil", text: "Opnieuw" });
    let totaal = data.minuten * 60, over = totaal, loopt = false, eind = 0, raf = 0, gepiept = false;
    const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
    const tekenTijd = () => {
      tijd.textContent = fmt(Math.ceil(over));
      voortgang.setAttribute("stroke-dashoffset", String(OMTREK * (1 - over / totaal)));
      ring.classList.toggle("is-bijna", over <= 60 && over > 0);
      ring.classList.toggle("is-op", over <= 0);
    };
    const tik = () => {
      over = Math.max(0, (eind - performance.now()) / 1000);
      tekenTijd();
      if (over <= 0) { loopt = false; start.textContent = "Start"; if (!gepiept) { gepiept = true; this.piep(); } return; }
      raf = requestAnimationFrame(tik);
    };
    const zetMinuten = (m) => {
      cancelAnimationFrame(raf); loopt = false; gepiept = false; start.textContent = "Start";
      data.minuten = m; bewaar(); totaal = over = m * 60; tekenTijd();
      [...presets.children].forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.m === m)));
    };
    for (const m of [3, 5, 10, 15, 20, 30]) {
      const b = DT.el("button", { type: "button", "data-m": String(m), text: `${m}` });
      b.addEventListener("click", () => zetMinuten(m)); presets.append(b);
    }
    start.addEventListener("click", () => {
      if (loopt) { loopt = false; cancelAnimationFrame(raf); start.textContent = "Verder"; return; }
      if (over <= 0) { over = totaal; gepiept = false; }
      loopt = true; eind = performance.now() + over * 1000; start.textContent = "Pauze"; raf = requestAnimationFrame(tik);
    });
    reset.addEventListener("click", () => zetMinuten(data.minuten));
    zetMinuten(data.minuten);
    s.bijSluiten(() => { cancelAnimationFrame(raf); if (bewerken) leesIn(); });

    s.inhoud.append(DT.el("div", { class: "dt-lt-bordraster" }, [
      DT.el("section", { class: "dt-lt-paneel dt-lt-taak" }, [DT.el("span", { class: "dt-lt-kopje", text: "Opdracht" }), h1, ol, klaar]),
      DT.el("div", { class: "dt-lt-zij" }, [
        DT.el("section", { class: "dt-lt-paneel" }, [DT.el("span", { class: "dt-lt-kopje", text: "Werkgeluid" }), geluid]),
        DT.el("section", { class: "dt-lt-paneel dt-lt-timer" }, [DT.el("span", { class: "dt-lt-kopje", text: "Tijd" }), ring, presets, DT.el("div", { class: "dt-lt-timerknoppen" }, [reset, start])]),
      ]),
    ]));
  },

  /* Zacht belletje als de tijd om is. */
  piep() {
    try {
      const ctx = new AudioContext();
      [0, .22, .44].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = [880, 1108.7, 1318.5][i];
        g.gain.setValueAtTime(0, ctx.currentTime + t);
        g.gain.linearRampToValueAtTime(.18, ctx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + 1.2);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 1.3);
      });
      setTimeout(() => ctx.close().catch(() => {}), 2500);
    } catch {}
  },

  /* ---------- opmaak ---------- */
  css() {
    if (document.getElementById("dt-lt-style")) return;
    const st = document.createElement("style"); st.id = "dt-lt-style";
    st.textContent = `
      .dt-lt-ico { display: inline-grid; place-items: center; inline-size: 3.75rem; block-size: 3.75rem; border-radius: 16px; background: color-mix(in srgb, var(--dt-accent) 13%, transparent); color: var(--dt-accent); }
      .dt-lt-ico svg { width: 2.1rem; height: 2.1rem; }
      .dt-lt-tegel { cursor: pointer; }

      .dt-lt { position: fixed; inset: 0; z-index: 2147482000; overflow: hidden; color: #fff; font-family: var(--dt-font); -webkit-font-smoothing: antialiased;
        background: radial-gradient(120% 90% at 50% 0%, #2A3F8F 0%, #141B3D 55%, #0A0E22 100%); }
      .dt-lt-inhoud { position: absolute; inset: 0; }
      .dt-lt-knoppen { position: absolute; top: 16px; right: 16px; left: 16px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; z-index: 5; pointer-events: none; }
      .dt-lt-knoppen > * { pointer-events: auto; }
      .dt-lt-extra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-right: auto; }
      .dt-lt-knop { appearance: none; border: 0; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #fff; background: rgba(255,255,255,.16);
        -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
      .dt-lt-knop:hover, .dt-lt-pil:hover { background: rgba(255,255,255,.26); }
      .dt-lt button:focus-visible, .dt-lt select:focus-visible, .dt-lt input:focus-visible { outline: 2px solid #FFD54A; outline-offset: 2px; }
      .dt-lt-pil { appearance: none; border: 0; height: 34px; padding: 0 16px; border-radius: 999px; font: 600 13px/1 var(--dt-font); color: #fff; background: rgba(255,255,255,.16); cursor: pointer;
        -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
      .dt-lt-pil[aria-pressed="true"] { background: #fff; color: #141B3D; }
      .dt-lt-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: rgba(0,0,0,.28); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
      .dt-lt-seg button { appearance: none; border: 0; height: 28px; padding: 0 14px; border-radius: 999px; font: 600 13px/1 var(--dt-font); color: rgba(255,255,255,.85); background: transparent; cursor: pointer; }
      .dt-lt-seg button[aria-checked="true"] { background: #fff; color: #141B3D; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
      .dt-lt-schuif, .dt-lt-maat { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px; border-radius: 999px; background: rgba(0,0,0,.28); font: 600 13px/1 var(--dt-font);
        -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
      .dt-lt-schuif input { width: 120px; accent-color: #FFD54A; }
      .dt-lt-maat select { appearance: none; border: 0; border-radius: 999px; height: 24px; padding: 0 10px; font: 700 13px/1 var(--dt-font); background: #fff; color: #141B3D; cursor: pointer; }
      .dt-lt-maat[hidden] { display: none; }
      .dt-lt-melding { position: absolute; inset: 0; display: grid; place-items: center; padding: 10vh 10vw; text-align: center; font-size: clamp(18px, 2vw, 30px); font-weight: 600; }
      .dt-lt-hoofdknop { appearance: none; border: 0; height: 52px; padding: 0 30px; border-radius: 999px; font: 700 18px/1 var(--dt-font); color: #141B3D; background: linear-gradient(180deg, #FFE27A, #FFC93C);
        box-shadow: 0 8px 24px rgba(255,201,60,.35), inset 0 1px 0 rgba(255,255,255,.6); cursor: pointer; }
      .dt-lt-hoofdknop:hover { filter: brightness(1.04); }

      /* --- Stille safari --- */
      .dt-lt-tool-safari { background: linear-gradient(180deg, #7EC8F5 0%, #BFE3F2 38%, #FFE2B0 62%, #F6C27A 100%); color: #3B2A12; }
      .dt-lt-tool-safari .dt-lt-knop, .dt-lt-tool-safari .dt-lt-pil { color: #3B2A12; background: rgba(255,255,255,.55); }
      .dt-lt-tool-safari .dt-lt-seg, .dt-lt-tool-safari .dt-lt-schuif { background: rgba(255,255,255,.5); color: #3B2A12; }
      .dt-lt-tool-safari .dt-lt-seg button { color: #3B2A12; }
      .dt-lt-tool-safari .dt-lt-seg button[aria-checked="true"] { background: #3B2A12; color: #fff; }
      .dt-lt-lucht { position: absolute; inset: 0 0 40% 0; pointer-events: none; }
      .dt-lt-zon { position: absolute; top: 9vh; right: 14vw; width: 13vh; height: 13vh; border-radius: 50%; background: radial-gradient(circle, #FFF6C8 0%, #FFD54A 55%, #FFB300 100%);
        box-shadow: 0 0 60px 20px rgba(255,213,74,.45); animation: dt-lt-zon 6s ease-in-out infinite alternate; }
      .dt-lt-wolk { position: absolute; height: 5vh; border-radius: 999px; background: rgba(255,255,255,.85); filter: blur(1px); }
      .dt-lt-wolk::before, .dt-lt-wolk::after { content: ""; position: absolute; border-radius: 50%; background: inherit; }
      .dt-lt-wolk::before { width: 45%; height: 160%; left: 18%; bottom: 20%; } .dt-lt-wolk::after { width: 35%; height: 130%; left: 50%; bottom: 25%; }
      .dt-lt-wolk.w1 { top: 14vh; left: -20vw; width: 16vw; animation: dt-lt-drijf 70s linear infinite; }
      .dt-lt-wolk.w2 { top: 24vh; left: -20vw; width: 11vw; opacity: .8; animation: dt-lt-drijf 95s linear -40s infinite; }
      .dt-lt-heuvels { position: absolute; left: 0; right: 0; bottom: 0; height: 62vh; pointer-events: none; }
      .dt-lt-heuvels > svg:first-child { position: absolute; inset: auto 0 0 0; width: 100%; height: 100%; }
      .dt-lt-boom { position: absolute; width: 22vw; }
      .dt-lt-boom.b1 { left: 4vw; bottom: 30vh; } .dt-lt-boom.b2 { right: 8vw; bottom: 34vh; width: 15vw; opacity: .85; }
      .dt-lt-savanne { position: absolute; left: 3vw; right: 3vw; bottom: 11vh; height: 40vh; display: grid; grid-template-columns: repeat(6, 1fr); align-items: end; gap: 1vw; }
      .dt-lt-slot { position: relative; height: 100%; overflow: hidden; }
      .dt-lt-slot:nth-child(even) { height: 86%; }
      .dt-lt-dier { position: absolute; left: 50%; bottom: 8vh; font-size: min(15vh, 9vw); line-height: 1; transform: translateX(-50%); transition: transform .5s cubic-bezier(.3,1.4,.5,1);
        filter: drop-shadow(0 6px 8px rgba(0,0,0,.18)); }
      .dt-lt-dier > span { display: block; animation: dt-lt-wiebel 3.2s ease-in-out infinite; }
      .dt-lt-slot.is-weg .dt-lt-dier { transform: translate(-50%, 24vh); transition: transform .3s cubic-bezier(.6,0,.9,.5); }
      .dt-lt-struik { position: absolute; left: -6%; right: -6%; bottom: 0; height: 13vh; border-radius: 50% 50% 18% 18% / 70% 70% 30% 30%;
        background: radial-gradient(circle at 25% 35%, #7FB04A 0 22%, transparent 23%), radial-gradient(circle at 70% 30%, #7FB04A 0 20%, transparent 21%), radial-gradient(circle at 50% 60%, #5E8F35 0 45%, transparent 46%), #4C7A2B;
        box-shadow: inset 0 -10px 20px rgba(0,0,0,.18); }
      .dt-lt-slot.is-schrik .dt-lt-struik { animation: dt-lt-ritsel .5s ease-in-out; }
      .dt-lt-roep { position: absolute; left: 50%; bottom: 15vh; transform: translateX(-50%) scale(0); font: 900 7vh/1 var(--dt-font); color: #FF3B30; opacity: 0; text-shadow: 0 2px 0 #fff; }
      .dt-lt-slot.is-schrik .dt-lt-roep { animation: dt-lt-roep .7s ease-out; }
      .dt-lt-status { position: absolute; left: 50%; top: 12vh; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
      .dt-lt-telling { font-size: clamp(22px, 3.2vw, 52px); font-weight: 800; letter-spacing: -.02em; color: #3B2A12; text-shadow: 0 2px 0 rgba(255,255,255,.5); }
      .dt-lt-stiltijd { font-size: clamp(14px, 1.4vw, 22px); font-weight: 700; color: rgba(59,42,18,.75); font-variant-numeric: tabular-nums; }
      .dt-lt-meter { position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); width: min(720px, 70vw); display: flex; align-items: center; gap: 12px; font-size: 22px; }
      .dt-lt-meterbalk { position: relative; flex: 1; height: 18px; border-radius: 999px; background: rgba(59,42,18,.18); box-shadow: inset 0 1px 3px rgba(0,0,0,.15); }
      .dt-lt-meterbalk i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: linear-gradient(90deg, #30D158, #9BE15D); transition: width .08s linear; }
      .dt-lt-meterbalk i.is-bijna { background: linear-gradient(90deg, #30D158, #FFCC00); }
      .dt-lt-meterbalk i.is-hard { background: linear-gradient(90deg, #FF9F0A, #FF3B30); }
      .dt-lt-meterbalk b { position: absolute; top: -6px; bottom: -6px; width: 3px; margin-left: -1.5px; border-radius: 2px; background: #3B2A12; }
      @keyframes dt-lt-wiebel { 0%, 100% { transform: rotate(-2deg); } 50% { transform: translateY(-.6vh) rotate(2deg); } }
      @keyframes dt-lt-ritsel { 0%, 100% { transform: none; } 25% { transform: rotate(-2deg) scale(1.03); } 75% { transform: rotate(2deg) scale(1.02); } }
      @keyframes dt-lt-roep { 0% { opacity: 0; transform: translateX(-50%) scale(.2); } 30% { opacity: 1; transform: translateX(-50%) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, -4vh) scale(1); } }
      @keyframes dt-lt-zon { to { transform: scale(1.06); box-shadow: 0 0 80px 30px rgba(255,213,74,.5); } }
      @keyframes dt-lt-drijf { to { transform: translateX(140vw); } }

      /* --- Kaartenpakje --- */
      .dt-lt-spot { position: absolute; left: 50%; top: 46%; width: 90vmin; height: 90vmin; margin: -45vmin 0 0 -45vmin; border-radius: 50%; pointer-events: none;
        background: radial-gradient(circle, rgba(255,255,255,.14), transparent 62%); }
      .dt-lt-tafel { position: absolute; inset: 70px 0 120px; display: grid; place-items: center; perspective: 1400px; }
      .dt-lt-tafel > * { grid-area: 1 / 1; }
      .dt-lt-onder { position: absolute; left: 0; right: 0; bottom: 4vh; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
      .dt-lt-hint { margin: 0; font-size: clamp(14px, 1.3vw, 20px); font-weight: 600; color: rgba(255,255,255,.7); animation: dt-lt-adem 2s ease-in-out infinite; }
      .dt-lt-stand { margin: 0; font-size: clamp(14px, 1.3vw, 20px); font-weight: 600; color: rgba(255,255,255,.75); }
      .dt-lt-leeg { font-size: 24px; font-weight: 600; }
      .dt-lt-pakje { appearance: none; border: 0; padding: 0; cursor: pointer; position: relative; width: min(30vh, 40vw); height: min(44vh, 58vw); border-radius: 18px; color: #fff; font-family: var(--dt-font);
        animation: dt-lt-zweef 3s ease-in-out infinite; filter: drop-shadow(0 30px 40px rgba(0,0,0,.45)); }
      .dt-lt-folie, .dt-lt-flap { position: absolute; left: 0; right: 0; background: linear-gradient(125deg, #FF4F8B 0%, #FF9F0A 22%, #FFD54A 38%, #4FD1FF 58%, #8B5CF6 78%, #FF4F8B 100%); background-size: 300% 300%;
        animation: dt-lt-folie 6s linear infinite; }
      .dt-lt-folie { top: 14%; bottom: 0; border-radius: 0 0 18px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.4vh; overflow: hidden;
        box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); clip-path: polygon(0 0, 5% 2.5%, 10% 0, 15% 2.5%, 20% 0, 25% 2.5%, 30% 0, 35% 2.5%, 40% 0, 45% 2.5%, 50% 0, 55% 2.5%, 60% 0, 65% 2.5%, 70% 0, 75% 2.5%, 80% 0, 85% 2.5%, 90% 0, 95% 2.5%, 100% 0, 100% 100%, 0 100%); }
      .dt-lt-folie::after { content: ""; position: absolute; inset: -50%; background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%); animation: dt-lt-glim 3.2s ease-in-out infinite; }
      .dt-lt-flap { top: 0; height: 16%; border-radius: 18px 18px 0 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 95% 85%, 90% 100%, 85% 85%, 80% 100%, 75% 85%, 70% 100%, 65% 85%, 60% 100%, 55% 85%, 50% 100%, 45% 85%, 40% 100%, 35% 85%, 30% 100%, 25% 85%, 20% 100%, 15% 85%, 10% 100%, 5% 85%, 0 100%);
        box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); transform-origin: 85% 100%; }
      .dt-lt-pakster { width: 10vh; height: 10vh; border-radius: 50%; display: grid; place-items: center; font-size: 6vh; background: rgba(255,255,255,.25); box-shadow: inset 0 0 0 3px rgba(255,255,255,.5); }
      .dt-lt-paklabel { font-size: clamp(18px, 2.6vh, 30px); font-weight: 900; letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 2px 6px rgba(0,0,0,.25); text-align: center; padding: 0 8%; }
      .dt-lt-pakklas { font-size: clamp(12px, 1.6vh, 18px); font-weight: 700; padding: .3em .9em; border-radius: 999px; background: rgba(0,0,0,.2); }
      .dt-lt-pakklas:empty { display: none; }
      .dt-lt-pakje.is-schud { animation: dt-lt-schud .65s ease-in-out; }
      .dt-lt-pakje.is-open { animation: none; pointer-events: none; }
      .dt-lt-pakje.is-open .dt-lt-flap { animation: dt-lt-flapweg .7s cubic-bezier(.3,.1,.5,1) forwards; }
      .dt-lt-pakje.is-open .dt-lt-folie { animation: dt-lt-pakweg .9s cubic-bezier(.5,0,.75,0) .25s forwards; }
      .dt-lt-kaart { width: min(26vh, 34vw); aspect-ratio: 5 / 7; perspective: 1200px; opacity: 0; transform: translateY(18vh) scale(.6); }
      .dt-lt-kaart.is-groot { width: min(36vh, 44vw); }
      .dt-lt-kaart.is-uit { animation: dt-lt-kaartuit .7s cubic-bezier(.2,.9,.3,1.2) var(--d, 0ms) forwards; }
      .dt-lt-kaartbinnen { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transform: rotateY(180deg); }
      .dt-lt-kaart.is-uit .dt-lt-kaartbinnen { animation: dt-lt-draaiom .8s cubic-bezier(.3,.7,.3,1.15) calc(var(--d, 0ms) + 350ms) forwards; }
      .dt-lt-kaartvoor, .dt-lt-kaartachter { position: absolute; inset: 0; border-radius: 6%; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
      .dt-lt-kaartachter { transform: rotateY(180deg); display: grid; place-items: center; background: repeating-linear-gradient(45deg, #5B3FD9 0 10px, #4A2FC4 10px 20px); box-shadow: inset 0 0 0 6px rgba(255,255,255,.85); font-size: 8vh; color: #FFD54A; }
      .dt-lt-kaartvoor { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6%; padding: 8%; box-sizing: border-box; color: #1C1C3A;
        background: linear-gradient(160deg, #FFFFFF, #F1F0FF); box-shadow: inset 0 0 0 5px #FFD54A, inset 0 0 0 8px #fff, 0 20px 50px rgba(0,0,0,.4); }
      .dt-lt-kaartvoor::after { content: ""; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .55;
        background: linear-gradient(115deg, transparent 20%, rgba(255,79,139,.6) 35%, rgba(255,213,74,.6) 45%, rgba(79,209,255,.6) 55%, rgba(139,92,246,.6) 65%, transparent 80%); background-size: 250% 250%; animation: dt-lt-holo 4s linear infinite; }
      .dt-lt-gezicht { position: relative; width: 62%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; display: grid; place-items: center; font-size: calc(min(26vh, 34vw) * .2); font-weight: 800; text-transform: uppercase;
        color: #fff; background: linear-gradient(160deg, #6C5CE7, #4834D4); box-shadow: 0 0 0 4px #FFD54A, 0 8px 20px rgba(72,52,212,.35); }
      .dt-lt-kaart.is-groot .dt-lt-gezicht { font-size: calc(min(36vh, 44vw) * .2); }
      .dt-lt-gezicht img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .dt-lt-kaartnaam { font-size: calc(min(26vh, 34vw) * .12); font-weight: 800; letter-spacing: -.01em; text-align: center; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-lt-kaart.is-groot .dt-lt-kaartnaam { font-size: calc(min(36vh, 44vw) * .13); }
      .dt-lt-vonken { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
      .dt-lt-vonken i { position: absolute; width: 8px; height: 8px; border-radius: 50%; opacity: 0; animation: dt-lt-vonk 1.2s cubic-bezier(.15,.7,.4,1) both; }
      .dt-lt-groepen { position: absolute; inset: 72px 3vw 130px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 16px; align-content: center; overflow: auto; }
      .dt-lt-groep { border-radius: 22px; padding: 14px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), inset 0 3px 0 var(--kleur); animation: dt-lt-vervaag .5s ease both; }
      .dt-lt-groep h3 { margin: 0 0 10px; display: flex; align-items: center; gap: 8px; font-size: clamp(16px, 1.4vw, 26px); font-weight: 800; color: #fff; }
      .dt-lt-teamemoji { font-size: 24px; }
      .dt-lt-groepkaarten { display: flex; flex-wrap: wrap; gap: 8px; }
      .dt-lt-groep .dt-lt-kaart { width: clamp(80px, 6.5vw, 140px); }
      .dt-lt-groep .dt-lt-kaartvoor { gap: 5px; padding: 8px 6px; box-shadow: inset 0 0 0 3px var(--kleur), 0 8px 20px rgba(0,0,0,.35); }
      .dt-lt-groep .dt-lt-gezicht { width: 70%; font-size: clamp(18px, 1.6vw, 32px); box-shadow: 0 0 0 2px var(--kleur); background: linear-gradient(160deg, #6C5CE7, #4834D4); }
      .dt-lt-groep .dt-lt-kaartnaam { font-size: clamp(12px, 1.05vw, 20px); }
      .dt-lt-groep .dt-lt-kaartachter { font-size: 28px; box-shadow: inset 0 0 0 3px rgba(255,255,255,.85); }
      @keyframes dt-lt-zweef { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-14px) rotate(2deg); } }
      @keyframes dt-lt-folie { to { background-position: 300% 300%; } }
      @keyframes dt-lt-glim { 0% { transform: translateX(-60%); } 60%, 100% { transform: translateX(60%); } }
      @keyframes dt-lt-schud { 0%, 100% { transform: none; } 15% { transform: rotate(-6deg) scale(1.03); } 30% { transform: rotate(6deg) scale(1.05); } 45% { transform: rotate(-5deg) scale(1.06); } 60% { transform: rotate(5deg) scale(1.07); } 80% { transform: rotate(-2deg) scale(1.08); } }
      @keyframes dt-lt-flapweg { to { transform: translate(30vw, -40vh) rotate(70deg); opacity: 0; } }
      @keyframes dt-lt-pakweg { to { transform: translateY(70vh) rotate(8deg); opacity: 0; } }
      @keyframes dt-lt-kaartuit { 0% { opacity: 0; transform: translateY(18vh) scale(.6); } 100% { opacity: 1; transform: none; } }
      @keyframes dt-lt-draaiom { to { transform: rotateY(0); } }
      @keyframes dt-lt-holo { to { background-position: 250% 250%; } }
      @keyframes dt-lt-vonk { 0% { opacity: 1; transform: translate(0, 0) scale(1); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(.3); } }
      @keyframes dt-lt-adem { 50% { opacity: .45; } }
      @keyframes dt-lt-vervaag { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      /* --- Lesbord --- */
      .dt-lt-tool-bord .dt-lt-vakklas { font: 600 13px/1 var(--dt-font); padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.85); }
      .dt-lt-bordraster { position: absolute; inset: 72px 3vw 3vh; display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); gap: 2vw; }
      .dt-lt-zij { display: grid; grid-template-rows: auto 1fr; gap: 2vw; min-height: 0; }
      .dt-lt-paneel { border-radius: 28px; padding: clamp(18px, 2.4vw, 40px); background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); min-height: 0; overflow: auto; }
      .dt-lt-kopje { display: block; margin-bottom: 1.2vh; font-size: clamp(12px, 1vw, 16px); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #FFD54A; }
      .dt-lt-opdracht { margin: 0 0 3vh; font-size: clamp(30px, 4vw, 72px); line-height: 1.08; font-weight: 800; letter-spacing: -.03em; }
      .dt-lt-stappen { margin: 0; padding: 0; list-style: none; counter-reset: stap; display: flex; flex-direction: column; gap: 1.6vh; }
      .dt-lt-stappen li { counter-increment: stap; position: relative; padding-left: calc(clamp(34px, 3vw, 56px) + 18px); min-height: clamp(34px, 3vw, 56px); display: flex; align-items: center;
        font-size: clamp(20px, 2.2vw, 40px); font-weight: 600; line-height: 1.2; }
      .dt-lt-stappen li::before { content: counter(stap); position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: clamp(34px, 3vw, 56px); height: clamp(34px, 3vw, 56px); border-radius: 50%;
        display: grid; place-items: center; font-size: .8em; font-weight: 800; color: #141B3D; background: linear-gradient(180deg, #FFE27A, #FFC93C); }
      .dt-lt-klaar { margin: 4vh 0 0; padding: 1.4vh 1.4vw; border-radius: 16px; background: rgba(48,209,88,.14); color: #9BF2B4; font-size: clamp(16px, 1.6vw, 28px); font-weight: 600; }
      .dt-lt-klaar:empty { display: none; }
      .dt-lt.is-bewerken [contenteditable="true"] { outline: 2px dashed rgba(255,213,74,.6); outline-offset: 6px; border-radius: 8px; cursor: text; }
      .dt-lt.is-bewerken .dt-lt-klaar:empty { display: block; min-height: 1.2em; }
      .dt-lt-geluid { display: flex; flex-direction: column; gap: 10px; }
      .dt-lt-geluid button { appearance: none; border: 0; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 14px; align-items: center; text-align: left; padding: 12px 16px;
        border-radius: 18px; color: rgba(255,255,255,.55); background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); cursor: pointer; font-family: var(--dt-font); transition: background .2s, color .2s; }
      .dt-lt-geluid .dt-lt-gemoji { grid-row: 1 / 3; font-size: clamp(28px, 2.6vw, 48px); filter: grayscale(1); opacity: .6; transition: filter .2s, opacity .2s; }
      .dt-lt-geluid b { font-size: clamp(16px, 1.5vw, 26px); font-weight: 800; }
      .dt-lt-geluid small { font-size: clamp(12px, .95vw, 16px); font-weight: 500; }
      .dt-lt-geluid button[aria-checked="true"] { background: rgba(255,255,255,.14); color: #fff; box-shadow: inset 0 0 0 2px #FFD54A; }
      .dt-lt-geluid button[aria-checked="true"] .dt-lt-gemoji { filter: none; opacity: 1; }
      .dt-lt-timer { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.6vh; }
      .dt-lt-timer .dt-lt-kopje { align-self: flex-start; }
      .dt-lt-ring { position: relative; width: min(100%, 24vh); aspect-ratio: 1; display: grid; place-items: center; }
      .dt-lt-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      .dt-lt-ring .spoor { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 9; }
      .dt-lt-ring .voortgang { fill: none; stroke: #FFD54A; stroke-width: 9; stroke-linecap: round; transition: stroke .3s; }
      .dt-lt-ring.is-bijna .voortgang { stroke: #FF9F0A; }
      .dt-lt-ring.is-op .voortgang { stroke: #FF453A; }
      .dt-lt-ring.is-op { animation: dt-lt-pols 1s ease-in-out infinite; }
      .dt-lt-tijd { position: relative; font-size: clamp(36px, 5vh, 84px); font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .dt-lt-presets { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
      .dt-lt-presets button { appearance: none; border: 0; min-width: 44px; height: 32px; padding: 0 10px; border-radius: 999px; font: 700 13px/1 var(--dt-font); color: #fff; background: rgba(255,255,255,.12); cursor: pointer; }
      .dt-lt-presets button::after { content: " min"; font-weight: 500; opacity: .7; }
      .dt-lt-presets button[aria-pressed="true"] { background: #fff; color: #141B3D; }
      .dt-lt-timerknoppen { display: flex; gap: 10px; align-items: center; }
      .dt-lt-timerknoppen .dt-lt-hoofdknop { height: 44px; min-width: 120px; font-size: 16px; }
      @keyframes dt-lt-pols { 50% { transform: scale(1.04); } }
      @media (max-width: 900px) { .dt-lt-bordraster { grid-template-columns: 1fr; overflow: auto; } }
      @media (prefers-reduced-motion: reduce) { .dt-lt *, .dt-lt *::before, .dt-lt *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
    `;
    document.head.append(st);
  },
});
