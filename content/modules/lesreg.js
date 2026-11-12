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
    this._hash = () => { if (this._dlg?.classList.contains("is-pagina") && !/^#\/aanwezigheid\/?$/.test(location.hash)) this.sluit(); };
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
    if (this._dlg?.classList.contains("is-pagina") && (!this._dlg.isConnected || !document.querySelector("mg-att-tiles"))) this.sluit();
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
    const per = DT.el("select", { class: "dt-lr-veld" }, keuzes.map((k) => DT.el("option", { value: k.key, text: k.naam })));
    const nu = (DT.periodes?.() || []).find((p) => new Date() >= p.begin && new Date() <= p.einde); per.value = nu ? `p:${nu.id}` : "4w";
    const van = DT.el("input", { type: "date", class: "dt-lr-veld" }), tot = DT.el("input", { type: "date", class: "dt-lr-veld", value: peil });
    van.value = this.ymd(new Date(Date.now() - 28 * 864e5));
    const eigen = DT.el("span", { class: "dt-lr-eigen" }, [van, DT.el("span", { text: "t/m" }), tot]);
    const toonEigen = () => { eigen.style.display = per.value === "eigen" ? "" : "none"; };
    per.addEventListener("change", toonEigen); toonEigen();
    const status = DT.el("div", { class: "dt-lr-status", "aria-live": "polite" });
    const balk = DT.el("div", { class: "dt-lr-balk" }, DT.el("i"));
    const resultaat = DT.el("div", { class: "dt-lr-resultaat" });
    const start = DT.el("button", { type: "button", class: "dt-lr-btn is-hoofd", text: "Ophalen" });
    const sluit = DT.el("button", { type: "button", class: "dt-lr-btn", text: "Sluiten" });
    let afbreken = false, bezig = false;
    const weg = () => { afbreken = true; document.removeEventListener("keydown", esc, true); this.sluit(); };
    const esc = (e) => { if (e.key === "Escape" && !pagina) { e.stopPropagation(); weg(); } };
    sluit.addEventListener("click", weg);
    document.addEventListener("keydown", esc, true);
    start.addEventListener("click", async () => {
      if (bezig) return;
      if (!gekozen.size) return DT.toast("Kies eerst één of meer klassen.", "err");
      try { localStorage.setItem("dt-lesreg-klassen", JSON.stringify([...gekozen])); } catch {}
      let p = keuzes.find((k) => k.key === per.value);
      if (p.key === "eigen") {
        const a = new Date(`${van.value}T00:00:00`), b = new Date(`${tot.value}T23:59:59`);
        if (isNaN(a) || isNaN(b) || b < a) return DT.toast("Kies een geldige begin- en einddatum.", "err");
        p = { key: "eigen", naam: `${this.datum(a)} t/m ${this.datum(b)}`, van: a, tot: b > new Date() ? new Date() : b };
      }
      bezig = true; start.disabled = true; resultaat.replaceChildren();
      try {
        this._data = await this.ophalen(DT, [...gekozen], p, (i, n, t) => { if (afbreken) throw new Error("afgebroken"); balk.firstChild.style.width = `${Math.round(100 * i / Math.max(1, n))}%`; status.textContent = t; });
        this._filter = { vakken: new Set(), docenten: new Set(), weergave: this._filter?.weergave || "student" };
        this.teken(DT, resultaat, status);
      } catch (e) { if (String(e.message) !== "afgebroken") status.textContent = `Er ging iets mis: ${e.message || e}`; }
      bezig = false; start.disabled = false;
    });
    const terug = DT.el("a", { href: "#/aanwezigheid", class: "dt-lr-crumb", text: "Aanwezigheid" });
    terug.addEventListener("click", (e) => { e.preventDefault(); weg(); });
    const kop = pagina
      ? DT.el("div", { class: "dt-lr-kop is-pagina" }, [DT.el("nav", { class: "dt-lr-crumbs", "aria-label": "Kruimelpad" }, [terug, DT.el("span", { "aria-hidden": "true", text: "›" }), DT.el("span", { text: "Lesregistraties" })]),
          DT.el("h1", { html: `Lesregistraties<span class="dt-lr-punt">.</span>` }), DT.el("span", { class: "dt-lr-zacht", text: "Aanwezigheid van één of meer klassen per vak of docent, over een periode die je kiest." })])
      : DT.el("div", { class: "dt-lr-kop" }, [DT.el("h2", { text: "Lesregistraties" }), DT.el("span", { class: "dt-lr-zacht", text: "aanwezigheid per klas, vak en docent" })]);
    const dlg = DT.el(pagina ? "section" : "div", { class: `dt-lr${pagina ? " is-pagina" : ""}`, ...(pagina ? { "aria-label": "Lesregistraties" } : { role: "dialog", "aria-modal": "true", "aria-label": "Lesregistraties" }) }, DT.el("div", { class: "dt-lr-paneel" }, [
      kop,
      DT.el("div", { class: "dt-lr-keuzes" }, [
        DT.el("div", { class: "dt-lr-label" }, [DT.el("span", { text: "Klassen" }), chips]),
        DT.el("div", { class: "dt-lr-rij" }, [DT.el("label", { class: "dt-lr-label" }, [DT.el("span", { text: "Periode" }), per]), eigen, start]),
        balk, status,
      ]),
      resultaat,
      pagina ? null : DT.el("div", { class: "dt-lr-voet" }, [sluit]),
    ].filter(Boolean)));
    if (pagina) {
      const tiles = document.querySelector("mg-att-tiles"), uv = tiles?.parentElement;
      if (!uv) return;
      uv.classList.add("dt-lr-open"); tiles.after(dlg);
    } else document.body.append(dlg);
    this._dlg = dlg;
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

  /* ---------- tonen ---------- */
  teken(DT, doel, status) {
    const d = this._data, f = this._filter;
    const alleLessen = d.studenten.flatMap((s) => s.lessen);
    const vakken = [...new Set(alleLessen.map((l) => l.vak))].sort((a, b) => a.localeCompare(b, "nl"));
    const docenten = [...new Set(alleLessen.flatMap((l) => (l.docent || "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b, "nl"));
    const filterLijst = (titel, opties, set) => {
      const sel = DT.el("select", { class: "dt-lr-veld", multiple: "", size: String(Math.min(8, Math.max(3, opties.length))) }, opties.map((o) => { const x = DT.el("option", { value: o, text: o }); x.selected = set.has(o); return x; }));
      sel.addEventListener("change", () => { set.clear(); [...sel.selectedOptions].forEach((o) => set.add(o.value)); this.teken(DT, doel, status); });
      const wis = DT.el("button", { type: "button", class: "dt-lr-link", text: "alle" }); wis.addEventListener("click", () => { set.clear(); this.teken(DT, doel, status); });
      return DT.el("label", { class: "dt-lr-label" }, [DT.el("span", {}, [`${titel} `, DT.el("small", { class: "dt-lr-zacht", text: set.size ? `${set.size} gekozen · ` : "alle · " }), wis]), sel]);
    };
    const tabs = DT.el("div", { class: "dt-lr-tabs" }, [["student", "Per student"], ["les", "Per les"], ["vak", "Per vak"], ["docent", "Per docent"]].map(([k, t]) => {
      const b = DT.el("button", { type: "button", class: "dt-lr-tab", "aria-pressed": String(f.weergave === k), text: t });
      b.addEventListener("click", () => { f.weergave = k; this.teken(DT, doel, status); }); return b;
    }));
    const excel = DT.el("button", { type: "button", class: "dt-lr-btn", text: "Naar Excel" }); excel.addEventListener("click", () => this.excel(DT));
    const kop = (namen) => DT.el("thead", {}, DT.el("tr", {}, namen.map((n) => DT.el("th", { text: n }))));
    const td = (t, c = "") => DT.el("td", { class: c, text: t == null ? "" : String(t) });
    const pct = (p) => td(p == null ? "—" : `${p}%`, `getal${p != null && p < 80 ? " is-laag" : ""}`);
    const studenten = d.studenten.map((s) => ({ s, g: this.telling(s.lessen.filter((l) => this.past(l))) }));
    const totaal = this.telling(alleLessen.filter((l) => this.past(l)));
    let inhoud;
    if (f.weergave === "student") {
      inhoud = DT.el("table", { class: "dt-lr-tabel" }, [kop(["Student", "Klas", "Lessen", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent geoorl.", "Absent ongeoorl.", "Uitgestuurd", "Aanwezig %"]),
        DT.el("tbody", {}, studenten.filter((x) => x.g.lessen || x.s.fout).map(({ s, g }) => DT.el("tr", {}, [td(s.l.naam), td(s.l.klas), ...(s.fout ? [td(`niet op te halen (${s.fout})`)] :
          [td(g.telt, "getal"), td(g.aanwezig, "getal"), td(g.teLaat, "getal"), td(g.afwezig, "getal"), td(g.ziek, "getal"), td(g.abOk, "getal"), td(g.abNo, "getal"), td(g.ui, "getal"), pct(g.pct)])])))]);
    } else if (f.weergave === "les") {
      const ms = this.momenten(d.studenten);
      inhoud = DT.el("table", { class: "dt-lr-tabel" }, [kop(["Datum", "Tijd", "Vak", "Docent", "Klas", "Studenten", "Aanwezig", "Te laat", "Afwezig"]),
        DT.el("tbody", {}, ms.map((m) => {
          const g = this.telling(m.rijen.map((r) => r.l));
          const wie = (cats) => m.rijen.filter((r) => cats.includes(r.l.cat)).map((r) => `${r.s.naam}${r.l.cat === "TL" ? "" : ` (${this.CAT[r.l.cat]})`}`).join(", ");
          return DT.el("tr", {}, [td(this.datum(m.begin)), td(`${this.tijd(m.begin)}–${this.tijd(m.einde)}`), td(m.vak), td(m.docent), td([...m.klassen].join(", ")), td(g.telt, "getal"), pct(g.pct),
            td(wie(["TL"]), "lijst"), td(wie(["AB_OK", "AB_NO", "ZK", "UI"]), "lijst")]);
        }))]);
    } else {
      const gs = this.groepen(d.studenten, f.weergave);
      inhoud = DT.el("table", { class: "dt-lr-tabel" }, [kop([f.weergave === "vak" ? "Vak" : "Docent", "Lessen (student × les)", "Aanwezig", "Te laat", "Gemist", "Ziek", "Absent ongeoorl.", "Aanwezig %"]),
        DT.el("tbody", {}, gs.map((g) => DT.el("tr", {}, [td(g.naam), td(g.telt, "getal"), td(g.aanwezig, "getal"), td(g.teLaat, "getal"), td(g.afwezig, "getal"), td(g.ziek, "getal"), td(g.abNo, "getal"), pct(g.pct)])))]);
    }
    status.textContent = `${d.studenten.length} studenten · ${d.klassen.join(", ")} · ${d.per.naam} · ${totaal.telt} lessen in selectie · ${totaal.pct ?? "—"}% aanwezig`;
    doel.replaceChildren(
      DT.el("div", { class: "dt-lr-filters" }, [filterLijst("Vak", vakken, f.vakken), filterLijst("Docent", docenten, f.docenten)]),
      DT.el("div", { class: "dt-lr-rij" }, [tabs, DT.el("span", { style: "flex:1" }), excel]),
      DT.el("div", { class: "dt-lr-scroll" }, inhoud),
      DT.el("p", { class: "dt-lr-zacht", text: "Aanwezig % = (lessen − gemist) / lessen; te laat telt als aanwezig, vrijstelling telt niet mee (zoals Inzicht). Ctrl/Cmd-klik om meerdere vakken of docenten te kiezen." }),
    );
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
    const naam = `Lesregistraties ${d.klassen.join(" ")} ${d.per.naam}`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
    XLSX.writeFile(wb, `${naam}.xlsx`);
    DT.toast("Excel-bestand gedownload", "ok");
  },

  css() {
    if (document.getElementById("dt-lr-style")) return;
    const st = document.createElement("style"); st.id = "dt-lr-style";
    st.textContent = `
      ui-view.dt-lr-open > mg-att-tiles { display: none !important; }
      .dt-lr.is-pagina { position: static; inset: auto; display: block; background: none; padding: 24px 24px 32px; }
      .dt-lr.is-pagina .dt-lr-paneel { width: auto; max-width: 1200px; height: auto; min-height: 0; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); border: 1px solid var(--sl-color-card-border, var(--dt-line, #e0e6ea)); }
      .dt-lr.is-pagina .dt-lr-resultaat { min-height: 0; } .dt-lr.is-pagina .dt-lr-scroll { flex: none; max-height: 62vh; }
      .dt-lr-kop.is-pagina { flex-direction: column; align-items: flex-start; gap: 4px; }
      .dt-lr-kop h1 { margin: 0; font-size: 1.75rem; line-height: 2.125rem; font-weight: 700; color: var(--dt-fg, #0b385c); } .dt-lr-punt { color: #ff8a00; }
      .dt-lr-crumbs { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--dt-muted, #59636e); } .dt-lr-crumbs a { color: var(--dt-accent, #056dc2); text-decoration: none; }
      .dt-lr { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; background: rgba(34,34,34,.55); font: 14px/20px var(--dt-font, open-sans), sans-serif; color: var(--dt-fg, #25292f); }
      .dt-lr-paneel { width: min(1240px, calc(100vw - 32px)); height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--dt-bg, #fff); border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.25); overflow: hidden; }
      .dt-lr-kop { display: flex; align-items: baseline; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--dt-line, #e0e6ea); } .dt-lr-kop h2 { margin: 0; font-size: 18px; color: var(--dt-fg, #0b385c); }
      .dt-lr-keuzes { padding: 12px 20px; border-bottom: 1px solid var(--dt-line, #e0e6ea); background: color-mix(in srgb, var(--dt-fg, #25292f) 4%, var(--dt-bg, #fff)); display: flex; flex-direction: column; gap: 8px; }
      .dt-lr-resultaat { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 12px 20px; }
      .dt-lr-voet { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 20px; border-top: 1px solid var(--dt-line, #e0e6ea); background: color-mix(in srgb, var(--dt-fg, #25292f) 4%, var(--dt-bg, #fff)); }
      .dt-lr-rij { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 12px; }
      .dt-lr-label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; }
      .dt-lr-veld { min-height: 32px; padding: 4px 8px; border: 1px solid var(--dt-line, #818b98); border-radius: 4px; background: var(--dt-bg, #fff); font: 400 14px/20px open-sans, sans-serif; color: var(--dt-fg, #25292f); }
      select[multiple].dt-lr-veld { min-width: 260px; }
      .dt-lr-eigen { display: inline-flex; align-items: center; gap: 6px; }
      .dt-lr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dt-lr-chip { height: 30px; padding: 0 12px; border: 1px solid var(--dt-line, #c8d1da); border-radius: 999px; background: var(--dt-bg, #fff); font: 13px open-sans, sans-serif; cursor: pointer; }
      .dt-lr-chip[aria-pressed="true"] { background: color-mix(in srgb, var(--dt-accent, var(--dt-accent, #056dc2)) 22%, var(--dt-bg, #fff)); border-color: var(--dt-accent, #056dc2); font-weight: 700; }
      .dt-lr-btn { height: 34px; padding: 0 14px; border: 1px solid var(--dt-accent, #056dc2); border-radius: 4px; background: var(--dt-bg, #fff); color: var(--dt-accent, #056dc2); font: 600 14px/32px open-sans, sans-serif; cursor: pointer; }
      .dt-lr-btn.is-hoofd { background: var(--dt-accent, #056dc2); color: #fff; } .dt-lr-btn:disabled { opacity: .5; cursor: default; }
      .dt-lr-link { border: 0; background: none; padding: 0; color: var(--dt-accent, #056dc2); font: 600 12px open-sans, sans-serif; cursor: pointer; }
      .dt-lr-balk { height: 4px; border-radius: 2px; background: var(--dt-line, #e0e6ea); overflow: hidden; } .dt-lr-balk i { display: block; height: 100%; width: 0; background: var(--dt-accent, #056dc2); transition: width .2s; }
      .dt-lr-status, .dt-lr-zacht { color: var(--dt-muted, #59636e); font-size: 13px; margin: 0; }
      .dt-lr-filters { display: flex; flex-wrap: wrap; gap: 16px; }
      .dt-lr-tabs { display: inline-flex; border: 1px solid var(--dt-line, #c8d1da); border-radius: 4px; overflow: hidden; }
      .dt-lr-tab { border: 0; border-right: 1px solid var(--dt-line, #c8d1da); background: var(--dt-bg, #fff); padding: 6px 14px; font: 13px open-sans, sans-serif; cursor: pointer; } .dt-lr-tab:last-child { border-right: 0; }
      .dt-lr-tab[aria-pressed="true"] { background: var(--dt-accent, #056dc2); color: #fff; font-weight: 700; }
      .dt-lr-scroll { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--dt-line, #e0e6ea); border-radius: 4px; }
      .dt-lr-tabel { width: 100%; border-collapse: collapse; font-size: 13px; }
      .dt-lr-tabel th { position: sticky; top: 0; background: color-mix(in srgb, var(--dt-fg, #25292f) 4%, var(--dt-bg, #fff)); text-align: left; font-size: 12px; color: var(--dt-muted, #59636e); padding: 6px 8px; border-bottom: 1px solid var(--dt-line, #c8d1da); white-space: nowrap; }
      .dt-lr-tabel td { padding: 5px 8px; border-bottom: 1px solid var(--dt-line, #f0f2f5); vertical-align: top; } .dt-lr-tabel td.getal { text-align: right; font-variant-numeric: tabular-nums; }
      .dt-lr-tabel td.is-laag { color: #c70e13; font-weight: 700; } .dt-lr-tabel td.lijst { font-size: 12px; color: var(--dt-fg, #393f46); max-width: 360px; }
    `;
    document.head.append(st);
  },
});
