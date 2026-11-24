/* De eigen inhoud van de zijkolom: acties, de tabellen van de pagina, notities en links (Start), het thema
 * (Uiterlijk) en de periodes (Meer). Draait in de zijkolom van de browser (sidepanel.html), niet meer in de Magister-pagina zelf: alles
 * wat de pagina nodig heeft (tabellen, exports, een eigen pagina openen) gaat als bericht naar het Magister-tabblad
 * via DtKolom (sidepanel.js) en wordt daar afgehandeld door content/kolom.js. */
DT.register({
  id: "panel",
  _panel: null,
  _timer: null,

  init(DT) {
    this._panel = document.getElementById("dt-panel");
    this.render(DT);
    this._unsub = DT.onSettingsChange(() => this.render(DT));
    this._timer = setInterval(() => this.tick(), 1000 * 15);
  },

  destroy() {
    clearInterval(this._timer);
    this._unsub && this._unsub();
  },

  /* De tabellen van het Magister-tabblad opvragen en tonen. */
  async tabellen() {
    const host = this._panel?.querySelector("#dt-table-list"); if (!host) return;
    const r = await DtKolom.vraag({ vraag: "tabellen" });
    const leeg = (t) => host.replaceChildren(DT.el("div", { style: "font-size:13px;color:var(--dt-muted)", text: t }));
    if (!r) return leeg("Open een Magister-tabblad om de tabellen van die pagina te zien.");
    if (r.uit) return leeg("De module Tabelexport staat uit.");
    if (!r.tabellen?.length) return leeg("Geen datatabellen op deze pagina.");
    const doe = (index, actie) => () => DtKolom.vraag({ vraag: "tabel", index, actie });
    host.replaceChildren(...r.tabellen.map((t, i) => DT.el("div", { class: "dt-tablerow" }, [
      DT.el("button", { type: "button", class: "dt-linkbtn", title: "Toon tabel op de pagina", text: `${t.naam} (${t.rijen})`, onclick: doe(i, "toon") }),
      DT.el("div", { class: "dt-row" }, [
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Excel", onclick: doe(i, "xlsx") }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "CSV", onclick: doe(i, "csv") }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Opties", title: "Kolommen kiezen, kopiëren, namen maskeren", onclick: doe(i, "opties") })
      ])
    ])));
  },

  /* Datum en weeknummer in de kop van de kolom. */
  tick() {
    const el = document.getElementById("kolomDatum"); if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }) + " · week " + dtWeekNummer(now);
  },

  render(DT) {
        const widgets = DT.settings.panel.widgets || [];
    const builders = {
      links: () => widget("Snelle links", DT.el("ul", {}, (DT.settings.links || []).map((l) =>
        DT.el("li", {}, DT.el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label })))),
        "Beheer in instellingen"),
      notities: () => {
        const ta = DT.el("textarea", { placeholder: "Snelle notities, blijven lokaal bewaard…", "aria-label": "Notities" });
        chrome.storage.local.get("notes").then(({ notes }) => { ta.value = notes || ""; });
        let t; ta.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => chrome.storage.local.set({ notes: ta.value }), 400); });
        return widget("Notities", ta);
      },
      export: () => widget("Tabellen op deze pagina", DT.el("div", {}, [
        DT.el("div", { id: "dt-table-list" }),
        DT.el("div", { class: "dt-row", style: "margin-top:8px" }, [
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "Alles naar één Excel", onclick: () => DtKolom.opdracht("export") }),
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "Pagina als tekst kopiëren", onclick: async () => {
            const r = await DtKolom.vraag({ vraag: "paginaTekst" });
            if (r?.tekst) DT.copy(r.tekst); else DT.toast("Open een Magister-tabblad om de tekst te kopiëren", "err");
          } })
        ])
      ])),
      bediening: () => {
        const t = DT.settings.theme, P = globalThis.DT_THEMAS_LIST || [], KL = globalThis.DT_KLEUREN_LIST || [];
        /* Thema: eerst het thema, dan licht/donker, dan (als tweede keuze) de accentkleur. */
        const sel = DT.el("select", { class: "dt-select", "aria-label": "Thema" }, P.map(([v, l, sub]) => DT.el("option", { value: v, text: l, title: sub })));
        sel.title = (P.find((x) => x[0] === t.preset) || [])[2] || "";
        sel.value = P.some((x) => x[0] === t.preset) ? t.preset : "magister";
        sel.addEventListener("change", () => DT.saveSettings({ theme: { preset: sel.value } }));
        const geenModus = sel.value === "magister", geenKleur = geenModus || sel.value === "contrast";
        const modus = t.mode === "light" || t.mode === "dark" ? t.mode : "auto";
        const seg = DT.el("div", { class: "dt-seg", role: "group", "aria-label": "Licht of donker" }, [["auto", "Auto"], ["light", "Licht"], ["dark", "Donker"]].map(([m, l]) => {
          const b = DT.el("button", { class: "dt-segbtn" + (m === modus && !geenModus ? " is-on" : ""), type: "button", text: l, "aria-pressed": String(m === modus && !geenModus),
            title: m === "auto" ? "Volgt licht of donker van je computer" : "", onclick: () => DT.saveSettings({ theme: { mode: m } }) });
          if (geenModus) b.disabled = true;
          return b;
        }));
        const kleurNu = geenKleur ? "thema" : (t.kleur || "thema");
        const kleuren = DT.el("div", { class: "dt-kleuren", role: "group", "aria-label": "Accentkleur" }, KL.map(([id, label, hex]) => {
          if (id === "eigen") {
            const kies = DT.el("input", { type: "color", class: "dt-kleur dt-kleur-eigen" + (kleurNu === "eigen" ? " is-on" : ""), value: /^#[0-9a-f]{6}$/i.test(t.accent || "") ? t.accent : "#1B3A5C", title: "Eigen kleur", "aria-label": "Eigen accentkleur" });
            kies.addEventListener("change", () => DT.saveSettings({ theme: { kleur: "eigen", accent: kies.value } }));
            if (geenKleur) kies.disabled = true;
            return kies;
          }
          const b = DT.el("button", { class: "dt-kleur" + (id === "thema" ? " dt-kleur-thema" : "") + (kleurNu === id ? " is-on" : ""), type: "button", title: label, "aria-label": `Accentkleur: ${label}`, "aria-pressed": String(kleurNu === id),
            ...(hex ? { style: `--k:${hex}` } : {}), onclick: () => DT.saveSettings({ theme: { kleur: id } }) });
          if (geenKleur) b.disabled = true;
          return b;
        }));
        return DT.el("div", { class: "dt-bediening" }, [
          widget("Thema", DT.el("div", { class: "dt-theme-blok" }, [DT.el("div", { class: "dt-theme-row" }, [sel, seg]), kleuren]),
            geenModus ? "Magister toont het origineel. Kies een ander thema voor licht/donker en een accentkleur." : sel.value === "contrast" ? "Contrast houdt zijn eigen kleuren, voor de leesbaarheid." : "")
        ]);
      },
      periodes: () => {
        /* Eigen periodes: verschijnen als keuze "Periode" in de verzuimoverzichten van Magister. */
        const lijst = (DT.settings.periodes?.lijst || []).map((x) => ({ ...x }));
        const save = (l) => DT.saveSettings({ periodes: { lijst: l } });
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const nu = new Date();
        let bewerk = null;
        const naam = DT.el("input", { type: "text", class: "dt-input", placeholder: "Naam, bijv. Periode 1", "aria-label": "Naam van de periode", maxlength: "40" });
        const begin = DT.el("input", { type: "date", class: "dt-input", "aria-label": "Begindatum" });
        const einde = DT.el("input", { type: "date", class: "dt-input", "aria-label": "Einddatum" });
        const fout = DT.el("div", { class: "dt-per-err", role: "alert" });
        const knop = DT.el("button", { class: "dt-btn dt-btn-sm dt-btn-primary", text: "Toevoegen" });
        const annuleer = DT.el("button", { class: "dt-btn dt-btn-sm", text: "Annuleren", hidden: "" });
        const leeg = () => {
          bewerk = null; knop.textContent = "Toevoegen"; annuleer.hidden = true; fout.textContent = "";
          const laatste = DT.periodes().at(-1);
          naam.value = ""; einde.value = "";
          if (laatste) { const d = new Date(laatste.einde); d.setDate(d.getDate() + 1); begin.value = ymd(d); naam.placeholder = `Naam, bijv. Periode ${DT.periodes().length + 1}`; }
          else begin.value = "";
        };
        knop.addEventListener("click", () => {
          const n = naam.value.trim(), b = begin.value, e = einde.value;
          if (!n) return (fout.textContent = "Geef de periode een naam.");
          if (!b || !e) return (fout.textContent = "Vul een begin- en einddatum in.");
          if (e < b) return (fout.textContent = "De einddatum ligt voor de begindatum.");
          const item = { id: bewerk || Date.now().toString(36), naam: n, begin: b, einde: e };
          save(bewerk ? lijst.map((x) => (String(x.id || x.begin) === bewerk ? item : x)) : [...lijst, item]);
        });
        annuleer.addEventListener("click", leeg);
        const rows = DT.periodes().map((p) => {
          const actief = nu >= p.begin && nu <= p.einde;
          const ed = DT.el("button", { class: "dt-per-act", title: `${p.naam} wijzigen`, "aria-label": `${p.naam} wijzigen`, onclick: () => {
            const raw = lijst.find((x) => String(x.id || x.begin) === p.id); if (!raw) return;
            bewerk = p.id; naam.value = raw.naam || ""; begin.value = raw.begin; einde.value = raw.einde;
            knop.textContent = "Opslaan"; annuleer.hidden = false; fout.textContent = ""; naam.focus();
          } });
          ed.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`;
          const del = DT.el("button", { class: "dt-per-act is-del", title: `${p.naam} verwijderen`, "aria-label": `${p.naam} verwijderen`, onclick: () => {
            if (confirm(`Periode "${p.naam}" verwijderen?`)) save(lijst.filter((x) => String(x.id || x.begin) !== p.id));
          } });
          del.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
          return DT.el("li", { class: "dt-per-row" + (actief ? " is-now" : "") }, [
            DT.el("span", { class: "dt-per-name" }, [DT.el("b", { text: p.naam }), DT.el("small", { text: DT.periodeLabel(p, true) })]),
            actief ? DT.el("span", { class: "dt-per-now", text: "nu" }) : null, ed, del
          ]);
        });
        leeg();
        return widget("Periodes", DT.el("div", { class: "dt-per" }, [
          rows.length ? DT.el("ul", { class: "dt-per-list" }, rows) : DT.el("p", { class: "dt-per-empty", text: "Nog geen periodes. Voeg ze hieronder toe." }),
          DT.el("div", { class: "dt-per-form" }, [naam, DT.el("div", { class: "dt-per-dates" }, [begin, DT.el("span", { text: "t/m" }), einde]), fout, DT.el("div", { class: "dt-row" }, [knop, annuleer])])
        ]), "Kies ze daarna als \"Periode\" op de verzuimpagina van een leerling, in Verzuim › Inzicht en op het tabblad Inzicht.");
      },
      modules: () => {
        const pagina = (naam) => () => DtKolom.vraag({ vraag: "actie", naam });
        const acts = [
          ["theme", "Licht/donker", "Alt+T", () => {
            if (DT.settings.theme.preset === "magister") return DT.toast("Het thema Magister heeft geen donkere variant", "info", 3500);
            DT.saveSettings({ theme: { mode: document.documentElement.classList.contains("dt-dark") ? "light" : "dark" } });
          }],
          ["export", "Excel", "Alt+E", () => DtKolom.opdracht("export")],
          ...(DT.settings.aanwezigexport?.enabled !== false ? [["aanwezigexport", "Klas → Excel", "", pagina("klasExcel")]] : []),
          ...(DT.settings.lesreg?.enabled !== false ? [["aanwezigexport", "Lesregistraties", "", pagina("lesreg")]] : []),
          ...(DT.settings.aanwezigexport?.enabled !== false ? [["aanwezigexport", "Bespreeklijst", "", pagina("bespreeklijst")]] : []),
          ...(DT.settings.developer?.enabled ? [["inspector", "Inspector", "Alt+I", () => DtKolom.opdracht("inspector")]] : []),
          ["options", "Modules", "", () => DtKolom.toon("modules")]
        ];
        return widget("Acties", DT.el("div", { class: "dt-actions" }, acts.map(([icon, label, kbd, go]) => {
          const b = DT.el("button", { class: "dt-action", title: kbd ? `${label} (${kbd})` : label, onclick: go });
          b.innerHTML = `<span class="dt-action-ico">${DT_ICONS[icon] || ""}</span><span class="dt-action-naam">${label}</span>${kbd ? `<kbd>${kbd}</kbd>` : ""}`;
          return b;
        })));
      }
    };

    /* Drie delen, één per tabblad van de kolom (sidepanel.js toont er steeds één):
     *  - start: wat je dagelijks gebruikt (acties, de tabellen van de pagina, notities, links);
     *  - uiterlijk: het thema; de rest van het uiterlijk staat eronder (instellingenpagina);
     *  - meer: je periodes; daaronder de zijkolom, updates en ontwikkelaar (instellingenpagina).
     * De volgorde op Start volgt de instelling panel.widgets. */
    const START = ["export", "notities", "links"];
    const deel = (blad, ids) => DT.el("div", { class: "dt-panel-body", "data-blad": blad }, ids.map((id) => builders[id]?.()).filter(Boolean));
    this._panel.replaceChildren(
      deel("start", ["modules", ...widgets.filter((w) => START.includes(w))]),
      deel("uiterlijk", ["bediening"]),
      deel("meer", DT.settings.periodes?.enabled !== false ? ["periodes"] : [])
    );
    this.tick();
    this.tabellen();

    function widget(title, content, hint) {
      return DT.el("section", { class: "dt-widget" }, [DT.el("h3", { text: title }), content, hint ? DT.el("div", { style: "font-size:12px;color:var(--dt-muted);margin-top:6px", text: hint }) : null]);
    }
  }
});

/* Eigen naam: verzuiminzicht.js heeft een isoWeek die { y, w } teruggeeft en later laadt. */
function dtWeekNummer(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

/* Pictogrammen voor de moduletegels (zelfde set als de popup gebruikte). */
const DT_ICONS = Object.fromEntries(Object.entries({
  compact: `<path d="M4 7h16M4 12h10M4 17h7"/>`,
  tables: `<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 11h16M10 5v14"/>`,
  quickinput: `<path d="M5 12h11M12 7l5 5-5 5"/>`,
  aanwezigheid: `<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>`,
  navigation: `<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>`,
  jarig: `<path d="M4 20h16M5 20v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 15c2 1.5 4 1.5 6 0s4-1.5 6 0M12 7v4"/>`,
  leerlingdash: `<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>`,
  verzuiminzicht: `<path d="M4 19h16M6 15l4-5 3 3 5-7"/>`,
  aanwezigexport: `<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8l4 5M12 8l-4 5M14 9h3M14 13h3M8 17h9"/>`,
  periodes: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M7 15h4M13 15h4"/>`,
  melding: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  cb: `<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>`,
  theme: `<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>`,
  export: `<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  mail: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  options: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  inspector: `<path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/>`,
}).map(([k, d]) => [k, `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`]));
