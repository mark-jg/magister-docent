/* Hulp voor de tests: laadt bestanden van de extensie in een afgeschermde omgeving (node:vm), zoals Chrome ze
 * als content-script in één gedeelde scope laadt. Er is geen browser nodig; wat een bestand van de pagina
 * verwacht (window, document, chrome) geven de tests zelf mee, zo klein mogelijk. */
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const lees = (bestand) => fs.readFileSync(path.join(ROOT, bestand), "utf8");

const BASIS = () => ({ console, URL, Headers, Request, Response, performance, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, Date, Math, JSON, RegExp, Map, Set, WeakMap, Object, Array, String, Number, Boolean, Error, Symbol, Uint8Array, DataView, TextEncoder, TextDecoder, crypto: globalThis.crypto });

/* laad(["content/core.js", …], { window, chrome, … }, ["naam", …])
 * Geeft de omgeving terug; de namen in `uit` (const/let op het hoogste niveau, die anders onzichtbaar zijn)
 * staan daarna op ctx.uit. */
function laad(bestanden, omgeving = {}, uit = []) {
  const ctx = vm.createContext(Object.assign(BASIS(), omgeving));
  if (!("globalThis" in omgeving)) ctx.globalThis = ctx;
  /* window: "zelf" maakt de omgeving zelf het venster, zoals in de browser (window.DT is dan ook gewoon DT). */
  if (omgeving.window === "zelf") { ctx.window = ctx; ctx.top = ctx; ctx.parent = ctx; ctx.self = ctx; }
  const bron = [].concat(bestanden).map(lees).join("\n;\n")
    + `\n;this.uit = {${uit.map((n) => `${JSON.stringify(n)}: (typeof ${n} === "undefined" ? undefined : ${n})`).join(", ")}};`;
  vm.runInContext(bron, ctx, { filename: [].concat(bestanden).join("+") });
  return ctx;
}

/* Vangt DT.register op, voor een module die los wordt getest. */
function metRegister(extra = {}) {
  const modules = {};
  return { modules, DT: Object.assign({ register: (m) => { modules[m.id] = m; }, el: () => ({}), settings: {} }, extra) };
}

const tik = (ms = 20) => new Promise((r) => setTimeout(r, ms));
/* Gewone kopie, zodat deepStrictEqual objecten uit de vm-omgeving kan vergelijken. */
const kaal = (x) => JSON.parse(JSON.stringify(x));

module.exports = { ROOT, lees, laad, metRegister, tik, kaal };
