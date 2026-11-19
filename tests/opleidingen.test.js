/* De rekenfuncties van de pagina Opleidingen (content/modules/opleidingen-reken.js): de boom opleiding › leerjaar ›
 * klas, de peildatums van het verloop, en de optelling van de aanwezigheid per klas. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, kaal } = require("./hulp");

const R = laad("content/modules/opleidingen-reken.js", {}, ["OplReken"]).uit.OplReken;

test("peildatums: de eerste van elke maand zonder augustus, 1 oktober is teldatum, vandaag sluit af", () => {
  const p = R.peildata(new Date(2026, 10, 19), 1);
  assert.strictEqual(p[0].datum, "2025-09-01");
  assert.ok(!p.some((x) => x.datum.slice(5, 7) === "08"));
  assert.deepStrictEqual(kaal(p.filter((x) => x.teldatum).map((x) => x.datum)), ["2025-10-01", "2026-10-01"]);
  assert.strictEqual(p.at(-1).datum, "2026-11-19"); assert.strictEqual(p.at(-1).vandaag, true);
  assert.strictEqual(p.find((x) => x.datum === "2026-07-01").sj, "2025–2026");
  assert.strictEqual(R.peildata(new Date(2026, 10, 1), 0).filter((x) => x.datum === "2026-11-01").length, 1, "valt vandaag op de eerste, dan staat die er één keer in");
});

test("schooljaar loopt van 1 augustus tot en met 31 juli", () => {
  assert.strictEqual(R.sjNaam(new Date(2026, 6, 31)), "2025–2026");
  assert.strictEqual(R.sjNaam(new Date(2026, 7, 1)), "2026–2027");
});

test("opleiding en leerjaar: als tekst, lijst of object, en uit de aanmelding die op de peildatum loopt", () => {
  assert.strictEqual(R.studie({ studie: "Mediavormgever" }), "Mediavormgever");
  assert.strictEqual(R.studie({ Studies: ["Mediavormgever", "x"] }), "Mediavormgever");
  assert.strictEqual(R.studie({ studie: { code: "MV", omschrijving: "Mediavormgever" } }), "Mediavormgever");
  assert.strictEqual(R.studie({ naam: "Jan" }), "");
  assert.strictEqual(R.leerjaar({ leerjaar: "2" }), 2);
  assert.strictEqual(R.leerjaar({ studie: { leerjaar: 3 } }), 3);
  assert.strictEqual(R.leerjaar({}), null);
  assert.strictEqual(R.leerjaarUitKlas("MV2A"), 2); assert.strictEqual(R.leerjaarUitKlas("ABC"), null);
  const am = [{ id: 1, begin: "2024-08-01", einde: "2025-07-31", studie: "Oud" }, { id: 2, begin: "2025-08-01", einde: "2026-07-31", studie: "Bij" }, { id: 3, begin: "2025-08-01", einde: "2026-07-31", studie: "Hoofd", isHoofdAanmelding: true }];
  assert.strictEqual(R.aanmeldingOp(am, "2025-10-01").id, 3);
  assert.strictEqual(R.aanmeldingOp(am, "2024-10-01").id, 1);
  assert.strictEqual(R.aanmeldingOp(am, "2030-01-01").id, 2, "loopt er geen, dan de laatste");
  assert.strictEqual(R.aanmeldingOp([], "2025-10-01"), null);
  assert.strictEqual(R.meeste(["a", "", "b", "b", null]), "b");
});

const KLASSEN = [
  { naam: "MV2A", aantal: 20, studie: "Mediavormgever", leerjaar: 2, mentor: "J. Jansen" }, { naam: "MV1B", aantal: 25, studie: "Mediavormgever", leerjaar: 1 },
  { naam: "MV1A", aantal: 24, studie: "Mediavormgever", leerjaar: 1 }, { naam: "SD1A", aantal: 18, studie: "Software developer", leerjaar: 1 }, { naam: "X9", aantal: 3, studie: "", leerjaar: null },
];

test("boom: opleiding › leerjaar › klas, gesorteerd, met optellingen; onbekend staat achteraan", () => {
  const boom = R.boom(KLASSEN);
  assert.deepStrictEqual(kaal(boom.map((o) => [o.naam, o.aantal])), [["Mediavormgever", 69], ["Software developer", 18], [R.ONBEKEND, 3]]);
  const mv = boom[0];
  assert.deepStrictEqual(kaal(mv.kinderen.map((j) => [j.naam, j.aantal, j.klassen.join()])), [["Leerjaar 1", 49, "MV1A,MV1B"], ["Leerjaar 2", 20, "MV2A"]]);
  assert.strictEqual(mv.kinderen[1].kinderen[0].mentor, "J. Jansen");
  assert.strictEqual(boom[2].kinderen[0].naam, "Leerjaar onbekend");
  const plat = R.plat(boom);
  assert.strictEqual(plat.length, 3 + 4 + 5);
  assert.strictEqual(new Set(plat.map((k) => k.id)).size, plat.length, "elke knoop heeft een eigen id");
});

test("verloop: klassen van vroeger tellen mee bij hun opleiding en leerjaar", () => {
  const boom = R.boom(KLASSEN), kaart = { MV1A: { studie: "Mediavormgever", leerjaar: 1 }, MV1B: { studie: "Mediavormgever", leerjaar: 1 }, MV2A: { studie: "Mediavormgever", leerjaar: 2 }, MV1C: { studie: "Mediavormgever", leerjaar: 1 }, SD1A: { studie: "Software developer", leerjaar: 1 } };
  const tellingen = [{ datum: "2025-10-01", klassen: { MV1A: 26, MV1C: 22, MV2A: 21 } }, { datum: "2026-10-01", klassen: { MV1A: 25, MV1B: 25, MV2A: 20 } }, { datum: "2026-11-19", klassen: { MV1A: 24, MV1B: 25, MV2A: 20 } }];
  assert.deepStrictEqual(kaal(R.klassenVan(boom[0], kaart).sort()), ["MV1A", "MV1B", "MV1C", "MV2A"]);
  assert.deepStrictEqual(kaal(R.klassenVan(boom[0].kinderen[0], kaart).sort()), ["MV1A", "MV1B", "MV1C"]);
  const reeks = R.reeks(R.klassenVan(boom[0], kaart), tellingen);
  assert.deepStrictEqual(kaal(reeks.map((p) => p.n)), [69, 70, 69]);
  assert.strictEqual(R.verschil(reeks, "2026-10-01"), -1);
  assert.strictEqual(R.verschil(reeks, "2025-12-31"), 0);
  assert.strictEqual(R.verschil(reeks, "2020-01-01"), null);
  assert.strictEqual(R.verschil(reeks.slice(2), "2026-11-19"), null, "één punt is geen verloop");
});

const les = (dag, cat) => ({ begin: new Date(2026, 10, dag, 9), cat });

test("aanwezigheid: te laat telt als aanwezig, vrijstelling valt buiten het percentage", () => {
  const agg = R.leeg();
  R.voegStudent(agg, [les(16, "OK"), les(17, "TL"), les(18, "ZK"), les(19, "AB_NO"), les(20, "VR")]);
  const c = R.cijfers(agg.per);
  assert.strictEqual(c.lessen, 5); assert.strictEqual(c.telt, 4); assert.strictEqual(c.aanwezig, 2); assert.strictEqual(c.pct, 50);
  assert.strictEqual(c.cat.ZK.pct, 25); assert.strictEqual(c.cat.VR.pct, 20);
  assert.deepStrictEqual(kaal(agg.banden), [1, 0, 0, 0]); assert.strictEqual(agg.onder, 1);
  assert.deepStrictEqual(kaal(Object.keys(agg.weken)), ["2026-11-16"], "de week staat op de maandag");
  assert.strictEqual(agg.dagen[1].OK, 1);
  assert.strictEqual(R.cijfers({}).pct, null);
});

test("aanwezigheid: studenten zonder lessen en mislukte studenten tellen apart; klassen optellen", () => {
  const a = R.leeg(), b = R.leeg();
  R.voegStudent(a, [les(16, "OK"), les(17, "OK"), les(18, "OK"), les(19, "OK"), les(20, "AB_OK")]);   // 80%: niet onder de norm
  R.voegStudent(a, []); R.voegStudent(a, null);
  R.voegStudent(b, Array.from({ length: 10 }, (_, i) => les(9 + (i % 5), i < 9 ? "OK" : "UI")));       // 90%
  assert.strictEqual(a.studenten, 2); assert.strictEqual(a.zonder, 1); assert.strictEqual(a.fout, 1); assert.strictEqual(a.onder, 0);
  const som = R.som([a, undefined, b]);
  assert.strictEqual(som.studenten, 3); assert.deepStrictEqual(kaal(som.banden), [0, 0, 1, 1]);
  assert.strictEqual(R.cijfers(som.per).pct, 86.7);
  assert.deepStrictEqual(kaal(Object.keys(som.weken).sort()), ["2026-11-09", "2026-11-16"]);
  assert.strictEqual(R.som([undefined, null]), null);
});

test("studiecode: opleiding, crebo en cohort; leerjaar volgt uit het cohort", () => {
  assert.deepStrictEqual(kaal(R.code("MI-25881-25")), { opleiding: "MI", crebo: "25881", cohort: 2025 });
  assert.deepStrictEqual(kaal(R.code("mi 25881 2024")), { opleiding: "MI", crebo: "25881", cohort: 2024 });
  assert.deepStrictEqual(kaal(R.code("Mediavormgever")), { opleiding: "Mediavormgever", crebo: "", cohort: null });
  assert.deepStrictEqual(kaal(R.indeel({ studie: "MI-25881-25", lj: null, mentor: "X" }, "MIP25A", 2026)), { studie: "MI", crebo: "25881", cohort: 2025, leerjaar: 2, mentor: "X" });
  assert.strictEqual(R.indeel({ studie: "MI-25881-25", lj: 1 }, "MIP25A", 2026).leerjaar, 1, "het leerjaar uit Magister gaat voor");
  assert.strictEqual(R.indeel({ studie: "MI-25881-27" }, "MIP2A", 2026).leerjaar, null, "een cohort dat nog moet beginnen heeft geen leerjaar, ook niet uit de klasnaam");
  assert.strictEqual(R.indeel({ studie: "Mediavormgever" }, "MV2A", 2026).leerjaar, 2);
  assert.strictEqual(R.indeel(undefined, "X", 2026).studie, "");
});

test("boom: een opleidingscode krijgt de naam waarmee de klassen beginnen (MI → MIP), met het crebo erbij", () => {
  const boom = R.boom([{ naam: "MIP1A", aantal: 20, ...R.indeel({ studie: "MI-25881-26" }, "MIP1A", 2026) }, { naam: "MIP2A", aantal: 18, ...R.indeel({ studie: "MI-25881-25" }, "MIP2A", 2026) }, { naam: "SD1A", aantal: 9, ...R.indeel({ studie: "SD-25998-26" }, "SD1A", 2026) }]);
  assert.deepStrictEqual(kaal(boom.map((o) => [o.naam, o.studie, o.crebo, o.aantal])), [["MIP", "MI", "25881", 38], ["SD", "SD", "25998", 9]]);
  assert.deepStrictEqual(kaal(boom[0].kinderen.map((j) => [j.naam, j.cohort])), [["Leerjaar 1", 2026], ["Leerjaar 2", 2025]]);
  assert.strictEqual(R.voorvoegsel(["MIP1A", "MIP2B"]), "MIP"); assert.strictEqual(R.voorvoegsel(["AB1", "CD1"]), "");
});

test("cohorten: studenten per opleiding en instroomjaar, ook als een klas twee cohorten bevat", () => {
  const c = R.cohorten([{ "MI-25881-25": 18, "MI-25881-24": 2 }, { "MI-25881-24": 15 }, undefined, { "SD-25998-25": 9, "Onbekend": 3 }]);
  assert.deepStrictEqual(kaal(c), { cohorten: [2024, 2025], rijen: [{ studie: "MI", per: { 2024: 17, 2025: 18 }, totaal: 35 }, { studie: "SD", per: { 2025: 9 }, totaal: 9 }] });
});

test("verloop: leeg, vlak (Magister negeert de peildatum) of bruikbaar", () => {
  const nu = { datum: "2026-11-19", vandaag: true, klassen: { A: 20, B: 18 } }, op = (datum, klassen) => ({ datum, klassen });
  assert.strictEqual(R.verloopStand([nu]), "leeg");
  assert.strictEqual(R.verloopStand([op("2026-09-01", {}), op("2026-10-01", { A: 0 }), nu]), "leeg");
  assert.strictEqual(R.verloopStand([op("2026-09-01", { A: 20, B: 18 }), op("2026-10-01", { A: 20, B: 18 }), op("2026-11-01", { B: 18, A: 20 }), nu]), "vlak");
  assert.strictEqual(R.verloopStand([op("2026-09-01", { A: 21, B: 18 }), op("2026-10-01", { A: 20, B: 18 }), op("2026-11-01", { A: 20, B: 18 }), nu]), "ok");
  assert.strictEqual(R.verloopStand([op("2026-11-01", { A: 20, B: 18 }), nu]), "ok", "twee gelijke punten zeggen nog niets");
});

test("aanwezigheid: per week het aantal studenten met lessen, ook opgeteld over klassen", () => {
  const a = R.leeg(), b = R.leeg();
  R.voegStudent(a, [les(16, "OK"), les(17, "ZK")]); R.voegStudent(a, [les(9, "OK"), les(16, "OK")]); R.voegStudent(b, [les(16, "TL")]);
  assert.deepStrictEqual(kaal(a.actief), { "2026-11-16": 2, "2026-11-09": 1 });
  assert.deepStrictEqual(kaal(R.som([a, b]).actief), { "2026-11-16": 3, "2026-11-09": 1 });
});
