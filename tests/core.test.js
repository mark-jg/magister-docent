/* De kern (content/core.js): sneltoetsen, instellingen bewaren en eigen periodes. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister } = require("./hulp");

function kern({ opslaan = async () => {}, bewaard = {} } = {}) {
  const chrome = { runtime: { getManifest: () => ({ version: "test" }) }, storage: { sync: { get: async () => bewaard, set: opslaan } } };
  const document = { getElementById: () => null, body: { append() {} }, createElement: () => ({ append() {}, classList: { add() {}, remove() {} }, setAttribute() {}, remove() {} }) };
  const ctx = laad(["content/defaults.js", "content/core.js"], { window: "zelf", chrome, document, location: { host: "school.magister.net", origin: "https://school.magister.net" }, requestAnimationFrame() {}, navigator: {}, addEventListener() {}, postMessage() {}, console: { warn() {}, info() {} } });
  return ctx.DT;
}

test("Alt-sneltoetsen: met Option op de Mac telt de fysieke toets", () => {
  const DT = kern();
  assert.strictEqual(DT.keyOf({ altKey: true, code: "KeyD", key: "∂" }), "d");
  assert.strictEqual(DT.keyOf({ altKey: true, code: "KeyI", key: "Dead" }), "i");
  assert.strictEqual(DT.keyOf({ altKey: true, code: "Digit3", key: "£" }), "3");
  assert.strictEqual(DT.keyOf({ altKey: false, code: "KeyQ", key: "a" }), "a", "zonder Alt telt het teken (AZERTY blijft werken)");
});

test("instellingen bewaren: een mislukte opslag gooit geen fout en geeft een melding", async () => {
  let fout = null; const meldingen = [];
  const DT = kern({ opslaan: async () => { if (fout) throw new Error(fout); } });
  DT.toast = (m) => meldingen.push(m);
  assert.strictEqual(await DT.saveSettings({ panel: { handle: false } }), true);
  fout = "QUOTA_BYTES_PER_ITEM quota exceeded";
  assert.strictEqual(await DT.saveSettings({ panel: { handle: true } }), false);
  assert.strictEqual(DT.settings.panel.handle, true, "de wijziging geldt nog wel in dit tabblad");
  assert.match(meldingen[0], /te veel/);
});

test("instellingen: bewaarde waarden gaan over de standaardwaarden heen, lijsten worden vervangen", async () => {
  const DT = kern({ bewaard: { settings: { jarig: { dagen: 3 }, links: [{ label: "X", url: "https://x" }] } } });
  await DT.loadSettings();
  assert.strictEqual(DT.settings.jarig.dagen, 3); assert.strictEqual(DT.settings.jarig.enabled, true);
  assert.strictEqual(DT.settings.links.length, 1);
});

test("eigen periodes: gesorteerd, einde om 23:59:59, ongeldige regels vallen weg", async () => {
  const DT = kern({ bewaard: { settings: { periodes: { lijst: [
    { id: "b", naam: "P2", begin: "2026-11-09", einde: "2027-01-31" }, { id: "a", naam: " P1 ", begin: "2026-08-31", einde: "2026-11-08" },
    { id: "x", naam: "omgekeerd", begin: "2026-12-01", einde: "2026-11-01" }, { id: "y", naam: "leeg", begin: "", einde: "" }] } } } });
  await DT.loadSettings();
  const p = DT.periodes();
  assert.deepStrictEqual(p.map((x) => x.naam), ["P1", "P2"]);
  assert.deepStrictEqual([p[0].einde.getHours(), p[0].einde.getMinutes(), p[0].einde.getDate()], [23, 59, 8]);
});

test("zijpaneel: het weeknummer is een getal, ook met verzuiminzicht.js erna geladen", () => {
  const { modules, DT } = metRegister();
  const ctx = laad(["content/modules/panel.js", "content/modules/verzuiminzicht.js"], { DT, window: {}, document: {} }, ["dtWeekNummer", "isoWeek"]);
  assert.strictEqual(ctx.uit.dtWeekNummer(new Date(2026, 10, 19)), 47);
  assert.strictEqual(ctx.uit.dtWeekNummer(new Date(2027, 0, 1)), 53, "1 januari 2027 valt in week 53 van 2026");
  assert.deepStrictEqual({ ...ctx.uit.isoWeek(new Date(2027, 0, 1)) }, { y: 2026, w: 53 });
  let tekst = "";
  modules.panel._panel = { querySelector: () => ({ firstChild: {}, querySelector: () => ({ set textContent(v) { tekst = v; } }) }) };
  modules.panel.tick();
  assert.match(tekst, /week \d+$/);
});

test("zijpaneel: wisselen zonder paneel (in een iframe, of met Escape) geeft geen fout", () => {
  const { modules, DT } = metRegister({ isTop: true });
  laad("content/modules/panel.js", { DT, window: {}, document: {} });
  modules.panel.toggle(false); modules.panel.toggle();
});

/* ---------- DT.observe en DT.apiRetry, met nagebootste tijd ---------- */
const { mock } = require("node:test");

