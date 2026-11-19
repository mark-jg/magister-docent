/* De zelf-updater (options/updater.js): zip lezen en het controlegetal van de download. */
const { test } = require("node:test"), assert = require("node:assert"), zlib = require("node:zlib"), crypto = require("node:crypto");
const { laad, kaal } = require("./hulp");

const ctx = laad("options/updater.js", { DecompressionStream: globalThis.DecompressionStream, Blob: globalThis.Blob });
const { dtUnzip, dtSha256, dtShaUitBestand } = ctx;

/* Kleine zip met één opgeslagen en één gecomprimeerd bestand, hier met de hand opgebouwd. */
function zip(bestanden) {
  const delen = [], centraal = []; let positie = 0;
  for (const [naam, tekst, comprimeer] of bestanden) {
    const n = Buffer.from(naam), ruw = Buffer.from(tekst), data = comprimeer ? zlib.deflateRawSync(ruw) : ruw;
    const kop = Buffer.alloc(30); kop.writeUInt32LE(0x04034b50, 0); kop.writeUInt16LE(comprimeer ? 8 : 0, 8); kop.writeUInt32LE(data.length, 18); kop.writeUInt32LE(ruw.length, 22); kop.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(comprimeer ? 8 : 0, 10); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(ruw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(positie, 42);
    delen.push(kop, n, data); centraal.push(c, n); positie += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centraal), eind = Buffer.alloc(22);
  eind.writeUInt32LE(0x06054b50, 0); eind.writeUInt16LE(bestanden.length, 8); eind.writeUInt16LE(bestanden.length, 10); eind.writeUInt32LE(cd.length, 12); eind.writeUInt32LE(positie, 16);
  const b = Buffer.concat([...delen, cd, eind]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test("zip uitpakken: opgeslagen en gecomprimeerde bestanden, mappen overgeslagen", async () => {
  const lang = "regel\n".repeat(500);
  const files = await dtUnzip(zip([["map/", "", false], ["map/manifest.json", '{"version":"1.0.0"}', false], ["map/content/core.js", lang, true]]));
  assert.deepStrictEqual(kaal(files.map((f) => f.name)), ["map/manifest.json", "map/content/core.js"]);
  assert.strictEqual(new TextDecoder().decode(files[1].data), lang);
});

test("zip uitpakken: een afgekapt bestand wordt geweigerd", async () => {
  const heel = zip([["a.txt", "hallo", false]]);
  await assert.rejects(() => dtUnzip(heel.slice(0, heel.byteLength - 10)), /geen geldig zip-bestand/);
});

test("controlegetal: SHA-256 klopt met Node, en één gewijzigde byte valt op", async () => {
  const buf = zip([["a.txt", "hallo", false]]);
  const verwacht = crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");
  assert.strictEqual(await dtSha256(buf), verwacht);
  const stuk = buf.slice(0); new Uint8Array(stuk)[40] ^= 1;
  assert.notStrictEqual(await dtSha256(stuk), verwacht);
});

test("controlegetal uit het .sha256-bestand van de release", () => {
  const hex = "a".repeat(64);
  assert.strictEqual(dtShaUitBestand(`${hex.toUpperCase()}  magister-docent-tools-v1.zip\n`), hex);
  assert.strictEqual(dtShaUitBestand("Not Found"), null);
  assert.strictEqual(dtShaUitBestand(""), null);
});
