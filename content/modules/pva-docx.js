/* Plan van aanpak als Word-document: vult de eigen templates van de opleiding in (assets/pva/*.docx).
 *
 * De templates blijven zoals ze zijn (kop, logo, voettekst, opmaak); alleen de lege cellen, de vakjes (☐ → ☒) en
 * de stippellijntjes worden ingevuld. Werkt op de tekst van word/document.xml, zonder XML-bibliotheek, en pakt
 * het document in en uit met SheetJS (XLSX.CFB, al aanwezig in de extensie). Ook in Node te gebruiken (tests). */
var PvaDocx = (() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tekstVan = (xml) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  /* Delen van een stuk XML (tabellen, rijen, cellen, alinea's, runs) als [{a, b, xml}]; geen nesting in deze templates. */
  const delen = (xml, re) => [...xml.matchAll(re)].map((m) => ({ a: m.index, b: m.index + m[0].length, xml: m[0] }));
  const TBL = /<w:tbl>[\s\S]*?<\/w:tbl>/g, TR = /<w:tr[ >][\s\S]*?<\/w:tr>/g, TC = /<w:tc>[\s\S]*?<\/w:tc>/g,
    P = /<w:p\/>|<w:p[ >][\s\S]*?<\/w:p>/g, R = /<w:r>[\s\S]*?<\/w:r>|<w:r [\s\S]*?<\/w:r>/g;
  /* Vervang delen (van achter naar voren, zodat de posities kloppen). */
  const vervangDelen = (xml, lijst) => lijst.slice().sort((x, y) => y.a - x.a).reduce((s, d) => s.slice(0, d.a) + d.nieuw + s.slice(d.b), xml);

  /* Tekst in alinea pIndex van een cel; meerdere regels worden losse alinea's met dezelfde opmaak. Grijze
   * cursieve hulptekst wordt gewone zwarte tekst. */
  function zetTekst(tc, tekst, pIndex = 0) {
    if (tekst == null || String(tekst).trim() === "") return tc;
    const ps = delen(tc, P), p = ps[pIndex] || ps[ps.length - 1];
    if (!p) return tc;
    const pPr = (p.xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
    let rPr = (p.xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
    rPr = rPr.replace(/<w:i\/>|<w:iCs\/>/g, "").replace(/<w:color w:val="[^"]*"\/>/, '<w:color w:val="000000"/>');
    const nieuw = String(tekst).split("\n").map((r) => `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(r)}</w:t></w:r></w:p>`).join("");
    return vervangDelen(tc, [{ ...p, nieuw }]);
  }
  /* Vakjes aanvinken: ☐ wordt ☒ als de tekst erna begint met een van de labels. invul vult de stippellijn
   * na een label in (bijv. "collega:" → naam). */
  function vink(tc, labels = [], invul = {}) {
    const runs = delen(tc, R), wijzig = [];
    runs.forEach((r, i) => {
      const t = tekstVan(r.xml);
      if (t.trim() === "☐") {
        const volgende = tekstVan(runs[i + 1]?.xml || "").trim().toLowerCase();
        if (labels.some((l) => l && volgende.startsWith(String(l).toLowerCase()))) wijzig.push({ ...r, nieuw: r.xml.replace("☐", "☒") });
      } else {
        for (const [sleutel, waarde] of Object.entries(invul)) {
          if (waarde && t.includes(sleutel) && /…+/.test(t)) wijzig.push({ ...r, nieuw: r.xml.replace(/…+/, esc(waarde)) });
        }
      }
    });
    return vervangDelen(tc, wijzig);
  }
  const vervangTekst = (xml, van, naar) => naar == null || naar === "" ? xml : xml.split(esc(van)).join(esc(naar));

  /* Bewerk tabel ti: fn krijgt de rijen als arrays van cel-XML en mag die aanpassen (of rijen toevoegen). */
  function bewerkTabel(xml, ti, fn) {
    const tbl = delen(xml, TBL)[ti];
    if (!tbl) return xml;
    const rijen = delen(tbl.xml, TR).map((tr) => ({ tr, cellen: delen(tr.xml, TC).map((c) => c.xml) }));
    const uit = fn(rijen.map((r) => r.cellen), rijen) || null;
    let nieuweTbl = vervangDelen(tbl.xml, rijen.map((r) => {
      const cs = delen(r.tr.xml, TC);
      return { ...r.tr, nieuw: vervangDelen(r.tr.xml, cs.map((c, i) => ({ ...c, nieuw: r.cellen[i] }))) };
    }));
    if (uit && uit.extraNa != null) {   // extra rijen (kopie van een bestaande rij) achter rij extraNa
      const plek = delen(nieuweTbl, TR)[uit.extraNa];
      nieuweTbl = nieuweTbl.slice(0, plek.b) + uit.extra.join("") + nieuweTbl.slice(plek.b);
    }
    return xml.slice(0, tbl.a) + nieuweTbl + xml.slice(tbl.b);
  }
  /* Een rij met n kolommen vullen; extra rijen worden een kopie van de laatste lege rij. */
  function vulLijst(xml, ti, items, kolommen, eersteRij = 1) {
    return bewerkTabel(xml, ti, (rijen, ruw) => {
      const leeg = ruw[ruw.length - 1].tr.xml, extra = [];
      items.forEach((it, i) => {
        const vul = (cellen) => kolommen.forEach((k, ci) => { cellen[ci] = zetTekst(cellen[ci], it[k]); });
        if (eersteRij + i < rijen.length) vul(rijen[eersteRij + i]);
        else {
          const cs = delen(leeg, TC).map((c) => c.xml), tr = delen(leeg, TC);
          // de kopie begint leeg: wis eerst de tekst van de bron
          const leegCs = cs.map((c) => c.replace(/(<w:t(?: [^>]*)?>)[^<]*(<\/w:t>)/g, "$1$2"));
          vul(leegCs);
          extra.push(vervangDelen(leeg, tr.map((c, ci) => ({ ...c, nieuw: leegCs[ci] }))));
        }
      });
      return extra.length ? { extraNa: rijen.length - 1, extra } : null;
    });
  }
  const rijMet = (rijen, begin) => rijen.find((c) => tekstVan(c[0] || "").trim().startsWith(begin));

  /* d: zie cb.js (pvaLeeg) voor alle velden. bbm = template Blijf Bij Ma. */
  function vulDocument(xml, d) {
    const bbm = d.soort === "bbm";
    xml = xml.replace(">Naam student<", `>${esc(d.naam || "Naam student")}<`);
    // 1 Gegevens
    xml = bewerkTabel(xml, 0, (rijen) => {
      const zet = (begin, links, rechts) => { const r = rijMet(rijen, begin); if (r) { r[1] = zetTekst(r[1], links); if (r.length > 3) r[3] = zetTekst(r[3], rechts); } };
      zet("Naam", d.naam, d.stamnr); zet("Klas", d.klas, d.geboortedatum); zet("SLB", d.slb, d.datumTekst);
      if (bbm) zet("Opleidingsmanager", d.om, d.coach);
      const a = rijMet(rijen, "Aanwezig");
      if (a) a[1] = vink(a[1], [d.aanwezig?.student && "student", d.aanwezig?.ouders && "ouder", d.aanwezig?.collega && "collega"], { "collega:": d.aanwezig?.collega });
    });
    // 2 Aanleiding
    xml = bewerkTabel(xml, 1, (rijen) => {
      const stap = rijMet(rijen, "Stap");
      if (stap) stap[1] = vink(stap[1], [{ brief1: "brief 1", brief2: "brief 2", brief3: "brief 3", vsa: "na negatief" }[d.stap]]);
      const reden = rijMet(rijen, "Reden");
      if (reden) reden[1] = vink(reden[1], (d.redenen || []).map((r) => ({ voortgang: "studievoortgang", verzuim: "verzuim", werkhouding: "inzet", afspraken: "afspraken", anders: "anders" })[r]), { "anders:": d.anders });
      const t = rijMet(rijen, "Toelichting");
      if (t) t[1] = zetTekst(t[1], d.toelichting);
    });
    // 3 Waar sta je nu: beroepsleerlijnen en vakken
    xml = bewerkTabel(xml, 2, (rijen) => {
      const ll = d.leerlijnen || {};
      for (const [nr, rij] of [[1, rijen[1]], [2, rijen[2]], [3, rijen[3]]]) {
        if (!rij) continue; rij[1] = zetTekst(rij[1], ll[nr]?.stand); rij[4] = zetTekst(rij[4], ll[nr]?.iw);
      }
      const r4 = rijMet(rijen, "4."); if (r4) {
        r4[1] = zetTekst(r4[1], ll[4]?.stand);
        let c = r4[2];
        if (ll[4]?.iwVoldaan !== "" && ll[4]?.iwVoldaan != null) c = c.replace(/…( van 9)/, `${esc(ll[4].iwVoldaan)}$1`);
        if (d.pct != null) c = c.replace(/…%/, `${esc(d.pct)}%`);
        r4[2] = c;
      }
      const r5 = rijMet(rijen, "5."); if (r5) r5[1] = zetTekst(r5[1], ll[5]?.stand);
      for (const rij of rijen) {
        const vak = tekstVan(rij[2] || "").trim(), v = (d.vakken || {})[vak];
        if (v && rij.length >= 5) { rij[3] = zetTekst(rij[3], v.vv); rij[4] = zetTekst(rij[4], v.iw); }
      }
    });
    // Basisvaardigheden
    xml = bewerkTabel(xml, 3, (rijen) => {
      for (const vak of ["Nederlands", "Rekenen", "Engels"]) {
        const r = rijMet(rijen, vak), b = (d.basis || {})[vak];
        if (r && b) { r[1] = zetTekst(r[1], b.getoetst); r[2] = zetTekst(r[2], b.behaald); r[3] = zetTekst(r[3], b.stand); }
      }
    });
    xml = bewerkTabel(xml, 4, (rijen) => { const r = rijMet(rijen, "Aanwezigheid"); if (r) r[1] = zetTekst(r[1], d.aanwezigheid); });
    // 4 Doelen, 5 Acties
    xml = vulLijst(xml, 5, (d.doelen || []).filter((x) => x.doel || x.bewijs || x.uiterlijk), ["doel", "bewijs", "uiterlijk"]);
    xml = vulLijst(xml, 6, (d.acties || []).filter((x) => x.wat || x.wanneer), ["wie", "wat", "wanneer"]);
    // 6 In jouw woorden
    xml = bewerkTabel(xml, 7, (rijen) => {
      ["waardoor", "anders", "nodig"].forEach((k, i) => { if (rijen[i]) rijen[i][0] = zetTekst(rijen[i][0], d.woorden?.[k], 1); });
    });
    // 7 Evaluatie
    xml = bewerkTabel(xml, 8, (rijen) => {
      (d.evaluaties || []).forEach((e, i) => {
        const r = rijen[i + 1]; if (!r) return;
        r[0] = zetTekst(r[0], e.datumTekst);
        r[1] = vink(r[1], [e.doelen]);
        r[2] = bbm ? vink(r[2], [{ afsluiten: "afsluiten", nieuw: "nieuw plan", volgende: "volgende brief" }[e.vervolg]]) : zetTekst(r[2], e.afspraak);
      });
    });
    // 8 Akkoord: namen achter "Naam"
    xml = bewerkTabel(xml, 9, (rijen) => {
      const namen = { "Student": d.naam, "Ouder/verzorger": d.ouderNaam, "Studieloopbaanbegeleider": d.slb, "Opleidingsmanager": d.stap === "brief3" ? d.om : "" };
      for (const rij of rijen) for (let i = 0; i < rij.length; i++) {
        const kop = tekstVan(rij[i]).trim();
        const k = Object.keys(namen).find((x) => kop.startsWith(x));
        if (k && namen[k]) {
          const ps = delen(rij[i], P), p = ps.find((x) => tekstVan(x.xml).trim() === "Naam");
          if (p) rij[i] = vervangDelen(rij[i], [{ ...p, nieuw: p.xml.replace(">Naam<", `>Naam: ${esc(namen[k])}<`) }]);
        }
      }
    });
    return xml;
  }

  /* bytes: Uint8Array/ArrayBuffer van het template → Uint8Array van het ingevulde document. */
  function vul(bytes, d, CFB = (typeof XLSX !== "undefined" ? XLSX.CFB : null)) {
    if (!CFB) throw new Error("SheetJS (XLSX.CFB) ontbreekt");
    const cfb = CFB.read(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { type: "array" });
    const e = CFB.find(cfb, "/word/document.xml");
    const xml = new TextDecoder("utf-8").decode(e.content);
    e.content = new TextEncoder().encode(vulDocument(xml, d));
    // titel in de documenteigenschappen
    const core = CFB.find(cfb, "/docProps/core.xml");
    if (core) {
      const c = new TextDecoder("utf-8").decode(core.content).replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${esc(`Plan van aanpak ${d.naam || ""}`)}</dc:title>`);
      core.content = new TextEncoder().encode(c);
    }
    // SheetJS voegt een eigen markeringsbestand toe; dat hoort niet in een Word-document
    const merk = cfb.FullPaths.findIndex((p) => /Sh33tJ5$/.test(p));
    if (merk >= 0) CFB.utils.cfb_del(cfb, cfb.FullPaths[merk]);
    return new Uint8Array(CFB.write(cfb, { fileType: "zip", type: "array", compression: true }));
  }

  return { vul, vulDocument, tekstVan };
})();
if (typeof module !== "undefined") module.exports = PvaDocx;
