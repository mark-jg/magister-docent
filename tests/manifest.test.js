/* Bewaakt de samenhang van de extensie als geheel: bestaat alles waar het manifest naar wijst, en zitten de
 * content-scripts elkaar niet in de weg in hun gedeelde scope. */
const { test } = require("node:test"), assert = require("node:assert"), fs = require("node:fs"), path = require("node:path");
const { ROOT, lees, laad } = require("./hulp");

const manifest = JSON.parse(lees("manifest.json"));
const isolated = manifest.content_scripts.find((c) => c.world !== "MAIN").js;

test("alle bestanden uit het manifest bestaan", () => {
  const bestanden = [...manifest.content_scripts.flatMap((c) => [...c.js, ...(c.css || [])]), manifest.background.service_worker, manifest.side_panel.default_path, manifest.options_page, ...Object.values(manifest.icons)];
  for (const b of bestanden) assert.ok(fs.existsSync(path.join(ROOT, b)), `${b} ontbreekt`);
});

test("geen twee content-scripts met dezelfde functie- of constantenaam op het hoogste niveau", () => {
  /* Alle content-scripts delen één scope: een tweede `function isoWeek` overschrijft stil de eerste (zo toonde
   * het zijpaneel "week [object Object]"), en een tweede `const` met dezelfde naam laat het hele bestand
   * mislukken. */
  const gezien = new Map(), dubbel = [];
  for (const b of isolated.filter((f) => !f.startsWith("lib/"))) {
    for (const m of lees(b).matchAll(/^(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+|class\s+)([A-Za-z_$][\w$]*)/gm)) {
      if (gezien.has(m[1])) dubbel.push(`${m[1]} (${gezien.get(m[1])} en ${b})`); else gezien.set(m[1], b);
    }
  }
  assert.deepStrictEqual(dubbel, []);
});

test("alle content-scripts laden samen in manifestvolgorde en elke module meldt zich aan", () => {
  const noop = () => {};
  const el = () => new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "length" ? 0 : el()), apply: () => el(), set: () => true });
  const document = { body: null, head: null, documentElement: el(), addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => el() };
  const win = { addEventListener: noop, removeEventListener: noop, postMessage: noop, matchMedia: () => ({ matches: false, addEventListener: noop }), location: { href: "https://school.magister.net/op/", host: "school.magister.net", origin: "https://school.magister.net", pathname: "/op/", hash: "" } };
  const chrome = { runtime: { getManifest: () => manifest, getURL: (u) => u, onMessage: { addListener: noop, removeListener: noop }, sendMessage: async () => ({}) }, storage: { sync: { get: async () => ({}), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: { addListener: noop } } };
  const opslag = { getItem: () => null, setItem: noop, removeItem: noop };
  const geregistreerd = [];
  const ctx = laad(isolated.filter((f) => !f.startsWith("lib/") && f !== "content/boot.js"), { ...win, window: "zelf", document, chrome, history: { pushState: noop, replaceState: noop }, navigator: { userAgent: "", clipboard: {} },
    localStorage: opslag, sessionStorage: opslag, indexedDB: {}, CSS: { escape: (s) => s }, MutationObserver: function () { this.observe = noop; this.disconnect = noop; }, requestAnimationFrame: noop, getComputedStyle: () => ({}), XLSX: { utils: {}, CFB: {} }, CustomEvent: function () {}, Event: function () {}, KeyboardEvent: function () {}, HTMLElement: function () {}, Node: function () {}, Blob: function () {}, File: function () {}, FileReader: function () {}, DataTransfer: function () {}, Image: function () {}, confirm: () => false, alert: noop, matchMedia: win.matchMedia });
  const DT = ctx.window.DT;
  assert.ok(DT, "core.js zet window.DT");
  for (const [id] of ctx.DT_MODULES_LIST) { assert.ok(DT.module(id), `module ${id} uit DT_MODULES_LIST is niet aangemeld`); geregistreerd.push(id); }
  for (const id of geregistreerd) assert.ok(id in ctx.DT_DEFAULTS, `module ${id} heeft geen standaardinstellingen in defaults.js`);
});

test("de pagina's van de extensie verwijzen alleen naar bestaande scripts en stijlbladen", () => {
  for (const pagina of [manifest.side_panel.default_path, manifest.options_page]) {
    for (const m of lees(pagina).matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)) {
      const doel = path.join(ROOT, path.dirname(pagina), m[1]);
      assert.ok(fs.existsSync(doel), `${pagina} verwijst naar ${m[1]}, dat ontbreekt`);
    }
  }
});

