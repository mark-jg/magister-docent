/* De kern (content/core.js): sneltoetsen, instellingen bewaren en eigen periodes. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister } = require("./hulp");

function kern({ opslaan = async () => {}, bewaard = {}, extra = {} } = {}) {
  const chrome = { runtime: { getManifest: () => ({ version: "test" }) }, storage: { sync: { get: async () => bewaard, set: opslaan } } };
  const document = { getElementById: () => null, body: { append() {} }, createElement: () => ({ append() {}, classList: { add() {}, remove() {} }, setAttribute() {}, remove() {} }) };
  const ctx = laad(["content/defaults.js", "content/core.js"], { window: "zelf", chrome, document, location: { host: "school.magister.net", origin: "https://school.magister.net" }, requestAnimationFrame() {}, navigator: {}, addEventListener() {}, postMessage() {}, console: { warn() {}, info() {} }, ...extra });
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

test("zijkolom: het weeknummer is een getal, ook naast de isoWeek van verzuiminzicht.js", () => {
  const { modules, DT } = metRegister();
  let tekst = "";
  const document = { getElementById: (id) => (id === "kolomDatum" ? { set textContent(v) { tekst = v; } } : null) };
  const ctx = laad(["sidepanel/paneel.js", "content/modules/verzuiminzicht.js"], { DT, DtKolom: {}, window: {}, document }, ["dtWeekNummer", "isoWeek"]);
  assert.strictEqual(ctx.uit.dtWeekNummer(new Date(2026, 10, 19)), 47);
  assert.strictEqual(ctx.uit.dtWeekNummer(new Date(2027, 0, 1)), 53, "1 januari 2027 valt in week 53 van 2026");
  assert.deepStrictEqual({ ...ctx.uit.isoWeek(new Date(2027, 0, 1)) }, { y: 2026, w: 53 });
  modules.panel.tick();
  assert.match(tekst, /week \d+$/);
});

test("handvat: de kolom openen gaat als bericht naar de achtergrond; Escape op de pagina sluit hem niet", () => {
  const berichten = [];
  const { modules, DT } = metRegister({ isTop: true });
  laad("content/modules/panel.js", { DT, window: {}, document: {}, location: { origin: "https://h" }, chrome: { runtime: { sendMessage: (m) => { berichten.push(m); return Promise.resolve(); } } } });
  modules.panel.toggle(false);
  assert.strictEqual(berichten.length, 0);
  modules.panel.toggle(); modules.panel.toggle(true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(berichten)), [{ type: "zijkolom", alleenOpenen: false }, { type: "zijkolom", alleenOpenen: true }]);
});

test("handvat in een iframe: de vraag gaat door naar het hoofdvenster", () => {
  const gepost = [];
  const { modules, DT } = metRegister({ isTop: false });
  laad("content/modules/panel.js", { DT, window: { top: { postMessage: (m, o) => gepost.push([m, o]) } }, document: {}, location: { origin: "https://h" }, chrome: { runtime: { sendMessage() { throw new Error("mag niet"); } } } });
  modules.panel.toggle();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(gepost)), [[{ type: "dt:cmd", command: "toggle-panel" }, "https://h"]]);
});

/* ---------- DT.observe en DT.apiRetry, met nagebootste tijd ---------- */
const { mock } = require("node:test");

