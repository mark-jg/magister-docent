/* Thema, deel kleur: lettertypes, kleurrekenen en de vertaling van een preset naar Magisters designvariabelen
 * (tokenMap, tokenCss) en de inversie voor donker. Gebruikt door theme.js. */
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

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function hex2rgb(h) { const n = h.replace("#", ""); return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) }; }

function walkAll(root, fn) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let n = tw.currentNode.nodeType === 1 ? tw.currentNode : tw.nextNode();
  while (n) { fn(n); if (n.shadowRoot) walkAll(n.shadowRoot, fn); n = tw.nextNode(); }
}

/* Haalt alles weg wat een thema op <html> heeft gezet. De lijst moet elke naam uit tokenMap dekken: blijft er één
 * staan (zoals --primary-background, de kleur van het menu), dan houdt het thema Magister de kleur van het vorige
 * thema tot je de pagina herlaadt. tests/thema.test.js bewaakt dat. */
function dtThemaVar(n) {
  return n.startsWith("--sl-") || n.startsWith("--background") || n.startsWith("--chrome") || n.startsWith("--primary-") || n.startsWith("--secondary-")
    || /text-color$/.test(n) || n.startsWith("--dt-") || n.startsWith("--dna-");
}
function clearRootVars() {
  const root = document.documentElement.style;
  [...root].filter(dtThemaVar).forEach((n) => root.removeProperty(n));
}

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
    .menu-footer, .menu-footer a { background: ${dark ? p.surface2 : mix(p.accent, "#000000", .15)} !important; color: ${dark ? p.fg : contrastInk(mix(p.accent, "#000000", .15))} !important; }
    ul.main-menu li a, ul.main-menu li span.caption { color: ${dark ? p.fg : contrastInk(p.accent)} !important; }
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
