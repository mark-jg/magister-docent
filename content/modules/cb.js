/* Te laat-balie voor de community builder (CB'er): Tardy in Magister.
 *
 * Aan te zetten bij Instellingen › Community builder. Een subpagina van Aanwezigheid, net als Meldingen of
 * Registraties: tegel "Te laat-balie", kruimelpad Aanwezigheid › Te laat-balie, en opgebouwd uit Magisters eigen
 * paginakop, tabbladen, kaarten en knoppen (ook via het zijpaneel te openen). Rekent met de kern van Tardy (cb-kern.js, gegenereerd uit Tardy):
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
 * Dit bestand is het begin van de module (aanmelden, de tegel bij Aanwezigheid). De rest staat in delen die elk
 * methoden aan DtCb toevoegen: cb-opslag, cb-pagina, cb-melden, cb-afspraken, cb-signalen, cb-magister, cb-acties,
 * cb-protocol, cb-teksten en cb-css. cb-start.js meldt de module als laatste aan (zie de volgorde in manifest.json).
 * Briefjes: op een gewone printer, of op het Bluetooth-bonprintertje van Tardy (Web Bluetooth). */
var DtCb = {
  id: "cb",
  _stop: null,
  _scherm: null,

  init(DT) {
    /* In het logboek-frame van Magister (magister-lvs): alleen de notitie invullen. */
    if (!DT.isTop) {
      if (/^\/magister-lvs\//.test(location.pathname)) this._stop = DT.observe(() => this.vulNotitie(), { debounce: 250, poll: 1000, ookVerborgen: true });
      else if (/^\/magister-berichten\//.test(location.pathname)) this._stop = DT.observe(() => DTForms.vulBericht("dt-cb-bericht"), { debounce: 400, poll: 1000, ookVerborgen: true });
      return;
    }
    this._stop = DT.observe(() => { this.tegel(DT); this.menu(); this.vulAfspraak(); }, { debounce: 300, poll: 1500, ookVerborgen: true });
    /* Weg van Aanwezigheid: de balie sluit, net als elke andere subpagina. */
    this._hash = () => { if (this._scherm && !/^#\/aanwezigheid\/?$/.test(DT.route.pad())) this.sluit(true); };
    window.addEventListener("hashchange", this._hash);
    /* Terug en Vooruit in de browser: de balie en zijn tabbladen zijn stappen in de geschiedenis (DT.route). */
    this._routeStop = DT.route.luister("cb", (r) => {
      if (!r) { this.sluit(true); return; }
      if (!this._scherm) this.open(DT, true);
      else if (r.view && r.view !== this._view && this.VIEWS.some(([id]) => id === r.view)) { this._view = r.view; this.teken(); }
    });
  },

  destroy() {
    this._stop && this._stop();
    window.removeEventListener("hashchange", this._hash); this._routeStop && this._routeStop();
    this.sluit();
    DT.deepQueryAll("#dt-cb-tegel").forEach((el) => el.remove());
    document.querySelectorAll("#dt-menu-cb").forEach((el) => el.remove());
  },

  /* ---------- item in het hoofdmenu ---------- */
  /* Staat de balie aan, dan staat hij ook in Magisters hoofdmenu. Het item opent de balie (via Aanwezigheid, waar
   * de pagina onder hangt) en is het actieve item zolang de balie open is; Aanwezigheid is dat dan even niet. */
  MENU_ICOON: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 1h6v2H9V1zm10.03 6.39 1.42-1.42-1.41-1.41-1.42 1.42A8.96 8.96 0 0 0 12 4a9 9 0 1 0 7.03 3.39zM12 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm1-11h-2v5.41l3.3 3.3 1.4-1.42-2.7-2.7V9z"/></svg>`,
  menu() {
    const li = DT.menuItem({ id: "dt-menu-cb", titel: "Te laat-balie", tip: "Te laat-balie (Docent Tools)", icoon: this.MENU_ICOON, href: "#/aanwezigheid", klik: () => this.open(DT) });
    if (!li) return;
    const ul = li.parentElement;
    if (!ul._dtCb) {
      ul._dtCb = true;
      /* Een ander menu-item gekozen: de balie sluit, ook als Magister daarbij niet van adres wisselt (Aanwezigheid). */
      ul.addEventListener("click", (e) => {
        if (!this._scherm || !e.target.closest?.("a") || e.target.closest("#dt-menu-cb")) return;
        this.sluit(true);
        /* Wisselt Magister niet van adres (Aanwezigheid), dan krijgt de geschiedenis zelf een stap zonder balie. */
        setTimeout(() => { if (!this._scherm && DT.route.nu("cb")) DT.route.zet(null); }, 300);
      }, true);
    }
    if (this._scherm) {
      for (const x of ul.querySelectorAll(":scope > li.active")) if (x !== li) { x.classList.remove("active"); this._wasActief = x; }
      li.classList.add("active");
    } else if (li.classList.contains("active")) {
      li.classList.remove("active");
      if (this._wasActief?.isConnected && /^#\/aanwezigheid/.test(location.hash) && !ul.querySelector(":scope > li.active")) this._wasActief.classList.add("active");
      this._wasActief = null;
    }
  },

  /* ---------- tegel op Aanwezigheid ---------- */
  tegel(DT) {
    const wrap = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector(".wrapper");
    if (!wrap) return;
    /* Na herladen of via het zijpaneel: de balie staat nog open voor deze sessie. */
    let nogOpen = false; try { nogOpen = sessionStorage.getItem("dt-cb-open") === "1"; } catch {}
    if (nogOpen && !this._scherm && /^#\/aanwezigheid\/?$/.test(DT.route.pad()) && document.querySelector("mg-att-tiles")) this.open(DT);
    DT.navTegel(wrap, {
      id: "dt-cb-tegel", titel: "Te laat-balie", tekst: "Melden, briefjes, meldafspraken en signalen volgens het verzuimprotocol (Tardy)",
      viewBox: "0 0 32 32",
      icoon: `<circle cx="16" cy="18" r="11" fill="var(--sl-icon-fill-accent)"/><g fill="none" stroke="var(--sl-icon-fill-default)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="18" r="11"/><path d="M16 11.5V18l4 3M12.5 3h7M16 3v4"/></g>`,
      open: () => this.open(DT)
    });
  },
};
