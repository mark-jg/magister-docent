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
    css += fontCss(FONTS[s.font === "thema" || !s.font ? (p.font || "standaard") : s.font], Number(s.fontScale) || 1);
    const radius = s.radius === "thema" || !s.radius ? p.radius : s.radius;
    if (radius) css += ` :root { --sl-size-borderRadius-default: ${radius} !important; --sl-size-borderRadius-md: ${radius} !important; --sl-size-borderRadius-lg: ${radius} !important; --sl-size-borderRadius-xl: ${radius} !important; --dt-radius: ${radius}; }
      .widget, .mg-panel, .content-pane, .ui-grid, button, .btn, input, select, textarea, .dt-btn { border-radius: ${radius} !important; }`;

    clearRootVars();
    this._vars = null;
    this._sig = [s.preset, s.accent, dark ? 1 : 0, s.darkStyle].join("|");
    const root = document.documentElement.style;
    if (p.bg) {
      const useInvert = dark && (s.darkStyle || "invert") === "invert";
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
    if (p.custom !== false) {
      root.setProperty("--sl-color-background-primary-bold", accent);
      root.setProperty("--sl-color-border-primary-bold", accent);
      root.setProperty("--sl-color-background-selected-bold", accent);
    }
    css += this.extraCss(DT, p, dark, accent, ink);
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
      && !(this.isDark(DT) && (DT.settings.theme.darkStyle || "invert") === "invert");
    const props = [["color", "color"], ["background-color", "background-color"], ["border-top-color", "border-color"], ["border-bottom-color", "border-color"], ["border-left-color", "border-color"], ["fill", "fill"]];
    if (!active) {
      walkAll(document.documentElement, (el) => { if (el.dataset?.dtRc) { for (const [, prop] of props) el.style.removeProperty(prop); el.style.removeProperty("border-top-color"); el.style.removeProperty("border-bottom-color"); el.style.removeProperty("border-left-color"); delete el.dataset.dtRc; } });
      return;
    }
    const sig = this._sig;
    let budget = 6000;
    walkAll(document.documentElement, (el) => {
      if (budget-- <= 0) return;
      if (el.id && el.id.startsWith("dt-")) return;
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
    const css = vars ? `:host { ${Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join(" ")} }` : "";
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
  [...root].filter((n) => n.startsWith("--sl-") || n.startsWith("--background") || n.startsWith("--chrome") || /text-color$/.test(n) || n.startsWith("--dt-")).forEach((n) => root.removeProperty(n));
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
    "--background-4": p.dark ? p.surface2 : mix(p.fg, p.surface, .25), "--background-6": p.dark ? p.surface2 : mix(p.fg, p.surface, .2),
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

function contrastInk(hex) {
  const h = (hex || "#000").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}
