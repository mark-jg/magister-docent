/* Sneller invoeren.
 * Generiek (werkt nu al):
 *  - Alt+D: paneel, Alt+T: thema, Alt+I: inspector, Alt+E: alle tabellen naar Excel
 *  - Esc: sluit paneel/inspector
 *  - Enter in een tekstveld binnen een tabel springt naar hetzelfde veld in de volgende rij
 *    (handig bij cijfers of opmerkingen per leerling invullen)
 *  - Ctrl+Shift+V plakt een kolom cijfers uit Excel in opeenvolgende velden
 *
 * Magister-specifiek (absentie in één klik, standaardopmerkingen, logboek):
 * de acties staan klaar in `actions` en worden actief zodra de selectors in
 * de instellingen zijn ingevuld (gebruik de Inspector om ze te vinden).
 */
DT.register({
  id: "quickinput",
  _handler: null,

  actions: {
    // Voorbeeldstructuur, vul in via instellingen > Selectors:
    // absentieKolom: { selector: "", label: "Absentie-vinkjes" },
    // cijferVeld:    { selector: "", label: "Cijferinvoerveld" },
  },

  init(DT) {
    this._handler = (e) => this.onKey(DT, e);
    document.addEventListener("keydown", this._handler, true);
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type !== "command") return;
      if (msg.command === "toggle-panel") DT.module("panel")?.toggle();
      if (msg.command === "toggle-theme") DT.module("theme")?.toggle(DT);
      if (msg.command === "export") DT.module("tables")?.exportAll(DT);
      if (msg.command === "inspector") DT.module("inspector")?.start(DT);
      if (msg.command === "mail-coach") DT.module("melding")?.trigger(DT);
    });
  },

  destroy() { document.removeEventListener("keydown", this._handler, true); },

  onKey(DT, e) {
    if (!DT.settings.quickinput.shortcuts) return;
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));

    if (e.key === "Escape") {
      DT.module("inspector")?.stop(DT);
      DT.module("panel")?.toggle(false);
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "d") { e.preventDefault(); DT.module("panel")?.toggle(); }
      if (k === "t") { e.preventDefault(); DT.module("theme")?.toggle(DT); }
      if (k === "i") { e.preventDefault(); DT.module("inspector")?.start(DT); }
      if (k === "e") { e.preventDefault(); DT.module("tables")?.exportAll(DT); }
      return;
    }
    // Enter in een invoerveld binnen een tabelrij: naar dezelfde kolom in de volgende rij.
    if (e.key === "Enter" && typing && !e.shiftKey && t.tagName === "INPUT") {
      const next = this.sameFieldNextRow(t);
      if (next) { e.preventDefault(); next.focus(); next.select?.(); }
    }
    // Ctrl+Shift+V: kolom uit klembord in opeenvolgende velden plakken.
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v" && typing && t.tagName === "INPUT") {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => this.pasteColumn(DT, t, text));
    }
  },

  sameFieldNextRow(input) {
    const cell = input.closest("td, th"); const row = cell?.parentElement;
    if (!row) return null;
    const idx = [...row.children].indexOf(cell);
    let r = row.nextElementSibling;
    while (r) {
      const f = r.children[idx]?.querySelector("input, textarea, select");
      if (f) return f;
      r = r.nextElementSibling;
    }
    return null;
  },

  pasteColumn(DT, start, text) {
    const values = text.split(/\r?\n/).map((v) => v.trim()).filter((v) => v !== "");
    let field = start, n = 0;
    for (const v of values) {
      if (!field) break;
      setValue(field, v); n++;
      field = this.sameFieldNextRow(field);
    }
    DT.toast(`${n} waarden ingevuld`, "ok");
  }
});

/* Vult een veld zó in dat frameworks (Angular/React) de wijziging ook zien. */
function setValue(field, value) {
  const proto = Object.getPrototypeOf(field);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter ? setter.call(field, value) : (field.value = value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}
window.DT.setValue = setValue;
