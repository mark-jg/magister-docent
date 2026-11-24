/* LesOpslag: de lessen per student (met de registratie erbij) bewaren in de gedeelde map, zodat een lijst de
 * volgende keer alleen hoeft te worden bijgewerkt in plaats van opnieuw opgehaald.
 *
 * De map is dezelfde die op de pagina Opleidingen voor de back-up wordt gekozen (in IndexedDB "dt-opl", sleutel
 * "map"); de lessen staan in de submap "lesregistraties", één bestand per klas per schooljaar:
 *   { versie, host, klas, sj, op, tekst: [...], studenten: { id: { naam, van, tot, op, l: [...] } } }
 * Per student: van en tot (jjjj-mm-dd) is het bereik dat is opgehaald, op het moment van de laatste aanvulling
 * en vol dat van de laatste keer dat alles in één keer is opgehaald (beide ms). Een les is een rij
 * [id, begin in minuten, duur in minuten, vak, docent, categorie, registraties], waarin de teksten verwijzen naar
 * de lijst `tekst`; zo blijft een bestand van een heel schooljaar klein.
 *
 * Wat ouder is dan twee weken vóór de vorige keer verandert in de praktijk niet meer en blijft staan; de laatste
 * weken worden opnieuw opgehaald, omdat registraties achteraf nog wijzigen (zoals de jaaropslag van Opleidingen).
 * Let op: de bestanden bevatten namen van studenten met hun lessen en registraties.
 *
 * Bedoeld als gedeelde bron: Lesregistraties gebruikt het nu; andere onderdelen die per klas ophalen kunnen
 * dezelfde bestanden lezen met LesOpslag.lees(map, klas). */
