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

test("studenten per week uit de lessen: per lesmoment en per week, weken met weinig lessen vallen weg", () => {
  const l = (dag, uur, vak = "Engels") => ({ begin: new Date(2026, 10, dag, uur), vak, docent: "D" }), acc = R.lesLeeg();
  /* Drie studenten in week 46 (9-13 nov), twee in week 47 (één is weg), en in week 48 alleen één losse les. */
  const dagen = (ds) => ds.flatMap((d) => [l(d, 9), l(d, 10, "Nederlands")]);
  R.voegLessen(acc, [...dagen([9, 10, 11, 16, 17, 18]), l(23, 9)]);
  R.voegLessen(acc, dagen([9, 10, 11, 16, 17, 18]));
  R.voegLessen(acc, [...dagen([9, 10]), l(11, 11, "Keuzevak")]);
  R.voegLessen(acc, null);
  const weken = R.lesWeken(acc);
  assert.deepStrictEqual(kaal(weken), { "2026-11-09": { actief: 3, lessen: 7, grootste: 3 }, "2026-11-16": { actief: 2, lessen: 6, grootste: 2 }, "2026-11-23": { actief: 1, lessen: 1, grootste: 1 } });
  assert.deepStrictEqual(kaal(R.lesPunten(weken)), { "2026-11-09": 3, "2026-11-16": 2 }, "één les in een week van normaal zes is te weinig om te tellen");
  assert.deepStrictEqual(kaal(R.lesPunten({})), {});
});

test("studenten per week: klassen optellen; een klas zonder punt in een week telt met zijn vorige stand", () => {
  const a = { "2026-11-02": 20, "2026-11-09": 19, "2026-11-16": 19 }, b = { "2026-11-09": 25, "2026-11-23": 24 };
  assert.deepStrictEqual(kaal(R.lesReeks([a, b, undefined, {}])), [{ datum: "2026-11-02", n: 45 }, { datum: "2026-11-09", n: 44 }, { datum: "2026-11-16", n: 44 }, { datum: "2026-11-23", n: 43 }]);
  assert.deepStrictEqual(kaal(R.lesReeks([a], ["2026-11-09", "2026-11-30"])), [{ datum: "2026-11-09", n: 19 }, { datum: "2026-11-30", n: 19 }]);
  assert.deepStrictEqual(kaal(R.lesReeks([])), []);
});

/* ---------- jaaropslag ---------- */
const lesOp = (dag, cat, uur = 9) => ({ begin: new Date(2026, 10, dag, uur), cat, vak: "Engels", docent: "D" });

test("jaaropslag: lessen per student per week, in de volgorde van de categorieën", () => {
  const w = R.studentWeken([lesOp(9, "OK"), lesOp(10, "TL"), lesOp(11, "ZK"), lesOp(16, "VR"), lesOp(17, "OK")]);
  assert.deepStrictEqual(kaal(w), { "2026-11-09": [1, 1, 1, 0, 0, 0, 0], "2026-11-16": [1, 0, 0, 0, 0, 0, 1] });
  const k = R.klasWeken([[lesOp(9, "OK"), lesOp(16, "OK")], [lesOp(9, "AB_NO"), lesOp(16, "OK", 10)]], "2026-11-16");
  assert.deepStrictEqual(kaal(k.mom), { "2026-11-16": { lessen: 2, grootste: 1 } }, "alleen weken vanaf de grens");
  assert.deepStrictEqual(kaal(R.klasWeken([[lesOp(9, "OK")], [lesOp(9, "AB_NO")]]).dagen), { "2026-11-09": { 1: [1, 0, 0, 0, 1, 0, 0] } });
});

test("jaaropslag bijwerken: alleen de weken vanaf de grens worden vervangen; wie ontbreekt is uit de klas", () => {
  const oud = { studenten: { 1: { naam: "A", nu: true, w: { "2026-11-02": [5, 0, 0, 0, 0, 0, 0], "2026-11-09": [4, 0, 0, 0, 1, 0, 0] } }, 2: { naam: "B", nu: true, w: { "2026-11-02": [5, 0, 0, 0, 0, 0, 0] } } },
    mom: { "2026-11-02": { lessen: 5, grootste: 2 }, "2026-11-09": { lessen: 5, grootste: 1 } }, dagen: {} };
  const nieuw = { studenten: { 1: { naam: "A", nu: true, vanaf: "2026-11-09", w: { "2026-11-09": [5, 0, 0, 0, 0, 0, 0], "2026-11-16": [3, 0, 0, 0, 0, 0, 0] } }, 3: { naam: "C", nu: true, vanaf: "", w: { "2026-11-16": [3, 0, 0, 0, 0, 0, 0] } } },
    mom: { "2026-11-09": { lessen: 5, grootste: 1 }, "2026-11-16": { lessen: 3, grootste: 2 } }, dagen: {} };
  const s = R.voegSamen(oud, nieuw, "2026-11-09");
  assert.deepStrictEqual(kaal(s.studenten[1].w), { "2026-11-02": [5, 0, 0, 0, 0, 0, 0], "2026-11-09": [5, 0, 0, 0, 0, 0, 0], "2026-11-16": [3, 0, 0, 0, 0, 0, 0] }, "de achteraf gewijzigde registratie in week 46 is vervangen");
  assert.strictEqual(s.studenten[2].nu, false); assert.deepStrictEqual(kaal(s.studenten[2].w), { "2026-11-02": [5, 0, 0, 0, 0, 0, 0] }, "B is weg maar zijn lessen blijven");
  assert.strictEqual(s.studenten[3].nu, true);
  assert.deepStrictEqual(Object.keys(s.mom).sort(), ["2026-11-02", "2026-11-09", "2026-11-16"]);
  /* Een student van wie het ophalen mislukte (geen w) houdt wat er stond. */
  assert.deepStrictEqual(kaal(R.voegSamen(oud, { studenten: { 1: { naam: "A", nu: true } } }, "2026-11-09").studenten[1].w), kaal(oud.studenten[1].w));
  assert.deepStrictEqual(kaal(R.voegSamen(null, nieuw, "").studenten[3]), { naam: "C", nu: true, w: { "2026-11-16": [3, 0, 0, 0, 0, 0, 0] } });
});

