/* De aanwezigheidsberekening (vzStats in content/modules/verzuiminzicht.js). Inzicht, Lesregistraties, de
 * ranglijst, de Excel-exports en de Te laat-balie rekenen er allemaal mee. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister } = require("./hulp");

const { DT, modules } = metRegister({ periodes: () => [], periodeLabel: (p) => `${p.begin.getDate()}-${p.begin.getMonth() + 1} – ${p.einde.getDate()}-${p.einde.getMonth() + 1}` });
const { vzStats, isoWeek } = laad("content/modules/verzuiminzicht.js", { DT, window: {}, document: {} }, ["vzStats", "isoWeek"]).uit;

const van = new Date(2026, 10, 16), tot = new Date(2026, 10, 20, 23, 59, 59);
const les = (id, dag, uur, extra = {}) => ({ id, start: new Date(2026, 10, dag, uur).toISOString(), einde: new Date(2026, 10, dag, uur + 1).toISOString(), vakken: [{ naam: "Engels" }], onderwijstijd: 60, ...extra });
const reg = (id, dag, uur, type, ok) => ({ afspraak: { id, begin: new Date(2026, 10, dag, uur).toISOString(), einde: new Date(2026, 10, dag, uur + 1).toISOString() }, verantwoordingen: [{ reden: { verantwoordingType: type, isGeoorloofd: ok } }] });

test("percentage: afwezig, ziek en uitgestuurd tellen als gemist; te laat niet", () => {
  const rooster = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => les(i, 16 + ((i - 1) % 5), 9 + Math.floor((i - 1) / 5)));
  const s = vzStats([reg(1, 16, 9, "absent", false), reg(2, 17, 9, "ziek", true), reg(3, 18, 9, "teLaat", false), reg(4, 19, 9, "absent", true)], rooster, van, tot);
  assert.strictEqual(s.totaal.lessen, 10); assert.strictEqual(s.totaal.afwezig, 3); assert.strictEqual(s.totaal.ongeoorloofd, 1);
  assert.strictEqual(s.totaal.ziek, 1); assert.strictEqual(s.totaal.teLaat, 1); assert.strictEqual(s.totaal.pct, 70);
});

test("vrijstelling is geen verzuim en valt buiten het percentage", () => {
  const s = vzStats([reg(1, 16, 9, "vrijstelling", true), reg(2, 17, 9, "absent", false)], [les(1, 16, 9), les(2, 17, 9), les(3, 18, 9)], van, tot);
  assert.strictEqual(s.totaal.vrij, 1); assert.strictEqual(s.totaal.telt, 2); assert.strictEqual(s.totaal.pct, 50);
});

test("geen lessen: 100% en geen deling door nul", () => {
  const s = vzStats([], [], van, tot);
  assert.strictEqual(s.totaal.pct, 100); assert.strictEqual(s.totaal.lessen, 0);
});

test("vervallen lessen en afspraken zonder onderwijstijd tellen niet mee", () => {
  const s = vzStats([], [les(1, 16, 9), les(2, 17, 9, { status: 5 }), les(3, 18, 9, { onderwijstijd: null })], van, tot);
  assert.strictEqual(s.totaal.lessen, 1);
});

test("een registratie bij een les buiten het rooster telt mee als onbekende les", () => {
  const s = vzStats([reg(99, 16, 13, "absent", false)], [les(1, 16, 9)], van, tot);
  assert.strictEqual(s.onbekend, 1); assert.strictEqual(s.totaal.lessen, 2); assert.strictEqual(s.totaal.pct, 50);
});

test("lessen buiten de periode vallen weg", () => {
  const s = vzStats([reg(1, 9, 9, "absent", false)], [{ ...les(1, 9, 9) }, les(2, 16, 9)], van, tot);
  assert.strictEqual(s.totaal.lessen, 1); assert.strictEqual(s.totaal.afwezig, 0);
});

test("weeknummers volgen ISO 8601 rond de jaarwisseling", () => {
  assert.deepStrictEqual({ ...isoWeek(new Date(2026, 11, 28)) }, { y: 2026, w: 53 });
  assert.deepStrictEqual({ ...isoWeek(new Date(2027, 0, 4)) }, { y: 2027, w: 1 });
  assert.deepStrictEqual({ ...isoWeek(new Date(2025, 11, 29)) }, { y: 2026, w: 1 });
});

test("het bereik uit Magisters werkbalk geldt voor het tabblad: week, maand en het lopende schooljaar", () => {
  const m = modules.verzuiminzicht, nu = new Date(2026, 10, 23, 12), d = { sj: new Date(2026, 7, 1).getTime() };
  m.zetBereik({ unit: "week", start: new Date(2026, 10, 9).getTime(), end: new Date(2026, 10, 15, 23, 59, 59).getTime() }, nu);
  let p = m.gekozenPeriode(d, nu);
  assert.deepStrictEqual([m._periode, p.naam, p.van.getTime(), p.tot.getTime()], ["balk", "Week 46", new Date(2026, 10, 9).getTime(), new Date(2026, 10, 15, 23, 59, 59, 999).getTime()]);
  /* Een maand die nog loopt eindigt nu; Magister geeft het einde als begin van de laatste dag. */
  m.zetBereik({ unit: "month", start: new Date(2026, 10, 1).getTime(), end: new Date(2026, 10, 30).getTime() }, nu);
  p = m.gekozenPeriode(d, nu);
  assert.deepStrictEqual([p.van.getTime(), p.tot.getTime()], [new Date(2026, 10, 1).getTime(), nu.getTime()]);
  m.zetBereik({ unit: "year", start: new Date(2026, 7, 1).getTime(), end: new Date(2027, 6, 31).getTime() }, nu);
  assert.strictEqual(m._periode, "jaar");
  m.zetBereik({ unit: "year", start: new Date(2025, 7, 1).getTime(), end: new Date(2026, 6, 31).getTime() }, nu);
  assert.deepStrictEqual([m._periode, m.gekozenPeriode(d, nu).naam], ["balk", "Schooljaar 2025–2026"]);
  m._periode = "jaar"; m._bereik = null;
});
