/* Thema's.
 * Zes thema's (Magister, Minimal, Glass, Paper, Soft, Contrast), elk behalve Magister in licht en donker, met de
 * accentkleur als tweede keuze. Magister laat de kleuren van Magister zelf staan; de andere thema's zetten de
 * designvariabelen van Magister (dna/sl) en één gedeelde opmaak.
 *
 * Dit bestand is de module zelf (toepassen, shadow DOM, eigen aanvullingen). De hulpfuncties staan in
 * theme-kleur.js, theme-pagina.js, theme-apple.js en theme-themas.js, die in manifest.json vóór dit bestand laden.
 */
DT.register({
  id: "theme",
  _style: null,
  _mq: null,

  /* De thema's en accentkleuren staan in theme-themas.js. */
  themas: DT_THEMAS,

  init(DT) {
    this._stopObs = DT.observe(() => { this.applyExtraInline(DT); this.injectShadow(DT, this._vars); this.agendaPass(DT); }, { debounce: 600, poll: 2500 });
    /* Lesdashboardkaart los en snel, anders verspringt de kop pas seconden na het laden */
    this._stopKop = DT.observe(() => { const on = !!this.preset(DT).look; lesdashKopPass(document, on); leerlingenKopPass(document, on); }, { debounce: 60, poll: 1000 });
    this._style = DT.el("style", { id: "dt-theme-style" });
    document.head.append(this._style);
    this._mq = window.matchMedia("(prefers-color-scheme: dark)");
    this._mq.addEventListener("change", () => this.apply(DT));
    this._unsub = DT.onSettingsChange(() => this.apply(DT));
    this.apply(DT);
  },

  destroy(DT) {
    this._stopObs && this._stopObs();
    this._stopKop && this._stopKop();
    this._style?.remove();
    this.accentFilter(null);
    lesdashKopPass(document, false);
    leerlingenKopPass(document, false);
    document.documentElement.classList.remove("dt-dark");
    clearRootVars();
    this._unsub && this._unsub();
  },

  /* Het palet dat nu geldt: thema + licht/donker + accentkleur (zie dtThemaPalet). */
  preset(DT) { return dtThemaPalet(DT.settings.theme, this._mq ? this._mq.matches : false); },

  isDark(DT) { return this.preset(DT).dark === true; },

  /* Alt+T: wisselt tussen licht en donker. Magister heeft alleen zijn eigen, lichte uiterlijk. */
  async toggle(DT) {
    const p = this.preset(DT);
    if (p.id === "magister") return DT.toast("Het thema Magister heeft geen donkere variant. Kies Minimal, Glass, Paper, Soft of Contrast in het zijpaneel.", "info", 5000);
    const next = p.dark ? "light" : "dark";
    await DT.saveSettings({ theme: { mode: next } });
    DT.toast(`${p.label} · ${next === "dark" ? "donker" : "licht"}`);
  },

  apply(DT) {
    const s = DT.settings.theme;
    const p = this.preset(DT);
    const dark = p.dark;
    document.documentElement.classList.toggle("dt-dark", dark);
    document.documentElement.dataset.dtThema = p.id;

    const accent = p.accent;
    const ink = contrastInk(accent);
    let css = `
      :root { --dt-accent: ${accent}; --dt-accent-ink: ${ink}; }
      button[class*="primary"], .btn-primary, [class*="button--primary"], input[type="submit"] {
        background-color: ${accent} !important; border-color: ${accent} !important; color: ${ink} !important;
      }
    `;
    const zoom = { normal: 1, compact: 0.9, extra: 0.8 }[s.density || "normal"] || 1;
    if (zoom !== 1) css += ` ui-view[name="main"] { zoom: ${zoom}; } td, th { padding-top: 2px !important; padding-bottom: 2px !important; }`;
    /* Lettertype en hoeken: van het thema, tenzij je er bij de instellingen zelf een hebt gekozen. */
    const eigenFont = !(s.font === "thema" || !s.font);
    const fontStack = FONTS[eigenFont ? s.font : (p.font || "standaard")];
    css += fontCss(fontStack, Number(s.fontScale) || 1);
    const eigenHoek = !(s.radius === "thema" || !s.radius);
    const radius = eigenHoek ? s.radius : p.radius;
    if (radius) css += ` :root { --sl-size-borderRadius-default: ${radius} !important; --sl-size-borderRadius-md: ${radius} !important; --sl-size-borderRadius-lg: ${radius} !important; --sl-size-borderRadius-xl: ${radius} !important; --dt-radius: ${radius}; }
      .widget, .mg-panel, .content-pane, .ui-grid, button, .btn, input, select, textarea, .dt-btn { border-radius: ${radius} !important; }`;

    clearRootVars();
    this._vars = null;
    const root = document.documentElement.style;
    this._shadowCss = "";
    if (p.look) {
      /* Het palet van het thema, met het gekozen lettertype erin (de opmaak noemt het lettertype op veel plekken). */
      const q = eigenFont ? { ...p, font: s.font } : p;
      css += tokenCss(q, dark);
      this._vars = tokenMap(q);
      for (const [k, v] of Object.entries(this._vars)) root.setProperty(k, v);
      root.setProperty("--dt-bg", p.surface); root.setProperty("--dt-fg", p.fg);
      root.setProperty("--dt-line", p.border); root.setProperty("--dt-muted", p.muted);
      if (fontStack) {
        this._vars = { ...this._vars, "--dna-font-family-base": fontStack, "--dna-font-family-header": fontStack };
        root.setProperty("--dna-font-family-base", fontStack); root.setProperty("--dna-font-family-header", fontStack);
      }
      const vorm = eigenHoek ? null : p.vorm;   // een zelf gekozen hoek gaat voor de vorm van het thema
      css += dtMagisterKleurenCss(q);   // vaste blauwtinten van Magister, voor zover de opmaak ze niet zelf regelt
      css += dtHoeken(appleCss(q, dark, accent), vorm);
      this._shadowCss = dtHoeken(appleShadowCss(q, dark, accent), vorm);
      root.setProperty("--sl-color-background-primary-bold", accent);
      root.setProperty("--sl-color-border-primary-bold", accent);
      root.setProperty("--sl-color-background-selected-bold", accent);
      css += this.extraCss(DT);
      css += dtHoeken(appleShellCss(q, dark, accent), vorm);
      this.accentFilter(accent);
    } else {
      this.accentFilter(null);
      if (fontStack) {
        this._vars = { "--dna-font-family-base": fontStack, "--dna-font-family-header": fontStack };
        root.setProperty("--dna-font-family-base", fontStack); root.setProperty("--dna-font-family-header", fontStack);
      }
      css += this.extraCss(DT);
    }
    this._style.textContent = css;
    this.applyExtraInline(DT);
    if (this._stopObs) this.injectShadow(DT, this._vars);
  },

  /* Afbeeldingen in het menu (Cijfers is een svg-bestand, geen pictogram) nemen geen tekstkleur over. Dit filter
   * vervangt de kleur van elke pixel door de accentkleur en laat de doorzichtigheid staan. */
  accentFilter(accent) {
    let svg = document.getElementById("dt-filters");
    if (!accent) { svg?.remove(); return; }
    const m = dtKleurMatrix(accent);
    if (!m) return;
    if (!svg) {
      const NS = "http://www.w3.org/2000/svg";
      svg = document.createElementNS(NS, "svg");
      svg.id = "dt-filters";
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none");
      const f = document.createElementNS(NS, "filter");
      f.id = "dt-accent-filter";
      f.setAttribute("color-interpolation-filters", "sRGB");
      const fe = document.createElementNS(NS, "feColorMatrix");
      fe.setAttribute("type", "matrix");
      f.append(fe); svg.append(f);
      document.documentElement.append(svg);
    }
    const fe = svg.querySelector("feColorMatrix");
    if (fe.getAttribute("values") !== m) fe.setAttribute("values", m);
  },

  /* Agenda: kleur per vak of klas (Apples agendapalet) en voorbije afspraken dimmen. Alleen bij look-thema's. */
  agendaPass(DT) {
    const p = this.preset(DT);
    const mode = p.look ? (DT.settings.theme.agendaKleur || "vak") : "geen";
    agendaColorPass(document, mode, this.isDark(DT));
    if (p.look) { agendaToolbarPass(document); dashboardPass(document, this.isDark(DT)); }
    lesdashKopPass(document, !!p.look);
  },

  /* Themavariabelen ook binnen elke shadow root zetten (componenten die ze op :host herdefiniëren). */
  injectShadow(DT, vars) {
    const css = (vars ? `:host { ${Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join(" ")} }` : "") + (this._shadowCss || "");
    // Bron voor content/shadowroots.js (hoofdwereld): die zet deze tekst in elke shadow root bij het
    // aanmaken, ook in gesloten roots en roots die pas later ontstaan. Hieronder blijft de zoekslag
    // als vangnet voor roots die al bestonden voordat dat script liep.
    let src = document.getElementById("dt-shadow-src");
    if (!src) { src = document.createElement("script"); src.type = "text/x-dt-css"; src.id = "dt-shadow-src"; document.head.append(src); }
    if (src.textContent !== css) src.textContent = css;
    walkAll(document.documentElement, (el) => {
      const sr = el.shadowRoot; if (!sr) return;
      let st = sr.getElementById("dt-shadow-tokens");
      if (!css) { st?.remove(); return; }
      if (!st) { st = document.createElement("style"); st.id = "dt-shadow-tokens"; sr.append(st); }
      if (st.textContent !== css) st.textContent = css;
    });
  },

  /* Eigen aanvullingen via Inspector (C): selector + rol. */
  roleColors(DT) {
    const p = this.preset(DT);
    const accent = p.accent;
    const pal = p.bg ? p : { bg: "#f5f7fa", surface: "#ffffff", surface2: "#eef1f5", border: "#d6dce4", fg: "#1a1d21" };
    return {
      achtergrond: { bg: pal.bg, fg: pal.fg },
      vlak: { bg: pal.surface, fg: pal.fg },
      accent: { bg: accent, fg: contrastInk(accent) },
      tekst: { fg: accent }
    };
  },

  extraCss(DT) {
    const list = DT.settings.theme.extra || [];
    if (!list.length) return "";
    const roles = this.roleColors(DT);
    return list.map(({ sel, role }) => {
      const r = roles[role] || roles.vlak;
      return `${sel} { ${r.bg ? `background: ${r.bg} !important; background-color: ${r.bg} !important;` : ""} ${r.fg ? `color: ${r.fg} !important;` : ""} border-color: ${r.bg || r.fg} !important; }`;
    }).join("\n");
  },

  applyExtraInline(DT) {
    // In shadow DOM werkt de stylesheet niet: daar inline zetten.
    const list = DT.settings?.theme?.extra || [];
    DT.deepQueryAll("[data-dt-themed]").forEach((e) => { if (!list.some((x) => x.sel === e.dataset.dtThemed)) { e.style.removeProperty("background"); e.style.removeProperty("background-color"); e.style.removeProperty("color"); delete e.dataset.dtThemed; } });
    if (!list.length) return;
    const roles = this.roleColors(DT);
    for (const { sel, role } of list) {
      const r = roles[role] || roles.vlak;
      for (const e of DT.deepQueryAll(sel)) {
        if (!(e.getRootNode() instanceof ShadowRoot)) continue;
        if (r.bg) { e.style.setProperty("background", r.bg, "important"); e.style.setProperty("background-color", r.bg, "important"); }
        if (r.fg) e.style.setProperty("color", r.fg, "important");
        e.dataset.dtThemed = sel;
      }
    }
  },

  async addExtra(DT, sel, role) {
    const list = (DT.settings.theme.extra || []).filter((x) => x.sel !== sel);
    list.push({ sel, role });
    await DT.saveSettings({ theme: { extra: list } });
    DT.toast(`Kleurt nu mee als ${role}. Ongedaan maken: instellingen > Thema > Eigen aanvullingen`, "ok", 3500);
  }
});
