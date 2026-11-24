/* Zijkolom: het handvat "Docentdeck" aan de rand van de pagina.
 * Het paneel zelf staat sinds 0.61 in de zijkolom van de browser (sidepanel/), zodat het niet meer over de pagina
 * valt en in breedte te verstellen is. Deze module opent die kolom: via het handvat, Alt+D of het commandopalet.
 * Wat de kolom van de pagina nodig heeft (tabellen, exports) regelt content/kolom.js. */
DT.register({
  id: "panel",
  _handle: null,

  init(DT) {
    if (!DT.isTop) return;
    const pos = DT.settings.panel.position === "left" ? "dt-left" : "";
    this._handle = DT.el("button", { id: "dt-handle", class: pos, type: "button", text: "Docentdeck", title: "Zijkolom openen of sluiten (Alt+D)", onclick: () => this.toggle() });
    document.body.append(this._handle);
    this._handle.hidden = DT.settings.panel.handle === false;
    this._unsub = DT.onSettingsChange(() => { if (this._handle) this._handle.hidden = DT.settings.panel.handle === false; });
    /* Alt+D in een iframe (logboek, leerlingkaart): dat frame vraagt het hoofdvenster de kolom te wisselen. */
    this._cmd = (e) => { if (DT.sameOrigin(e.source) && e.data?.type === "dt:cmd" && e.data.command === "toggle-panel") this.toggle(); };
    window.addEventListener("message", this._cmd);
  },

  destroy() {
    this._handle?.remove(); this._handle = null;
    this._unsub && this._unsub();
    this._cmd && window.removeEventListener("message", this._cmd);
  },

  /* Zonder argument: de kolom openen of sluiten. toggle(true) opent; toggle(false) doet niets (Escape op de pagina
   * sluit de kolom van de browser niet). De browser opent de kolom alleen na een klik of toets, vandaar direct. */
  toggle(force) {
    if (force === false) return;
    if (!DT.isTop) { try { window.top.postMessage({ type: "dt:cmd", command: "toggle-panel" }, location.origin); } catch {} return; }
    try {
      chrome.runtime.sendMessage({ type: "zijkolom", alleenOpenen: force === true }).catch(() => DT.toast("De zijkolom openen lukte niet. Klik op het icoon van Docentdeck in de werkbalk.", "err", 5000));
    } catch { DT.toast("De extensie is bijgewerkt: herlaad dit tabblad.", "err", 5000); }
  }
});
