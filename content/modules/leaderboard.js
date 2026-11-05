/* Leaderboard: wie was in een week het meest aanwezig in een klas.
 *
 * Tegel "Leaderboard" op Aanwezigheid (naast Meldingen, Registraties, ...). Die opent een eigen
 * pagina op dezelfde plek: klas kiezen, week kiezen, podium met de top 3 en de hele klas op volgorde.
 *
 * Klassen: dezelfde lijst als het filter "Klassen" in het leerlingenoverzicht
 * (/api/leerlingen/zoeken/filters), leerlingen via /api/leerlingen/zoeken?klassen=...
 * Per leerling dezelfde berekening als Inzicht en de Excel-export (vzStats in verzuiminzicht.js):
 * afwezig = absent, ziek of uitgestuurd; te laat telt als aanwezig; vrijgestelde lessen tellen niet mee.
 * Volgorde: aanwezig %, dan minder vaak te laat, dan meer lessen aanwezig. Gelijke cijfers delen een
 * plaats en de plaatsen lopen door zonder gaten (1, 1, 2), zodat er altijd een 1, 2 en 3 op het podium staan.
 * Per leerling wordt ook de week ervoor opgehaald (in dezelfde aanvragen), voor de pijl omhoog/omlaag/gelijk
 * ten opzichte van de plaats van vorige week.
 *
 * Digibord: knop die alleen de top 3 schermvullend toont, met een langzamere onthulling (3, 2, 1) voor
 * de klas. Bewust geen hele klas en geen dalers: alleen voornamen, aanwezigheid en wie gestegen is.
 *
 * Foto's (knop, standaard uit): pasfoto's uit Magister (/api/leerlingen/{id}/foto) in plaats van
 * initialen, op de pagina en op het digibord. Opgehaald via het netwerk-script als data-URL, alleen in
 * het geheugen van dit tabblad.
 * Alles via je eigen Magister-sessie; er gaat niets naar buiten. */
