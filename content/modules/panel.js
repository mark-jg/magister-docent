/* Docentenpaneel: zijpaneel met werkwidgets. Alt+D opent/sluit.
 * Widgets: klok + datum, snelle links, notities (lokaal opgeslagen) en de tabellen van de
 * pagina. Instellingen en module-schakelaars zitten in het bedieningspaneel (extensie-icoon)
 * en op de instellingenpagina, niet hier. */
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
      modules: () => widget("Acties", DT.el("div", { class: "dt-row" }, [
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Thema wisselen", title: "Alt+T", onclick: () => DT.module("theme")?.toggle(DT) }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Bedieningspaneel", title: "Modules aan- en uitzetten, thema kiezen", onclick: () => chrome.runtime.sendMessage({ type: "openPopup" }).catch(() => chrome.runtime.sendMessage({ type: "openOptions" })) }),
        DT.el("button", { class: "dt-btn dt-btn-sm", text: "Instellingen", onclick: () => chrome.runtime.sendMessage({ type: "openOptions" }) }),
        DT.settings.developer?.enabled ? DT.el("button", { class: "dt-btn dt-btn-sm", text: "Inspector", title: "Alt+I", onclick: () => { this.toggle(false); DT.module("inspector")?.start(DT); } }) : null
      ]))
    };

    for (const id of [...widgets.filter((w) => w !== "instellingen"), "modules"]) {
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
