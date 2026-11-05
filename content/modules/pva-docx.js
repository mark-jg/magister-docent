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
        if (ll[4]?.tekst) c = zetTekst(c, ll[4].tekst);   // vrije tekst uit het profiel (vervangt de hele cel)
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

  /* ================= Eigen sjabloon met plaatshouders ================= */
  /* {veld}            tekst, bijvoorbeeld {naam}, {klas}, {toelichting}, {woorden.waardoor}
   * {x:sleutel}       vakje: ☒ als aangevinkt, anders ☐ ({x:ouders}, {x:reden.verzuim}, {x:stap.brief1})
   * {doel.doel} …     in een tabelrij: die rij herhaalt voor elk doel; zo ook actie., vak., basis., evaluatie.
   * ctx = { velden: {sleutel: tekst}, vinkjes: {sleutel: true}, rijen: {doel: [{…, x: {…}}], …} } */
  const PH = /\{(x:)?([\p{L}0-9_.-]+)\}/gu;
  function samenvoegen(xml) {   // Word knipt {naam} soms over meerdere runs: dan de alinea tot één run maken
    return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
      if (!p.includes("{")) return p;
      const runs = delen(p, R), totaal = tekstVan(p);
      const heel = (totaal.match(PH) || []).length; if (!heel) return p;
      const los = runs.reduce((n, r) => n + (tekstVan(r.xml).match(PH) || []).length, 0);
      if (los === heel) return p;
      const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
      const eerste = runs.find((r) => /<w:t[ >]/.test(r.xml)) || runs[0];
      const rPr = ((eerste && eerste.xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)) || [""])[0];
      const open = p.match(/^<w:p[^>]*>/)[0];
      return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(totaal)}</w:t></w:r></w:p>`;
    });
  }
  function invullen(xml, velden, vinkjes) {
    return xml.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (m, a, t, b) => {
      if (!t.includes("{")) return m;
      const nieuw = t.replace(PH, (ph, x, k) => {
        if (x) return vinkjes[k] ? "☒" : "☐";
        if (!(k in velden)) return ph;
        return esc(velden[k] ?? "").split("\n").join(`${b}<w:br/>${a.replace(/<w:t(?: [^>]*)?>/, '<w:t xml:space="preserve">')}`);
      });
      return `${a.replace(/<w:t(?: [^>]*)?>/, '<w:t xml:space="preserve">')}${nieuw}${b}`;
    });
  }
  function vulSjabloonXml(xml, ctx) {
    xml = samenvoegen(xml);
    const prefixen = Object.keys(ctx.rijen || {});
    xml = xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (tr) => {
      const pre = prefixen.find((p) => tr.includes(`{${p}.`) || tr.includes(`{x:${p}.`));
      if (!pre) return tr;
      const items = ctx.rijen[pre] || [];
      if (!items.length) return invullen(tr, new Proxy({}, { has: (_, k) => k.startsWith(`${pre}.`), get: () => "" }), {});
      return items.map((it) => {
        const v = Object.fromEntries(Object.entries(it).filter(([k]) => k !== "x").map(([k, w]) => [`${pre}.${k}`, w]));
        const x = Object.fromEntries(Object.entries(it.x || {}).map(([k, w]) => [k, w]));
        const alle = Object.assign({}, ctx.velden, v);   // ontbrekende velden van deze rij worden leeg
        return invullen(tr, new Proxy(alle, { has: (o, k) => k in o || k.startsWith(`${pre}.`), get: (o, k) => o[k] ?? "" }), Object.assign({}, ctx.vinkjes, x));
      }).join("");
    });
    return invullen(xml, ctx.velden || {}, ctx.vinkjes || {});
  }
  function sjabloon(bytes, ctx, CFB = (typeof XLSX !== "undefined" ? XLSX.CFB : null)) {
    const cfb = CFB.read(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { type: "array" });
    for (const pad of cfb.FullPaths) {
      if (!/\/word\/(document|header\d*|footer\d*)\.xml$/.test(pad)) continue;
      const e = CFB.find(cfb, pad.replace(/^Root Entry/, ""));
      if (!e || !e.content) continue;
      e.content = new TextEncoder().encode(vulSjabloonXml(new TextDecoder("utf-8").decode(e.content), ctx));
    }
    return schoon(cfb, CFB);
  }
  function schoon(cfb, CFB) {
    const merk = cfb.FullPaths.findIndex((p) => /Sh33tJ5$/.test(p));
    if (merk >= 0) CFB.utils.cfb_del(cfb, cfb.FullPaths[merk]);
    return new Uint8Array(CFB.write(cfb, { fileType: "zip", type: "array", compression: true }));
  }

  /* ================= Standaard-Word (zonder eigen sjabloon) ================= */
  /* Bouwt een net Word-document met plaatshouders op basis van het profiel; vullen gaat daarna met sjabloon().
   * Hetzelfde document is het voorbeeldsjabloon dat een school in de eigen huisstijl kan opmaken. */
  function standaardSjabloon(profiel, soortId, CFB = (typeof XLSX !== "undefined" ? XLSX.CFB : null)) {
    const soort = (profiel.soorten || {})[soortId] || { naam: "Plan van aanpak" }, traject = soortId !== "algemeen";
    const W = 9638;
    const run = (t, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}<w:color w:val="${o.kleur || "222222"}"/><w:sz w:val="${o.sz || 19}"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
    const p = (t, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.voor || 0}" w:after="${o.na ?? 40}"/></w:pPr>${[].concat(t).map((x) => (typeof x === "string" ? run(x, o) : run(x.t, Object.assign({}, o, x)))).join("")}</w:p>`;
    const kop = (nr, t) => p([{ t: ` ${nr} ` , b: true, kleur: "FFFFFF" }, { t: `  ${t}`, b: true }], { sz: 24, voor: 240, na: 80 }).replace("<w:r><w:rPr>", '<w:r><w:rPr><w:shd w:val="clear" w:color="auto" w:fill="222222"/>');
    const rand = '<w:tcBorders><w:top w:val="single" w:sz="4" w:color="C8C8C8"/><w:bottom w:val="single" w:sz="4" w:color="C8C8C8"/><w:left w:val="nil"/><w:right w:val="nil"/></w:tcBorders>';
    const cel = (inhoud, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${rand}${o.grijs ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ""}<w:tcMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/></w:tcMar></w:tcPr>${[].concat(inhoud).map((x) => (x.startsWith("<w:p") ? x : p(x, o))).join("")}</w:tc>`;
    const tabel = (breedtes, rijen) => `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${breedtes.map((b) => `<w:gridCol w:w="${b}"/>`).join("")}</w:tblGrid>${rijen.map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r}</w:tr>`).join("")}</w:tbl>`;
    const label = (t, w) => cel(t, w, { kleur: "555555", sz: 18 });
    const vinkLijst = (lijst) => lijst.map(([k, t]) => `{x:${k}} ${t}`).join("     ");
    const kolommen = profiel.kolommen || [];
    const delen = [];
    delen.push(p(soort.naam || "Plan van aanpak", { b: true, sz: 40, na: 0 }), p("{naam}", { sz: 30, kleur: "6B6B6B", voor: 40, na: 20 }),
      p([profiel.school, profiel.naam].filter(Boolean).join(" · "), { sz: 18, kleur: "6B6B6B", na: 120 }));
    // 1 Gegevens
    const g = [[["Naam", "{naam}"], ["Studentnummer", "{studentnummer}"]], [["Klas", "{klas}"], ["Geboortedatum", "{geboortedatum}"]], [["SLB", "{slb}"], ["Datum gesprek", "{datum}"]]];
    if (traject) g.push([["Opleidingsmanager", "{opleidingsmanager}"], ["Begeleidingscoach", "{begeleidingscoach}"]]);
    delen.push(kop(1, "Gegevens"), tabel([1800, 3019, 1800, 3019], [
      ...g.map(([[a, b], [c, d]]) => label(a, 1800) + cel(b, 3019) + label(c, 1800) + cel(d, 3019)),
      label("Aanwezig", 1800) + cel("{x:student} student     {x:ouders} ouder(s)/verzorger(s)     {x:collega} collega: {collega}", 7838, { span: 3 }),
    ]));
    // 2 Aanleiding
    const aanleiding = [];
    if (traject && (soort.stappen || []).length) aanleiding.push(label("Stap", 1800) + cel(vinkLijst(soort.stappen.map(([k, t]) => [`stap.${k}`, t])), 7838));
    aanleiding.push(label("Reden", 1800) + cel(`${vinkLijst((profiel.redenen || []).map(([k, t]) => [`reden.${k}`, t]))}${(profiel.redenen || []).some(([k]) => k === "anders") ? ": {anders}" : ""}`, 7838));
    aanleiding.push(label("Toelichting", 1800) + cel("{toelichting}", 7838));
    delen.push(kop(2, "Aanleiding"), tabel([1800, 7838], aanleiding));
    // 3 Waar sta je nu
    delen.push(kop(3, "Waar sta je nu"));
    if ((profiel.leerlijnen || []).length) {
      const rest = W - 2600 - 1300, kb = kolommen.length ? Math.floor((rest - 2200) / kolommen.length) : 0, vb = rest - kb * kolommen.length;
      const br = [2600, 1300, vb, ...kolommen.map(() => kb)];
      delen.push(p(profiel.leerlijnenTitel || "Leerlijnen en vakken", { b: true, voor: 60 }), tabel(br, [
        ["Leerlijn", "Stand", "Vak", ...kolommen].map((t, i) => cel(t, br[i], { b: true, sz: 17, grijs: true })).join(""),
        cel("{vak.leerlijn}", br[0]) + cel("{vak.stand}", br[1]) + cel("{vak.naam}", br[2]) + kolommen.map((_, i) => cel(`{vak.k${i + 1}}`, kb)).join(""),
      ]));
    }
    if ((profiel.basis || []).length) {
      delen.push(p(profiel.basisTitel || "Basisvaardigheden", { b: true, voor: 120 }), tabel([2400, 2600, 2300, 2338], [
        ["Vak", "Getoetst tot nu toe", "Behaald", "Stand"].map((t, i) => cel(t, [2400, 2600, 2300, 2338][i], { b: true, sz: 17, grijs: true })).join(""),
        cel("{basis.naam}", 2400) + cel("{basis.getoetst}", 2600) + cel("{basis.behaald}", 2300) + cel("{basis.stand}", 2338),
      ]));
    }
    delen.push(tabel([1800, 7838], [label("Aanwezigheid", 1800) + cel("{aanwezigheid}", 7838)]));
    // 4 Doelen, 5 Acties
    delen.push(kop(4, "Wat ga je behalen"), tabel([4400, 3400, 1838], [
      ["Doel", "Waaraan zie je het", "Uiterlijk"].map((t, i) => cel(t, [4400, 3400, 1838][i], { b: true, sz: 17, grijs: true })).join(""),
      cel("{doel.doel}", 4400) + cel("{doel.bewijs}", 3400) + cel("{doel.uiterlijk}", 1838)]));
    delen.push(kop(5, "Acties en afspraken"), tabel([1800, 5838, 2000], [
      ["Wie", "Doet wat", "Wanneer"].map((t, i) => cel(t, [1800, 5838, 2000][i], { b: true, sz: 17, grijs: true })).join(""),
      cel("{actie.wie}", 1800) + cel("{actie.wat}", 5838) + cel("{actie.wanneer}", 2000)]));
    // 6 In jouw woorden
    delen.push(kop(6, "In jouw woorden"), tabel([W], [
      ["Waardoor loopt het nu niet zoals je wilt?", "waardoor"], ["Wat ga jij vanaf nu anders doen?", "anders"], ["Wat heb je nodig van school of van thuis?", "nodig"],
    ].map(([v, k]) => cel([p(v, { b: true, sz: 18 }), p(`{woorden.${k}}`)], W))));
    // 7 Evaluatie
    const vervolg = traject && soort.vervolg ? "{x:vervolg.afsluiten} afsluiten     {x:vervolg.nieuw} nieuw plan     {x:vervolg.volgende} volgende stap" : "{evaluatie.afspraak}";
    delen.push(kop(7, "Evaluatie"), tabel([1800, 3600, 4238], [
      ["Datum", "Doelen", traject && soort.vervolg ? "Vervolg" : "Afspraak en vervolg"].map((t, i) => cel(t, [1800, 3600, 4238][i], { b: true, sz: 17, grijs: true })).join(""),
      cel("{evaluatie.datum}", 1800) + cel("{x:evaluatie.behaald} behaald     {x:evaluatie.deels} deels     {x:evaluatie.niet} niet", 3600) + cel(vervolg.replace(/\{x:vervolg\./g, "{x:evaluatie.vervolg."), 4238)]));
    // 8 Akkoord
    const teken = (wie, naam) => cel([p(wie, { b: true, sz: 18 }), p(`Naam: ${naam}`, { sz: 17, kleur: "555555" }), p("Datum en handtekening", { sz: 17, kleur: "555555", na: 400 })], 4819);
    delen.push(kop(8, "Akkoord"), tabel([4819, 4819], [teken("Student", "{naam}") + teken("Ouder/verzorger (bij minderjarige)", "{ouder}"),
      teken("Studieloopbaanbegeleider", "{slb}") + (traject ? teken("Opleidingsmanager", "{opleidingsmanager}") : cel("", 4819))]));
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${delen.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const bestanden = {
      "/[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      "/_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      "/word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      "/word/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="19"/><w:lang w:val="nl-NL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>',
      "/docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(soort.naam || "Plan van aanpak")}</dc:title></cp:coreProperties>`,
      "/word/document.xml": doc,
    };
    const cfb = CFB.utils.cfb_new();
    for (const [pad, tekst] of Object.entries(bestanden)) CFB.utils.cfb_add(cfb, pad, new TextEncoder().encode(tekst));
    return schoon(cfb, CFB);
  }

  return { vul, vulDocument, tekstVan, sjabloon, standaardSjabloon, vulSjabloonXml };
})();
if (typeof module !== "undefined") module.exports = PvaDocx;
