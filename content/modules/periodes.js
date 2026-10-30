/* Periodes: een keuze "Periode" naast Week / Maand / Jaar in Magisters verzuimoverzichten.
 * De periodes zelf stel je in het zijpaneel in (instellingen: periodes.lijst).
 *
 * - Verzuimpagina van een leerling (att-dk-attendance, tabblad Registraties): Magister haalt de
 *   registraties op voor het gekozen bereik; de lijst en de tellingen gaan dan over de periode.
 * - Verzuim › Inzicht (att-insights-page): de server rekent alleen per week, maand of jaar. Bij een
 *   periode worden de weekrapporten van alle weken in de periode opgeteld (netlog.js). Weken die
 *   deels in de periode vallen, tellen helemaal mee.
 *
 * Het toepassen gebeurt in de pagina zelf (netlog.js, bericht dt:periode:set), omdat alleen daar
 * de eigenschappen van Magisters componenten bereikbaar zijn. */
DT.register({
  id: "periodes",
  TARGETS: ["att-insights-page", "att-dk-attendance"],
  _stop: null,
  _unsub: null,
  _actief: {},   // tag -> { id, host }

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.mount(DT), { debounce: 400, poll: 2000 });
    this._unsub = DT.onSettingsChange(() => this.mount(DT, true));
  },

  destroy() {
    this._stop && this._stop(); this._unsub && this._unsub();
    for (const tag of Object.keys(this._actief)) this.send(tag, null);
    this._actief = {};
    for (const el of DT.deepQueryAll(".dt-per-ctl")) { el.closest(".date-picker")?.classList.remove("dt-per-on"); el.remove(); }
  },

  mount(DT, refresh = false) {
    const lijst = DT.periodes();
    for (const tag of this.TARGETS) {
      const host = DT.deepQuery(tag), root = host?.shadowRoot;
      const dp = root?.querySelector(".toolbar .date-picker");
      const group = dp?.querySelector(":scope > sl-toggle-group");
      if (this._actief[tag] && this._actief[tag].host !== host) delete this._actief[tag];
      if (!group) continue;
      let ctl = dp.querySelector(":scope > .dt-per-ctl");
      if (!lijst.length) { ctl?.remove(); dp.classList.remove("dt-per-on"); if (this._actief[tag]) { delete this._actief[tag]; this.send(tag, null); } continue; }
      if (ctl && !refresh) continue;
      this.css(root);
      ctl?.remove();
      ctl = this.control(DT, tag, host, dp, group, lijst);
      group.after(ctl);
      if (!group.dataset.dtPer) {
        group.dataset.dtPer = "1";
        /* Week / Maand / Jaar gekozen: eigen periode loslaten en Magisters eigen bereik terugzetten. */
        group.addEventListener("click", () => {
          const tg = this.TARGETS.find((t) => this._actief[t]?.host === host);
          if (!tg) return;
          delete this._actief[tg]; this.state(dp, null);
          const sel = dp.querySelector(".dt-per-sel"); if (sel) sel.value = "";
          setTimeout(async () => { await this.send(tg, null); this.mount(DT, true); }, 60);
        });
      }
      this.state(dp, this._actief[tag] ? lijst.find((p) => p.id === this._actief[tag].id) : null);
    }
  },

  control(DT, tag, host, dp, group, lijst) {
    const sel = document.createElement("select");
    sel.className = "dt-per-sel"; sel.setAttribute("aria-label", "Eigen periode kiezen");
    sel.append(new Option("Periode…", ""));
    for (const p of lijst) sel.append(new Option(`${p.naam}  ·  ${DT.periodeLabel(p)}`, p.id));
    if (this._actief[tag]) sel.append(new Option("Geen periode (terug naar Magister)", "-"));
    sel.value = this._actief[tag]?.id || "";
    sel.addEventListener("change", async () => {
      const p = lijst.find((x) => x.id === sel.value);
      if (!p) {
        delete this._actief[tag]; this.state(dp, null); sel.value = "";
        await this.send(tag, null);
        return this.mount(DT, true);
      }
      this._actief[tag] = { id: p.id, host };
      this.state(dp, p);
      const r = await this.send(tag, p);
      if (!r.ok) { delete this._actief[tag]; this.state(dp, null); sel.value = ""; DT.toast?.(`Periode toepassen lukte niet: ${r.error || "onbekende fout"}`, "err"); }
      this.mount(DT, true);
    });
    const range = document.createElement("span");
    range.className = "dt-per-range";
    const wrap = document.createElement("span");
    wrap.className = "dt-per-ctl";
    wrap.append(sel, range);
    return wrap;
  },

  /* Uiterlijk: met een periode actief is de keuze gevuld, staat het bereik ernaast en verdwijnt
   * Magisters eigen datumkiezer (die zou anders een week of maand tonen). */
  state(dp, p) {
    dp.classList.toggle("dt-per-on", !!p);
    const ctl = dp.querySelector(":scope > .dt-per-ctl");
    if (!ctl) return;
    ctl.querySelector(".dt-per-range").textContent = p ? DT.periodeLabel(p, true) : "";
    ctl.title = p && dp.getRootNode().host?.localName === "att-insights-page"
      ? "Opgeteld uit de weekrapporten van Magister; weken die deels in de periode vallen tellen helemaal mee."
      : "";
  },

  send(tag, p, herstel = true) {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const h = (e) => { if (e.source === window && e.data?.type === "dt:periode:result" && e.data.id === id) { window.removeEventListener("message", h); resolve(e.data); } };
      window.addEventListener("message", h);
      window.postMessage({ type: "dt:periode:set", id, target: tag, herstel, periode: p ? { start: p.begin.getTime(), end: p.einde.getTime() } : null }, "*");
      setTimeout(() => { window.removeEventListener("message", h); resolve({ ok: false, error: "time-out" }); }, 20000);
    });
  },

  css(root) {
    if (root.querySelector("#dt-per-style")) return;
    const st = document.createElement("style"); st.id = "dt-per-style";
    st.textContent = `
      .dt-per-ctl { display: inline-flex; align-items: center; gap: .625rem; }
      .dt-per-sel { appearance: none; -webkit-appearance: none; height: 2.25rem; padding: 0 2rem 0 1rem; border-radius: 999px; cursor: pointer;
        border: 1px solid var(--dna-primary, #007aff); color: var(--dna-primary, #007aff); background-color: transparent;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23888' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right .75rem center; background-size: 12px; font: 500 .875rem/1 inherit; font-family: inherit; max-width: 22rem; }
      .dt-per-sel:hover { background-color: color-mix(in srgb, var(--dna-primary, #007aff) 8%, transparent); }
      .dt-per-sel:focus-visible { outline: 2px solid var(--dna-primary, #007aff); outline-offset: 2px; }
      .dt-per-on .dt-per-sel { background-color: var(--dna-primary, #007aff); color: #fff;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23fff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
      .dt-per-range { font: 500 .875rem/1.2 inherit; font-family: inherit; white-space: nowrap; }
      .dt-per-range:empty { display: none; }
      .dt-per-on > sl-toggle-group { opacity: .55; }
      .dt-per-on > att-date-picker, .dt-per-on > att-insight-date-picker, .dt-per-on > att-day-picker { display: none !important; }
    `;
    root.append(st);
  }
});
