/* Excel visueler maken: echte Excel-grafieken en voorwaardelijke opmaak in een bestand van SheetJS.
 *
 * De gratis SheetJS-versie in de extensie schrijft geen grafieken of kleuren. Daarom pakken we het .xlsx na het
 * schrijven uit (XLSX.CFB) en voegen we de onderdelen toe die Excel zelf ook maakt:
 *  - voorwaardelijke opmaak: kleurschaal (rood-geel-groen) op percentages, databalken op aantallen;
 *  - grafieken (drawingML): staaf (bar/col, ook gestapeld) of lijn, verankerd naast de tabel.
 * Gebruik: const bytes = XlsxVisueel.maak(wb, { "Per vak": { kleurschaal: ["H2:H20"], balken: ["E2:E20"], grafieken: [{ … }] } });
 * grafiek: { type: "bar"|"col"|"line", titel, cat: "A2:A20", reeksen: [{ naam, val: "H2:H20", kleur }], pct, gestapeld,
 *            van: [kolom, rij], tot: [kolom, rij] }  (kolom/rij 0-based). Werkt ook in Node (tests). */
var XlsxVisueel = (() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const td = new TextDecoder("utf-8"), te = new TextEncoder();
  const KLEUREN = ["056DC2", "FF8A00", "13C4A3", "C70E13", "7B33FF", "818B98"];
  const voor = (xml, labels, nieuw) => {   // invoegen vóór het eerste van de gegeven elementen (schema-volgorde)
    let i = -1;
    for (const l of labels) { const j = xml.indexOf(l); if (j >= 0 && (i < 0 || j < i)) i = j; }
    if (i < 0) i = xml.lastIndexOf("</worksheet>");
    return xml.slice(0, i) + nieuw + xml.slice(i);
  };
  const ref = (blad, bereik) => {
    const [a, b] = bereik.split(":"), abs = (c) => c.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
    return `'${blad.replace(/'/g, "''")}'!${abs(a)}${b ? `:${abs(b)}` : ""}`;
  };
  const cellen = (ws, bereik) => {   // waarden uit het blad, voor de cache in de grafiek
    const r = XLSX.utils.decode_range(bereik), uit = [];
    for (let R = r.s.r; R <= r.e.r; R++) for (let C = r.s.c; C <= r.e.c; C++) { const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; uit.push(c ? c.v : ""); }
    return uit;
  };
  function cf(spec) {
    let p = 1, x = "";
    for (const s of spec.kleurschaal || []) x += `<conditionalFormatting sqref="${s}"><cfRule type="colorScale" priority="${p++}"><colorScale><cfvo type="num" val="0.6"/><cfvo type="num" val="0.8"/><cfvo type="num" val="0.95"/><color rgb="FFF8696B"/><color rgb="FFFFEB84"/><color rgb="FF63BE7B"/></colorScale></cfRule></conditionalFormatting>`;
    for (const s of spec.balken || []) x += `<conditionalFormatting sqref="${s}"><cfRule type="dataBar" priority="${p++}"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FF${spec.balkkleur || "F8696B"}"/></dataBar></cfRule></conditionalFormatting>`;
    for (const s of spec.balkenBlauw || []) x += `<conditionalFormatting sqref="${s}"><cfRule type="dataBar" priority="${p++}"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FF638EC6"/></dataBar></cfRule></conditionalFormatting>`;
    return x;
  }
  function grafiekXml(g, blad, ws) {
    const lijn = g.type === "line", dir = g.type === "col" || lijn ? "col" : "bar";
    const cat = cellen(ws, g.cat);
    const strCache = `<c:strCache><c:ptCount val="${cat.length}"/>${cat.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:strCache>`;
    const reeks = (r, i) => {
      const vals = cellen(ws, r.val), kleur = r.kleur || KLEUREN[i % KLEUREN.length];
      const opmaak = lijn ? `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${kleur}"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>`
        : `<c:spPr><a:solidFill><a:srgbClr val="${kleur}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`;
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(r.naam)}</c:v></c:tx>${opmaak}` +
        `<c:cat><c:strRef><c:f>${ref(blad, g.cat)}</c:f>${strCache}</c:strRef></c:cat>` +
        `<c:val><c:numRef><c:f>${ref(blad, r.val)}</c:f><c:numCache><c:formatCode>${g.pct ? "0%" : "General"}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, j) => (typeof v === "number" ? `<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>` : "")).join("")}</c:numCache></c:numRef></c:val>` +
        `${lijn ? '<c:smooth val="0"/>' : ""}</c:ser>`;
    };
    const series = g.reeksen.map(reeks).join("");
    const plot = lijn
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="101"/><c:axId val="102"/></c:lineChart>`
      : `<c:barChart><c:barDir val="${dir}"/><c:grouping val="${g.gestapeld ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${series}${g.gestapeld ? '<c:overlap val="100"/>' : '<c:gapWidth val="60"/>'}<c:axId val="101"/><c:axId val="102"/></c:barChart>`;
    const catPos = dir === "bar" ? "l" : "b", valPos = dir === "bar" ? "b" : "l";
    const tekst = (sz) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"/></a:pPr><a:endParaRPr lang="nl-NL"/></a:p></c:txPr>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/>` +
      `<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="nl-NL" sz="1200" b="1"/><a:t>${esc(g.titel)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` +
      `<c:plotArea><c:layout/>${plot}` +
      `<c:catAx><c:axId val="101"/><c:scaling><c:orientation val="${dir === "bar" ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${tekst(900)}<c:crossAx val="102"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="102"/><c:scaling><c:orientation val="minMax"/>${g.pct && !g.gestapeld ? '<c:max val="1"/><c:min val="0"/>' : '<c:min val="0"/>'}</c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E0E6EA"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${g.pct ? "0%" : "General"}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${tekst(900)}<c:crossAx val="101"/><c:crosses val="${dir === "bar" ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>` +
      `</c:plotArea>${g.reeksen.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : ""}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  }
  const anker = (g, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${g.van[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.van[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${g.tot[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.tot[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Grafiek ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

  function maak(wb, specs) {
    const CFB = XLSX.CFB;
    const cfb = CFB.read(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })), { type: "array" });
    const lees = (p) => { const e = CFB.find(cfb, p); return e ? td.decode(e.content) : null; };
    const zet = (p, t) => { const e = CFB.find(cfb, p); if (e) e.content = te.encode(t); else CFB.utils.cfb_add(cfb, p, te.encode(t)); };
    /* bladnaam → bestand */
    const boek = lees("/xl/workbook.xml"), rels = lees("/xl/_rels/workbook.xml.rels");
    const doel = {};
    for (const m of boek.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
      const t = (rels.match(new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${m[2]}"`)) || [])[1];
      if (t) doel[m[1].replace(/&apos;/g, "'").replace(/&amp;/g, "&")] = `/xl/${t.replace(/^\/?xl\//, "")}`;
    }
    let types = lees("/[Content_Types].xml"), dNr = 0, gNr = 0;
    for (const [blad, spec] of Object.entries(specs)) {
      const pad = doel[blad]; if (!pad) continue;
      let xml = lees(pad), ws = wb.Sheets[blad];
      const opmaak = cf(spec);
      if (opmaak) xml = voor(xml, ["<dataValidations", "<hyperlinks", "<printOptions", "<pageMargins", "<pageSetup", "<headerFooter", "<rowBreaks", "<colBreaks", "<ignoredErrors", "<drawing", "</worksheet>"], opmaak);
      if ((spec.grafieken || []).length) {
        dNr++;
        const gs = spec.grafieken, nrs = gs.map(() => ++gNr);
        nrs.forEach((n, i) => {
          zet(`/xl/charts/chart${n}.xml`, grafiekXml(gs[i], blad, ws));
          types = types.replace("</Types>", `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
        });
        zet(`/xl/drawings/drawing${dNr}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${gs.map(anker).join("")}</xdr:wsDr>`);
        zet(`/xl/drawings/_rels/drawing${dNr}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nrs.map((n, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/>`).join("")}</Relationships>`);
        types = types.replace("</Types>", `<Override PartName="/xl/drawings/drawing${dNr}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
        const relPad = pad.replace(/\/([^/]+)$/, "/_rels/$1.rels");
        let srels = lees(relPad) || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
        srels = srels.replace("</Relationships>", `<Relationship Id="rIdDtTek" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${dNr}.xml"/></Relationships>`);
        zet(relPad, srels);
        xml = voor(xml, ["<legacyDrawing", "<tableParts", "<extLst", "</worksheet>"], '<drawing r:id="rIdDtTek"/>');
      }
      zet(pad, xml);
    }
    zet("/[Content_Types].xml", types);
    const merk = cfb.FullPaths.findIndex((p) => /Sh33tJ5$/.test(p));
    if (merk >= 0) CFB.utils.cfb_del(cfb, cfb.FullPaths[merk]);
    return new Uint8Array(CFB.write(cfb, { fileType: "zip", type: "array", compression: true }));
  }
  function download(bytes, naam) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a"); a.href = url; a.download = naam; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return { maak, download };
})();
if (typeof module !== "undefined") module.exports = XlsxVisueel;
