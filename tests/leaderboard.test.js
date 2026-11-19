/* De ranglijst (content/modules/leaderboard.js): volgorde, gedeelde plaatsen en de keuze om ziek en geoorloofd
 * afwezig buiten de telling te laten. */
const { test } = require("node:test"), assert = require("node:assert");
const { laad, metRegister, kaal } = require("./hulp");

const { modules, DT } = metRegister();
laad("content/modules/leaderboard.js", { DT, window: {}, document: {} });
const lb = modules.leaderboard;
/* telt = lessen die meetellen, afwezig = alle gemiste lessen (ongeoorloofd, geoorloofd, ziek, uitgestuurd) */
const rij = (naam, telt, per, teLaat = 0) => ({ l: { id: naam, naam }, T: { telt, teLaat, afwezig: (per.AB_NO || 0) + (per.AB_OK || 0) + (per.ZK || 0) + (per.UI || 0), per } });
const klas = () => [rij("Ziek", 10, { ZK: 4 }), rij("Spijbelt", 10, { AB_NO: 2 }), rij("Altijd", 10, {}), rij("Tandarts", 10, { AB_OK: 1, AB_NO: 1 }), rij("Hele week ziek", 10, { ZK: 10 })];
const stand = (uit) => kaal(uit.met).map((r) => `${r.plek}. ${r.l.naam} ${Math.floor(r.pct * 100)}% (${r.aanw}/${r.telt})`);

test("standaard: elke gemiste les telt, ook ziek", () => {
  lb._zonderGeoorloofd = false;
  const uit = lb.rangschik(klas());
  assert.deepStrictEqual(stand(uit), ["1. Altijd 100% (10/10)", "2. Spijbelt 80% (8/10)", "2. Tandarts 80% (8/10)", "3. Ziek 60% (6/10)", "4. Hele week ziek 0% (0/10)"]);
  assert.strictEqual(uit.zonder.length, 0);
});

test("ziek telt niet mee: ziek en geoorloofd vallen buiten de telling, ongeoorloofd blijft tellen", () => {
  lb._zonderGeoorloofd = true;
  const uit = lb.rangschik(klas());
  /* Bij een gelijk percentage gaat wie meer lessen aanwezig was voor (bestaande regel). */
  assert.deepStrictEqual(stand(uit), ["1. Altijd 100% (10/10)", "2. Ziek 100% (6/6)", "3. Tandarts 88% (8/9)", "4. Spijbelt 80% (8/10)"]);
  assert.deepStrictEqual(kaal(uit.zonder).map((x) => x.l.naam), ["Hele week ziek"], "wie de hele week ziek was staat bij 'geen lessen', niet onderaan");
});

test("gelijke cijfers delen een plaats en de plaatsen lopen door zonder gaten", () => {
  lb._zonderGeoorloofd = false;
  const uit = lb.rangschik([rij("A", 10, {}), rij("B", 10, {}), rij("C", 10, { AB_NO: 1 }), rij("D", 10, {}, 2)]);
  assert.deepStrictEqual(kaal(uit.met).map((r) => `${r.plek} ${r.l.naam}`), ["1 A", "1 B", "2 D", "3 C"]);
});
