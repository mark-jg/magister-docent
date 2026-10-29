/* Thema's.
 * Kies een preset (licht of donker) of stel zelf een accentkleur in.
 * Donkere presets werken op twee manieren:
 *  - "Inversie": kleurinversie van de hele pagina, werkt op alle schermen.
 *  - "Echte kleuren": overschrijft de designsysteem-variabelen van Magister (dna/sl).
 *    Mooier op de nieuwe schermen; oude AngularJS-schermen krijgen een basisbehandeling.
 * Lichte presets kleuren altijd via de variabelen (geen inversie nodig).
 */
DT.register({
  id: "theme",
  _style: null,
  _mq: null,

  presets: {
    magister:   { label: "Magister (standaard)", dark: false, accent: "#056dc2", custom: false },
    mca:        { label: "MCA blauw",            dark: false, accent: "#1B3A5C", bg: "#f7f8fa", surface: "#ffffff", surface2: "#eef1f5", border: "#d6dce4", fg: "#1a1d21", muted: "#5b6572", link: "#1B3A5C" },
    zand:       { label: "Zand (warm licht)",    dark: false, accent: "#8a5a1e", bg: "#f6f1e8", surface: "#fffdf8", surface2: "#efe7d9", border: "#d9cdb8", fg: "#2a2520", muted: "#6b6054", link: "#8a5a1e" },
    mint:       { label: "Mint (rustig licht)",  dark: false, accent: "#0e7767", bg: "#f2f8f6", surface: "#ffffff", surface2: "#e4f0ec", border: "#c9ddd6", fg: "#172320", muted: "#55665f", link: "#0e7767" },
    contrast:   { label: "Hoog contrast licht",  dark: false, accent: "#000000", bg: "#ffffff", surface: "#ffffff", surface2: "#f0f0f0", border: "#000000", fg: "#000000", muted: "#333333", link: "#0000cc" },
    nacht:      { label: "Nacht (donkergrijs)",  dark: true,  accent: "#6fbcfb", bg: "#1a1d21", surface: "#20242a", surface2: "#2a3038", border: "#3d454f", fg: "#e3e7ec", muted: "#aab3bf", link: "#6fbcfb" },
    marine:     { label: "Marine (donkerblauw)", dark: true,  accent: "#E8B84A", bg: "#0f1b2d", surface: "#162640", surface2: "#1f3252", border: "#2f466b", fg: "#e6edf7", muted: "#a9b7cc", link: "#8fc1ff" },
    bos:        { label: "Bos (donkergroen)",    dark: true,  accent: "#7dd3a8", bg: "#101a16", surface: "#17241f", surface2: "#1f302a", border: "#2f473d", fg: "#e2efe8", muted: "#a3b8ad", link: "#7dd3a8" },
    oled:       { label: "Zwart (OLED)",         dark: true,  accent: "#ffffff", bg: "#000000", surface: "#0c0c0c", surface2: "#181818", border: "#303030", fg: "#f2f2f2", muted: "#b0b0b0", link: "#8ab4f8" },
    sepia:      { label: "Sepia (avondlezen)",   dark: true,  accent: "#e0b36a", bg: "#2b2419", surface: "#352d20", surface2: "#413829", border: "#5a4d37", fg: "#efe4cf", muted: "#c2b39a", link: "#e0b36a" },
    krant:      { label: "Krant (serif, scherp)",      dark: false, accent: "#111111", bg: "#f3efe6", surface: "#faf7f0", surface2: "#ebe5d8", border: "#1a1a1a", fg: "#111111", muted: "#555555", link: "#8a1c1c", font: "serif", radius: "0px" },
    pastel:     { label: "Pastel (zacht, rond)",       dark: false, accent: "#c2609f", bg: "#fbf3f8", surface: "#ffffff", surface2: "#f4e4ee", border: "#e6c9da", fg: "#3b2a35", muted: "#7f6878", link: "#9b3f7c", font: "rond", radius: "16px" },
    retro:      { label: "Retro (jaren 70)",            dark: false, accent: "#d2691e", bg: "#f1e3c6", surface: "#f9efd9", surface2: "#e9d7ad", border: "#b8955a", fg: "#3b2a14", muted: "#7a6240", link: "#9c3d12", font: "serif", radius: "4px" },
    terminal:   { label: "Terminal (groen op zwart)",  dark: true,  accent: "#33ff66", bg: "#050805", surface: "#0b120c", surface2: "#122015", border: "#1f5a2a", fg: "#b8f5c5", muted: "#5fbf74", link: "#33ff66", font: "mono", radius: "0px" },
    synthwave:  { label: "Synthwave (paars/roze)",     dark: true,  accent: "#ff4fd8", bg: "#140b2b", surface: "#1d1140", surface2: "#2a1a57", border: "#4b2e8f", fg: "#f3e8ff", muted: "#b39ddb", link: "#5ef0ff", font: "systeem", radius: "10px" },
    oceaan:     { label: "Oceaan (fris blauw)",        dark: false, accent: "#0369a1", bg: "#e8f4fb", surface: "#ffffff", surface2: "#d6eaf6", border: "#a9cfe6", fg: "#0b2a3f", muted: "#4b6b80", link: "#0369a1", font: "rond", radius: "12px" },
    /* Apple: systeemkleuren en -lettertype uit de Human Interface Guidelines, zachte hoeken,
     * scheidingslijnen in plaats van randen, doorschijnende balken (look: "apple"). */
    apple:      { label: "Apple (licht)",              dark: false, accent: "#007AFF", bg: "#F2F2F7", surface: "#FFFFFF", surface2: "#F5F5F7", border: "#D1D1D6", fg: "#1D1D1F", muted: "#6E6E73", link: "#007AFF", font: "apple", radius: "10px", look: "apple" },
    appleGlass: { label: "Apple Glass (licht)",        dark: false, accent: "#007AFF", bg: "#EEF1F8", surface: "#FFFFFF", surface2: "#F2F2F7", border: "#D1D1D6", fg: "#1D1D1F", muted: "#6E6E73", link: "#007AFF", font: "apple", radius: "14px", look: "apple", glass: true },
    appleGlassDonker: { label: "Apple Glass (donker)", dark: true,  accent: "#0A84FF", bg: "#16161C", surface: "#2C2C2E", surface2: "#3A3A3C", border: "#48484A", fg: "#F5F5F7", muted: "#98989D", link: "#0A84FF", font: "apple", radius: "14px", look: "apple", glass: true, darkStyle: "tokens" },
    appleDonker:{ label: "Apple (donker)",             dark: true,  accent: "#0A84FF", bg: "#1C1C1E", surface: "#2C2C2E", surface2: "#3A3A3C", border: "#48484A", fg: "#F5F5F7", muted: "#98989D", link: "#0A84FF", font: "apple", radius: "10px", look: "apple", darkStyle: "tokens" },
    custom:     { label: "Eigen accentkleur",    dark: null }
  },

  init(DT) {
    this._stopObs = DT.observe(() => { this.applyExtraInline(DT); this.injectShadow(DT, this._vars); this.recolor(DT); }, { debounce: 600, poll: 2500 });
    this._style = DT.el("style", { id: "dt-theme-style" });
    document.head.append(this._style);
    this._mq = window.matchMedia("(prefers-color-scheme: dark)");
    this._mq.addEventListener("change", () => this.apply(DT));
    this._unsub = DT.onSettingsChange(() => this.apply(DT));
    this.apply(DT);
  },

  destroy(DT) {
    this._stopObs && this._stopObs();
    this._style?.remove();
    document.documentElement.classList.remove("dt-dark");
    clearRootVars();
    this._unsub && this._unsub();
  },

  preset(DT) { return this.presets[DT.settings.theme.preset] || this.presets.custom; },

  /* Donkere stijl: een preset kan "tokens" afdwingen (bijv. Apple donker), anders de instelling. */
  darkStyle(DT) { return this.preset(DT).darkStyle || DT.settings.theme.darkStyle || "invert"; },

  isDark(DT) {
    const p = this.preset(DT);
    if (p.dark === true) return true;
    if (p.dark === false) return false;
    const mode = DT.settings.theme.mode;
    return mode === "dark" || (mode === "auto" && this._mq.matches);
  },

  /* Alt+T: wisselt tussen je lichte en je donkere preset. */
  async toggle(DT) {
    const s = DT.settings.theme;
    const p = this.preset(DT);
    if (p.dark === null) {
      const next = this.isDark(DT) ? "light" : "dark";
      await DT.saveSettings({ theme: { mode: next } });
      return DT.toast(next === "dark" ? "Donker thema" : "Licht thema");
    }
    const target = p.dark ? (s.lightPreset || "magister") : (s.darkPreset || "nacht");
    await DT.saveSettings({ theme: { preset: target, [p.dark ? "darkPreset" : "lightPreset"]: s.preset } });
    DT.toast(this.presets[target]?.label || target);
  },

  apply(DT) {
    const s = DT.settings.theme;
    const p = this.preset(DT);
    const dark = this.isDark(DT);
    document.documentElement.classList.toggle("dt-dark", dark);

    const accent = p.dark === null ? (s.accent || "#1B3A5C") : (p.accent || s.accent);
    const ink = contrastInk(accent);
    let css = `
      :root { --dt-accent: ${accent}; --dt-accent-ink: ${ink}; }
      button[class*="primary"], .btn-primary, [class*="button--primary"], input[type="submit"] {
        background-color: ${accent} !important; border-color: ${accent} !important; color: ${ink} !important;
      }
    `;
    const zoom = { normal: 1, compact: 0.9, extra: 0.8 }[s.density || "normal"] || 1;
    if (zoom !== 1) css += ` ui-view[name="main"] { zoom: ${zoom}; } td, th { padding-top: 2px !important; padding-bottom: 2px !important; }`;
    const fontStack = FONTS[s.font === "thema" || !s.font ? (p.font || "standaard") : s.font];
    css += fontCss(fontStack, Number(s.fontScale) || 1);
    const radius = s.radius === "thema" || !s.radius ? p.radius : s.radius;
    if (radius) css += ` :root { --sl-size-borderRadius-default: ${radius} !important; --sl-size-borderRadius-md: ${radius} !important; --sl-size-borderRadius-lg: ${radius} !important; --sl-size-borderRadius-xl: ${radius} !important; --dt-radius: ${radius}; }
      .widget, .mg-panel, .content-pane, .ui-grid, button, .btn, input, select, textarea, .dt-btn { border-radius: ${radius} !important; }`;

    clearRootVars();
    this._vars = null;
    this._sig = [s.preset, s.accent, dark ? 1 : 0, s.darkStyle].join("|");
    const root = document.documentElement.style;
    if (p.bg) {
      const useInvert = dark && this.darkStyle(DT) === "invert";
      if (useInvert) {
        css += invertCss(accent, ink);
      } else {
        css += tokenCss(p, dark);
        this._vars = tokenMap(p);
        for (const [k, v] of Object.entries(this._vars)) root.setProperty(k, v);
        root.setProperty("--dt-bg", p.surface); root.setProperty("--dt-fg", p.fg);
        root.setProperty("--dt-line", p.border); root.setProperty("--dt-muted", p.muted);
      }
    } else if (dark) {
      css += invertCss(accent, ink);
    }
    if (fontStack) {
      this._vars = { ...(this._vars || {}), "--dna-font-family-base": fontStack, "--dna-font-family-header": fontStack };
      root.setProperty("--dna-font-family-base", fontStack); root.setProperty("--dna-font-family-header", fontStack);
    }
    this._shadowCss = "";
    if (p.look === "apple" && (!dark || this.darkStyle(DT) !== "invert")) {
      css += appleCss(p, dark, accent);
      this._shadowCss = appleShadowCss(p, dark, accent);
    }
    if (p.custom !== false) {
      root.setProperty("--sl-color-background-primary-bold", accent);
      root.setProperty("--sl-color-border-primary-bold", accent);
      root.setProperty("--sl-color-background-selected-bold", accent);
    }
    css += this.extraCss(DT, p, dark, accent, ink);
    if (p.look === "apple" && (!dark || this.darkStyle(DT) !== "invert")) css += appleShellCss(p, dark, accent);
    this._style.textContent = css;
    this.applyExtraInline(DT);
    if (this._stopObs) { this.injectShadow(DT, this._vars); this.recolor(DT); }
  },

  /* Welke vervangkleur hoort bij een gevonden blauw. */
  shadeFor(DT, c, kind) {
    const p = this.preset(DT), dark = this.isDark(DT);
    const accent = p.dark === null ? (DT.settings.theme.accent || "#1B3A5C") : (p.accent || DT.settings.theme.accent);
    const surface = p.surface || (dark ? "#20242a" : "#ffffff");
    const link = p.link || accent;
    const l = toHsl(c).l;
    let hex;
    if (kind === "color" || kind === "fill") hex = l > .75 && dark ? mix(link, "#ffffff", .3) : link;
    else if (l > .88) hex = mix(accent, surface, .9);
    else if (l > .75) hex = mix(accent, surface, .75);
    else if (l > .55) hex = mix(accent, surface, .35);
    else if (l < .3) hex = mix(accent, "#000000", .35);
    else hex = accent;
    const { r, g, b } = hex2rgb(hex);
    return c.a < 1 ? `rgba(${r}, ${g}, ${b}, ${c.a})` : `rgb(${r}, ${g}, ${b})`;
  },

  recolor(DT) {
    const p = this.preset(DT);
    const active = DT.settings.theme.enabled !== false && DT.settings.theme.preset !== "magister" && String(DT.settings.theme.recolor) !== "false"
      && !(this.isDark(DT) && this.darkStyle(DT) === "invert") && !p.look; // look-thema's (Apple) kleuren alles via CSS en tokens
    const props = [["color", "color"], ["background-color", "background-color"], ["border-top-color", "border-color"], ["border-bottom-color", "border-color"], ["border-left-color", "border-color"], ["fill", "fill"]];
    if (!active) {
      // Eerder gezette inline kleuren één keer opruimen, niet bij elke poll opnieuw de hele DOM langs.
      if (this._cleaned === this._sig) return;
      walkAll(document.documentElement, (el) => { if (el.dataset?.dtRc) { for (const [, prop] of props) el.style.removeProperty(prop); el.style.removeProperty("border-top-color"); el.style.removeProperty("border-bottom-color"); el.style.removeProperty("border-left-color"); delete el.dataset.dtRc; } });
      this._cleaned = this._sig;
      return;
    }
    const sig = this._sig;
    const shell = p.look ? ".appbar-host, .menu-host, nav.menu, .menu-container, .menu-footer, .appbar, mg-appbar, .logo, .logo *, .appbar-host *, section.main, .container > ui-view" : null;
    let budget = 6000;
    walkAll(document.documentElement, (el) => {
      if (budget-- <= 0) return;
      if (el.id && el.id.startsWith("dt-")) return;
      // Een look-thema (Apple) stuurt de schil en alle componenten (shadow DOM, dna-*/sl-*) zelf via
      // tokens; inline kleuren van de vertaler zouden daar altijd winnen, dus wegblijven en opruimen.
      const inComponent = p.look && (el.localName.includes("-") || el.getRootNode() instanceof ShadowRoot);
      if ((shell && el.matches && el.matches(shell)) || inComponent) {
        if (el.dataset.dtRc) { for (const [, prop] of props) el.style.removeProperty(prop); ["border-top-color", "border-bottom-color", "border-left-color", "border-right-color"].forEach((x) => el.style.removeProperty(x)); delete el.dataset.dtRc; }
        return;
      }
      if (el.closest && el.closest("#dt-panel, #dt-table-menu, #dt-palette, #dt-ai-dialog, #dt-export-dialog, #dt-toasts, #dt-handle, #dt-role-menu, #dt-inspect-bar")) return;
      if (/^(script|style|link|meta|head|title|br|img|video|canvas|iframe)$/i.test(el.localName)) return;
      if (el.dataset.dtRc === sig) return;
      // Eerder vervangen met een ander thema: eerst terugzetten.
      if (el.dataset.dtRc) for (const prop of ["color", "background-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color", "fill"]) el.style.removeProperty(prop);
      const cs = getComputedStyle(el);
      let changed = false;
      for (const [cssProp, kind] of props) {
        if (kind === "fill" && !(el instanceof SVGElement)) continue;
        const c = parseColor(cs.getPropertyValue(cssProp));
        if (!isMagisterBlue(c)) continue;
        const v = this.shadeFor(DT, c, kind);
        if (kind === "border-color") el.style.setProperty(cssProp, v, "important");
        else el.style.setProperty(cssProp, v, "important");
        changed = true;
      }
      el.dataset.dtRc = sig;
      if (!changed) return;
    });
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
    const dark = this.isDark(DT);
    const accent = p.dark === null ? (DT.settings.theme.accent || "#1B3A5C") : (p.accent || DT.settings.theme.accent);
    const pal = p.bg ? p : (dark ? this.presets.nacht : { bg: "#f5f7fa", surface: "#ffffff", surface2: "#eef1f5", border: "#d6dce4", fg: "#1a1d21" });
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

const FONTS = {
  standaard: "",
  systeem: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  apple: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', system-ui, 'Segoe UI', Helvetica, Arial, sans-serif",
  rond: "'Avenir Next Rounded', 'Nunito', 'Segoe UI', 'Trebuchet MS', 'Varela Round', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', 'Iowan Old Style', serif",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, 'Courier New', monospace",
  speels: "'Chalkboard SE', 'Comic Sans MS', 'Comic Neue', cursive",
  smal: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif",
  dyslexie: "'OpenDyslexic', 'Comic Sans MS', Verdana, sans-serif"
};

/* Lettertype op tekst, niet op icoonfonts (Font Awesome, dna-icon, sl-icon). */
function fontCss(stack, scale) {
  let css = "";
  if (stack) css += `
    html, body, body :not(i):not([class*="fa-"]):not(.ico):not([class*="icon"]):not(dna-icon):not(sl-icon):not(svg):not(path) { font-family: ${stack} !important; }
    :root { --dt-font: ${stack}; }`;
  if (scale && scale !== 1) css += ` html { font-size: ${Math.round(scale * 100)}% !important; }`;
  return css;
}

/* ---------- Kleurvertaler ----------
 * Loopt de berekende kleuren van zichtbare elementen na (ook in shadow DOM) en
 * vervangt Magister-blauw door de bijpassende tint van de accentkleur. Nodig voor
 * plekken waar Magister vaste kleuren gebruikt in plaats van variabelen. */
function parseColor(c) {
  const m = c && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}
function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const isMagisterBlue = (c) => { if (!c || c.a < .05) return false; const { h, s } = toHsl(c); return h >= 192 && h <= 222 && s > .45; };
function hex2rgb(h) { const n = h.replace("#", ""); return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) }; }

function walkAll(root, fn) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let n = tw.currentNode.nodeType === 1 ? tw.currentNode : tw.nextNode();
  while (n) { fn(n); if (n.shadowRoot) walkAll(n.shadowRoot, fn); n = tw.nextNode(); }
}

