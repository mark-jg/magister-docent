/* Leerlingoverzicht: kaart "Overzicht" bovenaan het tabblad Algemeen van de leerlingkaart
 * (de detailkaarten-app in het frame /op-detailkaarten/). Tegels in de stijl van de
 * notificaties op Vandaag, plus het rooster van vandaag. Alle gegevens komen van Magisters
 * eigen API via je eigen sessie (DT.api in dit frame); er gaat niets naar buiten.
 *
 * Bronnen (zoals Magister ze zelf voor een leerling gebruikt):
 *  - /api/leerlingen/{id}                               persoon, geboortedatum, links.lvs
 *  - links.lvs → links.logboeken (?begin&einde)         logboekformulieren
 *  - /api/leerlingen/{id}/afspraken?status=actief&begin&einde   rooster
 *  - /api/leerlingen/{id}/afspraken/taken?status=alle&begin&einde  taken (ELO)
 *  - /api/leerlingen/{id}/verantwoordingen/terugkommaatregelen     terugkommaatregelen
 *  - /api/m6/leerlingen/{id}/verantwoordingen?begin&einde  aanwezigheid: per les de registraties
 *    (reden.verantwoordingType AB/TL/ZK/UI/VR/MV/HV/MK, reden.isGeoorloofd), zoals het scherm Verzuim */
