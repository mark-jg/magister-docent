/* Tabellen: herkent datatabellen (geen kalenders of roosters) en toont bij hover
 * een klein knopje "Exporteren" rechtsboven de tabel, met Excel, CSV, Kopiëren,
 * Naar AI en Kolommen en opties. Het zijpaneel toont alle tabellen van de pagina.
 *
 * Via "Instellen" (of direct bij een export, als "Altijd vragen" aanstaat) kies je:
 *  - welke kolommen meegaan
 *  - of de kopregel meegaat
 *  - of namen gemaskeerd worden (voor delen of AI-gebruik)
 *  - of lege rijen en lege kolommen weggelaten worden
 * De keuze wordt onthouden per soort tabel (op basis van de kolomkoppen), dus de
 * Insight-tabel en het lesdashboard houden elk hun eigen instelling.
 */
DT.register({
  id: "tables",
  _stop: null,

  _tables: [],
  _set: new WeakSet(),
  _chip: null, _frame: null, _menu: null, _current: null, _hideT: null,

  init(DT) {
    this._stop = DT.observe(() => this.scan(DT), { debounce: 500 });
    this.buildChip(DT);
    this._over = (e) => this.onOver(DT, e);
    this._scroll = () => this._current && this.place();
    document.addEventListener("mouseover", this._over, true);
    window.addEventListener("scroll", this._scroll, true);
    window.addEventListener("resize", this._scroll);
  },

  destroy() {
    this._stop && this._stop();
    document.removeEventListener("mouseover", this._over, true);
    window.removeEventListener("scroll", this._scroll, true);
    window.removeEventListener("resize", this._scroll);
    this._chip?.remove(); this._frame?.remove(); this._menu?.remove();
    DT.deepQueryAll(".dt-table-tools:not(.dt-att-bar)").forEach((n) => n.remove());
  },

  /* ---------- Welke tabellen tellen mee ---------- */

  SKIP: /calendar|kalender|agenda|rooster|schedule|datepicker|date-picker|fc-|week-view|dag-view/i,

  isDataTable(DT, t) {
    if (t.closest("#dt-panel, #dt-export-dialog, #dt-table-menu")) return false;
    if (t.getAttribute("role") === "presentation") return false;
    // Kalenders en roosters overslaan (op de tabel zelf of een voorouder, ook door shadow DOM heen).
    let n = t, depth = 0;
    while (n && depth < 12) {
      const id = (n.id || "") + " " + (typeof n.className === "string" ? n.className : "") + " " + (n.localName || "");
      if (this.SKIP.test(id)) return false;
      n = n.parentElement || n.getRootNode?.().host; depth++;
    }
    const r = t.getBoundingClientRect();
    if (r.width < 200 || r.height < 60) return false;
    const m = DT.tableToMatrix(t);
    if (m.length < 3) return false;                       // kop + minstens 2 rijen
    const width = Math.max(...m.map((x) => x.length));
    if (width < 2) return false;
    const cells = m.slice(1).flat();
    const filled = cells.filter((c) => c && c !== "nee").length;
    if (filled / Math.max(1, cells.length) < 0.3) return false;   // vooral lege cellen: layout, geen data
    return true;
  },

  scan(DT) {
    const found = [];
    for (const t of DT.deepQueryAll("table, [role=grid], [role=table], [role=treegrid]")) {
      if (t.closest("[role=grid], [role=table], [role=treegrid]") !== t && t.localName !== "table") continue;
      const rows = t.querySelectorAll("tr, [role=row], .ui-grid-row").length;
      if (t.dataset.dtRows !== String(rows)) { t.dataset.dtRows = rows; t.dataset.dtData = this.isDataTable(DT, t) ? "1" : "0"; }
      if (t.dataset.dtData === "1") {
        found.push(t); this._set.add(t);
        if (t.localName === "table") this.makeSortable(t);
      }
    }
    this._tables = found;
    if (this._current && !this._current.isConnected) this.hide(true);
  },

  name(t, i = 0) {
    const clean = (x) => (x || "").replace(/\s+/g, " ").trim().slice(0, 50);
    if (t.caption?.textContent) return clean(t.caption.textContent);
    if (t.getAttribute("aria-label")) return clean(t.getAttribute("aria-label"));
    let n = t;
    for (let d = 0; d < 5 && n; d++) {
      let p = n.previousElementSibling;
      while (p) {
        const txt = clean(p.textContent);
        if (txt && txt.length < 50 && /^(h\d|header)$/i.test(p.localName) || /header|title|kop/i.test(p.className || "")) { if (txt) return txt; }
        p = p.previousElementSibling;
      }
      n = n.parentElement || n.getRootNode?.().host;
    }
    const h = document.querySelector("ui-view h1, h1")?.textContent;
    return clean(h) ? `${clean(h)}${i ? " " + (i + 1) : ""}` : `Tabel ${i + 1}`;
  },

  /* ---------- Zwevend knopje ---------- */

  buildChip(DT) {
    this._frame = DT.el("div", { id: "dt-table-frame" });
    this._chip = DT.el("button", { id: "dt-table-chip", type: "button", title: "Tabel exporteren", "aria-label": "Tabel exporteren" }, [
      DT.el("span", { class: "dt-chip-icon", html: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5v8.2m0 0L4.8 6.5M8 9.7l3.2-3.2M2.5 11v2.5h11V11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      DT.el("span", { text: "Exporteren" })
    ]);
    this._chip.addEventListener("click", (e) => { e.stopPropagation(); this.toggleMenu(DT); });
    this._chip.addEventListener("mouseenter", () => clearTimeout(this._hideT));
    this._chip.addEventListener("mouseleave", () => this.scheduleHide());
    document.body.append(this._frame, this._chip);
    document.addEventListener("click", (e) => { if (this._menu && !e.composedPath().includes(this._menu)) this.closeMenu(); });
  },

  onOver(DT, e) {
    if (DT.settings.tables.mode === "panel") return;
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (path.includes(this._chip) || (this._menu && path.includes(this._menu))) { clearTimeout(this._hideT); return; }
    const t = path.find((n) => n && n.nodeType === 1 && this._set.has(n));
    if (t) { clearTimeout(this._hideT); if (t !== this._current) { this._current = t; this.closeMenu(); } this.place(); this._chip.classList.add("dt-show"); }
    else if (this._current) this.scheduleHide();
  },

  scheduleHide() { clearTimeout(this._hideT); this._hideT = setTimeout(() => { if (!this._menu) this.hide(); }, 350); },
  hide(force) { if (this._menu && !force) return; this._chip.classList.remove("dt-show"); this._frame.classList.remove("dt-show"); this._current = null; this.closeMenu(); },

  place() {
    const t = this._current; if (!t) return;
    const r = t.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { this._chip.classList.remove("dt-show"); return; }
    const top = Math.max(8, r.top + 6), right = Math.max(8, innerWidth - r.right + 6);
    Object.assign(this._chip.style, { top: top + "px", right: right + "px" });
    Object.assign(this._frame.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
    if (this._menu) { const c = this._chip.getBoundingClientRect(); Object.assign(this._menu.style, { top: c.bottom + 6 + "px", right: innerWidth - c.right + "px" }); }
  },

  toggleMenu(DT) {
    if (this._menu) return this.closeMenu();
    const t = this._current; if (!t) return;
    const m = DT.tableToMatrix(t);
    const nm = this.name(t, this._tables.indexOf(t));
    const item = (label, hint, fn) => DT.el("button", { type: "button", class: "dt-menu-item", onclick: (e) => { e.stopPropagation(); this.closeMenu(); this.hide(true); fn(); } }, [DT.el("span", { text: label }), hint ? DT.el("small", { text: hint }) : null]);
    this._menu = DT.el("div", { id: "dt-table-menu", role: "menu" }, [
      DT.el("div", { class: "dt-menu-head" }, [DT.el("strong", { text: nm }), DT.el("small", { text: `${m.length - 1} rijen · ${Math.max(...m.map((r) => r.length))} kolommen` })]),
      item("Excel", ".xlsx", () => this.run(DT, t, "xlsx", nm)),
      item("CSV", ".csv", () => this.run(DT, t, "csv", nm)),
      item("Kopiëren", "plakken in Excel", () => this.run(DT, t, "copy", nm)),
      item("Naar AI", "met sjablonen", () => this.run(DT, t, "ai", nm)),
      DT.el("div", { class: "dt-menu-sep" }),
      item("Kolommen en opties…", "", () => this.dialog(DT, t, null, nm))
    ]);
    this._frame.classList.add("dt-show");
    document.body.append(this._menu);
    this.place();
  },

  closeMenu() { this._menu?.remove(); this._menu = null; this._frame?.classList.remove("dt-show"); },

  /* Lijst voor het zijpaneel. */
  listInto(DT, host) {
    this.scan(DT);
    host.replaceChildren();
    if (!this._tables.length) { host.append(DT.el("div", { style: "font-size:13px;color:var(--dt-muted)", text: "Geen datatabellen op deze pagina." })); return; }
    this._tables.forEach((t, i) => {
      const nm = this.name(t, i), rows = DT.tableToMatrix(t).length - 1;
      host.append(DT.el("div", { class: "dt-tablerow" }, [
        DT.el("button", { type: "button", class: "dt-linkbtn", title: "Toon tabel", text: `${nm} (${rows})`, onclick: () => { t.scrollIntoView({ behavior: "smooth", block: "center" }); this._current = t; this.place(); this._frame.classList.add("dt-show"); setTimeout(() => this._frame.classList.remove("dt-show"), 1500); } }),
        DT.el("div", { class: "dt-row" }, [
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "Excel", onclick: () => this.run(DT, t, "xlsx", nm) }),
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "CSV", onclick: () => this.run(DT, t, "csv", nm) }),
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "Kopieer", onclick: () => this.run(DT, t, "copy", nm) }),
          DT.el("button", { class: "dt-btn dt-btn-sm", text: "Opties", onclick: () => this.dialog(DT, t, null, nm) })
        ])
      ]));
    });
  },

  /* ---------- Exportinstellingen ---------- */

  signature(matrix) {
    return "cols:" + (matrix[0] || []).map((h) => h.replace(/\d+/g, "").trim().toLowerCase()).join("|").slice(0, 300);
  },

  async getPrefs(DT, matrix) {
    const key = this.signature(matrix);
    const { exportPrefs = {} } = await chrome.storage.local.get("exportPrefs");
    return { key, prefs: exportPrefs[key] || null, all: exportPrefs };
  },

  async savePrefs(key, prefs, all) {
    all[key] = prefs;
    await chrome.storage.local.set({ exportPrefs: all });
  },

  /* Past kolomkeuze, maskering en filters toe op de ruwe matrix. */
  shape(matrix, prefs) {
    if (!matrix.length) return matrix;
    const width = Math.max(...matrix.map((r) => r.length));
    let cols = [...Array(width).keys()];
    if (prefs?.columns) cols = cols.filter((i) => prefs.columns[i] !== false);
    let rows = matrix.map((r) => cols.map((i) => r[i] ?? ""));
    if (prefs?.dropEmptyCols) {
      const keep = cols.map((_, ci) => rows.slice(1).some((r) => r[ci] && r[ci] !== "nee"));
      rows = rows.map((r) => r.filter((_, ci) => keep[ci]));
    }
    if (prefs?.dropEmptyRows) rows = rows.filter((r, i) => i === 0 || r.some((c) => c && c !== "nee"));
    if (prefs?.maskNames) {
      const head = rows[0] || [];
      const nameCols = head.map((h, i) => /naam|leerling|student/i.test(h) ? i : -1).filter((i) => i >= 0);
      rows = rows.map((r, ri) => ri === 0 ? r : r.map((c, ci) => nameCols.includes(ci) ? `Leerling ${ri}` : c));
    }
    if (prefs?.header === false) rows = rows.slice(1);
    return rows;
  },

  async run(DT, table, format, name) {
    const matrix = DT.tableToMatrix(table);
    const { prefs } = await this.getPrefs(DT, matrix);
    const ask = DT.settings.tables.alwaysAsk;
    if (ask || (format === "ai" && !prefs)) return this.dialog(DT, table, format, name);
    this.output(DT, this.shape(matrix, prefs), format, name);
  },

  output(DT, rows, format, name) {
    if (!rows.length) return DT.toast("Niets te exporteren met deze instellingen", "err");
    const tsv = rows.map((r) => r.join("\t")).join("\n");
    if (format === "copy") return DT.copy(tsv);
    if (format === "ai") return DT.module("ai")?.open(DT, tsv);
    if (format === "csv") {
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
      DT.download(`${safe(name)}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
      return DT.toast("CSV gedownload", "ok");
    }
    this.toXlsx(DT, [[name, rows]]);
  },

  dialog(DT, table, format, name) {
    document.getElementById("dt-export-dialog")?.remove();
    const matrix = DT.tableToMatrix(table);
    this.getPrefs(DT, matrix).then(({ key, prefs, all }) => {
      const head = matrix[0] || [];
      const p = { header: true, maskNames: false, dropEmptyRows: false, dropEmptyCols: false, columns: {}, ...(prefs || {}) };
      const colBoxes = head.map((h, i) => {
        const cb = DT.el("input", { type: "checkbox" }); cb.checked = p.columns?.[i] !== false;
        return DT.el("label", { style: "display:flex;gap:8px;align-items:center;padding:3px 0" }, [cb, DT.el("span", { text: h.replace(/\s+/g, " ") || `Kolom ${i + 1}` })]);
      });
      const opt = (key2, label, hint) => { const cb = DT.el("input", { type: "checkbox" }); cb.checked = !!p[key2]; cb.dataset.key = key2;
        return DT.el("label", { style: "display:flex;gap:8px;align-items:center;padding:3px 0" }, [cb, DT.el("span", { text: label, title: hint || "" })]); };
      const opts = [opt("header", "Kopregel meenemen"), opt("maskNames", "Namen maskeren (Leerling 1, 2, …)", "Vervangt naamkolommen"), opt("dropEmptyRows", "Lege rijen weglaten"), opt("dropEmptyCols", "Lege kolommen weglaten")];
      const preview = DT.el("div", { style: "font-size:12px;color:var(--dt-muted)" });
      const collect = () => {
        const np = { columns: {} };
        colBoxes.forEach((l, i) => { np.columns[i] = l.querySelector("input").checked; });
        opts.forEach((l) => { const cb = l.querySelector("input"); np[cb.dataset.key] = cb.checked; });
        const shaped = this.shape(matrix, np);
        preview.textContent = `${Math.max(0, shaped.length - (np.header ? 1 : 0))} rijen, ${shaped[0]?.length || 0} kolommen`;
        return np;
      };
      const dlg = DT.el("dialog", { id: "dt-export-dialog", style: "border:0;border-radius:12px;padding:0;width:480px;max-width:92vw;font:14px var(--dt-font);color:var(--dt-fg);background:var(--dt-bg);box-shadow:var(--dt-shadow)" });
      dlg.addEventListener("change", collect);
      const close = () => { dlg.close(); dlg.remove(); };
      const doExport = async (fmt) => { const np = collect(); await this.savePrefs(key, np, all); close(); this.output(DT, this.shape(matrix, np), fmt, name); };
      dlg.append(
        DT.el("div", { class: "dt-panel-head" }, [DT.el("h2", { text: "Export instellen" }), DT.el("button", { class: "dt-btn dt-btn-sm", text: "Sluiten", onclick: close })]),
        DT.el("div", { style: "padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px" }, [
          DT.el("div", {}, [DT.el("h3", { style: "font-size:13px;margin:0 0 6px;color:var(--dt-muted)", text: "Kolommen" }),
            DT.el("div", { class: "dt-row", style: "margin-bottom:6px" }, [
              DT.el("button", { class: "dt-btn dt-btn-sm", text: "Alles", onclick: () => { colBoxes.forEach((l) => l.querySelector("input").checked = true); collect(); } }),
              DT.el("button", { class: "dt-btn dt-btn-sm", text: "Niets", onclick: () => { colBoxes.forEach((l) => l.querySelector("input").checked = false); collect(); } })]),
            DT.el("div", { style: "max-height:40vh;overflow-y:auto" }, colBoxes)]),
          DT.el("div", {}, [DT.el("h3", { style: "font-size:13px;margin:0 0 6px;color:var(--dt-muted)", text: "Opties" }), ...opts, DT.el("div", { style: "margin-top:10px" }, preview)])
        ]),
        DT.el("div", { style: "padding:0 16px 14px;font-size:12px;color:var(--dt-muted)", text: "Deze keuze wordt onthouden voor tabellen met dezelfde kolommen." }),
        DT.el("div", { class: "dt-row", style: "padding:0 16px 16px;justify-content:flex-end" }, [
          DT.el("button", { class: "dt-btn", text: "Opslaan", onclick: async () => { await this.savePrefs(key, collect(), all); close(); DT.toast("Exportinstellingen opgeslagen", "ok"); } }),
          ...(format ? [DT.el("button", { class: "dt-btn dt-btn-primary", text: { xlsx: "Excel", csv: "CSV", copy: "Kopiëren", ai: "Naar AI" }[format], onclick: () => doExport(format) })]
                    : [DT.el("button", { class: "dt-btn dt-btn-primary", text: "Excel", onclick: () => doExport("xlsx") }), DT.el("button", { class: "dt-btn", text: "CSV", onclick: () => doExport("csv") }), DT.el("button", { class: "dt-btn", text: "Kopiëren", onclick: () => doExport("copy") })])
        ])
      );
      document.body.append(dlg); dlg.showModal(); collect();
    });
  },

  /* ---------- Uitvoer ---------- */

  makeSortable(table) {
    const head = table.querySelector("thead tr") || table.querySelector("tr");
    if (!head) return;
    [...head.children].forEach((th, i) => {
      if (th.dataset.dtSort) return;
      th.dataset.dtSort = "1"; th.style.cursor = "pointer";
      th.title = (th.title ? th.title + " · " : "") + "Klik om te sorteren";
      th.addEventListener("click", (e) => {
        if (e.target.closest("a, button, input")) return;
        const body = table.tBodies[0] || table;
        const rows = [...body.querySelectorAll("tr")].filter((r) => r !== head);
        const asc = th.dataset.dtDir !== "asc"; th.dataset.dtDir = asc ? "asc" : "desc";
        const val = (r) => (r.children[i]?.textContent || "").trim();
        const num = (v) => parseFloat(v.replace(",", "."));
        rows.sort((a, b) => { const x = val(a), y = val(b), nx = num(x), ny = num(y);
          const cmp = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, "nl"); return asc ? cmp : -cmp; });
        rows.forEach((r) => body.append(r));
      });
    });
  },

  toXlsx(DT, entries) {
    if (typeof XLSX === "undefined") return DT.toast("Excel-bibliotheek niet geladen", "err");
    const wb = XLSX.utils.book_new(); const used = new Set();
    entries.forEach(([name, rows], idx) => {
      const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map(coerce)));
      let sheet = safe(name).slice(0, 28) || `Tabel ${idx + 1}`;
      let n = 1; while (used.has(sheet)) sheet = sheet.slice(0, 25) + " " + ++n;
      used.add(sheet); XLSX.utils.book_append_sheet(wb, ws, sheet);
    });
    XLSX.writeFile(wb, `magister-${new Date().toISOString().slice(0, 10)}.xlsx`);
    DT.toast("Excel-bestand gedownload", "ok");
  },

  async exportAll(DT) {
    this.scan(DT);
    const tables = this._tables;
    if (!tables.length) return DT.toast("Geen datatabellen gevonden op deze pagina", "err");
    const entries = [];
    for (const [i, t] of tables.entries()) {
      const m = DT.tableToMatrix(t); const { prefs } = await this.getPrefs(DT, m);
      entries.push([this.name(t, i), this.shape(m, prefs)]);
    }
    this.toXlsx(DT, entries);
  }
});

/* Getallen als getal naar Excel (7,5 wordt 7.5), de rest als tekst. */
function coerce(c) {
  const s = String(c).trim();
  if (/^-?\d{1,6}([.,]\d+)?$/.test(s)) return parseFloat(s.replace(",", "."));
  return s;
}
function safe(s) { return String(s).replace(/[\\/:*?"<>|\[\]]/g, "-").replace(/\s+/g, " ").trim(); }
