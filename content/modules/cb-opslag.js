/* Te laat-balie, de gedeelde map: lezen, schrijven, reservekopieën, periodes volgen en de bezetting.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
  /* ===================================================================================== */
  /* Gedeelde map (zelfde bestanden en afspraken als Tardy)                                 */
  /* ===================================================================================== */
  BESTAND: "tardy-gegevens.json",
  BEZET: "tardy-in-gebruik.json",
  BEZET_VERLOOPT: 10 * 60 * 1000,
  PERSOONLIJK: ["cbNaam", "cbParaaf", "cbEmail", "lokaal", "bonPrinter", "bonZwarting", "bonAuto", "takenOpen", "detailOpen", "railOpen"],

  db() {
    return this._db ||= new Promise((ok, nee) => {
      const r = indexedDB.open("dt-cb", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("kv"); r.result.createObjectStore("kopie", { autoIncrement: true }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  async kv(sleutel, waarde) {
    const db = await this.db();
    return new Promise((ok, nee) => {
      const tx = db.transaction("kv", waarde === undefined ? "readonly" : "readwrite"), st = tx.objectStore("kv");
      const r = waarde === undefined ? st.get(sleutel) : waarde === null ? st.delete(sleutel) : st.put(waarde, sleutel);
      r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error);
    });
  },
  /* Kopie in deze browser: bij een conflict en hooguit één keer per uur als back-up (laatste 40). */
  async kopie(soort, json) {
    try {
      const db = await this.db();
      await new Promise((ok) => { const tx = db.transaction("kopie", "readwrite"); tx.objectStore("kopie").add({ soort, op: new Date().toISOString(), json }); tx.oncomplete = ok; tx.onerror = ok; });
      await new Promise((ok) => {
        const tx = db.transaction("kopie", "readwrite"), st = tx.objectStore("kopie"), r = st.getAllKeys();
        r.onsuccess = () => { r.result.slice(0, Math.max(0, r.result.length - 40)).forEach((k) => st.delete(k)); };
        tx.oncomplete = ok; tx.onerror = ok;
      });
    } catch {}
  },
  async kopieen() {
    try {
      const db = await this.db();
      return await new Promise((ok) => {
        const uit = [], r = db.transaction("kopie").objectStore("kopie").openCursor(null, "prev");
        r.onsuccess = () => { const c = r.result; if (!c) return ok(uit); uit.push(Object.assign({ sleutel: c.key }, c.value)); c.continue(); };
        r.onerror = () => ok(uit);
      });
    } catch { return []; }
  },
  /* Reservekopieën uit deze browser bekijken, downloaden of terugzetten als de gedeelde stand. */
  async kopieVenster(DT) {
    const SOORT = { uurlijks: "Reservekopie (elk uur)", conflict: "Jouw stand bij een conflict", afsluiten: "Bij het sluiten van het tabblad", terugzetten: "Stand vóór terugzetten" };
    const lijst = await this.kopieen();
    const rijen = lijst.map((k) => {
      let g = null; try { g = JSON.parse(k.json); } catch {}
      const n = g ? (g.registraties || []).length : null;
      const terug = this.knop(DT, "Terugzetten", () => this.kopieTerug(DT, k, g), false, "klein");
      if (!g || this._kijkt || !this._map) terug.setAttribute("disabled", "");
      return DT.el("tr", {}, [
        DT.el("td", { text: this.moment(k.op) }), DT.el("td", { text: SOORT[k.soort] || k.soort || "" }),
        DT.el("td", { text: n === null ? "niet leesbaar" : `${n} meldingen` }),
        DT.el("td", {}, DT.el("div", { class: "dt-cb-rij eind" }, [this.knop(DT, "Downloaden", () => DT.download(`tardy-kopie-${String(k.op).slice(0, 16).replace(/[:T]/g, "-")}.json`, k.json, "application/json"), false, "klein stil"), terug]))
      ]);
    });
    this.modal("Reservekopieën in deze browser", [
      DT.el("p", { class: "dt-cb-zacht", text: "De balie bewaart hooguit één kopie per uur (de laatste 40), jouw stand bij een conflict met een collega en de stand bij het sluiten van het tabblad. Terugzetten vervangt de gedeelde gegevens voor iedereen; de huidige stand wordt eerst zelf als kopie bewaard." }),
      rijen.length ? DT.el("table", { class: "dt-cb-tabel" }, [DT.el("thead", {}, DT.el("tr", {}, ["Wanneer", "Soort", "Inhoud", ""].map((t) => DT.el("th", { scope: "col", text: t })))), DT.el("tbody", {}, rijen)])
        : DT.el("p", { text: "Er staan nog geen kopieën in deze browser." })
    ]).classList.add("breed");
  },
  async kopieTerug(DT, k, g) {
    if (!g || !this._map || this._kijkt) return;
    if (!confirm(`De stand van ${this.moment(k.op)} terugzetten?\n\nDit vervangt de gedeelde gegevens voor iedereen die deze map gebruikt. De huidige stand wordt eerst als kopie bewaard, zodat je terug kunt.`)) return;
    /* Eerst de nieuwste stand van schijf lezen: die wordt de kopie, en zijn revisie de basis voor het wegschrijven. */
    let nu = null; try { nu = JSON.parse(await this.lees(this.BESTAND) || "null"); } catch {}
    await this.kopie("terugzetten", JSON.stringify(nu ? this.splits(nu) : this.splits(TardyKern.S)));
    const basis = Math.max(this._basis || 0, nu?.revisie || 0);
    this.sluitModal();
    this.laadStand(JSON.parse(k.json));
    this._basis = basis;   // de kopie zelf heeft geen revisie; verder tellen vanaf de huidige
    await this.schrijfNu();
    this.teken();
    this.melding(`De stand van ${this.moment(k.op)} is teruggezet.`, "info", 7000);
  },
  /* De code waaraan de balie het eigen apparaat herkent in tardy-in-gebruik.json. Die blijft de hele sessie
   * dezelfde (this._app) en staat in de extensie (chrome.storage.local), niet alleen in de opslag van de
   * Magister-pagina: raakt die leeg of is ze geblokkeerd, dan kreeg de balie telkens een nieuwe code en zag ze
   * het eigen slot aan voor dat van een collega. */
  APPARAAT: "dt-cb-apparaat",
  apparaat() {
    if (this._app) return this._app;
    let id = null; try { id = localStorage.getItem(this.APPARAAT); } catch {}
    if (!id) { id = "chrome-" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(this.APPARAAT, id); } catch {} }
    return this._app = id;
  },
  async apparaatLaden() {
    if (this._appGeladen) return this._app;
    let vast = null; try { vast = (await chrome.storage.local.get(this.APPARAAT))[this.APPARAAT]; } catch {}
    if (vast) { this._app = vast; try { localStorage.setItem(this.APPARAAT, vast); } catch {} }
    else { const id = this.apparaat(); try { await chrome.storage.local.set({ [this.APPARAAT]: id }); } catch {} }
    this._appGeladen = true;
    return this._app;
  },
  async lees(naam) {
    try { const f = await (await this._map.getFileHandle(naam)).getFile(); return await f.text(); } catch { return null; }
  },
  async schrijf(naam, tekst) {
    const w = await (await this._map.getFileHandle(naam, { create: true })).createWritable();
    await w.write(tekst); await w.close();
  },
  mijnNaam() { return DT.settings.cb?.naam || "Community builder (Chrome)"; },
  persoonlijk() {
    const c = DT.settings.cb || {};
    return { cbNaam: c.naam || "", cbParaaf: c.paraaf || "", cbEmail: c.email || "", lokaal: c.lokaal || "", bonZwarting: c.zwarting || 3, bonAuto: !!c.autoPrint, bonPrinter: c.printer || null };
  },
  splits(S) {
    const inst = Object.assign({}, S.instellingen || {});
    this.PERSOONLIJK.forEach((k) => delete inst[k]);
    const g = Object.assign({}, S, { instellingen: inst });
    delete g.revisie; delete g.gewijzigdDoor; delete g.gewijzigdOp;
    return g;
  },
  laadStand(g) {
    const K = TardyKern;
    const lokaal = g.instellingen?.lokaal;
    K.S = g; K.normaliseer();
    const p = this.persoonlijk();
    Object.assign(K.S.instellingen, p);
    if (!p.lokaal && lokaal) K.S.instellingen.lokaal = lokaal;   // oude bestanden met lokaal in de gedeelde stand
    this._basis = g.revisie || 0; this._door = g.gewijzigdDoor || ""; this._op = g.gewijzigdOp || "";
    this.volgPeriodes();
    if (!K.UI.periodeId || !K.periodeById(K.UI.periodeId)) K.UI.periodeId = (K.periodeVanDatum(K.vandaag()) || K.huidigePeriode()).id;
  },
  /* De periodes van de plugin (zijpaneel › Periodes) zijn leidend, zodra daar periodes staan. Maar alleen wie zijn
   * periodes in het zijpaneel wíjzigt, past het gedeelde bestand aan: deze browser onthoudt welke periodes hij al
   * heeft doorgevoerd. Wijkt het bestand daarna af, dan heeft een collega ze aangepast en volgt de balie het
   * bestand. Zonder dat geheugen zouden twee collega's met verschillende periodes elkaars periodes bij elk bezoek
   * terugdraaien (en zouden afgehandelde signalen terugkomen). Een periode houdt
   * de code die hij in Tardy al had (zelfde begindatum of naam), zodat afgehandelde signalen, acties en
   * Magister-cijfers bij die periode blijven horen. Meldingen blijven altijd bewaard; die van een verwijderde
   * periode vallen alleen buiten de signalen. Geeft true als de periodes zijn gewijzigd. */
  volgPeriodes() {
    const K = TardyKern; if (!K.S || typeof DT === "undefined" || !DT.periodes) return false;
    const pl = DT.periodes(); if (!pl.length) return false;
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const oud = K.S.instellingen.periodes || [], gebruikt = new Set();
    const nieuw = pl.map((p) => {
      const start = ymd(p.begin), eind = ymd(p.einde);
      const zelfde = oud.find((o) => !gebruikt.has(o.id) && o.start === start) || oud.find((o) => !gebruikt.has(o.id) && o.naam === p.naam);
      const id = zelfde ? zelfde.id : `dt-${p.id}`;
      gebruikt.add(id);
      return { id, naam: p.naam, start, eind };
    });
    const mijn = JSON.stringify(nieuw.map((p) => [p.naam, p.start, p.eind]));
    const gezien = (() => { try { return localStorage.getItem("dt-cb-periodes"); } catch { return null; } })();
    const onthoud = () => { try { localStorage.setItem("dt-cb-periodes", mijn); } catch {} };
    if (JSON.stringify(nieuw) === JSON.stringify(oud)) { onthoud(); this._perAnders = false; return false; }
    if (oud.length && (gezien === null || gezien === mijn)) {
      /* Mijn periodes zijn niet veranderd sinds ik ze doorvoerde (of ik ben hier voor het eerst): het bestand
       * is door een collega aangepast en blijft leidend. */
      if (gezien === null) onthoud();
      if (!this._perAnders) {
        this._perAnders = true;
        setTimeout(() => this.melding("De periodes van de balie komen uit het gedeelde bestand en wijken af van jouw periodes in het zijpaneel. Pas je periodes in het zijpaneel aan om ze voor iedereen te wijzigen.", "info", 9000), 800);
      }
      return false;
    }
    this._perAnders = false;
    K.S.instellingen.periodes = nieuw;
    if (!K.periodeById(K.UI.periodeId)) K.UI.periodeId = (K.periodeVanDatum(K.vandaag()) || nieuw[0]).id;
    if (this._map && !this._kijkt) { onthoud(); this.bewaar(); this.opnieuwOphalen("De periodes zijn gewijzigd"); }
    return true;
  },
  /* Magister-cijfers per periode horen bij de periodegrenzen; na een wijziging (of met gegevens van vóór de
   * telling per les) alles op de achtergrond opnieuw ophalen. */
  opnieuwOphalen(reden) {
    const K = TardyKern;
    clearTimeout(this._herT);
    this._herT = setTimeout(async () => {
      if (!this._map || this._kijkt || !K.S) return;
      if (this._haal) return this.opnieuwOphalen(reden);
      const sns = Object.values(K.S.studenten).filter((st) => !st.archief && (st.magisterId || K.S.lesreg[st.stamnr])).map((st) => st.stamnr);
      if (!sns.length) return;
      this.melding(`${reden}: het verzuim van ${sns.length} studenten wordt opnieuw uit Magister opgehaald…`, "info", 6000);
      await this.haalMagister(DT, sns, { stil: true });
      this.melding("Verzuim uit Magister bijgewerkt.");
    }, 1500);
  },
  async bezetting() { try { return JSON.parse(await this.lees(this.BEZET) || "null"); } catch { return null; } },
  bezetDoorAnder(b) { return !!(b && b.apparaat && b.apparaat !== this.apparaat() && (Date.now() - Date.parse(b.bijgewerkt || 0)) < this.BEZET_VERLOOPT); },
  async bezettingZet() {
    const oud = await this.bezetting(), nu = new Date().toISOString();
    const sinds = oud && oud.apparaat === this.apparaat() && oud.sinds ? oud.sinds : nu;
    await this.schrijf(this.BEZET, JSON.stringify({ naam: this.mijnNaam(), apparaat: this.apparaat(), apparaatNaam: "Chrome · Magister", sinds, bijgewerkt: nu })).catch(() => {});
  },
  async bezettingVrij() {
    const b = await this.bezetting();
    if (b && b.apparaat === this.apparaat()) { try { await this._map.removeEntry(this.BEZET); } catch {} }
  },

  bewaar() {
    clearTimeout(this._schrijfTimer);
    this._wacht = true;   // er staat een wijziging klaar die nog niet in de map staat
    this._schrijfTimer = setTimeout(() => this.schrijfNu(), 250);
  },
  async schrijfNu() {
    clearTimeout(this._schrijfTimer);
    this._wacht = false;
    if (!this._map || !TardyKern.S) return;
    if (this._kijkt) { this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus deze wijziging wordt niet bewaard.`, "err"); return this.herlaad(); }
    if (this._bezig) return this.bewaar();
    this._bezig = true;
    try {
      const opSchijf = JSON.parse(await this.lees(this.BESTAND) || "null");
      if (opSchijf && (opSchijf.revisie || 0) > this._basis) {
        await this.kopie("conflict", JSON.stringify(this.splits(TardyKern.S)));
        this.laadStand(opSchijf); this.teken();
        this.melding(`${opSchijf.gewijzigdDoor || "Je collega"} heeft intussen opgeslagen. Die stand zie je nu; jouw laatste wijziging staat als conflictkopie in deze browser.`, "err", 9000);
        return;
      }
      const g = this.splits(TardyKern.S);
      g.revisie = this._basis + 1; g.gewijzigdDoor = this.mijnNaam(); g.gewijzigdOp = new Date().toISOString();
      const json = JSON.stringify(g);
      await this.schrijf(this.BESTAND, json);
      this._basis = g.revisie; this._door = g.gewijzigdDoor; this._op = g.gewijzigdOp;
      if (!this._laatsteKopie || Date.now() - this._laatsteKopie > 3600e3) { this._laatsteKopie = Date.now(); this.kopie("uurlijks", json); }
      this.tekenStand();
    } catch (e) {
      this.melding(`Opslaan in de gedeelde map lukte niet: ${e.message || e}`, "err", 9000);
    } finally { this._bezig = false; }
  },
  async herlaad() {
    const g = JSON.parse(await this.lees(this.BESTAND) || "null");
    if (g) { this.laadStand(g); this.teken(); }
  },
  /* Elke 30 seconden: bijwerken als een ander opsloeg, bezetting bijhouden. */
  async controle() {
    if (!this._map || !this._scherm) return;
    const b = await this.bezetting();
    const tekst = await this.lees(this.BESTAND);
    const rev = (() => { try { return JSON.parse(tekst || "null")?.revisie || 0; } catch { return 0; } })();
    if (this._kijkt) {
      if (rev > this._basis) await this.herlaad();
      /* De ander is klaar (slot weg of verlopen): zelf verder, zonder de pagina opnieuw te hoeven openen. */
      if (!this.bezetDoorAnder(b) && !this._modal) {
        const wie = this._ander?.naam || "Je collega";
        this._kijkt = false; this._ander = null;
        await this.herlaad(); await this.bezettingZet(); this.teken();
        this.melding(`${wie} werkt niet meer in Tardy. Je werkt nu zelf; wijzigingen worden weer bewaard.`, "info", 8000);
      }
    } else if (this.bezetDoorAnder(b)) {
      this._kijkt = true; this._ander = b; await this.herlaad();
      this.melding(`${b.naam || "Je collega"} heeft Tardy overgenomen. Je kijkt nu mee.`, "info", 8000);
    } else {
      if ((this._tik = (this._tik || 0) + 1) % 2 === 0) this.bezettingZet();
      /* Niet herladen terwijl je in een venster bezig bent, er nog een wijziging klaarstaat of het verzuim wordt
       * opgehaald: de stand onder je handen vervangen zou die invoer ongemerkt laten vervallen. De volgende
       * controle (30 s) probeert het opnieuw; bij opslaan vangt de revisiecontrole een conflict op. */
      if (rev > this._basis && !this._bezig && !this._wacht && !this._modal && !this._haal) { await this.herlaad(); this.melding(`Bijgewerkt met wijzigingen van ${JSON.parse(tekst).gewijzigdDoor || "je collega"}.`); }
    }
    this.tekenStand();
  },
});
