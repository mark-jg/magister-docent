/* Verzuiminzicht: extra tabblad "Inzicht" op de verzuimpagina van een leerling
 * (op-shell, #/att-verzuim/{id}/…). Combineert de registraties van Magister
 * (/api/m6/leerlingen/{id}/verantwoordingen?begin&einde: per geregistreerde les de afspraak en de
 * registraties) met het rooster van de leerling (/api/leerlingen/{id}/afspraken?status=actief&begin&einde:
 * vak, docent, tijd) en laat zien waar het verzuim zit: per vak, docent, weekdag, lesuur en per week.
 * Alles via je eigen sessie; er gaat niets naar buiten. */
DT.register({
  id: "verzuiminzicht",
  _stop: null,
  _root: null,     // shadow root van att-dk-attendance
  _btn: null,
  _btn2: null,     // tabblad Vergelijken
  _view: "inzicht", // "inzicht" of "vergelijk"
  _panel: null,
  _data: null,     // { id, at, regs, rooster }
  _busy: null,
  _periode: "jaar",
  _active: false,

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 500, poll: 2500 });
  },

  destroy() {
    this._stop && this._stop();
    this.deactivate();
    this._btn?.remove(); this._btn2?.remove(); this._panel?.remove();
    this._btn = this._btn2 = this._panel = this._root = null;
  },

  leerlingId() {
    const m = location.hash.match(/#\/att-verzuim\/(\d+)\//);
    return m ? m[1] : null;
  },

  mount(DT) {
    const id = this.leerlingId();
    const host = id && DT.deepQuery("att-dk-attendance");
    const root = host && host.shadowRoot;
    const tabs = root && root.querySelector("dna-tabs");
    const bar = tabs && tabs.querySelector("dna-tab-bar");
    if (!bar) { if (this._btn) { this.deactivate(); this._btn.remove(); this._btn2?.remove(); this._panel?.remove(); this._btn = this._btn2 = this._panel = null; } return; }
    if (this._root !== root || !this._btn || !this._btn.isConnected) {
      this.deactivate();
      this._root = root;
      this.css(root);
      const knop = (tekst, view) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "dt-vz-tabbtn"; b.textContent = tekst; b.dataset.view = view;
        b.setAttribute("role", "tab");
        b.addEventListener("click", (e) => { e.stopPropagation(); this.activate(DT, view); });
        return b;
      };
      this._btn2?.remove();
      this._btn = knop("Inzicht", "inzicht");
      this._btn2 = knop("Vergelijken", "vergelijk");
      bar.append(this._btn, this._btn2);
      bar.addEventListener("click", (e) => { if (e.target.closest("dna-tab-button")) this.deactivate(); });
      this._panel?.remove();
      this._panel = document.createElement("div"); this._panel.id = "dt-vz"; this._panel.hidden = true;
      tabs.after(this._panel);
      /* Zelfde tabblad onthouden per sessie */
      const bewaard = sessionStorage.getItem("dt-vz-active");
      if (bewaard) this.activate(DT, bewaard === "vergelijk" ? "vergelijk" : "inzicht");
    }
    if (this._data && this._data.id !== id) { this._data = null; if (this._active) this.activate(DT, this._view); }
  },

  activate(DT, view = "inzicht") {
    if (!this._root) return;
    this._active = true; this._view = view; sessionStorage.setItem("dt-vz-active", view);
    this._btn.classList.toggle("is-active", view === "inzicht");
    this._btn2?.classList.toggle("is-active", view === "vergelijk");
    const tabs = this._root.querySelector("dna-tabs");
    tabs?.querySelector("dna-tab-bar")?.classList.add("dt-vz-on");
    for (const t of tabs?.querySelectorAll(":scope > dna-tab, :scope > [slot='tab']") || []) { t.dataset.dtVzHidden = "1"; t.style.display = "none"; }
    this._panel.hidden = false;
    this.load(DT);
  },

  deactivate() {
    if (!this._active) return;
    this._active = false; sessionStorage.removeItem("dt-vz-active");
    this._btn?.classList.remove("is-active"); this._btn2?.classList.remove("is-active");
    const tabs = this._root?.querySelector("dna-tabs");
    tabs?.querySelector("dna-tab-bar")?.classList.remove("dt-vz-on");
    for (const t of tabs?.querySelectorAll("[data-dt-vz-hidden]") || []) { t.style.display = ""; delete t.dataset.dtVzHidden; }
    if (this._panel) this._panel.hidden = true;
  },

  async load(DT) {
    const id = this.leerlingId(); if (!id || !this._panel) return;
    if (this._data && this._data.id === id && Date.now() - this._data.at < 10 * 60e3) { this.render(); return; }
    if (this._busy === id) return;
    this._busy = id;
    this._panel.innerHTML = `<div class="dt-vz-loading">Registraties en rooster ophalen…</div>`;
    try {
      const today = new Date(), ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const sj = new Date(today.getFullYear() - (today.getMonth() < 7 ? 1 : 0), 7, 1);
      /* Eigen periodes die eerder beginnen (tot een jaar terug) ook kunnen tonen */
      const vroegst = (DT.periodes?.() || []).map((p) => p.begin).filter((b) => b < sj && b > new Date(sj.getTime() - 366 * 864e5)).sort((a, b) => a - b)[0];
      const vanaf = vroegst || sj;
      const list = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
      const [v, a] = await Promise.all([
        DT.api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${ymd(vanaf)}&einde=${ymd(today)}`, { full: true, timeout: 20000 }),
        DT.api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${ymd(vanaf)}&einde=${ymd(today)}`, { full: true, timeout: 20000 }),
      ]);
      const regs = list(v), rooster = list(a);
      this._data = { id, at: Date.now(), regs, rooster, err: { regs: v.status, rooster: a.status }, sj: sj.getTime(), jaren: "laden" };
      this.render();
      this.loadJaren(DT, id, sj);
    } finally { if (this._busy === id) this._busy = null; }
  },

  /* Twee vorige schooljaren (1 augustus t/m 31 juli) ophalen voor de vergelijking. Komt na het
   * eerste beeld binnen, zodat het tabblad niet langer op zich laat wachten. */
  async loadJaren(DT, id, sj) {
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const jaren = [];
    for (const k of [1, 2]) {
      const van = new Date(sj.getFullYear() - k, 7, 1), tot = new Date(sj.getFullYear() - k + 1, 6, 31);
      const [v, a] = await Promise.all([
        DT.api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${ymd(van)}&einde=${ymd(tot)}`, { full: true, timeout: 25000 }),
        DT.api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${ymd(van)}&einde=${ymd(tot)}`, { full: true, timeout: 25000 }),
      ]);
      jaren.push({ k, van: van.getTime(), tot: tot.getTime() + 864e5 - 1, regs: list(v), rooster: list(a), status: { regs: v.status, rooster: a.status } });
    }
    if (this._data && this._data.id === id) { this._data.jaren = jaren; if (this._active) this.render(); }
  },

  render() {
    const d = this._data, p = this._panel; if (!d || !p) return;
    const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    if (!d.regs && !d.rooster) { p.innerHTML = `<div class="dt-vz-loading">Geen gegevens: registraties ${esc(d.err.regs)}, rooster ${esc(d.err.rooster)}.</div>`; return; }
    const now = new Date();
    const periodes = DT.periodes?.() || [];
    let eigen = this._periode.startsWith("p:") ? periodes.find((p) => "p:" + p.id === this._periode) : null;
    if (this._periode.startsWith("p:") && !eigen) this._periode = "jaar";
    const van = eigen ? eigen.begin : this._periode === "jaar" ? new Date(d.sj) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (this._periode === "8w" ? 56 : 28));
    const tot = eigen && eigen.einde < now ? eigen.einde : now;
    const S = vzStats(d.regs || [], d.rooster || [], van, tot);
    const pctCol = (pct) => pct >= 90 ? "#34C759" : pct >= 80 ? "#FF9500" : "#FF3B30";
    const SOORT = [["OK", "aanwezig", "#34C759"], ["TL", "te laat", "#FFCC00"], ["ZK", "ziek", "#AF52DE"], ["AB_OK", "absent, geoorloofd", "#FF9500"], ["AB_NO", "absent, ongeoorloofd", "#FF3B30"], ["UI", "uitgestuurd", "#A2845E"]];
    /* Vrijgestelde lessen (met toestemming) staan niet in de balk: die gaat over de lessen die meetellen. */
    const used = SOORT.filter(([k]) => S.totaal.per[k]);
    const bar = (g) => `<span class="dt-vz-bar">${g.telt > 0 ? used.map(([k, n, c]) => g.per[k] ? `<span style="width:${(100 * g.per[k] / g.telt).toFixed(2)}%;background:${c}" title="${esc(`${g.per[k]}× ${n}`)}"></span>` : "").join("") : ""}</span>`;
    const ziek = (g) => g.ziek ? `<span class="dt-vz-ziek" title="${esc(`${g.ziek} van ${g.telt} lessen ziek gemeld`)}">${g.ziek}× ziek</span>` : `<span class="dt-vz-ziek is-nul"></span>`;
    const rows = (groups, { max = 12, empty = "Geen lessen in deze periode." } = {}) => groups.length ? `<div class="dt-vz-rows">${groups.slice(0, max).map((g) => `
      <div class="dt-vz-row${g.afwezig >= 3 && g.telt >= 4 && g.pct < S.totaal.pct - 8 ? " is-warn" : ""}" title="${esc(`${g.label}: ${g.telt} lessen, ${g.afwezig} afwezig${g.ziek ? ` (waarvan ${g.ziek}× ziek)` : ""}, ${g.teLaat}× te laat${g.vrij ? `\n${g.vrij}× vrijgesteld, telt niet mee` : ""}`)}">
        <span class="dt-vz-label"><b>${esc(g.label)}</b>${g.sub ? `<small>${esc(g.sub)}</small>` : ""}</span>
        ${bar(g)}
        ${ziek(g)}
        <span class="dt-vz-pct" style="color:${g.telt > 0 ? pctCol(g.pct) : "var(--dt-vz-muted)"}">${g.telt > 0 ? `${g.pct}%` : "–"}</span>
        <span class="dt-vz-n">${g.telt}${g.vrij ? `<small title="${esc(`${g.vrij}× vrijgesteld, telt niet mee`)}">+${g.vrij}</small>` : ""}</span>
      </div>`).join("")}${groups.length > max ? `<div class="dt-vz-more">en nog ${groups.length - max} meer</div>` : ""}</div>` : `<p class="dt-vz-empty">${empty}</p>`;
    const legend = `<div class="dt-vz-legend">${used.map(([, n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join("")}${S.totaal.vrij ? `<span class="dt-vz-legend-vr">${S.totaal.vrij}× vrijgesteld: telt niet mee (+n achter het aantal)</span>` : ""}<span class="dt-vz-legend-n">rechts: aantal lessen</span></div>`;

    /* Verloop per week als lijn */
    const weeks = S.weken;
    let lijn = "";
    if (weeks.length >= 2) {
      const W = Math.max(320, (p.clientWidth || 800) - 64), H = 160, L = 34, R = 12, T = 12, B = 26, w = W - L - R, h = H - T - B;
      const lo = Math.min(50, ...weeks.map((wk) => Math.floor(wk.pct / 10) * 10));
      const x = (i) => L + (w * i / (weeks.length - 1)), y = (pct) => T + h * (1 - (Math.max(lo, pct) - lo) / (100 - lo));
      const pts = weeks.map((wk, i) => `${x(i).toFixed(1)},${y(wk.pct).toFixed(1)}`);
      const area = `M${x(0).toFixed(1)},${(T + h).toFixed(1)} L${pts.join(" L")} L${x(weeks.length - 1).toFixed(1)},${(T + h).toFixed(1)} Z`;
      const ticks = []; for (let v = 100; v >= lo; v -= 10) ticks.push(v);
      const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="dt-vz-grid${v === 100 ? "" : ""}"/><text x="${L - 6}" y="${(y(v) + 3.5).toFixed(1)}" class="dt-vz-ytick" text-anchor="end">${v}</text>`).join("");
      const step = Math.ceil(weeks.length / 10);
      const xt = weeks.map((wk, i) => i % step === 0 || i === weeks.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="dt-vz-xtick" text-anchor="middle">wk ${wk.week}</text>` : "").join("");
      const dots = weeks.map((wk, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(wk.pct).toFixed(1)}" r="3.5" fill="${pctCol(wk.pct)}" stroke="var(--dt-vz-surface)" stroke-width="2"><title>${esc(`week ${wk.week}: ${wk.pct}% aanwezig (${wk.lessen} lessen, ${wk.afwezig} afwezig${wk.teLaat ? `, ${wk.teLaat}× te laat` : ""})`)}</title></circle>`).join("");
      lijn = `<svg class="dt-vz-line" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Aanwezigheid per week">
        ${grid}<path d="${area}" class="dt-vz-area"/><polyline points="${pts.join(" ")}" class="dt-vz-poly"/>${dots}${xt}</svg>`;
    }

    /* Constateringen */
    const obs = [];
    const T = S.totaal;
    if (T.lessen) {
      const worstVak = S.vakken.find((g) => g.telt >= 4 && g.afwezig >= 2);
      if (worstVak && worstVak.pct < T.pct - 5) obs.push(`Het verzuim zit vooral bij <b>${esc(worstVak.label)}</b>: ${worstVak.afwezig} van ${worstVak.telt} lessen gemist (${worstVak.pct}% aanwezig, tegenover ${T.pct}% totaal).`);
      const worstDoc = S.docenten.find((g) => g.telt >= 4 && g.afwezig >= 2);
      if (worstDoc && worstDoc.pct < T.pct - 5 && (!worstVak || worstDoc.label !== worstVak.sub)) obs.push(`Bij <b>${esc(worstDoc.label)}</b> is de aanwezigheid het laagst: ${worstDoc.pct}% over ${worstDoc.telt} lessen.`);
      const worstDag = S.dagen.filter((g) => g.telt >= 4).sort((a, b) => a.pct - b.pct)[0];
      if (worstDag && worstDag.pct < T.pct - 8) obs.push(`Op <b>${esc(worstDag.label.toLowerCase())}</b> is de aanwezigheid duidelijk lager (${worstDag.pct}%) dan gemiddeld.`);
      const worstUur = S.uren.filter((g) => g.telt >= 4).sort((a, b) => a.pct - b.pct)[0];
      if (worstUur && worstUur.pct < T.pct - 8) obs.push(`Lessen die om <b>${esc(worstUur.label)}</b> beginnen worden het vaakst gemist (${worstUur.pct}% aanwezig).`);
      const lateVak = S.vakken.filter((g) => g.teLaat >= 2).sort((a, b) => b.teLaat / b.telt - a.teLaat / a.telt)[0];
      if (lateVak) obs.push(`Te laat komt vooral voor bij <b>${esc(lateVak.label)}</b> (${lateVak.teLaat}× in ${lateVak.telt} lessen).`);
      const ziekVak = T.ziek >= 3 ? S.vakken.filter((g) => g.ziek >= 2 && g.telt >= 4).sort((a, b) => b.ziek / b.telt - a.ziek / a.telt)[0] : null;
      if (ziekVak && ziekVak.ziek / ziekVak.telt > 1.5 * T.ziek / Math.max(1, T.telt)) obs.push(`Ziekmeldingen vallen opvallend vaak op <b>${esc(ziekVak.label)}</b>: ${ziekVak.ziek} van de ${T.ziek} keer ziek (${ziekVak.ziek} van ${ziekVak.telt} lessen).`);
      if (T.ongeoorloofd >= 3) obs.push(`<b>${T.ongeoorloofd}</b> van de ${T.afwezig} gemiste lessen zijn ongeoorloofd.`);
      if (weeks.length >= 4) {
        const recent = weeks.slice(-3), eerder = weeks.slice(0, -3);
        const avg = (ws) => ws.reduce((x, w) => x + w.pct * w.telt, 0) / Math.max(1, ws.reduce((x, w) => x + w.telt, 0));
        const r = avg(recent), e = avg(eerder);
        if (eerder.length && r < e - 8) obs.push(`De laatste drie weken (${Math.round(r)}%) zijn slechter dan daarvoor (${Math.round(e)}%).`);
        else if (eerder.length && r > e + 8) obs.push(`De laatste drie weken (${Math.round(r)}%) gaan beter dan daarvoor (${Math.round(e)}%).`);
      }
      if (!obs.length) obs.push(T.afwezig ? "Het verzuim is verspreid over vakken, docenten en dagen; er springt niets uit." : "Geen gemiste lessen in deze periode.");
    }

    /* Vergelijking met de twee vorige schooljaren: tot dezelfde datum (eerlijk vergelijken) en het hele jaar */
    let vergelijk = "";
    if (d.jaren === "laden") vergelijk = `<section class="dt-vz-card dt-vz-wide dt-vz-cmpcard"><h4>Per schooljaar</h4><p class="dt-vz-empty">Vorige schooljaren ophalen…</p></section>`;
    else if (Array.isArray(d.jaren)) {
      const eindVandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const datumKort = now.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      const sjNaam = (t) => { const y = new Date(t).getFullYear(); return `${y}–${y + 1}`; };
      const Sj = vzStats(d.regs || [], d.rooster || [], new Date(d.sj), now);
      const rijen = [{ naam: sjNaam(d.sj), sub: "dit schooljaar", zelfde: Sj.totaal, heel: null, S: Sj, rooster: !!(d.rooster && d.rooster.length), kleur: "var(--dt-vz-accent)" }];
      const KLEUR = ["#8E8E93", "#C7C7CC"];
      for (const j of d.jaren) {
        const heeft = (j.regs && j.regs.length) || (j.rooster && j.rooster.length);
        if (!heeft) { rijen.push({ naam: sjNaam(j.van), leeg: true, status: j.status }); continue; }
        const zelfdeTot = new Date(eindVandaag); zelfdeTot.setFullYear(eindVandaag.getFullYear() - j.k);
        const heel = vzStats(j.regs || [], j.rooster || [], new Date(j.van), new Date(j.tot));
        const zelfde = vzStats(j.regs || [], j.rooster || [], new Date(j.van), zelfdeTot);
        rijen.push({ naam: sjNaam(j.van), sub: j.k === 1 ? "vorig schooljaar" : "twee jaar terug", zelfde: zelfde.totaal, heel: heel.totaal, S: heel, rooster: !!(j.rooster && j.rooster.length), kleur: KLEUR[j.k - 1], dash: j.k === 2 });
      }
      const pc = (T, r) => r.rooster && T && T.telt ? `<b style="color:${pctCol(T.pct)}">${T.pct}%</b>` : `<span class="dt-vz-dim" title="Rooster van dat jaar niet beschikbaar; zonder rooster is er geen percentage">–</span>`;
      const vorig = rijen[1] && !rijen[1].leeg && rijen[1].rooster ? rijen[1] : null;
      const delta = vorig && rijen[0].rooster && rijen[0].zelfde.telt ? rijen[0].zelfde.pct - vorig.zelfde.pct : null;
      const chip = delta == null ? "" : `<span class="dt-vz-delta ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : ""}" title="Verschil met vorig schooljaar tot dezelfde datum">${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(delta)}</span>`;
      const tabel = `<table class="dt-vz-cmp"><thead><tr><th>Schooljaar</th><th>t/m ${esc(datumKort)}</th><th>Hele jaar</th><th>Gemist</th><th>Ziek</th><th>Ongeoorl.</th><th>Te laat</th></tr></thead><tbody>${rijen.map((r, i) => r.leeg
        ? `<tr class="is-leeg"><td><span class="dt-vz-cmpdot" style="background:${KLEUR[i - 1] || "#C7C7CC"}"></span><b>${esc(r.naam)}</b></td><td colspan="6" class="dt-vz-dim">${r.status && r.status.regs && r.status.regs !== 200 ? `Niet op te halen (Magister antwoordde ${esc(r.status.regs)})` : "Geen registraties of rooster in dat schooljaar"}</td></tr>`
        : `<tr><td><span class="dt-vz-cmpdot" style="background:${r.kleur}"></span><b>${esc(r.naam)}</b><small>${esc(r.sub)}</small></td><td>${pc(r.zelfde, r)}${i === 0 ? chip : ""}</td><td>${r.heel ? pc(r.heel, r) : `<span class="dt-vz-dim">loopt nog</span>`}</td><td>${r.zelfde.afwezig}</td><td>${r.zelfde.ziek}</td><td>${r.zelfde.ongeoorloofd}</td><td>${r.zelfde.teLaat}</td></tr>`).join("")}</tbody></table>`;
      /* Maandlijnen over elkaar: augustus t/m juli */
      const lijnen = rijen.filter((r) => !r.leeg && r.rooster).map((r) => ({ r, pts: r.S.maanden.filter((m) => m.telt > 0) })).filter((x) => x.pts.length);
      let mgraf = "";
      if (lijnen.length) {
        const W = Math.max(320, (p.clientWidth || 800) - 64), H = 170, L = 34, R = 12, Tt = 12, B = 26, w = W - L - R, h = H - Tt - B;
        const lo = Math.min(50, ...lijnen.flatMap((x) => x.pts.map((m) => Math.floor(m.pct / 10) * 10)));
        const x = (i) => L + w * i / 11, y = (pct) => Tt + h * (1 - (Math.max(lo, pct) - lo) / (100 - lo));
        const ticks = []; for (let v = 100; v >= lo; v -= 10) ticks.push(v);
        const MX = ["aug", "sep", "okt", "nov", "dec", "jan", "feb", "mrt", "apr", "mei", "jun", "jul"];
        mgraf = `<svg class="dt-vz-line" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Aanwezigheid per maand per schooljaar">
          ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 3.5).toFixed(1)}" class="dt-vz-ytick" text-anchor="end">${v}</text>`).join("")}
          ${MX.map((m, i) => `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="dt-vz-xtick" text-anchor="middle">${m}</text>`).join("")}
          ${lijnen.slice().reverse().map(({ r, pts }) => `<polyline points="${pts.map((m) => `${x(m.idx).toFixed(1)},${y(m.pct).toFixed(1)}`).join(" ")}" fill="none" stroke="${r.kleur}" stroke-width="${r.sub === "dit schooljaar" ? 2.5 : 2}" ${r.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>${pts.map((m) => `<circle cx="${x(m.idx).toFixed(1)}" cy="${y(m.pct).toFixed(1)}" r="${r.sub === "dit schooljaar" ? 3.5 : 2.5}" fill="${r.kleur}" stroke="var(--dt-vz-surface)" stroke-width="1.5"><title>${esc(`${m.label} ${m.y}: ${m.pct}% aanwezig (${m.telt} lessen, ${m.afwezig} gemist)`)}</title></circle>`).join("")}`).join("")}
        </svg>`;
      }
      let zin = "";
      if (delta != null && rijen[0].zelfde.telt >= 10) zin = delta <= -5 ? `Dit schooljaar is de aanwezigheid tot nu toe <b>${rijen[0].zelfde.pct}%</b>, vorig schooljaar was dat tot dezelfde datum <b>${vorig.zelfde.pct}%</b>: ${Math.abs(delta)} procentpunt lager.`
        : delta >= 5 ? `Dit schooljaar gaat het beter: <b>${rijen[0].zelfde.pct}%</b> tot nu toe, tegenover <b>${vorig.zelfde.pct}%</b> vorig schooljaar tot dezelfde datum.`
        : `De aanwezigheid is vergelijkbaar met vorig schooljaar tot dezelfde datum (${rijen[0].zelfde.pct}% nu, ${vorig.zelfde.pct}% toen).`;
      vergelijk = `<section class="dt-vz-card dt-vz-wide dt-vz-cmpcard"><h4>Per schooljaar</h4>${zin ? `<p class="dt-vz-cmpzin">${zin}</p>` : ""}${tabel}${mgraf ? `<div class="dt-vz-cmpgraf">${mgraf}<div class="dt-vz-legend">${lijnen.map(({ r }) => `<span><i style="background:${r.kleur}"></i>${esc(r.naam)}</span>`).join("")}<span class="dt-vz-legend-n">aanwezig per maand</span></div></div>` : ""}<p class="dt-vz-cmpnoot">"t/m ${esc(datumKort)}" telt elk schooljaar van 1 augustus tot dezelfde datum, zodat de jaren eerlijk te vergelijken zijn. Gemist, ziek, ongeoorloofd en te laat gaan ook over die periode.</p></section>`;
    }

    if (this._view === "vergelijk") {
      p.innerHTML = `
        <div class="dt-vz-head"><div class="dt-vz-title">Vergelijken met vorige schooljaren</div></div>
        <div class="dt-vz-grid">${vergelijk || `<p class="dt-vz-empty">Geen gegevens om te vergelijken.</p>`}</div>
        <div class="dt-vz-foot">Uit de registraties en het rooster van Magister, per schooljaar van 1 augustus tot en met 31 juli. Afwezig = absent, ziek of uitgestuurd; te laat telt als aanwezig; een vrijstelling telt niet mee. Zonder rooster van een schooljaar is er geen percentage.</div>`;
      return;
    }

    const seg = (k, label) => `<button type="button" class="dt-vz-seg${this._periode === k ? " is-on" : ""}" data-periode="${k}">${label}</button>`;
    p.innerHTML = `
      <div class="dt-vz-head">
        <div class="dt-vz-title">Inzicht in aanwezigheid</div>
        <div class="dt-vz-segs">${seg("jaar", "Schooljaar")}${seg("8w", "8 weken")}${seg("4w", "4 weken")}${periodes.length ? `<select class="dt-vz-psel${eigen ? " is-on" : ""}" aria-label="Eigen periode"><option value="">Periode…</option>${periodes.map((p) => `<option value="p:${esc(p.id)}"${eigen && eigen.id === p.id ? " selected" : ""}>${esc(p.naam)} · ${esc(DT.periodeLabel(p))}</option>`).join("")}</select>` : ""}</div>
      </div>
      ${T.lessen ? `
      <div class="dt-vz-summary">
        <span class="dt-vz-big" style="color:${pctCol(T.pct)}">${T.pct}%</span>
        <span class="dt-vz-sumtext">${eigen ? `<b>${esc(eigen.naam)}</b> (${esc(DT.periodeLabel(eigen, true))}) · ` : ""}<b>aanwezig</b> · ${T.telt - T.afwezig} van ${T.telt} lessen · ${T.afwezig} gemist${T.ongeoorloofd ? ` (${T.ongeoorloofd} ongeoorloofd)` : ""}${T.ziek ? ` · ${T.ziek}× ziek` : ""}${T.teLaat ? ` · ${T.teLaat}× te laat` : ""}${T.vrij ? ` · ${T.vrij}× vrijgesteld (telt niet mee)` : ""}${S.onbekend ? ` · ${S.onbekend} lessen zonder vak in het rooster` : ""}</span>
      </div>
      <div class="dt-vz-obs">${obs.map((o) => `<div class="dt-vz-ob">${o}</div>`).join("")}</div>
      <div class="dt-vz-grid">
        <section class="dt-vz-card dt-vz-wide"><h4>Verloop per week</h4>${lijn || `<p class="dt-vz-empty">Nog te weinig weken voor een verloop.</p>`}</section>
        <section class="dt-vz-card"><h4>Per vak</h4>${rows(S.vakken)}</section>
        ${S.docenten.length ? `<section class="dt-vz-card"><h4>Per docent</h4>${rows(S.docenten)}</section>` : ""}
        <section class="dt-vz-card"><h4>Per weekdag</h4>${rows(S.dagen, { max: 7 })}</section>
        <section class="dt-vz-card"><h4>Per lesuur (begintijd)</h4>${rows(S.uren, { max: 12 })}</section>
      </div>
      ${legend}` : `<p class="dt-vz-empty">Geen lessen in deze periode.</p>`}
      <div class="dt-vz-foot">Uit de registraties en het rooster van Magister. Afwezig = absent, ziek of uitgestuurd; te laat telt als aanwezig. Een vrijstelling is met toestemming: die les telt niet als gemist en valt buiten het percentage. Vak${S.docenten.length ? " en docent" : ""} uit het rooster; ${d.rooster ? `${(d.rooster || []).length} roosteritems` : "rooster niet beschikbaar"}${d.rooster && !S.docenten.length ? "; het rooster van de leerling noemt geen docenten, daarom is er geen blok per docent" : ""}.</div>`;
    p.querySelectorAll(".dt-vz-seg").forEach((b) => b.addEventListener("click", () => { this._periode = b.dataset.periode; this.render(); }));
    p.querySelector(".dt-vz-psel")?.addEventListener("change", (e) => { this._periode = e.target.value || "jaar"; this.render(); });
  },

  css(root) {
    if (root.querySelector("#dt-vz-style")) return;
    const st = document.createElement("style"); st.id = "dt-vz-style";
    st.textContent = `
      :host { --dt-vz-fg: var(--sl-color-foreground-plain, var(--dna-text-color, #1d1d1f)); --dt-vz-muted: var(--sl-color-foreground-accent-grey-subtlest, #6e6e73); --dt-vz-surface: var(--dna-foreground, #fff); --dt-vz-group: rgba(120,120,128,.08); --dt-vz-sep: rgba(60,60,67,.12); --dt-vz-accent: var(--dna-primary, #007aff); --dt-vz-font: inherit; }
      .dt-vz-tabbtn { appearance: none; border: 0; background: transparent; color: var(--dt-vz-fg); font: 400 14px/20px var(--dt-vz-font); padding: 6px 16px 10px; margin-left: 2px; cursor: pointer; position: relative; border-radius: 6px 6px 0 0; }
      .dt-vz-tabbtn:hover { background: color-mix(in srgb, var(--dt-vz-accent) 10%, transparent); }
      .dt-vz-tabbtn.is-active { color: var(--dt-vz-accent); }
      .dt-vz-tabbtn.is-active::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--dt-vz-accent); }
      dna-tab-bar.dt-vz-on dna-tab-button[selected] { --color: var(--dt-vz-muted); --_color: var(--dt-vz-muted); --background: transparent; --_background: transparent; font-weight: 500; }
      #dt-vz { padding: 0 1rem 1.5rem; font-family: var(--dt-vz-font); color: var(--dt-vz-fg); }
      #dt-vz[hidden] { display: none; }
      .dt-vz-loading, .dt-vz-empty { color: var(--dt-vz-muted); font-size: .8125rem; margin: .5rem 0; }
      .dt-vz-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: .75rem 0 .75rem; }
      .dt-vz-title { font: 600 1.0625rem/1.3 var(--dt-vz-font); letter-spacing: -.01em; }
      .dt-vz-segs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--dt-vz-group); }
      .dt-vz-seg { appearance: none; border: 0; background: transparent; color: var(--dt-vz-muted); font: 500 .75rem/1 var(--dt-vz-font); padding: .4rem .7rem; border-radius: 7px; cursor: pointer; }
      .dt-vz-seg.is-on { background: var(--dt-vz-surface); color: var(--dt-vz-fg); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.14); }
      .dt-vz-psel { appearance: none; -webkit-appearance: none; border: 0; background: transparent no-repeat right .45rem center / 10px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); color: var(--dt-vz-muted); font: 500 .75rem/1 var(--dt-vz-font); padding: .4rem 1.4rem .4rem .7rem; border-radius: 7px; cursor: pointer; max-width: 15rem; }
      .dt-vz-psel.is-on { background-color: var(--dt-vz-surface); color: var(--dt-vz-fg); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.14); }
      .dt-vz-summary { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: .5rem; }
      .dt-vz-big { font: 700 2.25rem/1 var(--dt-vz-font); letter-spacing: -.04em; }
      .dt-vz-sumtext { font: 400 .875rem/1.4 var(--dt-vz-font); color: var(--dt-vz-muted); } .dt-vz-sumtext b { color: var(--dt-vz-fg); font-weight: 600; }
      .dt-vz-obs { display: flex; flex-direction: column; gap: 6px; margin: .25rem 0 1rem; }
      .dt-vz-ob { position: relative; padding: 8px 12px 8px 30px; border-radius: 12px; background: color-mix(in srgb, var(--dt-vz-accent) 9%, transparent); font: 400 .8125rem/1.4 var(--dt-vz-font); }
      .dt-vz-ob::before { content: ""; position: absolute; left: 12px; top: 13px; width: 8px; height: 8px; border-radius: 50%; background: var(--dt-vz-accent); }
      .dt-vz-ob b { font-weight: 600; }
      .dt-vz-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .dt-vz-wide { grid-column: 1 / -1; }
      @media (max-width: 900px) { .dt-vz-grid { grid-template-columns: 1fr; } }
      .dt-vz-card { background: var(--dt-vz-group); border-radius: 16px; padding: 14px 16px 12px; min-width: 0; }
      .dt-vz-card h4 { margin: 0 0 10px; font: 600 .6875rem/1 var(--dt-vz-font); letter-spacing: .06em; text-transform: uppercase; color: var(--dt-vz-muted); }
      .dt-vz-rows { display: flex; flex-direction: column; gap: 7px; }
      .dt-vz-row { display: grid; grid-template-columns: minmax(7rem, 11rem) 1fr 4rem 2.75rem 2.5rem; align-items: center; gap: 10px; }
      .dt-vz-ziek { justify-self: start; font: 500 .6875rem/18px var(--dt-vz-font); color: #8E3BB8; background: rgba(175, 82, 222, .13); border-radius: 999px; padding: 0 7px; white-space: nowrap; }
      .dt-vz-ziek.is-nul { background: transparent; padding: 0; }
      .dt-vz-n small { margin-left: 2px; color: #32ADE6; font-size: .625rem; }
      .dt-vz-legend-vr { color: #32ADE6; }
      .dt-vz-label { display: flex; flex-direction: column; min-width: 0; } .dt-vz-label b { font: 500 .8125rem/1.2 var(--dt-vz-font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dt-vz-label small { font: 400 .6875rem/1.2 var(--dt-vz-font); color: var(--dt-vz-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dt-vz-row.is-warn .dt-vz-label b { color: #FF3B30; }
      .dt-vz-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--dt-vz-sep); } .dt-vz-bar > span { display: block; height: 100%; min-width: 2px; } .dt-vz-bar > span + span { border-left: 1px solid var(--dt-vz-surface); }
      .dt-vz-pct { font: 600 .75rem/1 var(--dt-vz-font); text-align: right; } .dt-vz-n { font: 400 .6875rem/1 var(--dt-vz-font); color: var(--dt-vz-muted); text-align: right; }
      .dt-vz-more { font: 400 .6875rem/1.2 var(--dt-vz-font); color: var(--dt-vz-muted); margin-top: 2px; }
      .dt-vz-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 10px; font: 400 .6875rem/1.2 var(--dt-vz-font); color: var(--dt-vz-muted); } .dt-vz-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; } .dt-vz-legend-n { margin-left: auto; }
      .dt-vz-line { max-width: 100%; height: auto; display: block; } .dt-vz-grid-line, .dt-vz-line line { stroke: var(--dt-vz-sep); stroke-width: 1; } .dt-vz-ytick, .dt-vz-xtick { font: 500 9px var(--dt-vz-font); fill: var(--dt-vz-muted); } .dt-vz-area { fill: color-mix(in srgb, var(--dt-vz-accent) 12%, transparent); } .dt-vz-poly { fill: none; stroke: var(--dt-vz-accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .dt-vz-cmp { width: 100%; border-collapse: collapse; font: 400 .8125rem/1.3 var(--dt-vz-font); font-variant-numeric: tabular-nums; }
      .dt-vz-cmp th { text-align: right; font: 600 .6875rem/1.2 var(--dt-vz-font); color: var(--dt-vz-muted); padding: 0 8px 8px; white-space: nowrap; }
      .dt-vz-cmp th:first-child, .dt-vz-cmp td:first-child { text-align: left; padding-left: 0; }
      .dt-vz-cmp td { text-align: right; padding: 8px; border-top: 1px solid var(--dt-vz-sep); white-space: nowrap; }
      .dt-vz-cmp td:first-child b { font-weight: 600; } .dt-vz-cmp td small { display: block; font-size: .6875rem; color: var(--dt-vz-muted); margin-left: 16px; }
      .dt-vz-cmpdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: 1px; }
      .dt-vz-cmp tr.is-leeg td { color: var(--dt-vz-muted); }
      .dt-vz-dim { color: var(--dt-vz-muted); }
      .dt-vz-delta { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font: 600 .6875rem/18px var(--dt-vz-font); background: var(--dt-vz-group); color: var(--dt-vz-muted); }
      .dt-vz-delta.is-up { background: rgba(52, 199, 89, .14); color: #1E7B34; } .dt-vz-delta.is-down { background: rgba(255, 59, 48, .12); color: #C4271D; }
      .dt-vz-cmpzin { margin: 0 0 12px; font: 400 .8125rem/1.4 var(--dt-vz-font); }
      .dt-vz-cmpgraf { margin-top: 14px; }
      .dt-vz-cmpnoot { margin: 10px 0 0; font: 400 .6875rem/1.4 var(--dt-vz-font); color: var(--dt-vz-muted); }
      .dt-vz-foot { margin-top: 12px; font: 400 .6875rem/1.4 var(--dt-vz-font); color: var(--dt-vz-muted); }
    `;
    root.append(st);
  }
});

/* Statistiek: per les één categorie (afwezigheidstype > te laat > aanwezig), gegroepeerd. */
function vzStats(regs, rooster, van, tot) {
  const ABSENT = new Set(["AB", "ZK", "UI"]);
  const TYPE = { absent: "AB", ab: "AB", telaat: "TL", tl: "TL", ziek: "ZK", zk: "ZK", uitgestuurd: "UI", ui: "UI", vrijstelling: "VR", vr: "VR", boekenvergeten: "MV", materiaalvergeten: "MV", mv: "MV", huiswerkvergeten: "HV", hv: "HV", mobielinklas: "MK", mk: "MK", onbekend: "ON", on: "ON" };
  const norm = (v) => { const k = String(v ?? "").replace(/[\s_-]/g, "").toLowerCase(); return k in TYPE ? TYPE[k] : String(v ?? "").toUpperCase(); };
  const names = (arr, keys) => (Array.isArray(arr) ? arr : []).map((x) => (typeof x === "string" ? x : keys.map((k) => x?.[k]).find(Boolean))).filter(Boolean);
  const DAG = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  /* Rooster: lessen in de periode, op id en op begintijd */
  const byId = new Map(), byStart = new Map();
  const lessen = [];
  for (const a of rooster) {
    const b = new Date(a.start || a.begin), e = new Date(a.einde || a.eind);
    if (isNaN(b) || isNaN(e) || e > tot || b < van || a.status === 5 || a.isVervallen === true) continue;
    const l = { id: a.id, begin: b, vak: names(a.vakken, ["naam", "omschrijving", "code"]).join(", ") || a.omschrijving || "Onbekend", docent: docentenVan(a), cat: "OK", extra: 0 };
    lessen.push(l); if (a.id != null) byId.set(String(a.id), l); byStart.set(b.getTime(), l);
  }
  let onbekend = 0;
  for (const it of regs) {
    const a = it.afspraak || it.appointment || it;
    const b = new Date(a.begin || a.start || a.startDateTime), e = new Date(a.einde || a.eind || a.endDateTime || b);
    if (isNaN(b) || b > tot || b < van || (!isNaN(e) && e > tot)) continue;
    const raw = it.verantwoordingen || it.registraties || it.registrations || (it.verantwoording ? [it.verantwoording] : []);
    const rs = raw.map((r) => ({ type: norm(r.reden?.verantwoordingType ?? r.verantwoordingType ?? r.reden?.code ?? r.attendanceTypeCode ?? r.code ?? r.type ?? ""), ok: r.reden?.isGeoorloofd ?? r.isGeoorloofd ?? r.geoorloofd ?? r.approved ?? true }));
    let l = (a.id != null && byId.get(String(a.id))) || byStart.get(b.getTime());
    if (!l) { l = { id: a.id, begin: b, vak: a.omschrijving || "Onbekend", docent: "", cat: "OK", extra: 0 }; lessen.push(l); onbekend++; }
    const abs = rs.find((r) => ABSENT.has(r.type));
    /* Vrijstelling is met toestemming: geen verzuim, en de les valt buiten het percentage. */
    l.cat = abs ? (abs.type === "AB" ? (abs.ok ? "AB_OK" : "AB_NO") : abs.type) : rs.some((r) => r.type === "VR") ? "VR" : (rs.some((r) => r.type === "TL") ? "TL" : "OK");
  }
  const mk = (label, sub = "") => ({ label, sub, lessen: 0, afwezig: 0, ongeoorloofd: 0, teLaat: 0, vrij: 0, ziek: 0, per: {}, pct: 0 });
  const add = (g, l) => { g.lessen++; g.per[l.cat] = (g.per[l.cat] || 0) + 1; if (l.cat === "VR") g.vrij++; else if (!["OK", "TL"].includes(l.cat)) g.afwezig++; if (l.cat === "AB_NO") g.ongeoorloofd++; if (l.cat === "ZK") g.ziek++; if (l.cat === "TL") g.teLaat++; };
  const fin = (g) => { const telt = g.lessen - g.vrij; g.telt = telt; g.pct = telt > 0 ? Math.round(100 * (telt - g.afwezig) / telt) : 100; return g; };
  const totaal = mk("Totaal"), vakken = new Map(), docenten = new Map(), dagen = new Map(), uren = new Map(), weken = new Map(), maanden = new Map();
  const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  for (const l of lessen) {
    add(totaal, l);
    const kv = l.vak; if (!vakken.has(kv)) vakken.set(kv, mk(l.vak, l.docent)); add(vakken.get(kv), l);
    if (l.docent) { for (const dn of l.docent.split(", ")) { if (!docenten.has(dn)) docenten.set(dn, mk(dn)); add(docenten.get(dn), l); } }
    const kd = l.begin.getDay(); if (!dagen.has(kd)) dagen.set(kd, mk(DAG[kd][0].toUpperCase() + DAG[kd].slice(1))); add(dagen.get(kd), l);
    const ku = l.begin.getHours(); if (!uren.has(ku)) uren.set(ku, mk(`${String(ku).padStart(2, "0")}:00`)); add(uren.get(ku), l);
    const km = `${l.begin.getFullYear()}-${l.begin.getMonth()}`; if (!maanden.has(km)) maanden.set(km, Object.assign(mk(MND[l.begin.getMonth()]), { y: l.begin.getFullYear(), m: l.begin.getMonth(), idx: (l.begin.getMonth() + 5) % 12 })); add(maanden.get(km), l);
    const wk = isoWeek(l.begin); const kw = `${wk.y}-${wk.w}`; if (!weken.has(kw)) weken.set(kw, Object.assign(mk(`week ${wk.w}`), { y: wk.y, week: wk.w })); add(weken.get(kw), l);
  }
  const sortBad = (a, b) => a.pct - b.pct || b.lessen - a.lessen;
  return {
    totaal: fin(totaal), onbekend,
    vakken: [...vakken.values()].map(fin).sort(sortBad),
    docenten: [...docenten.values()].map(fin).sort(sortBad),
    dagen: [...dagen.entries()].sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7)).map(([, g]) => fin(g)),
    uren: [...uren.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => fin(g)),
    weken: [...weken.values()].map(fin).sort((a, b) => a.y - b.y || a.week - b.week),
    maanden: [...maanden.values()].map(fin).sort((a, b) => a.y - b.y || a.m - b.m),
  };
}

/* Docenten van een afspraak: Magister levert ze als docenten (naam of code), als deelnames
 * (deelnemers met rol/type docent) of als medewerkers; de eerste gevulde bron wint. */
function docentenVan(a) {
  const naam = (x) => {
    if (!x) return ""; if (typeof x === "string") return x;
    const p = x.persoon || x.medewerker || x.docent || x;
    const vol = p.volledigeNaam || p.weergavenaam || p.naam || p.displayName;
    if (vol) return String(vol);
    const delen = [p.voorletters || p.roepnaam, p.tussenvoegsel, p.achternaam].filter(Boolean);
    return delen.length ? delen.join(" ") : String(p.code || p.afkorting || "");
  };
  const isDocent = (x) => { const t = String(x?.type ?? x?.rol ?? x?.soort ?? "").toLowerCase(); return !t || /docent|medewerker|leraar|personeel|staff|teacher/.test(t) || t === "2"; };
  for (const bron of [a.docenten, a.medewerkers, a.leraren, (a.deelnames || a.deelnemers || []).filter(isDocent)]) {
    const n = (Array.isArray(bron) ? bron : []).map(naam).filter(Boolean);
    if (n.length) return [...new Set(n)].join(", ");
  }
  return "";
}

function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const y = x.getUTCFullYear(); const w = Math.ceil(((x - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { y, w };
}