function kernMetPagina(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const waarnemers = [], luisteraars = {};
  const document = { hidden: false, body: { append() {} }, getElementById: () => null, createElement: () => ({}),
    addEventListener: (n, f) => { luisteraars[n] = f; }, removeEventListener: (n) => { delete luisteraars[n]; } };
  function MutationObserver(cb) { this.cb = cb; this.observe = () => waarnemers.push(this); this.disconnect = () => waarnemers.splice(waarnemers.indexOf(this), 1); }
  const chrome = { runtime: { getManifest: () => ({ version: "test" }) }, storage: { sync: { get: async () => ({}), set: async () => {} } } };
  const ctx = laad(["content/defaults.js", "content/core.js"], { window: "zelf", chrome, document, MutationObserver, location: { host: "h", origin: "https://h" }, addEventListener() {}, removeEventListener() {}, postMessage() {}, navigator: {}, console: { warn() {}, info() {} },
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, Date: globalThis.Date });
  return { DT: ctx.DT, document, waarnemers, luisteraars, muteer: () => waarnemers.forEach((w) => w.cb()), tijd: (ms) => t.mock.timers.tick(ms) };
}

test("waarnemer: alle modules delen één MutationObserver, die verdwijnt als de laatste stopt", (t) => {
  const p = kernMetPagina(t);
  const stop1 = p.DT.observe(() => {}), stop2 = p.DT.observe(() => {});
  assert.strictEqual(p.waarnemers.length, 1);
  stop1(); assert.strictEqual(p.waarnemers.length, 1);
  stop2(); assert.strictEqual(p.waarnemers.length, 0);
});

test("waarnemer: wijzigingen worden gebundeld, maar een aanhoudende stroom duwt de callback niet eindeloos weg", (t) => {
  const p = kernMetPagina(t); let n = 0;
  p.DT.observe(() => { n++; }, { debounce: 300, poll: 0 });
  assert.strictEqual(n, 1, "direct één keer bij het starten");
  p.muteer(); p.tijd(100); p.muteer(); p.tijd(100); p.muteer(); p.tijd(299);
  assert.strictEqual(n, 1); p.tijd(1); assert.strictEqual(n, 2, "één keer, 300 ms na de laatste wijziging");
  for (let i = 0; i < 40; i++) { p.muteer(); p.tijd(100); }   // 4 seconden lang elke 100 ms een wijziging
  assert.ok(n >= 3, "toch gelopen binnen de maximale wachttijd");
});

test("waarnemer: het periodieke scannen pauzeert in een verborgen tabblad en haalt het daarna in", (t) => {
  const p = kernMetPagina(t); let n = 0, m = 0;
  p.DT.observe(() => { n++; }, { debounce: 100, poll: 1000 });
  p.DT.observe(() => { m++; }, { debounce: 100, poll: 1000, ookVerborgen: true });
  p.document.hidden = true; for (let i = 0; i < 100; i++) p.tijd(100);
  assert.strictEqual(n, 1, "geen scans terwijl het tabblad verborgen is");
  assert.ok(m > 5, "een formulier-invuller loopt wel door");
  p.document.hidden = false; p.luisteraars.visibilitychange(); p.tijd(100);
  assert.strictEqual(n, 2, "meteen bijgewerkt als het tabblad weer in beeld komt");
});

test("waarnemer: een fout in één module legt de andere niet stil", (t) => {
  const p = kernMetPagina(t); let n = 0, eerste = true;
  p.DT.observe(() => { if (eerste) { eerste = false; return; } throw new Error("stuk"); }, { debounce: 100, poll: 0 });
  p.DT.observe(() => { n++; }, { debounce: 100, poll: 0 });
  p.muteer(); p.tijd(100);
  assert.strictEqual(n, 2);
});

test("apiRetry: wacht bij 429 en 503 en probeert opnieuw; andere antwoorden gaan direct terug", async (t) => {
  const p = kernMetPagina(t); const antwoorden = [{ status: 429 }, { status: 503 }, { status: 200, json: { items: [1, 2] } }]; let gewacht = 0, aanvragen = 0;
  p.DT.api = async () => { aanvragen++; return antwoorden.shift(); };
  const belofte = p.DT.apiRetry("/api/x", { opWachten: () => { gewacht++; } });
  for (let i = 0; i < 10; i++) { await Promise.resolve(); await Promise.resolve(); p.tijd(1500 * 2 ** i); }
  const r = await belofte;
  assert.strictEqual(r.status, 200); assert.strictEqual(aanvragen, 3); assert.strictEqual(gewacht, 2);
  assert.deepStrictEqual([...p.DT.lijst(r)], [1, 2]);
  assert.strictEqual(p.DT.lijst({ status: 404 }), null);
  p.DT.api = async () => ({ status: 404 });
  assert.strictEqual((await p.DT.apiRetry("/api/x")).status, 404);
});
