/* Bewaakt de samenhang van de extensie als geheel: bestaat alles waar het manifest naar wijst, en zitten de
 * content-scripts elkaar niet in de weg in hun gedeelde scope. */
const { test } = require("node:test"), assert = require("node:assert"), fs = require("node:fs"), path = require("node:path");
const { ROOT, lees, laad } = require("./hulp");

const manifest = JSON.parse(lees("manifest.json"));
const isolated = manifest.content_scripts.find((c) => c.world !== "MAIN").js;

test("alle bestanden uit het manifest bestaan", () => {
  const bestanden = [...manifest.content_scripts.flatMap((c) => [...c.js, ...(c.css || [])]), manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons)];
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

test("de versie in manifest.json en de kop van README.md zijn gelijk", () => {
  const kop = /\(v([0-9.]+)\)/.exec(lees("README.md").split("\n")[0]);
  assert.strictEqual(kop && kop[1], manifest.version);
});
