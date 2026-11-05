/* Magisters eigen formulieren vooraf invullen: een logboekitem (Begeleiding › Logboek, magister-lvs-frame) en een
 * nieuwe afspraak (Agenda). Gedeeld door de Te laat-balie (cb.js) en Plan van aanpak (pva.js).
 *
 * Werkwijze: de module zet een concept in localStorage (zelfde origin als Magister) en opent het scherm; dit
 * hulpje vult het formulier zodra het er is. De gebruiker controleert en klikt zelf op Opslaan. Concepten
 * verlopen na 3 minuten. */
var DTForms = (() => {
  "use strict";
  const bezig = {};
  const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
  const lees = (sleutel) => { try { const c = JSON.parse(localStorage.getItem(sleutel) || "null"); return c && Date.now() - c.t < 3 * 60000 ? c : null; } catch { return null; } };
  const schrijf = (sleutel, c) => { try { localStorage.setItem(sleutel, JSON.stringify(c)); return true; } catch { return false; } };
  const weg = (sleutel) => { try { localStorage.removeItem(sleutel); } catch {} };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const banner = (titel, tekst) => {
    const d = document.createElement("div");
    d.setAttribute("style", "margin:0 0 12px;padding:10px 14px;border-radius:4px;background:#ddeffe;border-left:4px solid #056dc2;font:14px/20px open-sans,sans-serif;color:#233243");
    const b = document.createElement("b"); b.textContent = `${titel} `; d.append(b, document.createTextNode(tekst));
    return d;
  };

  /* Logboek (magister-lvs): Toevoegen › <type> kiezen, omschrijving en inhoud invullen, eventueel een bijlage.
   * concept: { t, magisterId, naam, omschrijving, tekst, type ("Notitie", "Gespreksnotitie" …), bijlage?: { naam, base64 }, bron } */
  async function vulLogboek(sleutel) {
    if (bezig[sleutel]) return;
    const c = lees(sleutel); if (!c) return;
    const h = location.hash;
    if (!c.gekozen && new RegExp(`^#/overview/${c.magisterId}\\b`).test(h)) {
      const knop = [...document.querySelectorAll("dna-button")].find((b) => /Toevoegen/.test(b.textContent));
      if (!knop) return;
      bezig[sleutel] = true;
      knop.click();
      const norm = (t) => t.trim().replace(/^\d+\w?\.\s*/, "").toLowerCase();   // "07. Gespreksnotitie (Algemeen)" → "gespreksnotitie (algemeen)"
      let item = null;
      for (let i = 0; i < 20 && !item; i++) { await wacht(150); item = [...document.querySelectorAll("dna-menu-item")].find((m) => norm(m.textContent).startsWith(c.type.toLowerCase())); }
      if (item) { c.gekozen = true; schrijf(sleutel, c); item.click(); }
      bezig[sleutel] = false;
      return;
    }
    if (c.gekozen && /^#\/create\//.test(h)) {
      const veld = document.querySelector("input[formcontrolname=omschrijving]");
      const ed = document.querySelector(".ProseMirror[contenteditable=true]");
      if (!veld || !ed) return;
      bezig[sleutel] = true;
      weg(sleutel);
      veld.focus(); veld.value = c.omschrijving;
      for (const t of ["input", "change", "blur"]) veld.dispatchEvent(new Event(t, { bubbles: true }));
      ed.focus();
      String(c.tekst || "").split("\n").forEach((regel, i) => { if (i) document.execCommand("insertParagraph"); if (regel) document.execCommand("insertText", false, regel); });
      /* Bijlage: het bestand in Magisters eigen bestandskiezer zetten (Magister uploadt het meteen). */
      let bijlage = "";
      if (c.bijlage?.base64) {
        const inp = document.querySelector("input[type=file]");
        try {
          const bin = atob(c.bijlage.base64), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const dt = new DataTransfer();
          dt.items.add(new File([bytes], c.bijlage.naam, { type: c.bijlage.mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
          inp.files = dt.files;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          bijlage = ` Het bestand ${c.bijlage.naam} staat bij Bijlage.`;
        } catch { bijlage = " De bijlage kon niet worden toegevoegd: voeg het bestand zelf toe bij Bijlage."; }
      }
      const form = veld.closest("form") || veld.closest("dna-card") || document.body;
      form.parentElement?.insertBefore(banner(`Ingevuld door ${c.bron || "Docent Tools"}.`, `${c.type} voor ${c.naam}: controleer de tekst, loop de stappen na met Volgende en klik op Opslaan.${bijlage}`), form);
      bezig[sleutel] = false;
    }
  }

  /* Nieuwe afspraak (#/afspraak/afspraak/nieuw, AngularJS-formulier in het hoofdvenster).
   * concept: { t, stamnr, naam, onderwerp, locatie, datum (dd-mm-jjjj), van, tot, tekst, bron } */
  async function vulAfspraak(sleutel) {
    if (bezig[sleutel] || !/^#\/afspraak\/afspraak\/nieuw/.test(location.hash)) return;
    const c = lees(sleutel); if (!c) return;
    const onderwerp = document.getElementById("onderwerp"); if (!onderwerp) return;
    bezig[sleutel] = true;
    weg(sleutel);
    const zet = (el, v) => { if (!el || v == null) return; el.focus(); el.value = v; for (const t of ["input", "change", "blur"]) el.dispatchEvent(new Event(t, { bubbles: true })); };
    const hoofd = document.querySelector("ui-view[name=main]") || document.body;
    /* Deelnemer: zoeken op stamnummer (anders op naam) en de juiste uit de lijst kiezen. */
    const zoek = document.getElementById("search-field");
    let gevonden = false;
    for (const q of [c.stamnr, c.naam].filter(Boolean)) {
      if (!zoek || gevonden) break;
      zet(zoek, q); zoek.focus();
      for (let i = 0; i < 25 && !hoofd.querySelector("li.item.person"); i++) await wacht(200);
      const items = [...hoofd.querySelectorAll("li.item.person")];
      const doel = items.find((li) => c.stamnr && li.textContent.includes(c.stamnr)) || (items.length === 1 ? items[0] : null);
      if (!doel) continue;
      for (let i = 0; i < 12 && !doel.classList.contains("selected"); i++) { zoek.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, which: 40, bubbles: true })); await wacht(80); }
      for (const t of ["keydown", "keyup"]) zoek.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      gevonden = true; await wacht(300);
    }
    zet(onderwerp, c.onderwerp); zet(document.getElementById("locatie"), c.locatie);
    zet(document.getElementById("Startdatum"), c.datum); zet(document.getElementById("Einddatum"), c.datum);
    const tijden = [...hoofd.querySelectorAll("input.time-input")];
    zet(tijden[0], c.van); zet(tijden[1], c.tot);
    const ed = hoofd.querySelector(".ta-bind[contenteditable=true]");
    if (ed && c.tekst) {
      ed.focus();
      ed.innerHTML = c.tekst.split("\n").map((r) => `<p>${esc(r) || "<br>"}</p>`).join("");
      for (const t of ["input", "keyup", "blur"]) ed.dispatchEvent(new Event(t, { bubbles: true }));
    }
    const titel = hoofd.querySelector("h1, h2");
    const b = banner(`Ingevuld door ${c.bron || "Docent Tools"}.`, gevonden ? `${c.naam} staat bij de deelnemers. Controleer datum, tijd en tekst en klik op Opslaan.` : `${c.naam} is niet automatisch gevonden: voeg de student zelf toe bij Deelnemers en klik daarna op Opslaan.`);
    (titel?.parentElement || hoofd).insertBefore(b, titel?.nextSibling || hoofd.firstChild);
    bezig[sleutel] = false;
  }

  /* Nieuw bericht in Magister (frame /magister-berichten/, #/nieuw/…). Concepten staan in een wachtrij, zodat
   * meerdere berichten tegelijk (elk in een eigen tabblad) kunnen worden klaargezet.
   * concept: { id, t, ontvangers: [{ soort: "student"|"ouders"|"mentoren", zoek: stamnr, naam }], onderwerp, tekst, bron } */
  async function vulBericht(sleutel) {
    if (bezig[sleutel] || !/^#\/nieuw\//.test(location.hash) || document.getElementById("dt-bericht-banner")) return;
    const tagInput = document.querySelector("input.dna-tag-input"), ond = document.querySelector("input[formcontrolname=onderwerp]"), ed = document.querySelector(".ProseMirror[contenteditable=true]");
    if (!tagInput || !ond || !ed) return;
    let rij = []; try { rij = JSON.parse(localStorage.getItem(sleutel) || "[]"); } catch {}
    rij = rij.filter((c) => Date.now() - c.t < 5 * 60000);
    const c = rij.find((x) => !x.genomen);
    if (!c) return;
    schrijf(sleutel, rij.filter((x) => x.id !== c.id));   // dit tabblad neemt dit concept
    bezig[sleutel] = true;
    const typ = (el, tekst) => { el.focus(); document.execCommand("insertText", false, tekst); };
    const optie = async (bereik, zoek) => {
      for (let i = 0; i < 25; i++) {
        await wacht(200);
        const o = [...bereik.querySelectorAll("[role=option]")].find((e) => e.offsetParent && e.textContent.includes(zoek) && !/Snelle acties|Mentoren van/.test(e.textContent));
        if (o) return o;
      }
      return null;
    };
    const mislukt = [];
    for (const o of c.ontvangers || []) {
      try {
        if (o.soort === "student") {
          typ(tagInput, o.zoek);
          const opt = await optie(document, o.zoek);
          if (opt) { opt.click(); await wacht(300); } else mislukt.push(o.naam || o.zoek);
          continue;
        }
        const label = o.soort === "ouders" ? "Ouders/verzorgers van" : "Mentoren van";
        let snel = null;   // de snelle acties verschijnen pas als het Aan-veld open is
        for (let i = 0; i < 15 && !snel; i++) {
          if (i % 5 === 0) { tagInput.blur(); document.body.click(); await wacht(150); tagInput.click(); tagInput.focus(); }
          await wacht(200);
          snel = [...document.querySelectorAll("dna-button")].find((b) => b.textContent.trim() === label && b.offsetParent);
        }
        if (!snel) { mislukt.push(`${label.toLowerCase()} ${o.naam}`); continue; }
        snel.click();
        let dlg = null; for (let i = 0; i < 15 && !dlg; i++) { await wacht(200); dlg = document.querySelector("dna-dialog"); }
        const zoekveld = dlg && [...dlg.querySelectorAll("input")].find((x) => x.type === "text" || !x.type);
        if (!zoekveld) { mislukt.push(`${label.toLowerCase()} ${o.naam}`); continue; }
        typ(zoekveld, o.zoek);
        const opt = await optie(document, o.zoek);   // de zoekresultaten staan in een overlay buiten het venster
        if (!opt) { mislukt.push(`${label.toLowerCase()} ${o.naam}`); [...dlg.querySelectorAll("dna-button")].find((b) => /Annuleren/.test(b.textContent))?.click(); continue; }
        opt.click(); await wacht(400);
        [...dlg.querySelectorAll("dna-button")].find((b) => /Toevoegen/.test(b.textContent))?.click(); await wacht(500);
      } catch { mislukt.push(o.naam || o.zoek); }
    }
    /* Overgebleven zoektekst in het Aan-veld weghalen. */
    if (tagInput.value) { tagInput.focus(); tagInput.select?.(); document.execCommand("delete"); }
    typ(ond, c.onderwerp || "");
    ed.focus();
    String(c.tekst || "").split("\n").forEach((regel, i) => { if (i) document.execCommand("insertParagraph"); if (regel) document.execCommand("insertText", false, regel); });
    const b = banner(`Ingevuld door ${c.bron || "Docent Tools"}.`, `Controleer ontvangers en tekst en klik op Verzenden.${mislukt.length ? ` Niet automatisch toegevoegd: ${mislukt.join(", ")}; voeg die zelf toe bij Aan.` : ""}`);
    b.id = "dt-bericht-banner";
    const kop = document.querySelector("h1, h2");
    (kop?.parentElement || document.body).insertBefore(b, kop?.nextSibling || document.body.firstChild);
    bezig[sleutel] = false;
  }
  function bericht(sleutel, concept) {
    let rij = []; try { rij = JSON.parse(localStorage.getItem(sleutel) || "[]"); } catch {}
    rij = rij.filter((c) => Date.now() - c.t < 5 * 60000);
    rij.push(Object.assign({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t: Date.now() }, concept));
    schrijf(sleutel, rij);
    window.open(`${location.origin}/op/#/berichtenOverzicht?innerUrl=${encodeURIComponent(encodeURIComponent("/nieuw/NEW"))}`, "_blank");
  }

  /* Concept klaarzetten en het scherm openen. */
  function afspraak(sleutel, { stamnr, naam, onderwerp, tekst, locatie = "", datum, tijd = "09:00", minuten = 30, bron }) {
    const [hh, mm] = tijd.split(":").map(Number), eind = new Date(2000, 0, 1, hh, mm + minuten);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum.split("-").reverse().join("-") : datum;
    schrijf(sleutel, { t: Date.now(), stamnr: String(stamnr || ""), naam, onderwerp, locatie, datum: d, van: tijd,
      tot: `${String(eind.getHours()).padStart(2, "0")}:${String(eind.getMinutes()).padStart(2, "0")}`, tekst, bron });
    window.open(`${location.origin}/op/#/afspraak/afspraak/nieuw`, "_blank");
  }
  function logboek(sleutel, concept) { return schrijf(sleutel, Object.assign({ t: Date.now() }, concept)); }

  return { vulLogboek, vulAfspraak, vulBericht, afspraak, logboek, bericht, lees, weg };
})();