test("instellingen: elke module heeft één schakelaar, en elk onderdeel hoort bij een tabblad van de kolom", () => {
  const html = lees(manifest.options_page), ctx = laad("content/defaults.js", {});
  for (const [id] of ctx.DT_MODULES_LIST) {
    const n = html.split(`data-path="${id}.enabled"`).length - 1;
    assert.strictEqual(n, 1, `module ${id}: ${n} schakelaars op de instellingenpagina`);
  }
  const secties = [...html.matchAll(/<section([^>]*)>/g)].map((x) => x[1]);
  for (const a of secties) assert.match(a, /data-blad="(uiterlijk|modules|meer)"/, `sectie zonder tabblad: ${a}`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  assert.deepStrictEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], "geen dubbele id's");
  /* Elk instelbaar veld verwijst naar een bestaande standaardinstelling. */
  for (const [, pad] of html.matchAll(/data-path="([^"]+)"/g)) {
    const waarde = pad.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx.DT_DEFAULTS);
    assert.notStrictEqual(waarde, undefined, `${pad} staat niet in defaults.js`);
  }
  const tabs = [...lees(manifest.side_panel.default_path).matchAll(/role="tab"[^>]*data-blad="([^"]+)"/g)].map((x) => x[1]);
  assert.deepStrictEqual(tabs, ["start", "uiterlijk", "modules", "meer"]);
});

test("het icoon opent de zijkolom: er is geen los menu meer, en de kolom mag van het manifest", () => {
  assert.strictEqual(manifest.action.default_popup, undefined);
  assert.ok(manifest.permissions.includes("sidePanel"));
  assert.ok(!fs.existsSync(path.join(ROOT, "popup")), "de map popup is verwijderd");
});

test("de zijkolom laadt: alle scripts samen, het paneel meldt zich aan en tekent zonder fouten", async () => {
  const pagina = lees(manifest.side_panel.default_path);
  const scripts = [...pagina.matchAll(/<script src="([^"]+)"/g)].map((m) => path.normalize(path.join(path.dirname(manifest.side_panel.default_path), m[1])));
  assert.ok(scripts.includes("sidepanel/paneel.js") && scripts.at(-1) === "sidepanel/start.js");
  const noop = () => {};
  const el = () => new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : k === "length" ? 0 : k === Symbol.iterator ? [][Symbol.iterator].bind([]) : el()), apply: () => el(), set: () => true });
  const gebeurtenis = { addListener: noop, removeListener: noop };
  const chrome = { runtime: { getManifest: () => manifest, getURL: (u) => u, connect: () => ({ postMessage: noop, onMessage: gebeurtenis, onDisconnect: gebeurtenis }) },
    storage: { sync: { get: async () => ({ settings: { theme: { preset: "paper", mode: "dark" } } }), set: async () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: gebeurtenis },
    tabs: { query: async () => [], sendMessage: async () => null, onActivated: gebeurtenis, onUpdated: gebeurtenis, reload: noop }, windows: { getCurrent: async () => ({ id: 7 }) } };
  const fouten = [];
  const document = { hidden: false, body: el(), head: el(), documentElement: el(), addEventListener: noop, querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), createElement: () => el(), createTextNode: () => el() };
  const ctx = laad(scripts.slice(0, -1), { window: "zelf", document, chrome, location: { host: "x", origin: "chrome-extension://x", search: "" }, matchMedia: () => ({ matches: true, addEventListener: noop }), navigator: { clipboard: {} }, addEventListener: noop, removeEventListener: noop, postMessage: noop,
    requestAnimationFrame: noop, MutationObserver: function () { this.observe = noop; this.disconnect = noop; }, console: { warn: (...a) => fouten.push(a.join(" ")), info: noop, log: noop, error: (...a) => fouten.push(a.join(" ")) }, confirm: () => false, setInterval: () => 0, clearInterval: noop }, ["DtKolom"]);
  const DT = ctx.DT;
  await DT.loadSettings();
  assert.strictEqual(DT.settings.theme.preset, "paper");
  ctx.uit.DtKolom.thema();
  DT.module("panel").init(DT);
  assert.strictEqual(await ctx.uit.DtKolom.vraag({ vraag: "tabellen" }), null, "zonder Magister-tabblad komt er geen antwoord, en geen fout");
  assert.deepStrictEqual(fouten, []);
});

test("de versie in manifest.json en de kop van README.md zijn gelijk", () => {
  const kop = /\(v([0-9.]+)\)/.exec(lees("README.md").split("\n")[0]);
  assert.strictEqual(kop && kop[1], manifest.version);
});
