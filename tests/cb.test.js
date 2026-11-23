/* Te laat-balie (content/modules/cb.js): wie de periodes in het gedeelde bestand mag wijzigen, en de vensters
 * van de wettelijke termijnen. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, lees, metRegister, kaal } = require("./hulp");

/* De balie bestaat uit cb.js en de delen cb-*.js (zonder de gegenereerde kern), in manifestvolgorde. */
const CB_DELEN = JSON.parse(lees("manifest.json")).content_scripts[0].js.filter((f) => /modules\/cb(\.js|-(?!kern))/.test(f));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const P = (naam, b, e) => ({ id: b, naam, begin: new Date(b + "T00:00"), einde: new Date(e + "T23:59:59") });

function balie(mijnPeriodes) {
  const opslag = {}, ext = {}, staat = { mijn: mijnPeriodes, bewaard: 0 };
  const K = { S: null, H: {}, UI: { periodeId: null }, SOORT: { ziek: { g: "ziek" } }, TELLERS: { klokuren4w: {}, ziek8w: {} }, vandaag: () => "2026-11-19", periodeVanDatum: () => null,
    plusDagen: (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); },
    periodeById: (id) => (K.S.instellingen.periodes || []).find((p) => p.id === id) };
  const { modules, DT } = metRegister({ periodes: () => staat.mijn });
  laad(CB_DELEN, { DT, TardyKern: K, window: {}, document: {}, setTimeout: () => 0, clearTimeout() {},
    chrome: { storage: { local: { get: async (k) => ({ [k]: ext[k] }), set: async (o) => { Object.assign(ext, o); } } } },
    localStorage: { getItem: (k) => (k in opslag ? opslag[k] : null), setItem: (k, v) => { opslag[k] = String(v); } } });
  const cb = modules.cb;
  cb.bewaar = () => { staat.bewaard++; }; cb.opnieuwOphalen = () => {}; cb.melding = () => {}; cb._map = {}; cb._kijkt = false;
  return { cb, K, staat, opslag, ext, bestand: (ps) => { K.S = { instellingen: { periodes: kaal(ps) } }; } };
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

test("opmaak van de balie: geen regel staat per ongeluk binnen een andere regel", () => {
  /* Een niet-afgesloten regel maakt van alles wat volgt een geneste regel die nergens op past (zo bleef de
   * zoektekst onder het vergrootglas staan). Alleen @-regels mogen andere regels bevatten. */
  const bron = require("node:fs").readFileSync(require("node:path").join(__dirname, "../content/modules/cb-css.js"), "utf8");
  const css = bron.match(/st\.textContent = `([\s\S]*?)`;/)[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\$\{[^}]*\}/g, "0").replace(/url\("[^"]*"\)/g, "url()");
  const stapel = [], fout = [];
  let kop = "";
  for (const ch of css) {
    if (ch === "{") { const sel = kop.trim().split(";").pop().trim(); if (stapel.length && !stapel.every((s) => s.startsWith("@"))) fout.push(sel); stapel.push(sel); kop = ""; }
    else if (ch === "}") { stapel.pop(); kop = ""; }
    else kop += ch;
  }
  assert.deepStrictEqual(fout, []);
  assert.strictEqual(stapel.length, 0);
});

/* Het slot (tardy-in-gebruik.json): de balie moet het eigen apparaat blijven herkennen. */
test("apparaat: zonder werkende opslag van de pagina blijft de code de hele sessie dezelfde", () => {
  const { cb } = balie([]);
  const eerste = cb.apparaat();
  assert.match(eerste, /^chrome-/); assert.strictEqual(cb.apparaat(), eerste);
  /* Magister leegt de opslag: het eigen slot blijft van mij. */
  const { cb: cb2, opslag } = balie([]);
  const code = cb2.apparaat(); delete opslag["dt-cb-apparaat"];
  assert.strictEqual(cb2.apparaat(), code);
  assert.strictEqual(cb2.bezetDoorAnder({ naam: "Ik", apparaat: code, bijgewerkt: new Date().toISOString() }), false);
});

test("apparaat: de code uit de extensie gaat voor en wordt daar bewaard", async () => {
  const { cb, opslag, ext } = balie([]);
  ext["dt-cb-apparaat"] = "chrome-vast1234";
  assert.strictEqual(await cb.apparaatLaden(), "chrome-vast1234");
  assert.strictEqual(cb.apparaat(), "chrome-vast1234"); assert.strictEqual(opslag["dt-cb-apparaat"], "chrome-vast1234");
  const nieuw = balie([]), code = await nieuw.cb.apparaatLaden();
  assert.match(code, /^chrome-/); assert.strictEqual(nieuw.ext["dt-cb-apparaat"], code);
});

test("meekijken: is de ander klaar, dan werk je vanzelf weer zelf", async () => {
  const { cb } = balie([]);
  let gezet = 0; const meldingen = [];
  Object.assign(cb, { _scherm: {}, _kijkt: true, _ander: { naam: "Marit" }, _basis: 3, lees: async () => null, herlaad: async () => {}, teken() {}, tekenStand() {},
    bezettingZet: async () => { gezet++; }, melding: (t) => meldingen.push(t) });
  cb.bezetting = async () => ({ naam: "Marit", apparaat: "mac-1", bijgewerkt: new Date().toISOString() });
  await cb.controle();
  assert.strictEqual(cb._kijkt, true); assert.strictEqual(gezet, 0);
  cb.bezetting = async () => null;
  await cb.controle();
  assert.strictEqual(cb._kijkt, false); assert.strictEqual(gezet, 1); assert.match(meldingen[0], /Marit werkt niet meer/);
});
