/* Te laat-balie voor de community builder (CB'er): Tardy in Magister.
 *
 * Aan te zetten bij Instellingen › Community builder. Opent schermvullend vanaf de tegel "Te laat-balie" op
 * Aanwezigheid (en via het zijpaneel). Rekent met de kern van Tardy (cb-kern.js, gegenereerd uit Tardy):
 * dezelfde soorten, tellingen, het verzuimprotocol met zijn ladders, de meldafspraken en mailteksten.
 *
 * Gegevens: dezelfde gedeelde map als de Tardy-app (OneDrive of Teams), met dezelfde bestanden:
 *  - tardy-gegevens.json   de gedeelde stand, met revisieteller (revisie, gewijzigdDoor, gewijzigdOp)
 *  - tardy-in-gebruik.json wie er nu werkt (naam, apparaat, apparaatNaam, sinds, bijgewerkt)
 * Om de beurt, zoals in Tardy: werkt een ander (teken van leven < 10 minuten), dan kies je tussen alleen
 * bekijken en zelf verder. Heeft een ander intussen opgeslagen, dan overschrijft de balie niets: de eigen
 * versie gaat naar een conflictkopie in deze browser en de nieuwere stand wordt geladen.
 * Persoonlijke instellingen (naam, paraaf, e-mail, lokaal, printer) staan niet in de gedeelde map maar in de
 * extensie, net als Tardy ze op de eigen Mac bewaart.
 *
 * Magister: de balie zoekt studenten op in Magister en vult ze aan in de gedeelde gegevens. Er wordt niets
 * in Magister geschreven; de balie zegt wat je in Magister zet en opent de verzuimpagina van de student.
 * Briefjes: op een gewone printer, of op het Bluetooth-bonprintertje van Tardy (Web Bluetooth). */
