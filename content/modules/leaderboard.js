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
 * Alles via je eigen Magister-sessie; er gaat niets naar buiten. */
DT.register({
  id: "leaderboard",
  _stop: null,
  _view: null,
  _cache: new Map(),   // "klas|maandag" -> { lln, rijen, klaar }
  _gen: 0,

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
    if (!wrap || wrap.querySelector("#dt-lb-tegel")) return;
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
        DT.el("div", { class: "dt-lb-bediening" }, [this._klassen, DT.el("div", { class: "dt-lb-weeknav" }, [this._nu, this._vorige, this._week, this._volgende])]),
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
    } else { this._podiumVan = null; this._podium.replaceChildren(); }

    const rij = (r, leeg) => {
      const li = DT.el("li", { class: `dt-lb-rij${leeg ? " is-leeg" : ""}${!leeg && r.plek <= 3 ? " is-top" : ""}`, tabindex: "0", title: "Leerlingkaart openen" }, [
        DT.el("span", { class: "dt-lb-plek", text: leeg ? "–" : String(r.plek) }),
        leeg ? DT.el("span") : trend(r),
        DT.el("span", { class: "dt-lb-avatar", text: r.l.init }),
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
        DT.el("span", { class: "dt-lb-avatars" }, [...g.slice(0, 4).map((x) => DT.el("span", { class: "dt-lb-avatar", text: x.l.init })), ...(g.length > 4 ? [DT.el("span", { class: "dt-lb-avatar dt-lb-meer", text: `+${g.length - 4}` })] : [])]),
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
      @media (max-width: 900px) {
        .dt-lb-rij { grid-template-columns: 28px 52px 32px minmax(0, 1fr) 110px; }
        .dt-lb-rij > :nth-child(n+6) { display: none; }
        .dt-lb-podium { gap: 8px; }
      }
    `;
    document.head.append(st);
  },
});
