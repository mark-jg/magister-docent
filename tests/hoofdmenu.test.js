/* Het hoofdmenu rangschikken en verbergen (content/modules/hoofdmenu.js): de rekenregels. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister, kaal } = require("./hulp");

const { DT } = metRegister();
const M = laad("content/modules/hoofdmenu.js", { DT, window: {}, document: {} }, ["MenuReken"]).uit.MenuReken;
const NAMEN = ["vandaag", "agenda", "leerlingen", "aanwezigheid", "opleidingen"];

test("naam van een item: de tekst in kleine letters, zonder dubbele spaties", () => {
  assert.strictEqual(M.sleutel("  Te  laat-balie\n"), "te laat-balie");
});

test("volgorde: zonder keuze zoals Magister, met keuze zoals bewaard; een nieuw item blijft bij zijn voorganger", () => {
  assert.deepStrictEqual(kaal(M.sorteer(NAMEN, [])), NAMEN);
  assert.deepStrictEqual(kaal(M.sorteer(NAMEN, ["leerlingen", "vandaag", "weg", "aanwezigheid"])), ["leerlingen", "vandaag", "agenda", "aanwezigheid", "opleidingen"]);
  assert.deepStrictEqual(kaal(M.sorteer(["nieuw", ...NAMEN], NAMEN.slice().reverse())), ["nieuw", ...NAMEN.slice().reverse()]);
});

test("verplaatsen: één plek binnen de eigen groep, verborgen items tellen niet mee", () => {
  assert.deepStrictEqual(kaal(M.verplaats(NAMEN, "leerlingen", -1, ["agenda"])), ["leerlingen", "agenda", "vandaag", "aanwezigheid", "opleidingen"]);
  assert.deepStrictEqual(kaal(M.verplaats(NAMEN, "vandaag", -1)), NAMEN, "bovenaan kan niet hoger");
  assert.deepStrictEqual(kaal(M.verplaats(NAMEN, "opleidingen", 1)), NAMEN, "onderaan kan niet lager");
  assert.deepStrictEqual(kaal(M.verplaats(NAMEN, "agenda", 1, ["agenda", "opleidingen"])), ["vandaag", "opleidingen", "leerlingen", "aanwezigheid", "agenda"]);
});
