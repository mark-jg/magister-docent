/* Hoofdmenu: de items van Magisters hoofdmenu zelf rangschikken of verbergen.
 *
 * Verborgen items verdwijnen niet: ze staan onder een uitklapbaar item "Meer". Onderaan het menu staat "Menu
 * aanpassen"; daarmee krijgt elk item pijltjes (omhoog, omlaag) en een oogje (verbergen of tonen). Het geldt ook
 * voor de items die Docent Tools zelf toevoegt (Opleidingen, Te laat-balie).
 *
 * De items zelf blijven op hun plek in de pagina staan: Magister beheert die lijst. De volgorde komt uit de
 * CSS-eigenschap order en verbergen uit een klasse, zodat Magister er niets van merkt en alles terug is zodra de
 * module uit staat. Een item heet naar zijn tekst (kleine letters); de keuze staat in de instellingen
 * (hoofdmenu.volgorde en hoofdmenu.verborgen) en gaat dus mee naar andere computers. */
var MenuReken = {
  /* De naam van een item: zijn tekst, in kleine letters. */
  sleutel(tekst) { return String(tekst || "").replace(/\s+/g, " ").trim().toLowerCase(); },
  /* De items in de gekozen volgorde. namen: zoals ze in Magister staan; volgorde: de bewaarde keuze. Wat niet in
   * de keuze staat (een nieuw item) houdt zijn plek ten opzichte van zijn voorganger in Magister. */
  sorteer(namen, volgorde = []) {
    const plek = new Map(volgorde.map((n, i) => [n, i])), uit = namen.filter((n) => plek.has(n)).sort((a, b) => plek.get(a) - plek.get(b));
    namen.forEach((n, i) => {
      if (plek.has(n)) return;
      const voor = namen.slice(0, i).reverse().find((x) => uit.includes(x));
      uit.splice(voor == null ? 0 : uit.indexOf(voor) + 1, 0, n);
    });
    return uit;
  },
  /* Eén plek omhoog (-1) of omlaag (1), binnen de eigen groep (zichtbaar of verborgen). Geeft de nieuwe volgorde. */
  verplaats(gesorteerd, naam, richting, verborgen = []) {
    const weg = new Set(verborgen), groep = gesorteerd.filter((n) => weg.has(n) === weg.has(naam));
    const i = groep.indexOf(naam), j = i + richting;
    if (i < 0 || j < 0 || j >= groep.length) return gesorteerd.slice();
    const uit = gesorteerd.slice(), a = uit.indexOf(groep[i]), b = uit.indexOf(groep[j]);
    [uit[a], uit[b]] = [uit[b], uit[a]];
    return uit;
  },
};

