/* Docentenpaneel: zijpaneel met widgets. Alt+D opent/sluit.
 * Widgets: klok + datum, snelle links, notities (lokaal opgeslagen),
 * exporteren van alle tabellen op de pagina, en module-schakelaars.
 * Het leerlingen/klassen-dashboard komt hier ook in zodra we de juiste
 * Magister-selectors hebben (zie README).
 */
DT.register({
  id: "panel",
  _panel: null,
  _handle: null,
  _timer: null,

  init(DT) {
    if (!DT.isTop) return;
    const pos = DT.settings.panel.position === "left" ? "dt-left" : "";
    this._handle = DT.el("div", { id: "dt-handle", class: pos, text: "Docent Tools", title: "Openen (Alt+D)", onclick: () => this.toggle() });
    this._panel = DT.el("div", { id: "dt-panel", class: pos, role: "complementary", "aria-label": "Docent Tools paneel" });
    document.body.append(this._handle, this._panel);
    this.render(DT);
    this._unsub = DT.onSettingsChange(() => this.render(DT));
    this._timer = setInterval(() => this.tick(), 1000 * 15);
  },

  destroy() {
    this._panel?.remove(); this._handle?.remove();
    clearInterval(this._timer);
    this._unsub && this._unsub();
  },

  toggle(force) {
    const open = force ?? !this._panel.classList.contains("dt-open");
    this._panel.classList.toggle("dt-open", open);
    if (open) {
      const list = this._panel.querySelector("#dt-table-list");
      if (list) DT.module("tables")?.listInto(DT, list);
      this._panel.querySelector("button, textarea, a")?.focus();
    }
  },

  tick() {
    const c = this._panel?.querySelector(".dt-clock");
    if (!c) return;
    const now = new Date();
    c.firstChild.textContent = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    c.querySelector("small").textContent = now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) + " · week " + isoWeek(now);
  },

  render(DT) {
    const body = DT.el("div", { class: "dt-panel-body" });
    const widgets = DT.settings.panel.widgets || [];
    const builders = {
      klok: () => widget("Nu", DT.el("div", { class: "dt-clock" }, ["", DT.el("small")])),
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
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Alles naar één Excel", onclick: () => DT.module("tables")?.exportAll(DT) }),
        DT.el("button", { class: "dt-btn", text: "Pagina als tekst kopiëren", onclick: () => DT.copy(document.body.textContent) }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Naar AI-assistent", onclick: () => DT.module("ai")?.open(DT) })
      ])])),
      instellingen: () => {
        const T = DT.module("theme") || { presets: {} };
        const t = DT.settings.theme;
        const sel = (label, path, options, value) => {
          const el = DT.el("select", { class: "dt-btn", "aria-label": label, style: "max-width:100%" }, options.map(([v, l]) => { const o = DT.el("option", { value: v, text: l }); if (String(v) === String(value)) o.selected = true; return o; }));
          el.addEventListener("change", () => DT.saveSettings(set(path, el.value)));
          return DT.el("label", { class: "dt-field" }, [DT.el("span", { text: label }), el]);
        };
        const set = (path, value) => { const keys = path.split("."); const out = {}; let o = out; keys.slice(0, -1).forEach((k) => (o = o[k] = {})); o[keys.at(-1)] = value; return out; };
        const light = Object.entries(T.presets).filter(([, p]) => p.dark === false).map(([k, p]) => [k, p.label]);
        const darkP = Object.entries(T.presets).filter(([, p]) => p.dark === true).map(([k, p]) => [k, p.label]);
        const themeSel = DT.el("select", { class: "dt-btn", "aria-label": "Thema", style: "max-width:100%" }, [
          DT.el("optgroup", { label: "Licht" }, light.map(([k, l]) => DT.el("option", { value: k, text: l }))),
          DT.el("optgroup", { label: "Donker" }, darkP.map(([k, l]) => DT.el("option", { value: k, text: l }))),
          DT.el("optgroup", { label: "Zelf" }, [DT.el("option", { value: "custom", text: "Eigen accentkleur" })])
        ]);
        themeSel.value = t.preset || "magister";
        themeSel.addEventListener("change", () => { const p = T.presets[themeSel.value]; DT.saveSettings({ theme: { preset: themeSel.value, ...(p && p.dark !== null ? { [p.dark ? "darkPreset" : "lightPreset"]: themeSel.value } : {}) } }); });
        const color = DT.el("input", { type: "color", value: t.accent || "#1B3A5C", "aria-label": "Accentkleur" });
        color.addEventListener("input", () => DT.saveSettings({ theme: { accent: color.value } }));
        const mods = ["tables", "quickinput", "aanwezigheid", "navigation", "ai", "melding", "compact"].map((id) => {
          const cb = DT.el("input", { type: "checkbox" }); cb.checked = DT.settings[id]?.enabled !== false;
          cb.addEventListener("change", () => DT.saveSettings({ [id]: { enabled: cb.checked } }));
          const names = { tables: "Tabelexport", quickinput: "Sneller invoeren", aanwezigheid: "Snelle aanwezigheid", navigation: "Commandopalet", ai: "AI-hulp", melding: "Mail bij melding", compact: "Opgeruimde interface" };
          return DT.el("label", { style: "display:flex;gap:6px;align-items:center;font-size:13px" }, [cb, names[id]]);
        });
        return widget("Instellingen", DT.el("div", { style: "display:flex;flex-direction:column;gap:8px" }, [
          DT.el("label", { class: "dt-field" }, [DT.el("span", { text: "Thema" }), themeSel]),
          t.preset === "custom" ? DT.el("label", { class: "dt-field" }, [DT.el("span", { text: "Accentkleur" }), color]) : null,
          t.preset === "custom" ? sel("Modus", "theme.mode", [["auto", "Volg systeem"], ["light", "Licht"], ["dark", "Donker"]], t.mode) : null,
          sel("Donkere stijl", "theme.darkStyle", [["invert", "Inversie (overal)"], ["tokens", "Echte kleuren (nieuw)"]], t.darkStyle || "invert"),
          sel("Vaste kleuren", "theme.recolor", [["true", "Meekleuren (aanbevolen)"], ["false", "Laten zoals Magister"]], String(t.recolor !== false)),
          sel("Lettertype", "theme.font", [["thema", "Volgens thema"], ["standaard", "Magister standaard"], ["systeem", "Systeem"], ["rond", "Rond"], ["serif", "Serif"], ["mono", "Monospace"], ["smal", "Smal"], ["speels", "Speels"], ["dyslexie", "Dyslexie-vriendelijk"]], t.font || "thema"),
          sel("Lettergrootte", "theme.fontScale", [[0.85, "85%"], [0.9, "90%"], [1, "100%"], [1.1, "110%"], [1.2, "120%"], [1.35, "135%"]], t.fontScale || 1),
          sel("Hoeken", "theme.radius", [["thema", "Volgens thema"], ["0px", "Scherp"], ["4px", "Licht rond"], ["10px", "Rond"], ["18px", "Extra rond"]], t.radius || "thema"),
          sel("Exportknop", "tables.mode", [["hover", "Zwevend bij tabellen"], ["panel", "Alleen in dit paneel"]], DT.settings.tables.mode || "hover"),
          sel("Dichtheid", "theme.density", [["normal", "Normaal"], ["compact", "Compact (90%)"], ["extra", "Extra compact (80%)"]], t.density || "normal"),
          DT.el("div", { style: "font-size:12px;color:var(--dt-muted);margin-top:4px", text: "Modules" }),
          ...mods
        ]));
      },
      modules: () => widget("Overig", DT.el("div", { class: "dt-row" }, [
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Thema wisselen (Alt+T)", onclick: () => DT.module("theme")?.toggle(DT) }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Inspector starten", onclick: () => { this.toggle(false); DT.module("inspector")?.start(DT); } }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Alle instellingen", onclick: () => chrome.runtime.sendMessage({ type: "openOptions" }) })
      ]))
    };

    for (const id of [...widgets, "modules"]) {
      const b = builders[id]; if (b) body.append(b());
    }

    this._panel.replaceChildren(
      DT.el("div", { class: "dt-panel-head" }, [
        DT.el("h2", { text: "Docent Tools" }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Sluiten", "aria-label": "Paneel sluiten", onclick: () => this.toggle(false) })
      ]),
      body
    );
    this.tick();

    function widget(title, content, hint) {
      return DT.el("section", { class: "dt-widget" }, [DT.el("h3", { text: title }), content, hint ? DT.el("div", { style: "font-size:12px;color:var(--dt-muted);margin-top:6px", text: hint }) : null]);
    }
  }
});

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
