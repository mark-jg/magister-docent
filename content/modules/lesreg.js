/* Lesregistraties: aanwezigheid van één of meer klassen, per vak of docent, over een instelbare periode.
 *
 * Aanwezigheid › tegel Lesregistraties (een subpagina zoals het leaderboard), of zijpaneel › Acties › Lesregistraties. Kies klassen (uit Magister) en een periode; per student worden het
 * rooster en de registraties opgehaald (dezelfde bron en berekening als Inzicht: vzStats in verzuiminzicht.js).
 * Daarna filter je direct op vak en/of docent en bekijk je:
 *  - Per student: lessen, aanwezig, te laat, gemist, ziek, ongeoorloofd, uitgestuurd en aanwezig %;
 *  - Per les: elk lesmoment (datum, tijd, vak, docent) met wie er te laat of afwezig was;
 *  - Per vak en per docent: de totalen.
 * Alles is naar Excel te exporteren (ook een blad met elke les per student en de registraties). Er wordt niets in
 * Magister gewijzigd; alles via je eigen Magister-sessie. */
DT.register({
  id: "lesreg",
  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 300, poll: 1500 });
    this._hash = () => { if (this._dlg && !/^#\/aanwezigheid\/?$/.test(location.hash)) this.sluit(); };
    window.addEventListener("hashchange", this._hash);
  },
  destroy() {
    this._stop && this._stop(); window.removeEventListener("hashchange", this._hash);
    this.sluit(); DT.deepQueryAll("#dt-lr-tegel").forEach((el) => el.remove());
  },
  sluit() { this._dlg?.remove(); this._dlg = null; document.querySelectorAll(".dt-lr-open").forEach((el) => el.classList.remove("dt-lr-open")); },

  /* ---------- tegel op Aanwezigheid ---------- */
  mount(DT) {
    const wrap = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector(".wrapper");
    if (this._dlg && (!this._dlg.isConnected || !document.querySelector("mg-att-tiles"))) this.sluit();
    let wil = false; try { wil = sessionStorage.getItem("dt-lr-open") === "1"; } catch {}
    if (wil && document.querySelector("mg-att-tiles") && !this._dlg) { try { sessionStorage.removeItem("dt-lr-open"); } catch {} this.open(DT, true); }
    const oud = wrap?.querySelector("#dt-lr-tegel");
    if (oud && oud.shadowRoot?.querySelector("h1")?.textContent.trim() !== "Lesregistraties") window.postMessage({ type: "dt:attr:opnieuw", selector: "#dt-lr-tegel", attr: "heading" }, "*");
    if (!wrap || oud) return;
    const c = document.createElement("dna-link-card");
    c.id = "dt-lr-tegel"; c.setAttribute("heading", "Lesregistraties"); c.setAttribute("tabindex", "0"); c.setAttribute("role", "link"); c.style.cursor = "pointer";
    const oms = document.createElement("div"); oms.slot = "description"; oms.textContent = "Aanwezigheid van klassen per vak of docent, met export";
    const ic = document.createElement("dna-icon"); ic.slot = "icon"; ic.setAttribute("name", "fad-traffic-light");
    c.append(oms, ic);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); this.open(DT, true); };
    c.addEventListener("click", open);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
    wrap.append(c);
    this.icoon(ic);
  },
  icoon(ic, poging = 0) {   // tabel met vinkjes, in Magisters duotone-stijl
    const svg = ic.shadowRoot?.querySelector("svg");
    if (!svg) { if (poging < 20) setTimeout(() => this.icoon(ic, poging + 1), 150); return; }
    svg.setAttribute("viewBox", "0 0 512 512");
    svg.innerHTML = `<path opacity=".4" d="M64 96h384v320H64z"></path><path d="M48 64h416a32 32 0 0 1 32 32v320a32 32 0 0 1-32 32H48a32 32 0 0 1-32-32V96a32 32 0 0 1 32-32zm16 64v64h96v-64H64zm144 0v64h240v-64H208zM64 240v64h96v-64H64zm144 0v64h240v-64H208zM64 352v64h96v-64H64zm144 0v64h240v-64H208z"></path>`;
  },

  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  sj(nu = new Date()) { return new Date(nu.getFullYear() - (nu.getMonth() < 7 ? 1 : 0), 7, 1); },
  naam(p) { return [p?.roepnaam || p?.voorletters, p?.tussenvoegsel, p?.achternaam].filter(Boolean).join(" "); },
  tijd(d) { return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; },
  datum(d) { return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; },
  CAT: { OK: "aanwezig", TL: "te laat", AB_OK: "absent geoorloofd", AB_NO: "absent ongeoorloofd", ZK: "ziek", UI: "uitgestuurd", VR: "vrijgesteld" },

  periodes(DT) {
    const nu = new Date(), sj = this.sj(nu), dag = (n) => new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - n);
    const uit = [
      { key: "jaar", naam: `Dit schooljaar (${sj.getFullYear()}–${sj.getFullYear() + 1})`, van: sj, tot: nu },
      { key: "4w", naam: "Laatste 4 weken", van: dag(28), tot: nu },
      { key: "8w", naam: "Laatste 8 weken", van: dag(56), tot: nu },
      { key: "1w", naam: "Laatste week", van: dag(7), tot: nu },
    ];
    for (const p of DT.periodes?.() || []) uit.push({ key: `p:${p.id}`, naam: p.naam, van: p.begin, tot: p.einde < nu ? p.einde : nu });
    uit.push({ key: "eigen", naam: "Eigen datums…" });
    return uit;
  },

  /* ---------- venster ---------- */
  async open(DT, pagina = null) {
    if (this._dlg) return;
    /* Vanuit het zijpaneel: naar Aanwezigheid en daar de subpagina openen. */
    if (pagina === null) {
      if (!/^#\/aanwezigheid\/?$/.test(location.hash) || !document.querySelector("mg-att-tiles")) {
        try { sessionStorage.setItem("dt-lr-open", "1"); } catch {}
        location.hash = "#/aanwezigheid"; return;
      }
      pagina = true;
    }
    this.css();
    const peil = this.ymd(new Date());
    let r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&peildatum=${peil}`, { full: true, timeout: 12000 });
    let klassen = r.status === 200 ? (r.json?.klassen || []) : [];
    if (!klassen.length) { r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&rol=Docent&peildatum=${peil}`, { full: true, timeout: 12000 }); klassen = r.status === 200 ? (r.json?.klassen || []) : []; }
    if (!klassen.length) return DT.toast("Geen klassen gevonden in Magister.", "err", 5000);
    klassen.sort((a, b) => String(a.naam).localeCompare(String(b.naam), "nl", { numeric: true }));
    let bewaard = []; try { bewaard = JSON.parse(localStorage.getItem("dt-lesreg-klassen") || "[]"); } catch {}
    const gekozen = new Set(bewaard.filter((k) => klassen.some((x) => x.naam === k)));
    const chips = DT.el("div", { class: "dt-lr-chips" }, klassen.map((k) => {
      const b = DT.el("button", { type: "button", class: "dt-lr-chip", "aria-pressed": String(gekozen.has(k.naam)), text: `${k.naam}${k.aantal ? ` (${k.aantal})` : ""}` });
      b.addEventListener("click", () => { gekozen.has(k.naam) ? gekozen.delete(k.naam) : gekozen.add(k.naam); b.setAttribute("aria-pressed", String(gekozen.has(k.naam))); });
      return b;
    }));
    const keuzes = this.periodes(DT);
    const per = DT.el("select", { class: "dt-lr-veld dt-lr-periode" }, keuzes.map((k) => DT.el("option", { value: k.key, text: k.naam })));
    const nu = (DT.periodes?.() || []).find((p) => new Date() >= p.begin && new Date() <= p.einde); per.value = nu ? `p:${nu.id}` : "4w";
    const van = DT.el("input", { type: "date", class: "dt-lr-veld" }), tot = DT.el("input", { type: "date", class: "dt-lr-veld", value: peil });
    van.value = this.ymd(new Date(Date.now() - 28 * 864e5));
    const eigen = DT.el("span", { class: "dt-lr-eigen" }, [van, DT.el("span", { text: "t/m" }), tot]);
    const toonEigen = () => { eigen.style.display = per.value === "eigen" ? "" : "none"; };
    per.addEventListener("change", toonEigen); toonEigen();
    const status = DT.el("p", { class: "dt-lr-zacht dt-lr-status", "aria-live": "polite" });
    const balk = DT.el("div", { class: "dt-lr-balk" }, DT.el("i"));
    const resultaat = DT.el("div", { class: "dt-lr-resultaat" });
    const start = this.knop(DT, "Ophalen", null, true);
    let afbreken = false, bezig = false;
    const weg = () => { afbreken = true; this.sluit(); };
    start.addEventListener("click", async () => {
      if (bezig) return;
      if (!gekozen.size) return DT.toast("Kies eerst één of meer klassen.", "err");
      try { localStorage.setItem("dt-lesreg-klassen", JSON.stringify([...gekozen])); } catch {}
      let p = keuzes.find((k) => k.key === per.value);
      if (p.key === "eigen") {
        const x = new Date(`${van.value}T00:00:00`), y = new Date(`${tot.value}T23:59:59`);
        if (isNaN(x) || isNaN(y) || y < x) return DT.toast("Kies een geldige begin- en einddatum.", "err");
        p = { key: "eigen", naam: `${this.datum(x)} t/m ${this.datum(y)}`, van: x, tot: y > new Date() ? new Date() : y };
      }
      bezig = true; start.setAttribute("disabled", ""); resultaat.replaceChildren(); balk.classList.add("is-bezig");
      try {
        this._data = await this.ophalen(DT, [...gekozen], p, (i, n, t) => { if (afbreken) throw new Error("afgebroken"); balk.firstChild.style.width = `${Math.round(100 * i / Math.max(1, n))}%`; status.textContent = t; });
        this._filter = { vakken: new Set(), docenten: new Set(), weergave: this._filter?.weergave || "student" };
        this.teken(DT, resultaat, status);
      } catch (e) { if (String(e.message) !== "afgebroken") status.textContent = `Er ging iets mis: ${e.message || e}`; }
      bezig = false; start.removeAttribute("disabled"); balk.classList.remove("is-bezig");
    });
    /* Magisters eigen paginakop met kruimelpad, zoals Meldingen en Registraties (invert als de echte kop dat ook is). */
    const kop = DT.el("dna-page-header", { heading: "Lesregistraties" });
    const echt = DT.deepQuery("att-attendance-dashboard")?.shadowRoot?.querySelector("dna-page-header");
    if (!echt || echt.hasAttribute("invert")) kop.setAttribute("invert", "");
    const terug = DT.el("a", { href: "#/aanwezigheid", text: "Aanwezigheid" });
    terug.addEventListener("click", (e) => { e.preventDefault(); weg(); });
    kop.append(DT.el("dna-breadcrumb", { slot: "breadcrumb" }, terug), DT.el("dna-breadcrumb", { slot: "breadcrumb", text: "Lesregistraties" }));
    const pagina_ = DT.el("section", { id: "dt-lrp", class: "dt-lr", "aria-label": "Lesregistraties" }, [kop,
      DT.el("div", { class: "dt-lr-inhoud" }, [
        DT.el("dna-card", { class: "dt-lr-kaart" }, [
          DT.el("h2", { text: "Selectie" }),
          DT.el("p", { class: "dt-lr-zacht", text: "Kies één of meer klassen en een periode. Daarna filter je op vak of docent." }),
          DT.el("div", { class: "dt-lr-veldgroep" }, [DT.el("span", { class: "dt-lr-label", text: "Klassen" }), chips]),
          DT.el("div", { class: "dt-lr-rij" }, [DT.el("label", { class: "dt-lr-veldgroep" }, [DT.el("span", { class: "dt-lr-label", text: "Periode" }), per]), eigen, start]),
          balk, status,
        ]),
        resultaat,
      ])]);
    const tiles = document.querySelector("mg-att-tiles"), uv = tiles?.parentElement;
    if (!uv) return;
    uv.classList.add("dt-lr-open"); tiles.after(pagina_);
    this._dlg = pagina_;
    this.componenten();
  },
  /* Magisters onderdelen negeren attributen die de extensie zet; het netwerk-script in de pagina zet ze opnieuw. */
  componenten() {
    window.postMessage({ type: "dt:attr:opnieuw", diep: false, selector: "#dt-lrp :is(dna-page-header, dna-tabs, dna-tab-bar, dna-button, dna-card)", attr: ["heading", "invert", "orientation", "variant", "fill", "size"] }, "*");
  },
  knop(DT, tekst, fn, hoofd = false, extra = "") {
    const b = DT.el("dna-button", { class: "dt-lr-knop", text: tekst, ...(hoofd ? { variant: "primary" } : {}), ...(/stil/.test(extra) ? { fill: "clear" } : {}), ...(/klein/.test(extra) ? { size: "sm" } : {}) });
    if (fn) b.addEventListener("click", fn);
    return b;
  },

  /* ---------- ophalen ---------- */
  async ophalen(DT, klassen, per, voortgang) {
    const peil = this.ymd(new Date());
    const lijst = (x) => (x && x.status === 200 && x.json) ? (Array.isArray(x.json) ? x.json : x.json.items || []) : null;
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    const api = async (url) => { let x; for (let i = 0; i < 6; i++) { x = await DT.api(url, { full: true, timeout: 25000 }); if (x.status !== 429 && x.status !== 503) return x; voortgang(klaar, lln.length, "Even wachten: Magister vraagt om rustiger aan te doen…"); await wacht(1500 * 2 ** i); } return x; };
    const lln = [];
    let klaar = 0;
    for (const klas of klassen) {
      voortgang(0, 1, `Klas ${klas} ophalen…`);
      const z = await api(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam`);
      for (const x of lijst(z) || []) if (!lln.some((l) => l.id === x.id)) lln.push({ id: x.id, naam: this.naam(x), achternaam: x.achternaam || "", stam: String(x.code ?? x.stamnummer ?? ""), klas });
    }
    lln.sort((a, b) => a.klas.localeCompare(b.klas, "nl", { numeric: true }) || a.achternaam.localeCompare(b.achternaam, "nl"));
    const werk = lln.slice(), uit = [];
    const doe = async () => {
      while (werk.length) {
        const l = werk.shift();
        voortgang(klaar, lln.length, `Student ${klaar + 1} van ${lln.length}: ${l.naam}`);
        const v = await api(`/api/m6/leerlingen/${l.id}/verantwoordingen?begin=${this.ymd(per.van)}&einde=${this.ymd(per.tot)}`); await wacht(120);
        const a = await api(`/api/leerlingen/${l.id}/afspraken?status=actief&begin=${this.ymd(per.van)}&einde=${this.ymd(per.tot)}`); await wacht(120);
        const regs = lijst(v), rooster = lijst(a);
        if (regs && rooster && typeof vzLosseLessen === "function") rooster.push(...await vzLosseLessen(l.id, regs, rooster, api));
        const S = regs && rooster ? vzStats(regs, rooster, per.van, per.tot) : null;
        uit.push({ l, lessen: S ? S.lessen : [], fout: S ? null : (v.status !== 200 ? v.status : a.status) });
        klaar++;
      }
    };
    await Promise.all([doe(), doe()]);
    voortgang(lln.length, lln.length, "");
    uit.sort((x, y) => lln.indexOf(x.l) - lln.indexOf(y.l));
    return { per, klassen, studenten: uit };
  },

  /* ---------- berekenen ---------- */
  past(l) { const f = this._filter; return (!f.vakken.size || f.vakken.has(l.vak)) && (!f.docenten.size || (l.docent || "").split(", ").some((d) => f.docenten.has(d))); },
  telling(lessen) {
    const g = { lessen: 0, telt: 0, aanwezig: 0, teLaat: 0, afwezig: 0, ziek: 0, abOk: 0, abNo: 0, ui: 0, vrij: 0, pct: null };
    for (const l of lessen) {
      g.lessen++;
      if (l.cat === "VR") { g.vrij++; continue; }
      g.telt++;
      if (l.cat === "OK" || l.cat === "TL") { g.aanwezig++; if (l.cat === "TL") g.teLaat++; } else { g.afwezig++; if (l.cat === "ZK") g.ziek++; if (l.cat === "AB_OK") g.abOk++; if (l.cat === "AB_NO") g.abNo++; if (l.cat === "UI") g.ui++; }
    }
    g.pct = g.telt ? Math.round(100 * g.aanwezig / g.telt) : null;
    return g;
  },
  /* Lesmomenten over studenten heen: zelfde begin, vak en docent. */
  momenten(studenten) {
    const per = new Map();
    for (const s of studenten) for (const l of s.lessen) {
      if (!this.past(l)) continue;
      const k = `${l.begin.getTime()}|${l.vak}|${l.docent}`;
      if (!per.has(k)) per.set(k, { begin: l.begin, einde: l.einde, vak: l.vak, docent: l.docent, klassen: new Set(), rijen: [] });
      const m = per.get(k); m.klassen.add(s.l.klas); m.rijen.push({ s: s.l, l });
    }
    return [...per.values()].sort((a, b) => a.begin - b.begin);
  },
  groepen(studenten, sleutel) {
    const per = new Map();
    for (const s of studenten) for (const l of s.lessen) {
      if (!this.past(l)) continue;
      const ks = sleutel === "docent" ? (l.docent || "—").split(", ") : [l.vak];
      for (const k of ks) { if (!per.has(k)) per.set(k, []); per.get(k).push(l); }
    }
    return [...per.entries()].map(([k, ls]) => ({ naam: k, ...this.telling(ls) })).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  },

  weken(studenten) {
    const per = new Map();
    for (const s of studenten) for (const l of s.lessen) {
      if (!this.past(l)) continue;
      const w = isoWeek(l.begin), k = `${w.y}-${String(w.w).padStart(2, "0")}`;
      if (!per.has(k)) { const ma = new Date(l.begin); ma.setDate(ma.getDate() - ((ma.getDay() + 6) % 7)); per.set(k, { k, week: w.w, jaar: w.y, ma, lessen: [] }); }
      per.get(k).lessen.push(l);
    }
    return [...per.values()].sort((a, b) => a.k.localeCompare(b.k)).map((w) => ({ ...w, ...this.telling(w.lessen) }));
  },
  /* Kleur bij een percentage: zelfde grenzen als de kleurschaal in Excel. */
  kleur(p) { return p == null ? "var(--lr-lijn)" : p < 70 ? "#e5484d" : p < 80 ? "#f5a524" : p < 90 ? "#9bc53d" : "#2fa36b"; },

  /* ---------- tonen ---------- */
  teken(DT, doel, status) {
    const d = this._data, f = this._filter;
    const alleLessen = d.studenten.flatMap((s) => s.lessen);
    const vakken = [...new Set(alleLessen.map((l) => l.vak))].sort((a, b) => a.localeCompare(b, "nl"));
    const docenten = [...new Set(alleLessen.flatMap((l) => (l.docent || "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b, "nl"));
    const filterLijst = (titel, opties, set) => {
      const sel = DT.el("select", { class: "dt-lr-veld", multiple: "", size: String(Math.min(8, Math.max(3, opties.length))) }, opties.map((o) => { const x = DT.el("option", { value: o, text: o }); x.selected = set.has(o); return x; }));
      sel.addEventListener("change", () => { set.clear(); [...sel.selectedOptions].forEach((o) => set.add(o.value)); this.teken(DT, doel, status); });
      const wis = set.size ? DT.el("button", { type: "button", class: "dt-lr-link", text: "wis keuze" }) : null; wis?.addEventListener("click", (e) => { e.preventDefault(); set.clear(); this.teken(DT, doel, status); });
      return DT.el("label", { class: "dt-lr-label" }, [DT.el("span", {}, [titel, DT.el("small", { class: "dt-lr-zacht", text: set.size ? `${set.size} van ${opties.length} gekozen` : `alle ${opties.length}` }), wis]), sel]);
    };
    const excel = this.knop(DT, "Naar Excel", () => this.excel(DT), false, "klein");
    const kop = (namen) => DT.el("thead", {}, DT.el("tr", {}, namen.map((n) => DT.el("th", { text: n }))));
    const td = (t, c = "") => DT.el("td", { class: c, text: t == null ? "" : String(t) });
    const pct = (p) => td(p == null ? "—" : `${p}%`, `getal${p != null && p < 80 ? " is-laag" : ""}`);
    /* Balk met percentage (per vak, docent, les) en verdeling per student (aanwezig, te laat, ziek, absent, uitgestuurd). */
    const pctBalk = (p) => { const c = DT.el("td", { class: "dt-lr-balkcel" }); if (p != null) c.append(DT.el("span", { class: "dt-lr-pbalk" }, DT.el("i", { style: `width:${p}%;background:${this.kleur(p)}` })), DT.el("b", { text: `${p}%`, class: p < 80 ? "is-laag" : "" })); else c.textContent = "—"; return c; };
    const SEG = [["aanwezig", "#2fa36b", "aanwezig"], ["teLaat", "#f5a524", "te laat"], ["ziek", "#7b8ea6", "ziek"], ["abOk", "#8fb8e8", "absent geoorloofd"], ["abNo", "#e5484d", "absent ongeoorloofd"], ["ui", "#7b33ff", "uitgestuurd"]];
    const verdeling = (g) => {
      const c = DT.el("td", { class: "dt-lr-verdcel" });
      if (!g.telt) return c;
      const bar = DT.el("span", { class: "dt-lr-verd", title: SEG.map(([k, , n]) => `${n}: ${k === "aanwezig" ? g.aanwezig - g.teLaat : g[k]}`).join("\n") });
      for (const [k, kl] of SEG) { const n = k === "aanwezig" ? g.aanwezig - g.teLaat : g[k]; if (n > 0) bar.append(DT.el("i", { style: `width:${(100 * n) / g.telt}%;background:${kl}` })); }
      c.append(bar); return c;
    };
    const legenda = DT.el("div", { class: "dt-lr-legenda" }, SEG.map(([, kl, n]) => DT.el("span", {}, [DT.el("i", { style: `background:${kl}` }), n])));
    const studenten = d.studenten.map((s) => ({ s, g: this.telling(s.lessen.filter((l) => this.past(l))) }));
    const totaal = this.telling(alleLessen.filter((l) => this.past(l)));
    const tabel = {};
    {
      tabel.student = DT.el("table", { class: "dt-lr-tabel" }, [kop(["Student", "Klas", "Lessen", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent geoorl.", "Absent ongeoorl.", "Uitgestuurd", "Aanwezig %", "Verdeling"]),
        DT.el("tbody", {}, studenten.filter((x) => x.g.lessen || x.s.fout).map(({ s, g }) => DT.el("tr", {}, [td(s.l.naam), td(s.l.klas), ...(s.fout ? [td(`niet op te halen (${s.fout})`)] :
          [td(g.telt, "getal"), td(g.aanwezig, "getal"), td(g.teLaat, "getal"), td(g.afwezig, "getal"), td(g.ziek, "getal"), td(g.abOk, "getal"), td(g.abNo, "getal"), td(g.ui, "getal"), pctBalk(g.pct), verdeling(g)])])))]);
    }
    {
      const ms = this.momenten(d.studenten);
      tabel.les = DT.el("table", { class: "dt-lr-tabel" }, [kop(["Datum", "Tijd", "Vak", "Docent", "Klas", "Studenten", "Aanwezig", "Te laat", "Afwezig"]),
        DT.el("tbody", {}, ms.map((m) => {
          const g = this.telling(m.rijen.map((r) => r.l));
          const wie = (cats) => m.rijen.filter((r) => cats.includes(r.l.cat)).map((r) => `${r.s.naam}${r.l.cat === "TL" ? "" : ` (${this.CAT[r.l.cat]})`}`).join(", ");
          return DT.el("tr", {}, [td(this.datum(m.begin)), td(`${this.tijd(m.begin)}–${this.tijd(m.einde)}`), td(m.vak), td(m.docent), td([...m.klassen].join(", ")), td(g.telt, "getal"), pctBalk(g.pct),
            td(wie(["TL"]), "lijst"), td(wie(["AB_OK", "AB_NO", "ZK", "UI"]), "lijst")]);
        }))]);
    }
    {
      const ws = this.weken(d.studenten);
      tabel.week = DT.el("table", { class: "dt-lr-tabel" }, [kop(["Week", "Vanaf", "Lessen", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent ongeoorl.", "Aanwezig %", "Verdeling"]),
        DT.el("tbody", {}, ws.map((w) => DT.el("tr", {}, [td(`week ${w.week}`), td(this.datum(w.ma)), td(w.telt, "getal"), td(w.aanwezig, "getal"), td(w.teLaat, "getal"), td(w.afwezig, "getal"), td(w.ziek, "getal"), td(w.abNo, "getal"), pctBalk(w.pct), verdeling(w)])))]);
    }
    for (const soort of ["vak", "docent"]) {
      const gs = this.groepen(d.studenten, soort);
      tabel[soort] = DT.el("table", { class: "dt-lr-tabel" }, [kop([soort === "vak" ? "Vak" : "Docent", "Lessen (student × les)", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent ongeoorl.", "Aanwezig %", "Verdeling"]),
        DT.el("tbody", {}, gs.map((g) => DT.el("tr", {}, [td(g.naam), td(g.telt, "getal"), td(g.aanwezig, "getal"), td(g.teLaat, "getal"), td(g.afwezig, "getal"), td(g.ziek, "getal"), td(g.abNo, "getal"), pctBalk(g.pct), verdeling(g)])))]);
    }
    status.textContent = `${d.studenten.length} studenten · ${d.klassen.join(", ")} · ${d.per.naam} · ${totaal.telt} lessen in selectie · ${totaal.pct ?? "—"}% aanwezig`;
    const kpi = (label, waarde, sub = "", kl = "") => DT.el("dna-card", { class: "dt-lr-kpi" }, DT.el("div", { class: "dt-lr-kpi-in" }, [DT.el("small", { text: label }), DT.el("b", { text: waarde, class: kl }), sub ? DT.el("span", { text: sub }) : null].filter(Boolean)));
    const onder = studenten.filter((x) => x.g.telt && x.g.pct < 80).length;
    const kl = (p) => p == null ? "" : p < 70 ? "is-rood" : p < 80 ? "is-oranje" : p < 90 ? "is-geel" : "is-groen";
    const kpis = DT.el("div", { class: "dt-lr-kpis" }, [
      kpi("Aanwezig", totaal.pct == null ? "—" : `${totaal.pct}%`, `${totaal.aanwezig} van ${totaal.telt} lessen`, kl(totaal.pct)),
      kpi("Te laat", String(totaal.teLaat), totaal.telt ? `${Math.round(100 * totaal.teLaat / totaal.telt)}% van de lessen` : ""),
      kpi("Gemist", String(totaal.afwezig), `waarvan ${totaal.ziek} ziek`),
      kpi("Ongeoorloofd", String(totaal.abNo), "absent zonder geldige reden", totaal.abNo ? "is-rood" : ""),
      kpi("Onder 80%", `${onder} van ${studenten.filter((x) => x.g.telt).length}`, "studenten", onder ? "is-rood" : ""),
    ]);
    /* Weergaven als Magister-tabbladen (dna-tabs); het gekozen tabblad blijft staan als je een filter wijzigt. */
    const VIEWS = [["student", "Per student"], ["les", "Per les"], ["week", "Per week"], ["vak", "Per vak"], ["docent", "Per docent"]];
    const tabs = DT.el("dna-tabs", { orientation: "horizontal" });
    const bar = DT.el("dna-tab-bar", { slot: "tab-bar", orientation: "horizontal" });
    tabs.append(bar);
    for (const [id, naam] of VIEWS) {
      bar.append(DT.el("dna-tab-button", { "data-view": id }, naam));
      tabs.append(DT.el("dna-tab", { slot: "tab", "data-view": id }, DT.el("div", { class: "dt-lr-scroll" }, tabel[id])));
    }
    bar.addEventListener("click", (e) => { const b = e.target.closest("dna-tab-button"); if (b) f.weergave = b.dataset.view; });
    const kaartkop = (titel, sub, ...rechts) => DT.el("div", { class: "dt-lr-kaartkop" }, [DT.el("div", { class: "dt-lr-wie" }, [DT.el("h2", { text: titel }), sub ? DT.el("small", { text: sub }) : null].filter(Boolean)), ...rechts]);
    const grafiek = this.weekGrafiek(DT);
    doel.replaceChildren(...[
      DT.el("dna-card", { class: "dt-lr-kaart" }, [kaartkop("Filter", "Ctrl/Cmd-klik om meerdere vakken of docenten te kiezen."),
        DT.el("div", { class: "dt-lr-filters" }, [filterLijst("Vak", vakken, f.vakken), filterLijst("Docent", docenten, f.docenten)])]),
      kpis,
      grafiek ? DT.el("dna-card", { class: "dt-lr-kaart" }, [kaartkop("Aanwezig per week", "Stippellijn = 80%. Beweeg over een staaf voor de details."), grafiek, legenda]) : null,
      DT.el("dna-card", { class: "dt-lr-kaart" }, [kaartkop("Resultaten", `${d.klassen.join(", ")} · ${d.per.naam}`, excel), grafiek ? null : legenda, tabs,
        DT.el("p", { class: "dt-lr-zacht dt-lr-voetnoot", text: "Aanwezig % = (lessen − gemist) / lessen; te laat telt als aanwezig, vrijstelling telt niet mee (zoals Inzicht)." })]),
    ].filter(Boolean));
    this.componenten();
    /* Gekozen tabblad opnieuw selecteren nadat het onderdeel is opgebouwd. */
    if (f.weergave !== "student") setTimeout(() => bar.querySelector(`dna-tab-button[data-view="${f.weergave}"]`)?.click(), 60);
  },

  /* Staafjes per week (aanwezig %), met de 80%-lijn; klik op een staaf voor de details in Per week. */
  weekGrafiek(DT) {
    const ws = this.weken(this._data.studenten);
    if (ws.length < 2) return null;
    const B = 760, H = 150, l = 34, r = 8, t = 14, o = 28, bw = (B - l - r) / ws.length, y = (p) => t + (H - t - o) * (1 - p / 100);
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${B} ${H}`); svg.setAttribute("class", "dt-lr-week"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Aanwezig per week");
    const el = (tag, a, tekst) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (tekst != null) e.textContent = tekst; svg.append(e); return e; };
    for (const p of [0, 50, 80, 100]) { el("line", { x1: l, x2: B - r, y1: y(p), y2: y(p), class: p === 80 ? "norm" : "lijn" }); el("text", { x: l - 6, y: y(p) + 4, "text-anchor": "end", class: "as" }, `${p}%`); }
    ws.forEach((w, i) => {
      const br = Math.min(bw * 0.64, 56), x = l + i * bw + (bw - br) / 2, p = w.pct ?? 0;
      const rect = el("rect", { x, y: y(p), width: br, height: Math.max(0, y(0) - y(p)), rx: 3, fill: this.kleur(w.pct) });
      const titel = document.createElementNS(ns, "title"); titel.textContent = `Week ${w.week} (vanaf ${this.datum(w.ma)}): ${w.pct ?? "—"}% aanwezig, ${w.teLaat}× te laat, ${w.afwezig} gemist, ${w.telt} lessen`; rect.append(titel);
      if (bw > 26) el("text", { x: x + br / 2, y: y(p) - 4, "text-anchor": "middle", class: "waarde" }, w.pct == null ? "" : `${w.pct}`);
      if (bw > 18 || i % 2 === 0) el("text", { x: x + br / 2, y: H - 10, "text-anchor": "middle", class: "as" }, `wk ${w.week}`);
    });
    return DT.el("div", { class: "dt-lr-grafiek" }, svg);
  },

  /* ---------- Excel ---------- */
  excel(DT) {
    if (typeof XLSX === "undefined") return DT.toast("Excel-bibliotheek niet geladen", "err");
    const d = this._data, f = this._filter, pct = (p) => (p == null ? "" : { t: "n", v: p / 100, z: "0%" });
    const blad = (rijen, breedtes) => { const ws = XLSX.utils.aoa_to_sheet(rijen); ws["!cols"] = breedtes.map((w) => ({ wch: w })); if (rijen.length > 1) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rijen.length - 1, c: rijen[0].length - 1 } }) }; return ws; };
    const wb = XLSX.utils.book_new();
    const sel = `${f.vakken.size ? `vak: ${[...f.vakken].join(", ")}` : "alle vakken"}; ${f.docenten.size ? `docent: ${[...f.docenten].join(", ")}` : "alle docenten"}`;
    XLSX.utils.book_append_sheet(wb, blad([["Lesregistraties"], ["Klassen", d.klassen.join(", ")], ["Periode", `${d.per.naam} (${this.datum(d.per.van)} t/m ${this.datum(d.per.tot)})`], ["Selectie", sel], ["Gemaakt", new Date().toLocaleString("nl-NL")],
      [], ["Aanwezig % = (lessen − gemist) / lessen; te laat telt als aanwezig, vrijstelling telt niet mee (zoals Inzicht)."]], [18, 80]), "Toelichting");
    XLSX.utils.book_append_sheet(wb, blad([["Student", "Stamnummer", "Klas", "Lessen", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent geoorloofd", "Absent ongeoorloofd", "Uitgestuurd", "Vrijgesteld", "Aanwezig %"],
      ...d.studenten.map((s) => { const g = this.telling(s.lessen.filter((l) => this.past(l))); return [s.l.naam, s.l.stam, s.l.klas, g.telt, g.aanwezig, g.teLaat, g.afwezig, g.ziek, g.abOk, g.abNo, g.ui, g.vrij, pct(g.pct)]; })],
      [28, 11, 9, 8, 9, 8, 8, 7, 10, 11, 10, 10, 11]), "Per student");
    XLSX.utils.book_append_sheet(wb, blad([["Datum", "Begin", "Einde", "Vak", "Docent", "Klas", "Studenten", "Aanwezig", "Te laat", "Afwezig", "Aanwezig %", "Te laat (namen)", "Afwezig (namen en reden)"],
      ...this.momenten(d.studenten).map((m) => { const g = this.telling(m.rijen.map((r) => r.l)), wie = (c) => m.rijen.filter((r) => c.includes(r.l.cat)).map((r) => `${r.s.naam}${r.l.cat === "TL" ? "" : ` (${this.CAT[r.l.cat]})`}`).join(", ");
        return [this.datum(m.begin), this.tijd(m.begin), this.tijd(m.einde), m.vak, m.docent, [...m.klassen].join(", "), g.telt, g.aanwezig, g.teLaat, g.afwezig, pct(g.pct), wie(["TL"]), wie(["AB_OK", "AB_NO", "ZK", "UI"])]; })],
      [11, 7, 7, 24, 18, 10, 9, 9, 8, 8, 10, 40, 60]), "Per les");
    XLSX.utils.book_append_sheet(wb, blad([["Student", "Stamnummer", "Klas", "Datum", "Begin", "Einde", "Vak", "Docent", "Status", "Registraties"],
      ...d.studenten.flatMap((s) => s.lessen.filter((l) => this.past(l)).map((l) => [s.l.naam, s.l.stam, s.l.klas, this.datum(l.begin), this.tijd(l.begin), this.tijd(l.einde), l.vak, l.docent, this.CAT[l.cat] || l.cat, l.regs || ""]))],
      [28, 11, 9, 11, 7, 7, 24, 18, 18, 40]), "Alle lessen");
    for (const [k, naam] of [["vak", "Per vak"], ["docent", "Per docent"]]) {
      XLSX.utils.book_append_sheet(wb, blad([[k === "vak" ? "Vak" : "Docent", "Lessen (student × les)", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent ongeoorloofd", "Aanwezig %"],
        ...this.groepen(d.studenten, k).map((g) => [g.naam, g.telt, g.aanwezig, g.teLaat, g.afwezig, g.ziek, g.abNo, pct(g.pct)])], [28, 12, 10, 9, 9, 8, 12, 11]), naam);
    }
    const ws = this.weken(d.studenten);
    XLSX.utils.book_append_sheet(wb, blad([["Week", "Vanaf", "Lessen", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent ongeoorloofd", "Aanwezig %"],
      ...ws.map((w) => [`week ${w.week}`, this.datum(w.ma), w.telt, w.aanwezig, w.teLaat, w.afwezig, w.ziek, w.abNo, pct(w.pct)])], [10, 11, 9, 10, 9, 9, 8, 12, 11]), "Per week");
    /* Grafieken en kleuren (echte Excel-opmaak, zie xlsx-visueel.js). */
    const n = d.studenten.length + 1, nm = this.momenten(d.studenten).length + 1, nv = this.groepen(d.studenten, "vak").length + 1, nd = this.groepen(d.studenten, "docent").length + 1, nw = ws.length + 1;
    const hoog = (k) => Math.max(18, Math.min(60, k + 4));
    const specs = {
      "Per student": { kleurschaal: [`M2:M${n}`], balken: [`G2:G${n}`, `J2:J${n}`], balkenBlauw: [`F2:F${n}`],
        grafieken: [{ type: "bar", titel: "Aanwezig % per student", cat: `A2:A${n}`, reeksen: [{ naam: "Aanwezig %", val: `M2:M${n}` }], pct: true, van: [14, 0], tot: [23, hoog(n)] }] },
      "Per les": { kleurschaal: [`K2:K${nm}`], balken: [`J2:J${nm}`], balkenBlauw: [`I2:I${nm}`] },
      "Per week": { kleurschaal: [`I2:I${nw}`], balken: [`F2:F${nw}`], balkenBlauw: [`E2:E${nw}`],
        grafieken: [{ type: "line", titel: "Aanwezig % per week", cat: `A2:A${nw}`, reeksen: [{ naam: "Aanwezig %", val: `I2:I${nw}` }], pct: true, van: [10, 0], tot: [19, 17] },
          { type: "col", gestapeld: true, titel: "Lessen per week", cat: `A2:A${nw}`, reeksen: [{ naam: "Aanwezig", val: `D2:D${nw}`, kleur: "2FA36B" }, { naam: "Gemist", val: `F2:F${nw}`, kleur: "E5484D" }], van: [10, 18], tot: [19, 35] }] },
      "Per vak": { kleurschaal: [`H2:H${nv}`], balken: [`E2:E${nv}`], grafieken: [{ type: "bar", titel: "Aanwezig % per vak", cat: `A2:A${nv}`, reeksen: [{ naam: "Aanwezig %", val: `H2:H${nv}` }], pct: true, van: [9, 0], tot: [18, hoog(nv)] }] },
      "Per docent": { kleurschaal: [`H2:H${nd}`], balken: [`E2:E${nd}`], grafieken: [{ type: "bar", titel: "Aanwezig % per docent", cat: `A2:A${nd}`, reeksen: [{ naam: "Aanwezig %", val: `H2:H${nd}` }], pct: true, van: [9, 0], tot: [18, hoog(nd)] }] },
    };
    const naam = `Lesregistraties ${d.klassen.join(" ")} ${d.per.naam}${f.vakken.size === 1 ? ` ${[...f.vakken][0]}` : ""}`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
    try { XlsxVisueel.download(XlsxVisueel.maak(wb, specs), `${naam}.xlsx`); }
    catch (e) { console.warn("[Docent Tools] Excel-opmaak mislukt, gewone export", e); XLSX.writeFile(wb, `${naam}.xlsx`); }
    DT.toast("Excel-bestand gedownload", "ok");
  },

  css() {
    if (document.getElementById("dt-lr-style")) return;
    const st = document.createElement("style"); st.id = "dt-lr-style";
    /* Alles op Magisters eigen ontwerptokens (--sl-…), net als de Te laat-balie: zo kleurt de pagina mee met Magister
     * én met elk thema (ook eigen thema's, donker en Apple Glass, die dna-card en de tokens overschrijven). */
    st.textContent = `
      ui-view.dt-lr-open > mg-att-tiles { display: none !important; }
      #dt-lrp {
        --lr-fg: var(--sl-color-tab-default-foreground, #233243); --lr-zacht: color-mix(in srgb, var(--lr-fg) 62%, transparent);
        --lr-lijn: var(--sl-color-card-border, #bcbcbc); --lr-lijnzacht: color-mix(in srgb, var(--lr-lijn) 45%, transparent);
        --lr-kaart: var(--sl-color-card-background, #fefefe); --lr-vlak: var(--sl-elevation-surface-raised-sunken, #f6f8fa);
        --lr-acc: var(--sl-color-button-primary-solid-idle-background, var(--dt-accent, #056dc2));
        --lr-hover: var(--sl-color-tab-hover-background, #ddeffe); --lr-actief: var(--sl-color-tab-active-background, #b7defd);
        --lr-rood: var(--sl-color-border-accent-red-bold, #d7263d);
        --lr-r: var(--sl-size-borderRadius-default, 4px); --lr-rl: var(--sl-size-borderRadius-lg, 8px);
        display: block; min-width: 0; --dna-page-layout-max-width: min(100%, calc(100% - 2 * 2rem));
        color: var(--lr-fg); font-family: var(--sl-text-typeset-font-family-body, open-sans), sans-serif; font-size: 14px; line-height: 20px; }
      #dt-lrp * { box-sizing: border-box; }
      #dt-lrp input, #dt-lrp select, #dt-lrp button { font-family: inherit; }
      .dt-lr-inhoud { width: min(1200px, calc(100% - 4rem)); margin: 0 auto; padding: 16px 0 32px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .dt-lr-resultaat { display: flex; flex-direction: column; gap: 16px; min-width: 0; } .dt-lr-resultaat:empty { display: none; }
      dna-card.dt-lr-kaart { display: block; min-width: 0; }
      .dt-lr-kaart h2 { margin: 0; font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 16px; line-height: 24px; font-weight: 700; color: var(--lr-fg); }
      .dt-lr-kaart > h2 + p { margin: 4px 0 16px; }
      .dt-lr-kaartkop { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .dt-lr-wie { flex: 1; min-width: 200px; } .dt-lr-wie small { display: block; color: var(--lr-zacht); font-size: 13px; }
      .dt-lr-zacht { color: var(--lr-zacht); font-size: 13px; margin: 0; }
      .dt-lr-voetnoot { margin-top: 12px; }
      .dt-lr-rij { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 12px; margin-top: 12px; }
      .dt-lr-veldgroep { display: flex; flex-direction: column; gap: 6px; }
      .dt-lr-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--lr-fg); }
      .dt-lr-label > span { display: flex; align-items: baseline; gap: 8px; } .dt-lr-label small { font-weight: 400; }
      .dt-lr-veld { height: 36px; padding: 0 10px; border: 1px solid var(--lr-lijn); border-radius: var(--lr-r); background: var(--lr-kaart); color: var(--lr-fg); font-size: 14px; min-width: 220px; }
      .dt-lr-veld:focus-visible, .dt-lr-chip:focus-visible { outline: 2px solid var(--lr-acc); outline-offset: 1px; }
      input[type=date].dt-lr-veld { min-width: 0; color-scheme: light dark; }
      select[multiple].dt-lr-veld { height: auto; min-width: 280px; padding: 4px; }
      select[multiple].dt-lr-veld option { padding: 4px 8px; border-radius: var(--lr-r); }
      select[multiple].dt-lr-veld option:checked { background: var(--lr-actief); color: var(--lr-fg); }
      .dt-lr-eigen { display: inline-flex; align-items: center; gap: 6px; }
      .dt-lr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dt-lr-chip { appearance: none; height: 30px; padding: 0 12px; border: 1px solid var(--lr-lijn); border-radius: 999px; background: var(--lr-kaart); color: inherit; font-size: 13px; cursor: pointer; }
      .dt-lr-chip:hover { background: var(--lr-hover); }
      .dt-lr-chip[aria-pressed="true"] { background: var(--lr-actief); border-color: var(--lr-acc); font-weight: 700; }
      .dt-lr-link { appearance: none; border: 0; background: none; padding: 0; color: var(--lr-acc); font-size: 12px; font-weight: 600; cursor: pointer; }
      .dt-lr-link:hover { text-decoration: underline; }
      .dt-lr-balk { height: 4px; margin-top: 16px; border-radius: 2px; background: var(--lr-lijnzacht); overflow: hidden; display: none; }
      .dt-lr-balk.is-bezig { display: block; } .dt-lr-balk i { display: block; height: 100%; width: 0; background: var(--lr-acc); transition: width .2s; }
      .dt-lr-status { margin-top: 8px; } .dt-lr-status:empty { display: none; }
      .dt-lr-filters { display: flex; flex-wrap: wrap; gap: 16px 24px; }
      .dt-lr-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
      dna-card.dt-lr-kpi { display: block; min-width: 0; } .dt-lr-kpi-in { display: flex; flex-direction: column; gap: 2px; }
      .dt-lr-kpi small { font-size: 13px; font-weight: 600; color: var(--lr-zacht); }
      .dt-lr-kpi b { font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 28px; line-height: 36px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .dt-lr-kpi span { font-size: 13px; color: var(--lr-zacht); }
      .dt-lr-kpi b.is-rood { color: var(--lr-rood); } .dt-lr-kpi b.is-oranje { color: #d27d00; } .dt-lr-kpi b.is-geel { color: #6e9a1f; } .dt-lr-kpi b.is-groen { color: #1e8a4c; }
      .dt-lr-grafiek { margin: 0 -4px 8px; }
      .dt-lr-week { width: 100%; height: auto; max-height: 190px; display: block; }
      .dt-lr-week .lijn { stroke: var(--lr-lijnzacht); stroke-width: 1; } .dt-lr-week .norm { stroke: var(--lr-rood); stroke-width: 1; stroke-dasharray: 4 3; opacity: .8; }
      .dt-lr-week .as { font-size: 10px; fill: var(--lr-zacht); } .dt-lr-week .waarde { font-size: 10px; font-weight: 700; fill: var(--lr-fg); }
      .dt-lr-week rect { transition: opacity .12s; } .dt-lr-week rect:hover { opacity: .8; }
      .dt-lr-legenda { margin-bottom: 4px; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13px; color: var(--lr-zacht); }
      .dt-lr-legenda i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
      #dt-lrp dna-tabs { display: block; } #dt-lrp dna-tab { width: 100%; justify-self: stretch; } #dt-lrp dna-tab:not([selected]) { display: none; }
      .dt-lr-scroll { max-height: 62vh; overflow: auto; margin-top: 12px; border: 1px solid var(--lr-lijnzacht); border-radius: var(--lr-r); }
      .dt-lr-tabel { width: 100%; border-collapse: collapse; }
      .dt-lr-tabel th { position: sticky; top: 0; z-index: 1; background: var(--lr-kaart); text-align: left; font-size: 12px; font-weight: 700; color: var(--lr-zacht); padding: 8px; border-bottom: 1px solid var(--lr-lijn); white-space: nowrap; }
      .dt-lr-tabel td { padding: 6px 8px; border-bottom: 1px solid var(--lr-lijnzacht); vertical-align: middle; font-size: 14px; }
      .dt-lr-tabel tbody tr:last-child td { border-bottom: 0; }
      .dt-lr-tabel tr:hover td { background: color-mix(in srgb, var(--lr-hover) 50%, transparent); }
      .dt-lr-tabel td.getal { text-align: right; font-variant-numeric: tabular-nums; }
      .dt-lr-tabel td.is-laag, .dt-lr-balkcel b.is-laag { color: var(--lr-rood); font-weight: 700; }
      .dt-lr-tabel td.lijst { font-size: 13px; max-width: 360px; }
      .dt-lr-balkcel { min-width: 130px; white-space: nowrap; } .dt-lr-balkcel b { font-size: 13px; margin-left: 8px; font-variant-numeric: tabular-nums; }
      .dt-lr-pbalk { display: inline-block; width: 72px; height: 8px; border-radius: 4px; background: var(--lr-lijnzacht); overflow: hidden; vertical-align: middle; } .dt-lr-pbalk i { display: block; height: 100%; }
      .dt-lr-verdcel { min-width: 150px; } .dt-lr-verd { display: flex; width: 140px; height: 10px; border-radius: 5px; overflow: hidden; background: var(--lr-lijnzacht); } .dt-lr-verd i { display: block; height: 100%; }
      @media (max-width: 720px) { .dt-lr-inhoud { width: calc(100% - 2rem); } .dt-lr-veld, select[multiple].dt-lr-veld { min-width: 0; width: 100%; } .dt-lr-filters > * { flex: 1 1 100%; } }
    `;
    document.head.append(st);
  },
});
