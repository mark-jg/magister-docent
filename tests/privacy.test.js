/* Naammaskering in AI-hulp (content/modules/ai.js) en het tekstcontrast van de thema's (content/modules/theme.js). */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister } = require("./hulp");

const { DT } = metRegister();
const { dtMaskeerNamen } = laad("content/modules/ai.js", { DT, window: {}, document: {} }, ["dtMaskeerNamen"]).uit;

test("namen maskeren: tussenvoegsels, koppeltekens, apostrof en accenten", () => {
  for (const naam of ["Jan de Vries", "Sanne van der Berg", "Anne-Marie Bakker", "Noah O'Brien", "Zoë Çelik", "Fatima El Amrani", "Pieter van 't Hof"]) {
    assert.strictEqual(dtMaskeerNamen(`Leerling ${naam.toLowerCase() === naam ? naam : naam} was afwezig.`).includes(naam.split(" ").pop()), false, naam);
    assert.strictEqual(dtMaskeerNamen(`afwezig: ${naam}.`), "afwezig: [naam].", naam);
  }
});

test("namen maskeren: de schrijfwijze 'Achternaam, Voornaam tussenvoegsel'", () => {
  assert.strictEqual(dtMaskeerNamen("afwezig: Vries, Jan de (3x)"), "afwezig: [naam] (3x)");
});

test("namen maskeren: een naam die elders los terugkomt wordt ook gemaskeerd", () => {
  const uit = dtMaskeerNamen("Jan de Vries is drie keer te laat. Gisteren was Jan er niet; mevrouw Vries is gebeld.");
  assert.doesNotMatch(uit, /Jan|Vries/);
});

test("namen maskeren: stamnummers weg, cijfers en datums blijven", () => {
  assert.strictEqual(dtMaskeerNamen("nr 123456, cijfer 7,5 op 12-11-2026, 4 lessen"), "nr [nummer], cijfer 7,5 op 12-11-2026, 4 lessen");
});

test("namen maskeren: cellen in een tabel (tabs) worden niet aan elkaar geplakt tot één naam", () => {
  assert.strictEqual(dtMaskeerNamen("Klas\tAfwezig\tTe laat\nMR1A\t3\t1"), "Klas\tAfwezig\tTe laat\nMR1A\t3\t1");
});

/* ---------- contrast ---------- */
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = hex.replace("#", ""); return 0.2126 * lin(parseInt(n.slice(0, 2), 16)) + 0.7152 * lin(parseInt(n.slice(2, 4), 16)) + 0.0722 * lin(parseInt(n.slice(4, 6), 16)); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const thema = laad("content/modules/theme.js", { DT, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) }, document: {} }, ["contrastInk", "mix"]).uit;

test("contrast: de inktkleur op een accentkleur is altijd de best leesbare van wit en bijna-zwart", () => {
  for (const hex of ["#000000", "#ffffff", "#1B3A5C", "#FF2D95", "#F5A623", "#7FB8A4", "#808080", "#E8B84A", "#AF52DE", "#34C759"]) {
    const inkt = thema.contrastInk(hex), ander = inkt === "#ffffff" ? "#111111" : "#ffffff";
    assert.ok(contrast(inkt, hex) >= contrast(ander, hex), `${hex}: ${inkt}`);
    assert.ok(contrast(inkt, hex) >= 4.5, `${hex}: contrast ${contrast(inkt, hex).toFixed(2)}`);
  }
});