const OPSLAG = () => {
  const vol = (weken) => Object.fromEntries(weken.map((w) => [w, [5, 0, 0, 0, 0, 0, 0]])), W = ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"];
  return { studenten: { 1: { naam: "Blijver", nu: true, w: { ...vol(W), "2026-11-16": [2, 1, 0, 0, 2, 0, 1] } }, 2: { naam: "Instromer", nu: true, w: vol(W.slice(2)) }, 3: { naam: "Vertrekker", nu: false, w: vol(W.slice(0, 2)) },
    4: { naam: "Stil", nu: true, w: vol(W.slice(0, 1)) } }, mom: Object.fromEntries(W.map((w) => [w, { lessen: 5, grootste: 3 }])), dagen: { "2026-11-16": { 1: [2, 1, 0, 0, 2, 0, 1] } } };
};

test("jaaropslag: aanwezigheid over een periode van hele weken, alleen wie nu in de klas zit", () => {
  const a = R.aggUit(OPSLAG(), "2026-11-09", "2026-11-16");
  assert.strictEqual(a.studenten, 3); assert.strictEqual(a.zonder, 1, "Stil had in deze weken geen lessen");
  assert.deepStrictEqual(kaal(a.per), { OK: 17, TL: 1, AB_NO: 2, VR: 1 });
  assert.strictEqual(R.cijfers(a.per).pct, 90);
  assert.deepStrictEqual(kaal(a.banden), [0, 0, 1, 1], "Blijver 8 van 10 (80%: niet onder de norm), Instromer 10 van 10");
  assert.strictEqual(a.onder, 0);
  assert.deepStrictEqual(kaal(a.actief), { "2026-11-09": 2, "2026-11-16": 2 });
  assert.deepStrictEqual(kaal(a.dagen), { 1: { OK: 2, TL: 1, AB_NO: 2, VR: 1 } });
  assert.strictEqual(R.aggUit(null, "2026-01-01", "2026-12-31").studenten, 0);
});

test("jaaropslag: studenten per week tellen ook wie inmiddels weg is, en de mutaties volgen uit de lessen", () => {
  const o = OPSLAG();
  assert.deepStrictEqual(kaal(Object.fromEntries(Object.entries(R.lesWekenUit(o)).map(([w, x]) => [w, x.actief]))), { "2026-10-26": 3, "2026-11-02": 2, "2026-11-09": 2, "2026-11-16": 2 });
  assert.deepStrictEqual(kaal(R.mutaties(o).map((m) => [m.naam, m.soort, m.week])), [["Instromer", "in", "2026-11-09"], ["Vertrekker", "uit", "2026-11-02"]], "wie nog in de klas staat maar geen lessen meer heeft (stage), is geen mutatie");
  assert.deepStrictEqual(kaal(R.mutaties({ studenten: {}, mom: {} })), []);
});

test("back-up: per klas wint de laatst bijgewerkte versie", () => {
  assert.deepStrictEqual(kaal(R.nieuwste({ A: { op: 5, x: "lokaal" }, B: { op: 1, x: "lokaal" } }, { B: { op: 9, x: "map" }, C: { op: 2, x: "map" } })), { A: { op: 5, x: "lokaal" }, B: { op: 9, x: "map" }, C: { op: 2, x: "map" } });
  assert.deepStrictEqual(kaal(R.nieuwste(undefined, undefined)), {});
});

