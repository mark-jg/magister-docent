/* LesOpslag (content/modules/lesopslag.js): lessen per klas bewaren in de gedeelde map, en Lesregistraties dat
 * daarna alleen de laatste weken bijwerkt. De map is nagebootst; er is geen schijf of browser nodig. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister, kaal } = require("./hulp");

/* Een map zoals de File System Access API die geeft, in het geheugen. */
function nepMap(naam = "Gedeeld") {
  const mappen = {}, bestanden = {};
  const nietGevonden = () => Object.assign(new Error("niet gevonden"), { name: "NotFoundError" });
  return { name: naam, mappen, bestanden,
    async getDirectoryHandle(n, o = {}) { if (!mappen[n]) { if (!o.create) throw nietGevonden(); mappen[n] = nepMap(n); } return mappen[n]; },
    async getFileHandle(n, o = {}) {
      if (!(n in bestanden)) { if (!o.create) throw nietGevonden(); bestanden[n] = ""; }
      return { getFile: async () => ({ text: async () => bestanden[n] }), createWritable: async () => ({ write: async (t) => { bestanden[n] = t; }, close: async () => {} }) };
    } };
}

const api = { urls: [], faal: false };
const taken = [];
const { DT, modules } = metRegister({ isTop: true, periodes: () => [], taak: (id, t) => { taken.push(t && { ...t }); }, apiRetry: async (url) => {
  api.urls.push(url);
  if (/\/zoeken\?/.test(url)) return { status: 200, json: { items: [{ id: 1, roepnaam: "Ada", achternaam: "Berg", code: "100" }, { id: 2, roepnaam: "Bo", achternaam: "Dijk", code: "101" }] } };
  if (api.faal) return { status: 500 };
  const [, id] = /leerlingen\/(\d+)\//.exec(url), [, van] = /begin=([\d-]+)/.exec(url), [, tot] = /einde=([\d-]+)/.exec(url);
  if (/verantwoordingen/.test(url)) return { status: 200, json: { items: [] } };
  /* Elke werkdag in het bereik één les om 9 uur. */
  const items = [];
  for (let d = new Date(`${van}T09:00:00`); d <= new Date(`${tot}T23:00:00`); d.setDate(d.getDate() + 1)) if (d.getDay() % 6) items.push({ id: `${id}-${d.getTime() / 36e5}`, start: d.toISOString(), einde: new Date(d.getTime() + 36e5).toISOString(), vakken: [{ naam: "Engels" }], onderwijstijd: 1 });
  return { status: 200, json: { items } };
} });
const ctx = laad(["content/modules/verzuiminzicht.js", "content/modules/lesopslag.js", "content/modules/lesreg.js"], { DT, window: {}, document: {}, location: { host: "school.magister.net" } }, ["LesOpslag"]);
const O = ctx.uit.LesOpslag, lesreg = modules.lesreg;

test("lessen inpakken en uitpakken: gelijke teksten staan één keer in het bestand", () => {
  const les = (dag, vak, cat) => ({ id: dag, begin: new Date(2026, 10, dag, 9), einde: new Date(2026, 10, dag, 9, 50), vak, docent: "J. Jansen", cat, regs: cat === "OK" ? "" : "te laat (ongeoorloofd)" });
  const tekst = [], rijen = O.pak([les(2, "Engels", "OK"), les(3, "Engels", "TL"), les(4, "Rekenen", "OK")], tekst);
  assert.deepStrictEqual(kaal(tekst), ["Engels", "J. Jansen", "OK", "", "TL", "te laat (ongeoorloofd)", "Rekenen"]);
  const terug = O.uitpak(JSON.parse(JSON.stringify(rijen)), tekst);
  assert.deepStrictEqual(terug.map((l) => [l.id, l.begin.getTime(), l.einde.getTime(), l.vak, l.docent, l.cat, l.regs]),
    [2, 3, 4].map((d, i) => [d, new Date(2026, 10, d, 9).getTime(), new Date(2026, 10, d, 9, 50).getTime(), i < 2 ? "Engels" : "Rekenen", "J. Jansen", i === 1 ? "TL" : "OK", i === 1 ? "te laat (ongeoorloofd)" : ""]));
});