DT.register({
  id: "leaderboard",
  _stop: null,
  _view: null,
  _cache: new Map(),   // "klas|maandag" -> { lln, rijen, klaar }
  _gen: 0,
  _foto: new Map(),    // leerling-id -> data-URL of null (geen foto)
  _fotosAan: false,

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 300, poll: 1500 });
    this._hash = () => { if (this._view && !/^#\/aanwezigheid\/?$/.test(location.hash)) this.sluit(); };
    window.addEventListener("hashchange", this._hash);
  },

  destroy() {
    this._stop && this._stop();
    window.removeEventListener("hashchange", this._hash);
    this.sluit();
    DT.deepQueryAll("#dt-lb-tegel").forEach((el) => el.remove());
    document.getElementById("dt-lb-style")?.remove();
  },

  /* ---------- tegel op Aanwezigheid ---------- */
  mount(DT) {
    const dash = DT.deepQuery("att-attendance-dashboard");
    const wrap = dash?.shadowRoot?.querySelector(".wrapper");
    if (this._view && !this._view.isConnected) this.sluit();
    if (this._view && !document.querySelector("mg-att-tiles")) this.sluit();
    const oud = wrap?.querySelector("#dt-lb-tegel");
    /* Zelfde als bij de lestools: de kaartkop alleen vanuit de pagina laten zetten. */
    if (oud && oud.shadowRoot?.querySelector("h1")?.textContent.trim() !== "Leaderboard") window.postMessage({ type: "dt:attr:opnieuw", selector: "#dt-lb-tegel", attr: "heading" }, "*");
    if (!wrap || oud) return;
    const c = document.createElement("dna-link-card");
    c.id = "dt-lb-tegel";
    c.setAttribute("heading", "Leaderboard");
    c.setAttribute("tabindex", "0");
    c.setAttribute("role", "link");
    c.style.cursor = "pointer";
    const oms = document.createElement("div");
    oms.slot = "description"; oms.textContent = "Wie was er per week het meest aanwezig in een klas";
    /* Magisters iconenset heeft geen beker: een bestaand duotone-icoon met onze eigen paden erin. */
    const ic = document.createElement("dna-icon");
    ic.slot = "icon"; ic.setAttribute("name", "fad-traffic-light");
    c.append(oms, ic);
    const open = (e) => { e.preventDefault(); e.stopPropagation(); this.open(DT); };
    c.addEventListener("click", open);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(e); });
    wrap.append(c);
    this.beker(ic);
  },

  beker(ic, poging = 0) {
    const svg = ic.shadowRoot?.querySelector("svg");
    if (!svg) { if (poging < 20) setTimeout(() => this.beker(ic, poging + 1), 150); return; }
    svg.setAttribute("viewBox", "0 0 512 512");
    svg.innerHTML =
      `<path d="M144 40h224v120c0 61.9-50.1 112-112 112S144 221.9 144 160V40z"></path>` +
      `<path d="M136 24h240a16 16 0 0 1 16 16v16h72a16 16 0 0 1 16 16v32c0 61-46.6 111.2-106.2 116.5A136.6 136.6 0 0 1 288 284.4V352h48a40 40 0 0 1 40 40v64a16 16 0 0 1-16 16H152a16 16 0 0 1-16-16v-64a40 40 0 0 1 40-40h48v-67.6a136.6 136.6 0 0 1-85.8-63.9C78.6 215.2 32 165 32 104V72a16 16 0 0 1 16-16h72V40a16 16 0 0 1 16-16zM80 104c0 30.4 19.6 56.3 46.9 65.7A135.4 135.4 0 0 1 120 128v-24H80zm312 24c0 14.4-2.4 28.3-6.9 41.7 27.3-9.4 46.9-35.3 46.9-65.7h-40v24zM256 72l-14.4 29.2-32.2 4.7 23.3 22.7-5.5 32.1L256 145.6l28.8 15.1-5.5-32.1 23.3-22.7-32.2-4.7L256 72z"></path>`;
  },

  /* ---------- eigen pagina ---------- */
  open(DT) {
    const tiles = document.querySelector("mg-att-tiles");
    const uv = tiles?.parentElement;
    if (!uv || this._view) return;
    this.css();
    const v = DT.el("section", { class: "dt-lb", "aria-label": "Leaderboard aanwezigheid" });
    const terug = DT.el("a", { href: "#/aanwezigheid", class: "dt-lb-crumb", text: "Aanwezigheid" });
    terug.addEventListener("click", (e) => { e.preventDefault(); this.sluit(); });
    this._klassen = DT.el("div", { class: "dt-lb-seg", role: "tablist", "aria-label": "Klas" });
    this._week = DT.el("span", { class: "dt-lb-week" });
    this._nu = DT.el("button", { class: "dt-lb-nu", type: "button", text: "Deze week" });
    this._bordKnop = DT.el("button", { class: "dt-lb-nu dt-lb-bordknop", type: "button", disabled: "", title: "Top 3 schermvullend tonen, bijvoorbeeld op het digibord",
      html: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11v2.5M5 13.5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Digibord</span>` });
    this._bordKnop.addEventListener("click", () => this.bord(DT));
    try { this._fotosAan = localStorage.getItem("dt-lb-fotos") === "1"; } catch {}
    this._fotoKnop = DT.el("button", { class: "dt-lb-nu dt-lb-fotoknop", type: "button", "aria-pressed": String(this._fotosAan),
      title: "Pasfoto's uit Magister tonen in plaats van initialen. Houd je aan de afspraken van je school over beeldmateriaal, zeker op het digibord.",
      html: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6.3" r="2.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.8 13.5c.8-2 2.4-3 4.2-3s3.4 1 4.2 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Foto's</span>` });
    this._fotoKnop.addEventListener("click", () => this.fotos(DT, !this._fotosAan));
    this._vorige = DT.el("button", { class: "dt-lb-pijl", type: "button", "aria-label": "Vorige week", html: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` });
    this._volgende = DT.el("button", { class: "dt-lb-pijl", type: "button", "aria-label": "Volgende week", html: `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` });
    this._vorige.addEventListener("click", () => this.kies(DT, { week: this.plus(this._ma, -7) }));
    this._volgende.addEventListener("click", () => this.kies(DT, { week: this.plus(this._ma, 7) }));
    this._nu.addEventListener("click", () => this.kies(DT, { week: this.maandag(new Date()) }));
    this._status = DT.el("div", { class: "dt-lb-status", "aria-live": "polite" });
    this._podium = DT.el("div", { class: "dt-lb-podium dt-lb-card" });
    this._lijst = DT.el("ol", { class: "dt-lb-lijst" });
    v.append(
      DT.el("div", { class: "dt-lb-kop dt-lb-card" }, [
        DT.el("nav", { class: "dt-lb-crumbs", "aria-label": "Kruimelpad" }, [terug, DT.el("span", { "aria-hidden": "true", text: "›" }), DT.el("span", { text: "Leaderboard" })]),
        DT.el("h1", { html: `Leaderboard<span class="dt-lb-punt">.</span>` }),
        DT.el("div", { class: "dt-lb-bediening" }, [this._klassen, DT.el("div", { class: "dt-lb-weeknav" }, [this._nu, this._vorige, this._week, this._volgende, this._fotoKnop, this._bordKnop])]),
      ]),
      this._status, this._podium,
      DT.el("div", { class: "dt-lb-card dt-lb-tabel" }, [
        DT.el("div", { class: "dt-lb-rij dt-lb-th", "aria-hidden": "true" }, ["#", "Trend", "", "Leerling", "Aanwezig", "Lessen", "Te laat"].map((t) => DT.el("span", { text: t }))),
        this._lijst,
      ]),
    );
    uv.classList.add("dt-lb-open");
    tiles.after(v);
    this._view = v;
    this._ma = this.maandag(new Date());
    this.laadKlassen(DT);
  },

  sluit() {
    this._gen++;
    this._bord?.sluit();
    this._view?.remove(); this._view = null;
    document.querySelectorAll(".dt-lb-open").forEach((el) => el.classList.remove("dt-lb-open"));
  },

  async laadKlassen(DT) {
    this.status("Klassen ophalen…");
    const r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&rol=Docent&peildatum=${this.ymd(new Date())}`, { full: true, timeout: 15000 });
    const kl = (r.status === 200 && r.json?.klassen || []).filter((k) => k && k.naam).sort((a, b) => a.naam.localeCompare(b.naam, "nl", { numeric: true }));
    if (!this._view) return;
    if (!kl.length) return this.status(r.status === 200 ? "Er zijn geen klassen aan je gekoppeld." : `Klassen ophalen lukte niet (Magister antwoordde ${r.status}).`, true);
    let bewaard = null; try { bewaard = localStorage.getItem("dt-lb-klas"); } catch {}
    this._klassen.replaceChildren(...kl.map((k) => {
      const b = DT.el("button", { type: "button", role: "tab", class: "dt-lb-klas", "data-klas": k.naam, text: k.naam });
      b.addEventListener("click", () => this.kies(DT, { klas: k.naam }));
      return b;
    }));
    this.kies(DT, { klas: kl.some((k) => k.naam === bewaard) ? bewaard : kl[0].naam });
  },

  kies(DT, { klas = this._klas, week = this._ma } = {}) {
    const vandaag = this.maandag(new Date());
    if (week > vandaag) week = vandaag;
    this._klas = klas; this._ma = week;
    try { localStorage.setItem("dt-lb-klas", klas); } catch {}
    for (const b of this._klassen.children) b.setAttribute("aria-selected", String(b.dataset.klas === klas));
    const zo = this.plus(week, 6), wk = isoWeek(week).w;
    const mnd = (d) => d.toLocaleDateString("nl-NL", { month: "long" });
    this._week.textContent = `Week ${wk} · ${week.getDate()}${week.getMonth() === zo.getMonth() ? "" : " " + mnd(week)} – ${zo.getDate()} ${mnd(zo)}`;
    const dezeWeek = +week === +vandaag;
    this._volgende.disabled = dezeWeek;
    this._nu.hidden = dezeWeek;
    this.laad(DT);
  },

  /* ---------- gegevens ---------- */
  async laad(DT) {
    const gen = ++this._gen, klas = this._klas, ma = this._ma;
    const key = `${klas}|${this.ymd(ma)}`;
    let c = this._cache.get(key);
    if (c && (c.klaar || c.bezig)) { this.teken(c); if (c.klaar) return; }
    if (!c || !c.bezig) {
      c = { lln: null, rijen: [], klaar: false, bezig: true };
      this._cache.set(key, c);
      this.vul(DT, c, klas, ma).finally(() => { c.bezig = false; });
    }
    /* Tekent mee zolang deze klas en week gekozen zijn. */
    while (gen === this._gen && this._view) {
      this.teken(c);
      if (c.klaar || c.fout) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  },

  async vul(DT, c, klas, ma) {
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    /* Magister begrenst het aantal aanvragen (429): na elkaar, met korte pauzes, en bij 429/503 langer wachten. */
    const api = async (url) => {
      let r;
      for (let poging = 0; poging < 6; poging++) {
        r = await DT.api(url, { full: true, timeout: 25000 });
        if (r.status !== 429 && r.status !== 503) return r;
        await wacht(1500 * 2 ** poging);
      }
      return r;
    };
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const r = await api(`/api/leerlingen/zoeken?q=**&top=250&skip=0&orderby=roepnaam%20asc&peildatum=${this.ymd(new Date())}&Rol=Docent&klassen=${encodeURIComponent(klas)}&velden=stamnummer&velden=naam&velden=klassen`);
    const items = lijst(r);
    if (!items) { c.fout = `Leerlingen van ${klas} ophalen lukte niet (Magister antwoordde ${r.status}).`; return; }
    c.lln = items.map((x) => ({ id: x.id, naam: [x.roepnaam, x.tussenvoegsel, x.achternaam].filter(Boolean).join(" "), init: ((x.roepnaam || "")[0] || "") + ((x.achternaam || "")[0] || "") })).filter((x) => x.id != null);
    const zo = this.plus(ma, 6), now = new Date(), eind = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    const tot = new Date(Math.min(+eind(zo), +now));
    const vorigVan = this.plus(ma, -7), vorigTot = eind(this.plus(ma, -1));
    const werk = c.lln.slice();
    const doe = async () => {
      while (werk.length) {
        const l = werk.shift();
        const v = await api(`/api/m6/leerlingen/${l.id}/verantwoordingen?begin=${this.ymd(vorigVan)}&einde=${this.ymd(zo)}`);
        await wacht(120);
        const a = await api(`/api/leerlingen/${l.id}/afspraken?status=actief&begin=${this.ymd(vorigVan)}&einde=${this.ymd(zo)}`);
        await wacht(120);
        const regs = lijst(v), rooster = lijst(a);
        let T = null, Tv = null;
        if (regs && rooster) {
          rooster.push(...await vzLosseLessen(l.id, regs, rooster, api, 30));
          T = vzStats(regs, rooster, ma, tot).totaal;
          Tv = vzStats(regs, rooster, vorigVan, vorigTot).totaal;
        }
        c.rijen.push({ l, T, Tv, fout: !T });
      }
    };
    await Promise.all([doe(), doe()]);
    c.klaar = true;
  },

  /* Volgorde en plaatsen; gelijke cijfers delen een plaats (1, 1, 2). */
  rangschik(rijen, veld = "T") {
    const met = [], zonder = [];
    for (const x of rijen) {
      const T = x[veld];
      if (T && T.telt > 0) met.push({ ...x, T, aanw: T.telt - T.afwezig, pct: (T.telt - T.afwezig) / T.telt });
      else zonder.push(x);
    }
    met.sort((a, b) => b.pct - a.pct || a.T.teLaat - b.T.teLaat || b.aanw - a.aanw || a.l.naam.localeCompare(b.l.naam, "nl"));
    met.forEach((r, i) => {
      const p = met[i - 1];
      r.plek = !p ? 1 : p.pct === r.pct && p.T.teLaat === r.T.teLaat && p.aanw === r.aanw ? p.plek : p.plek + 1;
    });
    zonder.sort((a, b) => a.l.naam.localeCompare(b.l.naam, "nl"));
    return { met, zonder };
  },

  teken(c) {
    if (!this._view) return;
    if (c.fout) return this.status(c.fout, true);
    const n = c.lln?.length ?? 0, k = c.rijen.length;
    if (!c.lln) this.status("Leerlingen ophalen…");
    else if (!c.klaar) this.status(`Aanwezigheid ophalen: ${k} van ${n} leerlingen`, false, k / Math.max(1, n));
    else this.status(n ? "" : "Deze klas heeft geen leerlingen.");
    const { met, zonder } = this.rangschik(c.rijen);
    const pct = (r) => `${Math.floor(r.pct * 100)}%`;
    const lessen = (r) => `${r.aanw} van ${r.T.telt}`;
    const open = (r) => () => typeof openLeerling === "function" && openLeerling(r.l.id);

    /* Vergeleken met vorige week (alleen als alles binnen is). */
    const vorig = c.klaar ? new Map(this.rangschik(c.rijen, "Tv").met.map((r) => [r.l.id, r.plek])) : null;
    const trend = (r) => {
      if (!vorig) return DT.el("span", { class: "dt-lb-trend" });
      const v = vorig.get(r.l.id);
      if (v == null) return DT.el("span", { class: "dt-lb-trend is-nieuw", title: "Vorige week geen lessen", text: "nieuw" });
      const d = v - r.plek, pijl = (up) => `<svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="${up ? "M5 1.5 9 8H1z" : "M5 8.5 1 2h8z"}" fill="currentColor"/></svg>`;
      const t = `Vorige week ${v}e plaats`;
      if (d > 0) return DT.el("span", { class: "dt-lb-trend is-op", title: `${t}: ${d} omhoog`, "aria-label": `${d} plaats${d > 1 ? "en" : ""} gestegen`, html: `${pijl(true)}${d}` });
      if (d < 0) return DT.el("span", { class: "dt-lb-trend is-af", title: `${t}: ${-d} omlaag`, "aria-label": `${-d} plaats${d < -1 ? "en" : ""} gedaald`, html: `${pijl(false)}${-d}` });
      return DT.el("span", { class: "dt-lb-trend is-gelijk", title: `${t}: gelijk`, "aria-label": "gelijk gebleven", html: `<svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M1.5 3.5h7M1.5 6.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>` });
    };

    /* Podium: 2 – 1 – 3, pas als alles binnen is (anders verspringt het). Een gedeelde plaats toont
     * iedereen die er staat. Opbouw: blokken groeien op (3, 2, 1), dan komen de leerlingen erop, het
     * percentage telt op en bij de winnaar(s) valt de kroon en wat confetti. Eén keer per klas en week. */
    if (c.klaar && met.length) {
      if (this._podiumVan !== c) this.podium(c, met, { pct, lessen, open, trend });
      this._bordData = { met, vorig, klas: this._klas, week: this._week.textContent };
      if (this._fotosAan && !c.fotos) { c.fotos = true; this.laadFotos(DT, [...met, ...zonder].map((r) => r.l)); }
    } else { this._podiumVan = null; this._podium.replaceChildren(); this._bordData = null; }
    this._bordKnop.disabled = !this._bordData;

    const rij = (r, leeg) => {
      const li = DT.el("li", { class: `dt-lb-rij${leeg ? " is-leeg" : ""}${!leeg && r.plek <= 3 ? " is-top" : ""}`, tabindex: "0", title: "Leerlingkaart openen" }, [
        DT.el("span", { class: "dt-lb-plek", text: leeg ? "–" : String(r.plek) }),
        leeg ? DT.el("span") : trend(r),
        this.avatar(r.l),
        DT.el("span", { class: "dt-lb-naam", text: r.l.naam }),
        leeg ? DT.el("span", { class: "dt-lb-geen", text: r.fout ? "niet op te halen" : "geen lessen" })
          : DT.el("span", { class: "dt-lb-balk" }, [DT.el("span", {}, DT.el("i", { style: `width:${Math.round(r.pct * 100)}%` })), DT.el("b", { text: pct(r) })]),
        DT.el("span", { class: "dt-lb-num", text: leeg ? "" : lessen(r) }),
        DT.el("span", { class: "dt-lb-num", text: leeg || !r.T.teLaat ? "" : `${r.T.teLaat}×` }),
      ]);
      li.addEventListener("click", open(r));
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") open(r)(); });
      return li;
    };
    this._lijst.replaceChildren(...met.map((r) => rij(r)), ...zonder.map((r) => rij(r, true)));
  },

  podium(c, met, { pct, lessen, open, trend }) {
    this._podiumVan = c;
    const rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const groep = (n) => met.filter((r) => r.plek === n);
    const volgorde = [groep(2), groep(1), groep(3)].filter((g) => g.length);
    const voornamen = (g) => g.map((r) => r.l.naam.split(" ")[0]);
    const namen = (g) => g.length <= 3 ? voornamen(g).join(", ").replace(/, ([^,]*)$/, " en $1") : `${voornamen(g).slice(0, 2).join(", ")} en ${g.length - 2} anderen`;
    const START = { 3: 450, 2: 600, 1: 800 };   // ms: wanneer de leerlingen op hun blok verschijnen
    const kolommen = volgorde.map((g) => {
      const r = g[0], een = g.length === 1, n = r.plek;
      const groot = DT.el("span", { class: "dt-lb-groot", text: rustig ? pct(r) : "0%" });
      const top = DT.el(een ? "button" : "div", { class: "dt-lb-top", ...(een ? { type: "button", title: "Leerlingkaart openen" } : { title: g.map((x) => x.l.naam).join("\n") }) }, [
        ...(n === 1 ? [DT.el("span", { class: "dt-lb-kroon", "aria-hidden": "true", html: `<svg viewBox="0 0 24 16" width="30" height="20"><path d="M2 14 1 3l6 5 5-7 5 7 6-5-1 11z" fill="#F7C948" stroke="#D99A00" stroke-width="1.2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="1.6" fill="#fff" opacity=".85"/></svg>` })] : []),
        DT.el("span", { class: "dt-lb-avatars" }, [...g.slice(0, 4).map((x) => this.avatar(x.l)), ...(g.length > 4 ? [DT.el("span", { class: "dt-lb-avatar dt-lb-meer", text: `+${g.length - 4}` })] : [])]),
        DT.el("span", { class: "dt-lb-naam", text: een ? r.l.naam : namen(g) }),
        groot,
        DT.el("span", { class: "dt-lb-sub", text: `${lessen(r)} lessen${r.T.teLaat ? ` · ${r.T.teLaat}× te laat` : ""}${een ? "" : ` · ${g.length} leerlingen`}` }),
        ...(een ? [trend(r)] : []),
      ]);
      if (een) top.addEventListener("click", open(r));
      if (!rustig) this.telOp(groot, Math.floor(r.pct * 100), START[n]);
      return DT.el("div", { class: `dt-lb-plaats dt-lb-p${n}` }, [top, DT.el("div", { class: "dt-lb-blok", "aria-hidden": "true" }, DT.el("span", { text: String(n) }))]);
    });
    this._podium.replaceChildren(...kolommen);
    if (!rustig) setTimeout(() => this.confetti(), 1150);
  },

  /* ---------- digibord: alleen de top 3, schermvullend ---------- */
  async bord(DT) {
    const d = this._bordData;
    if (!d || this._bord || this._bordStart) return;
    /* Met foto's aan eerst de foto's van het podium ophalen (meestal al binnen), dan pas tonen. */
    if (this._fotosAan) {
      this._bordStart = true; this._bordKnop.classList.add("is-bezig");
      await Promise.race([this.laadFotos(DT, d.met.filter((r) => r.plek <= 3).map((r) => r.l)), new Promise((r) => setTimeout(r, 4000))]);
      this._bordStart = false; this._bordKnop.classList.remove("is-bezig");
      if (!this._view) return;
    }
    this.css();
    const laag = DT.el("div", { class: "dt-lb-bord", role: "dialog", "aria-modal": "true", "aria-label": `Meest aanwezig ${d.klas}` });
    const inhoud = DT.el("div", { class: "dt-lb-bord-inhoud" });
    const opnieuw = DT.el("button", { type: "button", text: "Opnieuw afspelen" });
    const dicht = DT.el("button", { type: "button", text: "Sluiten (Esc)" });
    laag.append(DT.el("div", { class: "dt-lb-bord-gloed", "aria-hidden": "true" }), inhoud, DT.el("div", { class: "dt-lb-bord-knoppen" }, [opnieuw, dicht]));
    let timers = [], muis = 0;
    const wis = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const speel = () => { wis(); inhoud.replaceChildren(...this.bordInhoud(DT, d, later)); };
    const beweeg = () => { laag.classList.add("is-actief"); clearTimeout(muis); muis = setTimeout(() => laag.classList.remove("is-actief"), 2500); };
    const toets = (e) => { if (e.key === "Escape") { e.preventDefault(); this._bord?.sluit(); } };
    const fs = () => { if (!document.fullscreenElement && this._bord) this._bord.sluit(); };
    this._bord = {
      sluit: () => {
        wis(); clearTimeout(muis);
        document.removeEventListener("keydown", toets, true); document.removeEventListener("fullscreenchange", fs);
        if (document.fullscreenElement === laag) document.exitFullscreen().catch(() => {});
        laag.remove(); this._bord = null;
      },
    };
    opnieuw.addEventListener("click", speel);
    dicht.addEventListener("click", () => this._bord?.sluit());
    laag.addEventListener("mousemove", beweeg);
    document.addEventListener("keydown", toets, true);
    document.body.append(laag);
    laag.requestFullscreen?.().then(() => document.addEventListener("fullscreenchange", fs)).catch(() => {});
    speel(); beweeg();
  },

  bordInhoud(DT, { met, vorig, klas, week }, later) {
    const rustig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const groep = (n) => met.filter((r) => r.plek === n);
    /* Alleen voornamen; bij dubbele voornamen op het podium de eerste letter van de achternaam erbij. */
    const top = [1, 2, 3].flatMap(groep), vn = (r) => r.l.naam.split(" ")[0];
    const dubbel = new Set(top.map(vn).filter((v, i, a) => a.indexOf(v) !== i));
    const roep = (r) => dubbel.has(vn(r)) ? `${vn(r)} ${r.l.naam.split(" ").slice(-1)[0][0]}.` : vn(r);
    const START = { 3: 1400, 2: 2600, 1: 4000 };   // ms: wanneer de leerlingen van die plaats verschijnen
    const KROON = `<svg viewBox="0 0 64 46" aria-hidden="true"><defs><linearGradient id="dt-lb-goud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".55" stop-color="#FFC93C"/><stop offset="1" stop-color="#E29B00"/></linearGradient></defs><path d="M7 36 4 11l14.5 11.5L32 5l13.5 17.5L60 11l-3 25z" fill="url(#dt-lb-goud)" stroke="#B87A00" stroke-width="1.4" stroke-linejoin="round"/><rect x="7" y="36" width="50" height="7" rx="2.5" fill="url(#dt-lb-goud)" stroke="#B87A00" stroke-width="1.4"/><circle cx="4" cy="11" r="3.2" fill="#FFE9A0" stroke="#B87A00" stroke-width="1.2"/><circle cx="32" cy="5" r="3.6" fill="#FFE9A0" stroke="#B87A00" stroke-width="1.2"/><circle cx="60" cy="11" r="3.2" fill="#FFE9A0" stroke="#B87A00" stroke-width="1.2"/><circle cx="32" cy="27" r="3.8" fill="#FF4F75"/><circle cx="19.5" cy="29.5" r="2.5" fill="#5AC8FA"/><circle cx="44.5" cy="29.5" r="2.5" fill="#5AC8FA"/><path d="M10 34.5h44" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/></svg>`;
    const kolom = (g) => {
      const r = g[0], n = r.plek, max = n === 1 ? 8 : 6;
      const zicht = g.length <= max ? g : g.slice(0, max - 1), rest = g.length - zicht.length;
      const maat = g.length === 1 ? "is-1" : g.length <= 3 ? "is-3" : g.length <= 6 ? "is-6" : "is-9";
      const groot = DT.el("span", { class: "dt-lb-groot", text: rustig ? `${Math.floor(r.pct * 100)}%` : "0%" });
      const stijgers = g.filter((x) => vorig?.has(x.l.id) && vorig.get(x.l.id) > x.plek);
      if (!rustig) this.telOp(groot, Math.floor(r.pct * 100), START[n] + 200);
      const persoon = (av, naam, i) => DT.el("span", { class: "dt-lb-persoon", style: `animation-delay:${START[n] + i * 110}ms` }, [av, DT.el("span", { class: "dt-lb-voornaam", text: naam })]);
      const mensen = [...zicht.map((x, i) => persoon(this.avatar(x.l), roep(x), i)), ...(rest ? [persoon(DT.el("span", { class: "dt-lb-avatar dt-lb-meer", text: `+${rest}` }), "anderen", zicht.length)] : [])];
      return DT.el("div", { class: `dt-lb-plaats dt-lb-p${n}` }, [
        DT.el("div", { class: "dt-lb-top" }, [
          ...(n === 1 ? [DT.el("span", { class: "dt-lb-kroon", html: KROON })] : []),
          DT.el("div", { class: `dt-lb-mensen ${maat}` }, mensen),
          groot,
          ...(stijgers.length === 1 && g.length === 1 ? [DT.el("span", { class: "dt-lb-stijger", text: `▲ ${vorig.get(r.l.id) - r.plek} ${vorig.get(r.l.id) - r.plek === 1 ? "plaats" : "plaatsen"} gestegen` })] : []),
        ]),
        DT.el("div", { class: "dt-lb-blok" }, DT.el("span", { text: String(n) })),
      ]);
    };
    if (!rustig) { later(() => this.regen(DT, 140), START[1] + 300); later(() => this.regen(DT, 60), START[1] + 2600); }
    return [
      DT.el("header", { class: "dt-lb-bord-kop" }, [
        DT.el("span", { class: "dt-lb-bord-label", text: `${klas} · ${week}` }),
        DT.el("h1", { text: "Meest aanwezig" }),
      ]),
      DT.el("div", { class: "dt-lb-bord-podium" }, [groep(2), groep(1), groep(3)].filter((g) => g.length).map(kolom)),
    ];
  },

  /* Confetti die over het hele scherm naar beneden dwarrelt. */
  regen(DT, aantal) {
    const laag = document.querySelector(".dt-lb-bord");
    if (!laag) return;
    const kleur = ["#F7C948", "#34C759", "#0A84FF", "#FF2D55", "#BF5AF2", "#FF9F0A", "#64D2FF"];
    const bak = DT.el("div", { class: "dt-lb-regen", "aria-hidden": "true" });
    for (let i = 0; i < aantal; i++) {
      const s = DT.el("i");
      const duur = 2600 + Math.random() * 2200;
      s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--dx:${Math.round(Math.random() * 160 - 80)}px;--r:${Math.round(Math.random() * 1080 - 540)}deg;background:${kleur[i % kleur.length]};animation-duration:${Math.round(duur)}ms;animation-delay:${Math.round(Math.random() * 900)}ms;${i % 3 ? "" : "border-radius:50%;width:10px;height:10px;"}`;
      bak.append(s);
    }
    laag.append(bak);
    setTimeout(() => bak.remove(), 6200);
  },

  /* ---------- foto's ---------- */
  avatar(l, cls = "") {
    const a = DT.el("span", { class: `dt-lb-avatar ${cls}`.trim(), "data-lb-id": String(l.id), text: l.init });
    this.fotoIn(a);
    return a;
  },

  fotoIn(a) {
    const url = this._fotosAan ? this._foto.get(a.dataset.lbId) : null;
    const img = a.querySelector("img");
    if (url && !img) { a.classList.add("has-foto"); a.append(DT.el("img", { src: url, alt: "" })); }
    else if (!url && img) { a.classList.remove("has-foto"); img.remove(); }
  },

  fotos(DT, aan) {
    this._fotosAan = aan;
    try { localStorage.setItem("dt-lb-fotos", aan ? "1" : "0"); } catch {}
    this._fotoKnop?.setAttribute("aria-pressed", String(aan));
    document.querySelectorAll(".dt-lb-avatar[data-lb-id]").forEach((a) => this.fotoIn(a));
    const c = this._cache.get(`${this._klas}|${this.ymd(this._ma)}`);
    if (aan && c?.klaar && this._bordData) { c.fotos = true; this.laadFotos(DT, [...this._bordData.met.map((r) => r.l), ...c.lln]); }
  },

  /* Na elkaar ophalen; wat binnen is, verschijnt meteen overal waar die leerling staat. */
  async laadFotos(DT, lln) {
    for (const l of lln) {
      const k = String(l.id);
      if (!this._fotosAan) return;
      if (this._foto.has(k)) continue;
      if (this._fotoBezig?.has(k)) { await this._fotoBezig.get(k); continue; }
      const p = DT.api(`/api/leerlingen/${encodeURIComponent(l.id)}/foto?redirect_type=body`, { blob: true, timeout: 10000 }).then((r) => {
        if (r.status) this._foto.set(k, r.data || null);
        document.querySelectorAll(`.dt-lb-avatar[data-lb-id="${k}"]`).forEach((a) => this.fotoIn(a));
      });
      (this._fotoBezig ||= new Map()).set(k, p);
      await p; this._fotoBezig.delete(k);
      await new Promise((r) => setTimeout(r, 50));
    }
  },

  telOp(el, doel, wacht) {
    const duur = 700;
    setTimeout(() => {
      const t0 = performance.now();
      const stap = (t) => {
        const f = Math.min(1, (t - t0) / duur), e = 1 - (1 - f) ** 3;
        el.textContent = `${Math.round(doel * e)}%`;
        if (f < 1 && el.isConnected) requestAnimationFrame(stap);
      };
      requestAnimationFrame(stap);
    }, wacht);
  },

  confetti() {
    const p1 = this._podium?.querySelector(".dt-lb-p1");
    if (!p1 || !p1.isConnected) return;
    const laag = DT.el("div", { class: "dt-lb-confetti", "aria-hidden": "true" });
    const kleur = ["#F7C948", "#34C759", "#007AFF", "#FF2D55", "#AF52DE", "#FF9500"];
    for (let i = 0; i < 36; i++) {
      const hoek = (Math.PI * (0.15 + 0.7 * Math.random())), kracht = 90 + Math.random() * 130;
      const s = DT.el("i");
      s.style.cssText = `--x:${Math.round(Math.cos(hoek) * kracht * (Math.random() < .5 ? -1 : 1))}px;--y:${Math.round(-Math.sin(hoek) * kracht)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;background:${kleur[i % kleur.length]};animation-delay:${Math.round(Math.random() * 120)}ms;${i % 3 ? "" : "border-radius:50%;"}`;
      laag.append(s);
    }
    p1.append(laag);
    setTimeout(() => laag.remove(), 1900);
  },

  status(tekst, fout = false, deel = null) {
    if (!this._status) return;
    this._status.classList.toggle("is-fout", fout);
    this._status.replaceChildren(...(tekst ? [DT.el("span", { text: tekst }), ...(deel != null ? [DT.el("span", { class: "dt-lb-voortgang" }, DT.el("i", { style: `width:${Math.round(deel * 100)}%` }))] : [])] : []));
  },

  /* ---------- hulp ---------- */
  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  plus(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); },
  maandag(d) { return this.plus(d, -((d.getDay() + 6) % 7)); },

  css() {
    if (document.getElementById("dt-lb-style")) return;
    const st = document.createElement("style"); st.id = "dt-lb-style";
    st.textContent = `
      ui-view.dt-lb-open > mg-att-tiles { display: none !important; }
      .dt-lb { --lb-card: var(--dt-bg); --lb-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); --lb-tint: color-mix(in srgb, var(--dt-accent) 12%, transparent);
        box-sizing: border-box; max-width: 1200px; margin: 0 auto; padding: 28px 24px 32px; font-family: var(--dt-font); color: var(--dt-fg); display: flex; flex-direction: column; gap: 20px; }
      .dt-lb .dt-lb-card { background: var(--lb-card); box-shadow: var(--lb-shadow); border-radius: 22px; border: 0; }
      .dt-lb-kop { padding: 14px 18px 16px; display: flex; flex-direction: column; gap: 6px; }
      .dt-lb-crumbs { display: flex; gap: 8px; align-items: center; font-size: 13px; font-weight: 500; color: var(--dt-muted); }
      .dt-lb-crumbs a { color: inherit; text-decoration: none; }
      .dt-lb-crumbs a:hover { color: var(--dt-accent); }
      .dt-lb h1 { margin: 0; font-size: 1.75rem; line-height: 2.125rem; font-weight: 700; letter-spacing: -.02em; color: var(--dt-fg); }
      .dt-lb-punt { color: var(--dt-accent); }
      .dt-lb-bediening { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
      .dt-lb-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 2px; border-radius: 999px; background: rgba(120,120,128,.12); }
      .dt-lb-klas { appearance: none; border: 0; background: transparent; color: var(--dt-fg); height: 26px; padding: 0 14px; border-radius: 999px; font: 500 13px/1 var(--dt-font); cursor: pointer; }
      .dt-lb-klas[aria-selected="true"] { background: var(--dt-bg); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .dt-lb-weeknav { display: inline-flex; align-items: center; gap: 6px; }
      .dt-lb-week { min-width: 17rem; text-align: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .dt-lb-pijl, .dt-lb-nu { appearance: none; border: 0; height: 30px; border-radius: 999px; background: var(--lb-tint); color: var(--dt-accent); cursor: pointer; display: inline-grid; place-items: center; font: 500 13px/1 var(--dt-font); }
      .dt-lb-pijl { width: 30px; padding: 0; }
      .dt-lb-nu { padding: 0 14px; }
      .dt-lb-pijl:disabled { opacity: .35; cursor: default; }
      .dt-lb button:focus-visible, .dt-lb-rij:focus-visible { outline: 2px solid var(--dt-accent); outline-offset: 2px; }
      .dt-lb-status { display: flex; align-items: center; gap: 12px; min-height: 0; font-size: 13px; color: var(--dt-muted); padding: 0 18px; }
      .dt-lb-status:empty { display: none; }
      .dt-lb-status.is-fout { color: #FF3B30; }
      .dt-lb-voortgang { flex: 0 0 160px; height: 4px; border-radius: 2px; background: rgba(120,120,128,.18); overflow: hidden; }
      .dt-lb-voortgang i { display: block; height: 100%; background: var(--dt-accent); transition: width .3s; }
      .dt-lb-podium { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: end; padding: 28px 28px 0; overflow: hidden; }
      .dt-lb-podium:empty { display: none; }
      .dt-lb-plaats { display: flex; flex-direction: column; align-items: center; gap: 12px; position: relative; min-width: 0; }
      .dt-lb-top { appearance: none; border: 0; background: none; padding: 0; font: inherit; color: inherit; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; max-width: 100%; position: relative;
        animation: dt-lb-in .55s cubic-bezier(.2,.9,.3,1.25) both; }
      button.dt-lb-top { cursor: pointer; border-radius: 16px; }
      .dt-lb-p3 .dt-lb-top { animation-delay: .45s; } .dt-lb-p2 .dt-lb-top { animation-delay: .6s; } .dt-lb-p1 .dt-lb-top { animation-delay: .8s; }
      .dt-lb-blok { width: 100%; border-radius: 16px 16px 0 0; display: flex; justify-content: center; padding-top: 10px; box-sizing: border-box; color: #fff; font-size: 34px; font-weight: 800; letter-spacing: -.02em;
        text-shadow: 0 1px 2px rgba(0,0,0,.18); transform-origin: bottom; position: relative; overflow: hidden; animation: dt-lb-groei .65s cubic-bezier(.2,.9,.3,1.12) both; }
      .dt-lb-p1 .dt-lb-blok { height: 132px; background: linear-gradient(180deg, #F7C948, #E0A800); animation-delay: .3s; }
      .dt-lb-p2 .dt-lb-blok { height: 96px; background: linear-gradient(180deg, #C9CED6, #9AA1AB); animation-delay: .15s; }
      .dt-lb-p3 .dt-lb-blok { height: 68px; background: linear-gradient(180deg, #DDA46C, #B87333); }
      .dt-lb-p1 .dt-lb-blok::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transform: translateX(-120%) skewX(-20deg); animation: dt-lb-glans 1.1s ease-in-out 1.3s both; }
      .dt-lb-kroon { position: absolute; top: -22px; left: 50%; margin-left: -15px; z-index: 2; animation: dt-lb-kroon .6s cubic-bezier(.3,1.6,.5,1) 1.1s both; }
      .dt-lb-p1 .dt-lb-top { padding-top: 14px; }
      .dt-lb-avatars { display: flex; justify-content: center; }
      .dt-lb-avatars .dt-lb-avatar + .dt-lb-avatar { margin-left: -12px; }
      .dt-lb-plaats .dt-lb-avatar { width: 52px; height: 52px; font-size: 18px; box-shadow: 0 0 0 3px var(--dt-bg); background: color-mix(in srgb, var(--dt-accent) 14%, var(--dt-bg)); }
      .dt-lb-p1 .dt-lb-avatar { width: 64px; height: 64px; font-size: 22px; }
      .dt-lb-avatar.dt-lb-meer { font-size: 15px !important; }
      .dt-lb-plaats .dt-lb-naam { font-size: 15px; font-weight: 600; max-width: 100%; white-space: normal; }
      .dt-lb-groot { font-size: 30px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .dt-lb-p1 .dt-lb-groot { font-size: 36px; color: var(--dt-accent); }
      .dt-lb-sub { font-size: 12px; color: var(--dt-muted); }
      .dt-lb-confetti { position: absolute; left: 50%; bottom: 124px; width: 0; height: 0; pointer-events: none; z-index: 3; }
      .dt-lb-confetti i { position: absolute; width: 7px; height: 11px; border-radius: 2px; opacity: 0; animation: dt-lb-confetti 1.5s cubic-bezier(.15,.7,.4,1) both; }
      @keyframes dt-lb-groei { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes dt-lb-in { from { opacity: 0; transform: translateY(24px) scale(.85); } to { opacity: 1; transform: none; } }
      @keyframes dt-lb-glans { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(300%) skewX(-20deg); } }
      @keyframes dt-lb-kroon { from { opacity: 0; transform: translateY(-26px) rotate(-25deg) scale(.6); } to { opacity: 1; transform: none; } }
      @keyframes dt-lb-confetti { 0% { opacity: 1; transform: translate(0, 0) rotate(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 140px)) rotate(var(--r)); } }
      @media (prefers-reduced-motion: reduce) { .dt-lb-podium *, .dt-lb-podium *::after { animation: none !important; } }
      .dt-lb-trend { display: inline-flex; align-items: center; justify-content: center; gap: 3px; min-width: 34px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; justify-self: start; }
      .dt-lb-trend:empty { background: none; }
      .dt-lb-trend.is-op { background: rgba(52,199,89,.16); color: #248A3D; }
      .dt-lb-trend.is-af { background: rgba(255,59,48,.14); color: #D70015; }
      .dt-lb-trend.is-gelijk { background: rgba(120,120,128,.14); color: var(--dt-muted); }
      .dt-lb-trend.is-nieuw { background: color-mix(in srgb, var(--dt-accent) 12%, transparent); color: var(--dt-accent); font-weight: 600; }
      html.dt-dark .dt-lb-trend.is-op { color: #30D158; } html.dt-dark .dt-lb-trend.is-af { color: #FF6961; }
      .dt-lb-top .dt-lb-trend { margin-top: 2px; }
      .dt-lb-tabel { padding: 6px 0 8px; overflow: hidden; }
      .dt-lb-lijst { list-style: none; margin: 0; padding: 0; }
      .dt-lb-rij { display: grid; grid-template-columns: 36px 64px 36px minmax(0, 1fr) minmax(140px, 260px) 90px 70px; align-items: center; gap: 12px; padding: 0 18px; min-height: 44px; font-size: 14px; }
      .dt-lb-lijst .dt-lb-rij { cursor: pointer; border-top: 1px solid color-mix(in srgb, var(--dt-fg) 7%, transparent); }
      .dt-lb-lijst .dt-lb-rij:hover { background: color-mix(in srgb, var(--dt-accent) 5%, transparent); }
      .dt-lb-th { min-height: 34px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dt-muted); }
      .dt-lb-plek { font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; color: var(--dt-muted); }
      .dt-lb-rij.is-top .dt-lb-plek { color: var(--dt-accent); }
      .dt-lb-avatar { width: 32px; height: 32px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--lb-tint); color: var(--dt-accent); font-size: 12px; font-weight: 600; text-transform: uppercase; flex: none; }
      .dt-lb-naam { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-lb-balk { display: flex; align-items: center; gap: 10px; }
      .dt-lb-balk > span { flex: 1; height: 6px; border-radius: 3px; background: rgba(120,120,128,.16); overflow: hidden; }
      .dt-lb-balk i { display: block; height: 100%; border-radius: 3px; background: var(--dt-accent); }
      .dt-lb-balk b { flex: 0 0 3.2em; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
      .dt-lb-num { color: var(--dt-muted); font-variant-numeric: tabular-nums; }
      .dt-lb-geen { color: var(--dt-muted); font-style: italic; }
      .dt-lb-rij.is-leeg .dt-lb-naam { color: var(--dt-muted); }
      .dt-lb-bordknop, .dt-lb-fotoknop { display: inline-flex; gap: 6px; }
      .dt-lb-fotoknop { margin-left: 6px; }
      .dt-lb-fotoknop[aria-pressed="true"] { background: var(--dt-accent); color: #fff; }
      .dt-lb-bordknop.is-bezig { opacity: .6; cursor: progress; }
      .dt-lb-avatar { position: relative; overflow: hidden; }
      .dt-lb-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .dt-lb-bordknop:disabled { opacity: .4; cursor: default; }
      .dt-lb-bord { position: fixed; inset: 0; z-index: 2147482000; overflow: hidden; color: #fff; font-family: var(--dt-font); cursor: none;
        background: radial-gradient(120% 90% at 50% 0%, #2A3F8F 0%, #141B3D 55%, #0A0E22 100%); }
      .dt-lb-bord.is-actief { cursor: default; }
      .dt-lb-bord-gloed { position: absolute; left: 50%; top: 58%; width: 140vmax; height: 140vmax; margin: -70vmax 0 0 -70vmax; pointer-events: none; opacity: .5;
        background: repeating-conic-gradient(from 0deg, rgba(255,255,255,.07) 0deg 8deg, transparent 8deg 24deg); animation: dt-lb-draai 60s linear infinite, dt-lb-vervaag 2s ease 3.6s both;
        -webkit-mask: radial-gradient(closest-side, #000 20%, transparent 75%); mask: radial-gradient(closest-side, #000 20%, transparent 75%); }
      .dt-lb-bord-inhoud { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; padding: 5vh 4vw 0; box-sizing: border-box; }
      .dt-lb-bord-kop { text-align: center; animation: dt-lb-in .8s cubic-bezier(.2,.9,.3,1.2) .1s both; }
      .dt-lb-bord-label { display: inline-block; padding: .4em 1.1em; border-radius: 999px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); font-size: clamp(13px, 1.25vw, 22px); font-weight: 600; letter-spacing: .04em; color: rgba(255,255,255,.82); }
      .dt-lb-bord h1 { margin: .3em 0 0; padding-bottom: .08em; font-size: clamp(36px, 5.2vw, 96px); line-height: 1.12; font-weight: 800; letter-spacing: -.035em;
        background: linear-gradient(180deg, #FFFFFF 35%, #FFE7A3); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 28px rgba(255,201,60,.22)); }
      .dt-lb-bord-podium { flex: 1; width: min(1400px, 92vw); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.5vw; align-items: end; }
      .dt-lb-bord .dt-lb-plaats { display: flex; flex-direction: column; align-items: center; gap: 2vh; min-width: 0; }
      .dt-lb-bord .dt-lb-top { display: flex; flex-direction: column; align-items: center; gap: 1.4vh; text-align: center; position: relative; max-width: 100%; padding: 0; animation: dt-lb-in .8s cubic-bezier(.2,.9,.3,1.3) both; }
      .dt-lb-bord .dt-lb-p3 .dt-lb-top { animation-delay: 1.4s; } .dt-lb-bord .dt-lb-p2 .dt-lb-top { animation-delay: 2.6s; } .dt-lb-bord .dt-lb-p1 .dt-lb-top { animation-delay: 4s; }
      .dt-lb-bord .dt-lb-top { animation-name: dt-lb-vervagin; }
      @keyframes dt-lb-vervagin { from { opacity: 0; } to { opacity: 1; } }
      .dt-lb-bord .dt-lb-blok::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1.4vh; background: rgba(255,255,255,.3); }
      .dt-lb-bord .dt-lb-blok { width: 100%; border-radius: 1.6vw 1.6vw 0 0; display: flex; justify-content: center; padding-top: 2vh; box-sizing: border-box; font-size: clamp(48px, 7vw, 130px); font-weight: 800; color: #fff;
        text-shadow: 0 2px 6px rgba(0,0,0,.25); transform-origin: bottom; position: relative; overflow: hidden; animation: dt-lb-groei 1s cubic-bezier(.2,.9,.3,1.1) both; box-shadow: inset 0 2px 0 rgba(255,255,255,.35); }
      .dt-lb-bord .dt-lb-p1 .dt-lb-blok { height: 34vh; background: linear-gradient(180deg, #FFD54A, #E0A800); animation-delay: 3.2s; }
      .dt-lb-bord .dt-lb-p2 .dt-lb-blok { height: 25vh; background: linear-gradient(180deg, #D5DAE1, #9AA1AB); animation-delay: 1.8s; }
      .dt-lb-bord .dt-lb-p3 .dt-lb-blok { height: 18vh; background: linear-gradient(180deg, #E3A872, #B87333); animation-delay: .6s; }
      .dt-lb-bord .dt-lb-p1 .dt-lb-blok::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent); transform: translateX(-120%) skewX(-20deg); animation: dt-lb-glans 1.4s ease-in-out 4.6s both; }
      .dt-lb-bord .dt-lb-kroon { position: static; margin: 0 0 -.4vh; width: clamp(48px, 5vw, 96px); animation: dt-lb-kroonbord .9s cubic-bezier(.3,1.5,.5,1) 4.9s both; }
      .dt-lb-bord .dt-lb-kroon svg { width: 100%; height: auto; display: block; filter: drop-shadow(0 6px 16px rgba(255,201,60,.45)); }
      .dt-lb-mensen { --schaal: 1; display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 1.6vh 1.6vw; max-width: 100%; }
      .dt-lb-mensen.is-1 { --av: calc(clamp(84px, 10vw, 190px) * var(--schaal)); }
      .dt-lb-mensen.is-3 { --av: calc(clamp(64px, 7vw, 132px) * var(--schaal)); }
      .dt-lb-mensen.is-6 { --av: calc(clamp(52px, 5.2vw, 100px) * var(--schaal)); }
      .dt-lb-mensen.is-9 { --av: calc(clamp(44px, 4.2vw, 82px) * var(--schaal)); }
      .dt-lb-bord .dt-lb-p1 .dt-lb-mensen:not(.is-1) { --schaal: 1.18; }
      .dt-lb-bord .dt-lb-p2 .dt-lb-mensen, .dt-lb-bord .dt-lb-p3 .dt-lb-mensen { --schaal: .82; }
      .dt-lb-persoon { display: flex; flex-direction: column; align-items: center; gap: 1vh; min-width: 0; animation: dt-lb-pop .7s cubic-bezier(.2,.9,.3,1.35) both; }
      .dt-lb-bord .dt-lb-avatar { --ring: #D5DAE1; width: var(--av); height: var(--av); border-radius: 50%; display: grid; place-items: center; font-size: calc(var(--av) * .34); font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
        color: #fff; background: linear-gradient(160deg, #4C5DB8, #283270); box-shadow: 0 0 0 calc(var(--av) * .045) var(--ring), 0 0 0 calc(var(--av) * .045 + 5px) rgba(10,14,34,.55), 0 14px 34px rgba(0,0,0,.4); margin: 0; }
      .dt-lb-bord .dt-lb-p1 .dt-lb-avatar { --ring: #FFC93C; box-shadow: 0 0 0 calc(var(--av) * .05) var(--ring), 0 0 calc(var(--av) * .35) rgba(255,201,60,.35), 0 14px 34px rgba(0,0,0,.4); }
      .dt-lb-bord .dt-lb-p3 .dt-lb-avatar { --ring: #E3A872; }
      .dt-lb-bord .dt-lb-avatar.dt-lb-meer { background: rgba(255,255,255,.1); font-size: calc(var(--av) * .3) !important; }
      .dt-lb-voornaam { font-size: clamp(15px, calc(var(--av) * .21), 34px); font-weight: 700; letter-spacing: -.01em; line-height: 1.1; max-width: calc(var(--av) * 1.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-lb-mensen.is-1 .dt-lb-voornaam { font-size: clamp(22px, 2.6vw, 48px); max-width: none; }
      .dt-lb-bord .dt-lb-groot { font-size: clamp(28px, 3.6vw, 68px); font-weight: 800; color: rgba(255,255,255,.92); font-variant-numeric: tabular-nums; }
      .dt-lb-bord .dt-lb-p1 .dt-lb-groot { color: #FFD54A; font-size: clamp(34px, 4.6vw, 86px); }
      .dt-lb-stijger { font-size: clamp(13px, 1.2vw, 22px); font-weight: 700; color: #30D158; background: rgba(48,209,88,.16); padding: .25em .8em; border-radius: 999px; }
      .dt-lb-bord-knoppen { position: absolute; right: 2vw; top: 2vh; display: flex; gap: 8px; opacity: 0; transition: opacity .3s; }
      .dt-lb-bord.is-actief .dt-lb-bord-knoppen, .dt-lb-bord-knoppen:focus-within { opacity: 1; }
      .dt-lb-bord-knoppen button { appearance: none; border: 0; border-radius: 999px; padding: 10px 18px; font: 600 14px/1 var(--dt-font); color: #fff; background: rgba(255,255,255,.16); cursor: pointer; }
      .dt-lb-bord-knoppen button:hover { background: rgba(255,255,255,.26); }
      .dt-lb-regen { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .dt-lb-regen i { position: absolute; top: -20px; width: 9px; height: 16px; border-radius: 2px; animation-name: dt-lb-val; animation-timing-function: cubic-bezier(.3,.2,.6,1); animation-fill-mode: both; }
      @keyframes dt-lb-val { from { transform: translate(0, 0) rotate(0); opacity: 1; } 85% { opacity: 1; } to { transform: translate(var(--dx), 105vh) rotate(var(--r)); opacity: 0; } }
      @keyframes dt-lb-draai { to { transform: rotate(360deg); } }
      @keyframes dt-lb-vervaag { from { opacity: .5; } 40% { opacity: .9; } to { opacity: .55; } }
      @keyframes dt-lb-kroonbord { from { opacity: 0; transform: translateY(-10vh) rotate(-22deg) scale(.5); } to { opacity: 1; transform: none; } }
      @keyframes dt-lb-pop { from { opacity: 0; transform: translateY(3vh) scale(.6); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .dt-lb-bord *, .dt-lb-bord *::after { animation: none !important; } }
      @media (max-width: 900px) {
        .dt-lb-rij { grid-template-columns: 28px 52px 32px minmax(0, 1fr) 110px; }
        .dt-lb-rij > :nth-child(n+6) { display: none; }
        .dt-lb-podium { gap: 8px; }
      }
    `;
    document.head.append(st);
  },
});