function clearRootVars() {
  const root = document.documentElement.style;
  [...root].filter((n) => n.startsWith("--sl-") || n.startsWith("--background") || n.startsWith("--chrome") || /text-color$/.test(n) || n.startsWith("--dt-") || n.startsWith("--dna-")).forEach((n) => root.removeProperty(n));
}

function invertCss(accent, ink) {
  return `
    html.dt-dark { background: #121418 !important; filter: invert(0.92) hue-rotate(180deg); }
    html.dt-dark img, html.dt-dark video, html.dt-dark canvas, html.dt-dark svg image,
    html.dt-dark [style*="background-image"], html.dt-dark picture, html.dt-dark iframe,
    html.dt-dark .dt-no-invert { filter: invert(1) hue-rotate(180deg); }
    html.dt-dark #dt-panel, html.dt-dark #dt-handle, html.dt-dark #dt-toasts, html.dt-dark #dt-inspect-bar,
    html.dt-dark #dt-palette, html.dt-dark #dt-ai-dialog, html.dt-dark #dt-export-dialog,
    html.dt-dark #dt-table-chip, html.dt-dark #dt-table-menu, html.dt-dark #dt-table-frame { filter: invert(1) hue-rotate(180deg); }
    html.dt-dark ::selection { background: ${accent}; color: ${ink}; }
  `;
}

