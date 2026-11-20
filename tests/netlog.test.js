/* De brug in de pagina (content/netlog.js): welke adressen hij ophaalt, aan wie hij de netwerklog geeft en hoe
 * hij weekrapporten optelt voor een eigen periode. */
const { test, beforeEach } = require("node:test"), assert = require("node:assert");
const { laad, tik } = require("./hulp");

const location = { href: "https://school.magister.net/op/#/x", host: "school.magister.net", origin: "https://school.magister.net", pathname: "/op/" };
let handlers, posted, fetched, fetchImpl, win, document;

beforeEach(() => {
  handlers = []; posted = []; fetched = [];
  fetchImpl = async () => new Response("{}", { status: 200 });
  win = { addEventListener: (t, h) => { if (t === "message") handlers.push(h); }, postMessage: (m, o) => posted.push({ m, o }),
    fetch: (u, i) => { fetched.push({ u: String(u.url || u), i }); return fetchImpl(String(u.url || u), i); } };
  win.top = win; win.window = win;
  function XHR() {} XHR.prototype.open = XHR.prototype.send = XHR.prototype.setRequestHeader = function () {};
  document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  laad("content/netlog.js", { window: win, location, document, XMLHttpRequest: XHR, FileReader: function () {} });
});

async function stuur(data, { origin = location.origin, source } = {}) {
  const antwoorden = [];
  const src = source || { location, postMessage: (m, o) => antwoorden.push({ m, o }) };
  for (const h of handlers) await h({ data, origin, source: src });
  await tik();
  return antwoorden;
}
const rapport = (extra) => ({ totals: { approved: 2, notApproved: 1, percentage: 50 }, items: [{ student: { id: 4711, studentNumber: 90001, name: "A" }, approved: 2, notApproved: 1, percentage: 50 }, ...(extra ? [{ student: { id: 5, name: "B" }, approved: 1, notApproved: 0 }] : [])] });
const WEEK45 = "https://attendance.magister.net/api/v2/report/year/2026/week/45/role/mentor";
const drieWeken = { start: new Date(2026, 10, 2).getTime(), end: new Date(2026, 10, 22, 23, 59, 59).getTime() };   // weken 45, 46 en 47
async function zetPeriode() {
  document.querySelector = (s) => (s === "att-insights-page" ? { selectedPeriod: "week", debounceNavigation: async () => {} } : null);
  const r = await stuur({ type: "dt:periode:set", id: "p", target: "att-insights-page", periode: drieWeken });
  assert.strictEqual(r[0].m.ok, true);
  fetched.length = 0; posted.length = 0;
}

test("de brug weigert een adres buiten Magister en doet dan geen aanvraag", async () => {
  const r = await stuur({ type: "dt:api:get", id: "1", url: "https://kwaad.example/steel", full: true });
  assert.strictEqual(r[0].m.status, 0); assert.match(r[0].m.error, /geweigerd/); assert.strictEqual(fetched.length, 0);
});

test("Magisters inlogheaders gaan alleen mee naar het eigen schooldomein", async () => {
  await win.fetch("https://school.magister.net/api/account", { headers: { Authorization: "Bearer GEHEIM" } });
  fetched.length = 0;
  await stuur({ type: "dt:api:get", id: "2", url: "https://attendance.magister.net/api/v2/x", full: true });
  assert.ok(!Object.keys(fetched[0].i.headers).some((k) => /authorization/i.test(k)), "geen Authorization naar een ander subdomein");
  fetched.length = 0;
  const r = await stuur({ type: "dt:api:get", id: "3", url: "/api/leerlingen/1", full: true });
  assert.strictEqual(fetched[0].i.headers.authorization, "Bearer GEHEIM"); assert.strictEqual(r[0].m.status, 200);
});

test("een verzoek van een andere site wordt genegeerd", async () => {
  const vreemd = { get location() { throw new Error("cross-origin"); }, postMessage() { assert.fail("geen antwoord verwacht"); } };
  await stuur({ type: "dt:api:get", id: "4", url: "/api/leerlingen/1", full: true }, { origin: "https://kwaad.example", source: vreemd });
  await stuur({ type: "dt:netlog:get" }, { origin: "https://kwaad.example", source: vreemd });
  assert.strictEqual(fetched.length, 0);
});

test("de netwerklog gaat gericht naar het eigen venster, zonder zoektermen en klasnamen", async () => {
  await win.fetch("https://school.magister.net/api/leerlingen/zoeken?q=Jansen&top=50&klassen=MR1A", { headers: { a: "b" } });
  await tik();
  const r = await stuur({ type: "dt:netlog:get" });
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].o, location.origin);
  const urls = r[0].m.log.map((x) => x.url).join("\n");
  assert.doesNotMatch(urls, /Jansen|MR1A/); assert.match(urls, /zoeken\?q=\{…\}/);
});

test("eigen periode: aantallen worden opgeteld, id's, stamnummers en percentages niet", async () => {
  await zetPeriode();
  let n = 0; fetchImpl = async () => new Response(JSON.stringify(rapport(n++ === 0)), { status: 200 });
  const j = await (await win.fetch(WEEK45, {})).json();
  assert.strictEqual(fetched.length, 3, "één aanvraag per week");
  const a = j.items.find((x) => x.student.name === "A");
  assert.deepStrictEqual([a.approved, a.notApproved, a.student.id, a.student.studentNumber, a.percentage], [6, 3, 4711, 90001, 50]);
  assert.deepStrictEqual([j.totals.approved, j.totals.notApproved, j.itemCount], [6, 3, 2]);
});

test("eigen periode: mislukt één week, dan geen halve som maar een melding en weer Magisters eigen week", async () => {
  await zetPeriode();
  fetchImpl = async (u) => (/week\/46/.test(u) ? new Response("", { status: 403 }) : new Response(JSON.stringify(rapport(false)), { status: 200 }));
  const j = await (await win.fetch(WEEK45, {})).json();
  const fout = posted.find((p) => p.m.type === "dt:periode:fout");
  assert.ok(fout, "melding dt:periode:fout"); assert.strictEqual(fout.m.status, 403); assert.strictEqual(fout.o, location.origin);
  assert.strictEqual(j.items[0].approved, 2, "het antwoord is de gewone week, niet een deel van de som");
  fetched.length = 0; await win.fetch(WEEK45, {});
  assert.strictEqual(fetched.length, 1, "de periode is losgelaten");
});

test("een periode loslaten lukt ook als het onderdeel al van de pagina is", async () => {
  const r = await stuur({ type: "dt:periode:set", id: "p", target: "att-insights-page", herstel: false, periode: null });
  assert.strictEqual(r[0].m.ok, true);
});
