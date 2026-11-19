/* De zes thema's (content/modules/theme-themas.js): palet per thema, licht/donker en accentkleur, leesbaarheid,
 * de opmaak die eruit komt, en het verhuizen van de oude themakeuze. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, kaal } = require("./hulp");

const ctx = laad(["content/defaults.js", "content/modules/theme-kleur.js", "content/modules/theme-apple.js", "content/modules/theme-magisterkleuren.js", "content/modules/theme-themas.js"],
  { window: { top: null }, document: {} },
  ["DT_THEMAS", "DT_ACCENTEN", "dtThemaPalet", "dtContrast", "dtPassendAccent", "dtHoeken", "appleCss", "appleShadowCss", "appleShellCss", "tokenCss", "tokenMap", "dtMagisterKleurenCss", "DT_MAGISTER_KLEUREN", "dtKleurMatrix", "dtThemaVar"]);
const { DT_THEMAS, DT_ACCENTEN, dtThemaPalet, dtContrast, dtPassendAccent, dtHoeken, appleCss, appleShadowCss, appleShellCss, tokenCss, tokenMap, dtMagisterKleurenCss, DT_MAGISTER_KLEUREN, dtKleurMatrix, dtThemaVar } = ctx.uit;
const MET_OPMAAK = ["minimal", "glass", "paper", "soft", "contrast"];
const KLEUREN = ["thema", ...Object.keys(DT_ACCENTEN), "eigen"];
const alle = (fn) => { for (const id of MET_OPMAAK) for (const mode of ["light", "dark"]) fn(id, mode); };

test("er zijn precies zes thema's, en de keuzelijst kent dezelfde", () => {
  assert.deepStrictEqual(Object.keys(DT_THEMAS), ["magister", "minimal", "glass", "paper", "soft", "contrast"]);
  assert.deepStrictEqual(kaal(ctx.DT_THEMAS_LIST).map((x) => x[0]), Object.keys(DT_THEMAS));
  assert.deepStrictEqual(kaal(ctx.DT_KLEUREN_LIST).map((x) => x[0]), KLEUREN);
  for (const [id, , hex] of kaal(ctx.DT_KLEUREN_LIST)) if (hex) assert.strictEqual(hex, DT_ACCENTEN[id], `kleur ${id} is in beide lijsten gelijk`);
});

test("Magister verandert niets: geen palet, geen donkere variant", () => {
  const p = dtThemaPalet({ preset: "magister", mode: "dark", kleur: "roze" }, true);
  assert.strictEqual(p.dark, false); assert.strictEqual(p.bg, undefined); assert.strictEqual(p.look, undefined);
  assert.strictEqual(dtThemaPalet({ preset: "bestaat-niet" }, false).id, "magister");
});

test("licht en donker: vaste keuze, of het systeem volgen", () => {
  assert.strictEqual(dtThemaPalet({ preset: "paper", mode: "auto" }, true).dark, true);
  assert.strictEqual(dtThemaPalet({ preset: "paper", mode: "auto" }, false).dark, false);
  assert.strictEqual(dtThemaPalet({ preset: "paper", mode: "light" }, true).dark, false);
  assert.strictEqual(dtThemaPalet({ preset: "paper", mode: "dark" }, false).dark, true);
});

test("leesbaarheid: tekst, grijze tekst en links halen 4,5:1 op elk vlak, in elk thema", () => {
  alle((id, mode) => {
    for (const kleur of KLEUREN) {
      const p = dtThemaPalet({ preset: id, mode, kleur, accent: "#FFD400" }, false), wie = `${id} ${mode} ${kleur}`;
      for (const vlak of [p.bg, p.surface, p.surface2]) {
        assert.ok(dtContrast(p.fg, vlak) >= 7, `${wie}: tekst op ${vlak} = ${dtContrast(p.fg, vlak).toFixed(2)}`);
        assert.ok(dtContrast(p.muted, vlak) >= 4.5, `${wie}: grijze tekst op ${vlak} = ${dtContrast(p.muted, vlak).toFixed(2)}`);
      }
      assert.ok(dtContrast(p.link, p.surface) >= 4.5, `${wie}: link = ${dtContrast(p.link, p.surface).toFixed(2)}`);
    }
  });
});

test("accentkleur: witte tekst erop blijft leesbaar, ook bij een zelf gekozen felle of bleke kleur", () => {
  alle((id, mode) => {
    for (const kleur of KLEUREN) for (const eigen of ["#FFD400", "#FFFFFF", "#000000", "#7FB8A4"]) {
      const p = dtThemaPalet({ preset: id, mode, kleur, accent: eigen }, false), wit = dtContrast("#ffffff", p.accent), wie = `${id} ${mode} ${kleur} ${eigen}`;
      /* Licht: 4,5:1. Donker: 3:1 tegen wit én tegen de donkere vlakken (de norm voor bedieningselementen). */
      if (!p.dark) { assert.ok(wit >= 4.5, `${wie}: wit op accent = ${wit.toFixed(2)}`); assert.ok(dtContrast(p.accent, p.surface2) >= 4.45, `${wie}: accent als tekst op het vlak = ${dtContrast(p.accent, p.surface2).toFixed(2)}`); }
      else { assert.ok(wit >= 3, `${wie}: wit op accent = ${wit.toFixed(2)}`); assert.ok(dtContrast(p.accent, p.surface) >= 2.95, `${wie}: accent op vlak = ${dtContrast(p.accent, p.surface).toFixed(2)}`); }
      if (kleur !== "eigen") break;
    }
  });
});