DT.register({
  id: "cb",
  _stop: null,
  _scherm: null,

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.tegel(DT), { debounce: 300, poll: 1500 });
  },

  destroy() {
    this._stop && this._stop();
    this.sluit();
    DT.deepQueryAll("#dt-cb-tegel").forEach((el) => el.remove());
  },

  /* ---------- tegel op Aanwezigheid ---------- */
  tegel(DT) {
    const wrap = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector(".wrapper");
    if (!wrap) return;
    const oud = wrap.querySelector("#dt-cb-tegel");
    if (oud) {
      if (oud.shadowRoot?.querySelector("h1")?.textContent.trim() !== "Te laat-balie") window.postMessage({ type: "dt:attr:opnieuw", selector: "#dt-cb-tegel", attr: "heading" }, "*");
      return;
    }
    const c = document.createElement("dna-link-card");
    c.id = "dt-cb-tegel"; c.setAttribute("heading", "Te laat-balie");
    c.setAttribute("tabindex", "0"); c.setAttribute("role", "link"); c.style.cursor = "pointer";
    const oms = document.createElement("div"); oms.slot = "description";
    oms.textContent = "Melden, briefjes, meldafspraken en signalen volgens het verzuimprotocol (Tardy)";
    const ico = document.createElement("span"); ico.slot = "icon";
    ico.style.cssText = "display:inline-grid;place-items:center;inline-size:3.75rem;block-size:3.75rem;border-radius:16px;background:color-mix(in srgb,var(--dt-accent,#007aff) 13%,transparent);color:var(--dt-accent,#007aff)";
    ico.innerHTML = `<svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="17" r="10" opacity=".35"/><path d="M16 11v6l4 3M12 3h8M16 3v4"/></svg>`;
    c.append(oms, ico);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); this.open(DT); };
    c.addEventListener("click", open, true);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
    wrap.append(c);
  },

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
  apparaat() {
    let id = null; try { id = localStorage.getItem("dt-cb-apparaat"); } catch {}
    if (!id) { id = "chrome-" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem("dt-cb-apparaat", id); } catch {} }
    return id;
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
    if (!K.UI.periodeId || !K.periodeById(K.UI.periodeId)) K.UI.periodeId = K.huidigePeriode().id;
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
    this._schrijfTimer = setTimeout(() => this.schrijfNu(), 250);
  },
  async schrijfNu() {
    clearTimeout(this._schrijfTimer);
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
      if (!this.bezetDoorAnder(b)) { this._ander = null; this.tekenStand(); }
    } else if (this.bezetDoorAnder(b)) {
      this._kijkt = true; this._ander = b; await this.herlaad();
      this.melding(`${b.naam || "Je collega"} heeft Tardy overgenomen. Je kijkt nu mee.`, "info", 8000);
    } else {
      if ((this._tik = (this._tik || 0) + 1) % 2 === 0) this.bezettingZet();
      if (rev > this._basis && !this._bezig) { await this.herlaad(); this.melding(`Bijgewerkt met wijzigingen van ${JSON.parse(tekst).gewijzigdDoor || "je collega"}.`); }
    }
    this.tekenStand();
  },

  /* ===================================================================================== */
  /* Openen en de schil                                                                     */
  /* ===================================================================================== */
  async open(DT) {
    if (this._scherm) return;
    this.css();
    const K = TardyKern;
    K.H.bewaar = () => this.bewaar();
    K.H.toon = (t) => this.melding(t);
    const laag = DT.el("div", { class: "dt-cb", role: "dialog", "aria-modal": "true", "aria-label": "Te laat-balie" });
    const nav = DT.el("nav", { class: "dt-cb-nav" });
    const hoofd = DT.el("main", { class: "dt-cb-hoofd" });
    this._stand = DT.el("div", { class: "dt-cb-stand" });
    this._periode = DT.el("select", { class: "dt-cb-periode", "aria-label": "Periode" });
    this._periode.addEventListener("change", () => { K.UI.periodeId = this._periode.value; this.teken(); });
    const dicht = DT.el("button", { type: "button", class: "dt-cb-dicht", "aria-label": "Sluiten", title: "Sluiten (Esc)", html: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` });
    dicht.addEventListener("click", () => this.sluit());
    this._toast = DT.el("div", { class: "dt-cb-toast", role: "status", "aria-live": "polite" });
    laag.append(DT.el("aside", { class: "dt-cb-zij" }, [
      DT.el("div", { class: "dt-cb-merk" }, [DT.el("b", { text: "Te laat-balie" }), DT.el("small", { text: "Tardy in Magister" })]),
      nav, this._periode, this._stand,
    ]), DT.el("div", { class: "dt-cb-kolom" }, [DT.el("header", { class: "dt-cb-kop" }, [DT.el("h1", { class: "dt-cb-titel" }), dicht]), hoofd]), this._toast);
    this._view = this._view || "melden";
    for (const [id, naam] of [["melden", "Melden"], ["meldafspraken", "Meldafspraken"], ["signalen", "Signalen"], ["instellingen", "Instellingen"]]) {
      const b = DT.el("button", { type: "button", "data-view": id }, [DT.el("span", { text: naam }), DT.el("i", { class: "dt-cb-tel" })]);
      b.addEventListener("click", () => { this._view = id; this.teken(); });
      nav.append(b);
    }
    this._toets = (e) => {
      if (e.key === "Escape" && !e.target.closest?.(".dt-cb-modal") && !this._modal) { e.preventDefault(); this.sluit(); }
      else if (e.key === "Escape" && this._modal) { e.preventDefault(); this.sluitModal(); }
    };
    document.addEventListener("keydown", this._toets, true);
    document.body.append(laag);
    this._scherm = { laag, nav, hoofd };
    await this.koppel(DT);
  },

  sluit() {
    if (!this._scherm) return;
    clearInterval(this._timer);
    if (this._map && !this._kijkt) { this.schrijfNu().finally(() => this.bezettingVrij()); }
    this.scanStop();
    document.removeEventListener("keydown", this._toets, true);
    this._scherm.laag.remove(); this._scherm = null; this._modal = null;
  },

  /* Map openen of kiezen; daarna gegevens laden en de bezetting regelen. */
  async koppel(DT) {
    const h = this._scherm.hoofd;
    this._map = null;
    const handle = await this.kv("map").catch(() => null);
    if (!handle) return this.mapScherm(DT, "Kies de gedeelde map van Tardy", "Kies de map in je OneDrive of Teams waarin tardy-gegevens.json staat, dezelfde map die de Tardy-app gebruikt. Staat er nog niets, dan begint de balie daar met lege gegevens.");
    let mag = "prompt";
    try { mag = await handle.queryPermission({ mode: "readwrite" }); } catch {}
    if (mag !== "granted") {
      return this.mapScherm(DT, `Map "${handle.name}" openen`, "Chrome vraagt één keer per sessie of de balie deze map mag gebruiken.", async () => {
        const r = await handle.requestPermission({ mode: "readwrite" }).catch(() => "denied");
        if (r === "granted") return this.koppel(DT);
        this.melding("Zonder toegang tot de map kan de balie niets bewaren.", "err");
      }, "Map openen");
    }
    this._map = handle;
    const tekst = await this.lees(this.BESTAND);
    if (!tekst) {
      return this.mapScherm(DT, "Nog geen Tardy-gegevens in deze map", `In "${handle.name}" staat geen tardy-gegevens.json. Kies de map waarin Tardy al werkt, of begin hier met lege gegevens.`, async () => {
        const g = this.splits(TardyKern.leegeState());
        g.revisie = 1; g.gewijzigdDoor = this.mijnNaam(); g.gewijzigdOp = new Date().toISOString();
        await this.schrijf(this.BESTAND, JSON.stringify(g)).catch((e) => this.melding(String(e), "err"));
        return this.koppel(DT);
      }, "Beginnen met lege gegevens", true);
    }
    try { this.laadStand(JSON.parse(tekst)); }
    catch { return this.mapScherm(DT, "tardy-gegevens.json is niet te lezen", "Het bestand is beschadigd of nog niet helemaal gesynchroniseerd. Wacht even op OneDrive en probeer het opnieuw.", () => this.koppel(DT), "Opnieuw proberen"); }
    const b = await this.bezetting();
    this._kijkt = false; this._ander = null;
    if (this.bezetDoorAnder(b)) {
      this._ander = b; this._kijkt = true;
      this.modal("Tardy is in gebruik", [
        DT.el("p", { html: `<b>${TardyKern.esc(b.naam || "Een collega")}</b> werkt sinds ${TardyKern.esc(this.moment(b.sinds))} in Tardy${b.apparaatNaam ? `, op ${TardyKern.esc(b.apparaatNaam)}` : ""}.` }),
        DT.el("p", { class: "dt-cb-zacht", text: "Jullie werken om de beurt. Kijk je mee, dan zie je alles en blijft het bijgewerkt, maar bewaart de balie geen wijzigingen." }),
      ], [["Alleen bekijken", () => this.sluitModal()], ["Toch zelf verder", async () => { this._kijkt = false; this._ander = null; await this.herlaad(); await this.bezettingZet(); this.sluitModal(); this.teken(); }, true]]);
    } else await this.bezettingZet();
    clearInterval(this._timer); this._timer = setInterval(() => this.controle(), 30000);
    this.teken();
  },

  mapScherm(DT, titel, uitleg, actie = null, knop = "Map kiezen", ookKiezen = false) {
    const h = this._scherm.hoofd;
    this._scherm.laag.querySelector(".dt-cb-titel").textContent = "Gedeelde map";
    const kies = DT.el("button", { type: "button", class: "dt-cb-knop hoofd", text: actie ? knop : "Map kiezen" });
    kies.addEventListener("click", actie || (() => this.kiesMap(DT)));
    const extra = ookKiezen || actie ? DT.el("button", { type: "button", class: "dt-cb-knop", text: "Andere map kiezen" }) : null;
    extra?.addEventListener("click", () => this.kiesMap(DT));
    h.replaceChildren(DT.el("div", { class: "dt-cb-leeg groot" }, [DT.el("h2", { text: titel }), DT.el("p", { text: uitleg }), DT.el("div", { class: "dt-cb-rij" }, [kies, extra])]));
  },

  async kiesMap(DT) {
    if (!window.showDirectoryPicker) return this.melding("Deze browser kan geen map openen. Gebruik Chrome of Edge op een computer.", "err");
    try {
      const h = await window.showDirectoryPicker({ id: "dt-cb-tardy", mode: "readwrite" });
      await this.kv("map", h);
      await this.koppel(DT);
    } catch (e) { if (e?.name !== "AbortError") this.melding(`Map kiezen lukte niet: ${e.message || e}`, "err"); }
  },

  melding(tekst, soort = "info", ms = 4200) {
    if (!this._toast) return DT.toast(tekst, soort === "err" ? "err" : "info", ms);
    this._toast.textContent = tekst; this._toast.dataset.soort = soort; this._toast.classList.add("is-aan");
    clearTimeout(this._toastT); this._toastT = setTimeout(() => this._toast?.classList.remove("is-aan"), ms);
  },
  moment(isoTijd) {
    const d = new Date(isoTijd); if (isNaN(d)) return "onbekend";
    const vandaag = new Date().toDateString() === d.toDateString();
    return (vandaag ? "vandaag" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })) + " om " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  },

  modal(titel, inhoud, knoppen = [[ "Sluiten", () => this.sluitModal() ]]) {
    this.sluitModal();
    const kn = knoppen.map(([t, fn, hoofd]) => { const b = DT.el("button", { type: "button", class: `dt-cb-knop${hoofd ? " hoofd" : ""}`, text: t }); b.addEventListener("click", fn); return b; });
    const m = DT.el("div", { class: "dt-cb-modal" }, DT.el("div", { class: "dt-cb-modalin", role: "dialog", "aria-label": titel }, [DT.el("h2", { text: titel }), ...[].concat(inhoud), DT.el("div", { class: "dt-cb-rij eind" }, kn)]));
    m.addEventListener("click", (e) => { if (e.target === m) this.sluitModal(); });
    this._scherm.laag.append(m); this._modal = m;
    (kn[kn.length - 1] || m).focus?.();
    return m;
  },
  sluitModal() { this._modal?.remove(); this._modal = null; },

  tekenStand() {
    if (!this._stand) return;
    const K = TardyKern;
    const tekst = !this._map ? "Geen map gekozen"
      : this._kijkt ? `Alleen bekijken · ${this._ander?.naam || "een collega"} werkt nu`
      : `Map: ${this._map.name}${this._op ? ` · opgeslagen ${this.moment(this._op)}${this._door ? ` door ${this._door}` : ""}` : ""}`;
    this._stand.textContent = tekst;
    this._stand.classList.toggle("is-kijk", !!this._kijkt);
    if (K.S) {
      const nav = this._scherm?.nav; if (!nav) return;
      const zet = (v, n) => { const i = nav.querySelector(`[data-view="${v}"] .dt-cb-tel`); if (i) i.textContent = n ? String(n) : ""; };
      zet("meldafspraken", K.meldLijst().filter((m) => m.datum <= K.vandaag()).length);
      zet("signalen", K.hoogsteTreden(K.alleSignalen(K.UI.periodeId)).filter((s) => !s.afgehandeld).length);
    }
  },

  teken() {
    if (!this._scherm) return;
    const K = TardyKern;
    if (!K.S || !this._map) return;
    [...this._scherm.nav.children].forEach((b) => b.setAttribute("aria-current", String(b.dataset.view === this._view)));
    this._periode.replaceChildren(...K.periodes().map((p) => DT.el("option", { value: p.id, text: `${p.naam} · ${K.kortDatum(p.start)} – ${K.kortDatum(p.eind)}` })));
    this._periode.value = K.UI.periodeId;
    const titels = { melden: "Melden", meldafspraken: "Meldafspraken", signalen: "Signalen", instellingen: "Instellingen" };
    this._scherm.laag.querySelector(".dt-cb-titel").textContent = titels[this._view];
    this._scherm.laag.classList.toggle("is-kijk", !!this._kijkt);
    ({ melden: () => this.melden(DT), meldafspraken: () => this.afspraken(DT), signalen: () => this.signalen(DT), instellingen: () => this.instellingen(DT) })[this._view]();
    this.tekenStand();
  },

  /* ===================================================================================== */
  /* Studenten: gedeelde gegevens + Magister                                                */
  /* ===================================================================================== */
  zoekLokaal(q) {
    const K = TardyKern, s = q.trim().toLowerCase(); if (!s) return [];
    const kaal = s.replace(/^0+/, "");
    return Object.values(K.S.studenten).filter((st) => !st.archief).map((st) => {
      const naam = K.naamVan(st).toLowerCase(), nr = String(st.stamnr || ""), pas = String(st.pasnummer || "");
      const score = nr === s || nr.replace(/^0+/, "") === kaal || pas === s ? 0 : naam.startsWith(s) || (st.achternaam || "").toLowerCase().startsWith(s) ? 1 : naam.includes(s) || nr.includes(s) || (st.klas || "").toLowerCase() === s ? 2 : 9;
      return { st, score };
    }).filter((x) => x.score < 9).sort((a, b) => a.score - b.score || K.naamVan(a.st).localeCompare(K.naamVan(b.st), "nl")).slice(0, 12).map((x) => x.st);
  },
  async zoekMagister(q) {
    const peil = TardyKern.vandaag();
    const velden = ["stamnummer", "naam", "klassen", "emailadres", "KlassenMentor1", "PersoonlijkeMentor1"].map((v) => `&velden=${v}`).join("");
    const r = await DT.api(`/api/leerlingen/zoeken?q=${encodeURIComponent(q)}&top=8&skip=0&peildatum=${peil}${velden}`, { full: true, timeout: 10000 });
    const items = r.status === 200 && r.json ? (r.json.items || []) : [];
    return items.map((x) => ({
      magisterId: x.id, stamnr: String(x.code ?? x.stamnummer ?? ""), roepnaam: x.roepnaam || x.voorletters || "", tussenvoegsel: x.tussenvoegsel || "",
      achternaam: x.achternaam || "", klas: Array.isArray(x.klassen) ? (x.klassen[0] || "") : (x.klassen || ""),
      email: x.emailadres || "", klasMentor: x.klassenMentor1 || "", persMentor: x.persoonlijkeMentor1 || "",
    })).filter((x) => x.stamnr);
  },
  /* Student uit Magister in de gedeelde gegevens zetten (of de koppeling aanvullen). */
  async neemOver(m) {
    const K = TardyKern;
    let st = K.S.studenten[m.stamnr];
    if (!st) {
      st = K.S.studenten[m.stamnr] = { stamnr: m.stamnr, roepnaam: m.roepnaam, tussenvoegsel: m.tussenvoegsel || null, achternaam: m.achternaam, klas: m.klas };
      if (m.email) st.email = m.email;
      if (m.persMentor) st.persoonlijkeMentor = m.persMentor;
      /* Mentoren staan in Magister: is de klassenmentor nog onbekend in de gedeelde gegevens, dan de naam
       * overnemen (het e-mailadres vul je zo nodig in Tardy of in je mailprogramma aan). */
      const km = K.S.instellingen.klasMentoren ||= {};
      if (m.klas && m.klasMentor && !km[m.klas]) km[m.klas] = { naam: m.klasMentor, email: "" };
      const r = await DT.api(`/api/leerlingen/${encodeURIComponent(m.magisterId)}`, { full: true, timeout: 8000 });
      const p = r.status === 200 && r.json ? (r.json.persoon || r.json) : null;
      if (p) {
        const gb = p.geboortedatum || p.geboorteDatum;
        if (gb) st.geboortedatum = String(gb).slice(0, 10);
        const mail = p.emailadres || p.email;
        if (mail && !st.email) st.email = mail;
      }
      this.bewaar();
    }
    if (m.magisterId && st.magisterId !== m.magisterId) { st.magisterId = m.magisterId; this.bewaar(); }
    return st;
  },
  async persoonId() {
    if (this._persoonId !== undefined) return this._persoonId;
    const r = await DT.api("/api/account", { full: true, timeout: 8000 });
    return (this._persoonId = r.status === 200 && r.json ? (r.json.Persoon?.Id ?? r.json.persoon?.id ?? null) : null);
  },
  async openInMagister(st) {
    let id = st.magisterId;
    if (!id) { const hit = (await this.zoekMagister(st.stamnr)).find((x) => x.stamnr === String(st.stamnr)); id = hit?.magisterId; if (id) { st.magisterId = id; this.bewaar(); } }
    if (!id) return this.melding("Deze student is niet in Magister gevonden.", "err");
    const pid = await this.persoonId();
    window.open(`${location.origin}/op/#/att-verzuim/${id}/Alle%20rollen/${pid || ""}`, "_blank");
  },

  /* ===================================================================================== */
  /* Melden                                                                                 */
  /* ===================================================================================== */
  SNEL: { ongeoorloofd: ["TEL", "ONG", "UIT"], geoorloofd: ["CAL", "ZIE", "DOK", "TAN"] },

  melden(DT) {
    const K = TardyKern, h = this._scherm.hoofd;
    const zoek = DT.el("input", { type: "search", class: "dt-cb-zoek", placeholder: "Naam of stamnummer, of scan de pas…", autocomplete: "off", "aria-label": "Student zoeken" });
    const tijd = DT.el("input", { type: "time", class: "dt-cb-tijd", title: "Tijd van de melding; leeg = nu", "aria-label": "Tijd" });
    const scan = DT.el("button", { type: "button", class: "dt-cb-knop", title: "Studentenpas scannen met de camera", html: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 5V3h2M12 3h2v2M14 11v2h-2M4 13H2v-2M4 8h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Scan pas</span>` });
    const lijst = DT.el("div", { class: "dt-cb-hits", role: "listbox" });
    const paneel = DT.el("div", { class: "dt-cb-paneel" });
    const log = DT.el("div", { class: "dt-cb-log" });
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-zoekrij" }, [zoek, tijd, scan]),
      lijst, paneel,
      DT.el("section", { class: "dt-cb-kaart" }, [DT.el("div", { class: "dt-cb-kaartkop" }, [DT.el("h2", { text: "Vandaag" }), this.knop(DT, "Briefjes van vandaag printen", () => this.print(K.S.registraties.filter((r) => r.datum === K.vandaag() && ["telaat", "calamiteit"].includes((K.SOORT[r.soort] || {}).g)), true))]), log]),
    );
    let hits = [], sel = 0, mzoek = 0;
    const tekenHits = (lokaal, magister = []) => {
      hits = [...lokaal.map((st) => ({ st })), ...magister.filter((m) => !K.S.studenten[m.stamnr]).map((m) => ({ m }))];
      sel = Math.min(sel, Math.max(0, hits.length - 1));
      lijst.replaceChildren(...hits.map((x, i) => {
        const st = x.st || x.m, t = x.st ? K.tellingen(st.stamnr, K.UI.periodeId) : null;
        const b = DT.el("button", { type: "button", role: "option", class: "dt-cb-hit", "aria-selected": String(i === sel) }, [
          DT.el("span", { class: "dt-cb-mono", text: ((st.roepnaam || "")[0] || "") + ((st.achternaam || "")[0] || "") }),
          DT.el("span", { class: "dt-cb-hitnaam" }, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: `${st.klas || "geen klas"} · ${st.stamnr}${x.m ? " · uit Magister" : ""}` })]),
          t ? DT.el("span", { class: "dt-cb-hitstand", text: t.teLaat ? `${t.teLaat}× te laat` : "" }) : null,
        ]);
        b.addEventListener("click", () => kies(x));
        return b;
      }));
    };
    const kies = async (x) => {
      const st = x.st || await this.neemOver(x.m);
      this._gekozen = st.stamnr; zoek.value = ""; lijst.replaceChildren(); hits = [];
      this.tekenPaneel(DT, paneel, tijd);
    };
    zoek.addEventListener("input", () => {
      const q = zoek.value.trim(); sel = 0;
      const lokaal = this.zoekLokaal(q); tekenHits(lokaal);
      clearTimeout(this._zt);
      if (q.length >= 3) {
        const nr = ++mzoek;
        this._zt = setTimeout(async () => { const m = await this.zoekMagister(q); if (nr === mzoek && zoek.value.trim() === q) tekenHits(this.zoekLokaal(q), m); }, 350);
      }
    });
    zoek.addEventListener("keydown", async (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); tekenHits(hits.filter((x) => x.st).map((x) => x.st), hits.filter((x) => x.m).map((x) => x.m)); }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); tekenHits(hits.filter((x) => x.st).map((x) => x.st), hits.filter((x) => x.m).map((x) => x.m)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const q = zoek.value.trim();
        /* Pas of stamnummer (ook van een kaartlezer die als toetsenbord werkt): direct die student. */
        if (/^\d{3,}$/.test(q)) {
          const st = this.zoekLokaal(q)[0];
          if (st && (String(st.stamnr) === q || String(st.stamnr).replace(/^0+/, "") === q.replace(/^0+/, "") || String(st.pasnummer || "") === q)) return kies({ st });
          const m = (await this.zoekMagister(q)).find((x) => x.stamnr === q || x.stamnr.replace(/^0+/, "") === q.replace(/^0+/, ""));
          if (m) return kies(K.S.studenten[m.stamnr] ? { st: K.S.studenten[m.stamnr] } : { m });
        }
        if (hits[sel]) kies(hits[sel]);
      }
    });
    scan.addEventListener("click", () => this.scan(DT, (code) => { zoek.value = code; zoek.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); }));
    this.tekenPaneel(DT, paneel, tijd);
    this.tekenLog(DT, log);
    setTimeout(() => zoek.focus(), 30);
  },

  knop(DT, tekst, fn, hoofd = false, extra = "") {
    const b = DT.el("button", { type: "button", class: `dt-cb-knop${hoofd ? " hoofd" : ""}${extra ? " " + extra : ""}`, text: tekst });
    b.addEventListener("click", fn); return b;
  },

  tekenPaneel(DT, paneel, tijdVeld) {
    const K = TardyKern, st = this._gekozen && K.S.studenten[this._gekozen];
    const laatste = this._laatste && K.S.registraties.find((r) => r.id === this._laatste.id);
    const delen = [];
    if (laatste) delen.push(this.uitslag(DT, laatste));
    if (st) {
      const t = K.tellingen(st.stamnr, K.UI.periodeId), min18 = t.achttienMin, mentor = K.mentorVan(st);
      const tel = (c) => { const g = (K.SOORT[c] || {}).g; return g === "telaat" ? t.teLaat : g === "ongeoorloofd" ? t.ongeoorloofd : g === "calamiteit" ? t.calamiteit : g === "ziek" ? t.ziekDatums.length : g === "medisch" ? t.medDatums.length : 0; };
      const soortKnop = (c) => {
        const so = K.SOORT[c], n = tel(c);
        const b = DT.el("button", { type: "button", class: `dt-cb-soort ${so.ok ? "ok" : "nok"}` }, [DT.el("b", { text: so.n }), DT.el("small", { text: n ? `${n}× deze periode` : "nog niet" })]);
        b.addEventListener("click", () => { this.registreer(st.stamnr, c, tijdVeld.value); tijdVeld.value = ""; this.teken(); });
        return b;
      };
      const meer = DT.el("select", { class: "dt-cb-meer", "aria-label": "Meer soorten" }, [DT.el("option", { value: "", text: "Meer soorten…" }),
        ...K.SOORTEN.filter((s) => ![...this.SNEL.ongeoorloofd, ...this.SNEL.geoorloofd].includes(s.c)).map((s) => DT.el("option", { value: s.c, text: s.n }))]);
      meer.addEventListener("change", () => { if (meer.value) { this.registreer(st.stamnr, meer.value, tijdVeld.value); tijdVeld.value = ""; this.teken(); } });
      delen.push(DT.el("section", { class: "dt-cb-kaart dt-cb-student" }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [
          DT.el("div", { class: "dt-cb-wie" }, [
            DT.el("h2", { text: K.naamVan(st) }),
            DT.el("small", { text: [st.klas || "geen klas", st.stamnr, min18 === true ? "18−" : min18 === false ? "18+" : "leeftijd onbekend", mentor.naam ? `mentor ${mentor.naam}` : ""].filter(Boolean).join(" · ") }),
          ]),
          this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st)),
          this.knop(DT, "Sluiten", () => { this._gekozen = null; this.teken(); }, false, "stil"),
        ]),
        DT.el("div", { class: "dt-cb-soorten" }, [
          DT.el("div", { class: "dt-cb-groep nok" }, [DT.el("span", { text: "Ongeoorloofd" }), ...this.SNEL.ongeoorloofd.map(soortKnop)]),
          DT.el("div", { class: "dt-cb-groep ok" }, [DT.el("span", { text: "Geoorloofd" }), ...this.SNEL.geoorloofd.map(soortKnop)]),
        ]),
        meer,
      ]));
    }
    paneel.replaceChildren(...delen);
  },

  /* Zoals meldNu in Tardy: registratie, telling, gevolg volgens het protocol en zo nodig een meldafspraak. */
  registreer(stamnr, soort, tijd) {
    const K = TardyKern, S = K.S;
    if (this._kijkt) return this.melding(`${this._ander?.naam || "Je collega"} werkt nu in Tardy. Je kijkt mee, dus er wordt niets geregistreerd.`, "err");
    const groep = (K.SOORT[soort] || {}).g, d = K.vandaag();
    const reg = { id: K.uid(), stamnr, datum: d, tijd: tijd || K.nuTijd(), soort, reden: "", notitie: "", paraaf: S.instellingen.cbParaaf || "",
      terug: (groep === "telaat" || groep === "calamiteit") ? false : undefined };
    S.registraties.push(reg);
    const pid = (K.periodeVanDatum(d) || K.huidigePeriode()).id, t = K.tellingen(stamnr, pid);
    const aantal = groep === "telaat" ? t.teLaat : groep === "ongeoorloofd" ? t.ongeoorloofd : groep === "calamiteit" ? t.calamiteit : 0;
    const g = K.gevolgVan(groep, aantal, t.achttienMin);
    let meldDatum = null;
    if (g.meld && !S.meldafspraken.some((m) => m.stamnr === stamnr && m.status === "open")) {
      meldDatum = K.volgendeSchooldag(d);
      S.meldafspraken.push({ id: K.uid(), stamnr, datum: meldDatum, tijd: S.instellingen.meldTijd, aanleiding: groep, aanleidingTekst: "", status: "open", gemaaktOp: d, gemaild: false });
    }
    const per = (K.periodeById(pid) || { naam: "deze periode" }).naam.toLowerCase();
    const telzin = groep === "calamiteit" ? `${t.calamiteit}× calamiteit in ${per}` : groep === "telaat" ? `${t.teLaat}× te laat in ${per}`
      : groep === "ongeoorloofd" ? `${t.ongeoorloofd}× ongeoorloofd in ${per}` : groep === "ziek" ? `${t.ziekDatums.length} ziekdagen in ${per}` : groep === "medisch" ? `${t.medDatums.length} medische afspraken in ${per}` : "";
    this._laatste = { id: reg.id, niveau: g.niveau, gevolg: g.tekst, meldDatum, telzin };
    this._gekozen = null;
    if (groep === "calamiteit" && aantal >= 4) this.melding(`${S.studenten[stamnr].roepnaam} staat op ${aantal}× calamiteit: gesprek voeren en mentor informeren.`, "info", 7000);
    this.bewaar();
    if (S.instellingen.bonAuto && (groep === "telaat" || groep === "calamiteit")) this.print([reg]);
    return reg;
  },

  uitslag(DT, reg) {
    const K = TardyKern, st = K.S.studenten[reg.stamnr] || {}, l = this._laatste || {};
    const groep = (K.SOORT[reg.soort] || {}).g;
    const redenen = DT.el("div", { class: "dt-cb-chips" }, K.redenLijst(groep).map((r) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-chip", "aria-pressed": String(reg.reden === r), text: r });
      b.addEventListener("click", () => { reg.reden = reg.reden === r ? "" : r; this.bewaar(); this.teken(); });
      return b;
    }));
    const eigen = DT.el("input", { type: "text", class: "dt-cb-veld", placeholder: "Eigen reden of notitie", value: K.REDENEN.concat(K.REDENEN_CAL).includes(reg.reden) ? "" : reg.reden || "" });
    eigen.addEventListener("change", () => { reg.reden = eigen.value.trim(); this.bewaar(); this.teken(); });
    const opmerking = `${K.soortNaam(reg.soort)} ${reg.tijd}${reg.reden ? ` – ${reg.reden}` : ""}${reg.paraaf ? ` (${reg.paraaf})` : ""}`;
    return DT.el("section", { class: `dt-cb-kaart dt-cb-uitslag n${l.niveau || 0}` }, [
      DT.el("div", { class: "dt-cb-kaartkop" }, [
        DT.el("div", { class: "dt-cb-wie" }, [DT.el("h2", { text: `${K.naamVan(st)} · ${K.soortNaam(reg.soort)} ${reg.tijd}` }), DT.el("small", { text: l.telzin || "" })]),
        this.knop(DT, "Briefje printen", () => this.print([reg])),
        this.knop(DT, "Ongedaan maken", () => { K.S.registraties = K.S.registraties.filter((r) => r.id !== reg.id); if (l.meldDatum) K.S.meldafspraken = K.S.meldafspraken.filter((m) => !(m.stamnr === reg.stamnr && m.datum === l.meldDatum && m.gemaaktOp === reg.datum && m.status === "open")); this._laatste = null; this.bewaar(); this.teken(); }, false, "stil"),
      ]),
      l.gevolg ? DT.el("p", { class: "dt-cb-gevolg" }, [l.niveau ? DT.el("span", { class: `dt-cb-niveau n${l.niveau}`, text: K.NIVEAUNAAM[l.niveau] }) : null, DT.el("span", { text: l.gevolg })]) : null,
      l.meldDatum ? DT.el("p", { class: "dt-cb-afspraak", text: `Meldafspraak: ${K.langDatum(l.meldDatum)} om ${K.S.instellingen.meldTijd} uur, lokaal ${K.S.instellingen.lokaal || "—"}.` }) : null,
      DT.el("div", { class: "dt-cb-redenrij" }, [DT.el("span", { class: "dt-cb-label", text: "Reden" }), redenen, eigen]),
      DT.el("div", { class: "dt-cb-magister" }, [
        DT.el("span", { html: `In Magister: zet ${TardyKern.esc(st.roepnaam || "de student")} op <b>${TardyKern.esc(K.soortNaam(reg.soort))}</b>, met als opmerking:` }),
        DT.el("code", { text: opmerking }),
        this.knop(DT, "Kopieer opmerking", () => navigator.clipboard.writeText(opmerking).then(() => this.melding("Opmerking gekopieerd.")).catch(() => this.melding("Kopiëren lukte niet.", "err"))),
        this.knop(DT, "Open verzuim", () => this.openInMagister(st)),
      ]),
    ]);
  },

  tekenLog(DT, log) {
    const K = TardyKern;
    const regs = K.S.registraties.filter((r) => r.datum === K.vandaag()).sort((a, b) => (b.tijd || "").localeCompare(a.tijd || ""));
    const open = regs.filter((r) => r.terug === false).length;
    if (!regs.length) return log.replaceChildren(DT.el("p", { class: "dt-cb-zacht", text: "Nog niemand gemeld vandaag." }));
    log.replaceChildren(
      DT.el("p", { class: "dt-cb-zacht", text: `${regs.length} ${regs.length === 1 ? "melding" : "meldingen"}${open ? ` · ${open} ${open === 1 ? "briefje" : "briefjes"} niet terug` : ""}` }),
      DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, ["Tijd", "Student", "Soort", "Reden", "Briefje terug", ""].map((t) => DT.el("th", { text: t })))),
        DT.el("tbody", {}, regs.map((r) => {
          const st = K.S.studenten[r.stamnr] || {};
          const terug = r.terug === undefined ? DT.el("span", { class: "dt-cb-zacht", text: "—" }) : DT.el("input", { type: "checkbox", "aria-label": `Briefje van ${K.naamVan(st)} terug` });
          if (r.terug !== undefined) { terug.checked = !!r.terug; terug.addEventListener("change", () => { r.terug = terug.checked; this.bewaar(); }); }
          const reden = DT.el("input", { type: "text", class: "dt-cb-veld klein", value: r.reden || "", "aria-label": "Reden" });
          reden.addEventListener("change", () => { r.reden = reden.value.trim(); this.bewaar(); });
          return DT.el("tr", {}, [DT.el("td", { text: r.tijd }), DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}` })]),
            DT.el("td", { text: K.soortNaam(r.soort) }), DT.el("td", {}, reden), DT.el("td", {}, terug),
            DT.el("td", { class: "dt-cb-acties" }, [this.knop(DT, "Print", () => this.print([r]), false, "klein"),
              this.knop(DT, "Wis", () => { if (confirm(`Registratie van ${K.naamVan(st)} (${r.tijd}) verwijderen?`)) { K.S.registraties = K.S.registraties.filter((x) => x.id !== r.id); this.bewaar(); this.teken(); } }, false, "klein stil")])]);
        })),
      ]));
  },

  /* ---------- scannen: studentenpas met de camera ---------- */
  async scan(DT, klaar) {
    if (!("BarcodeDetector" in window)) return this.melding("Deze browser kan geen streepjescodes lezen met de camera (Chrome op een Mac wel). Een USB-scanner werkt altijd: scan in het zoekveld.", "err", 8000);
    let det; try { det = new BarcodeDetector(); } catch { return this.melding("Streepjescodes lezen lukt hier niet.", "err"); }
    const video = DT.el("video", { autoplay: "", playsinline: "", muted: "" });
    const m = this.modal("Pas scannen", [DT.el("div", { class: "dt-cb-scanvak" }, [video, DT.el("i")]), DT.el("p", { class: "dt-cb-zacht", text: "Houd de pas met de streepjescode voor de camera. Het beeld wordt niet bewaard." })], [["Stoppen", () => { this.scanStop(); this.sluitModal(); }]]);
    try { this._camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
    catch { this.sluitModal(); return this.melding("Geen toegang tot de camera.", "err"); }
    video.srcObject = this._camera;
    const kijk = async () => {
      if (!this._camera || !m.isConnected) return;
      try {
        const res = await det.detect(video);
        const code = res.find((x) => x.rawValue)?.rawValue;
        if (code) { this.scanStop(); this.sluitModal(); return klaar(code.trim()); }
      } catch {}
      this._scanT = setTimeout(kijk, 250);
    };
    video.addEventListener("loadeddata", kijk, { once: true });
  },
  scanStop() { clearTimeout(this._scanT); this._camera?.getTracks().forEach((t) => t.stop()); this._camera = null; },

  /* ---------- briefjes ---------- */
  async print(regs, a4 = false) {
    if (!regs.length) return this.melding("Geen briefjes om te printen.");
    const S = TardyKern.S;
    if (!a4 && S.instellingen.bonPrinter && navigator.bluetooth) {
      try { await this.bonPrint(regs); return this.melding(regs.length === 1 ? "Briefje geprint." : `${regs.length} briefjes geprint.`); }
      catch (e) { this.melding(`Bonprinter: ${e.message || e}. Ik print op de gewone printer.`, "err", 7000); }
    }
    const fr = DT.el("iframe", { style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0", "aria-hidden": "true" });
    document.body.append(fr);
    fr.srcdoc = TardyKern.briefjesHtml(regs);
    fr.addEventListener("load", () => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); }, { once: true });
  },

  /* Bonprintertje uit de Tiny Print-familie via Web Bluetooth, zelfde protocol als Tardy (dienst AE30,
   * schrijven op AE01, AE02 meldt "buffer vol" en "weer ruimte"). Blokken van 180 bytes. */
  async bonApparaat(nieuw = false) {
    if (!navigator.bluetooth) throw new Error("deze browser kan geen Bluetooth gebruiken");
    const naam = TardyKern.S.instellingen.bonPrinter?.naam;
    if (!nieuw && this._bon?.gatt) return this._bon;
    if (!nieuw && naam && navigator.bluetooth.getDevices) {
      const bekend = (await navigator.bluetooth.getDevices().catch(() => [])).find((d) => d.name === naam);
      if (bekend) return (this._bon = bekend);
    }
    const d = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0xae30] });
    this._bon = d;
    return d;
  },
  async bonPrint(regs) {
    const K = TardyKern, d = await this.bonApparaat();
    const server = d.gatt.connected ? d.gatt : await d.gatt.connect();
    const dienst = await server.getPrimaryService(0xae30).catch(() => { throw new Error("dit apparaat is geen bonprinter (dienst AE30 ontbreekt)"); });
    const schrijf = await dienst.getCharacteristic(0xae01);
    let pauze = false;
    try {
      const meld = await dienst.getCharacteristic(0xae02);
      await meld.startNotifications();
      meld.addEventListener("characteristicvaluechanged", (e) => {
        const v = new Uint8Array(e.target.value.buffer);
        if (v[0] === 0x51 && v[1] === 0x78 && v[2] === 0xae) pauze = v[6] === 0x10;
      });
    } catch {}
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const reg of regs) {
      const b = await K.bonBeeld(reg);
      const data = K.bonOpdracht(b.pix, b.breedte, b.hoogte, { zwarting: +K.S.instellingen.bonZwarting || 3 });
      for (let i = 0; i < data.length; i += 180) {
        let n = 0; while (pauze && n++ < 3000) await wacht(5);
        await (schrijf.writeValueWithoutResponse ? schrijf.writeValueWithoutResponse(data.subarray(i, i + 180)) : schrijf.writeValue(data.subarray(i, i + 180)));
        await wacht(4);
      }
      await wacht(600);
    }
    clearTimeout(this._bonLos); this._bonLos = setTimeout(() => { try { d.gatt.disconnect(); } catch {} }, 30000);
  },

  /* ===================================================================================== */
  /* Meldafspraken                                                                          */
  /* ===================================================================================== */
  afspraken(DT) {
    const K = TardyKern, h = this._scherm.hoofd, d = K.vandaag();
    const lijst = K.meldLijst();
    this._kies = new Set([...(this._kies || [])].filter((id) => lijst.some((m) => m.id === id)));
    const datum = DT.el("input", { type: "date", value: K.volgendeSchooldag(d) }), tijd = DT.el("input", { type: "time", value: K.S.instellingen.meldTijd || "08:30" });
    const balk = DT.el("div", { class: "dt-cb-bulk" }, [
      DT.el("b", { text: `${this._kies.size} gekozen` }), DT.el("label", {}, ["Datum ", datum]), DT.el("label", {}, ["Tijd ", tijd]),
      this.knop(DT, "Verzetten", () => { this.gekozenAfspraken().forEach((m) => { m.datum = datum.value; m.tijd = tijd.value; }); this.bewaar(); this.teken(); }),
      this.knop(DT, "Mails aanmaken", () => this.mailsMeldafspraak(DT, datum.value, tijd.value), true),
      this.knop(DT, "Verschenen", () => { this.gekozenAfspraken().forEach((m) => m.status = "verschenen"); this._kies.clear(); this.bewaar(); this.teken(); }),
      this.knop(DT, "Niet verschenen", () => { this.gekozenAfspraken().forEach((m) => this.nietVerschenen(m)); this._kies.clear(); this.bewaar(); this.teken(); }),
    ]);
    balk.hidden = !this._kies.size;
    const rij = (m) => {
      const st = K.S.studenten[m.stamnr], t = K.tellingen(m.stamnr, K.UI.periodeId), n = K.hoogsteNiveau(m.stamnr, K.UI.periodeId);
      const vink = DT.el("input", { type: "checkbox", "aria-label": `Kies ${K.naamVan(st)}` }); vink.checked = this._kies.has(m.id);
      vink.addEventListener("change", () => { vink.checked ? this._kies.add(m.id) : this._kies.delete(m.id); this.teken(); });
      const aantal = m.aanleiding === "ongeoorloofd" ? `${t.ongeoorloofd}× ongeoorloofd` : `${t.teLaat}× te laat`;
      return DT.el("tr", {}, [DT.el("td", {}, vink),
        DT.el("td", {}, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""}${K.minderjarig(st) === true ? " · 18−" : ""}` })]),
        DT.el("td", { text: K.AANLEIDING[m.aanleiding] || m.aanleiding }),
        DT.el("td", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: n ? `trede ${n}` : "—" }), DT.el("small", { text: ` ${aantal}` })]),
        DT.el("td", { text: `${K.langDatum(m.datum)} ${m.tijd || ""}` }),
        DT.el("td", { text: m.gemaild ? "gemaild" : st.email ? "nog niet gemaild" : "geen e-mailadres" }),
        DT.el("td", { class: "dt-cb-acties" }, [
          this.knop(DT, "Verschenen", () => { m.status = "verschenen"; this.bewaar(); this.teken(); }, false, "klein"),
          this.knop(DT, "Niet", () => { this.nietVerschenen(m); this.bewaar(); this.teken(); }, false, "klein"),
          this.knop(DT, "Vervalt", () => { K.S.meldafspraken = K.S.meldafspraken.filter((x) => x.id !== m.id); this.bewaar(); this.teken(); }, false, "klein stil")]),
      ]);
    };
    const groepen = [["Verlopen", lijst.filter((m) => m.datum < d)], ["Vandaag", lijst.filter((m) => m.datum === d)], ["Komende dagen", lijst.filter((m) => m.datum > d)]].filter(([, r]) => r.length);
    const alles = DT.el("input", { type: "checkbox", "aria-label": "Alles kiezen" }); alles.checked = !!lijst.length && this._kies.size === lijst.length;
    alles.addEventListener("change", () => { this._kies = new Set(alles.checked ? lijst.map((m) => m.id) : []); this.teken(); });
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("span", { class: "dt-cb-zacht", text: `${lijst.length} ${lijst.length === 1 ? "afspraak" : "afspraken"}` }), this.knop(DT, "Student toevoegen", () => this.handmatigeAfspraak(DT))]),
      balk,
      lijst.length ? DT.el("table", { class: "dt-cb-tabel" }, [
        DT.el("thead", {}, DT.el("tr", {}, [DT.el("th", {}, alles), ...["Student", "Aanleiding", "Ladder", "Wanneer", "Mail", ""].map((t) => DT.el("th", { text: t }))])),
        ...groepen.map(([titel, r]) => DT.el("tbody", {}, [DT.el("tr", { class: "dt-cb-groepkop" }, DT.el("td", { colspan: "7", text: `${titel} (${r.length})` })), ...r.map(rij)])),
      ]) : DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Niemand hoeft zich te melden. Registraties op Melden vullen deze lijst vanzelf." })),
    );
  },
  gekozenAfspraken() { return TardyKern.meldLijst().filter((m) => this._kies.has(m.id)); },
  nietVerschenen(m) {
    const K = TardyKern;
    m.status = "niet-verschenen";
    const d = K.volgendeSchooldag(m.datum);
    if (!K.S.meldafspraken.some((x) => x.stamnr === m.stamnr && x.datum === d && x.status === "open"))
      K.S.meldafspraken.push({ id: K.uid(), stamnr: m.stamnr, datum: d, tijd: K.S.instellingen.meldTijd, aanleiding: "nietgemeld", status: "open", gemaaktOp: K.vandaag(), gemaild: false });
  },
  handmatigeAfspraak(DT) {
    const K = TardyKern;
    const reden = DT.el("input", { type: "text", class: "dt-cb-veld", placeholder: "Reden (komt in de mail), bijv. je hebt je afspraak met de mentor gemist" });
    const zoek = DT.el("input", { type: "search", class: "dt-cb-veld", placeholder: "Zoek student op naam of stamnummer" });
    const hits = DT.el("div", { class: "dt-cb-hits klein" });
    zoek.addEventListener("input", () => hits.replaceChildren(...this.zoekLokaal(zoek.value).map((st) => {
      const b = DT.el("button", { type: "button", class: "dt-cb-hit" }, [DT.el("b", { text: K.naamVan(st) }), DT.el("small", { text: ` ${st.klas || ""} · ${st.stamnr}` })]);
      b.addEventListener("click", () => {
        if (K.S.meldafspraken.some((m) => m.stamnr === st.stamnr && m.status === "open")) return this.melding("Staat al op de lijst.");
        K.S.meldafspraken.push({ id: K.uid(), stamnr: st.stamnr, datum: K.volgendeSchooldag(K.vandaag()), tijd: K.S.instellingen.meldTijd, aanleiding: "handmatig", aanleidingTekst: reden.value.trim(), status: "open", gemaaktOp: K.vandaag(), gemaild: false });
        this.bewaar(); this.sluitModal(); this.teken(); this.melding(`${K.naamVan(st)} toegevoegd aan de meldlijst.`);
      });
      return b;
    })));
    this.modal("Student laten melden", [reden, zoek, hits]);
    setTimeout(() => zoek.focus(), 30);
  },

  /* ---------- mails ---------- */
  mailsMeldafspraak(DT, datum, tijd) {
    const K = TardyKern, sel = this.gekozenAfspraken();
    if (!sel.length) return this.melding("Kies eerst studenten.");
    const mails = sel.map((m) => Object.assign(K.mailTekst("student-meldafspraak", m.stamnr, K.UI.periodeId, { datum, tijd, melding: m }), { meldId: m.id, naam: K.naamVan(K.S.studenten[m.stamnr]) }));
    this.mailLijst(DT, `${mails.length} meldafspraak-mails`, `${K.langDatum(datum)} om ${tijd} uur · lokaal ${K.S.instellingen.lokaal || ""}`, mails, { datum, tijd });
  },
  mailLijst(DT, titel, sub, mails, afspraak = null) {
    const K = TardyKern, zonder = mails.filter((m) => !m.aan).length;
    const vastleggen = () => {
      mails.forEach((m) => {
        if (m.meldId) { const a = K.S.meldafspraken.find((x) => x.id === m.meldId); if (a) { if (afspraak) { a.datum = afspraak.datum; a.tijd = afspraak.tijd; } a.gemaild = true; } }
        (m.stamnrs || (m.stamnr ? [m.stamnr] : [])).forEach((sn) => K.S.mails.push({ id: K.uid(), stamnr: sn, type: m.type || "student-meldafspraak", aan: m.aan, onderwerp: m.onderwerp, op: K.vandaag() }));
      });
      this.bewaar(); this.sluitModal(); this.teken(); this.melding(`${mails.length} ${mails.length === 1 ? "mail" : "mails"} vastgelegd in de dossiers.`);
    };
    const open = (m) => { const a = document.createElement("a"); a.href = `mailto:${encodeURIComponent(m.aan || "")}?subject=${encodeURIComponent(m.onderwerp)}&body=${encodeURIComponent(m.body)}`; a.click(); };
    const kaarten = mails.map((m) => DT.el("div", { class: "dt-cb-mail" }, [
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("b", { text: `${m.naam || ""} → ${m.aan || "geen e-mailadres"}` }),
        this.knop(DT, "Open", () => open(m), false, "klein"), this.knop(DT, "Kopieer", () => navigator.clipboard.writeText(`${m.onderwerp}\n\n${m.body}`).then(() => this.melding("Gekopieerd.")), false, "klein")]),
      DT.el("div", { class: "dt-cb-onderwerp", text: m.onderwerp }), DT.el("pre", { text: m.body })]));
    this.modal(titel, [DT.el("p", { class: "dt-cb-zacht", text: sub }),
      zonder ? DT.el("p", { class: "dt-cb-waarschuw", text: `${zonder} ontvanger(s) zonder e-mailadres: vul het adres zelf in je mailprogramma in.` }) : null,
      DT.el("div", { class: "dt-cb-mails" }, kaarten)].filter(Boolean),
      [["Sluiten", () => this.sluitModal()], ["Alleen vastleggen", vastleggen],
       ["Alle openen in mailprogramma", () => { mails.forEach((m, i) => setTimeout(() => open(m), i * 800)); setTimeout(vastleggen, mails.length * 800 + 200); }, true]]);
  },

  /* ===================================================================================== */
  /* Signalen                                                                               */
  /* ===================================================================================== */
  signalen(DT) {
    const K = TardyKern, h = this._scherm.hoofd, pid = K.UI.periodeId;
    const alle = K.hoogsteTreden(K.alleSignalen(pid));
    const zicht = alle.filter((s) => this._metAfgehandeld || !s.afgehandeld);
    const toggle = DT.el("label", { class: "dt-cb-schakel" }, [DT.el("input", { type: "checkbox" }), DT.el("span", { text: "Ook afgehandeld" })]);
    toggle.firstChild.checked = !!this._metAfgehandeld;
    toggle.firstChild.addEventListener("change", (e) => { this._metAfgehandeld = e.target.checked; this.teken(); });
    const kaart = (s) => {
      const st = K.S.studenten[s.stamnr] || {};
      const mails = DT.el("div", { class: "dt-cb-chips" }, s.mails.map((type) => this.knop(DT, (K.MAILSOORT[type] || { label: type }).label, () => {
        const m = Object.assign(K.mailTekst(type, s.stamnr, pid), { naam: K.naamVan(st) });
        this.mailLijst(DT, (K.MAILSOORT[type] || { label: "Mail" }).label, `${K.naamVan(st)} · ${s.titel}`, [m]);
      }, false, "klein")));
      return DT.el("article", { class: `dt-cb-signaal n${s.niveau}${s.afgehandeld ? " is-af" : ""}` }, [
        DT.el("div", { class: "dt-cb-kaartkop" }, [
          DT.el("div", { class: "dt-cb-wie" }, [DT.el("h3", { text: K.naamVan(st) }), DT.el("small", { text: `${st.klas || ""} · ${s.titel}${s.onderliggend ? ` · omvat ${s.onderliggend} lichtere ${s.onderliggend === 1 ? "trede" : "treden"}` : ""}` })]),
          DT.el("span", { class: `dt-cb-niveau n${s.niveau}`, text: s.consequentie }),
        ]),
        DT.el("p", { text: s.maatregel }),
        DT.el("div", { class: "dt-cb-rij" }, [mails,
          s.afgehandeld ? this.knop(DT, "Heropen", () => { K.zetAfh(s.key, null); this.teken(); }, false, "klein stil")
            : this.knop(DT, "Afgehandeld", () => { const mee = K.handelAf(s.key); this.teken(); this.melding(mee ? `Afgehandeld, met ${mee} lichtere trede${mee === 1 ? "" : "n"} die hierin opgaat.` : "Afgehandeld."); }, true, "klein"),
          this.knop(DT, "Verzuim in Magister", () => this.openInMagister(st), false, "klein stil")]),
      ]);
    };
    const perNiveau = [4, 3, 2, 1].map((n) => [n, zicht.filter((s) => s.niveau === n)]).filter(([, l]) => l.length);
    h.replaceChildren(
      DT.el("div", { class: "dt-cb-rij" }, [DT.el("span", { class: "dt-cb-zacht", text: `${alle.filter((s) => !s.afgehandeld).length} open in ${(K.periodeById(pid) || {}).naam || ""}` }), toggle, this.knop(DT, "Overzicht per mentor…", () => this.mentorOverzicht(DT))]),
      ...(perNiveau.length ? perNiveau.map(([n, l]) => DT.el("section", { class: "dt-cb-niveaugroep" }, [DT.el("h2", {}, [DT.el("span", { class: `dt-cb-niveau n${n}`, text: `${n}` }), DT.el("span", { text: ` ${K.NIVEAUNAAM[n]} (${l.length})` })]), ...l.map(kaart)]))
        : [DT.el("div", { class: "dt-cb-leeg" }, DT.el("p", { text: "Geen signalen in deze periode." }))]),
    );
  },

  /* Zoals "Overzicht per mentor" in Tardy: één mail per mentor met alle studenten waar actie nodig is. */
  mentorOverzicht(DT) {
    const K = TardyKern, pid = K.UI.periodeId, p = K.periodeById(pid), groepen = {};
    Object.values(K.S.studenten).filter((st) => !st.archief).forEach((st) => {
      const t = K.tellingen(st.stamnr, pid), alle = K.signalenVoor(st.stamnr, pid), sig = alle.filter((x) => !x.afgehandeld);
      if (!alle.length) return;
      const m = K.mentorVan(st), k = K.mentorSleutel(st) || "zonder-mentor";
      (groepen[k] ||= { mentor: m, regels: [] }).regels.push({ st, t, sig, reeks: K.langsteReeks(t.ziekDatums).lengte });
    });
    const mails = Object.values(groepen).map((g) => {
      const mnaam = g.mentor.naam || "collega";
      g.regels.sort((a, b) => (b.sig[0]?.niveau || 0) - (a.sig[0]?.niveau || 0) || b.t.teLaat - a.t.teLaat);
      const lijnen = g.regels.map((r) => {
        const d = [];
        if (r.t.teLaat) d.push(`${r.t.teLaat}× te laat`);
        if (r.t.nietGemeld) d.push(`${r.t.nietGemeld}× niet gemeld bij de CB’er`);
        if (r.t.ongeoorloofd) d.push(`${r.t.ongeoorloofd}× ongeoorloofd`);
        if (r.reeks > 1) d.push(`${r.reeks} schooldagen aaneen ziek`);
        if (r.t.medDatums.length) d.push(`${r.t.medDatums.length} medische afspraken onder lestijd`);
        const zw = r.sig.slice().sort((a, b) => b.niveau - a.niveau)[0];
        return `• ${K.naamVan(r.st)} (${r.st.klas || "—"}) — ${d.join(", ") || "aandachtspunt"}${zw ? `\n  Wat er van jou wordt verwacht: ${zw.maatregel}` : ""}`;
      }).join("\n");
      const per = p ? p.naam.toLowerCase() : "deze periode";
      return { aan: g.mentor.email || "", type: "mentor-overzicht", naam: `${mnaam} (${g.regels.length})`, stamnrs: g.regels.map((r) => r.st.stamnr),
        onderwerp: `Verzuimoverzicht ${per} — ${g.regels.length} student(en)`,
        body: `Hoi ${mnaam},\n\nHierbij het verzuimoverzicht van ${per}. Bij ${g.regels.length === 1 ? "één student" : `${g.regels.length} studenten`} waarvan jij mentor bent is actie nodig:\n\n${lijnen}\n\nDe volledige registratie staat in Magister. Loop gerust even binnen in lokaal ${K.S.instellingen.lokaal || ""} als je ergens over wilt sparren.\n\n${K.ondertekening()}` };
    }).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!mails.length) return this.melding("Er is op dit moment niets te melden aan mentoren.");
    this.mailLijst(DT, `Overzicht voor ${mails.length} mentor(en)`, `${p ? p.naam : ""} · ${mails.reduce((n, m) => n + m.stamnrs.length, 0)} studenten`, mails);
  },

  /* ===================================================================================== */
  /* Instellingen                                                                           */
  /* ===================================================================================== */
  instellingen(DT) {
    const K = TardyKern, h = this._scherm.hoofd, i = K.S.instellingen, c = DT.settings.cb || {};
    const veld = (label, sleutel, type = "text", waarde = c[sleutel] || "", hint = "") => {
      const inp = DT.el("input", { type, class: "dt-cb-veld", value: waarde });
      inp.addEventListener("change", async () => { await DT.saveSettings({ cb: { [sleutel]: inp.value.trim() } }); Object.assign(K.S.instellingen, this.persoonlijk()); this.melding("Bewaard."); });
      return DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: label }), inp, hint ? DT.el("small", { text: hint }) : null]);
    };
    const meldtijd = DT.el("input", { type: "time", class: "dt-cb-veld", value: i.meldTijd || "08:30" });
    meldtijd.addEventListener("change", () => { i.meldTijd = meldtijd.value; this.bewaar(); this.melding("Meldtijd bewaard in de gedeelde gegevens."); });
    const zwarting = DT.el("select", { class: "dt-cb-veld" }, [1, 2, 3, 4, 5].map((n) => DT.el("option", { value: String(n), text: `Zwarting ${n}` })));
    zwarting.value = String(c.zwarting || 3);
    zwarting.addEventListener("change", async () => { await DT.saveSettings({ cb: { zwarting: +zwarting.value } }); Object.assign(K.S.instellingen, this.persoonlijk()); });
    const auto = DT.el("input", { type: "checkbox" }); auto.checked = !!c.autoPrint;
    auto.addEventListener("change", async () => { await DT.saveSettings({ cb: { autoPrint: auto.checked } }); Object.assign(K.S.instellingen, this.persoonlijk()); });
    const printer = i.bonPrinter?.naam;
    h.replaceChildren(
      DT.el("section", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Gedeelde map" }),
        DT.el("p", { text: this._map ? `In gebruik: "${this._map.name}" · revisie ${this._basis}${this._door ? ` · laatst opgeslagen door ${this._door} ${this.moment(this._op)}` : ""}.` : "Nog geen map gekozen." }),
        DT.el("p", { class: "dt-cb-zacht", text: "Dezelfde map als de Tardy-app: tardy-gegevens.json en tardy-in-gebruik.json. Jullie werken om de beurt. Een kopie van de stand blijft ook in deze browser bewaard (hooguit één per uur, de laatste 40, en bij een conflict)." }),
        DT.el("div", { class: "dt-cb-rij" }, [this.knop(DT, "Andere map kiezen", () => this.kiesMap(DT)), this.knop(DT, "Map loskoppelen", async () => { if (!confirm("De balie loskoppelen van deze map? De map zelf blijft staan.")) return; await this.bezettingVrij(); await this.kv("map", null); this._map = null; this.koppel(DT); }, false, "stil")])]),
      DT.el("section", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Jij" }), DT.el("p", { class: "dt-cb-zacht", text: "Alleen in deze browser, niet in de gedeelde map (zoals in Tardy)." }),
        veld("Naam", "naam"), veld("Paraaf", "paraaf"), veld("E-mail", "email", "email"), veld("Lokaal", "lokaal", "text", c.lokaal || i.lokaal || "", "staat in mails en op het briefje")]),
      DT.el("section", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Meldafspraken" }),
        DT.el("label", { class: "dt-cb-veldrij" }, [DT.el("span", { text: "Meldtijd" }), meldtijd, DT.el("small", { text: "gedeeld met Tardy" })]),
        DT.el("p", { class: "dt-cb-zacht", text: `Periodes, protocol, mentoren en mailteksten komen uit de gedeelde gegevens en pas je aan in de Tardy-app. Nu: ${K.protocol().naam || "standaardprotocol"}.` })]),
      DT.el("section", { class: "dt-cb-kaart" }, [DT.el("h2", { text: "Briefjes" }),
        DT.el("p", { text: printer ? `Bonprinter: ${printer}.` : "Geen bonprinter gekoppeld: briefjes gaan naar de gewone printer (twee per rij op A4)." }),
        DT.el("div", { class: "dt-cb-rij" }, [
          this.knop(DT, printer ? "Andere bonprinter" : "Bonprinter koppelen", async () => {
            try { const d = await this.bonApparaat(true); await DT.saveSettings({ cb: { printer: { naam: d.name || "Bonprinter", id: d.id } } }); Object.assign(K.S.instellingen, this.persoonlijk()); this.teken(); this.melding(`Gekoppeld: ${d.name || "bonprinter"}.`); }
            catch (e) { if (e?.name !== "NotFoundError") this.melding(`Koppelen lukte niet: ${e.message || e}`, "err"); }
          }),
          printer ? this.knop(DT, "Ontkoppelen", async () => { await DT.saveSettings({ cb: { printer: null } }); Object.assign(K.S.instellingen, this.persoonlijk()); this._bon = null; this.teken(); }, false, "stil") : null,
          this.knop(DT, "Testbriefje", () => this.print([{ id: "test", stamnr: "", datum: K.vandaag(), tijd: K.nuTijd(), soort: "TEL", reden: "Testbriefje", paraaf: i.cbParaaf || "" }])),
        ].filter(Boolean)),
        printer ? DT.el("div", { class: "dt-cb-rij" }, [zwarting, DT.el("label", { class: "dt-cb-schakel" }, [auto, DT.el("span", { text: "Automatisch printen na melden (te laat en calamiteit)" })])]) : null,
      ].filter(Boolean)),
    );
  },

  /* ===================================================================================== */
  css() {
    if (document.getElementById("dt-cb-style")) return;
    const st = document.createElement("style"); st.id = "dt-cb-style";
    st.textContent = `
      .dt-cb { --cb-bg: #F4F5F8; --cb-kaart: #fff; --cb-fg: #1D1D1F; --cb-zacht: #6E6E73; --cb-lijn: rgba(0,0,0,.08); --cb-acc: var(--dt-accent, #007AFF);
        --cb-rood: #D70015; --cb-groen: #248A3D; position: fixed; inset: 0; z-index: 2147481000; display: grid; grid-template-columns: 240px 1fr; background: var(--cb-bg); color: var(--cb-fg);
        font: 14px/1.4 var(--dt-font, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif); }
      html.dt-dark .dt-cb { --cb-bg: #1C1C1E; --cb-kaart: #2C2C2E; --cb-fg: #F2F2F7; --cb-zacht: #A1A1A6; --cb-lijn: rgba(255,255,255,.1); --cb-rood: #FF6961; --cb-groen: #30D158; }
      .dt-cb * { box-sizing: border-box; }
      .dt-cb input[type="checkbox"] { appearance: auto !important; -webkit-appearance: checkbox !important; width: 17px !important; height: 17px !important; margin: 0 !important; opacity: 1 !important;
        position: static !important; accent-color: var(--cb-acc); cursor: pointer; }
      .dt-cb-zij { display: flex; flex-direction: column; gap: 14px; padding: 20px 14px; background: var(--cb-kaart); border-right: 1px solid var(--cb-lijn); }
      .dt-cb-merk b { display: block; font-size: 19px; font-weight: 800; letter-spacing: -.02em; } .dt-cb-merk small { color: var(--cb-zacht); }
      .dt-cb-nav { display: flex; flex-direction: column; gap: 2px; }
      .dt-cb-nav button { appearance: none; border: 0; display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 12px; border-radius: 10px; background: none; color: inherit; font: 600 14px/1 inherit; font-family: inherit; cursor: pointer; text-align: left; }
      .dt-cb-nav button:hover { background: var(--cb-bg); }
      .dt-cb-nav button[aria-current="true"] { background: color-mix(in srgb, var(--cb-acc) 14%, transparent); color: var(--cb-acc); }
      .dt-cb-tel { font-style: normal; font-size: 12px; min-width: 20px; text-align: center; padding: 2px 6px; border-radius: 999px; background: var(--cb-acc); color: #fff; }
      .dt-cb-tel:empty { display: none; }
      .dt-cb-periode { height: 32px; border-radius: 8px; border: 1px solid var(--cb-lijn); background: var(--cb-bg); color: inherit; padding: 0 8px; font: inherit; }
      .dt-cb-stand { margin-top: auto; font-size: 12px; color: var(--cb-zacht); line-height: 1.4; }
      .dt-cb-stand.is-kijk { color: var(--cb-rood); font-weight: 600; }
      .dt-cb-kolom { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
      .dt-cb-kop { display: flex; align-items: center; gap: 12px; padding: 18px 28px 6px; }
      .dt-cb-titel { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.02em; flex: 1; }
      .dt-cb-dicht { appearance: none; border: 0; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--cb-kaart); color: inherit; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .dt-cb-hoofd { flex: 1; overflow: auto; padding: 10px 28px 40px; display: flex; flex-direction: column; gap: 14px; }
      .dt-cb.is-kijk .dt-cb-hoofd::before { content: "Alleen bekijken: een collega werkt nu in Tardy. Wijzigingen worden niet bewaard."; display: block; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--cb-rood) 12%, transparent); color: var(--cb-rood); font-weight: 600; }
      .dt-cb-kaart, .dt-cb-signaal { background: var(--cb-kaart); border-radius: 18px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04); }
      .dt-cb-kaart h2, .dt-cb-signaal h3 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.01em; }
      .dt-cb-kaartkop { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
      .dt-cb-wie { flex: 1; min-width: 200px; } .dt-cb-wie small { color: var(--cb-zacht); }
      .dt-cb-rij { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .dt-cb-rij.eind { justify-content: flex-end; margin-top: 14px; }
      .dt-cb-zacht { color: var(--cb-zacht); margin: 0; } .dt-cb-waarschuw { color: var(--cb-rood); font-weight: 600; }
      .dt-cb-knop { appearance: none; border: 0; height: 32px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font: 600 13px/1 inherit; font-family: inherit; cursor: pointer;
        background: color-mix(in srgb, var(--cb-acc) 12%, transparent); color: var(--cb-acc); white-space: nowrap; }
      .dt-cb-knop:hover { background: color-mix(in srgb, var(--cb-acc) 20%, transparent); }
      .dt-cb-knop.hoofd { background: var(--cb-acc); color: #fff; } .dt-cb-knop.stil { background: none; color: var(--cb-zacht); }
      .dt-cb-knop.klein { height: 26px; padding: 0 10px; font-size: 12px; }
      .dt-cb button:focus-visible, .dt-cb input:focus-visible, .dt-cb select:focus-visible { outline: 2px solid var(--cb-acc); outline-offset: 2px; }
      .dt-cb-zoekrij { display: flex; gap: 8px; }
      .dt-cb-zoek { flex: 1; height: 54px; border-radius: 16px; border: 2px solid var(--cb-lijn); background: var(--cb-kaart); color: inherit; padding: 0 18px; font: 600 20px/1 inherit; font-family: inherit; }
      .dt-cb-zoek:focus { border-color: var(--cb-acc); outline: none; }
      .dt-cb-tijd { width: 110px; height: 54px; border-radius: 16px; border: 2px solid var(--cb-lijn); background: var(--cb-kaart); color: inherit; padding: 0 10px; font: 600 16px/1 inherit; font-family: inherit; }
      .dt-cb-zoekrij .dt-cb-knop { height: 54px; border-radius: 16px; padding: 0 18px; }
      .dt-cb-hits { display: flex; flex-direction: column; gap: 4px; } .dt-cb-hits:empty { display: none; }
      .dt-cb-hit { appearance: none; border: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .dt-cb-hit[aria-selected="true"], .dt-cb-hit:hover { background: color-mix(in srgb, var(--cb-acc) 12%, var(--cb-kaart)); }
      .dt-cb-hitnaam { flex: 1; display: flex; flex-direction: column; } .dt-cb-hitnaam small, .dt-cb-hitstand { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-mono { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; background: color-mix(in srgb, var(--cb-acc) 14%, transparent); color: var(--cb-acc); }
      .dt-cb-soorten { display: grid; grid-template-columns: 3fr 4fr; gap: 12px; }
      .dt-cb-groep { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; padding: 10px; border-radius: 14px; }
      .dt-cb-groep > span { grid-column: 1 / -1; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .dt-cb-groep.nok { background: color-mix(in srgb, var(--cb-rood) 8%, transparent); } .dt-cb-groep.nok > span { color: var(--cb-rood); }
      .dt-cb-groep.ok { background: color-mix(in srgb, var(--cb-groen) 8%, transparent); } .dt-cb-groep.ok > span { color: var(--cb-groen); }
      .dt-cb-soort { appearance: none; border: 0; min-height: 64px; padding: 10px 12px; border-radius: 12px; background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column; justify-content: center; gap: 2px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
      .dt-cb-soort b { font-size: 15px; } .dt-cb-soort small { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-soort.nok:hover { box-shadow: inset 0 0 0 2px var(--cb-rood); } .dt-cb-soort.ok:hover { box-shadow: inset 0 0 0 2px var(--cb-groen); }
      .dt-cb-meer { margin-top: 10px; height: 32px; border-radius: 8px; border: 1px solid var(--cb-lijn); background: var(--cb-kaart); color: inherit; padding: 0 10px; font: inherit; }
      .dt-cb-uitslag { border-left: 6px solid var(--cb-zacht); }
      .dt-cb-uitslag.n1 { border-left-color: #FFCC00; } .dt-cb-uitslag.n2 { border-left-color: #FF9500; } .dt-cb-uitslag.n3 { border-left-color: #FF3B30; } .dt-cb-uitslag.n4 { border-left-color: #AF52DE; }
      .dt-cb-gevolg { display: flex; gap: 10px; align-items: baseline; margin: 0 0 8px; font-size: 15px; }
      .dt-cb-afspraak { margin: 0 0 8px; font-weight: 600; }
      .dt-cb-niveau { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; background: var(--cb-bg); }
      .dt-cb-niveau.n1 { background: #FFF4C2; color: #7A5C00; } .dt-cb-niveau.n2 { background: #FFE2C2; color: #8A4B00; } .dt-cb-niveau.n3 { background: #FFD6D3; color: #A1170D; } .dt-cb-niveau.n4 { background: #EBD7F7; color: #6B2C91; }
      .dt-cb-redenrij { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
      .dt-cb-label { font-size: 12px; font-weight: 700; color: var(--cb-zacht); text-transform: uppercase; letter-spacing: .06em; }
      .dt-cb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dt-cb-chip { appearance: none; border: 1px solid var(--cb-lijn); height: 30px; padding: 0 12px; border-radius: 999px; background: var(--cb-kaart); color: inherit; font: 600 13px/1 inherit; font-family: inherit; cursor: pointer; }
      .dt-cb-chip[aria-pressed="true"] { background: var(--cb-acc); color: #fff; border-color: var(--cb-acc); }
      .dt-cb-veld { height: 32px; border-radius: 8px; border: 1px solid var(--cb-lijn); background: var(--cb-kaart); color: inherit; padding: 0 10px; font: inherit; min-width: 220px; }
      .dt-cb-veld.klein { min-width: 140px; height: 28px; }
      .dt-cb-magister { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 12px; background: var(--cb-bg); font-size: 13px; }
      .dt-cb-magister code { padding: 3px 8px; border-radius: 6px; background: var(--cb-kaart); font: 600 13px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .dt-cb-tabel { width: 100%; border-collapse: collapse; background: var(--cb-kaart); border-radius: 14px; overflow: hidden; }
      .dt-cb-tabel th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--cb-zacht); padding: 10px 10px 6px; }
      .dt-cb-tabel td { padding: 7px 10px; border-top: 1px solid var(--cb-lijn); vertical-align: middle; }
      .dt-cb-tabel td small { color: var(--cb-zacht); }
      .dt-cb-groepkop td { font-weight: 800; background: var(--cb-bg); }
      .dt-cb-acties { white-space: nowrap; text-align: right; } .dt-cb-acties .dt-cb-knop { margin-left: 4px; }
      .dt-cb-bulk { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 14px; background: color-mix(in srgb, var(--cb-acc) 10%, var(--cb-kaart)); }
      .dt-cb-bulk[hidden] { display: none; }
      .dt-cb-bulk input { height: 30px; border-radius: 8px; border: 1px solid var(--cb-lijn); padding: 0 8px; font: inherit; background: var(--cb-kaart); color: inherit; }
      .dt-cb-leeg { padding: 40px; text-align: center; color: var(--cb-zacht); }
      .dt-cb-leeg.groot { max-width: 560px; margin: 8vh auto; background: var(--cb-kaart); border-radius: 22px; color: inherit; }
      .dt-cb-leeg.groot h2 { margin: 0 0 8px; } .dt-cb-leeg.groot .dt-cb-rij { justify-content: center; margin-top: 16px; }
      .dt-cb-niveaugroep { display: flex; flex-direction: column; gap: 8px; } .dt-cb-niveaugroep h2 { display: flex; gap: 8px; align-items: center; margin: 6px 0 0; font-size: 15px; }
      .dt-cb-signaal { border-left: 6px solid var(--cb-zacht); } .dt-cb-signaal p { margin: 0 0 10px; }
      .dt-cb-signaal.n1 { border-left-color: #FFCC00; } .dt-cb-signaal.n2 { border-left-color: #FF9500; } .dt-cb-signaal.n3 { border-left-color: #FF3B30; } .dt-cb-signaal.n4 { border-left-color: #AF52DE; }
      .dt-cb-signaal.is-af { opacity: .55; }
      .dt-cb-schakel { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
      .dt-cb-veldrij { display: grid; grid-template-columns: 140px minmax(200px, 340px) auto; gap: 10px; align-items: center; margin: 8px 0; }
      .dt-cb-veldrij small { color: var(--cb-zacht); }
      .dt-cb-modal { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; background: rgba(0,0,0,.35); }
      .dt-cb-modalin { width: min(720px, 92vw); max-height: 86vh; overflow: auto; background: var(--cb-kaart); border-radius: 20px; padding: 20px 22px; box-shadow: 0 30px 80px rgba(0,0,0,.35); display: flex; flex-direction: column; gap: 10px; }
      .dt-cb-modalin h2 { margin: 0; font-size: 18px; }
      .dt-cb-modalin .dt-cb-veld { width: 100%; }
      .dt-cb-mails { display: flex; flex-direction: column; gap: 10px; }
      .dt-cb-mail { border: 1px solid var(--cb-lijn); border-radius: 12px; padding: 10px 12px; }
      .dt-cb-mail .dt-cb-rij b { flex: 1; } .dt-cb-onderwerp { font-weight: 700; margin: 6px 0; }
      .dt-cb-mail pre { margin: 0; white-space: pre-wrap; font: 13px/1.45 inherit; font-family: inherit; color: var(--cb-zacht); max-height: 220px; overflow: auto; }
      .dt-cb-scanvak { position: relative; border-radius: 14px; overflow: hidden; background: #000; aspect-ratio: 4 / 3; }
      .dt-cb-scanvak video { width: 100%; height: 100%; object-fit: cover; }
      .dt-cb-scanvak i { position: absolute; inset: 30% 12%; border: 3px solid rgba(255,255,255,.85); border-radius: 12px; }
      .dt-cb-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; padding: 12px 18px; border-radius: 14px; background: #1D1D1F; color: #fff; font-weight: 600; max-width: 80vw; transition: opacity .2s, transform .2s; z-index: 3; }
      .dt-cb-toast.is-aan { opacity: 1; transform: translate(-50%, 0); } .dt-cb-toast[data-soort="err"] { background: var(--cb-rood); }
      @media (max-width: 900px) { .dt-cb { grid-template-columns: 1fr; } .dt-cb-zij { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 10px; } .dt-cb-nav { flex-direction: row; } .dt-cb-soorten { grid-template-columns: 1fr; } }
    `;
    document.head.append(st);
  },
});
