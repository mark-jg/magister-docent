/* Navigatie voor Magister OP.
 *  - Ctrl+K (of Alt+K): commandopalet. Typ een paar letters en Enter: springt naar
 *    een menu-onderdeel (Leerlingen, Toetsinvoer, Aanwezigheid, Berichten…) of
 *    voert een actie van Docent Tools uit.
 *  - Alt+1 t/m Alt+9: direct naar het n-de hoofdmenu-item.
 *  - Alt+S: zoekveld in de appbar (leerling, groep of stamnummer).
 * Leest het menu uit `ul.main-menu` (id's als #menu-leerlingen), dus het blijft
 * werken als Magister items toevoegt of verplaatst.
 */
DT.register({
  id: "navigation",
  _dlg: null,
  _key: null,

  init(DT) {
    if (!DT.isTop) return;
    this._key = (e) => this.onKey(DT, e);
    document.addEventListener("keydown", this._key, true);
  },

  destroy() {
    document.removeEventListener("keydown", this._key, true);
    this._dlg?.remove();
  },

  onKey(DT, e) {
    const typing = e.target && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); this.open(DT); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); this.open(DT); }
      if (k === "s") { e.preventDefault(); this.focusSearch(DT); }
      if (/^[1-9]$/.test(k) && !typing) {
        const items = this.menuItems().filter((i) => i.level === 0);
        const it = items[Number(k) - 1];
        if (it) { e.preventDefault(); it.go(); DT.toast(it.label); }
      }
    }
  },

  focusSearch(DT) {
    const f = DT.deepQuery("input[placeholder*='leerlingnaam' i], input[placeholder*='Zoek' i]");
    if (f) { f.focus(); f.select?.(); return; }
    const btn = DT.deepQuery("div.appbar div.menu-button button, button[aria-label*='Zoek' i]");
    if (btn) { btn.click(); setTimeout(() => DT.deepQuery("input[placeholder*='Zoek' i]")?.focus(), 300); }
    else DT.toast("Zoekveld niet gevonden op deze pagina", "err");
  },

  /* Menu-items uit de zijbalk: hoofditems (level 0) en subitems (level 1). */
  menuItems() {
    const out = [];
    const menu = document.querySelector("ul.main-menu") || document.querySelector("nav.menu");
    if (!menu) return out;
    const visit = (li, level) => {
      const a = [...li.children].find((c) => c.localName === "a");
      if (!a) return;
      const label = (a.querySelector("span.caption")?.textContent || [...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("") || a.textContent).trim().replace(/\s+/g, " ");
      if (!label) return;
      const href = a.getAttribute("href") || "";
      out.push({ id: li.id || label, label, level, href, go: () => a.click() });
      li.querySelectorAll(":scope > ul > li, :scope > div > ul > li").forEach((sub) => visit(sub, level + 1));
    };
    [...menu.querySelectorAll(":scope > li")].forEach((li) => visit(li, 0));
    return out;
  },

  actions(DT) {
    return [
      { label: "Paneel openen", hint: "Alt+D", go: () => DT.module("panel")?.toggle(true) },
      { label: "Thema wisselen", hint: "Alt+T", go: () => DT.module("theme")?.toggle(DT) },
      { label: "Tabellen naar Excel", hint: "Alt+E", go: () => DT.module("tables")?.exportAll(DT) },
      { label: "Zoeken (leerling, groep, stamnummer)", hint: "Alt+S", go: () => this.focusSearch(DT) },
      { label: "Naar AI-assistent", hint: "", go: () => DT.module("ai")?.open(DT) },
      { label: "Inspector", hint: "Alt+I", go: () => DT.module("inspector")?.start(DT) },
      { label: "Instellingen", hint: "", go: () => chrome.runtime.sendMessage({ type: "openOptions" }) },
      ...Object.entries(DT.module("theme")?.presets || {}).map(([id, p]) => ({
        label: `Thema: ${p.label}`, hint: p.dark === null ? "" : (p.dark ? "donker" : "licht"),
        go: () => DT.saveSettings({ theme: { preset: id, [p.dark ? "darkPreset" : "lightPreset"]: id } })
      }))
    ];
  },

  open(DT) {
    this._dlg?.remove();
    const items = this.menuItems();
    const tops = items.filter((x) => x.level === 0);
    const menu = items.map((m) => ({ ...m, group: "Menu", hint: m.level === 0 && tops.indexOf(m) < 9 ? `Alt+${tops.indexOf(m) + 1}` : "" }));
    const all = [...menu, ...this.actions(DT).map((a) => ({ ...a, group: "Docent Tools" }))];

    const input = DT.el("input", { type: "text", placeholder: "Waar wil je heen? (typ en Enter)", "aria-label": "Zoek in menu", style: "width:100%;box-sizing:border-box;font:16px var(--dt-font);padding:12px 14px;border:0;border-bottom:1px solid var(--dt-line);background:transparent;color:var(--dt-fg);outline:none" });
    const list = DT.el("div", { role: "listbox", style: "max-height:50vh;overflow-y:auto;padding:6px" });
    const dlg = DT.el("dialog", { id: "dt-palette", style: "border:0;border-radius:12px;padding:0;width:520px;max-width:92vw;font:14px var(--dt-font);color:var(--dt-fg);background:var(--dt-bg);box-shadow:var(--dt-shadow);margin-top:12vh" }, [input, list]);
    this._dlg = dlg;
    let sel = 0, shown = [];

    const render = () => {
      const q = input.value.trim().toLowerCase();
      shown = all.filter((it) => !q || fuzzy(it.label.toLowerCase(), q));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map((it, i) => DT.el("div", {
        role: "option", "aria-selected": i === sel ? "true" : "false",
        style: `display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:7px;cursor:pointer;${i === sel ? "background:var(--dt-accent);color:var(--dt-accent-ink)" : ""}${it.level ? ";padding-left:26px" : ""}`,
        onclick: () => choose(it), onmousemove: () => { if (sel !== i) { sel = i; render(); } }
      }, [
        DT.el("span", { text: it.label }),
        DT.el("span", { style: "font-size:11px;opacity:.75", text: it.hint || it.group })
      ])));
      list.children[sel]?.scrollIntoView({ block: "nearest" });
      if (!shown.length) list.append(DT.el("div", { style: "padding:12px;color:var(--dt-muted)", text: "Niets gevonden" }));
    };
    const close = () => { dlg.close(); dlg.remove(); };
    const choose = (it) => { close(); it.go(); };

    input.addEventListener("input", () => { sel = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % shown.length; render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; render(); }
      else if (e.key === "Enter") { e.preventDefault(); shown[sel] && choose(shown[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
      e.stopPropagation();
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    document.body.append(dlg);
    dlg.showModal();
    render();
  }
});

/* Eenvoudige fuzzy match: alle letters van q komen in volgorde voor in s. */
function fuzzy(s, q) {
  if (s.includes(q)) return true;
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length;
}