test("Contrast: tekst 21:1, de eigen kleur ligt vast en haalt overal 4,5:1", () => {
  for (const mode of ["light", "dark"]) {
    const p = dtThemaPalet({ preset: "contrast", mode, kleur: "roze" }, false);
    assert.strictEqual(p.kleur, "thema", "een gekozen accentkleur wordt genegeerd");
    assert.ok(dtContrast(p.fg, p.bg) >= 20.9);
    assert.ok(dtContrast("#ffffff", p.accent) >= 4.5, `wit op accent ${mode}`);
    assert.ok(dtContrast(p.accent, p.bg) >= 4.45, `accent op achtergrond ${mode} = ${dtContrast(p.accent, p.bg).toFixed(2)}`);
  }
});

test("een eigen kleur die al past blijft precies wat je koos", () => {
  assert.strictEqual(dtPassendAccent("#1B3A5C", false), "#1B3A5C");
  assert.notStrictEqual(dtPassendAccent("#FFD400", false), "#FFD400");
});

test("opmaak: elk thema levert volledige CSS, zonder ontbrekende waarden", () => {
  alle((id, mode) => {
    const p = dtThemaPalet({ preset: id, mode, kleur: "thema" }, false);
    const delen = { tokens: tokenCss(p, p.dark), pagina: appleCss(p, p.dark, p.accent, true), frame: appleCss(p, p.dark, p.accent, false), shadow: appleShadowCss(p, p.dark, p.accent), schil: appleShellCss(p, p.dark, p.accent) };
    for (const [naam, css] of Object.entries(delen)) {
      const uit = dtHoeken(css, p.vorm);
      assert.ok(uit.length > 200, `${id} ${mode} ${naam}: leeg`);
      assert.doesNotMatch(uit, /undefined|NaN|\[object|\$\{/, `${id} ${mode} ${naam}`);
      assert.strictEqual((uit.match(/\{/g) || []).length, (uit.match(/\}/g) || []).length, `${id} ${mode} ${naam}: accolades in balans`);
    }
    for (const [k, v] of Object.entries(tokenMap(p))) assert.ok(typeof v === "string" && v && !/undefined|NaN/.test(v), `${id} ${mode}: variabele ${k}`);
  });
});

test("karakter: Paper gebruikt een schreefletter en geen doorschijnendheid, alleen Glass is doorschijnend", () => {
  const css = (id) => { const p = dtThemaPalet({ preset: id, mode: "light" }, false); return appleCss(p, false, p.accent, true); };
  assert.match(css("paper"), /Georgia/); assert.doesNotMatch(css("paper"), /SF Pro/);
  assert.match(css("soft"), /Rounded|Nunito/);
  const blur = (id) => (css(id).match(/backdrop-filter/g) || []).length;
  assert.ok(blur("glass") > blur("minimal"), "Glass heeft meer doorschijnende vlakken dan Minimal");
});

test("hoeken: Paper recht, Soft ronder; cirkels blijven rond", () => {
  const css = ".a { border-radius: 10px; } .b { border-radius: 999px !important; } .c { border-radius: 50%; } .d { border-top-left-radius: 14px; --x-borderRadius-md: 8px; width: 10px; }";
  assert.strictEqual(dtHoeken(css, DT_THEMAS.paper.vorm), ".a { border-radius: 3px; } .b { border-radius: 4px !important; } .c { border-radius: 50%; } .d { border-top-left-radius: 4.2px; --x-borderRadius-md: 2.4px; width: 10px; }");
  assert.strictEqual(dtHoeken(css, DT_THEMAS.soft.vorm), ".a { border-radius: 14px; } .b { border-radius: 999px !important; } .c { border-radius: 50%; } .d { border-top-left-radius: 19.6px; --x-borderRadius-md: 11.2px; width: 10px; }");
  assert.strictEqual(dtHoeken(css, null), css);
});

/* ---------- vaste blauwtinten van Magister ---------- */
test("Magisters vaste blauw: de lijst is gevuld en elke groep heeft een bekende vorm", () => {
  const sleutels = Object.keys(DT_MAGISTER_KLEUREN);
  assert.ok(sleutels.length >= 20, `${sleutels.length} groepen`);
  /* Haakjes in balans: één scheve selector zou anders de hele regel ongeldig maken. */
  for (const [k, sel] of Object.entries(DT_MAGISTER_KLEUREN)) for (const [open, dicht] of ["()", "[]"]) assert.strictEqual(sel.split(open).length, sel.split(dicht).length, `${k}: ${open}${dicht}`);
  for (const k of sleutels) assert.match(k, /^(color|fill|stroke|background-color|outline-color|border(-(top|right|bottom|left))?-color)\|(tekst|vlak|rand)[1-5]\|(::?[a-z-]+)?$/, k);
});

test("Magisters vaste blauw: krijgt in elk thema de kleur van het thema, als gatenvuller", () => {
  alle((id, mode) => {
    const p = dtThemaPalet({ preset: id, mode, kleur: "groen" }, false), css = dtMagisterKleurenCss(p);
    assert.ok(css.length > 5000, `${id} ${mode}: ${css.length} tekens`);
    assert.doesNotMatch(css, /undefined|NaN|#0096db|#1f97f9|#056dc2/i, `${id} ${mode}`);
    /* Elke regel staat in :where() (geen gewicht), zodat de opmaak van het thema altijd voorgaat. */
    for (const regel of css.trim().split("\n").filter((r) => !r.startsWith("img["))) assert.match(regel, /^:where\(.+\)(::?[a-z-]+)? \{ [a-z-]+: #[0-9a-f]{6} !important; \}$/i, regel.slice(0, 80));
    assert.ok(css.includes(p.accent), `${id} ${mode}: het accent komt erin voor`);
  });
  assert.strictEqual(dtMagisterKleurenCss(dtThemaPalet({ preset: "magister" }, false)), "", "Magister zelf blijft onaangeroerd");
});

/* ---------- oude themakeuze ---------- */
const migreer = (t) => kaal(ctx.DT_THEMA_MIGRATIE(t));

test("verhuizen: elk oud thema komt bij een bestaand nieuw thema uit", () => {
  const oud = ["magister", "mca", "zand", "mint", "contrast", "krant", "pastel", "retro", "oceaan", "apple", "appleGlass", "nacht", "marine", "bos", "oled", "sepia", "terminal", "synthwave", "appleDonker", "appleGlassDonker", "custom"];
  for (const preset of oud) {
    const t = migreer({ preset, mode: "auto", lightPreset: "magister", darkPreset: "nacht", darkStyle: "invert", recolor: true });
    assert.ok(DT_THEMAS[t.preset], `${preset} → ${t.preset}`);
    assert.ok(KLEUREN.includes(t.kleur), `${preset}: kleur ${t.kleur}`);
    assert.strictEqual(t.versie, 2);
    for (const k of ["lightPreset", "darkPreset", "darkStyle", "recolor"]) assert.ok(!(k in t), `${preset}: ${k} is opgeruimd`);
  }
});

test("verhuizen: voorbeelden", () => {
  assert.deepStrictEqual(migreer({ preset: "appleGlassDonker" }), { preset: "glass", mode: "dark", kleur: "thema", versie: 2 });
  assert.deepStrictEqual(migreer({ preset: "mca", mode: "auto" }), { preset: "minimal", mode: "light", kleur: "mca", versie: 2 });
  assert.deepStrictEqual(migreer({ preset: "krant" }), { preset: "paper", mode: "light", kleur: "thema", versie: 2 });
  assert.deepStrictEqual(migreer({ preset: "pastel" }), { preset: "soft", mode: "light", kleur: "thema", versie: 2 });
  assert.deepStrictEqual(migreer({ preset: "oled" }), { preset: "contrast", mode: "dark", kleur: "thema", versie: 2 });
  assert.deepStrictEqual(migreer({ preset: "custom", mode: "dark", accent: "#aa00aa" }), { preset: "minimal", mode: "dark", accent: "#aa00aa", kleur: "eigen", versie: 2 });
});

test("verhuizen: gebeurt één keer; een nieuwe keuze voor Contrast donker blijft staan", () => {
  const t = { preset: "contrast", mode: "dark", kleur: "thema", versie: 2 };
  assert.deepStrictEqual(migreer(t), { preset: "contrast", mode: "dark", kleur: "thema", versie: 2 });
  const eerst = ctx.DT_THEMA_MIGRATIE({ preset: "contrast" });
  assert.strictEqual(eerst.mode, "light", "het oude 'Hoog contrast licht' wordt Contrast licht");
  eerst.mode = "dark";
  assert.strictEqual(ctx.DT_THEMA_MIGRATIE(eerst).mode, "dark");
});

test("menu-afbeeldingen (Cijfers) krijgen de accentkleur via een filter, geen vast blauw", () => {
  assert.strictEqual(dtKleurMatrix("#FF0080"), "0 0 0 0 1 0 0 0 0 0 0 0 0 0 0.502 0 0 0 1 0");
  assert.strictEqual(dtKleurMatrix("geen kleur"), "");
  const p = dtThemaPalet({ preset: "minimal", mode: "light", kleur: "grafiet" }, false);
  const css = appleCss(p, false, p.accent);
  assert.match(css, /img\.far \{ filter: url\(#dt-accent-filter\)/);
  assert.doesNotMatch(css, /hue-rotate\(201deg\)/);
});

test("terug naar het thema Magister: elke variabele van een thema wordt weer opgeruimd", () => {
  for (const id of Object.keys(DT_THEMAS).filter((x) => x !== "magister")) {
    const p = dtThemaPalet({ preset: id, mode: "dark" }, false);
    const over = Object.keys(tokenMap(p)).filter((n) => !dtThemaVar(n));
    assert.deepStrictEqual(over, [], `${id}: blijft staan na wisselen`);
  }
});

test("tabbladen: het paneel met de inhoud (dna-tab[slot=tab]) krijgt in geen enkel thema een eigen kader", () => {
  for (const id of Object.keys(DT_THEMAS).filter((x) => x !== "magister")) {
    const p = dtThemaPalet({ preset: id, mode: "light" }, false);
    const css = appleCss(p, false, p.accent, true);
    const kaal = [...css.matchAll(/(^|[},])\s*dna-tab(\[selected\])?\s*\{/g)];
    assert.strictEqual(kaal.length, 0, `${id}: een regel voor elk dna-tab raakt ook het paneel`);
    assert.match(css, /:is\(#dt-cbp, #dt-lrp\) dna-tab\[slot="tab"\] \{ background: transparent/);
  }
});