DT.register({
  id: "hoofdmenu",
  _open: false, _pas: false,
  MEER: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`,
  PAS: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,

  init(DT) {
    if (!DT.isTop) return;
    this._stop = DT.observe(() => this.teken(DT), { debounce: 250, poll: 2000 });
    this._unsub = DT.onSettingsChange?.(() => this.teken(DT));
  },
  destroy() {
    this._stop && this._stop(); this._unsub && this._unsub();
    this._open = this._pas = false;
    const ul = document.querySelector("ul.main-menu"); if (!ul) return;
    ul.classList.remove("dt-menu-eigen", "dt-menu-meer-open", "dt-menu-pas");
    ul.querySelectorAll("#dt-menu-meer, #dt-menu-pas, .dt-menu-knoppen").forEach((el) => el.remove());
    for (const li of ul.children) { li.style.order = ""; li.classList.remove("dt-menu-verborgen"); }
  },

  keuze(DT) { const k = DT.settings.hoofdmenu || {}; return { volgorde: Array.isArray(k.volgorde) ? k.volgorde : [], verborgen: Array.isArray(k.verborgen) ? k.verborgen : [] }; },
  /* De echte items (niet "Meer" en "Menu aanpassen"), met hun naam. */
  items(ul) {
    return [...ul.querySelectorAll(":scope > li")].filter((li) => li.id !== "dt-menu-meer" && li.id !== "dt-menu-pas" && [...li.children].some((c) => c.localName === "a"))
      .map((li) => { const a = [...li.children].find((c) => c.localName === "a"); return { li, naam: MenuReken.sleutel((a.querySelector("span.caption") || a).textContent) }; })
      .filter((x) => x.naam);
  },
  bewaar(DT, patch) { return DT.saveSettings({ hoofdmenu: patch }); },

  teken(DT) {
    const ul = document.querySelector("ul.main-menu"); if (!ul) return;
    const k = this.keuze(DT), items = this.items(ul); if (!items.length) return;
    const namen = items.map((x) => x.naam), weg = new Set(k.verborgen.filter((n) => namen.includes(n))), rij = MenuReken.sorteer(namen, k.volgorde);
    /* De lijst als kolom, zodat order werkt; een menu dat al een flexbox is, laten we zoals het is. */
    if (!ul.classList.contains("dt-menu-eigen")) { ul.classList.add("dt-menu-eigen"); if (!/flex/.test(getComputedStyle(ul).display)) ul.classList.add("dt-menu-kolom"); }
    ul.classList.toggle("dt-menu-meer-open", this._open || this._pas);
    ul.classList.toggle("dt-menu-pas", this._pas);
    /* "Meer" en "Menu aanpassen": na de eerste ronde, zodat ze niet als voorbeeld voor elkaar dienen. */
    const meer = DT.menuItem({ id: "dt-menu-meer", titel: "Meer", tip: "Verborgen menu-items tonen", icoon: this.MEER, klik: () => { this._open = !this._open; this.teken(DT); } });
    const pas = DT.menuItem({ id: "dt-menu-pas", titel: "Menu aanpassen", tip: "Menu-items rangschikken of verbergen (Docent Tools)", icoon: this.PAS, klik: () => { this._pas = !this._pas; this.teken(DT); } });
    if (!meer || !pas) return;
    const zet = (li, tekst) => { const a = [...li.children].find((c) => c.localName === "a"), el = a.querySelector("span.caption") || [...a.children].find((c) => c.localName === "span"); if (el && el.textContent !== tekst) el.textContent = tekst; };
    zet(meer, `${this._open || this._pas ? "Minder" : "Meer"} (${weg.size})`); zet(pas, this._pas ? "Klaar" : "Menu aanpassen");
    meer.querySelector("a").setAttribute("aria-expanded", String(this._open || this._pas));
    meer.hidden = !weg.size; meer.style.display = weg.size ? "" : "none";
    /* Zonder verborgen items staat "Menu aanpassen" direct onderaan; anders pas na uitklappen. */
    pas.style.display = !weg.size || this._open || this._pas ? "" : "none";
    const zicht = rij.filter((n) => !weg.has(n)), verborgen = rij.filter((n) => weg.has(n));
    for (const { li, naam } of items) {
      const v = weg.has(naam), plek = v ? 5001 + verborgen.indexOf(naam) : 1 + zicht.indexOf(naam);
      if (li.style.order !== String(plek)) li.style.order = String(plek);
      li.classList.toggle("dt-menu-verborgen", v);
      this.knoppen(DT, li, naam, v);
    }
    meer.style.order = "5000"; pas.style.order = "9999";
    meer.classList.remove("dt-menu-verborgen", "active"); pas.classList.remove("dt-menu-verborgen"); pas.classList.toggle("active", this._pas);
  },

  /* In de aanpasstand: pijltjes en een oogje bij elk item. */
  knoppen(DT, li, naam, verborgen) {
    let el = li.querySelector(":scope > .dt-menu-knoppen");
    if (!this._pas) { el?.remove(); return; }
    if (el && el.dataset.v === String(verborgen)) return;
    el?.remove();
    const knop = (act, tip, teken) => DT.el("button", { type: "button", class: "dt-menu-knop", "data-act": act, title: tip, "aria-label": `${tip}: ${naam}`, text: teken });
    el = DT.el("span", { class: "dt-menu-knoppen", "data-v": String(verborgen) }, [knop("op", "Omhoog", "▲"), knop("neer", "Omlaag", "▼"), knop("oog", verborgen ? "Tonen" : "Verbergen", verborgen ? "＋" : "✕")]);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      this.actie(DT, naam, b.dataset.act);
    }, true);
    li.append(el);
  },
  actie(DT, naam, act) {
    const ul = document.querySelector("ul.main-menu"); if (!ul) return;
    const k = this.keuze(DT), namen = this.items(ul).map((x) => x.naam), rij = MenuReken.sorteer(namen, k.volgorde), weg = k.verborgen.filter((n) => namen.includes(n));
    /* Wat nu niet in het menu staat (een item van een module die uit staat) blijft in de keuze bewaard. */
    const rest = { volgorde: k.volgorde.filter((n) => !namen.includes(n)), verborgen: k.verborgen.filter((n) => !namen.includes(n)) };
    if (act === "oog") this.bewaar(DT, { volgorde: [...rij, ...rest.volgorde], verborgen: [...(weg.includes(naam) ? weg.filter((n) => n !== naam) : [...weg, naam]), ...rest.verborgen] });
    else this.bewaar(DT, { volgorde: [...MenuReken.verplaats(rij, naam, act === "op" ? -1 : 1, weg), ...rest.volgorde], verborgen: [...weg, ...rest.verborgen] });
    this.teken(DT);
  },
});
