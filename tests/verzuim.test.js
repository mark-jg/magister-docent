/* De aanwezigheidsberekening (vzStats in content/modules/verzuiminzicht.js). Inzicht, Lesregistraties, de
 * ranglijst, de Excel-exports rekenen er allemaal mee. */
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

/* De gedeelde bron (vzBron): één keer ophalen, hergebruiken binnen het bereik, en opnieuw met vers. */
test("gedeelde bron: een bereik binnen een eerder antwoord kost geen nieuwe aanvraag; vers haalt opnieuw op", async () => {
  const { vzBron } = laad("content/modules/verzuiminzicht.js", { DT, window: {}, document: {} }, ["vzBron"]).uit;
  const urls = [];
  const api = async (u) => { urls.push(u); return { status: 200, json: { items: /verantwoordingen/.test(u) ? [reg(1, 16, 9, "absent", false)] : [les(1, 16, 9), les(2, 17, 9)] } }; };
  const a = await vzBron.haal(7, new Date(2026, 7, 1), new Date(2026, 10, 23), { api });
  assert.strictEqual(urls.length, 2); assert.match(urls[0], /leerlingen\/7\/verantwoordingen\?begin=2026-08-01&einde=2026-11-23/);
  assert.deepStrictEqual([a.regs.length, a.rooster.length, a.status.regs], [1, 2, 200]);
  const b = await vzBron.haal("7", new Date(2026, 10, 16), new Date(2026, 10, 20, 23, 59), { api, los: 0 });
  assert.strictEqual(urls.length, 2, "valt binnen het eerdere antwoord"); assert.strictEqual(b.rooster, a.rooster);
  await vzBron.haal(8, new Date(2026, 10, 16), new Date(2026, 10, 20), { api });
  assert.strictEqual(urls.length, 4, "een andere leerling wordt apart opgehaald");
  await vzBron.haal(7, new Date(2026, 10, 16), new Date(2026, 10, 20), { api, vers: true });
  assert.strictEqual(urls.length, 6, "vers: altijd opnieuw");
  vzBron.vergeet(7);
  await vzBron.haal(7, new Date(2026, 10, 16), new Date(2026, 10, 20), { api });
  assert.strictEqual(urls.length, 8, "na vergeten opnieuw");
});

test("gedeelde bron: een mislukt antwoord wordt niet bewaard en een les buiten het rooster wordt nagezocht", async () => {
  const { vzBron } = laad("content/modules/verzuiminzicht.js", { DT, window: {}, document: {} }, ["vzBron"]).uit;
  let stuk = true; const urls = [];
  const api = async (u) => {
    urls.push(u);
    if (/afspraken\/99$/.test(u)) return { status: 200, json: les(99, 16, 13) };
    if (/afspraken\?/.test(u)) return stuk ? { status: 429, json: null } : { status: 200, json: [les(1, 16, 9)] };
    return { status: 200, json: [reg(99, 16, 13, "absent", false)] };
  };
  const a = await vzBron.haal(7, van, tot, { api });
  assert.deepStrictEqual([a.rooster, a.status.rooster], [null, 429]);
  stuk = false;
  const b = await vzBron.haal(7, van, tot, { api });
  assert.strictEqual(b.rooster.length, 2, "de les van de registratie is erbij gehaald");
  assert.strictEqual(vzStats(b.regs, b.rooster, van, tot).onbekend, 0);
  const n = urls.length; await vzBron.haal(7, van, tot, { api });
  assert.strictEqual(urls.length, n);
});

