/* Melding Expertisecentrum -> mail naar de begeleidingscoach.
 *
 * Twee plekken:
 *  - magister-lvs/#/create/...   nieuwe melding: knop "Mail coach" naast "Volgende"
 *  - magister-lvs/#/overview/... logboek: mailknop in de knoppenbalk van elk item
 *                                 van het type Melding Expertisecentrum
 * De knop leest het formulier of het geopende item uit, toont een controlescherm
 * (naam, studentnr, klas, aangemeld voor, samenvatting) en opent daarna een
 * voorgevulde concept-mail in Outlook via mailto:. Sneltoets op de
 * aanmaakpagina: Alt+M.
 *
 * Instellingen (instellingenpagina, of via het controlescherm):
 *   melding.to        e-mailadres begeleidingscoach
 *   melding.cc        optioneel cc-adres
 *   melding.name      naam begeleidingscoach (voor de aanhef)
 *   melding.afzender  je eigen naam onder de mail
 *   melding.extra     ook problematiek, hulp en ouders meesturen
 */
DT.register({
  id: "melding",
  _btn: null,
  _itemBtns: [],
  _stop: null,
  _dlg: null,
  _style: null,

  /* Labels van de vakjes "voor wie aangemeld" (groep in app-dynamic-fields). */
  TARGETS: [
    "Rekenondersteuning", "Taalondersteuning",
    "Spreekuur preventiemedewerker Arkin", "Spreekuur preventiemedewerker Jellinek",
    "Jongerenpunt / Doorstroompunt", "Jeugdarts", "Jeugdadviseur",
    "Decaan / loopbaanadviseur", "Budgetcoach", "Begeleider Passend Onderwijs", "Anders"
  ],
  PROBLEMS: [
    "Thuissituatie", "Psychische problemen", "Leerproblematiek",
    "Gedragsproblematiek", "Fysieke / medische problemen", "Absentie"
  ],

  defaults() {
    return Object.assign({ to: "", cc: "", name: "Esther Benschop", extra: true, afzender: "" }, DT.settings.melding || {});
  },

  /* Sneltoets of popup: open het controlescherm als deze frame een melding toont. */
  trigger(DT) {
    if (this.isMeldingPage()) return this.open(DT, document);
    if (this.isOverviewPage()) {
      const items = DT.deepQueryAll("app-logbook-item").filter((it) => /expertisecentrum/i.test(this.textOf(DT.deepQuery("dna-card-title div.type", it))));
      const open = items.find((it) => DT.deepQuery("app-overzicht-tab", it)) || (items.length === 1 ? items[0] : null);
      if (open) return this.openItem(DT, open);
      if (items.length) DT.toast("Klap eerst de gewenste melding open, of klik op ✉ bij de melding", "info", 3500);
    }
  },

  init(DT) {
    this._style = DT.el("style", { id: "dt-melding-style", text: this.css() });
    document.head.append(this._style);
    this._onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m" && this.isMeldingPage()) {
        e.preventDefault(); this.trigger(DT);
      }
    };
    document.addEventListener("keydown", this._onKey);
    this._stop = DT.observe(() => this.mount(DT), { debounce: 400 });
  },

  destroy(DT) {
    this._stop && this._stop();
    document.removeEventListener("keydown", this._onKey);
    this._btn?.remove(); this._dlg?.remove(); this._style?.remove();
    this._itemBtns.forEach((b) => b.remove()); this._itemBtns = [];
  },

  isMeldingPage() {
    return /magister-lvs\/#\/create\//.test(location.href) && !!DT.deepQuery("app-dynamic-fields");
  },
  isOverviewPage() {
    return /magister-lvs\/#\/overview\//.test(location.href) && !!DT.deepQuery("app-logbook-list");
  },

  BTN_STYLE: "padding:6px 14px;border-radius:8px;border:2px solid var(--dt-accent,#056dc2);" +
    "background:#fff;color:var(--dt-accent,#056dc2);font:600 .875rem/1.25rem open-sans,Arial,sans-serif;cursor:pointer;white-space:nowrap",

  mount(DT) {
    this.mountCreate(DT);
    this.mountOverview(DT);
  },

  /* Aanmaakpagina: knop naast "Volgende" in de sticky balk (shadow DOM, dus inline stijl). */
  mountCreate(DT) {
    if (!this.isMeldingPage()) { this._btn?.remove(); this._btn = null; return; }
    if (this._btn && this._btn.isConnected) return;
    const next = DT.deepQuery("#to-next-tab");
    const btn = DT.el("button", {
      type: "button", id: "dt-melding-btn", title: "Concept-mail naar begeleidingscoach (Alt+M)",
      text: "✉ Mail coach",
      onclick: (e) => { e.preventDefault(); this.open(DT, document); }
    });
    btn.setAttribute("style", this.BTN_STYLE + ";margin-right:12px");
    if (next && next.parentNode) next.parentNode.insertBefore(btn, next);
    else { btn.style.cssText += ";position:fixed;right:24px;bottom:72px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.2)"; document.body.append(btn); }
    this._btn = btn;
  },

  /* Logboekoverzicht: mailknop in de knoppenbalk van elk Melding-Expertisecentrum-item. */
  mountOverview(DT) {
    this._itemBtns = this._itemBtns.filter((b) => b.isConnected);
    if (!this.isOverviewPage()) { this._itemBtns.forEach((b) => b.remove()); this._itemBtns = []; return; }
    DT.deepQueryAll("app-logbook-item").forEach((item) => {
      if (DT.deepQuery("[data-dt-mail]", item)) return;
      const type = this.textOf(DT.deepQuery("dna-card-title div.type", item));
      if (!/expertisecentrum/i.test(type)) return;
      const bar = DT.deepQuery("dna-card-title dna-button-bar", item);
      if (!bar) return;
      const btn = DT.el("button", {
        type: "button", "data-dt-mail": "1", title: "Concept-mail naar begeleidingscoach", text: "✉",
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.openItem(DT, item); }
      });
      btn.setAttribute("style", this.BTN_STYLE + ";padding:2px 10px;margin-right:6px;line-height:1.5rem");
      const first = bar.shadowRoot?.firstElementChild || bar.firstElementChild;
      (bar.shadowRoot || bar).insertBefore(btn, first || null);
      this._itemBtns.push(btn);
    });
  },

  /* Item in het overzicht eerst uitklappen (anders is de inhoud niet in de DOM). */
  async openItem(DT, item) {
    if (!DT.deepQuery("app-overzicht-tab", item)) {
      const expand = DT.deepQuery("dna-button.toggle[aria-label='Expand'] button, dna-button.toggle[aria-label='Expand']", item);
      expand?.click();
      for (let i = 0; i < 20 && !DT.deepQuery("app-overzicht-tab", item); i++) await new Promise((r) => setTimeout(r, 150));
      if (!DT.deepQuery("app-overzicht-tab", item)) { DT.toast("Klap het item eerst open (tabblad Overzicht)", "err"); return; }
    }
    this.open(DT, item);
  },

  /* ---------- Formulier uitlezen ---------- */

  textOf(el) { return (el?.textContent || "").replace(/\s+/g, " ").trim(); },

  checked(DT, root = document) {
    const out = [];
    DT.deepQueryAll("input[type=checkbox]", root).forEach((cb) => {
      const id = (cb.id || "").replace(/-input$/, "");
      const host = (id && cb.getRootNode().getElementById?.(id)) || cb.closest("dna-checkbox") || cb.parentElement;
      const on = cb.checked || host?.classList?.contains("dna-checkbox-checked");
      if (!on) return;
      const logisch = cb.closest("app-logisch");
      const label = this.textOf(logisch) ||
                    this.textOf(host?.querySelector("label") || host?.querySelector("span") || host) ||
                    this.textOf(cb.getRootNode().querySelector?.(`label[for="${cb.id}"]`));
      if (label) out.push(label);
    });
    return out;
  },

  /* Alle documenten van dit frame tot en met window.top (zelfde domein). */
  docs() {
    const out = [document];
    let w = window;
    while (w !== w.parent) {
      w = w.parent;
      try { if (w.document && w.document.body) out.push(w.document); } catch { break; }
    }
    return out;
  },

  /* Leerling-id uit de URL van een van de frames (…/leerling/{id}/…). */
  leerlingId() {
    for (const d of this.docs()) {
      const m = (d.location?.href || "").match(/leerling\/(\d+)/);
      if (m) return m[1];
    }
    return "";
  },

  /* Korte teksten uit koppen en naam-achtige elementen in alle frames. */
  sources(DT) {
    const sel = "dna-page-header div.title, dna-breadcrumb, h1, h2, h3, " +
      "[class*=title], [class*=header], [class*=naam], [class*=name], [class*=leerling], [class*=student], [class*=klas]";
    const bits = [];
    for (const d of this.docs()) {
      bits.push(d.title);
      DT.deepQueryAll(sel, d).forEach((el) => {
        if (el.closest && el.closest("#dt-melding, #dt-panel")) return;
        const t = this.textOf(el);
        if (t && t.length <= 120) bits.push(t);
      });
    }
    return [...new Set(bits.filter(Boolean))];
  },

  student(DT) {
    const bits = this.sources(DT);
    const all = bits.join(" | ");
    const nr = (all.match(/\b(\d{5,8})\b/) || [])[1] || "";
    const klas = (all.match(/\b([A-Z]{2,5}\d{2}[A-Z0-9]{0,2})\b/) || [])[1] || "";
    // Naam: eerste tekst zonder cijfers die niet een vaste kop is.
    const skip = /^(leerlingen?|logboek|begeleiding|detailkaarten|nieuwe? melding|melding|expertisecentrum|algemeen|samenvatting|velden|magister.*)$/i;
    const clean = (t) => t.replace(/\(.*?\)/g, " ").replace(/\b\d{5,8}\b/g, " ")
      .replace(/\b[A-Z]{2,5}\d{2}[A-Z0-9]{0,2}\b/g, " ").replace(/\s*[|:,\-·]+\s*$/, "").replace(/\s+/g, " ").trim();
    // Voorkeur: een regel waar nummer of klas in stond (dan is de rest vrijwel zeker de naam).
    const withId = bits.filter((t) => (nr && t.includes(nr)) || (klas && t.includes(klas)));
    const naam = [...withId, ...bits].map(clean)
      .find((t) => t && !/\d/.test(t) && !skip.test(t) && t.length <= 60) || "";
    return { naam, nr, klas, bronnen: bits };
  },

  summary(DT, root = document) {
    const ed = DT.deepQuery("#inhoud div.ProseMirror", root) || DT.deepQuery("app-summary div.ProseMirror", root) ||
               DT.deepQuery("app-overzicht-tab div.dna-editor-content-area", root);
    return (ed?.innerText || "").trim();
  },

  collect(DT, root = document) {
    const chk = this.checked(DT, root);
    const d = this.student(DT);
    const isItem = root !== document;
    return {
      ...d,
      bestaand: isItem,
      onderwerp: isItem ? this.textOf(DT.deepQuery("dna-card-title div.omschrijving", root))
                        : (DT.deepQuery("#dna-input-0")?.value || "").trim(),
      datum: isItem ? this.textOf(DT.deepQuery("dna-card-title div.datum", root))
                    : (DT.deepQuery("#dna-input-1")?.value || "").trim(),
      voorWie: chk.filter((l) => this.TARGETS.includes(l)),
      problematiek: chk.filter((l) => this.PROBLEMS.includes(l)),
      hulp: chk.filter((l) => /hulp geboden/i.test(l)),
      ouders: chk.filter((l) => /ouders zijn/i.test(l)),
      samenvatting: this.summary(DT, root)
    };
  },

  /* ---------- Mail opbouwen ---------- */

  compose(f, s) {
    const naam = f.naam || "[naam]";
    const wanneer = f.bestaand ? (f.datum ? `op ${f.datum} ` : "") : "zojuist ";
    const regel = (k, v) => (v ? `${k}: ${v}\n` : "");
    let body = `Beste ${s.name.split(" ")[0] || "collega"},\n\n` +
      `Ik heb ${wanneer}in Magister een Melding Expertisecentrum aangemaakt voor:\n\n` +
      regel("Naam", naam) + regel("Studentnummer", f.nr) + regel("Klas", f.klas) +
      regel("Aangemeld voor", f.voorWie.join(", ") || "[niet aangevinkt]") +
      regel("Datum melding", f.datum) + "\n";
    if (s.extra) {
      body += regel("Problematiek", f.problematiek.join(", ")) +
              regel("Hulp", f.hulp.join("; ")) +
              regel("Ouders", f.ouders.join("; "));
      if (f.problematiek.length || f.hulp.length || f.ouders.length) body += "\n";
    }
    body += `Samenvatting:\n${f.samenvatting || "[samenvatting]"}\n\n` +
      `De volledige melding staat in Magister (logboek van de student).\n\nMet vriendelijke groet,\n${s.afzender || ""}`;
    const subject = `Melding Expertisecentrum: ${naam}${f.klas ? ` (${f.klas})` : ""}`;
    return { subject, body };
  },

  mailto(to, subject, body, cc = "") {
    const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
    if (cc) q.unshift(`cc=${encodeURIComponent(cc)}`);
    return `mailto:${encodeURIComponent(to)}?${q.join("&")}`;
  },

  /* ---------- Controlescherm ---------- */

  open(DT, root = document) {
    if (Date.now() - (this._openedAt || 0) < 500) return;
    this._openedAt = Date.now();
    this._dlg?.remove();
    const s = this.defaults();
    const f = this.collect(DT, root);
    const inp = (label, key, val, attrs = {}) => DT.el("label", { class: "dt-m-field" }, [
      DT.el("span", { text: label }),
      DT.el("input", { type: "text", "data-k": key, value: val, ...attrs })
    ]);
    const to = inp("Aan (e-mail coach)", "to", s.to, { placeholder: "naam@school.nl" });
    const naam = inp("Naam student", "naam", f.naam);
    const nr = inp("Studentnummer", "nr", f.nr);
    const klas = inp("Klas", "klas", f.klas);
    const voor = inp("Aangemeld voor", "voorWie", f.voorWie.join(", "));
    const extra = DT.el("label", { class: "dt-m-check" }, [
      DT.el("input", { type: "checkbox", "data-k": "extra", ...(s.extra ? { checked: "" } : {}) }),
      DT.el("span", { text: "Problematiek, hulp en ouders meesturen" })
    ]);
    const bodyTa = DT.el("textarea", { rows: "14", spellcheck: "false" });
    const subjEl = DT.el("input", { type: "text", class: "dt-m-subject" });

    const read = () => {
      const g = (el) => el.querySelector("input").value.trim();
      return {
        f: { ...f, naam: g(naam), nr: g(nr), klas: g(klas), voorWie: g(voor).split(/\s*,\s*/).filter(Boolean) },
        s: { ...s, to: g(to), extra: extra.querySelector("input").checked }
      };
    };
    const refresh = () => {
      const r = read();
      const m = this.compose(r.f, r.s);
      subjEl.value = m.subject; bodyTa.value = m.body;
    };
    [naam, nr, klas, voor, extra].forEach((el) => el.addEventListener("input", refresh));
    refresh();

    const warn = DT.el("div", { class: "dt-m-warn" });
    const check = () => {
      const r = read();
      const miss = [];
      if (!r.s.to) miss.push("e-mailadres coach");
      if (!r.f.naam) miss.push("naam");
      if (!r.f.voorWie.length) miss.push("aangemeld voor");
      if (!f.samenvatting) miss.push("samenvatting (nog leeg in het formulier)");
      warn.textContent = miss.length ? "Nog niet ingevuld: " + miss.join(", ") : "";
      return r;
    };
    [to, naam, voor].forEach((el) => el.addEventListener("input", check));
    check();

    const send = async () => {
      const r = check();
      if (!r.s.to) { DT.toast("Vul het e-mailadres van de coach in", "err"); return; }
      await DT.saveSettings({ melding: { enabled: true, to: r.s.to, extra: r.s.extra } });
      const url = this.mailto(r.s.to, subjEl.value, bodyTa.value, r.s.cc);
      if (url.length > 1900) DT.toast("Lange mail: als Outlook de tekst afkapt, gebruik dan Kopiëren", "info", 5000);
      window.location.href = url;
      DT.toast("Concept-mail geopend in je mailprogramma", "ok");
      dlg.remove();
    };
    const copy = async () => {
      await DT.copy(`Aan: ${read().s.to}\nOnderwerp: ${subjEl.value}\n\n${bodyTa.value}`);
    };

    const dlg = DT.el("div", { id: "dt-melding", role: "dialog", "aria-label": "Mail naar begeleidingscoach" }, [
      DT.el("div", { class: "dt-m-box" }, [
        DT.el("div", { class: "dt-m-head" }, [
          DT.el("strong", { text: "Mail naar begeleidingscoach" }),
          DT.el("button", { type: "button", class: "dt-m-x", text: "✕", title: "Sluiten", onclick: () => dlg.remove() })
        ]),
        DT.el("div", { class: "dt-m-grid" }, [to, naam, nr, klas, voor]),
        extra,
        DT.el("label", { class: "dt-m-field" }, [DT.el("span", { text: "Onderwerp" }), subjEl]),
        bodyTa,
        warn,
        DT.el("div", { class: "dt-m-actions" }, [
          DT.el("button", { type: "button", class: "dt-m-btn dt-m-ghost", text: "Bronnen", title: "Welke teksten zijn gevonden voor naam, nummer en klas (voor afstemming)",
            onclick: () => DT.copy(`leerlingId: ${this.leerlingId()}\n` + (f.bronnen || []).map((b) => "- " + b).join("\n")) }),
          DT.el("button", { type: "button", class: "dt-m-btn", text: "Kopiëren", onclick: copy }),
          DT.el("button", { type: "button", class: "dt-m-btn dt-m-primary", text: "Open in Outlook", onclick: send })
        ]),
        DT.el("div", { class: "dt-m-hint", text: (s.cc ? `Cc: ${s.cc}. ` : "") + (f.bestaand
          ? "Controleer de gegevens. De mail opent als concept; er wordt niets automatisch verzonden."
          : "Controleer de gegevens. De mail opent als concept; er wordt niets automatisch verzonden. Sla de melding daarna nog wel op in Magister.") })
      ])
    ]);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.remove(); });
    dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") dlg.remove(); });
    document.body.append(dlg);
    this._dlg = dlg;
    (s.to ? naam : to).querySelector("input").focus();
  },

  css() {
    return `
#dt-melding{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:14px/1.4 var(--dt-font,system-ui,sans-serif);color:#222}
#dt-melding .dt-m-box{background:#fff;color:#222;width:min(720px,94vw);max-height:92vh;overflow:auto;border-radius:12px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:10px}
#dt-melding .dt-m-head{display:flex;justify-content:space-between;align-items:center;font-size:16px}
#dt-melding .dt-m-x{border:0;background:none;font-size:16px;cursor:pointer;color:#666}
#dt-melding .dt-m-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
#dt-melding .dt-m-grid .dt-m-field:first-child{grid-column:1/-1}
#dt-melding .dt-m-field{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#555}
#dt-melding input[type=text],#dt-melding textarea{font:inherit;font-size:14px;color:#222;background:#fff;border:1px solid #ccc;border-radius:6px;padding:6px 8px;width:100%;box-sizing:border-box}
#dt-melding textarea{resize:vertical;min-height:180px;font-family:inherit}
#dt-melding .dt-m-check{display:flex;gap:8px;align-items:center;font-size:13px}
#dt-melding .dt-m-warn{color:#b3261e;font-size:12px;min-height:1em}
#dt-melding .dt-m-actions{display:flex;justify-content:flex-end;gap:8px}
#dt-melding .dt-m-btn{font:600 14px/1 inherit;padding:9px 16px;border-radius:8px;border:2px solid var(--dt-accent,#056dc2);background:#fff;color:var(--dt-accent,#056dc2);cursor:pointer}
#dt-melding .dt-m-ghost{border-color:#ccc;color:#666;margin-right:auto}
#dt-melding .dt-m-primary{background:var(--dt-accent,#056dc2);color:var(--dt-accent-ink,#fff)}
#dt-melding .dt-m-hint{font-size:12px;color:#777}
`;
  }
});
