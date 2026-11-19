/* Te laat-balie (content/modules/cb.js): wie de periodes in het gedeelde bestand mag wijzigen, en de vensters
 * van de wettelijke termijnen. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister, kaal } = require("./hulp");

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const P = (naam, b, e) => ({ id: b, naam, begin: new Date(b + "T00:00"), einde: new Date(e + "T23:59:59") });

function balie(mijnPeriodes) {
  const opslag = {}, staat = { mijn: mijnPeriodes, bewaard: 0 };
  const K = { S: null, H: {}, UI: { periodeId: null }, SOORT: { ziek: { g: "ziek" } }, TELLERS: { klokuren4w: {}, ziek8w: {} }, vandaag: () => "2026-11-19", periodeVanDatum: () => null,
    plusDagen: (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); },
    periodeById: (id) => (K.S.instellingen.periodes || []).find((p) => p.id === id) };
  const { modules, DT } = metRegister({ periodes: () => staat.mijn });
  laad("content/modules/cb.js", { DT, TardyKern: K, window: {}, document: {}, setTimeout: () => 0, clearTimeout() {},
    localStorage: { getItem: (k) => (k in opslag ? opslag[k] : null), setItem: (k, v) => { opslag[k] = String(v); } } });
  const cb = modules.cb;
  cb.bewaar = () => { staat.bewaard++; }; cb.opnieuwOphalen = () => {}; cb.melding = () => {}; cb._map = {}; cb._kijkt = false;
  return { cb, K, staat, opslag, bestand: (ps) => { K.S = { instellingen: { periodes: kaal(ps) } }; } };
}

test("periodes: gelijk aan het bestand, dan verandert er niets", () => {
  const b = balie([P("P1", "2026-08-31", "2026-11-06")]);
  b.bestand([{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-06" }]);
  assert.strictEqual(b.cb.volgPeriodes(), false); assert.strictEqual(b.staat.bewaard, 0);
});

test("periodes: wijzigt een collega het bestand, dan blijft dat staan (geen heen-en-weer)", () => {
  const b = balie([P("P1", "2026-08-31", "2026-11-06")]);
  b.bestand([{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-06" }]); b.cb.volgPeriodes();
  const vanCollega = [{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-13" }]; b.bestand(vanCollega);
  assert.strictEqual(b.cb.volgPeriodes(), false); assert.strictEqual(b.staat.bewaard, 0);
  assert.deepStrictEqual(kaal(b.K.S.instellingen.periodes), vanCollega);
});

test("periodes: wijzig ik mijn eigen periodes, dan gaan ze naar het bestand en houdt de periode zijn code", () => {
  const b = balie([P("P1", "2026-08-31", "2026-11-06")]);
  b.bestand([{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-06" }]); b.cb.volgPeriodes();
  b.staat.mijn = [P("P1", "2026-08-31", "2026-11-20")];
  assert.strictEqual(b.cb.volgPeriodes(), true); assert.strictEqual(b.staat.bewaard, 1);
  assert.deepStrictEqual(kaal(b.K.S.instellingen.periodes), [{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-20" }]);
});

test("periodes: een nieuwe collega met andere periodes overschrijft het bestand niet", () => {
  const b = balie([P("Blok 1", "2026-09-01", "2026-10-30")]);
  const bestaand = [{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-06" }]; b.bestand(bestaand);
  assert.strictEqual(b.cb.volgPeriodes(), false); assert.strictEqual(b.staat.bewaard, 0);
  assert.deepStrictEqual(kaal(b.K.S.instellingen.periodes), bestaand);
});

test("periodes: staat er nog niets in het bestand, dan worden de eigen periodes ingevuld", () => {
  const b = balie([P("Blok 1", "2026-09-01", "2026-10-30")]); b.bestand([]);
  assert.strictEqual(b.cb.volgPeriodes(), true); assert.strictEqual(b.K.S.instellingen.periodes[0].naam, "Blok 1");
});

test("periodes: wie alleen meekijkt onthoudt zijn wijziging niet als doorgevoerd", () => {
  const b = balie([P("P1", "2026-08-31", "2026-11-20")]);
  b.bestand([{ id: "p1", naam: "P1", start: "2026-08-31", eind: "2026-11-06" }]); b.opslag["dt-cb-periodes"] = "iets anders"; b.cb._kijkt = true;
  b.cb.volgPeriodes();
  assert.strictEqual(b.staat.bewaard, 0); assert.strictEqual(b.opslag["dt-cb-periodes"], "iets anders");
});

/* Periode 2 begon op 9 november. 10 klokuren ongeoorloofd vlak vóór de grens, 8 erna: samen 18 (grens 16). */
function metVerzuim() {
  const b = balie([]);
  b.K.S = { instellingen: { periodes: [{ id: "p1", start: "2026-08-31", eind: "2026-11-08" }, { id: "p2", start: "2026-11-09", eind: "2027-01-31" }] },
    registraties: [{ stamnr: "1", soort: "ziek", datum: "2026-10-20" }],
    lesreg: { 1: { lessen: [{ d: "2026-11-04", b: "09:00", c: "AB_NO", u: 10 }, { d: "2026-11-12", b: "09:00", c: "AB_NO", u: 8 }], ziekDatums: ["2026-10-06", "2026-11-10"] } } };
  b.cb.haken();
  return b.K;
}

test("wettelijke termijnen: standaard tellen alleen de weken binnen de periode", () => {
  const K = metVerzuim();
  assert.strictEqual(K.TELLERS.klokuren4w.waarde("1", "p2"), 8); assert.strictEqual(K.TELLERS.ziek8w.waarde("1", "p2"), 1);
});

test("wettelijke termijnen: met de optie aan tellen de 4 en 8 weken door over het begin van de periode", () => {
  const K = metVerzuim(); K.S.instellingen.vensterOverGrens = true;
  assert.strictEqual(K.TELLERS.klokuren4w.waarde("1", "p2"), 18); assert.strictEqual(K.TELLERS.ziek8w.waarde("1", "p2"), 3);
  assert.strictEqual(K.TELLERS.klokuren4w.waarde("1", "p1"), 10, "een afgelopen periode eindigt op zijn eigen einddatum");
});
