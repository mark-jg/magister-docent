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

  /* Aangevinkte rijen die niet aan een bewaard zoekresultaat te koppelen zijn, opzoeken via
   * Magisters zoek-API (op stamnummer, anders op naam). */
  async aanvullen(DT, sel) {
    const lln = [...(sel.lln || [])], ids = new Set(lln.map((x) => x.id));
    const peil = this.ymd(new Date());
    for (const r of sel.los || []) {
      const q = r.code || r.naam; if (!q) continue;
      const res = await DT.api(`/api/leerlingen/zoeken?q=${encodeURIComponent(q)}&top=10&skip=0&peildatum=${peil}`, { full: true, timeout: 10000 });
      const items = res.status === 200 && res.json ? (res.json.items || []) : [];
      const x = items.find((i) => r.code && String(i.code ?? i.stamnummer) === r.code) || (items.length === 1 ? items[0] : null);
      if (x && !ids.has(x.id)) { ids.add(x.id); lln.push({ id: x.id, naam: this.naam(x), achternaam: x.achternaam || "", stam: x.code ?? x.stamnummer ?? "", klas: Array.isArray(x.klassen) ? x.klassen.join(", ") : (x.klassen || "") }); }
    }
    return lln.sort((a, b) => a.achternaam.localeCompare(b.achternaam, "nl") || a.naam.localeCompare(b.naam, "nl"));
  },

  async knopOverzicht(DT) {
    const top = document.querySelector("ll-top-bar");
    if (!top) { this._knop?.remove(); this._knop = null; return; }
    if (!this._knop || !this._knop.isConnected) {
      const b = DT.el("button", { class: "dt-llx", type: "button", title: "Aanwezigheid van de aangevinkte leerlingen naar Excel" });
      b.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2.5v7.5M4.5 6.8 8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Aanwezigheid naar Excel</span><small></small>`;
      b.addEventListener("click", async () => {
        const sel = await this.selectie();
        const lln = await this.aanvullen(DT, sel);
        if (!lln.length) {
          console.info("[Docent Tools] selectie leerlingenoverzicht", sel);
          return DT.toast(sel.zichtbaarAan
            ? `Er zijn ${sel.zichtbaarAan} leerlingen aangevinkt, maar ze konden niet worden opgezocht (zoekresultaten gezien: ${sel.geladen}). Meld dit met een paginarapport van deze lijst (Alt+I, R).`
            : `Vink eerst de leerlingen aan die je in het overzicht wilt hebben. (Zichtbare rijen: ${sel.zichtbaar}, zoekresultaten gezien: ${sel.geladen}.)`, sel.zichtbaarAan ? "err" : "info", 7000);
        }
        if (sel.verwacht > lln.length) DT.toast(`Van ${sel.verwacht - lln.length} aangevinkte leerlingen zijn de gegevens nog niet geladen; scroll door de lijst of vink ze opnieuw aan.`, "info", 6000);
        this.klas(DT, { lln, titel: "Selectie uit het leerlingenoverzicht" });
      });
      this.cssOverzicht();
      top.prepend(b); this._knop = b;
    }
    const sel = await this.selectie();
    const n = Math.max(sel.lln.length + (sel.los || []).length, sel.zichtbaarAan || 0, sel.alles ? sel.verwacht : 0);
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
    if (!g) return ["", "", "", "", "", "", "", "", "", "", ""];
    const p = g.per || {};
    return [g.lessen, g.telt, g.telt - g.afwezig, g.teLaat, g.afwezig, p.ZK || 0, p.AB_OK || 0, p.AB_NO || 0, p.UI || 0, g.vrij, g.telt > 0 ? this.pct(g.pct) : ""];
  },
  /* Kolommen die optellen: lessen in rooster = tellen mee + vrijgesteld; tellen mee = aanwezig + gemist;
   * gemist = ziek + absent geoorloofd + absent ongeoorloofd + uitgestuurd; te laat is een deel van aanwezig. */
  KB: [10, 11, 9, 9, 8, 7, 10, 11, 10, 10, 11], // kolombreedtes bij KOP
  KOP: ["Lessen in rooster", "Lessen (tellen mee)", "Aanwezig", "waarvan te laat", "Gemist", "Ziek", "Absent geoorloofd", "Absent ongeoorloofd", "Uitgestuurd", "Vrijgesteld", "Aanwezig %"],

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
      ["Gemist", "Ziek + absent geoorloofd + absent ongeoorloofd + uitgestuurd (tellen precies op)."],
      ["waarvan te laat", "Te laat telt als aanwezig; deze kolom is een deel van Aanwezig."],
      ["Optellen", "Lessen in rooster = lessen (tellen mee) + vrijgesteld; lessen (tellen mee) = aanwezig + gemist."],
      ["Onbekend (niet in rooster)", "Een registratie bij een les die niet (meer) in het rooster van de leerling staat en ook los niet op te halen was."],
      ["Vrijgesteld", "Met toestemming; telt niet mee in het percentage."],
      ["Lessen in rooster", "Alle lessen in het rooster van de leerling in de periode (afspraken met onderwijstijd), inclusief vrijgestelde lessen."],
      ["Lessen (tellen mee)", "Lessen die meetellen: alle lessen in het rooster (afspraken met onderwijstijd, zoals Magister ze voor verantwoorden gebruikt) min de vrijgestelde lessen. Persoonlijke afspraken, gesprekken en activiteiten tellen niet mee."],
      ["Verschil tussen leerlingen", "Ook binnen één klas kan het aantal lessen verschillen: vrijstellingen, keuzedelen of andere lesgroepen, stage/BPV en later instromen."],
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
      ["Samenvatting", this.blad(sam, [16, 26, ...this.KB.slice(1)], { filter: false })],
      ["Per vak", this.blad(groep("Vak", S.vakken), [34, ...this.KB])],
    ];
    if (S.docenten.length) bladen.push(["Per docent", this.blad(groep("Docent", S.docenten), [30, ...this.KB])]);
    bladen.push(["Per weekdag", this.blad(groep("Weekdag", S.dagen), [14, ...this.KB])]);
    bladen.push(["Per lesuur", this.blad(groep("Begintijd", S.uren), [12, ...this.KB])]);
    bladen.push(["Per week", this.blad([["Jaar", "Week", ...this.KOP], ...S.weken.map((w) => [w.y, w.week, ...this.cijfers(w)])], [8, 7, ...this.KB])]);
    bladen.push(["Per maand", this.blad([["Jaar", "Maand", ...this.KOP], ...S.maanden.map((m) => [m.y, m.label, ...this.cijfers(m)])], [8, 8, ...this.KB])]);
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

  /* ================= Bespreeklijst voor het teamoverleg =================
   * Klas kiezen (uit Magister), periode en norm; per student aanwezigheid (%, gemist, ziek, ongeoorloofd, te
   * laat) en de plannen van aanpak uit deze browser (open plan, eerstvolgende of verlopen evaluatie). Gesorteerd
   * op aanwezigheid, onder de norm gemarkeerd; naar Excel te exporteren. */
  async bespreeklijst(DT) {
    if (this._dlg) return;
    const peil = this.ymd(new Date());
    let r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&peildatum=${peil}`, { full: true, timeout: 12000 });
    let klassen = r.status === 200 ? (r.json?.klassen || []) : [];
    if (!klassen.length) { r = await DT.api(`/api/leerlingen/zoeken/filters?q=**&rol=Docent&peildatum=${peil}`, { full: true, timeout: 12000 }); klassen = r.status === 200 ? (r.json?.klassen || []) : []; }
    if (!klassen.length) return DT.toast("Geen klassen gevonden in Magister.", "err", 5000);
    klassen.sort((a, b) => String(a.naam).localeCompare(String(b.naam), "nl", { numeric: true }));
    const keuzes = this.periodeKeuzes(DT).filter((k) => k.key !== "vorig");
    const dlg = DT.el("div", { class: "dt-xk", role: "dialog", "aria-modal": "true", "aria-label": "Bespreeklijst" });
    const klasSel = DT.el("select", { class: "dt-input" }, klassen.map((k) => DT.el("option", { value: k.naam, text: `${k.naam}${k.aantal ? ` (${k.aantal})` : ""}` })));
    try { const v = localStorage.getItem("dt-bespreek-klas"); if (v && klassen.some((k) => k.naam === v)) klasSel.value = v; } catch {}
    const perSel = DT.el("select", { class: "dt-input" }, keuzes.map((k) => DT.el("option", { value: k.key, text: k.naam })));
    const nu = (DT.periodes?.() || []).find((p) => new Date() >= p.begin && new Date() <= p.einde); if (nu) perSel.value = "p:" + nu.id;
    const norm = DT.el("input", { type: "number", class: "dt-input", value: "80", min: "0", max: "100", style: "width:80px" });
    const status = DT.el("div", { class: "dt-xk-status", "aria-live": "polite" });
    const balk = DT.el("div", { class: "dt-xk-bar" }, DT.el("i"));
    const uitkomst = DT.el("div", { class: "dt-bl-uit" });
    const start = DT.el("button", { class: "dt-btn dt-btn-primary", text: "Lijst maken" });
    const excel = DT.el("button", { class: "dt-btn", text: "Naar Excel", disabled: "" });
    const stop = DT.el("button", { class: "dt-btn", text: "Sluiten" });
    let afbreken = false, bezig = false, data = null;
    const sluit = () => { afbreken = true; dlg.remove(); this._dlg = null; document.removeEventListener("keydown", esc, true); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); sluit(); } };
    stop.addEventListener("click", sluit);
    document.addEventListener("keydown", esc, true);
    const lijst = (x) => (x && x.status === 200 && x.json) ? (Array.isArray(x.json) ? x.json : x.json.items || []) : null;
    const wacht = (ms) => new Promise((res) => setTimeout(res, ms));
    const api = async (url) => { let x; for (let i = 0; i < 6; i++) { x = await DT.api(url, { full: true, timeout: 25000 }); if (x.status !== 429 && x.status !== 503) return x; await wacht(1500 * 2 ** i); } return x; };
    start.addEventListener("click", async () => {
      if (bezig) return; bezig = true; start.disabled = true; excel.disabled = true; uitkomst.replaceChildren();
      try { localStorage.setItem("dt-bespreek-klas", klasSel.value); } catch {}
      const per = keuzes.find((k) => k.key === perSel.value), n = Math.max(0, Math.min(100, +norm.value || 80));
      try {
        status.textContent = "Klas ophalen…";
        const z = await api(`/api/leerlingen/zoeken?q=**&top=300&skip=0&peildatum=${peil}&klassen=${encodeURIComponent(klasSel.value)}&velden=stamnummer&velden=naam`);
        const lln = (lijst(z) || []).map((x) => ({ id: x.id, naam: this.naam(x), achternaam: x.achternaam || "", stam: String(x.code ?? x.stamnummer ?? "") }))
          .sort((a, b) => a.achternaam.localeCompare(b.achternaam, "nl"));
        const opslag = await chrome.storage.local.get(null);
        const rijen = [], werk = lln.slice(); let klaar = 0;
        const doe = async () => {
          while (werk.length && !afbreken) {
            const l = werk.shift();
            const v = await api(`/api/m6/leerlingen/${l.id}/verantwoordingen?begin=${this.ymd(per.van)}&einde=${this.ymd(per.tot)}`); await wacht(120);
            const a = await api(`/api/leerlingen/${l.id}/afspraken?status=actief&begin=${this.ymd(per.van)}&einde=${this.ymd(per.tot)}`); await wacht(120);
            const regs = lijst(v), rooster = lijst(a), T = regs && rooster ? vzStats(regs, rooster, per.van, per.tot).totaal : null;
            const plannen = Array.isArray(opslag[`pva:${l.id}`]) ? opslag[`pva:${l.id}`] : [];
            const open = plannen.map((p) => ({ p, e: (p.evaluaties || []).find((x) => x.datum && !x.op && !x.doelen) })).filter((x) => x.e).sort((x, y) => x.e.datum.localeCompare(y.e.datum))[0];
            rijen.push({ l, T, plannen: plannen.length, open });
            klaar++; balk.firstChild.style.width = `${Math.round(100 * klaar / lln.length)}%`; status.textContent = `Student ${klaar} van ${lln.length}`;
          }
        };
        await Promise.all([doe(), doe()]);
        if (afbreken) return;
        rijen.sort((x, y) => (x.T?.telt ? x.T.pct : 101) - (y.T?.telt ? y.T.pct : 101));
        data = { rijen, per, n, klas: klasSel.value };
        const onder = rijen.filter((x) => x.T?.telt && x.T.pct < n).length, laat = rijen.filter((x) => x.open && x.open.e.datum < peil).length;
        status.textContent = `${rijen.length} studenten · ${onder} onder ${n}% · ${laat} evaluatie${laat === 1 ? "" : "s"} verlopen`;
        const td = (t, c = "") => DT.el("td", { class: c, text: t == null ? "" : String(t) });
        uitkomst.replaceChildren(DT.el("table", { class: "dt-bl-tabel" }, [
          DT.el("thead", {}, DT.el("tr", {}, ["Student", "Aanwezig", "Lessen", "Gemist", "Ziek", "Ongeoorl.", "Te laat", "Plan van aanpak"].map((t) => DT.el("th", { text: t })))),
          DT.el("tbody", {}, rijen.map(({ l, T, open, plannen }) => DT.el("tr", { class: T?.telt && T.pct < n ? (T.pct < n - 10 ? "is-rood" : "is-oranje") : "" }, [
            td(l.naam), td(T?.telt ? `${T.pct}%` : "—", "getal"), td(T?.telt ?? "", "getal"), td(T?.afwezig ?? "", "getal"), td(T?.ziek ?? "", "getal"), td(T?.ongeoorloofd ?? "", "getal"), td(T?.teLaat ?? "", "getal"),
            td(open ? `evaluatie ${open.e.datum < peil ? "verlopen" : ""} ${open.e.datum.split("-").reverse().join("-")}`.replace("  ", " ") : plannen ? `${plannen} plan${plannen === 1 ? "" : "nen"}, afgerond` : "", open && open.e.datum < peil ? "is-laat" : ""),
          ]))),
        ]), DT.el("p", { class: "dt-xk-hint", text: `Oranje: onder ${n}%. Rood: meer dan 10 procentpunt onder de norm. Plannen van aanpak komen uit deze browser.` }));
        excel.disabled = false;
      } catch (e) { status.textContent = `Er ging iets mis: ${e.message || e}`; }
      bezig = false; start.disabled = false;
    });
    excel.addEventListener("click", () => {
      if (!data) return;
      const kop = ["Student", "Stamnummer", "Aanwezig %", "Lessen (tellen mee)", "Gemist", "Ziek", "Ongeoorloofd", "Te laat", "Onder norm", "Plannen van aanpak", "Eerstvolgende evaluatie"];
      const rijen = data.rijen.map(({ l, T, open, plannen }) => [l.naam, l.stam, T?.telt ? this.pct(T.pct) : "", T?.telt ?? "", T?.afwezig ?? "", T?.ziek ?? "", T?.ongeoorloofd ?? "", T?.teLaat ?? "",
        T?.telt && T.pct < data.n ? "ja" : "", plannen || "", open ? open.e.datum.split("-").reverse().join("-") : ""]);
      this.schrijf(DT, `Bespreeklijst ${data.klas} ${data.per.kort || data.per.naam}`, [["Bespreeklijst", this.blad([kop, ...rijen], [28, 11, 11, 12, 9, 8, 12, 8, 11, 12, 16])]]);
    });
    dlg.append(DT.el("div", { class: "dt-xk-card dt-bl-card" }, [
      DT.el("h2", { text: "Bespreeklijst voor het teamoverleg" }),
      DT.el("p", { class: "dt-xk-sub", text: "Per student de aanwezigheid en de plannen van aanpak, gesorteerd van laag naar hoog." }),
      DT.el("div", { class: "dt-row dt-bl-keuze" }, [
        DT.el("label", { class: "dt-xk-field" }, [DT.el("span", { text: "Klas" }), klasSel]),
        DT.el("label", { class: "dt-xk-field" }, [DT.el("span", { text: "Periode" }), perSel]),
        DT.el("label", { class: "dt-xk-field" }, [DT.el("span", { text: "Norm %" }), norm]),
      ]),
      balk, status, uitkomst,
      DT.el("div", { class: "dt-row dt-xk-knoppen" }, [stop, excel, start]),
    ]));
    document.body.append(dlg); this._dlg = dlg; this.cssBespreek(); klasSel.focus();
  },
  cssBespreek() {
    if (document.getElementById("dt-bl-style")) return;
    const st = document.createElement("style"); st.id = "dt-bl-style";
    st.textContent = `.dt-bl-card { width: min(980px, calc(100vw - 32px)) !important; max-height: calc(100vh - 48px); overflow: auto; }
      .dt-bl-keuze { flex-wrap: wrap; gap: 12px; align-items: flex-end; }
      .dt-bl-tabel { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
      .dt-bl-tabel th { text-align: left; font-size: 12px; color: #59636e; padding: 6px 8px; border-bottom: 1px solid #c8d1da; position: sticky; top: 0; background: inherit; }
      .dt-bl-tabel td { padding: 5px 8px; border-bottom: 1px solid rgba(128,128,128,.15); } .dt-bl-tabel td.getal { text-align: right; font-variant-numeric: tabular-nums; }
      .dt-bl-tabel tr.is-oranje td:nth-child(2) { color: #ac5000; font-weight: 700; } .dt-bl-tabel tr.is-rood td:nth-child(2) { color: #c70e13; font-weight: 700; }
      .dt-bl-tabel td.is-laat { color: #c70e13; font-weight: 600; }`;
    document.head.append(st);
  },

  async klasBestand(DT, { lln, titel }, periode, vergelijk, voortgang) {
    const now = new Date();
    const lijst = (r) => (r && r.status === 200 && r.json) ? (Array.isArray(r.json) ? r.json : r.json.items || []) : null;
    /* Magister begrenst het aantal aanvragen (429 = te veel tegelijk). Daarom na elkaar, met een
     * korte pauze, en bij 429/503 wachten en opnieuw proberen (steeds langer). */
    const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
    const api = async (url) => {
      let r;
      for (let poging = 0; poging < 6; poging++) {
        r = await DT.api(url, { full: true, timeout: 25000 });
        if (r.status !== 429 && r.status !== 503) return r;
        voortgang(i, lln.length, `even wachten, Magister vraagt om rustiger aan te doen…`);
        await wacht(1500 * 2 ** poging);
      }
      return r;
    };
    const haal = async (id, van, tot) => {
      const v = await api(`/api/m6/leerlingen/${id}/verantwoordingen?begin=${this.ymd(van)}&einde=${this.ymd(tot)}`);
      await wacht(150);
      const a = await api(`/api/leerlingen/${id}/afspraken?status=actief&begin=${this.ymd(van)}&einde=${this.ymd(tot)}`);
      await wacht(150);
      const regs = lijst(v), rooster = lijst(a);
      if (regs && rooster) rooster.push(...await vzLosseLessen(id, regs, rooster, api));
      return { regs, rooster, status: v.status !== 200 ? v.status : a.status };
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
    await Promise.all([doe(), doe()]);
    uit.sort((a, b) => lln.indexOf(a.l) - lln.indexOf(b.l));

    /* Blad 1: per leerling */
    const kop = ["Leerling", "Stamnummer", "Klas", ...this.KOP, ...(vergelijk ? ["Dit jaar % t/m vandaag", "Vorig jaar % t/m zelfde datum", "Verschil (procentpunt)"] : [])];
    const rijen = uit.map(({ l, S, V, status }) => {
      const basis = [l.naam, l.stam, l.klas, ...(S ? this.cijfers(S.totaal) : [`niet op te halen (${status === 429 ? "Magister: te veel aanvragen" : status})`, ...Array(this.KOP.length - 1).fill("")])];
      if (!vergelijk) return basis;
      const a = V?.nu && V.nu.telt ? V.nu.pct : null, b = V?.vorig && V.vorig.telt ? V.vorig.pct : null;
      return [...basis, a == null ? "" : this.pct(a), b == null ? "geen gegevens" : this.pct(b), a != null && b != null ? a - b : ""];
    });
    const ok = uit.filter((x) => x.S && x.S.totaal.telt > 0).map((x) => x.S.totaal);
    const som = (k) => ok.reduce((s, t) => s + t[k], 0);
    const telt = som("telt"), afw = som("afwezig");
    const perT = (k) => ok.reduce((x, t) => x + ((t.per || {})[k] || 0), 0);
    const totaal = [titel && /^Selectie/.test(titel) ? "Totaal selectie" : "Klas totaal", "", "", som("lessen"), telt, telt - afw, som("teLaat"), afw, perT("ZK"), perT("AB_OK"), perT("AB_NO"), perT("UI"), som("vrij"), telt ? this.pct(Math.round(100 * (telt - afw) / telt)) : ""];
    const gem = ok.length ? Math.round(ok.reduce((s, t) => s + t.pct, 0) / ok.length) : null;
    const blad1 = this.blad([kop, ...rijen, [], totaal, ["Gemiddelde per leerling", "", "", ...Array(this.KOP.length - 1).fill(""), gem == null ? "" : this.pct(gem)]],
      [28, 11, 9, ...this.KB, ...(vergelijk ? [20, 26, 20] : [])]);
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
