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
    this._podium = DT.el("div", { class: "dt-lb-podium" });
    this._lijst = DT.el("ol", { class: "dt-lb-lijst" });
    v.append(
      DT.el("div", { class: "dt-lb-kop dt-lb-card" }, [
        DT.el("nav", { class: "dt-lb-crumbs", "aria-label": "Kruimelpad" }, [terug, DT.el("span", { "aria-hidden": "true", text: "›" }), DT.el("span", { text: "Leaderboard" })]),
        DT.el("h1", { html: `Leaderboard<span class="dt-lb-punt">.</span>` }),
        DT.el("div", { class: "dt-lb-bediening" }, [this._klassen, DT.el("div", { class: "dt-lb-weeknav" }, [this._nu, this._vorige, this._week, this._volgende])]),
      ]),
      this._status, this._podium,
      DT.el("div", { class: "dt-lb-card dt-lb-tabel" }, [
        DT.el("div", { class: "dt-lb-rij dt-lb-th", "aria-hidden": "true" }, ["#", "", "Leerling", "Aanwezig", "Lessen", "Te laat"].map((t) => DT.el("span", { text: t }))),
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
      const b = DT.el("button", { type: "button", role: "tab", class: "dt-lb-klas", "data-klas": k.naam, title: `${k.aantal} leerlingen`, text: k.naam });
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
    const van = ma, zo = this.plus(ma, 6), now = new Date();
    const tot = new Date(Math.min(+new Date(zo.getFullYear(), zo.getMonth(), zo.getDate(), 23, 59, 59), +now));
    const werk = c.lln.slice();
    const doe = async () => {
      while (werk.length) {
        const l = werk.shift();
        const v = await api(`/api/m6/leerlingen/${l.id}/verantwoordingen?begin=${this.ymd(van)}&einde=${this.ymd(zo)}`);
        await wacht(120);
        const a = await api(`/api/leerlingen/${l.id}/afspraken?status=actief&begin=${this.ymd(van)}&einde=${this.ymd(zo)}`);
        await wacht(120);
        const regs = lijst(v), rooster = lijst(a);
        let T = null;
        if (regs && rooster) {
          rooster.push(...await vzLosseLessen(l.id, regs, rooster, api, 20));
          T = vzStats(regs, rooster, van, tot).totaal;
        }
        c.rijen.push({ l, T, fout: !T });
      }
    };
    await Promise.all([doe(), doe()]);
    c.klaar = true;
  },

  /* Volgorde en plaatsen; gelijke cijfers delen een plaats (1, 1, 2). */
  rangschik(rijen) {
    const met = [], zonder = [];
    for (const r of rijen) {
      if (r.T && r.T.telt > 0) met.push({ ...r, aanw: r.T.telt - r.T.afwezig, pct: (r.T.telt - r.T.afwezig) / r.T.telt });
      else zonder.push(r);
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

    /* Podium: 2 – 1 – 3, pas als alles binnen is (anders verspringt het). Een gedeelde plaats toont
     * iedereen die er staat. */
    if (c.klaar && met.length) {
      const groep = (n) => met.filter((r) => r.plek === n);
      const volgorde = [groep(2), groep(1), groep(3)].filter((g) => g.length);
      const namen = (g) => g.length <= 3 ? g.map((r) => r.l.naam.split(" ")[0]).join(", ").replace(/, ([^,]*)$/, " en $1") : `${g.slice(0, 2).map((r) => r.l.naam.split(" ")[0]).join(", ")} en ${g.length - 2} anderen`;
      this._podium.replaceChildren(...volgorde.map((g) => {
        const r = g[0], een = g.length === 1;
        const kaart = DT.el(een ? "button" : "div", { class: `dt-lb-card dt-lb-plaats dt-lb-p${r.plek}`, ...(een ? { type: "button", title: "Leerlingkaart openen" } : { title: g.map((x) => x.l.naam).join("\n") }) }, [
          DT.el("span", { class: "dt-lb-medaille", text: String(r.plek) }),
          DT.el("span", { class: "dt-lb-avatars" }, [...g.slice(0, 4).map((x) => DT.el("span", { class: "dt-lb-avatar", text: x.l.init })), ...(g.length > 4 ? [DT.el("span", { class: "dt-lb-avatar dt-lb-meer", text: `+${g.length - 4}` })] : [])]),
          DT.el("span", { class: "dt-lb-naam", text: een ? r.l.naam : namen(g) }),
          DT.el("span", { class: "dt-lb-groot", text: pct(r) }),
          DT.el("span", { class: "dt-lb-sub", text: `${lessen(r)} lessen${r.T.teLaat ? ` · ${r.T.teLaat}× te laat` : ""}${een ? "" : ` · ${g.length} leerlingen`}` }),
        ]);
        if (een) kaart.addEventListener("click", open(r));
        return kaart;
      }));
    } else this._podium.replaceChildren();

    const rij = (r, leeg) => {
      const li = DT.el("li", { class: `dt-lb-rij${leeg ? " is-leeg" : ""}${!leeg && r.plek <= 3 ? " is-top" : ""}`, tabindex: "0", title: "Leerlingkaart openen" }, [
        DT.el("span", { class: "dt-lb-plek", text: leeg ? "–" : String(r.plek) }),
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
      .dt-lb-podium { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: end; }
      .dt-lb-podium:empty { display: none; }
      .dt-lb-plaats { appearance: none; font: inherit; color: inherit; cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px 16px 18px; position: relative; }
      .dt-lb-plaats.dt-lb-p1 { padding-top: 32px; padding-bottom: 26px; }
      div.dt-lb-plaats { cursor: default; }
      .dt-lb-avatars { display: flex; justify-content: center; }
      .dt-lb-avatars .dt-lb-avatar + .dt-lb-avatar { margin-left: -12px; }
      .dt-lb-plaats .dt-lb-avatar { width: 52px; height: 52px; font-size: 18px; box-shadow: 0 0 0 3px var(--dt-bg); background: color-mix(in srgb, var(--dt-accent) 14%, var(--dt-bg)); }
      .dt-lb-plaats.dt-lb-p1 .dt-lb-avatar { width: 64px; height: 64px; font-size: 22px; }
      .dt-lb-avatar.dt-lb-meer { font-size: 15px !important; }
      .dt-lb-medaille { position: absolute; top: 12px; left: 12px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #fff; background: #A2845E; }
      .dt-lb-p1 .dt-lb-medaille { background: linear-gradient(180deg, #F7C948, #E0A800); }
      .dt-lb-p2 .dt-lb-medaille { background: linear-gradient(180deg, #C7CCD3, #9AA1AB); }
      .dt-lb-p3 .dt-lb-medaille { background: linear-gradient(180deg, #D9A066, #B87333); }
      .dt-lb-plaats .dt-lb-naam { font-size: 15px; font-weight: 600; max-width: 100%; white-space: normal; }
      .dt-lb-groot { font-size: 30px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .dt-lb-p1 .dt-lb-groot { font-size: 36px; color: var(--dt-accent); }
      .dt-lb-sub { font-size: 12px; color: var(--dt-muted); }
      .dt-lb-tabel { padding: 6px 0 8px; overflow: hidden; }
      .dt-lb-lijst { list-style: none; margin: 0; padding: 0; }
      .dt-lb-rij { display: grid; grid-template-columns: 44px 36px minmax(0, 1fr) minmax(140px, 260px) 90px 70px; align-items: center; gap: 12px; padding: 0 18px; min-height: 44px; font-size: 14px; }
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
        .dt-lb-rij { grid-template-columns: 32px 32px minmax(0, 1fr) 120px; }
        .dt-lb-rij > :nth-child(n+5) { display: none; }
        .dt-lb-podium { gap: 8px; }
      }
    `;
    document.head.append(st);
  },
});