test("bijwerkplan: alleen de laatste weken, niets als de opslag het dekt, alles als ze te laat begint", () => {
  const nu = new Date(2026, 10, 24, 12), st = { van: "2026-09-01", tot: "2026-11-17", op: nu - 864e5 };
  const p = (s, van, tot = nu) => { const r = O.plan(s, van, tot, nu); return [r.begin && O.ymd(r.begin), r.vol]; };
  assert.deepStrictEqual(p(null, new Date(2026, 9, 1)), ["2026-10-01", true], "nog niets bewaard");
  assert.deepStrictEqual(p(st, new Date(2026, 9, 1)), ["2026-11-02", false], "vanaf de maandag twee weken vóór de vorige keer");
  assert.deepStrictEqual(p(st, new Date(2026, 8, 1), new Date(2026, 9, 16)), [null, false], "een afgelopen periode: uit de map");
  assert.deepStrictEqual(p({ ...st, op: nu - 60e3 }, new Date(2026, 9, 1)), [null, false], "net bijgewerkt");
  const r = O.plan({ ...st, op: nu - 60e3 }, new Date(2026, 9, 1), nu, nu, true);
  assert.deepStrictEqual([O.ymd(r.begin), r.vol], ["2026-11-02", false], "Aanvullen: ook als dat net nog is gedaan");
  assert.deepStrictEqual(p(st, new Date(2026, 7, 20)), ["2026-08-20", true], "de periode begint vóór wat er bewaard is");
  assert.deepStrictEqual(p({ ...st, van: "2026-11-10" }, new Date(2026, 10, 12)), ["2026-11-10", true], "een korte opslag wordt in haar geheel vervangen");
});

test("Lesregistraties met een map: de eerste keer alles, daarna alleen de laatste weken, en bij een storing de vorige stand", async () => {
  const map = nepMap(), nu = new Date(), van = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 56), per = { key: "8w", naam: "Laatste 8 weken", van, tot: nu };
  /* Het schooljaar begint 1 augustus: in augustus en september valt 8 weken terug ervoor, dan is er niets te testen. */
  if (van < new Date(O.sjJaar(nu), 7, 1)) return;
  const begins = () => api.urls.filter((u) => /afspraken/.test(u)).map((u) => /begin=([\d-]+)/.exec(u)[1]);
  const eerste = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map });
  assert.deepStrictEqual(kaal(eerste.bron), { ...kaal(eerste.bron), map: "Gedeeld", uit: 0, deels: 0, geheel: 2, oud: 0, fout: null });
  assert.deepStrictEqual(begins(), [O.ymd(van), O.ymd(van)]);
  const naam = Object.keys(map.mappen.lesregistraties.bestanden)[0], bestand = JSON.parse(map.mappen.lesregistraties.bestanden[naam]);
  assert.strictEqual(naam, `school.magister.net-MIP1A-${O.sjJaar(nu)}.json`);
  assert.deepStrictEqual(Object.keys(bestand.studenten), ["1", "2"]); assert.strictEqual(bestand.studenten[1].van, O.ymd(van));
  const n = eerste.studenten[0].lessen.length; assert.ok(n > 30, "ongeveer veertig werkdagen");

  /* Meteen nog eens: alles is vers, er gaat alleen de klassenlijst naar Magister. */
  api.urls.length = 0;
  const meteen = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map });
  assert.strictEqual(meteen.bron.uit, 2); assert.strictEqual(api.urls.length, 1); assert.strictEqual(meteen.studenten[0].lessen.length, n);

  /* Een week later (de opslag is een week oud): alleen vanaf twee weken vóór de vorige keer. */
  for (const st of Object.values(bestand.studenten)) { st.op -= 7 * 864e5; st.tot = O.ymd(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 7)); }
  map.mappen.lesregistraties.bestanden[naam] = JSON.stringify(bestand); api.urls.length = 0;
  const later = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map });
  assert.strictEqual(later.bron.deels, 2);
  const grens = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 21); grens.setDate(grens.getDate() - ((grens.getDay() + 6) % 7));
  assert.deepStrictEqual(begins(), [O.ymd(grens), O.ymd(grens)]);
  assert.strictEqual(later.studenten[0].lessen.length, n, "samengevoegd zonder dubbele of ontbrekende lessen");
  assert.strictEqual(JSON.parse(map.mappen.lesregistraties.bestanden[naam]).studenten[1].tot, O.ymd(nu));

  /* De datums voor de samenvatting: net aangevuld, maar de volledige controle is die van de eerste keer. */
  assert.ok(Date.now() - later.bron.aangevuld < 5000); assert.strictEqual(later.bron.volledig, bestand.studenten[1].vol); assert.ok(bestand.studenten[1].vol > 0);

  /* Aanvullen (vers) haalt de laatste weken ook op als dat net is gedaan; volledig controleren haalt alles opnieuw. */
  api.urls.length = 0;
  const aangevuld = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map, vers: true });
  assert.strictEqual(aangevuld.bron.deels, 2); assert.strictEqual(aangevuld.bron.volledig, bestand.studenten[1].vol);
  api.urls.length = 0;
  const controle = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map, vol: true });
  assert.strictEqual(controle.bron.geheel, 2); assert.deepStrictEqual(begins(), [O.ymd(van), O.ymd(van)]);
  assert.ok(controle.bron.volledig > bestand.studenten[1].vol, "de datum van de volledige controle schuift op");
  assert.strictEqual(controle.studenten[0].lessen.length, n);

  /* Magister doet het niet: de vorige stand blijft staan, ook bij een volledige controle. */
  api.faal = true;
  for (const vol of [false, true]) {
    map.mappen.lesregistraties.bestanden[naam] = JSON.stringify(bestand);
    const storing = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map, vol });
    assert.strictEqual(storing.bron.oud, 2); assert.strictEqual(storing.studenten[0].lessen.length > 20, true); assert.strictEqual(storing.studenten[0].fout, null);
    assert.strictEqual(JSON.parse(map.mappen.lesregistraties.bestanden[naam]).studenten[1].tot, bestand.studenten[1].tot, "het bestand blijft zoals het was");
  }
  const leeg = await lesreg.ophalen(DT, ["MIP1A"], per, () => {}, { map: nepMap() });
  assert.strictEqual(leeg.studenten[0].fout, 500, "zonder vorige stand: een fout bij de student");
  api.faal = false;

  /* Zonder map werkt het zoals voorheen. */
  api.urls.length = 0;
  const zonder = await lesreg.ophalen(DT, ["MIP1A"], per, () => {});
  assert.strictEqual(zonder.bron.map, null); assert.deepStrictEqual(begins(), [O.ymd(van), O.ymd(van)]); assert.strictEqual(zonder.studenten[0].lessen.length, n);
});