test("leerlingoverzicht: de ring geeft hetzelfde cijfer als Inzicht, met huiswerk/materiaal apart per maand", () => {
  const { aanwezigheid, vzStats: vz } = laad(["content/modules/verzuiminzicht.js", "content/modules/leerlingdash.js"], { DT, window: {}, document: {} }, ["aanwezigheid", "vzStats"]).uit;
  const rooster = [les(1, 16, 9), les(2, 17, 9), les(3, 18, 9), les(4, 19, 9), les(5, 20, 9, { status: 5 })];
  const regs = [reg(1, 16, 9, "absent", false), reg(2, 17, 9, "vrijstelling", true), reg(3, 18, 9, "huiswerkVergeten", true), reg(4, 19, 9, "teLaat", false)];
  const att = aanwezigheid(regs, rooster, van, tot), T = vz(regs, rooster, van, tot).totaal;
  assert.deepStrictEqual([att.pct, att.telt, att.afwezig, att.vrij, att.teLaat, att.ongeoorloofd], [T.pct, T.telt, T.afwezig, T.vrij, T.teLaat, T.ongeoorloofd]);
  assert.deepStrictEqual([att.pct, att.telt, att.lessen], [67, 3, 4]);
  assert.deepStrictEqual([att.maanden.length, att.maanden[0].per.OVERIG, att.maanden[0].totaal, att.maanden[0].pctAanwezig, att.maanden[0].label], [1, 1, 3, 67, "november 2026"]);
  assert.strictEqual(aanwezigheid(null, rooster, van, tot), null);
  assert.strictEqual(aanwezigheid([], [], van, tot), null);
});

test("gedeelde bron: aanvullen met losse lessen, meeliften op een lopende aanvraag en een vorig schooljaar blijft bewaard", async () => {
  const { vzBron } = laad("content/modules/verzuiminzicht.js", { DT, window: {}, document: {} }, ["vzBron"]).uit;
  const urls = [];
  const api = async (u) => {
    urls.push(u); await new Promise((r) => setTimeout(r, 5));
    if (/afspraken\/99$/.test(u)) return { status: 200, json: les(99, 16, 13) };
    return { status: 200, json: /verantwoordingen/.test(u) ? [reg(99, 16, 13, "absent", false)] : [les(1, 16, 9)] };
  };
  /* Twee vragen tegelijk voor hetzelfde bereik: één keer ophalen. */
  const [a, b] = await Promise.all([vzBron.haal(7, van, tot, { api, los: 0 }), vzBron.haal(7, van, tot, { api, los: 0 })]);
  assert.strictEqual(urls.length, 2); assert.strictEqual(a, b); assert.strictEqual(a.rooster.length, 1);
  /* Daarna wil Inzicht vak en docent van de les buiten het rooster: alleen die ene les erbij. */
  const c = await vzBron.haal(7, van, tot, { api });
  assert.deepStrictEqual([urls.length, c.rooster.length, c.rooster === a.rooster], [3, 2, true]);
  await vzBron.haal(7, van, tot, { api });
  assert.strictEqual(urls.length, 3);
  /* Een vorig schooljaar verloopt niet na tien minuten. */
  const v = await vzBron.haal(7, new Date(2024, 7, 1), new Date(2025, 6, 31), { api, los: 0 });
  v.at -= 60 * 60e3; a.at -= 60 * 60e3;
  const n = urls.length;
  await vzBron.haal(7, new Date(2024, 8, 1), new Date(2025, 0, 31), { api, los: 0 });
  assert.strictEqual(urls.length, n, "vorig schooljaar: uit het geheugen");
  await vzBron.haal(7, van, tot, { api, los: 0 });
  assert.strictEqual(urls.length, n + 2, "dit schooljaar: na tien minuten opnieuw");
});

test("gedeelde bron: veel ophalen gaat vlot (twee aanvragen tegelijk) tot Magister om rust vraagt, dan na elkaar", async () => {
  const { vzBron } = laad("content/modules/verzuiminzicht.js", { DT, window: {}, document: {} }, ["vzBron"]).uit;
  let bezig = 0, top = 0;
  const api = async () => { bezig++; top = Math.max(top, bezig); await new Promise((r) => setTimeout(r, 5)); bezig--; return { status: 200, json: [] }; };
  DT.druk = 0;
  await vzBron.haal(1, van, tot, { api, pauze: 2, vers: true });
  assert.strictEqual(top, 2);
  DT.druk = Date.now(); top = 0;
  await vzBron.haal(2, van, tot, { api, pauze: 2, vers: true });
  assert.strictEqual(top, 1);
  DT.druk = 0;
});
