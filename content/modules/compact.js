/* Opgeruimde interface: verbergt elementen op basis van een lijst CSS-selectors
 * die je zelf beheert in de instellingen (of via de Inspector: "Verberg dit").
 */
DT.register({
  id: "compact",
  _style: null,

  init(DT) {
    this._style = DT.el("style", { id: "dt-compact-style" });
    document.head.append(this._style);
    this._unsub = DT.onSettingsChange(() => this.apply(DT));
    this._stop = DT.observe(() => this.apply(DT), { debounce: 500 });
  },

  destroy(DT) {
    this._style?.remove();
    this._unsub && this._unsub();
    this._stop && this._stop();
    DT.deepQueryAll("[data-dt-hidden]").forEach((e) => { e.style.display = ""; delete e.dataset.dtHidden; });
  },

  apply(DT) {
    const list = (DT.settings.compact.hideSelectors || []).filter(Boolean);
    this._style.textContent = list.length ? `${list.join(",\n")} { display: none !important; }` : "";
    // Elementen in shadow DOM zijn met gewone CSS niet te bereiken: inline verbergen.
    DT.deepQueryAll("[data-dt-hidden]").forEach((e) => { if (!list.includes(e.dataset.dtHidden)) { e.style.display = ""; delete e.dataset.dtHidden; } });
    for (const sel of list) {
      for (const e of DT.deepQueryAll(sel)) { e.style.setProperty("display", "none", "important"); e.dataset.dtHidden = sel; }
    }
  },

  async hide(DT, selector) {
    const list = [...(DT.settings.compact.hideSelectors || [])];
    if (!list.includes(selector)) list.push(selector);
    await DT.saveSettings({ compact: { enabled: true, hideSelectors: list } });
    DT.toast("Element verborgen (te herstellen in instellingen)", "ok");
  }
});