/* Mengt twee hexkleuren (t = 0 geeft a, t = 1 geeft b). */
function mix(a, b, t) {
  const h = (x) => x.replace("#", "").match(/.{2}/g).map((v) => parseInt(v, 16));
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  return "#" + [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/* Vertaalt een preset-palet naar de variabelen van Magister's designsysteem. */
function tokenMap(p) {
  const grey = {
    "000": p.dark ? p.bg : p.surface, "050": p.dark ? p.surface : p.bg, 100: p.surface2,
    150: mix(p.surface2, p.border, .3), 200: mix(p.surface2, p.border, .6), 300: p.border,
    400: mix(p.border, p.muted, .3), 500: mix(p.border, p.muted, .7), 600: p.muted,
    700: mix(p.muted, p.fg, .5), 800: mix(p.muted, p.fg, .8), 900: p.fg
  };
  const accent2 = mix(p.accent, p.dark ? "#000000" : "#000000", .25);
  const m = {
    "--primary-background": p.accent, "--secondary-background": accent2, "--background-1": p.accent, "--background-10": accent2,
    "--background-11": mix(p.accent, p.surface, .85), "--background-12": mix(p.accent, p.surface, .7),
    "--background-4": p.dark ? mix(p.fg, p.surface, .35) : mix(p.fg, p.surface, .25), "--background-6": p.dark ? p.fg : mix(p.fg, p.surface, .2),
    "--chrome-background": p.bg, "--background-2": p.surface, "--background-5": p.bg, "--background-7": p.surface2, "--background-3": p.border, "--background-8": p.border,
    "--secondary-text-color": p.fg, "--primary-text-color": p.link, "--tertiary-text-color": p.link, "--quaternary-text-color": p.link,
    "--sl-color-white": p.surface, "--sl-color-black": p.fg,
    "--sl-color-foreground-plain": p.fg, "--sl-color-foreground-bold": p.fg,
    "--sl-color-foreground-accent-grey-plain": p.fg, "--sl-color-foreground-accent-grey-bold": p.fg,
    "--sl-color-foreground-accent-grey-subtle": mix(p.muted, p.fg, .5), "--sl-color-foreground-accent-grey-subtlest": p.muted, "--sl-color-foreground-accent-grey-faint": p.border,
    "--sl-color-foreground-info-plain": p.link, "--sl-color-foreground-info-bold": p.link, "--sl-color-foreground-brand": p.link,
    "--sl-color-link-idle": p.link, "--sl-color-link-hover": mix(p.link, p.fg, .3), "--sl-color-link-active": mix(p.link, p.fg, .5),
    "--sl-color-link-muted-idle": p.muted, "--sl-color-link-muted-hover": p.link, "--sl-color-link-focused-idle": p.link,
    "--sl-color-background-input-plain": p.surface, "--sl-color-background-inverted-bold": p.surface,
    "--sl-color-background-neutral-bold": grey[200], "--sl-color-background-neutral-interactive-plain": grey[300], "--sl-color-background-neutral-interactive-bold": grey[400],
    "--sl-color-background-accent-grey-interactive-plain": grey[200], "--sl-color-background-accent-grey-interactive-bold": grey[300],
    "--sl-color-background-disabled": grey[150], "--sl-color-skeleton-plain": grey[100], "--sl-color-skeleton-subtle": grey["050"],
    "--sl-color-border-plain": p.border, "--sl-color-border-neutral-plain": p.border, "--sl-color-border-accent-grey-plain": p.border,
    "--sl-color-border-accent-grey-faint": grey[150], "--sl-color-border-input": grey[400], "--sl-color-border-bold": grey[500],
    "--sl-color-border-neutral-bold": grey[500], "--sl-color-border-disabled": grey[150], "--sl-color-border-inverted": p.surface,
    "--sl-color-background-primary-bold": p.accent, "--sl-color-border-primary-bold": p.accent, "--sl-color-background-selected-bold": p.accent, "--sl-color-border-selected": p.accent,
    "--sl-color-background-highlight": p.dark ? "#4a3f10" : "#fff3b0"
  };
  // Magister-blauw (palette + interactief) vervangen door een accentschaal.
  const a = p.accent;
  const blue = { "050": mix(a, p.surface, .94), 100: mix(a, p.surface, .88), 150: mix(a, p.surface, .78), 200: mix(a, p.surface, .65), 300: mix(a, p.surface, .45),
    400: a, 500: mix(a, "#000000", .1), 600: mix(a, "#000000", .2), 700: mix(a, "#000000", .32), 800: mix(a, "#000000", .5), 900: mix(a, "#000000", .65) };
  for (const [k, v] of Object.entries(blue)) m[`--sl-color-palette-blue-${k}`] = v;
  Object.assign(m, {
    "--sl-color-border-focused": a, "--sl-color-border-info-bold": a, "--sl-color-border-info-plain": a, "--sl-color-border-secondary-plain": a,
    "--sl-color-background-interactive-plain": a, "--sl-color-background-primary-interactive-plain": a, "--sl-color-background-selected-interactive-plain": a,
    "--sl-color-background-info-bold": a, "--sl-color-background-info-interactive-plain": a, "--sl-color-background-input-interactive": a,
    "--sl-color-background-secondary-bold": blue[150], "--sl-color-border-secondary-bold": blue[150],
    "--sl-color-background-primary-subtle": blue[150], "--sl-color-background-primary-subtlest": blue[100],
    "--sl-color-background-selected-subtle": blue[150], "--sl-color-background-selected-subtlest": blue[100],
    "--sl-color-background-info-subtle": blue[150], "--sl-color-background-info-subtlest": blue[100],
    "--sl-color-foreground-accent-blue-plain": p.link, "--sl-color-foreground-accent-blue-bold": p.link
  });
  if (p.dark) Object.assign(m, { "--sl-color-shadow-overlay1": "rgba(0,0,0,.3)", "--sl-color-shadow-overlay2": "rgba(0,0,0,.5)", "--sl-color-shadow-overflow1": "rgba(0,0,0,.5)", "--sl-color-blanket-plain": "rgba(0,0,0,.7)" });
  for (const [k, v] of Object.entries(grey)) m[`--sl-color-palette-grey-${k}`] = v;
  return m;
}

/* Basisbehandeling voor de oude AngularJS-schermen, die geen variabelen gebruiken. */
function tokenCss(p, dark) {
  return `
    html, body { background: ${p.bg} !important; color: ${p.fg} !important; ${dark ? "color-scheme: dark;" : ""} }
    div.container, ui-view[name="main"] { background: ${p.bg} !important; }
    .appbar-host, mg-appbar, div.appbar { background: ${mix(p.accent, "#000000", .25)} !important; }
    .menu-host, nav.menu, .menu-container { background: ${dark ? p.surface : p.accent} !important; }
    .menu-footer, .menu-footer a { background: ${dark ? p.surface2 : mix(p.accent, "#000000", .15)} !important; color: ${dark ? p.fg : "#ffffff"} !important; }
    ul.main-menu li a, ul.main-menu li span.caption { color: ${dark ? p.fg : "#ffffff"} !important; }
    ul.main-menu li.active > a, ul.main-menu li[class*="active"] > a, ul.main-menu li a[class*="active"], ul.main-menu li[class*="selected"] > a { background: ${dark ? p.accent : mix(p.accent, "#ffffff", .25)} !important; color: ${dark ? contrastInk(p.accent) : "#ffffff"} !important; }
    ui-view[name="main"] h1, dna-page-header, .page-title, .head-bar h1 { color: ${p.accent} !important; }
    /* Kopbalken en de strook erboven (lesdashboard, leerlingdetail, guest apps) */
    .head-bar, .page-header, [class*="page-header"], [class*="header-bar"], [class*="headerbar"], .top-bar, [class*="topbar"],
    header:not(#dt-panel *), mg-guest-app, mg-guest-app .fill-viewport, #guest-app-frame, .main-header, .detail-header, [class*="detail-header"] {
      background-color: ${p.surface} !important; color: ${p.fg} !important; border-color: ${p.border} !important;
    }
    .head-bar, .page-header, [class*="page-header"], header:not(#dt-panel *), .main-header, .detail-header, [class*="detail-header"] {
      box-shadow: inset 0 -3px 0 ${p.accent} !important;
    }
    ui-view[name="main"], ui-view[name="main"] > *, .strip-padding { background-color: ${p.bg} !important; }
    .tabs, ul.tabs, .page-nav, [role=tablist] { background-color: ${p.surface} !important; border-color: ${p.border} !important; }
    .tabs li.active a, ul.tabs li.active a, [role=tab][aria-selected=true] { color: ${p.accent} !important; border-color: ${p.accent} !important; }
    ui-view[name="main"] h1 span, .head-bar h1 a { color: ${p.accent} !important; }
    .widget, .mg-panel, .content-pane, .head-bar, section.main { background: ${p.surface} !important; color: ${p.fg} !important; }
    .ui-grid, .ui-grid-header, .ui-grid-row, .ui-grid-cell, .ui-grid-top-panel, .ui-grid-footer-panel { background: ${p.surface} !important; color: ${p.fg} !important; border-color: ${p.border} !important; }
    .ui-grid-row:nth-child(even) .ui-grid-cell { background: ${p.surface2} !important; }
  `;
}

/* ---------- Apple-look ----------
 * Gebouwd op Magisters eigen selectors (op-shell, magister-lvs, op-detailkaarten) en op de
 * CSS-variabelen van de dna-webcomponenten, naar de Human Interface Guidelines:
 * één accent (systeemblauw), SF Pro, gegroepeerde grijze achtergrond met witte vlakken,
 * hairlines in plaats van randen, 10px/14px hoeken, een lichte zijbalk met blauwe selectie,
 * doorschijnende balken, een focusring van 3px in het accent en tabbladen als segmentknop. */
function rgba(hex, a) { const { r, g, b } = hex2rgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; }
function hslParts(hex) { const { h, s, l } = toHsl(hex2rgb(hex)); return { h: Math.round(h), s: `${Math.round(s * 100)}%`, l: `${Math.round(l * 100)}%` }; }

function applePalette(p, dark, accent) {
  return {
    accent, dark,
    bg: p.bg, surface: p.surface, surface2: p.surface2, fg: p.fg, muted: p.muted, border: p.border,
    sep: dark ? "rgba(84, 84, 88, .65)" : "rgba(60, 60, 67, .29)",
    sepSoft: dark ? "rgba(84, 84, 88, .45)" : "rgba(60, 60, 67, .16)",
    line: dark ? "#3A3A3C" : "#E3E3E8",
    sidebar: dark ? "#1C1C1E" : "#F2F2F7",
    hover: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.045)",
    tint: rgba(accent, dark ? .22 : .12),
    tintStrong: rgba(accent, dark ? .32 : .18),
    hair: `0 0 0 .5px ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.07)"}`,
    card: dark ? "0 0 0 .5px rgba(255,255,255,.09), 0 1px 3px rgba(0,0,0,.45)" : "0 0 0 .5px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.06)",
    pop: dark ? "0 0 0 .5px rgba(255,255,255,.1), 0 16px 48px rgba(0,0,0,.6)" : "0 0 0 .5px rgba(0,0,0,.08), 0 16px 48px rgba(0,0,0,.16)",
    material: dark ? "rgba(28, 28, 30, .75)" : "rgba(242, 242, 247, .78)",
    gray6: dark ? "#3A3A3C" : "#E5E5EA",
    red: dark ? "#FF453A" : "#FF3B30", orange: dark ? "#FF9F0A" : "#FF9500", green: dark ? "#30D158" : "#34C759",
    focus: `0 0 0 3px ${rgba(accent, .35)}`,
    font: FONTS.apple,
    glass: Boolean(p.glass),
    // Liquid Glass: doorschijnend materiaal met vervaging en een lichtrand bovenaan
    glassBg: dark ? "rgba(44, 44, 46, .5)" : "rgba(255, 255, 255, .48)",
    glassStrong: dark ? "rgba(44, 44, 46, .78)" : "rgba(255, 255, 255, .8)",
    glassSide: dark ? "rgba(28, 28, 30, .5)" : "rgba(255, 255, 255, .36)",
    glassEdge: dark ? "inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 .5px rgba(255,255,255,.1)" : "inset 0 1px 0 rgba(255,255,255,.85), inset 0 0 0 .5px rgba(255,255,255,.55)",
    glassShadow: dark ? "0 18px 50px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.25)" : "0 18px 50px rgba(31, 41, 61, .14), 0 2px 6px rgba(31, 41, 61, .05)",
    blur: "saturate(180%) blur(28px)"
  };
}

/* Variabelen van Magisters designsysteem (body) en van de dna-componenten (host). Deze regels
 * worden zowel in het document als in elke shadow root gezet. */
function appleTokens(t) {
  const h = hslParts(t.accent);
  const body = `
    --dna-color-scheme: ${t.dark ? "dark" : "light"} !important;
    --dna-primary-hue: ${h.h} !important; --dna-primary-sat: ${h.s} !important; --dna-primary-lum: ${h.l} !important;
    --dna-primary: ${t.accent} !important; --dna-primary-text: #ffffff !important;
    --dna-secondary: ${t.orange} !important; --dna-secondary-hue: 35 !important; --dna-secondary-sat: 100% !important; --dna-secondary-lum: 50% !important;
    --dna-danger: ${t.red} !important; --dna-danger-hue: 3 !important; --dna-danger-sat: 100% !important; --dna-danger-lum: 59% !important;
    --dna-success: ${t.green} !important; --dna-warning: ${t.orange} !important;
    --dna-text-color: ${t.fg} !important; --dna-text-color-dark: ${t.fg} !important; --dna-text-color-light: #ffffff !important;
    --dna-background: ${t.bg} !important; --dna-foreground: ${t.surface} !important;
    --dna-control-background: ${t.surface} !important; --dna-control-border: ${t.border} !important; --dna-control-foreground: ${t.border} !important;
    --dna-radius-small: 8px !important; --dna-button-border-radius: 10px !important; --dna-button-border-width: 1px !important;
    --dna-font-family-base: ${t.font} !important; --dna-font-family-header: ${t.font} !important;
    --dna-font-size-normal: .875rem !important; --dna-line-height-normal: 1.25rem !important;
    --dna-badge-border-radius: 6px !important;
    /* SL-ontwerpsysteem (aanwezigheid, leerlingenlijst, roosters) */
    --sl-elevation-surface-base-default: ${t.glass ? "transparent" : t.bg} !important;
    --sl-elevation-surface-raised-default: ${t.surface} !important; --sl-elevation-surface-raised-alternative: ${t.surface2} !important; --sl-elevation-surface-raised-sunken: ${t.surface2} !important;
    --sl-elevation-surface-raised-primary: ${t.accent} !important; --sl-elevation-surface-raised-inverted: ${t.fg} !important;
    --sl-elevation-shadow-sm: ${t.card} !important; --sl-elevation-shadow-md: ${t.card} !important; --sl-elevation-shadow-lg: ${t.pop} !important; --sl-elevation-shadow-overlay: ${t.pop} !important; --sl-elevation-shadow-overflow: ${t.pop} !important;
    --sl-color-border-plain: ${t.line} !important; --sl-color-border-neutral-plain: ${t.line} !important; --sl-color-border-accent-grey-plain: ${t.line} !important; --sl-color-border-accent-grey-faint: ${t.line} !important;
    --sl-opacity-interactive-plain-hover: ${t.dark ? ".08" : ".05"} !important; --sl-opacity-interactive-plain-active: ${t.dark ? ".14" : ".1"} !important;
    --sl-text-new-typeset-fontWeight-semiBold: 600 !important;
  `;
  return `
    :root, body { ${body} }
  ` + withPrivateTwins(`
    /* Omgekeerde (blauwe) paginakop en broodkruimels: rustig, zonder vlak */
    dna-page-header, dna-page-header[invert] { --background-color: transparent !important; --inverted-background-color: transparent !important; --color: ${t.fg} !important; position: static !important; }
    dna-breadcrumbs, dna-breadcrumb { --background: transparent !important; --border-color: transparent !important; --color: ${t.muted} !important; --link-color: ${t.muted} !important; --separator-color: ${t.border} !important; --box-shadow: none !important; --font-weight: 500 !important; }
    /* Tegels (aanwezigheid e.d.) */
    dna-link-card { --border-radius: 20px !important; --border-width: 0 !important; --border: 0 !important; --box-shadow: ${t.card} !important; background-color: ${t.surface} !important;
      --arrow-background: ${t.tint} !important; --arrow-color: ${t.accent} !important; --arrow-size: 36px !important; --arrow-position: auto 1rem 1rem auto !important; --arrow-padding: 0 !important;
      --heading-font: 600 1.0625rem/1.4 ${t.font} !important; --description-font: .8125rem/1.35 ${t.font} !important; --padding: 1.25rem 1.25rem 3.5rem !important; --heading-margin: .75rem 0 .25rem !important;
      --image-primary: ${rgba(t.accent, .3)} !important; --image-secondary: ${t.accent} !important; }
    dna-link-card p { color: ${t.muted}; }
    dna-link-card { --image-size: 2.25rem !important; --_image-size: 2.25rem !important; --width: 17rem !important; --_width: 17rem !important; aspect-ratio: auto !important; min-block-size: 13.5rem; block-size: 100%; transition: transform .18s ease, box-shadow .18s ease; }
    dna-link-card:hover { transform: translateY(-2px); --box-shadow: ${t.pop} !important; --_box-shadow: ${t.pop} !important; --arrow-background: ${t.accent} !important; --_arrow-background: ${t.accent} !important; --arrow-color: #fff !important; --_arrow-color: #fff !important; }
    /* Icoon in een zacht afgerond vlak, zoals app-iconen in Apples instellingen */
    dna-link-card > dna-icon { display: inline-grid !important; place-items: center; inline-size: 3.75rem !important; block-size: 3.75rem !important; padding: 0 !important; border-radius: 16px !important; background: ${t.tint} !important; --icon-size: 2.25rem !important; --_icon-size: 2.25rem !important; }
    dna-link-card h1 { color: ${t.fg}; }
    /* SL-rooster: geen grijze kop, geen celvlakken, lichte lijnen */
    sl-grid { --_header-background: transparent !important; --_cell-background: transparent !important; --_border-radius: 12px !important; }
    sl-grid::part(header) { color: ${t.muted}; font-weight: 600; font-size: .6875rem; letter-spacing: .04em; text-transform: uppercase; }
    dna-card { --border-radius: 14px !important; --border-width: 0 !important; --border: 0 !important; --box-shadow: ${t.card} !important; --background: ${t.surface} !important; --color: ${t.fg} !important; --header-padding: .875rem 1rem !important; --body-padding: 0 1rem 1rem !important; --feature: ${t.accent} !important; }
    dna-card-title, .dna-card-title { font-weight: 600 !important; font-size: 1.0625rem !important; letter-spacing: -.01em; color: ${t.fg} !important; }
    dna-page-header { --title-color: ${t.fg} !important; --title-font-weight: 700 !important; --title-font-size: 1.75rem !important; --title-line-height: 2.125rem !important; --subtitle-color: ${t.muted} !important; --highlight: ${t.accent} !important; letter-spacing: -.02em; }
    dna-button { --border-radius: 10px !important; --font-weight: 500 !important; --padding-v: .5rem !important; --padding-h: .875rem !important; --box-shadow-spread: 3px !important; }
    dna-button-bar { --gap-h: .5rem !important; }
    dna-tab-bar { background: ${t.gray6} !important; border-radius: 9px !important; padding: 2px !important; --padding-inline: 0 !important; --indicator-size: 0 !important; --border-width: 0 !important; --border: 0 !important; }
    dna-tab { --border-radius: 7px !important; --padding: .3rem .875rem !important; --active: ${t.hover} !important; --color: ${t.fg} !important; --spacing: .25rem !important; font-weight: 500; }
    dna-tab[selected] { --background: ${t.surface} !important; --color: ${t.fg} !important; box-shadow: 0 1px 3px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.04) !important; font-weight: 600; }
    dna-select, dna-input, dna-list-box, dna-datepicker, dna-textarea { --border-radius: 8px !important; --box-shadow: ${t.pop} !important; --highlight: ${t.accent} !important; }
    dna-menu, dna-overlay { --border-radius: 12px !important; --border: 0 !important; --box-shadow: ${t.pop} !important; --background: ${t.surface} !important; }
    dna-menu-item { --padding: .4rem .75rem !important; --icon-width: 2.25rem !important; }
    dna-dialog { --border-radius: 14px !important; --border-width: 0 !important; --border: 0 !important; --box-shadow: ${t.pop} !important; --heading-font: 600 1.0625rem/1.5rem ${t.font} !important; }
    dna-accordion-item { --border-radius: 12px !important; --border-color: transparent !important; --background: ${t.surface} !important; --box-shadow: ${t.card} !important; }
    dna-badge { --border-radius: 6px !important; }
    sl-skeleton { border-radius: 20px !important; }
  `);
}

/* Nieuwere dna-componenten (zoals die van de aanwezigheidsapp) lezen privévariabelen met een
 * underscore (--_border-radius) in plaats van de publieke naam (--border-radius). Elke publieke
 * variabele in de componentregels krijgt daarom een tweeling met underscore. */
function withPrivateTwins(css) {
  return css.replace(/(--)(?!dna-|sl-|_)([a-z0-9-]+)\s*:([^;{}]+);/g, (m, p, name, val) => `${m} --_${name}:${val};`);
}

function appleCss(p, dark, accent, top = (typeof window === "undefined" || window === window.top)) {
  const t = applePalette(p, dark, accent);
  return appleTokens(t) + `
    /* ---- Basis ---- */
    html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
    body { background: ${t.bg} !important; color: ${t.fg} !important; }
    a { color: ${t.accent}; text-decoration: none; }
    ::selection { background: ${rgba(accent, .25)}; }
    :focus-visible { outline: 3px solid ${rgba(accent, .35)} !important; outline-offset: 1px; }
    h1, h2, h3 { letter-spacing: -.02em; }

    /* ---- Zijbalk: iconenrail en menu als één licht materiaal ---- */
    .appbar-host, .menu-host, nav.menu, .menu-host nav.menu, .container > nav.menu, .menu-container, .menu-footer, .appbar, mg-appbar { background: ${t.sidebar} !important; }
    .menu-host { border-right: 1px solid ${t.sep} !important; }
    .appbar-host { border-right: 1px solid ${t.sep} !important; }
    nav.menu, .container > nav.menu { font: 500 .875rem/1.25rem ${t.font} !important; }
    .appbar > div > a, .appbar .menu-button button, a.appbar-button { background: transparent !important; color: ${t.muted} !important; border-radius: 8px !important; transition: background .12s, color .12s; }
    .appbar > div > a:hover, .appbar .menu-button button:hover, a.appbar-button:hover { background: ${t.hover} !important; color: ${t.fg} !important; }
    .appbar-icon, .appbar > div > a i, .appbar .menu-button > button > i, .appbar dna-icon { color: inherit !important; font-size: 17px !important; }
    .appbar .fa-layers-counter { background: ${t.red} !important; color: #fff !important; border-radius: 999px; font: 600 10px/14px ${t.font} !important; min-width: 14px; padding: 0 4px; }
    .appbar > .gripper > i { background: ${t.muted} !important; opacity: .55; }
    .appbar > .gripper > i:first-child { background: ${t.accent} !important; opacity: 1; }
    .appbar .menu-button > a:hover > span, .appbar .menu-button > button:hover > span, .collapsed-menu li:hover span, .collapsed-menu #faux-label {
      background: ${dark ? "#48484A" : "#1D1D1F"} !important; color: #fff !important; border: 0 !important; border-radius: 6px !important; box-shadow: 0 4px 12px rgba(0,0,0,.2) !important;
      font: 500 12px/1 ${t.font} !important; text-transform: none !important; padding: 6px 8px !important;
    }
    .appbar .menu-button > a:hover > span:after, .appbar .menu-button > button:hover > span:after, .collapsed-menu li:hover span:after { border-right-color: ${dark ? "#48484A" : "#1D1D1F"} !important; }
    /* Logo: Magisters witte svg vervangen door woordmerk in het systeemlettertype */
    .menu-host .logo img { display: none !important; }
    .menu-host .logo a::before { content: "Magister"; font: 700 1.5rem/1 ${t.font}; letter-spacing: -.03em; color: ${t.fg}; }
    .menu-host .logo a::after { content: ""; width: .4rem; height: .4rem; border-radius: 50%; background: ${t.accent}; margin: .9rem 0 0 .2rem; }
    .collapsed-menu .logo a::before { content: "M"; }
    .collapsed-menu .logo a::after { display: none; }
    /* Menu-items (specificiteit boven Magister en boven de basisregels van het thema) */
    ul.main-menu { margin: 0 10px !important; }
    ul.main-menu li a, ul.main-menu li span.caption { color: ${t.fg} !important; }
    ul.main-menu li a { height: 34px !important; margin-bottom: 2px !important; padding-left: 10px !important; border-radius: 8px !important; background: transparent !important; transition: background .12s; }
    ul.main-menu li a > dna-icon, ul.main-menu i { color: ${t.accent} !important; }
    ul.main-menu > li > a:hover { background: ${t.hover} !important; }
    ul.main-menu > li.active > a, ul.main-menu li[class*="active"] > a, ul.main-menu li a[class*="active"], ul.main-menu li[class*="selected"] > a { background: ${t.accent} !important; color: #fff !important; }
    ul.main-menu > li.active > a > dna-icon, ul.main-menu > li.active > a i, ul.main-menu > li.active > a .expand-direction, ul.main-menu > li.active > a span.caption { color: #fff !important; }
    ul.main-menu span.caption { margin-left: 10px !important; }
    ul.main-menu .dot { background: ${t.red} !important; }
    .menu-footer { border-top: 1px solid ${t.sep} !important; }
    .menu-footer a, .menu-footer > a > dna-icon { color: ${t.muted} !important; background: transparent !important; }
    .menu-footer a:hover { color: ${t.fg} !important; }
    /* Uitklapmenu's en flyouts */
    .collapsed-menu .popup-menu, .appbar .popup-menu, .appbar-flyout-menu, .collapsed-menu .main-menu > li.active > ul {
      background: ${t.surface} !important; color: ${t.fg} !important; border: 0 !important; border-radius: 12px !important; box-shadow: ${t.pop} !important; padding: 4px !important;
    }
    ul.main-menu > li > .popup-menu { background: transparent !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; }
    ul.main-menu li.expanded ul { margin: 0 0 4px 30px !important; }
    ul.main-menu li.expanded ul li a { height: 30px !important; font-size: .8125rem !important; color: ${t.muted} !important; }
    ul.main-menu li.expanded ul li.active a { color: ${t.accent} !important; background: transparent !important; font-weight: 600; }
    .popup-menu:after, .appbar .popup-menu:after, .collapsed-menu .popup-menu:after, .collapsed-menu .main-menu > li.active > ul:after { display: none !important; }
    .appbar .popup-menu h3, .collapsed-menu .popup-menu h3 { color: ${t.muted} !important; font: 600 11px/28px ${t.font} !important; letter-spacing: .04em; }
    .appbar .popup-menu ul li a, .collapsed-menu .popup-menu ul li a, .appbar .user-menu a, .collapsed-menu .main-menu > li.active > ul a { color: ${t.fg} !important; border-radius: 7px !important; font: 400 13px/32px ${t.font} !important; height: 32px !important; }
    .appbar .popup-menu ul li a:hover, .collapsed-menu .popup-menu ul li a:hover, .collapsed-menu .main-menu > li.active > ul > li a:hover { background: ${t.accent} !important; color: #fff !important; }
    .appbar .popup-menu footer { border-top: 1px solid ${t.sep} !important; }
    .appbar .profile { border-bottom: 1px solid ${t.sep} !important; }

    /* ---- Hoofdvlak ---- */
    .container > ui-view, ui-view[name="main"], ui-view[name="main"] > *, .strip-padding { background: ${t.bg} !important; }
    /* Het grote vlak onder de paginakop doorzichtig: kaarten liggen los op de gegroepeerde achtergrond */
    section.main, section.dna-main-no-subheader, ui-view[name="main"] > * > section { background: transparent !important; box-shadow: none !important; border: 0 !important; }
    .head-bar h1, ui-view[name="main"] h1 { color: ${t.fg} !important; font: 700 1.75rem/2.125rem ${t.font} !important; letter-spacing: -.02em; }
    .head-bar h1:after { background: ${t.accent} !important; }
    .head-bar, .page-header, [class*="page-header"], header:not(#dt-panel *), .main-header, .detail-header, [class*="detail-header"] { box-shadow: none !important; border: 0 !important; background: transparent !important; color: ${t.fg} !important; }
    .head-bar div a i.ico { background: ${t.tint} !important; color: ${t.accent} !important; transition: background .12s; }
    .head-bar div a:hover i.ico { background: ${t.tintStrong} !important; }
    .head-bar .tabs li a { color: ${t.muted} !important; }

    /* ---- Oude widgets (Tahoma 11px) ---- */
    .widget { font-family: ${t.font} !important; font-size: .8125rem !important; }
    .widget > .content-pane, .widget > .preview-pane { background: ${t.surface} !important; border: 0 !important; border-radius: 14px !important; box-shadow: ${t.card} !important; overflow: hidden; }
    .widget > .content-pane h3, .widget > .preview-pane h3 { background: transparent !important; color: ${t.fg} !important; font: 600 .9375rem/44px ${t.font} !important; height: 44px !important; padding-left: 16px !important; border-bottom: 1px solid ${t.sep} !important; box-shadow: none !important; }
    .widget > .content-pane h3 a, .widget > .preview-pane h3 a { color: ${t.accent} !important; }
    .widget > .content-pane h3 a.fold-toggle, .widget > .preview-pane h3 a.fold-toggle { color: ${t.muted} !important; }
    .widget > .content-pane h4, .widget > .preview-pane h4 { background: transparent !important; color: ${t.muted} !important; border-bottom: 1px solid ${t.sep} !important; font: 600 11px/32px ${t.font} !important; letter-spacing: .04em; text-transform: uppercase; }
    .widget > .content-pane .content, .widget > .preview-pane .content, .widget > .content-pane > .content, .widget > .preview-pane > .content { background: ${t.surface} !important; font-family: ${t.font} !important; font-size: .8125rem !important; color: ${t.fg} !important; }
    .widget .content-pane .filterbar ~ .content, .widget .preview-pane .filterbar ~ .content { box-shadow: none !important; }
    .tight-fit .main .content-pane { border-radius: 0 !important; }
    .dna-card { background: ${t.surface} !important; color: ${t.fg} !important; border-radius: 14px !important; box-shadow: ${t.card} !important; }
    .dna-card-list, .dna-card-list-item { border-radius: 14px; box-shadow: none; }
    .dna-card-list { box-shadow: ${t.card} !important; }
    .dna-card-list-item { background: ${t.surface} !important; }
    .dna-card-list-item + .dna-card-list-item { border-top: 1px solid ${t.sep} !important; }
    .dna-card-list-selectable .dna-card-list-item:hover { background: ${t.hover} !important; }

    /* ---- Lijsten (agenda, notificaties, berichten): de rustige inset-stijl van Apple ----
       geen kader, dagkoppen als groepskopje met ruimte in plaats van een lijn, scheidingslijnen
       die bij de tekst beginnen en niet tot de rand lopen, zachte markering van de lopende les */
    uib-accordion, .panel, .panel-default, .panel-group, .panel-collapse, .panel-body { background: transparent !important; border: 0 !important; box-shadow: none !important; }
    uib-accordion .panel-heading, .panel-heading { background: transparent !important; border: 0 !important; box-shadow: none !important; color: ${t.muted} !important; height: 36px !important; line-height: 36px !important; }
    .panel-group + .panel-group .panel-heading, .panel-group ~ .panel-group .panel-heading { margin-top: .625rem !important; }
    uib-accordion .panel-heading a, .panel-heading a { color: ${t.muted} !important; font: 600 .6875rem/36px ${t.font} !important; letter-spacing: .06em; text-transform: uppercase; padding-left: 14px !important; box-shadow: none !important; border: 0 !important; }
    uib-accordion .panel-heading a dna-icon { color: ${t.muted} !important; opacity: .7; }
    uib-accordion .panel-title span { color: ${t.muted} !important; font-size: inherit !important; }
    .agenda-widget-content { border: 0 !important; }
    .list, ul.list { border: 0 !important; }
    .list li { background: transparent !important; border: 0 !important; color: ${t.fg} !important; height: 44px !important; line-height: 44px !important; }
    .list li::after { content: ""; position: absolute; left: 14px; right: 0; bottom: 0; height: 1px; background: ${t.sepSoft}; pointer-events: none; }
    .list li:last-child::after { display: none; }
    .list li.double-line { height: auto !important; min-height: 48px !important; line-height: 18px !important; }
    .list li a { display: flex !important; align-items: center; gap: .5rem; padding: 0 12px 0 14px !important; }
    .list li a > span { line-height: 1.25rem; }
    .list li a, .list li.double-line > span { color: ${t.fg} !important; }
    .list li span.list-head { color: ${t.fg} !important; }
    .list li span.list-head ~ span { color: ${t.muted} !important; }
    .list li:hover { background: ${t.hover} !important; }
    .list li.active, .list li.selected, .list li.current-item { background: ${rgba(accent, .12)} !important; }
    .list li.current { background: ${rgba(accent, .09)} !important; }
    .list li.alert:before, .list li.alert-info:before, .list li.alert-danger:before { width: 3px !important; border-radius: 2px; top: 10px !important; bottom: 10px !important; left: 6px !important; }
    .list li.alert-info:before, .list li.alert:before { background: ${t.accent} !important; }
    .list li.alert-danger:before { background: ${t.red} !important; }
    li.vandaag-agenda-list-item { height: 2.75rem !important; }
    .vandaag-agenda-item-lesblok-tijd { color: ${t.muted} !important; font-variant-numeric: tabular-nums; margin-left: .875rem !important; }
    span.nrblock { background: ${t.tint} !important; color: ${t.accent} !important; border-radius: 6px !important; font: 600 .75rem/20px ${t.font} !important; height: 20px !important; min-width: 20px !important; padding: 0 6px !important; }
    ag-lesblok-wijziging > span { color: ${t.muted} !important; font-size: .75rem; }
    .list li .special, .list li span.special, ul.list div a .special { display: inline-flex !important; align-items: center; justify-content: center; float: none !important; width: auto !important; min-width: 1.5rem; height: 1.375rem !important; padding: 0 .5rem; margin: 0 .25rem 0 0 !important; border-radius: 999px; background: ${t.tint}; color: ${t.accent}; font-weight: 600; font-size: .75rem; line-height: 1 !important; text-align: center; }
    .geen-afspraken-tekst, .geen-mededelingen-tekst { color: ${t.muted} !important; }

    /* ---- Tabellen ---- */
    table.datagrid-table { border-left: 0 !important; }
    table.datagrid-table th, table.datagrid-table thead th, table.datagrid-table tfoot td { background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.sepSoft} !important; color: ${t.muted} !important; font: 600 .6875rem/36px ${t.font} !important; letter-spacing: .04em; text-transform: uppercase; height: 36px !important; }
    table.datagrid-table td { background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.sepSoft} !important; color: ${t.fg} !important; font-size: .8125rem !important; height: 40px !important; }
    table.datagrid-table tbody tr:last-child td { border-bottom: 0 !important; }
    table.datagrid-table th:first-child, table.datagrid-table td:first-child { padding-left: 14px !important; }
    table.datagrid-table thead + tbody tr:first-child td { box-shadow: none !important; }
    table.datagrid-table tr:hover td, table.datagrid-table tr.hover td { background: ${t.hover} !important; }
    table.datagrid-table tr.selected td, table.datagrid-table tr.selected:hover td { background: ${rgba(accent, .12)} !important; }
    table.datagrid-table tr.current td, table.datagrid-table tr:hover.current td { background: ${rgba(accent, .09)} !important; }
    th { color: ${t.muted}; }

    /* ---- Leerlingenlijst (op-leerlingen, in een iframe): tabel zonder celranden, filterkaart zonder rand ---- */
    .zoeken-page, .left-side, .result-container { background: transparent !important; }
    .table-container, .scroll-viewport { background: ${t.surface} !important; }
    .table-container { border-radius: 14px !important; box-shadow: ${t.card} !important; }
    .table-container table, ll-result-table table { border: 0 !important; border-collapse: separate !important; border-spacing: 0 !important; }
    .table-container th, ll-result-table th, .table-container .header-cell, ll-result-table .header-cell { background: ${t.surface} !important; height: 40px !important; border: 0 !important; border-bottom: 1px solid ${t.sepSoft} !important; color: ${t.muted} !important; font-weight: 600 !important; font-size: .6875rem !important; letter-spacing: .04em; text-transform: uppercase; }
    .table-container td, ll-result-table td { background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.sepSoft} !important; color: ${t.fg} !important; font-size: .8125rem !important; }
    .table-container tbody tr:hover td, ll-result-table tbody tr:hover td { background: ${t.hover} !important; }
    .table-container tr, ll-result-table tr { height: 44px !important; }
    .table-container tbody tr:last-child td, ll-result-table tbody tr:last-child td { border-bottom: 0 !important; }
    .right-side ll-side-widget > dna-card, .filter-container dna-card, .filter-card { border: 0 !important; }
    .filter-card::-webkit-scrollbar-thumb { background: ${t.dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.2)"} !important; }
    .dna-btn-link-primary, .dna-filter-group-toggle { background: transparent !important; color: ${t.accent} !important; box-shadow: none !important; padding-left: 0 !important; font-weight: 500 !important; }
    .dna-filter-group-option { color: ${t.fg} !important; }
    .filters-loading dna-spinner { color: ${t.accent} !important; }

    /* ---- Agenda (FullCalendar) in de stijl van Apple Agenda ---- */
    #calendar { background: ${t.surface} !important; border-radius: 14px; box-shadow: ${t.card}; overflow: hidden; }
    #calendar .fc-agenda-view, #calendar .fc-view-container, #calendar .fc-basic-view { background: ${t.surface} !important; }
    #calendar .fc-toolbar { background: transparent !important; border-bottom: 1px solid ${t.sepSoft}; height: 44px !important; line-height: 44px !important; margin: 0 !important; }
    .fc-toolbar button { color: ${t.muted} !important; font: 500 .8125rem/44px ${t.font} !important; height: 44px !important; }
    .fc-toolbar button:hover { color: ${t.accent} !important; }
    .fc-toolbar button.fc-next-button:after, .fc-toolbar button.fc-prev-button:before { color: ${t.accent} !important; }
    #calendar .fc-head .fc-widget-header { background: transparent !important; border: 0 !important; height: 40px !important; line-height: 40px !important; }
    #calendar .fc-day-header { color: ${t.muted} !important; font: 600 .75rem/40px ${t.font} !important; letter-spacing: .02em; border-bottom: 1px solid ${t.sepSoft} !important; }
    #calendar .fc-day-header.fc-today { color: ${t.accent} !important; }
    #calendar .fc-divider, #calendar .fc-popover, #calendar .fc-row, #calendar tbody, #calendar td, #calendar th, #calendar thead, .fc-unthemed td, .fc-unthemed th { border-color: ${t.sepSoft} !important; font-size: .75rem; }
    .fc-time-grid .fc-slats .fc-minor td { border-top-style: solid !important; border-color: ${t.dark ? "rgba(84,84,88,.25)" : "rgba(60,60,67,.07)"} !important; }
    #calendar .fc-agenda-view .fc-time-grid .fc-slats .fc-minor td.fc-axis { border-right-color: ${t.sepSoft} !important; }
    #calendar .fc-axis { color: ${t.muted} !important; font: 500 .6875rem/1 ${t.font} !important; font-variant-numeric: tabular-nums; text-align: right !important; padding-right: 8px !important; }
    #calendar .fc-today, #calendar .fc-unthemed .fc-today { background: ${rgba(accent, .04)} !important; }
    .fc-now-indicator { border-color: ${t.red} !important; }
    /* Afspraken: zachte tint met een gekleurde linkerrand, afgerond, zonder kader */
    #calendar .fc-event, #calendar .fc-time-grid-event, #calendar .fc-day-grid-event { background: ${rgba(accent, t.dark ? .22 : .13)} !important; border: 0 !important; border-left: 3px solid ${t.accent} !important; border-radius: 6px !important; color: ${t.fg} !important; box-shadow: none !important; }
    #calendar .fc-event .fc-bg { display: none; }
    #calendar .fc-time-grid-event .fc-title, #calendar .fc-time-grid-event .event-description, #calendar .fc-time-grid-event .event-description-content, #calendar .fc-time-grid-event .event-description-content-examen, #calendar .fc-h-event .fc-content { color: ${t.dark ? mix(accent, "#ffffff", .55) : mix(accent, "#000000", .45)} !important; font: 500 .75rem/1.2 ${t.font} !important; }
    #calendar .fc-time-grid-event .fc-time { color: ${t.muted} !important; font-size: .6875rem !important; }
    #calendar .fc-time-grid-event .nrblock, #calendar .fc-time-grid-event .calendar-event .nrblock { background: ${t.accent} !important; color: #fff !important; box-shadow: none !important; border-radius: 6px !important; font: 600 .6875rem/18px ${t.font} !important; height: 18px !important; }
    .fc-day-grid-event.current-event, .fc-time-grid-event.current-event { background: ${rgba(accent, t.dark ? .38 : .26)} !important; }
    .fc-day-grid-event.active-event, .fc-time-grid-event.active-event { background: ${rgba(accent, t.dark ? .32 : .2)} !important; box-shadow: 0 0 0 2px ${t.accent} !important; }
    #calendar .fc-time-grid-event.current-event .nrblock, #calendar .fc-time-grid-event.active-event .nrblock { box-shadow: none !important; }
    .calendar-event.info:before { background: ${t.red} !important; border-radius: 2px; }
    #calendar .fc-event:hover { filter: brightness(.97); }
    /* Minikalender (datepicker): geen celranden, vandaag in accent, keuze als gevulde cirkel */
    div.calendar table, div[uib-datepicker] table, .content-pane div.calendar table { border: 0 !important; border-collapse: separate !important; border-spacing: 0 2px !important; }
    div.calendar table td, div.calendar table th, div[uib-datepicker] table td, div[uib-datepicker] table th { border: 0 !important; height: 30px !important; line-height: 30px !important; background: transparent !important; font-size: .75rem !important; }
    div.calendar table th, div[uib-datepicker] table th { color: ${t.muted} !important; font: 600 .6875rem/30px ${t.font} !important; text-transform: uppercase; letter-spacing: .04em; }
    div.calendar table tr:first-child th, div[uib-datepicker] table tr:first-child th { background: transparent !important; border: 0 !important; height: 40px !important; line-height: 40px !important; color: ${t.fg} !important; font: 600 .875rem/40px ${t.font} !important; text-transform: none; letter-spacing: 0; }
    div.calendar table td em, div[uib-datepicker] table td em { background: transparent !important; color: ${t.muted} !important; font-weight: 500 !important; font-size: .6875rem; }
    div.calendar button, div[uib-datepicker] button { font: 500 .75rem/28px ${t.font} !important; color: ${t.fg} !important; transition: background .12s; }
    div.calendar td button, div[uib-datepicker] td button { height: 28px !important; width: 28px !important; margin: 1px auto !important; border-radius: 50% !important; }
    div.calendar th button, div[uib-datepicker] th button { height: 32px !important; line-height: 32px !important; width: 100% !important; border-radius: 8px !important; white-space: nowrap; }
    div.calendar tr:first-child th button, div[uib-datepicker] tr:first-child th button { font: 600 .875rem/32px ${t.font} !important; color: ${t.fg} !important; }
    div.calendar button:hover, div[uib-datepicker] button:hover { background: ${t.hover} !important; }
    div.calendar button.active, div[uib-datepicker] button.active { background: ${t.accent} !important; color: #fff !important; font-weight: 600 !important; }
    div.calendar button.active + td, div[uib-datepicker] button.active + td { background: transparent !important; }
    div.calendar td.mg-today button, div[uib-datepicker] td.mg-today button { color: ${t.accent} !important; font-weight: 700 !important; }
    div.calendar td.mg-today button.active, div[uib-datepicker] td.mg-today button.active { color: #fff !important; }
    div.calendar .mg-date-range, div[uib-datepicker] .mg-date-range { background: ${rgba(accent, .12)} !important; }
    div.calendar .text-muted, div[uib-datepicker] .text-muted, div.calendar button .text-muted { color: ${t.border} !important; }
    div.calendar button.pull-left, div.calendar button.pull-right, div[uib-datepicker] button.pull-left, div[uib-datepicker] button.pull-right { width: 36px !important; border-radius: 8px !important; }
    div.calendar i.glyphicon, div[uib-datepicker] i.glyphicon { background: transparent !important; border: 0 !important; color: ${t.accent} !important; }
    div.calendar + footer a, div[uib-datepicker] + footer a, footer.endlink a.left { color: ${t.accent} !important; font-weight: 500; }
    /* Keuzelijsten in het Overzicht-paneel */
    .fancy-select > label { color: ${t.muted} !important; font: 600 .6875rem/1.25rem ${t.font} !important; letter-spacing: .04em; text-transform: uppercase; }
    .fancy-select .select-label { border: 1px solid ${t.border} !important; border-radius: 10px !important; height: 34px !important; line-height: 34px !important; background: ${t.surface} !important; }
    .fancy-select .select-label a { background: transparent !important; color: ${t.fg} !important; line-height: 34px !important; font-size: .8125rem; }
    .fancy-select .select-label:after { color: ${t.muted}; }
    .fancy-select ul.select ul { background: ${t.surface} !important; border: 0 !important; border-radius: 12px !important; box-shadow: ${t.pop} !important; padding: 4px !important; }
    .fancy-select ul.select ul li { border-radius: 8px !important; height: 34px !important; line-height: 34px !important; font-size: .8125rem; color: ${t.fg} !important; }
    .fancy-select ul.select ul li:hover { background: ${t.accent} !important; color: #fff !important; }
    .fancy-select ul.select ul li.current { background: ${t.tint} !important; color: ${t.accent} !important; font-weight: 600; }

    /* ---- Velden en knoppen (oude schermen) ---- */
    .container input[type=email], .container input[type=number], .container input[type=password], .container input[type=search], .container input[type=tel], .container input[type=text], .container textarea, .container select, .dna-text-input, .dna-input-group {
      background: ${t.surface} !important; border: 1px solid ${t.border} !important; border-radius: 8px !important; color: ${t.fg} !important; font: 400 .8125rem/1.25rem ${t.font} !important; padding: 0 10px !important; transition: box-shadow .12s, border-color .12s;
    }
    .container input:hover { background: ${t.surface} !important; }
    .container input:focus, .container textarea:focus, .container select:focus, .dna-text-input:focus, .dna-input-group:focus-within { background: ${t.surface} !important; border-color: ${t.accent} !important; box-shadow: ${t.focus} !important; outline: none !important; }
    .container input[disabled] { background: ${t.surface2} !important; color: ${t.muted} !important; }
    .container .search input, .search input { background: ${t.gray6} !important; border: 0 !important; border-radius: 8px !important; color: ${t.fg} !important; }
    input[type=checkbox], input[type=radio] { accent-color: ${t.accent}; }
    .dna-btn { border-radius: 10px !important; font: 500 .8125rem/1rem ${t.font} !important; }
    .dna-btn-primary { background: ${t.accent} !important; color: #fff !important; }
    .dna-btn-primary:hover { background: ${mix(accent, dark ? "#ffffff" : "#000000", .08)} !important; }
    .dna-btn-primary:focus { box-shadow: ${t.focus} !important; }
    button[class*="primary"], .btn-primary, [class*="button--primary"], input[type="submit"] { border: 0 !important; border-radius: 10px !important; font-weight: 600 !important; }
    .dna-badge-outline { border-color: ${t.accent} !important; color: ${t.accent} !important; }
    .dna-badge-primary { background: ${t.accent} !important; }

    /* ---- Kopbalk en tabbladen van detailkaarten ---- */
    dna-head-bar, .dna-head-bar { background: ${t.surface} !important; color: ${t.fg} !important; border-bottom: 1px solid ${t.sep} !important; }
    .dna-head-bar-title { font: 600 1rem/1.5rem ${t.font} !important; }
    .dna-head-bar-item { color: ${t.muted} !important; font: 500 .875rem/1.5rem ${t.font} !important; border-radius: 8px !important; transition: background .12s, color .12s; }
    a.dna-head-bar-item:hover:not(:disabled), button.dna-head-bar-item:hover:not(:disabled), a.dna-head-bar-item:focus, button.dna-head-bar-item:focus { background: ${t.hover} !important; color: ${t.fg} !important; }
    .dna-head-bar-item-active, .dna-head-bar-aside .dna-head-bar-item-active { background: transparent !important; color: ${t.accent} !important; box-shadow: inset 0 -2px 0 ${t.accent} !important; border-radius: 0 !important; }
    .dna-head-bar-aside { background: transparent !important; }
    .dna-head-bar-aside .dna-head-bar-item:after { background: ${t.accent} !important; height: 2px !important; }
    .tabs, ul.tabs, .page-nav, [role=tablist] { background: transparent !important; border: 0 !important; border-bottom: 1px solid ${t.sep} !important; }
    .tabs li a, ul.tabs li a, [role=tablist] > [role=tab]:not(.panel-heading) { border: 0 !important; color: ${t.muted} !important; }
    .tabs li.active a, ul.tabs li.active a, [role=tablist] > [role=tab][aria-selected=true]:not(.panel-heading) { color: ${t.accent} !important; box-shadow: inset 0 -2px 0 ${t.accent} !important; font-weight: 600; }

    /* ---- Meldingen en dialogen ---- */
    .dna-snack-bar { background: ${dark ? "#3A3A3C" : "#1D1D1F"} !important; color: #fff !important; border-radius: 12px !important; box-shadow: ${t.pop} !important; }
    .dialog, .modal-content, mg-dialog .dialog { background: ${t.surface} !important; color: ${t.fg} !important; border: 0 !important; border-radius: 14px !important; box-shadow: ${t.pop} !important; }

    /* ---- Schuifbalken en de eigen UI van de extensie ---- */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.2)"}; border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
    ::-webkit-scrollbar-track { background: transparent; }
    :root { --dt-shadow: ${t.pop}; --dt-radius: 12px; }
  ` + (t.glass ? glassCss(t, top) : "");
}

/* Binnen elke shadow root: dezelfde componentvariabelen (voor dna-knoppen en tabs die in de
 * schaduw van een ander component zitten) plus de weinige klassen die daar vast zijn. */
function appleShadowCss(p, dark, accent) {
  const t = applePalette(p, dark, accent);
  return appleTokens(t).replace(":root, body {", ":host {") + `
    :host(dna-page-header) .title { letter-spacing: -.02em; }
    :host(dna-link-card) a, :host(dna-link-card) .wrapper { align-items: flex-start !important; justify-content: flex-start !important; text-align: start !important; }
    :host(dna-link-card) h1 { text-align: start !important; color: ${t.fg} !important; letter-spacing: -.01em; }
    :host(dna-link-card) p { text-align: start !important; color: ${t.muted} !important; }
    :host(dna-link-card) .arrow { display: inline-grid !important; place-items: center !important; padding: 0 !important; box-sizing: border-box; }
    :host(dna-link-card) .arrow > * { margin: 0 !important; }
    :host(att-attendance-dashboard) .wrapper { grid-template-rows: none !important; grid-auto-rows: 1fr !important; block-size: max-content !important; align-content: start !important; align-items: stretch !important; gap: 1.25rem !important; padding-block: 1.25rem !important; }
    .dna-card, .card { background: ${t.surface}; color: ${t.fg}; }
  `;
}

/* Liquid Glass-laag: komt ná de basisregels in de cascade en overschrijft die met !important.
 * De achtergrond krijgt een zachte kleurwas zodat het glas iets te laten doorschijnen heeft;
 * in iframes is de body doorzichtig, zodat de was van de hoofdpagina doorloopt. */
function glassCss(t, top) {
  const a = t.accent;
  const wash = t.dark
    ? `radial-gradient(70% 55% at 12% 0%, ${rgba(a, .28)} 0%, transparent 60%), radial-gradient(55% 45% at 95% 100%, rgba(191, 90, 242, .20) 0%, transparent 60%), radial-gradient(40% 35% at 70% 25%, rgba(48, 209, 88, .08) 0%, transparent 60%), linear-gradient(160deg, #15151b 0%, #1b1b22 100%)`
    : `radial-gradient(60% 50% at 8% 0%, ${rgba(a, .34)} 0%, transparent 62%), radial-gradient(50% 45% at 96% 100%, rgba(175, 82, 222, .26) 0%, transparent 62%), radial-gradient(40% 38% at 72% 18%, rgba(255, 149, 0, .13) 0%, transparent 60%), radial-gradient(38% 34% at 38% 92%, rgba(48, 209, 88, .13) 0%, transparent 60%), radial-gradient(30% 30% at 55% 55%, rgba(90, 200, 250, .14) 0%, transparent 60%), linear-gradient(160deg, #e6ecfa 0%, #efeaf8 55%, #e4eff3 100%)`;
  const glass = `background: ${t.glassBg} !important; -webkit-backdrop-filter: ${t.blur}; backdrop-filter: ${t.blur}; box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; border: 0 !important;`;
  return `
    /* Achtergrond: kleurwas (hoofdpagina) of doorzichtig (iframe) */
    ${top ? `html, body { background: ${wash} !important; background-attachment: fixed !important; }` : `html, body { background: transparent !important; }`}
    .container > ui-view, ui-view[name="main"], ui-view[name="main"] > *, .strip-padding, section.main, .container, #guest-app-frame, mg-guest-app, mg-guest-app .fill-viewport { background: transparent !important; }
    /* Zijbalk en iconenrail als glas */
    .appbar-host, .menu-host { ${glass} border-right: 1px solid ${t.dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.6)"} !important; background: ${t.glassSide} !important; }
    nav.menu, .menu-host nav.menu, .container > nav.menu, .menu-container, .menu-footer, .appbar, mg-appbar, .menu-footer a { background: transparent !important; }
    ul.main-menu > li.active > a, ul.main-menu li[class*="active"] > a, ul.main-menu li a[class*="active"], ul.main-menu li[class*="selected"] > a {
      background: linear-gradient(180deg, ${rgba(a, .92)}, ${rgba(a, 1)}) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px ${rgba(a, .35)} !important;
    }
    ul.main-menu > li > a:hover { background: ${t.dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.55)"} !important; }
    /* Kaarten en vlakken */
    dna-card { --background: linear-gradient(180deg, ${t.dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.55)"}, transparent 40%), ${t.glassBg} !important; --border-radius: 20px !important; --box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; -webkit-backdrop-filter: ${t.blur}; backdrop-filter: ${t.blur}; }
    .widget > .content-pane, .widget > .preview-pane, .dna-card, .dna-card-list, dna-accordion-item { ${glass} background: linear-gradient(180deg, ${t.dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.55)"}, transparent 40%), ${t.glassBg} !important; border-radius: 20px !important; }
    dna-accordion-item { --background: ${t.glassBg} !important; --border-radius: 20px !important; --box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; }
    dna-link-card { background-color: ${t.glassBg} !important; --box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; --_box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; -webkit-backdrop-filter: ${t.blur}; backdrop-filter: ${t.blur}; }
    dna-link-card:hover { --box-shadow: ${t.glassEdge}, 0 24px 60px rgba(31,41,61,.18) !important; --_box-shadow: ${t.glassEdge}, 0 24px 60px rgba(31,41,61,.18) !important; }
    .table-container th, ll-result-table th, .table-container .header-cell, ll-result-table .header-cell { background: ${t.glassStrong} !important; -webkit-backdrop-filter: ${t.blur}; backdrop-filter: ${t.blur}; }
    sl-grid { --_header-background: ${t.glassStrong} !important; }
    #calendar, #calendar .fc-agenda-view, #calendar .fc-view-container, #calendar .fc-basic-view, .table-container, .scroll-viewport { background: ${t.glassBg} !important; }
    #calendar { ${glass} border-radius: 20px !important; }
    .table-container { ${glass} border-radius: 20px !important; }
    .widget > .content-pane .content, .widget > .preview-pane .content, .widget > .content-pane > .content, .widget > .preview-pane > .content, .widget > .content-pane h3, uib-accordion, .list li, .dna-card-list-item,
    table.datagrid-table th, table.datagrid-table thead th, table.datagrid-table tfoot td, table.datagrid-table td { background: transparent !important; }
    .list li:hover, table.datagrid-table tr:hover td { background: ${t.dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.5)"} !important; }
    .list li.current, table.datagrid-table tr.current td { background: ${rgba(a, .10)} !important; }
    .list li.active, .list li.selected, .list li.current-item, table.datagrid-table tr.selected td { background: ${rgba(a, .14)} !important; }
    /* Kopbalk van detailkaarten en popovers als glas */
    dna-head-bar, .dna-head-bar, .head-bar { ${glass} border-radius: 16px !important; margin-bottom: .5rem; }
    .collapsed-menu .popup-menu, .appbar .popup-menu, .appbar-flyout-menu, .collapsed-menu .main-menu > li.active > ul, .dialog, .modal-content, mg-dialog .dialog {
      background: ${t.glassStrong} !important; -webkit-backdrop-filter: saturate(180%) blur(40px); backdrop-filter: saturate(180%) blur(40px); box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; border-radius: 18px !important;
    }
    dna-menu, dna-overlay, dna-dialog { --background: ${t.glassStrong} !important; --box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; --border-radius: 18px !important; -webkit-backdrop-filter: saturate(180%) blur(40px); backdrop-filter: saturate(180%) blur(40px); }
    dna-select, dna-list-box, dna-input { --background: ${t.glassStrong} !important; --box-shadow: ${t.glassEdge}, ${t.glassShadow} !important; }
    /* Capsules: knoppen, tabbladen, chips, velden */
    dna-button { --border-radius: 999px !important; --padding-h: 1rem !important; }
    .dna-btn, button[class*="primary"], .btn-primary, input[type="submit"] { border-radius: 999px !important; }
    .dna-btn-primary, button[class*="primary"], .btn-primary, input[type="submit"] { background: linear-gradient(180deg, ${rgba(a, .9)}, ${a}) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px ${rgba(a, .35)} !important; }
    .dna-btn:not(.dna-btn-primary) { background: ${t.dark ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.65)"} !important; box-shadow: ${t.glassEdge} !important; color: ${t.fg} !important; }
    dna-tab-bar { background: ${t.dark ? "rgba(255,255,255,.08)" : "rgba(120,120,128,.14)"} !important; border-radius: 999px !important; padding: 3px !important; box-shadow: ${t.glassEdge} !important; }
    dna-tab { --border-radius: 999px !important; }
    dna-tab[selected] { --background: ${t.dark ? "rgba(90,90,96,.85)" : "rgba(255,255,255,.92)"} !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 2px 8px rgba(0,0,0,.14) !important; }
    span.nrblock, .list li .special, .list li span.special { border-radius: 999px !important; }
    .container input[type=email], .container input[type=number], .container input[type=password], .container input[type=search], .container input[type=tel], .container input[type=text], .container textarea, .container select, .dna-text-input, .dna-input-group {
      background: ${t.dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.6)"} !important; border-color: ${t.dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.8)"} !important; border-radius: 12px !important; box-shadow: ${t.glassEdge} !important;
    }
    .container .search input, .search input { background: ${t.dark ? "rgba(255,255,255,.1)" : "rgba(120,120,128,.14)"} !important; border-radius: 999px !important; }
    .dna-snack-bar { background: ${t.dark ? "rgba(58,58,60,.85)" : "rgba(29,29,31,.85)"} !important; -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border-radius: 18px !important; }
    /* Eigen UI van de extensie */
    :root { --dt-radius: 16px; }
  `;
}

/* De schil (iconenrail, zijbalk, menu) als allerlaatste in de cascade: wint van Magister, van de
 * basisregels van het thema en van eigen aanvullingen uit de Inspector. */
function appleShellCss(p, dark, accent) {
  const t = applePalette(p, dark, accent);
  const bg = t.glass ? t.glassSide : t.sidebar;
  const blur = t.glass ? `-webkit-backdrop-filter: ${t.blur}; backdrop-filter: ${t.blur};` : "";
  return `
    html body .container > .appbar-host, html body .container > .menu-host { background: ${bg} !important; background-color: ${bg} !important; background-image: none !important; ${blur} }
    html body .appbar-host mg-appbar, html body .appbar-host .appbar, html body .menu-host nav.menu, html body .menu-host .menu-container, html body .menu-host .menu-footer, html body .menu-host .menu-footer a { background: transparent !important; background-color: transparent !important; background-image: none !important; }
    html body .appbar > div > a, html body .appbar .menu-button button, html body a.appbar-button { background: transparent !important; background-color: transparent !important; color: ${t.muted} !important; }
    html body .appbar > div > a:hover, html body .appbar .menu-button button:hover { background: ${t.hover} !important; background-color: ${t.hover} !important; color: ${t.fg} !important; }
    html body .appbar-icon, html body .appbar > div > a i, html body .appbar .menu-button > button > i, html body .appbar dna-icon { color: inherit !important; }
  `;
}

function contrastInk(hex) {
  const h = (hex || "#000").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}