test("een ronde loopt door zonder pagina: de stand staat in het hoofdmenu en het resultaat wacht tot je kijkt", async () => {
  const nu = new Date(), per = { key: "1w", naam: "Laatste week", van: new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - 7), tot: nu };
  taken.length = 0; lesreg._ui = null; lesreg._data = null;
  await lesreg.ronde(DT, ["MIP1A"], per, { klasTekst: "MIP1A" });
  assert.ok(taken.some((t) => t && !t.klaar && t.deel != null && /^student \d van 2$/.test(t.tekst)), "voortgang in het menu");
  assert.strictEqual(taken.at(-1).klaar, true); assert.strictEqual(lesreg._ongezien, true);
  assert.strictEqual(lesreg._data.studenten.length, 2); assert.strictEqual(lesreg._data.klasTekst, "MIP1A");

  /* Met de pagina open: de pagina krijgt het resultaat en de melding verdwijnt uit het menu. */
  let klaar = 0; taken.length = 0; lesreg._ui = { voortgang() {}, klaar: () => { klaar++; }, fout() {} };
  await lesreg.ronde(DT, ["MIP1A"], per, {});
  assert.strictEqual(klaar, 1); assert.strictEqual(taken.at(-1), null);

  /* Stoppen via het kruisje in het menu. */
  let fout = ""; taken.length = 0; lesreg._ui = { voortgang() { taken.find((t) => t?.stop)?.stop(); }, klaar() {}, fout: (t) => { fout = t; } };
  await lesreg.ronde(DT, ["MIP1A"], per, {});
  assert.match(fout, /^Gestopt/); assert.strictEqual(lesreg._ronde.bezig, false);
  lesreg._ui = null;
});
