/* Thema, deel thema's: de zes thema's, de accentkleuren en de vertaling van de instellingen naar één palet.
 *
 * Zes thema's, elk (behalve Magister) met een lichte en een donkere variant:
 *   Magister   het origineel; de extensie verandert niets aan de kleuren
 *   Minimal    rustig en strak, systeemlettertype, dunne lijnen
 *   Glass      als Minimal, met doorschijnende vlakken
 *   Paper      papier en inkt: warm, schreefletter, rechte hoeken, lijnen in plaats van schaduw
 *   Soft       zacht, rond en speels
 *   Contrast   maximaal contrast: zwart-wit, stevige randen, duidelijke focus
 * De accentkleur is een tweede keuze, los van het thema (Contrast houdt zijn eigen kleur).
 *
 * Alle thema's behalve Magister gebruiken dezelfde opmaak (theme-apple.js); ze verschillen in palet, lettertype,
 * lijnen en schaduwen (stijl) en in de hoeken (vorm). Zo hoeft een nieuw scherm maar één keer te worden opgemaakt. */

function dtLuminantie(hex) {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const { r, g, b } = hex2rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/* Contrastverhouding volgens WCAG (1 tot 21). */
function dtContrast(a, b) {
  const [x, y] = [dtLuminantie(a), dtLuminantie(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/* Dezelfde tint, lichter of donkerder gemaakt tot de gevraagde luminantie (0 = zwart, 1 = wit). */
function dtNaarLuminantie(hex, doel) {
  const naar = dtLuminantie(hex) > doel ? "#000000" : "#ffffff";
  let laag = 0, hoog = 1, uit = hex;
  for (let i = 0; i < 18; i++) {
    const t = (laag + hoog) / 2; uit = mix(hex, naar, t);
    if ((dtLuminantie(uit) > doel) === (naar === "#000000")) laag = t; else hoog = t;
  }
  return uit;
}
/* De opmaak zet witte tekst op de accentkleur en gebruikt die kleur ook voor links. Een gekozen kleur wordt daarom
 * zo nodig bijgestuurd: licht minstens 4,5:1 tegen wit; donker minstens 3:1 tegen wit én tegen de donkere vlakken. */
function dtPassendAccent(hex, dark, vlak = "#ffffff") {
  const L = dtLuminantie(hex);
  /* Licht: ook als tekst op het vlak van het thema (papier is iets donkerder dan wit). */
  const max = Math.min(0.183, (dtLuminantie(vlak) + 0.05) / 4.5 - 0.05);
  if (!dark) return L > max ? dtNaarLuminantie(hex, max - 0.003) : hex;
  if (L > 0.30) return dtNaarLuminantie(hex, 0.29);
  if (L < 0.18) return dtNaarLuminantie(hex, 0.19);
  return hex;
}

/* Accentkleuren voor de tweede keuze. "thema" = de eigen kleur van het thema, "eigen" = de kleurkiezer. */
const DT_ACCENTEN = { blauw: "#007AFF", mca: "#1B3A5C", groen: "#248A3D", paars: "#8944AB", roze: "#D12A7C", oranje: "#C4520A", rood: "#D70015", grafiet: "#515154" };

const DT_THEMAS = {
  magister: { label: "Magister", licht: { accent: "#056dc2" } },
  minimal: {
    label: "Minimal", font: "apple", radius: "10px",
    licht:  { accent: "#007AFF", bg: "#F2F2F7", surface: "#FFFFFF", surface2: "#F5F5F7", border: "#D1D1D6", fg: "#1D1D1F", muted: "#68686D" },
    donker: { accent: "#0A84FF", bg: "#1C1C1E", surface: "#2C2C2E", surface2: "#3A3A3C", border: "#48484A", fg: "#F5F5F7", muted: "#AEAEB2" },
  },
  glass: {
    label: "Glass", font: "apple", radius: "14px", glass: true,
    licht:  { accent: "#007AFF", bg: "#EEF1F8", surface: "#FFFFFF", surface2: "#F2F2F7", border: "#D1D1D6", fg: "#1D1D1F", muted: "#68686D" },
    donker: { accent: "#0A84FF", bg: "#16161C", surface: "#2C2C2E", surface2: "#3A3A3C", border: "#48484A", fg: "#F5F5F7", muted: "#AEAEB2" },
  },
  paper: {
    label: "Paper", font: "serif", radius: "3px", vorm: { hoek: 0.3, pil: "4px" },
    licht:  { accent: "#8A1C1C", bg: "#F3EEE3", surface: "#FBF8F1", surface2: "#EDE6D6", border: "#CFC5B0", fg: "#1F1B16", muted: "#5F574B" },
    donker: { accent: "#C98A4B", bg: "#1E1A15", surface: "#29241D", surface2: "#342D24", border: "#4A4034", fg: "#EFE6D6", muted: "#B5A892", link: "#E0B078" },
    /* Papier: lijnen in plaats van schaduw, geen doorschijnende balken. */
    stijl: (p, dark, accent) => ({
      sep: rgba(p.fg, .3), sepSoft: rgba(p.fg, .16), line: p.border, sidebar: p.bg, hover: rgba(p.fg, .06), gray6: p.surface2,
      hair: `0 0 0 1px ${p.border}`, card: `0 0 0 1px ${p.border}`, pop: `0 0 0 1px ${p.border}, 0 10px 28px rgba(0,0,0,${dark ? .5 : .16})`,
      material: rgba(p.bg, .94), focus: `0 0 0 2px ${accent}`,
    }),
  },
  soft: {
    label: "Soft", font: "rond", radius: "16px", vorm: { hoek: 1.4 },
    licht:  { accent: "#B8408A", bg: "#FBF3F8", surface: "#FFFFFF", surface2: "#F6E8F0", border: "#EBD2E1", fg: "#33263A", muted: "#6F5F75" },
    donker: { accent: "#D65FA6", bg: "#1E1924", surface: "#2A2333", surface2: "#352C40", border: "#4B3F58", fg: "#F4ECF8", muted: "#BBAEC6", link: "#F0A3D0" },
    /* Zacht: getinte schaduwen en vlakken in de kleur van het accent. */
    stijl: (p, dark, accent) => ({
      sep: rgba(p.fg, .16), sepSoft: rgba(p.fg, .09), line: p.border, sidebar: p.bg, hover: rgba(accent, dark ? .14 : .07), gray6: p.surface2,
      hair: `0 0 0 1px ${rgba(accent, dark ? .22 : .1)}`,
      card: dark ? `0 0 0 1px ${rgba(accent, .2)}, 0 4px 14px rgba(0,0,0,.4)` : `0 0 0 1px ${rgba(accent, .08)}, 0 4px 14px ${rgba(accent, .1)}`,
      pop: dark ? `0 0 0 1px ${rgba(accent, .25)}, 0 18px 48px rgba(0,0,0,.6)` : `0 0 0 1px ${rgba(accent, .1)}, 0 18px 48px ${rgba(accent, .2)}`,
      material: rgba(p.bg, .82), focus: `0 0 0 4px ${rgba(accent, .3)}`,
    }),
  },
  contrast: {
    label: "Contrast", font: "systeem", radius: "6px", vorm: { hoek: 0.75 }, vasteKleur: true,
    licht:  { accent: "#0033CC", bg: "#FFFFFF", surface: "#FFFFFF", surface2: "#EFEFEF", border: "#000000", fg: "#000000", muted: "#2B2B2B" },
    /* Donker: een blauw dat zowel met witte tekst erop als zelf op zwart 4,5:1 haalt. */
    donker: { accent: dtNaarLuminantie("#1F75F0", 0.179), bg: "#000000", surface: "#000000", surface2: "#1A1A1A", border: "#FFFFFF", fg: "#FFFFFF", muted: "#D6D6D6", link: "#9CC4FF" },
    /* Contrast: volle lijnen in de tekstkleur, geen schaduw of doorschijnendheid, een stevige focusring. */
    stijl: (p, dark, accent) => ({
      sep: p.fg, sepSoft: rgba(p.fg, .6), line: p.fg, sidebar: p.bg, hover: rgba(p.fg, .14), gray6: p.surface2,
      tint: rgba(accent, dark ? .4 : .16), tintStrong: rgba(accent, dark ? .55 : .26),
      hair: `0 0 0 1px ${p.fg}`, card: `0 0 0 1.5px ${p.fg}`, pop: `0 0 0 2px ${p.fg}`,
      material: p.bg, focus: `0 0 0 2px ${p.bg}, 0 0 0 5px ${dark ? "#FFD60A" : "#B34700"}`,
    }),
  },
};

/* Van de instellingen (theme.preset, mode, kleur, accent) naar één palet in de vorm die de opmaak verwacht.
 * systeemDonker: staat het besturingssysteem op donker (voor mode "auto"). */
function dtThemaPalet(s, systeemDonker) {
  const id = DT_THEMAS[s?.preset] ? s.preset : "magister";
  const T = DT_THEMAS[id];
  if (id === "magister") return { id, label: T.label, dark: false, accent: T.licht.accent, custom: false };
  const dark = s.mode === "dark" || (s.mode !== "light" && !!systeemDonker);
  const v = dark ? T.donker : T.licht;
  const kleur = T.vasteKleur ? "thema" : (s.kleur || "thema");
  const basis = kleur === "eigen" ? (/^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : v.accent) : (DT_ACCENTEN[kleur] || v.accent);
  const accent = T.vasteKleur ? v.accent : dtPassendAccent(basis, dark, v.surface2);
  /* Links: de eigen linkkleur van het thema zolang de themakleur geldt, anders de gekozen kleur (in donker lichter)…
  /* …en altijd minstens 4,6:1 tegen het vlak waar de tekst op staat (papier is geen zuiver wit). */
  const Lv = dtLuminantie(v.surface), grens = dark ? 4.6 * (Lv + 0.05) - 0.05 : (Lv + 0.05) / 4.6 - 0.05;
  const link = kleur === "thema" && v.link ? v.link
    : dark ? dtNaarLuminantie(accent, Math.max(dtLuminantie(accent), grens, 0.42))
    : dtLuminantie(accent) > grens ? dtNaarLuminantie(accent, grens) : accent;
  return { id, label: T.label, dark, accent, link, bg: v.bg, surface: v.surface, surface2: v.surface2, border: v.border, fg: v.fg, muted: v.muted,
    font: T.font, radius: T.radius, look: "apple", glass: !!T.glass, stijl: T.stijl || null, vorm: T.vorm || null, kleur };
}

/* Hoeken van de opmaak schalen (Paper recht, Soft ronder). Pilvormen (999px) blijven, of worden `pil`. Cirkels
 * (50%) blijven altijd rond. */
function dtHoeken(css, vorm) {
  if (!css || !vorm || (vorm.hoek === 1 && !vorm.pil)) return css;
  const maat = (w) => w.replace(/(\d*\.?\d+)px/g, (x, n) => (+n >= 999 ? (vorm.pil || x) : `${Math.round(+n * vorm.hoek * 10) / 10}px`));
  return css.replace(/(border(?:-[a-z]+){0,2}-radius\s*:\s*)([^;}]+)/g, (m, kop, w) => kop + maat(w))
    .replace(/(--[\w-]*[rR]adius[\w-]*\s*:\s*)([^;}]+)/g, (m, kop, w) => kop + maat(w));
}

/* Magisters oudere schermen kleuren veel pictogrammen, knoppen, randen en vlakken met een vast blauw in plaats van
 * met de variabelen van het designsysteem. DT_MAGISTER_KLEUREN (gegenereerd uit Magisters eigen stijlbladen, zie
 * scripts/magister-kleuren.py) somt die plekken op; hier krijgen ze de kleur van het thema, per trede van licht
 * naar donker.
 *
 * De selectors staan in :where(), dat geen gewicht heeft: deze regels vullen alleen de gaten. Alles wat de opmaak
 * van het thema zelf al regelt gaat voor, en er hoeft geen element op de pagina te worden nagelopen. */
function dtMagisterKleurenCss(p) {
  if (typeof DT_MAGISTER_KLEUREN === "undefined" || !p || !p.bg) return "";
  const a = p.accent, link = p.link || a;
  const vlak = [null, mix(a, p.surface, .9), mix(a, p.surface, .76), mix(a, p.surface, .4), a, mix(a, "#000000", .3)];
  const kleur = {
    vlak, rand: [null, mix(a, p.surface, .8), mix(a, p.surface, .62), mix(a, p.surface, .3), a, mix(a, "#000000", .3)],
    /* Tekst en pictogrammen: heel licht blauw staat bij Magister op een blauw vlak en blijft dus licht. */
    tekst: [null, mix(a, "#ffffff", .86), mix(a, "#ffffff", .7), link, link, p.dark ? link : mix(link, "#000000", .25)],
  };
  let css = "";
  for (const [sleutel, selectors] of Object.entries(DT_MAGISTER_KLEUREN)) {
    const [eigenschap, soortTrede, pseudo] = sleutel.split("|");
    const waarde = (kleur[soortTrede.slice(0, -1)] || [])[+soortTrede.slice(-1)];
    if (waarde) css += `:where(${selectors})${pseudo} { ${eigenschap}: ${waarde} !important; }\n`;
  }
  /* Tekeningen van Magister (lege agenda, geen resultaten) zijn blauw getekend: de tint meedraaien naar het accent,
   * en in donker iets dimmen. Logo's blijven zoals ze zijn. */
  const graden = Math.round(toHsl(hex2rgb(a)).h - 203);
  css += `img[src*="geen-"][src$=".svg"], img[src*="empty"][src$=".svg"], img[src*="illustrat"], img[src*="placeholder" i][src$=".svg"] { filter: hue-rotate(${graden}deg)${p.dark ? " brightness(.85)" : ""} !important; }\n`;
  return css;
}

/* Waarden voor een feColorMatrix die elke pixel de kleur `hex` geeft en de doorzichtigheid laat staan. */
function dtKleurMatrix(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "";
  const n = parseInt(m[1], 16);
  const k = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(4));
  return `0 0 0 0 ${k[0]} 0 0 0 0 ${k[1]} 0 0 0 0 ${k[2]} 0 0 0 1 0`;
}
