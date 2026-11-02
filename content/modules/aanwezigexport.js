/* Aanwezigheid naar Excel.
 *
 * Per leerling (knop "Excel" op de tabbladen Inzicht en Vergelijken van de verzuimpagina):
 *   Samenvatting, per vak / docent / weekdag / lesuur / week / maand, alle lessen met hun
 *   registraties en de vergelijking met vorige schooljaren.
 *
 * Per klas (knop in de werkbalk boven de leerlinglijst van een les, of Acties in het zijpaneel):
 *   alle leerlingen van de les met hun aanwezigheid over een gekozen periode, een tabblad met het
 *   percentage per vak per leerling, en desgewenst het verschil met vorig schooljaar.
 *
 * De cijfers komen uit dezelfde berekening als het tabblad Inzicht (vzStats in verzuiminzicht.js):
 * afwezig = absent, ziek of uitgestuurd; te laat telt als aanwezig; vrijstelling telt niet mee.
 * Alles via je eigen Magister-sessie; er gaat niets naar buiten. */
DT.register({
  id: "aanwezigexport",
  init(DT) {
    /* Leerlingenoverzicht (frame /op-leerlingen/): knop boven de lijst voor de aangevinkte leerlingen */
    if (/\/op-leerlingen\//.test(location.pathname)) {
      this._stop = DT.observe(() => this.knopOverzicht(DT), { debounce: 400, poll: 1500 });
    }
  },
  destroy() { this._dlg?.remove(); this._stop && this._stop(); this._knop?.remove(); this._knop = null; },

  /* Selectie uit het leerlingenoverzicht opvragen (netlog.js houdt die bij in de pagina) */
  selectie() {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const h = (e) => { if (e.source === window && e.data?.type === "dt:llsel:result" && e.data.id === id) { window.removeEventListener("message", h); resolve(e.data); } };
      window.addEventListener("message", h);
      window.postMessage({ type: "dt:llsel:get", id }, "*");
      setTimeout(() => { window.removeEventListener("message", h); resolve({ lln: [], verwacht: 0 }); }, 3000);
    });
  },

  async knopOverzicht(DT) {
    const top = document.querySelector("ll-top-bar");
    if (!top) { this._knop?.remove(); this._knop = null; return; }
    if (!this._knop || !this._knop.isConnected) {
      const b = DT.el("button", { class: "dt-llx", type: "button", title: "Aanwezigheid van de aangevinkte leerlingen naar Excel" });
      b.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2.5v7.5M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Aanwezigheid naar Excel</span><small></small>`;
      b.addEventListener("click", async () => {
        const sel = await this.selectie();
        if (!sel.lln.length) return DT.toast("Vink eerst de leerlingen aan die je in het overzicht wilt hebben.", "info", 4000);
        if (sel.verwacht > sel.lln.length) DT.toast(`Van ${sel.verwacht - sel.lln.length} aangevinkte leerlingen zijn de gegevens nog niet geladen; scroll door de lijst of vink ze opnieuw aan.`, "info", 6000);
        this.klas(DT, { lln: sel.lln, titel: "Selectie uit het leerlingenoverzicht" });
      });
      this.cssOverzicht();
      top.prepend(b); this._knop = b;
    }
    const sel = await this.selectie();
    const n = sel.lln.length;
    this._knop.classList.toggle("is-leeg", !n);
    this._knop.querySelector("small").textContent = n ? `${n} geselecteerd` : "vink leerlingen aan";
  },

  cssOverzicht() {
    if (document.getElementById("dt-llx-style")) return;
    const st = document.createElement("style"); st.id = "dt-llx-style";
    st.textContent = `
      .dt-llx { appearance: none; display: inline-flex; align-items: center; gap: 6px; margin: .5rem 0 0; height: 32px; padding: 0 14px; border: 0; border-radius: 999px; cursor: pointer;
        background: #34C759; color: #fff; font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .dt-llx:hover { filter: brightness(.95); }
      .dt-llx small { font-weight: 500; opacity: .85; padding-left: 6px; border-left: 1px solid rgba(255,255,255,.45); }
      .dt-llx.is-leeg { background: rgba(120,120,128,.14); color: inherit; box-shadow: none; }
      .dt-llx.is-leeg small { border-left-color: rgba(120,120,128,.35); }
    `;
    document.head.append(st);
  },

  /* ---------- gedeeld ---------- */
  ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  sj(now = new Date()) { return new Date(now.getFullYear() - (now.getMonth() < 7 ? 1 : 0), 7, 1); },
  naam(p) { return [p?.roepnaam || p?.voornaam, p?.tussenvoegsel, p?.achternaam].filter(Boolean).join(" ") || p?.volledigeNaam || p?.naam || ""; },
  bestandsnaam(s) { return String(s).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120); },
  dag(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  pct(n) { return n == null || isNaN(n) ? "" : { t: "n", v: n / 100, z: "0%" }; },

  /* Cijferrij voor een groep uit vzStats: lessen (tellen mee), aanwezig, gemist, ongeoorloofd, ziek, te laat, vrijgesteld, % */
  cijfers(g) {
    if (!g) return ["", "", "", "", "", "", "", ""];
    return [g.telt, g.telt - g.afwezig, g.afwezig, g.ongeoorloofd, g.ziek, g.teLaat, g.vrij, g.telt > 0 ? this.pct(g.pct) : ""];
  },
  KOP: ["Lessen", "Aanwezig", "Gemist", "Ongeoorloofd", "Ziek", "Te laat", "Vrijgesteld", "Aanwezig %"],

  blad(rows, breedtes, { filter = true } = {}) {
    const ws = XLSX.utils.aoa_to_sheet(rows, { dateNF: "dd-mm-yyyy" });
    ws["!cols"] = breedtes.map((w) => ({ wch: w }));
    if (filter && rows.length > 1) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
    return ws;
  },
  schrijf(DT, naam, bladen) {
    if (typeof XLSX === "undefined") return DT.toast("Excel-bibliotheek niet geladen", "err");
    const wb = XLSX.utils.book_new();
    for (const [titel, ws] of bladen) XLSX.utils.book_append_sheet(wb, ws, titel.slice(0, 31));
    XLSX.writeFile(wb, `${this.bestandsnaam(naam)}.xlsx`);
    DT.toast("Excel-bestand gedownload", "ok");
  },
  toelichting(extra = []) {
    return [["Toelichting"], [""],
      ["Bron", "Registraties en rooster uit Magister, opgehaald met je eigen sessie."],
      ["Afwezig (gemist)", "Absent, ziek of uitgestuurd."],
      ["Te laat", "Telt als aanwezig, maar wordt apart geteld."],
      ["Vrijgesteld", "Met toestemming; telt niet mee in het percentage."],
      ["Lessen", "Lessen die meetellen: alle lessen in het rooster min de vrijgestelde lessen."],
      ["Aanwezig %", "(Lessen − gemist) / lessen."],
      ...extra,
      ["Gemaakt op", new Date().toLocaleString("nl-NL")], ["Gemaakt met", `Docent Tools voor Magister ${DT.version || ""}`]];
  },

  /* ---------- per leerling ---------- */
  leerlingBestand(DT, { persoon, id, periode, S, vergelijk }) {
    const naam = this.naam(persoon) || `Leerling ${id}`;
    const stam = persoon?.stamnummer ?? "", klas = persoon?.stamklas?.code ?? persoon?.stamklas ?? "";
    const T = S.totaal;
    const sam = [
      ["Leerling", naam], ["Stamnummer", stam], ["Klas", klas], ["Periode", periode.naam],
      ["Van", this.dag(periode.van)], ["Tot en met", this.dag(periode.tot)], [""],
      ["", ...this.KOP], ["Totaal", ...this.cijfers(T)],
    ];
    const groep = (titel, lijst) => [[titel, ...this.KOP], ...lijst.map((g) => [g.sub ? `${g.label} (${g.sub})` : g.label, ...this.cijfers(g)])];
    const bladen = [
      ["Samenvatting", this.blad(sam, [16, 26, 10, 10, 12, 10, 8, 10, 12], { filter: false })],
      ["Per vak", this.blad(groep("Vak", S.vakken), [34, 8, 10, 8, 13, 7, 8, 12, 12])],
    ];
    if (S.docenten.length) bladen.push(["Per docent", this.blad(groep("Docent", S.docenten), [30, 8, 10, 8, 13, 7, 8, 12, 12])]);
    bladen.push(["Per weekdag", this.blad(groep("Weekdag", S.dagen), [14, 8, 10, 8, 13, 7, 8, 12, 12])]);
    bladen.push(["Per lesuur", this.blad(groep("Begintijd", S.uren), [12, 8, 10, 8, 13, 7, 8, 12, 12])]);
    bladen.push(["Per week", this.blad([["Jaar", "Week", ...this.KOP], ...S.weken.map((w) => [w.y, w.week, ...this.cijfers(w)])], [8, 7, 8, 10, 8, 13, 7, 8, 12, 12])]);
    bladen.push(["Per maand", this.blad([["Jaar", "Maand", ...this.KOP], ...S.maanden.map((m) => [m.y, m.label, ...this.cijfers(m)])], [8, 8, 8, 10, 8, 13, 7, 8, 12, 12])]);
    const CAT = { OK: "aanwezig", TL: "te laat", ZK: "ziek", AB_OK: "absent, geoorloofd", AB_NO: "absent, ongeoorloofd", UI: "uitgestuurd", VR: "vrijgesteld" };
    const tijd = (d) => d && !isNaN(d) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
    bladen.push(["Lessen", this.blad([["Datum", "Begin", "Einde", "Vak", "Docent", "Telt als", "Registraties"],
      ...(S.lessen || []).map((l) => [new Date(l.begin.getFullYear(), l.begin.getMonth(), l.begin.getDate()), tijd(l.begin), tijd(l.einde), l.vak, l.docent || "", CAT[l.cat] || l.cat, l.regs || ""])], [11, 7, 7, 30, 26, 20, 40])]);
    if (vergelijk && vergelijk.length) {
      const dk = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
      bladen.push(["Vergelijking", this.blad([["Schooljaar", `Aanwezig % t/m ${dk}`, "Aanwezig % hele jaar", `Gemist t/m ${dk}`, "Ziek", "Ongeoorloofd", "Te laat", "Lessen"],
        ...vergelijk.map((r) => r.leeg ? [r.naam, "geen gegevens"] : [r.naam, r.rooster && r.zelfde.telt ? this.pct(r.zelfde.pct) : "", r.heel && r.rooster && r.heel.telt ? this.pct(r.heel.pct) : (r.heel ? "" : "loopt nog"), r.zelfde.afwezig, r.zelfde.ziek, r.zelfde.ongeoorloofd, r.zelfde.teLaat, r.zelfde.telt])],
        [14, 20, 20, 16, 7, 13, 8, 8], { filter: false })]);
    }
    bladen.push(["Toelichting", this.blad(this.toelichting([["Vergelijking", "Elk schooljaar telt van 1 augustus tot dezelfde datum als vandaag; 'hele jaar' t/m 31 juli."]]), [18, 80], { filter: false })]);
    this.schrijf(DT, `Aanwezigheid ${naam} ${periode.naam}`, bladen);
  },

  /* ---------- per klas ---------- */
  periodeKeuzes(DT, now = new Date()) {
    const sj = this.sj(now), y = sj.getFullYear();
    const out = [
      { key: "jaar", naam: `Dit schooljaar (${y}–${y + 1})`, van: sj, tot: now },
      { key: "vorig", naam: `Vorig schooljaar (${y - 1}–${y})`, van: new Date(y - 1, 7, 1), tot: new Date(y, 6, 31, 23, 59, 59) },
      { key: "8w", naam: "Laatste 8 weken", van: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 56), tot: now },
      { key: "4w", naam: "Laatste 4 weken", van: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28), tot: now },
    ];
    for (const p of DT.periodes?.() || []) out.push({ key: "p:" + p.id, naam: `${p.naam} (${DT.periodeLabel(p, true)})`, kort: p.naam, van: p.begin, tot: p.einde < now ? p.einde : now });
    return out;
  },

  async klasLeerlingen(DT) {
    const url = await DT.apiFind("/deelnemers\\?type=leerling") || await DT.apiFind("/deelnemers\\?.*type=leerling");
    if (!url) return { fout: "Open eerst de leerlinglijst van een les; daar staan de leerlingen van de klas." };
    const r = await DT.api(url, { full: true, timeout: 15000 });
    const items = r.status === 200 && r.json ? (Array.isArray(r.json) ? r.json : r.json.items || r.json.Items || []) : null;
    if (!items) return { fout: `De leerlingen ophalen lukte niet (Magister antwoordde ${r.status}).` };
    const lln = items.map((x) => ({ id: x.id ?? x.leerlingId ?? x.persoonId ?? x.persoon?.id, naam: this.naam(x.persoon || x), achternaam: (x.persoon || x).achternaam || "", stam: x.stamnummer ?? x.persoon?.stamnummer ?? "", klas: x.stamklas?.code ?? x.stamklas ?? "" }))
      .filter((x) => x.id != null).sort((a, b) => a.achternaam.localeCompare(b.achternaam, "nl") || a.naam.localeCompare(b.naam, "nl"));
    const titel = document.querySelector(".head-bar h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
    return { lln, titel };
  },

  /* Venster: periode kiezen, eventueel vergelijken met vorig jaar, daarna voortgang. */
  async klas(DT, bron = null) {
    if (this._dlg) return;
    const res = bron || await this.klasLeerlingen(DT);
    if (res.fout) return DT.toast(res.fout, "err", 5000);
    const keuzes = this.periodeKeuzes(DT);
    const dlg = DT.el("div", { class: "dt-xk", role: "dialog", "aria-modal": "true", "aria-label": "Aanwezigheid klas naar Excel" });
    const sel = DT.el("select", { class: "dt-input" }, keuzes.map((k) => DT.el("option", { value: k.key, text: k.naam })));
    const nu = (DT.periodes?.() || []).find((p) => new Date() >= p.begin && new Date() <= p.einde);
    if (nu) sel.value = "p:" + nu.id;
    const vgl = DT.el("input", { type: "checkbox", id: "dt-xk-vgl" });
    const status = DT.el("div", { class: "dt-xk-status", "aria-live": "polite" });
    const balk = DT.el("div", { class: "dt-xk-bar" }, DT.el("i"));
    const start = DT.el("button", { class: "dt-btn dt-btn-primary", text: "Exporteren" });
    const stop = DT.el("button", { class: "dt-btn", text: "Annuleren" });
    let afbreken = false, bezig = false;
    const sluit = () => { afbreken = true; dlg.remove(); this._dlg = null; document.removeEventListener("keydown", esc, true); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); sluit(); } };
    stop.addEventListener("click", sluit);
    dlg.addEventListener("click", (e) => { if (e.target === dlg && !bezig) sluit(); });
    document.addEventListener("keydown", esc, true);
    start.addEventListener("click", async () => {
      if (bezig) return; bezig = true; start.disabled = true; sel.disabled = true; vgl.disabled = true;
      const k = keuzes.find((x) => x.key === sel.value);
      try {
        await this.klasBestand(DT, res, k, vgl.checked, (i, n, wie) => {
          if (afbreken) throw new Error("afgebroken");
          balk.firstChild.style.width = `${Math.round(100 * i / n)}%`;
          status.textContent = i < n ? `Leerling ${i + 1} van ${n}: ${wie}` : "Excel-bestand maken…";
        });
        sluit();
      } catch (e) {
        if (String(e.message) !== "afgebroken") { status.textContent = `Er ging iets mis: ${e.message || e}`; bezig = false; start.disabled = false; sel.disabled = false; vgl.disabled = false; }
      }
    });
    dlg.append(DT.el("div", { class: "dt-xk-card" }, [
      DT.el("h2", { text: bron ? "Aanwezigheid naar Excel" : "Aanwezigheid klas naar Excel" }),
      DT.el("p", { class: "dt-xk-sub", text: `${res.lln.length} leerlingen${res.titel ? ` · ${res.titel}` : ""}` }),
      DT.el("label", { class: "dt-xk-field" }, [DT.el("span", { text: "Periode" }), sel]),
      DT.el("label", { class: "dt-xk-check", for: "dt-xk-vgl" }, [vgl, DT.el("span", { text: "Ook vergelijken met vorig schooljaar (tot dezelfde datum)" })]),
      DT.el("p", { class: "dt-xk-hint", text: "Per leerling worden de registraties en het rooster opgehaald; dat duurt ongeveer een seconde per leerling." }),
      balk, status,
      DT.el("div", { class: "dt-row dt-xk-knoppen" }, [stop, start])
    ]));
    document.body.append(dlg); this._dlg = dlg; sel.focus();
  },

  async klasBestand(DT, { lln, titel }, periode, vergelijk, voortgang) {
    const now = new Date();
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    const haal = async (id, van, tot) => {
      const [v, a] = await Promise.all([
        DT.api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${this.ymd(van)}&einde=${this.ymd(tot)}`, { full: true, timeout: 25000 }),
        DT.api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${this.ymd(van)}&einde=${this.ymd(tot)}`, { full: true, timeout: 25000 }),
      ]);
      return { regs: lijst(v), rooster: lijst(a), status: v.status !== 200 ? v.status : a.status };
    };
    const uit = [];
    let i = 0;
    const werk = lln.slice();
    const doe = async () => {
      while (werk.length) {
        const l = werk.shift(); voortgang(i, lln.length, l.naam);
        const d = await haal(l.id, periode.van, periode.tot);
        const S = d.regs && d.rooster ? vzStats(d.regs, d.rooster, periode.van, periode.tot) : null;
        let V = null;
        if (vergelijk) {
          const sjNu = this.sj(now), vVan = new Date(sjNu.getFullYear() - 1, 7, 1), vTot = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59);
          const nuS = periode.key === "jaar" ? S : (await (async () => { const x = await haal(l.id, sjNu, now); return x.regs && x.rooster ? vzStats(x.regs, x.rooster, sjNu, now) : null; })());
          const v = await haal(l.id, vVan, vTot);
          const vS = v.regs && v.rooster && v.rooster.length ? vzStats(v.regs, v.rooster, vVan, vTot) : null;
          V = { nu: nuS?.totaal, vorig: vS?.totaal };
        }
        uit.push({ l, S, V, status: d.status });
        i++; voortgang(i, lln.length, l.naam);
      }
    };
    await Promise.all([doe(), doe(), doe()]);
    uit.sort((a, b) => lln.indexOf(a.l) - lln.indexOf(b.l));

    /* Blad 1: per leerling */
    const kop = ["Leerling", "Stamnummer", "Klas", ...this.KOP, ...(vergelijk ? ["Dit jaar % t/m vandaag", "Vorig jaar % t/m zelfde datum", "Verschil (procentpunt)"] : [])];
    const rijen = uit.map(({ l, S, V, status }) => {
      const basis = [l.naam, l.stam, l.klas, ...(S ? this.cijfers(S.totaal) : [`niet op te halen (${status})`, "", "", "", "", "", "", ""])];
      if (!vergelijk) return basis;
      const a = V?.nu && V.nu.telt ? V.nu.pct : null, b = V?.vorig && V.vorig.telt ? V.vorig.pct : null;
      return [...basis, a == null ? "" : this.pct(a), b == null ? "geen gegevens" : this.pct(b), a != null && b != null ? a - b : ""];
    });
    const ok = uit.filter((x) => x.S && x.S.totaal.telt > 0).map((x) => x.S.totaal);
    const som = (k) => ok.reduce((s, t) => s + t[k], 0);
    const telt = som("telt"), afw = som("afwezig");
    const totaal = [titel && /^Selectie/.test(titel) ? "Totaal selectie" : "Klas totaal", "", "", telt, telt - afw, afw, som("ongeoorloofd"), som("ziek"), som("teLaat"), som("vrij"), telt ? this.pct(Math.round(100 * (telt - afw) / telt)) : ""];
    const gem = ok.length ? Math.round(ok.reduce((s, t) => s + t.pct, 0) / ok.length) : null;
    const blad1 = this.blad([kop, ...rijen, [], totaal, ["Gemiddelde per leerling", "", "", "", "", "", "", "", "", "", gem == null ? "" : this.pct(gem)]],
      [28, 11, 9, 8, 10, 8, 13, 7, 8, 12, 12, ...(vergelijk ? [20, 26, 20] : [])]);
    blad1["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rijen.length, c: kop.length - 1 } }) };

    /* Blad 2: aanwezig % per vak per leerling */
    const vakken = [...new Set(uit.flatMap((x) => (x.S?.vakken || []).filter((g) => g.telt > 0).map((g) => g.label)))].sort((a, b) => a.localeCompare(b, "nl"));
    const blad2 = this.blad([["Leerling", ...vakken], ...uit.map(({ l, S }) => [l.naam, ...vakken.map((v) => { const g = S?.vakken.find((x) => x.label === v); return g && g.telt > 0 ? this.pct(g.pct) : ""; })])],
      [28, ...vakken.map((v) => Math.max(9, Math.min(24, v.length + 2)))]);

    /* Blad 3: ziek en ongeoorloofd per vak (aantallen) */
    const blad3 = this.blad([["Leerling", ...vakken.flatMap((v) => [`${v}: gemist`, `${v}: ziek`])], ...uit.map(({ l, S }) => [l.naam, ...vakken.flatMap((v) => { const g = S?.vakken.find((x) => x.label === v); return g ? [g.afwezig, g.ziek] : ["", ""]; })])],
      [28, ...vakken.flatMap(() => [12, 10])]);

    const per = periode.kort || periode.naam.replace(/[()]/g, "");
    const naamBestand = titel && /^Selectie/.test(titel) ? `Aanwezigheid ${lln.length} leerlingen ${per}` : `Aanwezigheid klas ${titel ? titel.replace(/^\S+\s+\S+\s+\S+\s+/, "") + " " : ""}${per}`;
    this.schrijf(DT, naamBestand, [
      ["Per leerling", blad1],
      ["Aanwezig per vak", blad2],
      ["Gemist en ziek per vak", blad3],
      ["Toelichting", this.blad(this.toelichting([["Klas", titel || ""], ["Periode", periode.naam], ["Van", periode.van.toLocaleDateString("nl-NL")], ["Tot en met", periode.tot.toLocaleDateString("nl-NL")], ["Gemiddelde per leerling", "Gemiddelde van de percentages; 'Klas totaal' telt alle lessen bij elkaar op."], ...(vergelijk ? [["Verschil", "Dit schooljaar tot vandaag min vorig schooljaar tot dezelfde datum, in procentpunten."]] : [])]), [24, 80], { filter: false })],
    ]);
  },
});