DT.register({
  id: "leerlingdash",
  _stop: null,
  _card: null,
  _style: null,
  _cache: new Map(),  // leerlingId → { at, data }
  _busy: null,

  init(DT) {
    if (!/^\/op-detailkaarten\//.test(location.pathname)) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 500, poll: 3000 });
  },

  destroy() {
    this._stop && this._stop();
    this._card?.remove(); this._card = null;
    this._style?.remove(); this._style = null;
  },

  leerlingId() {
    const m = location.hash.match(/#\/basisgegevens\/leerling\/(\d+)\//);
    return m ? m[1] : null;
  },

  async mount(DT) {
    const id = this.leerlingId();
    const page = id && document.querySelector("dk-algemene-gegevens .page");
    if (!page) { if (this._card) { this._card.remove(); this._card = null; } return; }
    this.css();
    if (!this._card || !this._card.isConnected || this._card.dataset.id !== id) {
      this._card?.remove();
      this._card = document.createElement("dna-card");
      this._card.id = "dt-ll-dash"; this._card.dataset.id = id;
      this._card.innerHTML = `<dna-card-title>Overzicht</dna-card-title><div class="dt-ll-body"><div class="dt-ll-loading">Gegevens ophalen…</div></div>`;
      this._card.addEventListener("click", (e) => {
        const a = e.target.closest("[data-state]"); if (!a) return;
        e.preventDefault();
        try { window.parent.postMessage({ type: "dt:state:go", id: "ll" + Date.now(), name: a.dataset.state, params: { type: "leerling", id: String(id), rol: "Docent", rolId: "" } }, "*"); } catch {}
      });
      page.prepend(this._card);
    } else if (page.firstElementChild !== this._card) page.prepend(this._card);
    const c = this._cache.get(id);
    if (c && Date.now() - c.at < 10 * 60e3) { this.render(c.data); return; }
    if (this._busy === id) return;
    this._busy = id;
    try {
      const data = await this.load(DT, id);
      this._cache.set(id, { at: Date.now(), data });
      if (this._card && this._card.dataset.id === id) this.render(data);
    } finally { if (this._busy === id) this._busy = null; }
  },

  async load(DT, id) {
    const today = new Date(), ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const plus = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
    const get = (url) => DT.api(url, { full: true, timeout: 12000 });
    const list = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || r.json.Items || []) : null;
    const sjStart = new Date(today.getFullYear() - (today.getMonth() < 7 ? 1 : 0), 7, 1);
    const [pers, afspr, taken, terug, verantw] = await Promise.all([
      get(`/api/leerlingen/${id}`),
      get(`/api/leerlingen/${id}/afspraken?status=actief&begin=${ymd(today)}&einde=${ymd(plus(1))}`),
      get(`/api/leerlingen/${id}/afspraken/taken?status=alle&begin=${ymd(plus(-today.getDay() + 1))}&einde=${ymd(plus(8 - today.getDay()))}`),
      get(`/api/leerlingen/${id}/verantwoordingen/terugkommaatregelen`),
      get(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${ymd(sjStart)}&einde=${ymd(today)}`),
    ]);
    /* Aanwezigheid: als elke les een registratie heeft, kent de lijst alleen de registraties en
     * halen we het totale aantal lessen uit het rooster van dezelfde periode. */
    let lessenTotaal = null, lessenPerMaand = null;
    const vItems = list(verantw);
    if (vItems && vItems.length && vItems.every((x) => (x.verantwoordingen || []).length > 0)) {
      const r = await get(`/api/leerlingen/${id}/afspraken?status=actief&begin=${ymd(sjStart)}&einde=${ymd(today)}`);
      const l = list(r);
      if (l) {
        lessenPerMaand = {}; lessenTotaal = 0;
        for (const a of l) {
          const b = new Date(a.start || a.begin), e = new Date(a.einde || a.eind);
          if (isNaN(b) || isNaN(e) || e > today || a.status === 5 || a.isVervallen === true) continue;
          const k = `${b.getFullYear()}-${b.getMonth()}`; lessenPerMaand[k] = (lessenPerMaand[k] || 0) + 1; lessenTotaal++;
        }
      }
    }
    const persoon = pers.status === 200 ? pers.json : null;
    /* Logboek: via het LVS-startpunt van de leerling, zoals het leerlingvolgsysteem zelf. */
    let logboek = null, logboekErr = pers.status !== 200 ? `persoon ${pers.status}` : "";
    try {
      const lvsHref = persoon?.links?.lvs?.href;
      if (lvsHref) {
        const ep = await get(lvsHref);
        const lbHref = ep.json?.links?.logboeken?.href;
        if (lbHref) {
          const sep = lbHref.includes("?") ? "&" : "?";
          const lb = await get(`${lbHref}${sep}begin=${ymd(plus(-365))}&einde=${ymd(plus(1))}`);
          logboek = list(lb); if (!logboek) logboekErr = `logboeken ${lb.status}`;
        } else logboekErr = `lvs ${ep.status}`;
      } else logboekErr = "geen lvs-koppeling";
    } catch (e) { logboekErr = String(e); }
    return {
      persoon, afspraken: list(afspr), afsprakenErr: afspr.status, taken: list(taken), takenErr: taken.status,
      terugkom: list(terug), terugkomErr: terug.status, logboek, logboekErr, today: today.getTime(),
      verantw: vItems, verantwErr: verantw.status, lessenTotaal, lessenPerMaand, sjStart: sjStart.getTime(),
    };
  },

  render(d) {
    const body = this._card?.querySelector(".dt-ll-body"); if (!body) return;
    const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const now = new Date(), today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hhmm = (v) => { const x = new Date(v); return isNaN(x) ? "" : `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
    const names = (arr, keys) => (Array.isArray(arr) ? arr : []).map((x) => (typeof x === "string" ? x : keys.map((k) => x?.[k]).find(Boolean))).filter(Boolean);

    /* Rooster van vandaag */
    const lessen = (d.afspraken || []).map((a) => ({
      start: new Date(a.start || a.begin || a.Start), einde: new Date(a.einde || a.eind || a.Einde),
      vak: names(a.vakken, ["naam", "omschrijving", "code"]).join(", ") || a.omschrijving || a.Omschrijving || "Les",
      lokaal: names(a.lokalen, ["naam", "code"]).join(", ") || a.lokatie || a.lokaal || "",
      docent: names(a.docenten, ["naam", "code"]).join(", "),
      vervallen: a.status === 5 || /vervallen/i.test(String(a.status || "")) || a.isVervallen === true,
    })).filter((l) => !isNaN(l.start) && l.start >= today0 && l.start < new Date(today0.getTime() + 864e5)).sort((a, b) => a.start - b.start);
    const current = lessen.find((l) => l.start <= now && l.einde > now && !l.vervallen);
    const next = lessen.find((l) => l.start > now && !l.vervallen);
    const lesRows = lessen.map((l) => {
      const past = l.einde <= now, cur = l === current;
      return `<li class="dt-ll-les${cur ? " is-current" : ""}${past ? " is-past" : ""}${l.vervallen ? " is-vervallen" : ""}">
        <span class="dt-ll-tijd">${hhmm(l.start)}<small>${hhmm(l.einde)}</small></span>
        <span class="dt-ll-vak">${esc(l.vak)}</span>
        <span class="dt-ll-meta">${esc([l.lokaal, l.docent].filter(Boolean).join(" · "))}${l.vervallen ? ' <em>vervallen</em>' : ""}</span>
      </li>`;
    }).join("");

    /* Logboek */
    const lbItems = (d.logboek || []).map((x) => x.logboek || x);
    const lbUnread = lbItems.filter((x) => x.isGelezen === false).length;
    const lbRecent = lbItems.filter((x) => { const t = new Date(x.aangemaaktOp || x.datum); return !isNaN(t) && now - t < 30 * 864e5; }).length;
    const lbPrio = lbItems.filter((x) => x.heeftPrioriteit === true && x.isAfgerond !== true).length;
    const lbLast = lbItems.map((x) => ({ t: new Date(x.aangemaaktOp || x.datum), x })).filter((o) => !isNaN(o.t)).sort((a, b) => b.t - a.t)[0];

    /* Taken en terugkomen */
    const taken = d.taken || [];
    const takenOpen = taken.filter((x) => x.ingeleverdOp == null && x.isIngeleverd !== true && x.afgerond !== true && x.status !== "afgerond").length;
    const terug = (d.terugkom || []).filter((x) => { const e = new Date(x.einde || x.datum || x.begin); return isNaN(e) || e >= today0; });

    /* Jarig */
    let jarig = null;
    const geb = d.persoon && new Date(d.persoon.geboortedatum || d.persoon.Geboortedatum);
    if (geb && !isNaN(geb)) {
      let nxt = new Date(today0.getFullYear(), geb.getMonth(), geb.getDate());
      if (nxt < today0) nxt = new Date(today0.getFullYear() + 1, geb.getMonth(), geb.getDate());
      jarig = { days: Math.round((nxt - today0) / 864e5), age: nxt.getFullYear() - geb.getFullYear() };
    }

    /* Aanwezigheid dit schooljaar */
    const att = aanwezigheid(d.verantw, d.lessenTotaal, new Date(d.sjStart), now, d.lessenPerMaand);

    const tile = (kind, num, label, sub, { hot = false, state = "", err = "" } = {}) => `
      <${state ? `a href="#" data-state="${state}"` : "div"} class="dt-ll-tile${hot ? " is-hot" : ""}${err ? " is-err" : ""}" data-kind="${kind}" ${err ? `title="${esc(err)}"` : ""}>
        <span class="dt-ll-ico">${ICON[kind] || ""}</span>
        <span class="dt-ll-num">${esc(num)}</span>
        <span class="dt-ll-label">${esc(label)}</span>
        ${sub ? `<span class="dt-ll-sub">${esc(sub)}</span>` : ""}
      </${state ? "a" : "div"}>`;
    const fail = (status) => status == null || status === 200 ? "" : (status === 0 ? "geen antwoord" : `Magister antwoordde ${status}`);

    const lesSub = current ? `Nu: ${current.vak}${current.lokaal ? " · " + current.lokaal : ""}` : next ? `Volgende ${hhmm(next.start)}: ${next.vak}` : lessen.length ? "Lessen zijn voorbij" : "Geen lessen vandaag";
    /* Donut: aanwezig in groen, de afwezige lessen per type in de kleuren van de grafiek. */
    const donut = (att) => {
      const r = 20, c = 2 * Math.PI * r, L = Math.max(1, att.lessen);
      const parts = [["ZK", "#AF52DE"], ["AB_OK", "#FF9500"], ["AB_NO", "#FF3B30"], ["UI", "#A2845E"], ["VR", "#32ADE6"]].map(([k, col]) => [Math.min(att.perType[k] || 0, L), col]).filter(([n]) => n > 0);
      const absN = parts.reduce((x, [n]) => x + n, 0), present = Math.max(0, L - absN);
      let off = 0; const seg = (n, col) => { const len = c * n / L; const out = `<circle cx="24" cy="24" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-dasharray="${len.toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 24 24)"/>`; off += len; return out; };
      return `<svg class="dt-ll-ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="5"/>${seg(present, "#34C759")}${parts.map(([n, col]) => seg(n, col)).join("")}</svg>`;
    };
    const attTile = att ? `
      <a href="#" data-state="AttVerzuim" class="dt-ll-tile dt-ll-att" data-kind="aanwezig" title="${att.onbekend.length ? esc(`Onbekend registratietype: ${att.onbekend.join(", ")} (meld dit)`) : "Open Verzuim"}">
        <span class="dt-ll-ringwrap">${donut(att)}<span class="dt-ll-ringnum">${att.pct}<small>%</small></span></span>
        <span class="dt-ll-att-text">
          <span class="dt-ll-label">aanwezig dit schooljaar</span>
          <span class="dt-ll-sub">${esc(att.lessen - att.afwezig)} van ${esc(att.lessen)} lessen aanwezig${att.afwezig ? ` · ${att.ziek ? `${att.ziek}× ziek` : ""}${att.ziek && att.afwezig - att.ziek ? ", " : ""}${att.afwezig - att.ziek ? `${att.afwezig - att.ziek}× afwezig${att.ongeoorloofd ? ` (${att.ongeoorloofd} ongeoorloofd)` : ""}` : ""}` : ""}${att.teLaat ? ` · ${att.teLaat}× te laat` : ""}${att.onbekend.length ? ` · ${esc(att.onbekend.length)} onbekend type` : ""}</span>
        </span>
      </a>` : tile("aanwezig", "–", "aanwezigheid", d.verantw ? "geen lessen in deze periode" : "", { state: "AttVerzuim", err: d.verantw ? "" : fail(d.verantwErr) });
    const tiles = [
      attTile,
      tile("rooster", d.afspraken ? lessen.filter((l) => !l.vervallen).length : "–", "lessen vandaag", lesSub, { err: d.afspraken ? "" : fail(d.afsprakenErr) }),
      tile("logboek", d.logboek ? lbUnread : "–", "ongelezen logboeken", d.logboek ? `${lbRecent} in de laatste 30 dagen${lbPrio ? ` · ${lbPrio} met prioriteit` : ""}` : "", { hot: lbUnread > 0 || lbPrio > 0, state: "begeleiding", err: d.logboek ? "" : d.logboekErr }),
      tile("taken", d.taken ? takenOpen : "–", "open taken deze week", d.taken ? `${taken.length} taken in totaal` : "", { hot: takenOpen > 0, err: d.taken ? "" : fail(d.takenErr) }),
      tile("terugkom", d.terugkom ? terug.length : "–", "terugkommaatregelen", d.terugkom ? (terug.length ? "nog niet afgehandeld" : "niets open") : "", { hot: terug.length > 0, err: d.terugkom ? "" : fail(d.terugkomErr) }),
      tile("jarig", jarig ? (jarig.days === 0 ? "🎂" : jarig.days) : "–", jarig ? (jarig.days === 0 ? `vandaag ${jarig.age} geworden` : jarig.days === 1 ? `morgen jarig, wordt ${jarig.age}` : `dagen tot verjaardag · wordt ${jarig.age}`) : "verjaardag", "", { hot: !!jarig && jarig.days <= 7 }),
    ].join("");

    body.innerHTML = `
      <div class="dt-ll-tiles">${tiles}</div>
      <div class="dt-ll-cols">
        <section class="dt-ll-sec"><h4>Rooster vandaag</h4>${lessen.length ? `<ul class="dt-ll-lessen">${lesRows}</ul>` : `<p class="dt-ll-empty">${d.afspraken ? "Geen lessen vandaag." : "Rooster niet beschikbaar."}</p>`}</section>
        ${att && att.maanden.length ? (() => {
      const SOORT = [["OK", "aanwezig", "#34C759"], ["TL", "te laat", "#FFCC00"], ["ZK", "ziek", "#AF52DE"], ["AB_OK", "absent, geoorloofd", "#FF9500"], ["AB_NO", "absent, ongeoorloofd", "#FF3B30"], ["UI", "uitgestuurd", "#A2845E"], ["VR", "vrijstelling", "#32ADE6"]];
      const aanwezig = SOORT.filter(([k]) => att.maanden.some((m) => m.per[k]));
      const rows = att.maanden.map((m) => {
        const segs = aanwezig.map(([k, n, c]) => m.per[k] ? `<span class="dt-ll-hseg" style="width:${(100 * m.per[k] / m.lessen).toFixed(2)}%;background:${c}" title="${esc(`${m.per[k]}× ${n}`)}"></span>` : "").join("");
        const tip = `${m.label}: ${m.lessen} lessen, ${m.pctAanwezig}% aanwezig` + aanwezig.filter(([k]) => k !== "OK" && m.per[k]).map(([k, n]) => `\n${m.per[k]}× ${n}`).join("") + (m.per.OVERIG ? `\n${m.per.OVERIG}× huiswerk/materiaal/mobiel` : "");
        return `<div class="dt-ll-hrow" title="${esc(tip)}"><span class="dt-ll-hlabel">${esc(m.kort)}</span><span class="dt-ll-hbar">${segs}</span><span class="dt-ll-hpct">${m.pctAanwezig}%</span></div>`;
      }).join("");
      const legend = aanwezig.map(([, n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join("");
      return `<section class="dt-ll-sec dt-ll-sec-maanden"><h4>Aanwezigheid per maand</h4><div class="dt-ll-hrows">${rows}</div><div class="dt-ll-legend">${legend}</div></section>`;
    })() : ""}
        <section class="dt-ll-sec"><h4>Laatste logboek</h4>${lbLast ? `<a href="#" data-state="begeleiding" class="dt-ll-lb"><span class="dt-ll-lb-type">${esc(lbLast.x.formulierType?.naam || lbLast.x.formulierTypeNaam || "Logboek")}</span><span class="dt-ll-lb-date">${esc(lbLast.t.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }))}</span><span class="dt-ll-lb-text">${esc(lbLast.x.omschrijving || lbLast.x.titel || "")}</span></a>` : `<p class="dt-ll-empty">${d.logboek ? "Nog geen logboekformulieren." : "Logboek niet beschikbaar."}</p>`}</section>
      </div>`;
  },

  css() {
    if (this._style) return;
    this._style = document.createElement("style"); this._style.id = "dt-ll-style";
    this._style.textContent = `
      dk-basisgegevens-page .container:not(.employee) { grid-template-columns: minmax(0, 1fr); }
      dk-basisgegevens-page .container:not(.employee) > .wrapper, dk-basisgegevens-page .tab-content, dk-algemene-gegevens .page { min-width: 0; max-width: 100%; box-sizing: border-box; }
      #dt-ll-dash { grid-column: 1 / -1; min-width: 0; max-width: 100%; }
      #dt-ll-dash .dt-ll-body, #dt-ll-dash .dt-ll-tiles, #dt-ll-dash .dt-ll-cols, #dt-ll-dash .dt-ll-sec, #dt-ll-dash .dt-ll-tile, #dt-ll-dash .dt-ll-lb { min-width: 0; }
      #dt-ll-dash .dt-ll-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(128px, 100%), 1fr)); gap: 10px; margin-bottom: 1rem; }
      #dt-ll-dash .dt-ll-tile { --k: #6e6e73; display: grid; grid-template-columns: 1fr auto; grid-template-areas: "ico num" "label label" "sub sub"; gap: 4px 8px; padding: 12px 14px; border-radius: 14px; background: rgba(60,60,67,.05); color: inherit; text-decoration: none; min-height: 84px; align-content: start; }
      #dt-ll-dash a.dt-ll-tile { cursor: pointer; } #dt-ll-dash a.dt-ll-tile:hover { background: rgba(60,60,67,.09); }
      #dt-ll-dash .dt-ll-tile[data-kind="rooster"] { --k: #007AFF; } #dt-ll-dash .dt-ll-tile[data-kind="logboek"] { --k: #AF52DE; } #dt-ll-dash .dt-ll-tile[data-kind="taken"] { --k: #FF9500; } #dt-ll-dash .dt-ll-tile[data-kind="terugkom"] { --k: #FF3B30; } #dt-ll-dash .dt-ll-tile[data-kind="jarig"] { --k: #FF2D55; }
      #dt-ll-dash .dt-ll-tile.is-hot { background: color-mix(in srgb, var(--k) 12%, #fff); }
      #dt-ll-dash .dt-ll-tile.is-err { opacity: .6; }
      #dt-ll-dash .dt-ll-ico { grid-area: ico; width: 30px; height: 30px; border-radius: 50%; display: inline-grid; place-items: center; background: color-mix(in srgb, var(--k) 16%, #fff); color: var(--k); }
      #dt-ll-dash .dt-ll-tile.is-hot .dt-ll-ico { background: var(--k); color: #fff; }
      #dt-ll-dash .dt-ll-num { grid-area: num; font: 700 1.625rem/1 -apple-system, system-ui, sans-serif; letter-spacing: -.02em; color: #6e6e73; }
      #dt-ll-dash .dt-ll-tile.is-hot .dt-ll-num { color: var(--k); }
      #dt-ll-dash .dt-ll-label { grid-area: label; font: 500 .75rem/1.25 -apple-system, system-ui, sans-serif; color: #6e6e73; }
      #dt-ll-dash .dt-ll-label::first-letter { text-transform: uppercase; }
      #dt-ll-dash .dt-ll-tile.is-hot .dt-ll-label { color: inherit; }
      #dt-ll-dash .dt-ll-sub { grid-area: sub; font: 400 .6875rem/1.3 -apple-system, system-ui, sans-serif; color: #8e8e93; }
      #dt-ll-dash .dt-ll-att { grid-column: span 2; grid-template-columns: auto 1fr; grid-template-areas: "ring text"; align-items: center; gap: 4px 12px; }
      @media (max-width: 700px) { #dt-ll-dash .dt-ll-att { grid-column: span 1; } }
      #dt-ll-dash .dt-ll-ringwrap { grid-area: ring; position: relative; width: 56px; height: 56px; color: #6e6e73; }
      #dt-ll-dash .dt-ll-ring { width: 56px; height: 56px; }
      #dt-ll-dash .dt-ll-ring { display: block; }
      #dt-ll-dash .dt-ll-ringnum { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; white-space: nowrap; font: 700 .9375rem/1 -apple-system, system-ui, sans-serif; letter-spacing: -.03em; color: #1D1D1F; }
      #dt-ll-dash .dt-ll-ringnum small { font-size: .5625rem; font-weight: 600; margin-left: 1px; align-self: center; }
      #dt-ll-dash .dt-ll-att-text { grid-area: text; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      #dt-ll-dash .dt-ll-hrows { display: flex; flex-direction: column; gap: 7px; padding: 2px 0; }
      #dt-ll-dash .dt-ll-hrow { display: grid; grid-template-columns: 2.25rem 1fr 2.75rem; align-items: center; gap: 8px; }
      #dt-ll-dash .dt-ll-hlabel { font: 500 .625rem/1 -apple-system, system-ui, sans-serif; color: #8e8e93; text-transform: uppercase; letter-spacing: .04em; }
      #dt-ll-dash .dt-ll-hbar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: rgba(60,60,67,.07); }
      #dt-ll-dash .dt-ll-hseg { display: block; height: 100%; min-width: 2px; }
      #dt-ll-dash .dt-ll-hseg + .dt-ll-hseg { border-left: 1px solid rgba(255,255,255,.7); }
      #dt-ll-dash .dt-ll-hpct { font: 600 .6875rem/1 -apple-system, system-ui, sans-serif; color: #6e6e73; text-align: right; }
      #dt-ll-dash .dt-ll-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font: 400 .6875rem/1.2 -apple-system, system-ui, sans-serif; color: #8e8e93; }
      #dt-ll-dash .dt-ll-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: 0; }

      #dt-ll-dash .dt-ll-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 1rem; }
      #dt-ll-dash .dt-ll-sec h4 { margin: 0 0 .375rem; font: 600 .6875rem/1 -apple-system, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #8e8e93; }
      #dt-ll-dash .dt-ll-lessen { list-style: none; margin: 0; padding: 0; }
      #dt-ll-dash .dt-ll-les { display: grid; grid-template-columns: 3.25rem 1fr; grid-template-areas: "tijd vak" "tijd meta"; column-gap: 10px; padding: 6px 8px; border-radius: 10px; }
      #dt-ll-dash .dt-ll-les.is-current { background: rgba(0,122,255,.1); }
      #dt-ll-dash .dt-ll-les.is-past { opacity: .5; }
      #dt-ll-dash .dt-ll-les.is-vervallen .dt-ll-vak { text-decoration: line-through; }
      #dt-ll-dash .dt-ll-tijd { grid-area: tijd; display: flex; flex-direction: column; font: 600 .8125rem/1.2 -apple-system, system-ui, sans-serif; }
      #dt-ll-dash .dt-ll-tijd small { font: 400 .6875rem/1.2 -apple-system, system-ui, sans-serif; color: #8e8e93; }
      #dt-ll-dash .dt-ll-vak { grid-area: vak; font: 500 .875rem/1.25 -apple-system, system-ui, sans-serif; }
      #dt-ll-dash .dt-ll-meta { grid-area: meta; font: 400 .75rem/1.25 -apple-system, system-ui, sans-serif; color: #8e8e93; }
      #dt-ll-dash .dt-ll-meta em { font-style: normal; color: #FF3B30; }
      #dt-ll-dash .dt-ll-lb { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "type date" "text text"; gap: 2px 8px; padding: 10px 12px; border-radius: 12px; background: rgba(60,60,67,.05); color: inherit; text-decoration: none; }
      #dt-ll-dash .dt-ll-lb:hover { background: rgba(60,60,67,.09); }
      #dt-ll-dash .dt-ll-lb-type { grid-area: type; font: 600 .8125rem/1.25 -apple-system, system-ui, sans-serif; }
      #dt-ll-dash .dt-ll-lb-date { grid-area: date; font: 400 .75rem/1.25 -apple-system, system-ui, sans-serif; color: #8e8e93; }
      #dt-ll-dash .dt-ll-lb-text { grid-area: text; font: 400 .8125rem/1.35 -apple-system, system-ui, sans-serif; color: #6e6e73; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      #dt-ll-dash .dt-ll-empty, #dt-ll-dash .dt-ll-loading { margin: 0; font: 400 .8125rem/1.3 -apple-system, system-ui, sans-serif; color: #8e8e93; }
    `;
    document.head.append(this._style);
  }
});

/* Aanwezigheid uit Magisters registraties (zoals het scherm Verzuim ze telt): per les de
 * registraties met type en geoorloofd/ongeoorloofd. Afwezig = AB, ZK, UI of VR; te laat (TL) telt
 * als aanwezig. Percentage over de lessen die al voorbij zijn. */
function aanwezigheid(items, lessenTotaal, start, now, lessenPerMaand) {
  if (!items) return null;
  const ABSENT = new Set(["AB", "ZK", "UI", "VR"]);
  /* Magister levert het type als naam (absent, teLaat, ziek, uitgestuurd, vrijstelling, …) of als code. */
  const TYPE = { absent: "AB", ab: "AB", absentie: "AB", telaat: "TL", tl: "TL", ziek: "ZK", zk: "ZK", uitgestuurd: "UI", ui: "UI", vrijstelling: "VR", vr: "VR", boekenvergeten: "MV", materiaalvergeten: "MV", mv: "MV", huiswerkvergeten: "HV", hv: "HV", mobielinklas: "MK", mk: "MK", onbekend: "ON", on: "ON", present: "", aanwezig: "" };
  const norm = (v) => { const k = String(v ?? "").replace(/[\s_-]/g, "").toLowerCase(); return k in TYPE ? TYPE[k] : String(v ?? "").toUpperCase(); };
  const onbekend = new Set(); let registraties = 0;
  const MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const MONL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const perMaand = new Map();
  let lessen = 0, afwezig = 0, ongeoorloofd = 0, teLaat = 0, ziek = 0;
  for (const it of items) {
    const a = it.afspraak || it.appointment || it;
    const begin = new Date(a.begin || a.start || a.startDateTime || it.begin);
    if (isNaN(begin) || begin > now) continue;
    const raw = it.verantwoordingen || it.registraties || it.registrations || (it.verantwoording ? [it.verantwoording] : []);
    const regs = raw.map((r) => {
      const v = r.reden?.verantwoordingType ?? r.verantwoordingType ?? r.reden?.code ?? r.attendanceTypeCode ?? r.code ?? r.type ?? "";
      const type = norm(v); registraties++;
      if (!["AB", "TL", "ZK", "UI", "VR", "MV", "HV", "MK", "ON", ""].includes(type)) onbekend.add(String(v));
      return { type, ok: r.reden?.isGeoorloofd ?? r.isGeoorloofd ?? r.geoorloofd ?? r.approved ?? true };
    });
    const key = `${begin.getFullYear()}-${begin.getMonth()}`;
    const m = perMaand.get(key) || { y: begin.getFullYear(), m: begin.getMonth(), lessen: 0, afwezig: 0, ongeoorloofd: 0, teLaat: 0, per: {} };
    m.lessen++; lessen++;
    const abs = regs.find((r) => ABSENT.has(r.type));
    if (abs) { m.afwezig++; afwezig++; if (!abs.ok) { m.ongeoorloofd++; ongeoorloofd++; } if (abs.type === "ZK") ziek++; }
    if (regs.some((r) => r.type === "TL")) { m.teLaat++; teLaat++; }
    /* Per les één categorie voor de grafiek: afwezigheidstype gaat voor te laat, te laat voor aanwezig. */
    const cat = abs ? (abs.type === "AB" ? (abs.ok ? "AB_OK" : "AB_NO") : abs.type) : (regs.some((r) => r.type === "TL") ? "TL" : "OK");
    m.per[cat] = (m.per[cat] || 0) + 1;
    for (const r of regs) if (["MV", "HV", "MK"].includes(r.type)) m.per.OVERIG = (m.per.OVERIG || 0) + 1;
    perMaand.set(key, m);
  }
  /* Kent de lijst alleen geregistreerde lessen, dan komt het aantal lessen per maand uit het rooster
   * en zijn de overige lessen van die maand aanwezig. */
  if (lessenPerMaand) {
    for (const [key, n] of Object.entries(lessenPerMaand)) {
      const [y, mo] = key.split("-").map(Number);
      const m = perMaand.get(key) || { y, m: mo, lessen: 0, afwezig: 0, ongeoorloofd: 0, teLaat: 0, per: {} };
      const geregistreerd = Object.entries(m.per).filter(([k]) => k !== "OVERIG").reduce((x, [, v]) => x + v, 0);
      m.lessen = Math.max(n, geregistreerd);
      m.per.OK = m.lessen - (geregistreerd - (m.per.OK || 0));
      perMaand.set(key, m);
    }
  }
  const perType = {};
  for (const m of perMaand.values()) for (const [k, v] of Object.entries(m.per)) perType[k] = (perType[k] || 0) + v;
  if (lessenTotaal && lessenTotaal > lessen) lessen = lessenTotaal;
  if (!lessen) return null;
  const pct = Math.round(100 * (lessen - afwezig) / lessen);
  const maanden = [...perMaand.values()].sort((a, b) => a.y - b.y || a.m - b.m).map((m) => ({
    ...m, kort: MON[m.m], label: `${MONL[m.m]} ${m.y}`, totaal: Object.entries(m.per).filter(([k]) => k !== "OK" && k !== "OVERIG").reduce((x, [, y]) => x + y, 0),
    pctAanwezig: m.lessen ? Math.round(100 * (m.lessen - m.afwezig) / m.lessen) : 0,
  }));
  return { lessen, afwezig, ongeoorloofd, teLaat, ziek, pct, maanden, registraties, onbekend: [...onbekend], perType };
}

const ICON = {
  aanwezig: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`,
  rooster: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  logboek: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z"/><path d="M5 4v16M9 9h6M9 13h4"/></svg>`,
  taken: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="4"/></svg>`,
  terugkom: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/></svg>`,
  jarig: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M5 20v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 15c2 1.5 4 1.5 6 0s4-1.5 6 0M12 7v4M12 3v1"/></svg>`,
};
