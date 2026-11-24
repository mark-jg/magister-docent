/* Wat de pagina antwoordt op vragen van de zijkolom (content/kolom.js). */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, kaal } = require("./hulp");

function pagina({ modulesAan = { tables: true, cb: true }, isTop = true } = {}) {
  const gedaan = [], toasts = [], luisteraars = [];
  const tabel = (naam, rijen) => ({ naam, rijen, isConnected: true, scrollIntoView: () => gedaan.push(`toon ${naam}`) });
  const tables = { _tables: [tabel("Cijfers", 12), tabel("Aanwezigheid", 30)], scan: () => gedaan.push("scan"), name: (t) => t.naam,
    run: (_dt, t, soort) => gedaan.push(`${soort} ${t.naam}`), dialog: (_dt, t) => gedaan.push(`opties ${t.naam}`) };
  const DT = { version: "9.9.9", module: (id) => (id === "tables" ? tables : { open: () => gedaan.push(`open ${id}`), klas: () => gedaan.push("klas"), bespreeklijst: () => gedaan.push("bespreeklijst") }),
    actief: (id) => !!modulesAan[id], tableToMatrix: (t) => new Array(t.rijen + 1), toast: (m) => toasts.push(m) };
  const win = { DT, chrome: { runtime: { onMessage: { addListener: (f) => luisteraars.push(f) } } }, document: { querySelector: () => null, body: { innerText: "Regel 1\n\n\n\n\nRegel 2  " } } };
  const ctx = laad("content/kolom.js", { ...win, window: isTop ? "zelf" : { top: {} } });
  const vraag = (msg) => { let uit; luisteraars[0]?.({ type: "dt:kolom", ...msg }, {}, (r) => { uit = r; }); return kaal(uit ?? null); };
  return { ctx, vraag, gedaan, toasts, tables, luisteraars };
}

test("tabellen: naam en aantal rijen van elke tabel op de pagina", () => {
  const p = pagina();
  assert.deepStrictEqual(p.vraag({ vraag: "tabellen" }), { ok: true, tabellen: [{ naam: "Cijfers", rijen: 12 }, { naam: "Aanwezigheid", rijen: 30 }] });
  assert.deepStrictEqual(p.gedaan, ["scan"]);
});

test("tabel: exporteren, tonen en opties gaan naar de juiste tabel", () => {
  const p = pagina();
  assert.deepStrictEqual(p.vraag({ vraag: "tabel", index: 1, actie: "xlsx" }), { ok: true });
  p.vraag({ vraag: "tabel", index: 0, actie: "toon" }); p.vraag({ vraag: "tabel", index: 0, actie: "opties" }); p.vraag({ vraag: "tabel", index: 0, actie: "csv" });
  assert.deepStrictEqual(p.gedaan, ["xlsx Aanwezigheid", "toon Cijfers", "opties Cijfers", "csv Cijfers"]);
});

test("tabel die intussen van de pagina is verdwenen: een duidelijke melding, geen export", () => {
  const p = pagina(); p.tables._tables[0].isConnected = false;
  assert.strictEqual(p.vraag({ vraag: "tabel", index: 0, actie: "xlsx" }).ok, false);
  assert.strictEqual(p.vraag({ vraag: "tabel", index: 5, actie: "xlsx" }).ok, false);
  assert.deepStrictEqual(p.gedaan, []); assert.strictEqual(p.toasts.length, 2);
});

test("module uit: geen tabellen, en een actie van een uitgeschakeld onderdeel wordt geweigerd", () => {
  const p = pagina({ modulesAan: { tables: false, cb: false } });
  assert.deepStrictEqual(p.vraag({ vraag: "tabellen" }), { ok: true, uit: true, tabellen: [] });
  assert.strictEqual(p.vraag({ vraag: "actie", naam: "cb" }).ok, false);
  assert.deepStrictEqual(p.gedaan, []);
});

test("acties: de Te laat-balie openen; een onbekende actie doet niets", () => {
  const p = pagina();
  assert.deepStrictEqual(p.vraag({ vraag: "actie", naam: "cb" }), { ok: true });
  assert.strictEqual(p.vraag({ vraag: "actie", naam: "wis-alles" }).ok, false);
  assert.deepStrictEqual(p.gedaan, ["open cb"]);
});

test("paginatekst: de tekst van de pagina, zonder stapels lege regels", () => {
  assert.deepStrictEqual(pagina().vraag({ vraag: "paginaTekst" }), { ok: true, tekst: "Regel 1\n\nRegel 2" });
});

test("andere berichten en frames: geen antwoord (zodat er precies één antwoord komt)", () => {
  const p = pagina(); let geantwoord = false;
  p.luisteraars[0]({ type: "command", command: "export" }, {}, () => { geantwoord = true; });
  assert.strictEqual(geantwoord, false);
  assert.strictEqual(pagina({ isTop: false }).luisteraars.length, 0, "een iframe luistert niet");
});

test("back-upmap: de stand komt later (asynchroon) en kiezen opent een venstertje op de pagina", async () => {
  const gedaan = [], luisteraars = [];
  const LesOpslag = { map: async () => ({ h: { name: "Back-up" }, mag: false }), vergeet: async () => gedaan.push("vergeet"), opPagina: (_dt, soort) => gedaan.push(`venster ${soort}`) };
  const DT = { version: "9.9.9", module: () => null, actief: () => true, toast: () => {} };
  laad("content/kolom.js", { DT, LesOpslag, chrome: { runtime: { onMessage: { addListener: (f) => luisteraars.push(f) } } }, document: {}, showDirectoryPicker() {}, window: "zelf" });
  const vraag = (actie) => new Promise((ok) => { luisteraars[0]({ type: "dt:kolom", vraag: "map", actie }, {}, (r) => ok({ r: kaal(r) })); });
  const status = await vraag("status");
  assert.deepStrictEqual(status.r, { ok: true, kan: true, naam: "Back-up", mag: false });
  assert.strictEqual((await vraag("kies")).r.ok, true);
  await vraag("vergeet");
  assert.deepStrictEqual(gedaan, ["venster kies", "vergeet"]);
  assert.strictEqual(luisteraars[0]({ type: "dt:kolom", vraag: "map", actie: "status" }, {}, () => {}), true, "het kanaal blijft open voor het late antwoord");
});
