/* Lestools: extra tegels op het tabblad Hulpmiddelen van een les (naast Magisters Groepjes, Wie is wie?,
 * Timer en Wie heeft de beurt?). Elke tool opent schermvullend, geschikt voor het digibord.
 *
 *  - Stille safari: geluidsmeter via de microfoon, naar het idee van Hush Safari: bij rust komen in de
 *    gekozen lesduur negen schuwe dieren één voor één tevoorschijn; te druk geeft een zandstorm en de dieren
 *    rennen weg. Het geluid blijft in de browser: er wordt niets opgenomen of verstuurd.
 *  - Kaartenpakje: open een 3D-pakje voor de volgende beurt (zonder herhaling tot iedereen geweest is) of
 *    per groepje een eigen pakje in de teamkleur.
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
  /* Werking (naar het idee van Hush Safari): kies een lesduur; elk van de negen dieren kost een negende van
   * die tijd aan rust. Is het rustig, dan gluurt het volgende dier steeds verder achter zijn rots, struik,
   * gras, termietenheuvel of waterpoel vandaan en komt het tevoorschijn als zijn rusttijd vol is. Te druk:
   * een zandstorm trekt over de savanne en de dieren die al buiten waren rennen weg; blijft het druk, dan
   * zakt het gluren terug (de dieren worden schuwer). Bij rust komen ze terug. Aan het eind: hoeveel dieren
   * er gespot zijn en hoeveel procent van de tijd het rustig was. Eigen tekeningen; geluid blijft lokaal. */
  SF_PLEKKEN: [
    // x, y = onderkant van de schuilplek in een savanne van 1600 x 900; w = breedte; s = grootte van het dier
    { dier: "🦓", naam: "zebra", x: 300, y: 652, w: 240, s: 92, dek: "gras" },
    { dier: "🦒", naam: "giraf", x: 612, y: 658, w: 220, s: 118, dek: "gras" },
    { dier: "🐒", naam: "aap", x: 918, y: 650, w: 170, s: 78, dek: "heuvel" },
    { dier: "🐘", naam: "olifant", x: 1238, y: 660, w: 250, s: 104, dek: "struik" },
    { dier: "🦛", naam: "nijlpaard", x: 1062, y: 846, w: 290, s: 112, dek: "water" },
    { dier: "🦁", naam: "leeuw", x: 702, y: 868, w: 270, s: 132, dek: "rots" },
    { dier: "🐗", naam: "wrattenzwijn", x: 150, y: 868, w: 250, s: 108, dek: "hol" },
    { dier: "🦏", naam: "neushoorn", x: 430, y: 878, w: 270, s: 122, dek: "struik" },
    { dier: "🐆", naam: "luipaard", x: 1450, y: 878, w: 270, s: 122, dek: "struik" },
  ],
  SF_DUUR: [10, 15, 30, 45, 60],

  /* Schuilplekken als SVG, met (0,0) midden-onder. Geeft { svg, h, diep } terug: hoogte en hoe diep het dier
   * erachter wegzakt (de kniplijn ligt zo ver onder de bovenrand, zodat randen natuurlijk overlappen). */
  sfDek(soort, w, i) {
    const r = (n) => { const x = Math.sin(i * 97.13 + n * 13.7) * 43758.5453; return x - Math.floor(x); };
    if (soort === "rots") {
      const h = w * .46;
      return { h, diep: h * .55, svg: `<path d="M${-w / 2} 0C${-w * .52} ${-h * .55} ${-w * .3} ${-h} ${-w * .02} ${-h}C${w * .28} ${-h * 1.02} ${w * .5} ${-h * .62} ${w * .5} 0Z" fill="url(#sf-rots)" stroke="#5F5B57" stroke-width="3"/>
        <path d="M${-w * .3} ${-h * .78}C${-w * .12} ${-h * .95} ${w * .1} ${-h * .96} ${w * .25} ${-h * .8}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>
        <path d="M${-w * .05} ${-h * .55}l${w * .04} ${h * .12}l${-w * .03} ${h * .1}M${w * .2} ${-h * .3}l${w * .05} ${h * .09}" fill="none" stroke="#6E6A66" stroke-width="3" stroke-linecap="round"/>` };
    }
    if (soort === "struik") {
      const h = w * .38, b = [];
      for (let k = 0; k < 6; k++) { const cx = -w * .42 + k * w * .168, cy = -h * (.42 + .25 * Math.sin(k / 5 * Math.PI)), rr = w * (.15 + .03 * r(k)); b.push(`<circle cx="${cx}" cy="${cy}" r="${rr}"/>`); }
      const bes = Array.from({ length: 7 }, (_, k) => `<circle cx="${(-w * .38 + r(k + 9) * w * .76).toFixed(1)}" cy="${(-h * (.25 + r(k + 20) * .6)).toFixed(1)}" r="${(w * .014).toFixed(1)}" fill="#C8473A" stroke="#8E2F25" stroke-width="1.5"/>`).join("");
      return { h, diep: h * .55, svg: `<g fill="url(#sf-struik)" stroke="#3F5A22" stroke-width="3">${b.join("")}</g><path d="M${-w * .48} 0H${w * .48}" stroke="#3F5A22" stroke-width="3"/>${bes}` };
    }
    if (soort === "gras") {
      const h = w * .42, sprieten = [];
      for (let k = 0; k < 30; k++) {
        const x = -w / 2 + (k + r(k)) * w / 30, hh = h * (.55 + .45 * r(k + 50)), buig = (r(k + 80) - .5) * w * .12;
        sprieten.push(`<path d="M${(x - 5).toFixed(1)} 0Q${(x + buig * .4).toFixed(1)} ${(-hh * .6).toFixed(1)} ${(x + buig).toFixed(1)} ${(-hh).toFixed(1)}Q${(x + buig * .3 + 3).toFixed(1)} ${(-hh * .5).toFixed(1)} ${(x + 6).toFixed(1)} 0Z" fill="${k % 3 ? "#C9B860" : "#B3A548"}"/>`);
      }
      return { h, diep: h * .4, svg: `<g stroke="#7E7432" stroke-width="1.6" stroke-linejoin="round">${sprieten.join("")}</g>` };
    }
    if (soort === "heuvel") {
      const h = w * .62;
      return { h, diep: h * .32, svg: `<path d="M${-w / 2} 0C${-w * .45} ${-h * .38} ${-w * .2} ${-h * .5} ${-w * .05} ${-h * .52}L${w * .02} ${-h}C${w * .12} ${-h * .98} ${w * .16} ${-h * .62} ${w * .2} ${-h * .5}C${w * .38} ${-h * .44} ${w * .48} ${-h * .3} ${w / 2} 0Z" fill="url(#sf-heuvel)" stroke="#7A4220" stroke-width="3"/>
        <path d="M${-w * .28} ${-h * .3}q${w * .08} ${-h * .05} ${w * .14} 0M${w * .1} ${-h * .22}q${w * .06} ${-h * .04} ${w * .12} 0M${w * .04} ${-h * .78}v${h * .14}" fill="none" stroke="#7A4220" stroke-width="3" stroke-linecap="round" opacity=".7"/>` };
    }
    if (soort === "water") {
      const h = w * .16;
      return { h: 0, diep: 2, svg: `<ellipse cx="0" cy="${-h * .2}" rx="${w / 2}" ry="${h * .55}" fill="#8CC9DE" stroke="#4F97B3" stroke-width="3"/>
        <ellipse cx="${-w * .08}" cy="${-h * .25}" rx="${w * .3}" ry="${h * .22}" fill="#B6E1EE"/>
        <path d="M${w * .38} ${-h * .3}v${-h * 2.2}M${w * .42} ${-h * .25}v${-h * 1.6}M${w * .34} ${-h * .3}v${-h * 1.4}" stroke="#7E7432" stroke-width="4" stroke-linecap="round"/>` };
    }
    // hol: lage zandheuvel met donkere gaten
    const h = w * .3;
    return { h, diep: h * .5, svg: `<path d="M${-w / 2} 0C${-w * .42} ${-h * .8} ${-w * .15} ${-h} 0 ${-h}C${w * .2} ${-h} ${w * .42} ${-h * .78} ${w / 2} 0Z" fill="url(#sf-hol)" stroke="#8C6A3E" stroke-width="3"/>
      <ellipse cx="${-w * .2}" cy="${-h * .5}" rx="${w * .09}" ry="${h * .14}" fill="#5A3F22"/><ellipse cx="${w * .05}" cy="${-h * .62}" rx="${w * .08}" ry="${h * .13}" fill="#5A3F22"/><ellipse cx="${w * .26}" cy="${-h * .4}" rx="${w * .07}" ry="${h * .11}" fill="#5A3F22"/>` };
  },

  sfLandschap() {
    const wolk = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-110 0c-30 0-30-40 0-42 4-34 52-46 74-20 12-30 74-30 82 6 34-6 52 30 30 56z" fill="#FFFDF6" stroke="#E6DDC6" stroke-width="2.5"/></g>`;
    const boompje = (x, y, s, kleur = "#7A8F3F") => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0V-46M0-30l-18-14M0-36l16-12" stroke="#5B4126" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="-54" rx="58" ry="13" fill="${kleur}" stroke="#55682B" stroke-width="2.5"/></g>`;
    const sprietjes = Array.from({ length: 70 }, (_, k) => {
      const x = (k * 127.3) % 1600, y = 600 + ((k * 61.7) % 290), s = .6 + ((k * 7) % 5) / 6;
      return `<path d="M${x} ${y}l${-4 * s} ${-12 * s}M${x} ${y}l${2 * s} ${-14 * s}M${x} ${y}l${7 * s} ${-10 * s}" stroke="#B88A45" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
    }).join("");
    return `
      <defs>
        <linearGradient id="sf-lucht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9D6EC"/><stop offset=".55" stop-color="#D9ECEC"/><stop offset="1" stop-color="#F6EBCF"/></linearGradient>
        <radialGradient id="sf-zon"><stop offset="0" stop-color="#FFF7D6"/><stop offset=".6" stop-color="#FFE39A"/><stop offset="1" stop-color="#FFD271"/></radialGradient>
        <radialGradient id="sf-zongloed"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".75"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>
        <linearGradient id="sf-berg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C3B1D2"/><stop offset=".62" stop-color="#B9A6C9"/><stop offset=".63" stop-color="#A893BA"/><stop offset="1" stop-color="#A08AB3"/></linearGradient>
        <linearGradient id="sf-vlakte" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EECD8A"/><stop offset="1" stop-color="#DDAA5E"/></linearGradient>
        <linearGradient id="sf-rots" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9B6B1"/><stop offset="1" stop-color="#8E8A85"/></linearGradient>
        <radialGradient id="sf-struik" cx=".4" cy=".3"><stop offset="0" stop-color="#9DBB5A"/><stop offset="1" stop-color="#6E8F38"/></radialGradient>
        <linearGradient id="sf-heuvel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D98A4E"/><stop offset="1" stop-color="#B0602F"/></linearGradient>
        <linearGradient id="sf-hol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4C48C"/><stop offset="1" stop-color="#C9A266"/></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sf-lucht)"/>
      <circle cx="330" cy="215" r="210" fill="url(#sf-zongloed)" class="sf-zongloed"/>
      <circle cx="330" cy="215" r="100" fill="url(#sf-zon)"/>
      <g class="sf-wolken">${wolk(560, 140, 1)}${wolk(1080, 200, .7)}${wolk(1420, 110, .55)}</g>
      <path d="M760 580L1110 330Q1190 300 1260 330L1560 520L1600 580Z" fill="url(#sf-berg)"/>
      <path d="M1068 360L1110 330Q1190 300 1260 330L1310 362L1286 372L1262 352L1240 378L1214 356L1188 380L1162 356L1136 378L1112 356L1092 374Z" fill="#FFF9F1" stroke="#E7DCE8" stroke-width="2"/>
      <path d="M0 560Q200 520 420 540T880 548T1600 560V600H0Z" fill="#E8D3A6"/>
      <rect y="575" width="1600" height="325" fill="url(#sf-vlakte)"/>
      <path d="M0 575H1600" stroke="#D8B571" stroke-width="3"/>
      ${boompje(120, 600, 1)}${boompje(390, 576, .55, "#8A9C4C")}${boompje(1380, 588, .62, "#8A9C4C")}${boompje(1180, 610, 1.15)}${boompje(1560, 600, .8)}
      <ellipse cx="530" cy="610" rx="150" ry="16" fill="#A6D3E3" stroke="#78B3C8" stroke-width="3"/>
      <path d="M880 600C860 680 760 720 790 780S740 860 720 900H800C820 860 860 820 850 770S930 670 908 600Z" fill="#F2DFB4" opacity=".9"/>
      ${sprietjes}`;
  },

  async safari(DT) {
    const s = this._scherm, rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.laag.classList.add("dt-sf");
    let drempel = 55; try { drempel = Math.min(90, Math.max(20, +localStorage.getItem("dt-lt-safari-drempel") || 55)); } catch {}
    let duur = 30; try { duur = +localStorage.getItem("dt-lt-safari-duur") || 30; } catch {}
    let alarm = false; try { alarm = localStorage.getItem("dt-lt-safari-alarm") === "1"; } catch {}

    /* Bediening linksboven: gevoeligheid en piepje */
    const seg = DT.el("div", { class: "dt-lt-seg", role: "radiogroup", "aria-label": "Werkgeluid" });
    const schuif = DT.el("input", { type: "range", min: "20", max: "90", value: String(drempel), "aria-label": "Hoe hard mag het zijn?" });
    const PRESET = [["Stil", 35], ["Fluisteren", 55], ["Overleggen", 75]];
    const zetDrempel = (v) => {
      drempel = v; schuif.value = String(v); try { localStorage.setItem("dt-lt-safari-drempel", String(v)); } catch {}
      [...seg.children].forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.v === v)));
      lijn.style.left = `${v}%`;
    };
    for (const [t, v] of PRESET) { const b = DT.el("button", { type: "button", role: "radio", "data-v": String(v), text: t }); b.addEventListener("click", () => zetDrempel(v)); seg.append(b); }
    schuif.addEventListener("input", () => zetDrempel(+schuif.value));
    const alarmKnop = DT.el("button", { type: "button", class: "dt-lt-pil", "aria-pressed": String(alarm), text: "Piepje bij te druk" });
    alarmKnop.addEventListener("click", () => { alarm = !alarm; alarmKnop.setAttribute("aria-pressed", String(alarm)); try { localStorage.setItem("dt-lt-safari-alarm", alarm ? "1" : "0"); } catch {} });
    s.extra.append(seg, DT.el("label", { class: "dt-lt-schuif" }, [DT.el("span", { text: "Gevoeligheid" }), schuif]), alarmKnop);

    /* Landschap met schuilplekken en dieren */
    const plekken = this.SF_PLEKKEN.map((p, i) => ({ ...p, i, ...this.sfDek(p.dek, p.w, i) }));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 1600 900"); svg.setAttribute("preserveAspectRatio", "xMidYMax slice"); svg.setAttribute("class", "sf-scene"); svg.setAttribute("aria-hidden", "true");
    const lagen = plekken.slice().sort((a, b) => a.y - b.y).map((p) => {
      const clip = `sf-clip-${p.i}`;
      return `<clipPath id="${clip}"><rect x="-2000" y="-3000" width="4000" height="${3000 - p.h + p.diep}"/></clipPath>
        <g transform="translate(${p.x} ${p.y})">
          <g class="sf-plek" data-i="${p.i}" clip-path="url(#${clip})"><g class="sf-dier"><g class="sf-loop"><text class="sf-emoji" text-anchor="middle" y="${-p.s * .1}" font-size="${p.s}">${p.dier}</text></g></g></g>
          ${p.svg}
        </g>`;
    }).join("");
    svg.innerHTML = this.sfLandschap() + lagen;
    const stof = DT.el("div", { class: "sf-stof", "aria-hidden": "true" }, [
      ...Array.from({ length: 3 }, (_, k) => DT.el("span", { class: `sf-hoos h${k}`, html: `<svg viewBox="0 0 100 100"><path d="M50 50m0-4a4 4 0 1 1-4 4a10 10 0 0 1 10-10a16 16 0 0 1 16 16a22 22 0 0 1-22 22a28 28 0 0 1-28-28a34 34 0 0 1 34-34" fill="none" stroke="#9A7344" stroke-width="5" stroke-linecap="round" opacity=".75"/></svg>` })),
      ...Array.from({ length: 40 }, (_, k) => DT.el("i", { style: `top:${(k * 37) % 100}%;animation-delay:${-(k * .37) % 3}s;animation-duration:${1.6 + (k % 5) * .35}s` })),
    ]);
    const status = DT.el("div", { class: "sf-status", role: "status" }, [DT.el("i"), DT.el("span")]);
    const klok = DT.el("div", { class: "sf-klok", text: "" });
    const teller = DT.el("div", { class: "sf-teller" });
    const vul = DT.el("i"), lijn = DT.el("b"), getal = DT.el("span", { class: "sf-getal" });
    const pauze = DT.el("button", { type: "button", class: "sf-pauze", text: "Pauze" });
    const kaart = DT.el("div", { class: "sf-kaart" });
    s.inhoud.append(svg, stof,
      DT.el("div", { class: "sf-boven" }, [status, klok]),
      DT.el("div", { class: "sf-onder" }, [teller, DT.el("div", { class: "sf-meter", title: "Geluid ten opzichte van de stilte in jullie lokaal" }, [vul, lijn, getal]), pauze]),
      kaart);
    zetDrempel(drempel);
    const zetStatus = (soort, tekst) => { status.dataset.soort = soort; status.lastChild.textContent = tekst; };
    const diereEl = plekken.map((p) => svg.querySelector(`.sf-plek[data-i="${p.i}"]`));

    /* Diergedrag: verstopt, gluren (0..1), buiten (rondlopen), op de vlucht */
    const zet = (p, el, toestand, g = 0) => {
      const d = el.firstElementChild;
      el.classList.toggle("is-buiten", toestand === "buiten" || toestand === "vlucht");
      el.classList.toggle("is-vlucht", toestand === "vlucht");
      el.style.clipPath = toestand === "buiten" || toestand === "vlucht" ? "none" : "";
      let tf;
      if (toestand === "verstopt") tf = `translate(0px, ${(p.s - p.h + p.diep + 6).toFixed(1)}px)`;
      else if (toestand === "gluur") tf = `translate(0px, ${(Math.min(p.s - p.h + p.diep + 6, p.s - p.h - .42 * p.s * g)).toFixed(1)}px)`;
      /* Buiten: naast de schuilplek op de vlakte; de voorste rij een stuk naar achteren, zodat de dieren
       * niet achter de meter onderin verdwijnen. */
      else if (toestand === "buiten") { const kant = p.x > 800 ? -1 : 1, dy = p.y > 800 ? -p.h - 70 : p.h * .12 + 14; tf = `translate(${(kant * (p.w * .45 + p.s * .45)).toFixed(1)}px, ${dy.toFixed(1)}px)`; }
      else { const weg = p.x < 800 ? -p.x - 260 : 1600 - p.x + 260, dy = p.y > 800 ? -p.h - 70 : p.h * .12 + 14; tf = `translate(${weg}px, ${dy.toFixed(1)}px)`; }
      if (d.style.transform !== tf) d.style.transform = tf;
    };

    /* Startscherm: lesduur kiezen */
    const startscherm = () => {
      zetStatus("klaar", "Kies hoe lang de les duurt");
      klok.textContent = "";
      plekken.forEach((p, k) => zet(p, diereEl[k], "verstopt"));
      teller.textContent = "🦒 0/9";
      const knoppen = DT.el("div", { class: "sf-duren" }, this.SF_DUUR.map((m) => {
        const b = DT.el("button", { type: "button", "aria-pressed": String(m === duur), text: `${m} min` });
        b.addEventListener("click", () => { duur = m; try { localStorage.setItem("dt-lt-safari-duur", String(m)); } catch {} [...knoppen.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
        return b;
      }));
      const start = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: "Start de safari" });
      start.addEventListener("click", () => begin());
      kaart.replaceChildren(DT.el("div", { class: "sf-paneel" }, [
        DT.el("span", { class: "sf-paneelemoji", text: "🦒" }),
        DT.el("h2", { text: "Stille safari" }),
        DT.el("p", { text: "Is het rustig, dan komen er één voor één negen schuwe dieren tevoorschijn. Te druk? Dan steekt er een zandstorm op en rennen ze weg. Lukt het om ze alle negen te spotten voor de bel gaat?" }),
        knoppen, start,
        DT.el("small", { text: "De browser vraagt om de microfoon. Het geluid blijft op deze computer: er wordt niets opgenomen of verstuurd." }),
      ]));
      kaart.hidden = false;
      start.focus();
    };

    /* Sessie */
    let stream = null, ctx = null, raf = 0, sessie = null;
    const stopAudio = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close().catch(() => {}); stream = ctx = null; };
    const piep = () => {
      if (!alarm || !ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = 330; g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(.12, ctx.currentTime + .03); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .5);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .55);
    };

    const begin = async () => {
      kaart.hidden = true;
      zetStatus("luister", "Microfoon aanzetten…");
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
      catch { zetStatus("fout", "Geen toegang tot de microfoon"); kaart.replaceChildren(DT.el("div", { class: "sf-paneel" }, [DT.el("h2", { text: "Geen microfoon" }), DT.el("p", { text: "Sta de microfoon toe voor magister.net (het slotje links in de adresbalk) en probeer het opnieuw." })])); kaart.hidden = false; return; }
      if (this._scherm !== s) { stream.getTracks().forEach((t) => t.stop()); return; }
      ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 2048; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const volgorde = plekken.map((p) => p.i).sort(() => Math.random() - .5);
      sessie = { volgorde, per: duur * 60 / 9, over: duur * 60, rust: 0, gemeten: 0, rustTotaal: 0, verdiend: 0, basis: null, ijk: [], niv: 0, toestand: "ijk", luidSinds: 0, stilSinds: 0, gepauzeerd: false, laatstePiep: -99, t: 0 };
      zetStatus("luister", "Even luisteren hoe stil het hier is…");
      let vorige = performance.now();
      const stap = (nu) => {
        const S = sessie, dt = Math.min(.1, (nu - vorige) / 1000); vorige = nu;
        an.getFloatTimeDomainData(buf);
        let som = 0; for (let k = 0; k < buf.length; k++) som += buf[k] * buf[k];
        const db = 20 * Math.log10(Math.sqrt(som / buf.length) + 1e-9);
        S.t += dt;
        if (S.toestand === "ijk") {
          S.ijk.push(db);
          if (S.t > 2.5) { const r = S.ijk.slice().sort((a, b) => a - b); S.basis = r[Math.floor(r.length * .5)]; S.toestand = "rustig"; }
          raf = requestAnimationFrame(stap); return;
        }
        const rel = Math.max(0, Math.min(100, (db - S.basis - 4) * 3.2));
        S.niv = rel > S.niv ? S.niv * .55 + rel * .45 : S.niv * .9 + rel * .1;
        vul.style.width = `${S.niv.toFixed(1)}%`;
        vul.classList.toggle("is-hard", S.niv > drempel);
        getal.textContent = `${Math.round(S.niv)} / 100`;
        if (!S.gepauzeerd) {
          S.over -= dt; S.gemeten += dt;
          const hard = S.niv > drempel;
          if (hard) { S.luidSinds += dt; S.stilSinds = 0; } else { S.stilSinds += dt; S.luidSinds = 0; }
          const was = S.toestand;
          if (S.luidSinds > .3) S.toestand = S.luidSinds > 4 ? "storm" : "druk";
          else if (S.stilSinds > 1.5) S.toestand = "rustig";
          if (S.toestand !== "rustig" && was === "rustig" && S.t - S.laatstePiep > 8) { S.laatstePiep = S.t; piep(); }
          if (S.toestand === "rustig") { S.rust += dt; S.rustTotaal += dt; }
          else S.rust = Math.max(S.verdiend * S.per, S.rust - dt * (S.toestand === "storm" ? 1 : .35));
          const nieuw = Math.min(9, Math.floor(S.rust / S.per));
          if (nieuw > S.verdiend) {
            S.verdiend = nieuw;
            const p = plekken[S.volgorde[nieuw - 1]];
            zetStatus("nieuw", `Gespot: een ${p.naam}! ${p.dier}`); S.melding = S.t + 3.5;
          }
          if (S.over <= 0) return einde();
        }
        /* Weergave */
        const druk = S.toestand === "druk" || S.toestand === "storm";
        s.laag.classList.toggle("is-druk", druk);
        s.laag.classList.toggle("is-storm", S.toestand === "storm");
        if (!(S.melding > S.t)) {
          if (S.gepauzeerd) zetStatus("pauze", "Gepauzeerd");
          else if (S.toestand === "storm") zetStatus("druk", "Zandstorm! De dieren worden schuwer");
          else if (druk) zetStatus("druk", "Te druk: de dieren rennen weg");
          else zetStatus("rustig", S.verdiend >= 9 ? "Alle negen dieren gespot!" : "Rustig: de dieren gluren");
        }
        const g = S.verdiend < 9 ? (S.rust - S.verdiend * S.per) / S.per : 0;
        S.volgorde.forEach((idx, k) => {
          const p = plekken[idx], el = diereEl[idx];
          if (k < S.verdiend) zet(p, el, druk ? "vlucht" : "buiten");
          else if (k === S.verdiend) zet(p, el, druk ? "verstopt" : "gluur", g);
          else zet(p, el, "verstopt");
        });
        teller.textContent = `🦒 ${S.verdiend}/9`;
        const sec = Math.max(0, Math.ceil(S.over));
        klok.textContent = `⏳ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        raf = requestAnimationFrame(stap);
      };
      raf = requestAnimationFrame(stap);
    };

    const einde = () => {
      const S = sessie; stopAudio();
      s.laag.classList.remove("is-druk", "is-storm");
      S.volgorde.forEach((idx, k) => zet(plekken[idx], diereEl[idx], k < S.verdiend ? "buiten" : "verstopt"));
      zetStatus("klaar", "De tijd is om");
      const pct = S.gemeten ? Math.round(100 * S.rustTotaal / S.gemeten) : 0;
      const opnieuw = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: "Nieuwe les" });
      opnieuw.addEventListener("click", startscherm);
      kaart.replaceChildren(DT.el("div", { class: "sf-paneel" }, [
        DT.el("span", { class: "sf-paneelemoji", text: S.verdiend >= 9 ? "🏆" : "🦒" }),
        DT.el("h2", { text: S.verdiend >= 9 ? "Alle negen gespot!" : "De tijd is om!" }),
        DT.el("p", { text: `Jullie hebben ${S.verdiend} van de 9 dieren gespot in ${duur} minuten.` }),
        DT.el("div", { class: "sf-rustbalk" }, [DT.el("span", {}, DT.el("i", { style: `width:${pct}%` })), DT.el("b", { text: `${pct}% rustig` })]),
        opnieuw,
      ]));
      kaart.hidden = false;
    };

    pauze.addEventListener("click", () => {
      if (!sessie || kaart.hidden === false) return;
      sessie.gepauzeerd = !sessie.gepauzeerd; pauze.textContent = sessie.gepauzeerd ? "Verder" : "Pauze";
    });
    if (rustig) s.laag.classList.add("is-rustig");
    s.bijSluiten(stopAudio);
    startscherm();
  },

  /* ===================================================================================== */
  /* Kaartenpakje                                                                           */
  /* ===================================================================================== */
  /* Een 3D-pakje op een speeltafel. Volgende beurt: één pakje, één kaart. Groepjes: per groepje een eigen
   * pakje in de teamkleur; openen laat de kaarten van dat groepje in een waaier zien, daarna schuift het
   * groepje naar de strook onderin en ligt het volgende pakje klaar. Aan het eind: alle groepjes samen. */
  TEAMS: [["Leeuwen", "🦁", "#FF9F0A", "#C2410C"], ["Zebra's", "🦓", "#8E8E93", "#3A3A3C"], ["Giraffen", "🦒", "#FFCC00", "#B7791F"], ["Olifanten", "🐘", "#64D2FF", "#1D6FA5"],
    ["Flamingo's", "🦩", "#FF6482", "#B0204A"], ["Pinguïns", "🐧", "#5E5CE6", "#2A2794"], ["Vossen", "🦊", "#FF6B2C", "#A3360B"], ["Uilen", "🦉", "#C29B6C", "#6E5032"],
    ["Dolfijnen", "🐬", "#0A84FF", "#0B4A9A"], ["Kikkers", "🐸", "#30D158", "#14783A"], ["Panda's", "🐼", "#AEAEB2", "#48484A"], ["Tijgers", "🐯", "#FF9500", "#B45309"],
    ["Koala's", "🐨", "#98989D", "#4B4B50"], ["Haaien", "🦈", "#409CFF", "#1E4E8C"], ["Papegaaien", "🦜", "#34C759", "#1D7A36"]],

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
      b.addEventListener("click", () => { modus = k; try { localStorage.setItem("dt-lt-pakje-modus", k); } catch {} b.blur(); bouw(); });
      seg.append(b);
    }
    const maat = DT.el("label", { class: "dt-lt-maat" }, [DT.el("span", { text: "Per groepje" })]);
    const maatSel = DT.el("select", {}, [2, 3, 4, 5, 6].map((n) => DT.el("option", { value: String(n), text: String(n) })));
    maatSel.value = String(grootte);
    maatSel.addEventListener("change", () => { grootte = +maatSel.value; try { localStorage.setItem("dt-lt-pakje-grootte", maatSel.value); } catch {} maatSel.blur(); bouw(); });
    maat.append(maatSel);
    const aanw = DT.el("button", { type: "button", class: "dt-lt-pil", "aria-pressed": "true", text: "Alleen aanwezigen", title: "Afwezige, zieke en uitgestuurde leerlingen doen niet mee" });
    aanw.addEventListener("click", () => { alleenAanwezig = !alleenAanwezig; aanw.setAttribute("aria-pressed", String(alleenAanwezig)); aanw.blur(); bouw(); });
    s.extra.append(seg, maat, aanw, this.fotoKnop(DT, () => this.fotos(DT, res.lln).then(() => bouw())));
    s.laag.classList.add("dt-pk-tafel");
    await this.fotos(DT, res.lln);
    if (this._scherm !== s) return;

    const beurten = () => {
      let b = this._beurten.get(res.afspraak);
      if (!b) { b = { geweest: [] }; this._beurten.set(res.afspraak, b); }
      return b;
    };
    const klas = (res.titel.match(/\s-\s([^(]+?)\s*\(/) || [])[1] || "";
    let actie = null;   // wat de spatiebalk nu doet

    const bouw = () => {
      [...seg.children].forEach((b) => b.setAttribute("aria-checked", String(b.dataset.k === modus)));
      maat.hidden = modus !== "groepjes";
      const lijst = deelnemers();
      const podium = DT.el("div", { class: "dt-pk-podium" });
      const onder = DT.el("div", { class: "dt-pk-onder" });
      const strook = DT.el("div", { class: "dt-pk-strook" });
      s.inhoud.replaceChildren(DT.el("div", { class: "dt-pk-licht", "aria-hidden": "true" }),
        DT.el("div", { class: "dt-pk-kop", text: modus === "beurt" ? "Ultimate klas  /  beurt reveal" : "Ultimate klas  /  team reveal" }), podium, strook, onder);
      if (!lijst.length) { podium.append(DT.el("p", { class: "dt-lt-leeg", text: "Er doen geen leerlingen mee." })); actie = null; return; }

      if (modus === "beurt") {
        const team = ["Volgende beurt", "★", "#F5D76E", "#B8860B"];
        const b = beurten();
        const ids = new Set(lijst.map((l) => l.id));
        b.geweest = b.geweest.filter((id) => ids.has(id));
        const rest = lijst.length - b.geweest.length || lijst.length;
        const pak = this.maakPakje(DT, { titel: "Volgende beurt", sub: klas, emoji: "★", kleur: team[2], kleur2: team[3], aantal: `${rest} in de stapel` });
        podium.append(pak.el);
        const hint = DT.el("p", { class: "dt-lt-hint", text: "Klik om het pack te openen  ·  of druk op de spatiebalk" });
        onder.append(hint);
        actie = () => {
          actie = null; hint.remove();
          let pot = lijst.filter((l) => !b.geweest.includes(l.id));
          if (!pot.length) { b.geweest = []; pot = lijst.slice(); }
          const wie = pot[Math.floor(Math.random() * pot.length)];
          b.geweest.push(wie.id);
          this.openPakje(DT, pak, podium, [wie], { kleur: team[2], kleur2: team[3], team: "Aan de beurt", emoji: "★", badge: klas || "Beurt",
            label: klas ? `Klas ${klas}` : "Volgende beurt", zeldzaam: "Goud", woord: "Beurt", band: `Volgende beurt${klas ? ` · Klas ${klas}` : ""}`, tease: wie.init, teaseLabel: "Aan de beurt" }, () => {
            const over = lijst.length - b.geweest.length;
            const volgende = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: over ? "Volgende beurt" : "Iedereen is geweest · opnieuw" });
            volgende.addEventListener("click", bouw);
            onder.append(DT.el("p", { class: "dt-lt-stand", text: over ? `Nog ${over} ${over === 1 ? "leerling" : "leerlingen"} in de stapel` : "Iedereen heeft een beurt gehad" }), volgende);
            actie = bouw;
          });
        };
        pak.el.addEventListener("click", () => actie && actie());
        return;
      }

      /* Groepjes: per groepje een pakje */
      const groepen = this.verdeel(lijst, grootte);
      const teams = this.TEAMS.slice().sort(() => Math.random() - .5);
      let gi = 0;
      const volgendPakje = () => {
        onder.replaceChildren(); podium.replaceChildren();
        const [naam, emoji, kleur, kleur2] = teams[gi % teams.length];
        const g = groepen[gi];
        const pak = this.maakPakje(DT, { titel: `Groepje ${gi + 1}`, sub: naam, emoji, kleur, kleur2, aantal: `${g.length} kaarten · ${gi + 1} van ${groepen.length}` });
        podium.append(pak.el);
        const hint = DT.el("p", { class: "dt-lt-hint", text: "Klik om het pack te openen  ·  of druk op de spatiebalk" });
        onder.append(hint);
        actie = () => {
          actie = null; hint.remove();
          this.openPakje(DT, pak, podium, g, { kleur, kleur2, team: `${emoji} ${naam}`, emoji, badge: `Groep ${gi + 1}`,
            label: `Groepje ${gi + 1} van ${groepen.length}`, zeldzaam: `${g.length} spelers`, woord: naam, band: `Team ${naam} · ${g.length} spelers${klas ? ` · Klas ${klas}` : ""}`, tease: emoji, teaseLabel: "Jullie team" }, () => {
            const laatste = gi === groepen.length - 1;
            const verder = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: laatste ? "Alle groepjes bekijken" : `Volgend groepje (${gi + 2} van ${groepen.length})` });
            const klaar = () => {
              strook.append(DT.el("div", { class: "dt-pk-chip", style: `--kleur:${kleur};--kleur2:${kleur2}` }, [DT.el("b", { text: `${emoji} ${naam}` }), DT.el("span", { text: g.map((l) => l.naam).join(", ") })]));
              gi++;
              if (laatste) overzicht(); else volgendPakje();
            };
            verder.addEventListener("click", klaar);
            onder.append(verder);
            actie = klaar;
          });
        };
        pak.el.addEventListener("click", () => actie && actie());
      };
      const overzicht = () => {
        podium.replaceChildren(); strook.replaceChildren(); onder.replaceChildren();
        const veld = DT.el("div", { class: "dt-pk-overzicht" });
        groepen.forEach((g, k) => {
          const [naam, emoji, kleur, kleur2] = teams[k % teams.length];
          veld.append(DT.el("section", { class: "dt-pk-groep", style: `--kleur:${kleur};--kleur2:${kleur2};animation-delay:${k * 70}ms` }, [
            DT.el("h3", {}, [DT.el("span", { text: emoji }), DT.el("span", { text: naam })]),
            DT.el("div", { class: "dt-pk-groepkaarten" }, g.map((l) => this.kaartEl(DT, l, { kleur, kleur2, team: naam, emoji, badge: `Groep ${k + 1}`, open: true }))),
          ]));
        });
        podium.replaceWith(veld);
        const opnieuw = DT.el("button", { type: "button", class: "dt-lt-hoofdknop", text: "Nieuwe groepjes" });
        opnieuw.addEventListener("click", bouw);
        onder.append(DT.el("p", { class: "dt-lt-stand", text: `${lijst.length} leerlingen in ${groepen.length} groepjes` }), opnieuw);
        actie = bouw;
      };
      volgendPakje();
    };

    /* Spatiebalk: pakje openen of de volgende stap */
    const toets = (e) => {
      if (e.key !== " " || e.target.closest?.("select, input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      actie && actie();
    };
    document.addEventListener("keydown", toets);
    s.bijSluiten(() => document.removeEventListener("keydown", toets));
    /* Pakje kantelt mee met de muis */
    const kantel = (e) => {
      const p = s.inhoud.querySelector(".dt-pk:not(.is-open)"); if (!p) return;
      const r = p.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      p.style.setProperty("--ry", `${(x * 34).toFixed(2)}deg`); p.style.setProperty("--rx", `${(-y * 22).toFixed(2)}deg`);
      p.style.setProperty("--gx", `${(50 + x * 120).toFixed(1)}%`); p.style.setProperty("--gy", `${(35 + y * 90).toFixed(1)}%`);
    };
    s.laag.addEventListener("pointermove", kantel);
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

  maakPakje(DT, { titel, sub, emoji, kleur, kleur2, aantal }) {
    const el = DT.el("button", { type: "button", class: "dt-pk", style: `--kleur:${kleur};--kleur2:${kleur2}`, "aria-label": `${titel}${sub ? `, ${sub}` : ""}: pakje openen` }, [
      DT.el("div", { class: "dt-pk-schaduw" }),
      DT.el("div", { class: "dt-pk-lijf" }, [
        DT.el("div", { class: "dt-pk-achter" }),
        DT.el("div", { class: "dt-pk-zij l" }), DT.el("div", { class: "dt-pk-zij r" }),
        DT.el("div", { class: "dt-pk-stapel" }, [DT.el("i"), DT.el("i"), DT.el("i")]),
        DT.el("div", { class: "dt-pk-voor" }, [
          DT.el("div", { class: "dt-pk-folie" }),
          DT.el("div", { class: "dt-pk-zegel b" }),
          DT.el("div", { class: "dt-pk-zegel o" }),
          DT.el("div", { class: "dt-pk-embleem" }, DT.el("span", { text: emoji })),
          DT.el("div", { class: "dt-pk-titel", text: titel }),
          sub ? DT.el("div", { class: "dt-pk-sub", text: sub }) : null,
          DT.el("div", { class: "dt-pk-aantal", text: aantal }),
          DT.el("div", { class: "dt-pk-glans" }),
        ]),
        DT.el("div", { class: "dt-pk-strip" }, [DT.el("div", { class: "dt-pk-folie" }), DT.el("div", { class: "dt-pk-zegel b" })]),
      ]),
    ]);
    return { el };
  },

  /* Openen: schudden, de scheurstrip vliegt eraf, de kaarten schuiven omhoog uit het pakje, het pakje
   * zakt weg en de kaarten waaieren uit en draaien om. */
  openPakje(DT, pak, podium, lln, stijl, daarna) {
    const rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = pak.el;
    el.classList.add("is-open");
    const n = lln.length;
    const kaarten = lln.map((l) => this.kaartEl(DT, l, stijl));
    const waaier = DT.el("div", { class: "dt-pk-waaier", style: `--n:${n}` }, kaarten);
    const toon = () => {
      el.classList.add("is-weg"); setTimeout(() => el.remove(), 750);
      /* Kaartmaat: één kaart groot; een groepje zo groot als in de breedte past. */
      const vak = podium.getBoundingClientRect();
      const kh = n === 1 ? Math.min(vak.height * .9, innerWidth * .5 * 1.4) : Math.min(vak.height * .8, (vak.width * .86 / (n * .86 + .3)) * 1.4);
      const kw = kh / 1.4, stap = n > 1 ? Math.min(kw * .84, (vak.width * .9 - kw) / (n - 1)) : 0;
      waaier.style.setProperty("--kh", `${Math.round(kh)}px`);
      podium.append(waaier);
      if (stijl.team && n > 1) podium.prepend(DT.el("div", { class: "dt-pk-teamnaam", style: `--kleur:${stijl.kleur}`, text: stijl.team }));
      kaarten.forEach((k, i) => {
        const mid = i - (n - 1) / 2;
        const hoek = n > 1 ? mid * Math.min(7, 30 / n) : 0;
        const x = mid * stap, y = Math.abs(mid) * Math.abs(mid) * kh * .012 + (n > 1 ? kh * .06 : 0);
        k.style.setProperty("--x", `${x.toFixed(0)}px`); k.style.setProperty("--y", `${y.toFixed(0)}px`); k.style.setProperty("--r", `${hoek.toFixed(1)}deg`);
        k.style.setProperty("--d", `${rustig ? 0 : 120 + i * 220}ms`);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => kaarten.forEach((k) => k.classList.add("is-uit"))));
      if (!rustig) setTimeout(() => this.vonken(DT, podium), 500 + n * 220);
      setTimeout(daarna, rustig ? 0 : 900 + n * 220);
    };
    if (rustig) return toon();
    el.classList.add("is-schud");
    setTimeout(() => { el.classList.remove("is-schud"); el.classList.add("is-scheur"); }, 700);
    setTimeout(() => this.walkout(DT, stijl, toon), 1000);
  },

  /* Onthulling in de stijl van een Ultimate Team-"walkout": witte flits, lichttunnel met draaiende
   * stralen, aanwijzingen die één voor één verschijnen (groepje, aantal), een groot omlijnd woord dat
   * voorbijschuift, een lichtkrant, dan een gloeiende hint (initialen of teamdier) en een flits naar de
   * kaarten. "Direct naar kaart" slaat het over. */
  walkout(DT, stijl, klaar) {
    const s = this._scherm; if (!s) return klaar();
    const wo = DT.el("div", { class: "dt-wo", style: `--kleur:${stijl.kleur};--kleur2:${stijl.kleur2}`, "aria-hidden": "true" }, [
      DT.el("div", { class: "dt-wo-tunnel" }, Array.from({ length: 10 }, (_, i) => DT.el("i", { style: `animation-delay:${(-i * .32).toFixed(2)}s` }))),
      DT.el("div", { class: "dt-wo-stralen" }, Array.from({ length: 6 }, (_, i) => DT.el("i", { style: `--h:${i * 30}deg` }))),
      DT.el("div", { class: "dt-wo-label", text: stijl.label || "" }),
      DT.el("div", { class: "dt-wo-zeldzaam", text: stijl.zeldzaam || "" }),
      DT.el("div", { class: "dt-wo-woord", text: stijl.woord || "" }),
      DT.el("div", { class: "dt-wo-band" }, DT.el("span", { text: `${stijl.band || ""}     ✦     `.repeat(10) })),
      DT.el("div", { class: "dt-wo-tease" }, [DT.el("small", { text: stijl.teaseLabel || "" }), DT.el("b", { text: stijl.tease || "" })]),
      DT.el("div", { class: "dt-wo-flits" }),
    ]);
    const sla = DT.el("button", { type: "button", class: "dt-wo-sla", text: "Direct naar kaart →" });
    wo.append(sla);
    const timers = [];
    let klaarGezet = false;
    const eind = () => {
      if (klaarGezet) return; klaarGezet = true;
      timers.forEach(clearTimeout);
      wo.classList.add("f-eind");
      klaar();
      setTimeout(() => wo.remove(), 700);
    };
    sla.addEventListener("click", eind);
    s.inhoud.append(wo);
    for (const [t, c] of [[30, "f1"], [450, "f2"], [1200, "f3"], [2400, "f4"], [2600, "f5"]]) timers.push(setTimeout(() => wo.classList.add(c), t));
    timers.push(setTimeout(eind, 4300));
    s.bijSluiten(() => timers.forEach(clearTimeout));
  },

  kaartEl(DT, l, { kleur, kleur2, team, emoji = "★", badge = "", open = false }) {
    return DT.el("div", { class: `dt-pk-kaart${open ? " is-open" : ""}`, style: `--kleur:${kleur};--kleur2:${kleur2}` }, DT.el("div", { class: "dt-pk-k3d" }, [
      DT.el("div", { class: "dt-pk-kachter" }, DT.el("span", { text: "★" })),
      DT.el("div", { class: "dt-pk-kvoor" }, [
        DT.el("div", { class: "dt-pk-kbadge" }, [DT.el("b", { text: emoji }), DT.el("small", { text: badge })]),
        DT.el("div", { class: "dt-pk-kraam" }, this.gezicht(DT, l, "dt-pk-gezicht")),
        DT.el("div", { class: "dt-pk-knaam", text: l.naam }),
        DT.el("div", { class: "dt-pk-kteam", text: team || "" }),
        DT.el("span", { class: "dt-pk-holo" }),
        DT.el("span", { class: "dt-pk-kglans" }),
      ]),
    ]));
  },

  vonken(DT, waar) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const laag = DT.el("div", { class: "dt-lt-vonken", "aria-hidden": "true" });
    const kleur = ["#FFD54A", "#FF6482", "#64D2FF", "#30D158", "#BF5AF2", "#FFFFFF"];
    for (let i = 0; i < 46; i++) {
      const h = Math.random() * Math.PI * 2, k = 140 + Math.random() * 260;
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
      .dt-lt.dt-sf { background: #F6EBCF; color: #3B2A12; }
      .dt-sf .dt-lt-knop, .dt-sf .dt-lt-pil { color: #3B2A12; background: rgba(255,255,255,.62); }
      .dt-sf .dt-lt-pil[aria-pressed="true"] { background: #3B2A12; color: #fff; }
      .dt-sf .dt-lt-seg, .dt-sf .dt-lt-schuif { background: rgba(255,255,255,.55); color: #3B2A12; }
      .dt-sf .dt-lt-seg button { color: #3B2A12; }
      .dt-sf .dt-lt-seg button[aria-checked="true"] { background: #3B2A12; color: #fff; }
      .dt-sf .dt-lt-schuif input { accent-color: #8C5A2B; }
      .sf-scene { position: absolute; inset: 0; width: 100%; height: 100%; transition: filter 1s ease; }
      .dt-sf.is-druk .sf-scene { filter: sepia(.5) saturate(.7) brightness(.93) contrast(.95); }
      .sf-zongloed { animation: sf-adem 5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
      .sf-wolken { animation: sf-wolk 120s linear infinite alternate; }
      .sf-dier { transition: transform 1s cubic-bezier(.3,.9,.3,1); }
      .sf-plek:not(.is-buiten) .sf-dier { transition: transform .6s linear; }
      .dt-sf.is-druk .sf-plek:not(.is-buiten) .sf-dier { transition: transform .35s cubic-bezier(.6,0,.9,.5); }
      .sf-plek.is-vlucht .sf-dier { transition: transform 1.2s cubic-bezier(.55,0,.85,.55); }
      .sf-loop { transform-box: fill-box; transform-origin: 50% 100%; }
      .sf-plek.is-buiten:not(.is-vlucht) .sf-loop { animation: sf-loop 10s ease-in-out infinite; }
      .sf-plek.is-buiten:nth-child(odd) .sf-loop { animation-duration: 13s; animation-delay: -4s; }
      .sf-plek.is-vlucht .sf-loop { animation: sf-ren .32s ease-in-out infinite; }
      .sf-emoji { filter: drop-shadow(0 4px 3px rgba(60,40,10,.25)); }
      .sf-stof { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 1s ease; overflow: hidden;
        background: linear-gradient(180deg, rgba(205,160,98,.35), rgba(176,124,64,.5)); }
      .dt-sf.is-druk .sf-stof { opacity: .85; }
      .dt-sf.is-storm .sf-stof { opacity: 1; background: linear-gradient(180deg, rgba(190,140,80,.55), rgba(150,100,45,.65)); }
      .sf-stof i { position: absolute; left: 105%; width: .7vh; height: .7vh; border-radius: 50%; background: rgba(255,238,205,.85); animation: sf-waai 2s linear infinite; }
      .sf-hoos { position: absolute; width: 16vh; height: 16vh; left: -20vh; animation: sf-hoos 9s linear infinite; }
      .sf-hoos svg { width: 100%; height: 100%; animation: sf-draai 1.4s linear infinite; }
      .sf-hoos.h0 { top: 18%; } .sf-hoos.h1 { top: 48%; animation-delay: -3s; } .sf-hoos.h2 { top: 66%; animation-delay: -6.2s; width: 12vh; height: 12vh; }
      .sf-boven { position: absolute; top: 66px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 4; pointer-events: none; }
      .sf-status, .sf-klok, .sf-teller { display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 18px; border-radius: 999px; font: 700 clamp(14px, 1.15vw, 19px)/1 var(--dt-font);
        background: rgba(255,255,255,.72); color: #3B2A12; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); box-shadow: 0 4px 16px rgba(80,50,10,.12); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .sf-status i { width: 11px; height: 11px; border-radius: 50%; background: #9A8F80; }
      .sf-status[data-soort="rustig"] i { background: #30B158; box-shadow: 0 0 0 4px rgba(48,177,88,.22); }
      .sf-status[data-soort="luister"] i { background: #0A84FF; animation: sf-knipper 1s ease-in-out infinite; }
      .sf-status[data-soort="druk"], .sf-status[data-soort="fout"] { background: rgba(215,58,45,.9); color: #fff; }
      .sf-status[data-soort="druk"] i, .sf-status[data-soort="fout"] i { background: #fff; }
      .sf-status[data-soort="nieuw"] { background: rgba(48,177,88,.92); color: #fff; }
      .sf-status[data-soort="nieuw"] i { background: #fff; }
      .sf-klok:empty { display: none; }
      .sf-onder { position: absolute; left: 50%; bottom: 2.6vh; transform: translateX(-50%); width: min(980px, 88vw); display: flex; align-items: center; gap: 10px; z-index: 4; }
      .sf-meter { position: relative; flex: 1; height: 26px; border-radius: 999px; background: rgba(70,45,15,.28); box-shadow: inset 0 1px 3px rgba(0,0,0,.2); overflow: hidden;
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
      .sf-meter i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #46C267, #A6DB5C); transition: width .1s linear; }
      .sf-meter i.is-hard { background: linear-gradient(90deg, #F2994A, #E5484D); }
      .sf-meter b { position: absolute; top: 3px; bottom: 3px; width: 3px; margin-left: -1.5px; border-radius: 2px; background: #C0392B; }
      .sf-getal { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
      .sf-pauze { appearance: none; border: 0; height: 40px; padding: 0 22px; border-radius: 999px; font: 700 15px/1 var(--dt-font); background: rgba(255,255,255,.85); color: #3B2A12; cursor: pointer; box-shadow: 0 4px 16px rgba(80,50,10,.15); }
      .sf-kaart { position: absolute; inset: 0; display: grid; place-items: center; z-index: 6; background: rgba(60,40,15,.22); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
      .sf-kaart[hidden] { display: none; }
      .sf-paneel { width: min(580px, 88vw); box-sizing: border-box; padding: 34px 36px 28px; border-radius: 30px; background: rgba(255,251,242,.96); color: #3B2A12; text-align: center;
        box-shadow: 0 30px 80px rgba(60,35,5,.35); display: flex; flex-direction: column; align-items: center; gap: 14px; animation: dt-lt-vervaag .4s ease both; }
      .sf-paneelemoji { font-size: 54px; line-height: 1; }
      .sf-paneel h2 { margin: 0; font-size: clamp(26px, 2.6vw, 40px); font-weight: 800; letter-spacing: -.02em; }
      .sf-paneel p { margin: 0; font-size: clamp(15px, 1.2vw, 19px); line-height: 1.45; color: #5C4A30; }
      .sf-paneel small { font-size: 12px; color: #8A7655; }
      .sf-duren { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
      .sf-duren button { appearance: none; border: 0; height: 36px; padding: 0 16px; border-radius: 999px; font: 700 14px/1 var(--dt-font); background: rgba(60,40,15,.08); color: #3B2A12; cursor: pointer; }
      .sf-duren button[aria-pressed="true"] { background: #3B2A12; color: #fff; }
      .sf-paneel .dt-lt-hoofdknop { color: #fff; background: linear-gradient(180deg, #D98A3E, #B5651D); box-shadow: 0 10px 24px rgba(181,101,29,.35), inset 0 1px 0 rgba(255,255,255,.35); }
      .sf-rustbalk { display: flex; align-items: center; gap: 10px; width: 100%; }
      .sf-rustbalk span { flex: 1; height: 12px; border-radius: 999px; background: rgba(60,40,15,.12); overflow: hidden; }
      .sf-rustbalk i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #46C267, #A6DB5C); }
      .sf-rustbalk b { font-size: 15px; color: #2E7D46; }
      @keyframes sf-loop { 0% { transform: translate(-26px, 0) scaleX(-1); } 22% { transform: translate(0, -4px) scaleX(-1); } 45% { transform: translate(26px, 0) scaleX(-1); }
        50% { transform: translate(26px, 0) scaleX(1); } 72% { transform: translate(0, -4px) scaleX(1); } 95% { transform: translate(-26px, 0) scaleX(1); } 100% { transform: translate(-26px, 0) scaleX(-1); } }
      @keyframes sf-ren { 50% { transform: translateY(-8px) rotate(-4deg); } }
      @keyframes sf-adem { to { transform: scale(1.08); } }
      @keyframes sf-wolk { to { transform: translateX(160px); } }
      @keyframes sf-waai { to { transform: translate(-125vw, 6vh); } }
      @keyframes sf-hoos { 0% { transform: translateX(0); opacity: 0; } 10%, 85% { opacity: 1; } 100% { transform: translateX(130vw); opacity: 0; } }
      @keyframes sf-draai { to { transform: rotate(-360deg); } }
      @keyframes sf-knipper { 50% { opacity: .3; } }

      /* --- Kaartenpakje --- */
      .dt-lt.dt-pk-tafel { background:
        radial-gradient(60% 50% at 50% 42%, rgba(80,140,255,.28), transparent 70%),
        radial-gradient(ellipse at 50% 30%, #23338A 0%, #121A52 48%, #070A24 100%); }
      .dt-lt-inhoud:has(.dt-pk-waaier, .dt-pk-overzicht) .dt-pk-kop { opacity: 0; }
      .dt-pk-kop { transition: opacity .3s; }
      .dt-pk-kop { position: absolute; top: 74px; left: 0; right: 0; text-align: center; font: 800 clamp(11px, .9vw, 15px)/1 var(--dt-font); letter-spacing: .32em; text-transform: uppercase; color: rgba(255,255,255,.6); }
      .dt-pk-tafel::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .12; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
      .dt-pk-licht { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(42% 36% at 50% 46%, rgba(255,250,230,.12), transparent 70%); }
      .dt-pk-podium { position: absolute; inset: 64px 0 172px; display: grid; place-items: center; perspective: 1700px; }
      .dt-pk-podium > * { grid-area: 1 / 1; }
      .dt-pk-onder { position: absolute; left: 0; right: 0; bottom: 3.2vh; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
      .dt-pk-strook { position: absolute; left: 3vw; right: 3vw; bottom: calc(3.2vh + 70px); display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; pointer-events: none; }
      .dt-pk-chip { display: flex; align-items: center; gap: 8px; max-width: 34vw; padding: 7px 14px 7px 10px; border-radius: 12px; font: 500 13px/1.2 var(--dt-font); color: #fff;
        background: color-mix(in srgb, var(--kleur2) 55%, rgba(0,0,0,.35)); box-shadow: inset 4px 0 0 var(--kleur), 0 6px 16px rgba(0,0,0,.25); animation: dt-lt-vervaag .45s ease both; }
      .dt-pk-chip b { white-space: nowrap; font-weight: 800; }
      .dt-pk-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .9; }

      .dt-pk { appearance: none; border: 0; padding: 0; background: none; cursor: pointer; position: relative; height: min(48vh, 64vw); aspect-ratio: 5 / 7.4; transform-style: preserve-3d;
        --rx: 0deg; --ry: 0deg; --gx: 40%; --gy: 30%; font-family: var(--dt-font); color: #fff; }
      .dt-pk:focus-visible { outline: none; }
      .dt-pk:focus-visible .dt-pk-voor { outline: 3px solid #FFD54A; outline-offset: 6px; }
      .dt-pk-schaduw { position: absolute; left: 8%; right: 8%; bottom: -9%; height: 9%; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.6), transparent);
        filter: blur(6px); animation: dt-pk-schaduw 3.4s ease-in-out infinite; }
      .dt-pk::after { content: ""; position: absolute; inset: -12%; border-radius: 40px; pointer-events: none; z-index: -1;
        background: radial-gradient(closest-side, color-mix(in srgb, var(--kleur) 55%, transparent), transparent); filter: blur(30px); animation: dt-pk-gloed 2.6s ease-in-out infinite; }
      .dt-pk-lijf { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateX(calc(7deg + var(--rx))) rotateY(var(--ry)); transition: transform .3s ease-out;
        animation: dt-pk-zweef 3.4s ease-in-out infinite; }
      .dt-pk-voor, .dt-pk-achter { position: absolute; inset: 0; border-radius: 12px; }
      .dt-pk-voor { transform: translateZ(10px); overflow: hidden; display: flex; flex-direction: column; align-items: center; padding: 19% 8% 13%; box-sizing: border-box; gap: 3%;
        clip-path: polygon(0 1.6%, 3% 0, 6% 1.6%, 9% 0, 12% 1.6%, 15% 0, 18% 1.6%, 21% 0, 24% 1.6%, 27% 0, 30% 1.6%, 33% 0, 36% 1.6%, 39% 0, 42% 1.6%, 45% 0, 48% 1.6%, 51% 0, 54% 1.6%, 57% 0, 60% 1.6%, 63% 0, 66% 1.6%, 69% 0, 72% 1.6%, 75% 0, 78% 1.6%, 81% 0, 84% 1.6%, 87% 0, 90% 1.6%, 93% 0, 96% 1.6%, 100% 0,
          100% 98.4%, 97% 100%, 94% 98.4%, 91% 100%, 88% 98.4%, 85% 100%, 82% 98.4%, 79% 100%, 76% 98.4%, 73% 100%, 70% 98.4%, 67% 100%, 64% 98.4%, 61% 100%, 58% 98.4%, 55% 100%, 52% 98.4%, 49% 100%, 46% 98.4%, 43% 100%, 40% 98.4%, 37% 100%, 34% 98.4%, 31% 100%, 28% 98.4%, 25% 100%, 22% 98.4%, 19% 100%, 16% 98.4%, 13% 100%, 10% 98.4%, 7% 100%, 4% 98.4%, 0 100%); }
      .dt-pk-achter { transform: translateZ(-10px) rotateY(180deg); background: linear-gradient(160deg, var(--kleur2), color-mix(in srgb, var(--kleur2) 60%, #000)); }
      .dt-pk-zij { position: absolute; top: 2%; bottom: 2%; width: 20px; background: linear-gradient(90deg, color-mix(in srgb, var(--kleur2) 70%, #000), var(--kleur2), color-mix(in srgb, var(--kleur2) 70%, #000)); }
      .dt-pk-zij.l { left: -10px; transform: rotateY(-90deg); } .dt-pk-zij.r { right: -10px; transform: rotateY(90deg); }
      .dt-pk-folie { position: absolute; inset: 0; background:
          radial-gradient(130% 90% at 50% 45%, transparent 52%, rgba(0,0,0,.38) 100%),
          repeating-linear-gradient(100deg, rgba(255,255,255,.07) 0 1px, transparent 1px 6px),
          linear-gradient(150deg, var(--kleur) 0%, color-mix(in srgb, var(--kleur) 50%, #fff) 26%, var(--kleur) 44%, var(--kleur2) 78%, color-mix(in srgb, var(--kleur2) 70%, #000) 100%); }
      .dt-pk-folie::after { content: ""; position: absolute; inset: 0; opacity: .3; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='turbulence' baseFrequency='.012 .05' numOctaves='3' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.4 -.3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size: cover; }
      .dt-pk-zegel { position: absolute; left: 0; right: 0; background: repeating-linear-gradient(90deg, rgba(255,255,255,.3) 0 2px, rgba(0,0,0,.22) 2px 4px), color-mix(in srgb, var(--kleur2) 30%, transparent); }
      .dt-pk-zegel.b { top: 0; height: 11%; border-bottom: 2px dashed rgba(255,255,255,.55); }
      .dt-pk-zegel.o { bottom: 0; height: 8%; border-top: 1px solid rgba(255,255,255,.25); }
      .dt-pk-embleem { position: relative; width: 44%; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; flex: none;
        background: radial-gradient(circle at 34% 28%, rgba(255,255,255,.95), rgba(255,255,255,.35) 46%, rgba(255,255,255,.12) 70%);
        box-shadow: inset 0 3px 6px rgba(255,255,255,.8), inset 0 -8px 16px rgba(0,0,0,.25), 0 10px 22px rgba(0,0,0,.3), 0 0 0 4px rgba(255,255,255,.35); }
      .dt-pk-embleem span { font-size: min(9vh, 12vw); line-height: 1; filter: drop-shadow(0 4px 4px rgba(0,0,0,.3)); color: #FFD54A; }
      .dt-pk-titel { position: relative; margin-top: 4%; font-size: min(3.6vh, 4.8vw); font-weight: 900; letter-spacing: .05em; text-transform: uppercase; text-align: center; line-height: 1.05;
        text-shadow: 0 -1px 0 rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.35), 0 4px 10px rgba(0,0,0,.35); }
      .dt-pk-sub { position: relative; font-size: min(2.3vh, 3.1vw); font-weight: 800; padding: .3em .9em; border-radius: 999px; background: rgba(0,0,0,.22); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
      .dt-pk-aantal { position: relative; margin-top: auto; font-size: min(1.55vh, 2.2vw); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
      .dt-pk-glans { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
        background: radial-gradient(circle at var(--gx) var(--gy), rgba(255,255,255,.55), rgba(255,255,255,0) 38%), linear-gradient(115deg, transparent 38%, rgba(255,255,255,.22) 47%, transparent 56%); }
      .dt-pk-strip { position: absolute; left: 0; right: 0; top: 0; height: 11%; transform: translateZ(10.5px); overflow: hidden; border-radius: 12px 12px 0 0; pointer-events: none;
        clip-path: polygon(0 14.5%, 3% 0, 6% 14.5%, 9% 0, 12% 14.5%, 15% 0, 18% 14.5%, 21% 0, 24% 14.5%, 27% 0, 30% 14.5%, 33% 0, 36% 14.5%, 39% 0, 42% 14.5%, 45% 0, 48% 14.5%, 51% 0, 54% 14.5%, 57% 0, 60% 14.5%, 63% 0, 66% 14.5%, 69% 0, 72% 14.5%, 75% 0, 78% 14.5%, 81% 0, 84% 14.5%, 87% 0, 90% 14.5%, 93% 0, 96% 14.5%, 100% 0, 100% 100%, 0 100%); }
      .dt-pk-strip .dt-pk-folie { bottom: auto; height: 909%; }
      .dt-pk-strip .dt-pk-zegel.b { height: 100%; }
      .dt-pk-stapel { position: absolute; left: 9%; right: 9%; top: 8%; height: 80%; transform: translateZ(0); transition: transform .6s cubic-bezier(.3,.8,.3,1); }
      .dt-pk-stapel i { position: absolute; inset: 0; border-radius: 6%; background: repeating-linear-gradient(45deg, #5B3FD9 0 9px, #4A2FC4 9px 18px); box-shadow: inset 0 0 0 5px #fff, 0 2px 6px rgba(0,0,0,.35); }
      .dt-pk-stapel i:nth-child(2) { transform: translate(3px, 3px); } .dt-pk-stapel i:nth-child(3) { transform: translate(-3px, 5px); }
      .dt-pk.is-open { pointer-events: none; }
      .dt-pk.is-schud .dt-pk-lijf { animation: dt-pk-schud .7s ease-in-out; }
      .dt-pk.is-scheur .dt-pk-strip { animation: dt-pk-scheur .75s cubic-bezier(.3,.1,.4,1) forwards; }
      .dt-pk.is-uitschuif .dt-pk-stapel { transform: translateY(-62%); }
      .dt-pk.is-weg .dt-pk-lijf { animation: dt-pk-zak .7s cubic-bezier(.5,0,.8,.4) forwards; }
      .dt-pk.is-weg .dt-pk-schaduw { opacity: 0; transition: opacity .3s; }
      .dt-pk-teamnaam { align-self: start; margin-top: 1vh; font-size: clamp(26px, 3.4vw, 60px); font-weight: 900; letter-spacing: -.02em; color: #fff;
        text-shadow: 0 0 30px color-mix(in srgb, var(--kleur) 70%, transparent), 0 4px 12px rgba(0,0,0,.4); animation: dt-lt-vervaag .5s ease both; z-index: 2; }

      .dt-pk-waaier { position: relative; width: 0; height: 0; display: grid; place-items: center; }
      .dt-pk-kaart { position: absolute; height: var(--kh, 46vh); aspect-ratio: 5 / 7; perspective: 1500px; opacity: 0; transform: translate(0, 9vh) scale(.5);
        transition: transform .85s cubic-bezier(.2,.9,.25,1.08) var(--d, 0ms), opacity .25s ease var(--d, 0ms); }
      .dt-pk-kaart.is-uit { opacity: 1; transform: translate(var(--x, 0), var(--y, 0)) rotate(var(--r, 0deg)); }
      .dt-pk-k3d { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transform: rotateY(180deg); transition: transform 1s cubic-bezier(.3,.7,.3,1.12) calc(var(--d, 0ms) + 300ms); }
      .dt-pk-kaart.is-uit .dt-pk-k3d, .dt-pk-kaart.is-open .dt-pk-k3d { transform: none; }
      .dt-pk-kaart.is-open { position: relative; opacity: 1; transform: none; transition: none; }
      .dt-pk-kvoor, .dt-pk-kachter { position: absolute; inset: 0; border-radius: 5% / 3.6%; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden;
        box-shadow: 0 0 0 1px rgba(0,0,0,.18), 0 2px 0 #e6e6e6, 0 3px 0 #c9c9c9, 0 24px 44px rgba(0,0,0,.5); }
      .dt-pk-kachter { transform: rotateY(180deg); display: grid; place-items: center; color: #FFD54A; font-size: calc(var(--kh, 46vh) * .2);
        background: radial-gradient(circle, rgba(255,255,255,.18), transparent 60%), repeating-linear-gradient(45deg, #5B3FD9 0 10px, #4A2FC4 10px 20px); box-shadow: inset 0 0 0 calc(var(--kh, 46vh) * .025) #fff, 0 24px 44px rgba(0,0,0,.5); }
      .dt-pk-kvoor { display: flex; flex-direction: column; align-items: center; padding: 13% 9% 15%; box-sizing: border-box; gap: 2%; border-radius: 0; box-shadow: none;
        clip-path: polygon(50% 0, 62% 2.4%, 80% 2.4%, 92% 5.5%, 100% 11%, 100% 86%, 92% 92%, 64% 97%, 50% 100%, 36% 97%, 8% 92%, 0 86%, 0 11%, 8% 5.5%, 20% 2.4%, 38% 2.4%);
        background:
          linear-gradient(transparent 0 calc(100% - 3px), rgba(255,255,255,.5) 0) 50% 76% / 70% 3px no-repeat,
          repeating-linear-gradient(135deg, rgba(255,255,255,.09) 0 2px, transparent 2px 11px),
          radial-gradient(120% 70% at 50% 18%, color-mix(in srgb, var(--kleur) 40%, #fff), transparent 60%),
          linear-gradient(160deg, color-mix(in srgb, var(--kleur) 70%, #fff) 0%, var(--kleur) 38%, var(--kleur2) 100%); }
      .dt-pk-kvoor::before { content: ""; position: absolute; inset: 3%; pointer-events: none; border: 2px solid rgba(255,255,255,.45);
        clip-path: inherit; border-radius: 0; }
      .dt-pk-kbadge { position: absolute; left: 12%; top: 13%; display: flex; flex-direction: column; align-items: center; gap: 2px; z-index: 2; }
      .dt-pk-kbadge b { font-size: calc(var(--kh, 46vh) * .1); line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,.3)); }
      .dt-pk-kbadge small { font-size: calc(var(--kh, 46vh) * .028); font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: rgba(20,20,40,.75); max-width: calc(var(--kh, 46vh) * .2); text-align: center; line-height: 1.1; }
      .dt-pk-kraam { position: relative; flex: 1; width: 78%; align-self: flex-end; margin-right: -4%; overflow: hidden; background: none;
        -webkit-mask-image: linear-gradient(180deg, #000 72%, transparent 100%); mask-image: linear-gradient(180deg, #000 72%, transparent 100%); }
      .dt-pk-gezicht { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--kh, 46vh) * .2); font-weight: 900; color: rgba(255,255,255,.95); text-transform: uppercase; letter-spacing: .02em;
        text-shadow: 0 4px 14px rgba(0,0,0,.35); }
      .dt-pk-gezicht img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .dt-pk-knaam { max-width: 92%; color: #14142A; text-align: center; font-size: calc(var(--kh, 46vh) * .082); font-weight: 900; letter-spacing: .01em; text-transform: uppercase; line-height: 1.05;
        text-shadow: 0 1px 0 rgba(255,255,255,.45); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-pk-kteam { text-align: center; font-size: calc(var(--kh, 46vh) * .032); font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: rgba(20,20,40,.7); }
      .dt-pk-kteam:empty { display: none; }
      .dt-pk-holo { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: .45;
        background: linear-gradient(115deg, transparent 18%, rgba(255,0,140,.5) 30%, rgba(255,220,0,.5) 40%, rgba(0,255,200,.5) 50%, rgba(0,150,255,.5) 60%, rgba(170,80,255,.5) 70%, transparent 82%); background-size: 300% 300%;
        animation: dt-pk-holo 6s linear infinite; }
      .dt-pk-kglans { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.75) 50%, transparent 62%); transform: translateX(-130%); }
      .dt-pk-kaart.is-uit .dt-pk-kglans { animation: dt-pk-glans 1.1s ease-in-out calc(var(--d, 0ms) + 1.1s) both; }

      .dt-pk-overzicht { position: absolute; inset: 64px 3vw 150px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; align-content: center; overflow: auto; }
      .dt-pk-groep { --kh: clamp(120px, 17vh, 210px); border-radius: 22px; padding: 14px; background: rgba(0,0,0,.22); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1), inset 0 4px 0 var(--kleur); animation: dt-lt-vervaag .5s ease both; }
      .dt-pk-groep h3 { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; font-size: clamp(16px, 1.4vw, 26px); font-weight: 900; color: #fff; }
      .dt-pk-groepkaarten { display: flex; flex-wrap: wrap; gap: 10px; }
      .dt-pk-groep .dt-pk-kaart { perspective: none; }
      .dt-pk-kaart { filter: drop-shadow(0 18px 30px rgba(0,0,0,.5)); }
      .dt-pk-groep .dt-pk-kteam { display: none; }

      .dt-wo { position: absolute; inset: 0; z-index: 8; overflow: hidden; background: radial-gradient(ellipse at 50% 50%, #1B2560 0%, #080B22 70%); perspective: 600px; }
      .dt-wo-tunnel { position: absolute; inset: 0; display: grid; place-items: center; transition: opacity .6s; }
      .dt-wo-tunnel i { grid-area: 1 / 1; width: 60vmin; aspect-ratio: 1; border: 2px solid rgba(220,230,255,.5); box-shadow: 0 0 22px rgba(160,190,255,.35), inset 0 0 22px rgba(160,190,255,.25);
        background: linear-gradient(135deg, rgba(255,255,255,.06), transparent 60%); animation: dt-wo-tunnel 3.2s linear infinite; }
      .dt-wo-stralen { position: absolute; inset: 0; display: grid; place-items: center; animation: dt-wo-draai 7s linear infinite; mix-blend-mode: screen; }
      .dt-wo-stralen i { grid-area: 1 / 1; width: 4vmin; height: 160vmax; transform: rotate(var(--h)); background: linear-gradient(180deg, transparent, rgba(255,255,255,.4) 45%, rgba(255,255,255,.65) 50%, rgba(255,255,255,.4) 55%, transparent); filter: blur(6px); }
      .dt-wo-stralen i:nth-child(odd) { width: 9vmin; opacity: .5; }
      .dt-wo-label, .dt-wo-zeldzaam { position: absolute; left: 0; right: 0; text-align: center; font: 900 clamp(16px, 1.8vw, 30px)/1 var(--dt-font); letter-spacing: .22em; text-transform: uppercase; color: #fff; opacity: 0;
        text-shadow: 0 0 18px rgba(160,190,255,.8); transition: opacity .4s, transform .5s cubic-bezier(.2,.9,.3,1.2); }
      .dt-wo-label { top: 30%; transform: translateY(16px); }
      .dt-wo-zeldzaam { top: 22%; transform: translateY(-16px); color: color-mix(in srgb, var(--kleur) 60%, #fff); }
      .dt-wo.f1 .dt-wo-label, .dt-wo.f3 .dt-wo-zeldzaam { opacity: 1; transform: none; }
      .dt-wo-woord { position: absolute; top: 50%; left: 0; white-space: nowrap; transform: translate(110vw, -50%); font: 900 clamp(70px, 12vw, 220px)/1 var(--dt-font); letter-spacing: .02em; text-transform: uppercase;
        color: transparent; -webkit-text-stroke: 3px rgba(235,242,255,.95); text-shadow: 0 0 30px rgba(140,180,255,.6); }
      .dt-wo.f2 .dt-wo-woord { animation: dt-wo-woord 3.4s cubic-bezier(.15,.75,.85,.25) forwards; }
      .dt-wo-band { position: absolute; left: -5%; right: -5%; top: 66%; transform: rotate(-4deg) scaleY(0); padding: .5em 0; overflow: hidden; background: rgba(8,10,30,.55);
        border-top: 1px solid rgba(255,214,0,.5); border-bottom: 1px solid rgba(255,214,0,.5); transition: transform .35s ease; }
      .dt-wo-band span { display: inline-block; white-space: nowrap; font: 900 clamp(14px, 1.5vw, 26px)/1 var(--dt-font); letter-spacing: .12em; text-transform: uppercase; color: #FFD60A; animation: dt-wo-band 9s linear infinite; }
      .dt-wo.f3 .dt-wo-band { transform: rotate(-4deg) scaleY(1); }
      .dt-wo.f4 .dt-wo-tunnel, .dt-wo.f4 .dt-wo-stralen, .dt-wo.f4 .dt-wo-band, .dt-wo.f4 .dt-wo-woord, .dt-wo.f4 .dt-wo-label, .dt-wo.f4 .dt-wo-zeldzaam { opacity: 0; transition: opacity .5s; }
      .dt-wo-tease { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; opacity: 0; transform: scale(1.3); transition: opacity .6s, transform 1.2s cubic-bezier(.2,.8,.2,1); }
      .dt-wo-tease small { font: 800 clamp(13px, 1.2vw, 20px)/1 var(--dt-font); letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.75); }
      .dt-wo-tease b { font: 900 clamp(120px, 22vw, 380px)/1 var(--dt-font); color: #fff; letter-spacing: -.02em; text-transform: uppercase;
        text-shadow: 0 0 20px #fff, 0 0 60px color-mix(in srgb, var(--kleur) 80%, #fff), 0 0 120px color-mix(in srgb, var(--kleur) 70%, transparent); }
      .dt-wo.f5 .dt-wo-tease { opacity: 1; transform: none; }
      .dt-wo-flits { position: absolute; inset: 0; background: #fff; opacity: 1; pointer-events: none; animation: dt-wo-flits .7s ease-out forwards; }
      .dt-wo.f-eind { background: transparent; transition: background .1s; }
      .dt-wo.f-eind > :not(.dt-wo-flits) { opacity: 0 !important; transition: opacity .15s; }
      .dt-wo.f-eind .dt-wo-flits { animation: dt-wo-flits .7s ease-out forwards; animation-name: dt-wo-flits2; }
      .dt-wo-sla { position: absolute; left: 3vw; bottom: 4vh; appearance: none; border: 1px solid rgba(255,255,255,.35); border-radius: 10px; padding: 10px 16px; font: 700 14px/1 var(--dt-font); color: #fff; background: rgba(10,14,40,.6); cursor: pointer; z-index: 3; }
      .dt-wo-sla:hover { background: rgba(30,40,90,.8); }
      @keyframes dt-wo-tunnel { 0% { transform: scale(.05) rotate(0deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: scale(3.2) rotate(45deg); opacity: .15; } }
      @keyframes dt-wo-draai { to { transform: rotate(360deg); } }
      @keyframes dt-wo-woord { 0% { transform: translate(105vw, -50%); } 100% { transform: translate(calc(-100% - 5vw), -50%); } }
      @keyframes dt-wo-band { to { transform: translateX(-50%); } }
      @keyframes dt-wo-flits { from { opacity: 1; } to { opacity: 0; } }
      @keyframes dt-wo-flits2 { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes dt-pk-gloed { 50% { opacity: .55; transform: scale(.94); } }
      @keyframes dt-pk-zweef { 0%, 100% { translate: 0 0; } 50% { translate: 0 -14px; } }
      @keyframes dt-pk-schaduw { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.88); opacity: .75; } }
      @keyframes dt-pk-schud { 0%, 100% { rotate: 0deg; scale: 1; } 15% { rotate: -5deg; scale: 1.03; } 30% { rotate: 5deg; scale: 1.05; } 45% { rotate: -4deg; scale: 1.06; } 60% { rotate: 4deg; scale: 1.07; } 80% { rotate: -2deg; scale: 1.08; } }
      @keyframes dt-pk-scheur { 0% { transform: translateZ(10.5px); } 30% { transform: translateZ(14px) translateY(-6%) rotateZ(-3deg); } 100% { transform: translate3d(42%, -320%, 160px) rotateZ(34deg) rotateX(55deg); opacity: 0; } }
      @keyframes dt-pk-zak { to { translate: 0 75vh; rotate: 8deg; opacity: 0; } }
      @keyframes dt-pk-holo { to { background-position: 300% 300%; } }
      @keyframes dt-pk-glans { from { transform: translateX(-130%); } to { transform: translateX(130%); } }

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
