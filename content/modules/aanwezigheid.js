/* Snelle aanwezigheid: Lesdashboard > leerlinglijst (AngularJS ui-grid).
 *
 * Boven de registratielijst verschijnt een balk met:
 *  - Iedereen aanwezig: vinkt Pr aan bij elke leerling die nog niets heeft
 *  - Toetsenbord: loop met pijltjes door de lijst en zet registraties met letters
 *      P aanwezig · A absent · V vrijstelling · T te laat · U uitgestuurd
 *      H huiswerk vergeten · M materiaal vergeten · K mobiel in klas
 *      (letter = eerste letter van de kolomkop, dus dit volgt jullie instellingen)
 *      Spatie = Pr aan/uit, Enter/↓ = volgende, ↑ = vorige, Esc = stoppen
 *  - Zoekveld: typ een paar letters van een naam om direct naar die leerling te springen
 *
 * De vinkjes worden met een echte klik gezet, zodat Magister de wijziging registreert
 * en zelf opslaat zoals altijd. Er wordt niets buiten Magister om verstuurd.
 */
DT.register({
  id: "aanwezigheid",
  _stop: null,
  _active: false,
  _row: 0,
  _key: null,

  init(DT) {
    this._stop = DT.observe(() => this.decorate(DT), { debounce: 500 });
    this._key = (e) => this.onKey(DT, e);
    document.addEventListener("keydown", this._key, true);
  },

  destroy(DT) {
    this._stop && this._stop();
    document.removeEventListener("keydown", this._key, true);
    document.querySelectorAll(".dt-att-bar").forEach((n) => n.remove());
    this.stopKeyboard();
  },

  /* Alle ui-grids met leerlingen in de leerlinglijst. Vóór het afsluiten van een les
   * is dat er één; daarna twee (aanwezig en afwezig). */
  grids() {
    return [...document.querySelectorAll("#leerlinglijst [role=grid]")].filter((g) => g.querySelector(".ui-grid-canvas .ui-grid-row"));
  },
  grid() { return this.grids()[0] || null; },

  columns(grid) {
    const heads = [...grid.querySelectorAll(".ui-grid-header-cell-row .ui-grid-header-cell")];
    const cols = heads.map((h, i) => ({ index: i, label: h.textContent.replace(/\d+/g, "").replace(/\s+/g, " ").trim(), key: "" }));
    // Sneltoets per kolom: eerste letter, bij een dubbele de tweede (Mv = M, Mk = K).
    const used = new Set();
    for (const c of cols) {
      if (!c.label || /^(naam|groep)$/i.test(c.label)) continue;
      const letters = c.label.toLowerCase().replace(/[^a-z]/g, "");
      c.key = [...letters].find((l) => !used.has(l)) || "";
      if (c.key) used.add(c.key);
    }
    return cols;
  },

  rows() {
    return this.grids().flatMap((grid) => [...grid.querySelectorAll(".ui-grid-canvas .ui-grid-row")]).map((row) => {
      const cells = [...row.querySelectorAll(".ui-grid-cell")];
      return {
        el: row,
        name: (cells[0]?.textContent || "").replace(/\s+/g, " ").trim(),
        boxes: cells.map((c) => c.querySelector("input[type=checkbox]"))
      };
    });
  },

  decorate(DT) {
    const grid = this.grid();
    if (!grid) { this.stopKeyboard(); return; }
    const host = document.querySelector("#leerlinglijst");
    if (!host || host.querySelector(".dt-att-bar")) return;
    const cols = this.columns(grid);
    const legend = cols.filter((c) => c.key).map((c) => `${c.key.toUpperCase()} = ${c.label}`).join(" · ");

    const search = DT.el("input", { type: "text", placeholder: "Spring naar naam…", "aria-label": "Zoek leerling", class: "dt-btn", style: "width:170px" });
    search.addEventListener("input", () => this.jumpTo(DT, search.value));
    search.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.startKeyboard(DT, this._row); search.blur(); } });

    const bar = DT.el("div", { class: "dt-table-tools dt-att-bar" }, [
      DT.el("span", { text: "Docent Tools:" }),
      DT.el("button", { class: "dt-btn dt-btn-sm dt-btn-primary", text: "Iedereen aanwezig", onclick: () => this.allPresent(DT) }),
      DT.el("button", { class: "dt-btn dt-btn-sm", text: "Toetsenbord (Alt+A)", onclick: () => this.startKeyboard(DT, 0) }),
      search,
      DT.el("span", { style: "opacity:.8", text: legend })
    ]);
    host.insertBefore(bar, host.firstChild);
  },

  colIndex(grid, letter) {
    return this.columns(grid).find((c) => c.key === letter)?.index ?? -1;
  },

  allPresent(DT) {
    const grid = this.grid(); if (!grid) return;
    const pr = this.colIndex(grid, "p");
    if (pr < 0) return DT.toast("Kolom Pr niet gevonden", "err");
    let n = 0;
    for (const r of this.rows()) {
      const any = r.boxes.some((b) => b && b.checked);
      const box = r.boxes[pr];
      if (box && !any && !box.checked) { box.click(); n++; }
    }
    DT.toast(n ? `${n} leerlingen op aanwezig gezet (leerlingen met een registratie zijn overgeslagen)` : "Iedereen had al een registratie", "ok", 4000);
  },

  jumpTo(DT, text) {
    const grid = this.grid(); if (!grid || !text) return;
    const q = text.toLowerCase();
    const rows = this.rows();
    const i = rows.findIndex((r) => r.name.toLowerCase().includes(q));
    if (i >= 0) { this._row = i; this.highlight(rows, i); }
  },

  startKeyboard(DT, index = 0) {
    const grid = this.grid(); if (!grid) return DT.toast("Geen registratielijst op deze pagina", "err");
    this._active = true; this._row = index;
    this.highlight(this.rows(), index);
    DT.toast("Toetsenbordmodus: pijltjes, letters voor registraties, Esc om te stoppen", "info", 4000);
  },

  stopKeyboard() {
    this._active = false;
    document.querySelectorAll(".dt-att-current").forEach((r) => { r.classList.remove("dt-att-current"); r.style.outline = ""; });
  },

  highlight(rows, i) {
    rows.forEach((r) => { r.el.classList.remove("dt-att-current"); r.el.style.outline = ""; });
    const r = rows[i]; if (!r) return;
    r.el.classList.add("dt-att-current");
    r.el.style.outline = "3px solid var(--dt-gold)";
    r.el.style.outlineOffset = "-3px";
    r.el.scrollIntoView({ block: "nearest" });
  },

  onKey(DT, e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "a") {
      if (this.grid()) { e.preventDefault(); this._active ? this.stopKeyboard() : this.startKeyboard(DT, this._row); }
      return;
    }
    if (!this._active) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName) && e.target.type !== "checkbox") return;
    const grid = this.grid(); if (!grid) return this.stopKeyboard();
    const rows = this.rows();
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); this.stopKeyboard(); DT.toast("Toetsenbordmodus gestopt"); return; }
    if (k === "ArrowDown" || k === "Enter") { e.preventDefault(); this._row = Math.min(rows.length - 1, this._row + 1); this.highlight(rows, this._row); return; }
    if (k === "ArrowUp") { e.preventDefault(); this._row = Math.max(0, this._row - 1); this.highlight(rows, this._row); return; }
    const letter = k === " " ? "p" : k.toLowerCase();
    if (!/^[a-z]$/.test(letter)) return;
    const col = this.colIndex(grid, letter);
    if (col < 0) return;
    e.preventDefault(); e.stopPropagation();
    const box = rows[this._row]?.boxes[col];
    if (box) { box.click(); DT.toast(`${rows[this._row].name.split(" ").slice(1, 3).join(" ")}: ${this.columns(grid)[col].label} ${box.checked ? "aan" : "uit"}`, "ok", 1200); }
    // Aanwezig (P) of spatie: meteen door naar de volgende leerling.
    if (letter === "p" && this._row < rows.length - 1) { this._row++; this.highlight(rows, this._row); }
  }
});
