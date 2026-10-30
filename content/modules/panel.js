/* Docentenpaneel: zijpaneel met alle tools. Alt+D opent/sluit.
 * Bovenin het bedieningspaneel (thema, modules aan/uit, acties), daaronder de werkwidgets:
 * klok + datum, snelle links, notities (lokaal opgeslagen) en de tabellen van de pagina.
 * De popup bij het extensie-icoon is bewust minimaal (instellingen, ontwikkelaarsmodus, tab,
 * bijwerken). */
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
    this._handle.hidden = DT.settings.panel.handle === false;
    this.render(DT);
    this._unsub = DT.onSettingsChange(() => { this._handle.hidden = DT.settings.panel.handle === false; this.render(DT); });
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
      bediening: () => {
        const t = DT.settings.theme, P = globalThis.DT_PRESETS_LIST || [], M = globalThis.DT_MODULES_LIST || [];
        const sel = DT.el("select", { class: "dt-select", "aria-label": "Thema" }, [["Licht", false], ["Donker", true], ["Zelf", null]].map(([label, dark]) =>
          DT.el("optgroup", { label }, P.filter((x) => x[2] === dark).map(([v, l]) => DT.el("option", { value: v, text: l })))));
        sel.value = t.preset || "magister";
        sel.addEventListener("change", () => { const p = P.find((x) => x[0] === sel.value); DT.saveSettings({ theme: { preset: sel.value, ...(p && p[2] !== null ? { [p[2] ? "darkPreset" : "lightPreset"]: sel.value } : {}) } }); });
        const cur = P.find((x) => x[0] === t.preset);
        const isDark = cur ? cur[2] === true || (cur[2] === null && t.mode === "dark") : false;
        const seg = DT.el("div", { class: "dt-seg" }, [["light", "Licht"], ["dark", "Donker"]].map(([m, l]) => DT.el("button", { class: "dt-segbtn" + ((m === "dark") === isDark ? " is-on" : ""), text: l, onclick: () => {
          if (cur && cur[2] === null) return DT.saveSettings({ theme: { mode: m } });
          DT.saveSettings({ theme: { preset: m === "dark" ? (t.darkPreset || "nacht") : (t.lightPreset || "magister") } });
        } })));
        const tiles = DT.el("div", { class: "dt-tiles" }, M.filter(([id]) => id !== "panel").map(([id, label, sub, k]) => {
          const on = DT.settings[id]?.enabled !== false;
          const b = DT.el("button", { class: "dt-tile" + (on ? " is-on" : ""), style: `--k:${k}`, "aria-pressed": String(on), title: (on ? "Uitzetten: " : "Aanzetten: ") + label, onclick: () => DT.saveSettings({ [id]: { enabled: !on } }) });
          b.innerHTML = `<span class="dt-tile-ico">${DT_ICONS[id] || ""}</span><span><b>${label}</b><small>${sub}</small></span>`;
          return b;
        }));
        return DT.el("div", { class: "dt-bediening" }, [
          widget("Thema", DT.el("div", { class: "dt-theme-row" }, [sel, seg])),
          widget("Modules", tiles)
        ]);
      },
      modules: () => {
        const acts = [
          ["theme", "Thema", "Alt+T", () => DT.module("theme")?.toggle(DT)],
          ["export", "Excel", "Alt+E", () => DT.module("tables")?.exportAll(DT)],
          ["mail", "Mail coach", "Alt+M", () => DT.module("melding")?.trigger(DT)],
          DT.settings.developer?.enabled ? ["inspector", "Inspector", "Alt+I", () => { this.toggle(false); DT.module("inspector")?.start(DT); }] : ["options", "Instellingen", "", () => chrome.runtime.sendMessage({ type: "openOptions" })]
        ];
        return widget("Acties", DT.el("div", { class: "dt-actions" }, acts.map(([icon, label, kbd, go]) => {
          const b = DT.el("button", { class: "dt-action", title: kbd ? `${label} (${kbd})` : label, onclick: go });
          b.innerHTML = `<span class="dt-action-ico">${DT_ICONS[icon] || ""}</span><span>${label}</span>${kbd ? `<kbd>${kbd}</kbd>` : ""}`;
          return b;
        })));
      }
    };

    for (const id of ["bediening", "modules", ...widgets.filter((w) => w !== "instellingen")]) {
      const b = builders[id]; if (b) body.append(b());
    }

    this._panel.replaceChildren(
      DT.el("div", { class: "dt-panel-head" }, [
        DT.el("h2", {}, ["Docent Tools", DT.el("small", { text: `v${DT.version || ""}` })]),
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
  melding: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  ai: `<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>`,
  theme: `<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>`,
  export: `<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  mail: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  options: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  inspector: `<path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/>`,
}).map(([k, d]) => [k, `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`]));