const LesOpslag = {
  VERSIE: 1,
  SUB: "lesregistraties",
  VERS: 10 * 60e3,   // zo lang geldt een bijgewerkte student als vers (zoals vzBron)
  TERUG: 14,         // dagen vóór de vorige keer die opnieuw worden opgehaald
  CONTROLE: 14,      // na zoveel dagen zonder volledige controle komt er een melding

  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  datum(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
  sjJaar(d = new Date()) { return d.getFullYear() - (d.getMonth() < 7 ? 1 : 0); },

  /* ---------- rekenen (zonder schijf) ---------- */
  /* Lessen naar rijen; tekst is de lijst met teksten van het bestand en wordt aangevuld. */
  pak(lessen, tekst) {
    const plek = new Map(tekst.map((t, i) => [t, i]));
    const nr = (t) => { t = String(t ?? ""); if (!plek.has(t)) { plek.set(t, tekst.length); tekst.push(t); } return plek.get(t); };
    return lessen.map((l) => [l.id ?? null, Math.round(l.begin.getTime() / 60000), Math.round((l.einde - l.begin) / 60000), nr(l.vak), nr(l.docent), nr(l.cat), nr(l.regs)]);
  },
  uitpak(rijen, tekst) {
    return (rijen || []).map(([id, b, duur, v, d, c, r]) => ({ id, begin: new Date(b * 60000), einde: new Date((b + duur) * 60000), vak: tekst[v] ?? "", docent: tekst[d] ?? "", cat: tekst[c] || "OK", extra: 0, regs: tekst[r] ?? "" }));
  },
  /* Wat er van een student moet worden opgehaald voor het bereik van..tot: { begin, vol }.
   *   begin null: niets, de opslag dekt het (of is net bijgewerkt);
   *   vol true:   alles vanaf begin, de opslag wordt vervangen;
   *   anders:     vanaf begin, de lessen daarvóór blijven staan.
   * st: de bewaarde student ({ van, tot, op }) of null. vers: ook aanvullen als dat net nog is gedaan. */
  plan(st, van, tot, nu = new Date(), vers = false) {
    const dag = new Date(van.getFullYear(), van.getMonth(), van.getDate());
    if (!st || !st.van || !st.tot || st.van > this.ymd(dag)) return { begin: dag, vol: true };
    const t = this.datum(st.tot), grens = new Date(t.getFullYear(), t.getMonth(), t.getDate() - this.TERUG);
    grens.setDate(grens.getDate() - ((grens.getDay() + 6) % 7));   // hele weken: vanaf de maandag
    if (tot < grens || (!vers && nu - (st.op || 0) < this.VERS)) return { begin: null, vol: false };
    const eerste = this.datum(st.van);
    return { begin: grens > eerste ? grens : eerste, vol: grens <= eerste };
  },
  /* Bewaarde lessen van vóór `vanaf` met de nieuw opgehaalde erachter. */
  voeg(oud, nieuw, vanaf) {
    return [...(oud || []).filter((l) => l.begin < vanaf), ...nieuw].sort((a, b) => a.begin - b.begin);
  },
  /* De lessen die helemaal binnen van..tot vallen (zoals vzStats ze afbakent). */
  binnen(lessen, van, tot) { return lessen.filter((l) => l.begin >= van && l.einde <= tot); },

  /* ---------- de gedeelde map ---------- */
  kv(sleutel, waarde) {
    return new Promise((ok, nee) => {
      const r = indexedDB.open("dt-opl", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onerror = () => nee(r.error);
      r.onsuccess = () => {
        const st = r.result.transaction("kv", waarde === undefined ? "readonly" : "readwrite").objectStore("kv");
        const q = waarde === undefined ? st.get(sleutel) : waarde === null ? st.delete(sleutel) : st.put(waarde, sleutel);
        q.onsuccess = () => ok(q.result); q.onerror = () => nee(q.error);
      };
    });
  },
  /* Een vraag aan de map met een tijdslimiet. Chrome geeft op sommige vragen nooit antwoord, bijvoorbeeld op
   * queryPermission voor een map die een andere versie van de extensie (de dev-versie) heeft gekozen; zonder limiet
   * bleven Lesregistraties en Opleidingen dan eindeloos wachten. Na de limiet geldt de terugvalwaarde. */
  metLimiet(belofte, ms, terug) {
    return Promise.race([Promise.resolve(belofte).catch(() => terug), new Promise((ok) => setTimeout(() => ok(terug), ms))]);
  },
  /* { h, mag }: de gekozen map (of null) en of Chrome er nu in mag schrijven. Toegang vraagt een klik. Geeft Chrome
   * geen antwoord op de vraag naar toegang, dan is de bewaarde map onbruikbaar (gekozen door een andere versie van de
   * extensie): dan geldt er geen map, zodat je een nieuwe kunt kiezen. */
  async map() {
    try {
      const h = await this.metLimiet(this.kv("map"), 3000, null); if (!h) return { h: null, mag: false };
      const mag = await this.metLimiet(h.queryPermission({ mode: "readwrite" }), 3000, "geen antwoord");
      return mag === "geen antwoord" ? { h: null, mag: false } : { h, mag: mag === "granted" };
    } catch { return { h: null, mag: false }; }
  },
  async toegang(h) { return await this.metLimiet(h.requestPermission({ mode: "readwrite" }), 60000, "denied") === "granted"; },
  /* Een map kiezen; die geldt daarna ook voor de back-up van Opleidingen. Geeft { h, mag } of null bij annuleren. */
  async kies() {
    const h = await window.showDirectoryPicker({ id: "dt-opl", mode: "readwrite" });
    await this.kv("map", h);
    this.gewijzigd();
    return { h, mag: true };
  },
  async vergeet() { await this.metLimiet(this.kv("map", null), 3000, null); this.gewijzigd(); },
  /* Na kiezen, toegang of vergeten: de open pagina's (Opleidingen, Lesregistraties) en de instellingen bijwerken. */
  gewijzigd() {
    try { document.dispatchEvent(new CustomEvent("dt:map")); } catch {}
    try { chrome.runtime.sendMessage({ type: "dt:map" }).catch(() => {}); } catch {}
  },

  /* De map instellen vanuit de zijkolom (Instellingen › Meer › Back-up en opslag). Kiezen en toegang geven mogen
   * alleen direct na een klik op de pagina zelf; een klik in de zijkolom telt daar niet voor. Daarom verschijnt
   * op de pagina een venstertje met één knop. soort: "kies" of "toegang". */
  opPagina(DT, soort) {
    document.getElementById("dt-map-vraag")?.remove();
    const kies = soort === "kies";
    const dlg = DT.el("dialog", { id: "dt-map-vraag", style: "border:0;border-radius:14px;padding:20px 22px;max-width:420px;width:90vw;font:14px var(--dt-font, system-ui);color:var(--dt-fg, #1d1d1f);background:var(--dt-bg, #fff);box-shadow:0 18px 50px rgba(0,0,0,.3)" });
    const sluit = () => { dlg.close(); dlg.remove(); };
    const knop = DT.el("button", { type: "button", class: "dt-btn dt-btn-primary", text: kies ? "Map kiezen" : "Toegang geven" });
    knop.addEventListener("click", async () => {
      sluit();
      try {
        if (kies) { const m = await this.kies(); DT.toast(`Back-up en lijsten staan voortaan in "${m.h.name}"`, "ok", 4000); }
        else {
          const { h } = await this.map();
          if (h && await this.toegang(h)) { this.gewijzigd(); DT.toast(`Toegang tot "${h.name}" gegeven`, "ok", 3000); }
          else DT.toast("Geen toegang tot de map gekregen.", "err", 4000);
        }
      } catch (e) { if (e?.name !== "AbortError") DT.toast(`Map kiezen lukte niet: ${e?.message || e}`, "err", 5000); }
    });
    dlg.append(
      DT.el("h2", { style: "margin:0 0 8px;font-size:17px", text: kies ? "Map voor back-up kiezen" : "Toegang tot de map" }),
      DT.el("p", { style: "margin:0 0 16px;line-height:1.45", text: kies
        ? "Kies een map op deze computer of in OneDrive. Opleidingen zet daar een back-up neer en Lesregistraties bewaart er de lijsten per klas. De bestanden bevatten namen van studenten: kies een plek die daarvoor is toegestaan."
        : "Chrome vraagt één keer per sessie of Docentdeck de gekozen map mag gebruiken." }),
      DT.el("div", { class: "dt-row", style: "justify-content:flex-end;gap:8px" }, [DT.el("button", { type: "button", class: "dt-btn", text: "Annuleren", onclick: sluit }), knop]));
    document.body.append(dlg);
    dlg.showModal(); knop.focus();
  },
  bestand(klas, sj) { return `${location.host}-${klas}-${sj}`.replace(/[^a-z0-9.-]/gi, "_") + ".json"; },
  /* Het bestand van een klas: { tekst, studenten: { id: { naam, van, tot, op, lessen } } }, of null. */
  async lees(map, klas, sj = this.sjJaar()) {
    try {
      const tekst = await this.metLimiet((async () => {
        const dir = await map.getDirectoryHandle(this.SUB);
        return (await (await dir.getFileHandle(this.bestand(klas, sj))).getFile()).text();
      })(), 15000, null);
      if (tekst == null) return null;
      const b = JSON.parse(tekst);
      if (!b || b.versie !== this.VERSIE || b.host !== location.host || b.klas !== klas) return null;
      const studenten = {};
      for (const [id, st] of Object.entries(b.studenten || {})) studenten[id] = { naam: st.naam, van: st.van, tot: st.tot, op: st.op, vol: st.vol || 0, lessen: this.uitpak(st.l, b.tekst || []) };
      return { op: b.op, studenten };
    } catch { return null; }   // nog geen bestand, of niet te lezen (OneDrive synchroniseert nog)
  },
  async schrijf(map, klas, studenten, sj = this.sjJaar()) {
    const tekst = [], uit = {};
    for (const [id, st] of Object.entries(studenten)) uit[id] = { naam: st.naam, van: st.van, tot: st.tot, op: st.op, vol: st.vol || 0, l: this.pak(st.lessen, tekst) };
    const dir = await map.getDirectoryHandle(this.SUB, { create: true });
    const w = await (await dir.getFileHandle(this.bestand(klas, sj), { create: true })).createWritable();
    await w.write(JSON.stringify({ versie: this.VERSIE, host: location.host, klas, sj, op: Date.now(), tekst, studenten: uit })); await w.close();
  },
};