test("deelnemers per les: lessen kiezen, en gasten, overstappers en vertrekkers onderscheiden", () => {
  const les = (id, dag) => ({ id, begin: new Date(2026, 8, dag, 9) });
  const keuze = R.lesKeuze([[les(1, 7), les(2, 7), les(3, 8), les(9, 14)], [les(1, 7), les(3, 8), les(9, 14)], [les(1, 7), les(2, 7)]], "", 2);
  assert.deepStrictEqual(kaal(keuze), [{ id: "1", week: "2026-09-07", n: 3 }, { id: "3", week: "2026-09-07", n: 2 }, { id: "9", week: "2026-09-14", n: 2 }]);
  const eigen = new Set(["a1", "a2", "a3", "a4"]), klasVan = new Map([...eigen].map((i) => [i, "A"]));
  for (const i of ["b1", "b2", "b3", "b4"]) klasVan.set(i, "B");
  const g = R.gasten([
    { week: "2026-08-31", n: 4, ids: ["a1", "a2", "a3", "a4", "x1", "b1"] },                 // x1 weg van school, b1 stapte over
    { week: "2026-09-07", n: 4, ids: ["a1", "a2", "a3", "a4", "x1", "b1", "b2", "b3", "b4"] }, // gezamenlijke les met B
    { week: "2026-09-14", n: 4, ids: ["a1", "x9"] },                                          // te weinig eigen studenten
  ], eigen, klasVan, { A: 4, B: 4 }, "A");
  assert.deepStrictEqual(kaal(g), { x1: { weken: ["2026-08-31", "2026-09-07"], n: 2, naar: null }, b1: { weken: ["2026-08-31"], n: 1, naar: "B" } });
});

test("mutaties: instroom uit de aanmelding, overstap met de nieuwe klas, en extra velden blijven bewaard", () => {
  const W = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"], vol = (w) => Object.fromEntries(w.map((x) => [x, [5, 0, 0, 0, 0, 0, 0]]));
  const o = { studenten: { 1: { naam: "Blijver", nu: true, w: vol(W), b: "2026-08-01" }, 2: { naam: "Later aangemeld", nu: true, w: vol(W), b: "2026-09-14" },
    3: { naam: "Overstapper", nu: false, naar: "B", w: vol(W.slice(0, 1)) }, 4: { naam: "Tweede week", nu: true, w: vol(W.slice(1)), b: "2026-09-10" }, 5: { naam: "Ook blijver", nu: true, w: vol(W) } },
  mom: Object.fromEntries(W.map((w) => [w, { lessen: w === W[0] ? 1 : 5, grootste: 4 }])) };
  assert.deepStrictEqual(kaal(R.mutaties(o).map((m) => [m.naam, m.soort, m.week, m.bron || m.naar || ""])),
    [["Later aangemeld", "in", "2026-09-14", "aanmelding"], ["Tweede week", "in", "2026-09-07", "les"], ["Overstapper", "uit", "2026-08-31", "B"]]);
  const s = R.voegSamen(o, { studenten: { 1: { naam: "Blijver", nu: true, w: {} }, 3: { naam: "Overstapper", nu: false } } }, "2026-09-21").studenten;
  assert.strictEqual(s[1].b, "2026-08-01"); assert.strictEqual(s[3].naar, "B"); assert.strictEqual(s[2].nu, false); assert.strictEqual(s[2].b, "2026-09-14");
});

test("keuze vooraf: klassen groeperen op het begin van de klasnaam", () => {
  assert.strictEqual(R.groep("MIP1A"), "MIP"); assert.strictEqual(R.groep("sdv2b"), "SDV"); assert.strictEqual(R.groep("1A"), "1A");
  assert.deepStrictEqual(kaal(R.groepen({ MIP1A: 20, MIP2A: 18, SDV1A: null, "1A": 5 })), [{ groep: "1A", klassen: 1, studenten: 5, leden: [{ naam: "1A", aantal: 5 }] }, { groep: "MIP", klassen: 2, studenten: 38, leden: [{ naam: "MIP1A", aantal: 20 }, { naam: "MIP2A", aantal: 18 }] }, { groep: "SDV", klassen: 1, studenten: 0, leden: [{ naam: "SDV1A", aantal: null }] }]);
});

test("keuze vooraf: een hele opleiding of losse klassen", () => {
  const g = R.groepen({ MIP2A: 18, MIP1A: 20, MIP10A: 9, SDV1A: 12, SDV1B: 11 });
  assert.deepStrictEqual(kaal(g[0].leden.map((l) => l.naam)), ["MIP1A", "MIP2A", "MIP10A"], "klassen op naam, met cijfers als getal");
  assert.deepStrictEqual(kaal(R.keuze(g, new Set(["MIP1A", "MIP2A", "MIP10A", "SDV1B"]))), { groepen: ["MIP"], klassen: ["SDV1B"] });
  assert.deepStrictEqual(kaal(R.keuze(g, new Set(["SDV1A"]))), { groepen: [], klassen: ["SDV1A"] });
  assert.deepStrictEqual(kaal(R.keuze(g, new Set(["MIP1A", "MIP2A", "MIP10A", "SDV1A", "SDV1B"]))), { groepen: null, klassen: [] }, "alles aan: geen beperking");
});