function kernMetPagina(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const waarnemers = [], luisteraars = {};
  const document = { hidden: false, body: { append() {} }, getElementById: () => null, createElement: () => ({}),
    addEventListener: (n, f) => { luisteraars[n] = f; }, removeEventListener: (n) => { delete luisteraars[n]; } };
  function MutationObserver(cb) { this.cb = cb; this.observe = () => waarnemers.push(this); this.disconnect = () => waarnemers.splice(waarnemers.indexOf(this), 1); }
  const chrome = { runtime: { id: "test", getManifest: () => ({ version: "test" }) }, storage: { sync: { get: async () => ({}), set: async () => {} } } };
  const ctx = laad(["content/defaults.js", "content/core.js"], { window: "zelf", chrome, document, MutationObserver, location: { host: "h", origin: "https://h" }, addEventListener() {}, removeEventListener() {}, postMessage() {}, navigator: {}, console: { warn() {}, info() {} },
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, Date: globalThis.Date });
  return { DT: ctx.DT, ctx, chrome, document, waarnemers, luisteraars, muteer: () => waarnemers.forEach((w) => w.cb()), tijd: (ms) => t.mock.timers.tick(ms) };
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

test("waarnemer: na herladen van de extensie stopt het oude script, in plaats van elke ronde een fout te geven", (t) => {
  const p = kernMetPagina(t); let n = 0;
  p.DT.observe(() => { n++; }, { debounce: 100, poll: 1000 });
  p.DT.observe(async () => { await p.chrome.storage.sync.get(); }, { debounce: 100, poll: 1000 });
  p.tijd(1000); p.tijd(150); assert.strictEqual(n, 2);
  delete p.chrome.runtime.id;   // zo ziet een verlopen koppeling eruit
  for (let i = 0; i < 50; i++) p.tijd(1000);
  assert.strictEqual(n, 2, "geen rondes meer");
  assert.strictEqual(p.waarnemers.length, 0, "MutationObserver losgekoppeld");
  let later = 0; p.DT.observe(() => { later++; });
  assert.strictEqual(later, 0, "nieuwe waarnemers starten niet meer");
});

/* Een nagemaakte browser: adres met hash, geschiedenis met toestand, en de gebeurtenissen bij Terug en Vooruit. */
function browser(begin = "#/vandaag") {
  const stappen = [{ hash: begin, state: null }], luisteraars = { popstate: [], hashchange: [] }; let nu = 0;
  const meld = () => { for (const soort of ["popstate", "hashchange"]) luisteraars[soort].slice().forEach((fn) => fn({ state: stappen[nu].state })); };
  const kopie = (s) => (s == null ? null : JSON.parse(JSON.stringify(s)));
  const location = { host: "school.magister.net", origin: "https://school.magister.net",
    get hash() { return stappen[nu].hash; }, set hash(h) { stappen.length = nu + 1; stappen.push({ hash: h, state: null }); nu++; },
    get href() { return `https://school.magister.net/magister/${stappen[nu].hash}`; },
    replace(url) { stappen[nu] = { hash: url.slice(url.indexOf("#")), state: null }; } };
  const history = { get state() { return stappen[nu].state; },
    pushState(s) { const hash = stappen[nu].hash; stappen.length = nu + 1; stappen.push({ hash, state: kopie(s) }); nu++; },
    replaceState(s) { stappen[nu].state = kopie(s); } };
  const opslag = {}, sessionStorage = { getItem: (k) => (k in opslag ? opslag[k] : null), setItem: (k, v) => { opslag[k] = String(v); } };
  return { stappen, ga: (d) => { nu += d; meld(); }, zetHash: (h) => { location.hash = h; meld(); }, opslag,
    extra: { location, history, sessionStorage, URLSearchParams, addEventListener: (soort, fn) => luisteraars[soort]?.push(fn), removeEventListener: (soort, fn) => { const l = luisteraars[soort] || [], i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } } };
}

test("routes voor eigen pagina's: de route staat achter Magisters adres, en Terug of Vooruit meldt hem", () => {
  const b = browser("#/vandaag"), DT = kern({ extra: b.extra });
  const gezien = [], stop = DT.route.luister("opleidingen", (r) => gezien.push(r && (r.tab + (r.zoom ? `/${r.zoom}` : ""))));
  DT.route.zet("opleidingen", { tab: "overzicht", zoom: null });
  assert.strictEqual(b.extra.location.hash, "#/vandaag?dt=opleidingen&dt.tab=overzicht", "lege waarden komen niet in het adres");
  DT.route.zet("opleidingen", { tab: "overzicht" });
  assert.strictEqual(b.stappen.length, 2, "dezelfde route geeft geen dubbele stap");
  DT.route.zet("opleidingen", { tab: "overzicht", zoom: "k:MIP1A" });
  assert.strictEqual(b.extra.location.hash, "#/vandaag?dt=opleidingen&dt.tab=overzicht&dt.zoom=k:MIP1A");
  assert.strictEqual(DT.route.pad(), "#/vandaag"); assert.strictEqual(DT.route.nu("opleidingen").zoom, "k:MIP1A"); assert.strictEqual(DT.route.nu("cb"), null);
  b.ga(-1); b.ga(-1); b.ga(1);
  assert.deepStrictEqual(gezien, ["overzicht", "overzicht", null, null, "overzicht", "overzicht"], "elke stap meldt zich via popstate en hashchange");
  DT.route.zet("opleidingen", { tab: "verloop" }, true);
  assert.strictEqual(b.stappen.length, 3, "vervangen maakt geen nieuwe stap"); assert.strictEqual(b.stappen[1].hash, "#/vandaag?dt=opleidingen&dt.tab=verloop");
  DT.route.zet(null);
  assert.strictEqual(b.extra.location.hash, "#/vandaag", "sluiten haalt de toevoeging weg");
  stop(); const n = gezien.length; b.ga(-1);
  assert.strictEqual(gezien.length, n, "na stoppen komt er niets meer binnen");
});

test("routes: Magisters eigen toevoegingen blijven staan, en zonder adres werkt het via de geschiedenis", () => {
  const b = browser("#/begeleiding/123?innerUrl=abc"), DT = kern({ extra: b.extra });
  DT.route.zet("inzicht", { view: "vergelijk", id: 123 });
  assert.strictEqual(b.extra.location.hash, "#/begeleiding/123?innerUrl=abc&dt=inzicht&dt.id=123&dt.view=vergelijk");
  assert.strictEqual(DT.route.pad(), "#/begeleiding/123"); assert.strictEqual(DT.route.nu("inzicht").id, "123", "waarden komen als tekst terug");
  DT.route.zet(null);
  assert.strictEqual(b.extra.location.hash, "#/begeleiding/123?innerUrl=abc");
  /* Magister haalde de toevoeging weg: voor deze sessie alleen nog via de geschiedenis. */
  b.opslag["dt-route-adres"] = "uit";
  DT.route.zet("cb", { view: "signalen" });
  assert.strictEqual(b.extra.location.hash, "#/begeleiding/123?innerUrl=abc", "het adres blijft staan");
  assert.strictEqual(DT.route.nu("cb").view, "signalen"); assert.strictEqual(b.stappen.length, 4);
});

test("tempo: aanvragen starten met tussenpozen, en na een 429 houdt alles in en gaat het daarna rustiger", async (t) => {
  const p = kernMetPagina(t), starts = []; let weiger = 1;
  const loop = async (ms) => { for (let i = 0; i < ms / 10; i++) { for (let j = 0; j < 8; j++) await Promise.resolve(); p.tijd(10); } };
  p.DT.api = async (url) => { starts.push([url, Date.now()]); return url === "/b" && weiger-- > 0 ? { status: 429, retryAfter: "4" } : { status: 200, json: [] }; };
  const t0 = Date.now(), alle = Promise.all(["/a", "/b", "/c", "/d"].map((u) => p.DT.apiRetry(u)));
  await loop(8000); await alle;
  const op = (u) => starts.filter((s) => s[0] === u).map((s) => s[1] - t0);
  assert.deepStrictEqual([op("/a")[0], op("/b")[0]], [0, 150], "niet tegelijk, maar 150 ms na elkaar");
  assert.strictEqual(op("/b").length, 2, "de geweigerde aanvraag is opnieuw gedaan");
  for (const u of ["/b", "/c", "/d"]) assert.ok(op(u).at(-1) >= 150 + 4000, `${u} wacht zo lang als Magister vraagt`);
  const na = starts.map((s) => s[1] - t0).filter((x) => x >= 4000).sort((a, b) => a - b);
  assert.ok(na[1] - na[0] >= 300 && na[2] - na[1] >= 300, "daarna met dubbele tussenpozen");
  assert.strictEqual(p.DT.tempo.tussen, 300); assert.ok(p.DT.tempo.vloer > 150, "het te snelle tempo wordt onthouden");
});

test("statusblok in het hoofdmenu: de tekstkleur komt van een gewoon menu-item, en blijft leesbaar", (t) => {
  const p = kernMetPagina(t), DT = p.DT;
  const stijlen = new Map(), stijl = (el, s) => { stijlen.set(el, s); return el; };
  const item = (kleur, klasse = "") => { const li = { matches: (sel) => !!klasse && sel.includes(`.${klasse}`) }; return stijl({ parentElement: li, matches: (sel) => !!klasse && sel.includes(`.${klasse}`) }, { color: kleur }); };
  const menu = (achtergrond, items) => { const nav = stijl({ parentElement: null }, { backgroundColor: achtergrond }); return { host: { parentElement: stijl({ parentElement: nav }, { backgroundColor: "rgba(0, 0, 0, 0)" }) }, ul: { querySelectorAll: () => items } }; };
  p.ctx.getComputedStyle = (el) => stijlen.get(el) || {};
  const kleur = (m) => DT.taakKleur(m.host, m.ul);
  assert.strictEqual(DT.contrast(DT.rgb("rgb(255, 255, 255)"), DT.rgb("rgb(0,0,0)")), 21);
  /* Licht menu, het eerste item is de pagina waar je bent (wit op de accentkleur): het gewone item telt. */
  assert.strictEqual(kleur(menu("rgb(246, 248, 250)", [item("rgb(255, 255, 255)", "active"), item("rgb(35, 50, 67)")])), "rgb(35, 50, 67)");
  /* Donker menu met lichte items. */
  assert.strictEqual(kleur(menu("rgb(22, 48, 79)", [item("rgb(232, 240, 250)"), item("rgb(255, 255, 255)", "active")])), "rgb(232, 240, 250)");
  /* Geen bruikbaar item, of een kleur die op deze achtergrond niet te lezen is: donker of licht naar de achtergrond. */
  assert.strictEqual(kleur(menu("rgb(246, 248, 250)", [item("rgb(255, 255, 255)", "active")])), "#1d1d1f");
  assert.strictEqual(kleur(menu("rgb(246, 248, 250)", [item("rgb(220, 226, 232)")])), "#1d1d1f");
  assert.strictEqual(kleur(menu("rgb(22, 48, 79)", [])), "#ffffff");
});
