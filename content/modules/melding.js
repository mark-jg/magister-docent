/* Melding Expertisecentrum -> mail naar de begeleidingscoach.
 *
 * Twee plekken:
 *  - magister-lvs/#/create/...   nieuwe melding: knop "Mail coach" naast "Volgende"
 *  - magister-lvs/#/overview/... logboek: mailknop in de knoppenbalk van elk item
 *                                 van het type Melding Expertisecentrum
 * De knop leest het formulier of het geopende item uit, toont een controlescherm
 * (naam, studentnr, klas, aangemeld voor, samenvatting) en opent daarna een
 * voorgevulde concept-mail in Outlook via mailto:. Sneltoets op de
 * aanmaakpagina: Alt+M.
 *
 * Instellingen (instellingenpagina, of via het controlescherm):
 *   melding.to        e-mailadres begeleidingscoach
 *   melding.cc        optioneel cc-adres
 *   melding.name      naam begeleidingscoach (voor de aanhef)
 *   melding.afzender  je eigen naam onder de mail
 *   melding.extra     ook problematiek, hulp en ouders meesturen
 */
DT.register({
  id: "melding",
  _btn: null,
  _itemBtns: [],
  _stop: null,
  _dlg: null,
  _style: null,

  /* Labels van de vakjes "voor wie aangemeld" (groep in app-dynamic-fields). */
  TARGETS: [
    "Rekenondersteuning", "Taalondersteuning",
    "Spreekuur preventiemedewerker Arkin", "Spreekuur preventiemedewerker Jellinek",
    "Jongerenpunt / Doorstroompunt", "Jeugdarts", "Jeugdadviseur",
    "Decaan / loopbaanadviseur", "Budgetcoach", "Begeleider Passend Onderwijs", "Anders"
  ],
  PROBLEMS: [
    "Thuissituatie", "Psychische problemen", "Leerproblematiek",
    "Gedragsproblematiek", "Fysieke / medische problemen", "Absentie"
  ],

  defaults() {
    return Object.assign({ coaches: [], to: "", cc: "", name: "", extra: true, afzender: "" }, DT.settings.melding || {});
  },

  /* Lijst met coaches uit de instellingen; een oude losse instelling (to + name) telt als één coach. */
  coaches(s) {
    const list = (s.coaches || []).filter((c) => c && c.email).map((c) => ({ name: (c.name || "").trim(), email: c.email.trim() }));
    if (!list.length && s.to) list.push({ name: s.name || "", email: s.to });
    return list;
  },

  /* Sneltoets of popup: open het controlescherm als deze frame een melding toont. */
  trigger(DT) {
    if (this.isMeldingPage()) return this.open(DT, document);
    if (this.isOverviewPage()) {
      const items = DT.deepQueryAll("app-logbook-item").filter((it) => /expertisecentrum/i.test(this.textOf(DT.deepQuery("dna-card-title div.type", it))));
      const open = items.find((it) => DT.deepQuery("app-overzicht-tab", it)) || (items.length === 1 ? items[0] : null);
      if (open) return this.openItem(DT, open);
      if (items.length) DT.toast("Klap eerst de gewenste melding open, of klik op ✉ bij de melding", "info", 3500);
    }
  },

  init(DT) {
    this._style = DT.el("style", { id: "dt-melding-style", text: this.css() });
    document.head.append(this._style);
    this._onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m" && this.isMeldingPage()) {
        e.preventDefault(); this.trigger(DT);
      }
    };
    document.addEventListener("keydown", this._onKey);
    this._stop = DT.observe(() => this.mount(DT), { debounce: 400 });
  },

  destroy(DT) {
    this._stop && this._stop();
    document.removeEventListener("keydown", this._onKey);
    this._btn?.remove(); this._dlg?.remove(); this._style?.remove();
    this._itemBtns.forEach((b) => b.remove()); this._itemBtns = [];
  },

  isMeldingPage() {
    return /magister-lvs\/#\/create\//.test(location.href) && !!DT.deepQuery("app-dynamic-fields");
  },
  isOverviewPage() {
    return /magister-lvs\/#\/overview\//.test(location.href) && !!DT.deepQuery("app-logbook-list");
  },

  BTN_STYLE: "display:inline-flex;align-items:center;gap:.5rem;height:2.5rem;padding:0 1rem;border-radius:var(--dna-button-border-radius,8px);" +
    "border:var(--dna-button-border-width,2px) solid #1B3A5C;background:#fff;color:#1B3A5C;font:600 .875rem/1.25rem open-sans,\"Open Sans\",Arial,sans-serif;cursor:pointer;white-space:nowrap",

  mount(DT) {
    this.mountCreate(DT);
    this.mountOverview(DT);
  },

  /* Aanmaakpagina: knop naast "Volgende" in de sticky balk (shadow DOM, dus inline stijl). */
  mountCreate(DT) {
    if (!this.isMeldingPage()) { this._btn?.remove(); this._btn = null; return; }
    if (this._btn && this._btn.isConnected) return;
    const next = DT.deepQuery("#to-next-tab");
    const btn = DT.el("button", {
      type: "button", id: "dt-melding-btn", title: "Concept-mail naar begeleidingscoach (Alt+M)",
      onclick: (e) => { e.preventDefault(); this.open(DT, document); }
    });
    btn.innerHTML = this.ICON + "<span>Mail coach</span>";
    btn.firstElementChild.style.width = "1rem"; btn.firstElementChild.style.height = "1rem";
    btn.setAttribute("style", this.BTN_STYLE + ";margin-right:12px");
    if (next && next.parentNode) next.parentNode.insertBefore(btn, next);
    else { btn.style.cssText += ";position:fixed;right:24px;bottom:72px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.2)"; document.body.append(btn); }
    this._btn = btn;
  },

  /* Logboekoverzicht: mailknop in de knoppenbalk van elk Melding-Expertisecentrum-item. */
  mountOverview(DT) {
    this._itemBtns = this._itemBtns.filter((b) => b.isConnected);
    if (!this.isOverviewPage()) { this._itemBtns.forEach((b) => b.remove()); this._itemBtns = []; return; }
    DT.deepQueryAll("app-logbook-item").forEach((item) => {
      if (DT.deepQuery("[data-dt-mail]", item)) return;
      const type = this.textOf(DT.deepQuery("dna-card-title div.type", item));
      if (!/expertisecentrum/i.test(type)) return;
      const bar = DT.deepQuery("dna-card-title dna-button-bar", item);
      if (!bar) return;
      const btn = this.iconButton(DT, bar, item, {
        title: "Concept-mail naar begeleidingscoach",
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.openItem(DT, item); }
      });
      if (btn) this._itemBtns.push(btn);
    });
  },

  /* Envelop in de stijl van Magisters lijn-iconen (24-grid, stroke 2, currentColor). */
  ICON: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7.5l9 6 9-6"/></svg>',

  /* Icoonknop die in Magisters knoppenbalk past.
   * Eerst: een kopie van Magisters eigen dna-button (prullenbak/printer) met ons icoon erin,
   * zodat maat, kleur, afronding en hover precies gelijk zijn aan de knoppen ernaast.
   * Lukt dat niet (geen buurknop, icoon niet vindbaar), dan een randloze knop in dezelfde maten. */
  iconButton(DT, bar, item, { title, onclick }) {
    // deepQuery kijkt niet in de schaduw-DOM van de root zelf; daarom ook daarin zoeken.
    const q = (sel, r) => DT.deepQuery(sel, r) || (r.shadowRoot ? DT.deepQuery(sel, r.shadowRoot) : null);
    const inBar = (n) => Boolean(n && (bar.contains(n) || bar.shadowRoot?.contains(n)));
    let sib = q("#delete-logbook, #print-logbook, #add-child-logbook, #edit-logbook", item);
    if (!inBar(sib)) sib = Array.from(bar.children).find((c) => c.tagName?.toLowerCase() === "dna-button") || null;
    const ICON = this.ICON;
    const guard = (e) => { if (e.target.closest?.("[data-dt-mail]")) { e.stopImmediatePropagation(); onclick(e); } };

    if (sib && sib.parentNode && sib.tagName?.toLowerCase() === "dna-button") {
      const c = sib.cloneNode(true);
      c.removeAttribute("id");
      c.setAttribute("data-dt-mail", "1");
      c.setAttribute("title", title);
      c.setAttribute("aria-label", title);
      c.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      c.querySelectorAll("button,[aria-label]").forEach((n) => { n.setAttribute("aria-label", title); n.setAttribute("title", title); });
      sib.parentNode.insertBefore(c, sib);
      // Klik afvangen vóór Magisters eigen handlers (de kopie heeft die niet, maar het component kan ze opnieuw koppelen).
      c.addEventListener("click", guard, true);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") guard(e); }, true);

      const swapIcon = () => {
        const svg = q("svg", c);
        const ico = svg || q("dna-icon, [class*=icon]", c);
        if (!ico || ico.hasAttribute("data-dt-icon")) return Boolean(ico);
        const mine = DT.el("span", { "data-dt-icon": "1" });
        mine.innerHTML = this.ICON;
        const own = mine.firstElementChild;
        ["class", "style", "width", "height"].forEach((a) => { const v = ico.getAttribute(a); if (v) own.setAttribute(a, v); });
        if (!own.getAttribute("width") && !own.style.width) { own.style.width = "var(--dna-icon-size,1rem)"; own.style.height = "var(--dna-icon-size,1rem)"; }
        own.setAttribute("data-dt-icon", "1");
        ico.replaceWith(own);
        return true;
      };
      let ok = swapIcon();
      // Het component rendert zijn schaduw-DOM soms pas na het invoegen (of opnieuw): dan nogmaals.
      const root = c.shadowRoot;
      if (root) new MutationObserver(() => { if (!q("[data-dt-icon]", c)) swapIcon(); }).observe(root, { childList: true, subtree: true });
      if (!ok) requestAnimationFrame(() => { if (!swapIcon() && !q("[data-dt-icon]", c)) { c.replaceWith(fallback()); } });
      return c;
    }
    return insert(fallback());

    function fallback() {
      const b = DT.el("button", { type: "button", "data-dt-mail": "1", title, "aria-label": title, onclick });
      b.innerHTML = ICON;
      b.setAttribute("style", "display:inline-flex;align-items:center;justify-content:center;width:2.5rem;height:2rem;padding:0;margin:0;" +
        "border:0;background:transparent;color:inherit;cursor:pointer;border-radius:var(--dna-button-border-radius,8px);line-height:0;font:inherit");
      b.firstElementChild.style.width = "var(--dna-icon-size,1rem)";
      b.firstElementChild.style.height = "var(--dna-icon-size,1rem)";
      b.addEventListener("mouseenter", () => { b.style.background = "rgba(27,58,92,.08)"; });
      b.addEventListener("mouseleave", () => { b.style.background = "transparent"; });
      return b;
    }
    function insert(b) {
      const first = bar.shadowRoot?.firstElementChild || bar.firstElementChild;
      (bar.shadowRoot || bar).insertBefore(b, first || null);
      return b;
    }
  },

  /* Item in het overzicht eerst uitklappen (anders is de inhoud niet in de DOM). */
  async openItem(DT, item) {
    if (!DT.deepQuery("app-overzicht-tab", item)) {
      const expand = DT.deepQuery("dna-button.toggle[aria-label='Expand'] button, dna-button.toggle[aria-label='Expand']", item);
      expand?.click();
      for (let i = 0; i < 20 && !DT.deepQuery("app-overzicht-tab", item); i++) await new Promise((r) => setTimeout(r, 150));
      if (!DT.deepQuery("app-overzicht-tab", item)) { DT.toast("Klap het item eerst open (tabblad Overzicht)", "err"); return; }
    }
    this.open(DT, item);
  },

  /* ---------- Formulier uitlezen ---------- */

  textOf(el) { return (el?.textContent || "").replace(/\s+/g, " ").trim(); },

  checked(DT, root = document) {
    const out = [];
    DT.deepQueryAll("input[type=checkbox]", root).forEach((cb) => {
      const id = (cb.id || "").replace(/-input$/, "");
      const host = (id && cb.getRootNode().getElementById?.(id)) || cb.closest("dna-checkbox") || cb.parentElement;
      const on = cb.checked || host?.classList?.contains("dna-checkbox-checked");
      if (!on) return;
      const logisch = cb.closest("app-logisch");
      const label = this.textOf(logisch) ||
                    this.textOf(host?.querySelector("label") || host?.querySelector("span") || host) ||
                    this.textOf(cb.getRootNode().querySelector?.(`label[for="${cb.id}"]`));
      if (label) out.push(label);
    });
    return out;
  },

  /* Alle documenten van dit frame tot en met window.top (zelfde domein). */
  docs() {
    const out = [document];
    let w = window;
    while (w !== w.parent) {
      w = w.parent;
      try { if (w.document && w.document.body) out.push(w.document); } catch { break; }
    }
    return out;
  },

  /* Leerling-id uit de URL van een van de frames (…/leerling/{id}/…). */
  leerlingId() {
    for (const d of this.docs()) {
      const m = (d.location?.href || "").match(/leerling\/(\d+)/);
      if (m) return m[1];
    }
    return "";
  },

  /* Korte teksten uit koppen en naam-achtige elementen in alle frames. */
  sources(DT) {
    const sel = "dna-page-header div.title, dna-breadcrumb, h1, h2, h3, " +
      "[class*=title], [class*=header], [class*=naam], [class*=name], [class*=leerling], [class*=student], [class*=klas]";
    const bits = [];
    for (const d of this.docs()) {
      bits.push(d.title);
      DT.deepQueryAll(sel, d).forEach((el) => {
        if (el.closest && el.closest("#dt-melding, #dt-panel")) return;
        const t = this.textOf(el);
        if (t && t.length <= 120) bits.push(t);
      });
    }
    return [...new Set(bits.filter(Boolean))];
  },

  /* ---------- Leerling via Magisters eigen API ----------
   * De naam, het nummer en de klas staan niet in het logboek-frame maar komen in de
   * bovenliggende detailkaart binnen via de API. We zoeken in alle frames op dit domein
   * de API-calls waar de leerling-id uit de adresbalk in voorkomt, vragen die opnieuw op
   * (met Magisters eigen headers) en zoeken in het antwoord naar naam-, nummer- en
   * klasvelden. Diagnose (geen waarden) komt in de Bronnen-knop terecht. */
  KEYS: {
    nr: /^(stamnummer|stamnr|leerlingnummer|leerlingnr|studentnummer|studentnr|llnr|nummer)$/i,
    roep: /^(roepnaam|voornaam|voornamen|firstname)$/i,
    tussen: /^(tussenvoegsel|tussenvoegsels|voorvoegsel|officieletussenvoegsels?)$/i,
    achter: /^(achternaam|officieleachternaam|surname|lastname)$/i,
    vol: /^(naam|volledigenaam|weergavenaam|displayname|fullname|leerlingnaam|naamvolledig|roepnaamachternaam)$/i,
    klas: /^(klas|stamklas|klasnaam|klascode|stamgroep|groep|groepsnaam|huidigegroep|huidigeklas|lesgroep)$/i
  },

  pickStudent(json, id) {
    const K = this.KEYS;
    const str = (v) => (v === null || v === undefined || typeof v === "object") ? "" : String(v).trim();
    const klasOf = (v) => typeof v === "object" && v ? str(v.naam || v.omschrijving || v.code || v.afkorting || v.klas || v.groep) : str(v);
    const cands = [], klassen = [];
    let n = 0;
    const walk = (node, depth, parentKlas, parentKey = "") => {
      if (!node || typeof node !== "object" || depth > 6 || n++ > 4000) return;
      if (Array.isArray(node)) { node.forEach((x) => walk(x, depth + 1, parentKlas, parentKey)); return; }
      const keys = Object.keys(node);
      const find = (re) => keys.find((k) => re.test(k));
      // Een object onder een sleutel als "groepen" of "huidigeKlas" is een klas, geen leerling.
      const isKlasObj = /klas|groep/i.test(parentKey) && !find(K.achter) && !find(K.nr);
      if (isKlasObj) { const kn = klasOf(node); if (kn) klassen.push({ klas: kn, veld: parentKey, depth }); for (const k of keys) walk(node[k], depth + 1, parentKlas, k); return; }
      const kNr = find(K.nr), kAchter = find(K.achter), kVol = find(K.vol), kKlas = find(K.klas);
      let klas = kKlas ? klasOf(node[kKlas]) : "";
      if (kNr || kAchter || kVol) {
        const roep = str(node[find(K.roep)]), tussen = str(node[find(K.tussen)]), achter = str(node[kAchter]);
        const naam = achter ? [roep, tussen, achter].filter(Boolean).join(" ") : str(node[kVol]);
        const nr = str(node[kNr]);
        // Alleen echte nummers; een "nummer" dat op een telefoonnummer lijkt telt niet.
        const nrOk = /^\d{4,10}$/.test(nr) ? nr : "";
        const velden = [kNr, kAchter, kVol, find(K.roep), find(K.tussen), kKlas].filter(Boolean);
        const score = (String(node.id ?? node.Id ?? node.leerlingId ?? node.persoonId ?? "") === String(id) ? 10 : 0) + (achter ? 3 : 0) + (nrOk ? 2 : 0) + (klas ? 1 : 0) - depth * 0.1;
        if (naam || nrOk) cands.push({ naam, nr: nrOk, klas: klas || parentKlas || "", velden, score });
      }
      for (const k of keys) walk(node[k], depth + 1, klas || parentKlas, k);
    };
    walk(json, 0, "");
    // Klas kan in een ander object zitten (groepen, lesgroepen): pak de beste naam en vul klas aan.
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0];
    if (best && !best.klas) {
      const k = cands.find((c) => c.klas) || klassen.sort((a, b) => a.depth - b.depth)[0];
      if (k) { best.klas = k.klas; best.velden.push(k.veld || k.velden.find((v) => K.klas.test(v))); }
    }
    return best || null;
  },

  async studentFromApi(DT) {
    const id = this.leerlingId();
    const diag = [];
    if (!id) return { data: null, diag: ["Geen leerling-id in de adresbalk gevonden."] };
    const anon = (u) => String(u).replace(/^https?:\/\/[^/]+/, "").replace(/\d{3,}/g, "{id}").slice(0, 160);
    const pattern = `(^|[/=,])${id}([/?&,]|$)`;
    const seen = new Set();
    let best = null;
    for (const win of DT.windows()) {
      const urls = await DT.apiFind(pattern, 1500, { win, all: true });
      for (const url of urls) {
        if (seen.has(url) || seen.size >= 10) continue;
        seen.add(url);
        const r = await DT.api(url, { full: true, win, timeout: 8000 });
        const keys = r.json ? (Array.isArray(r.json) ? `[${Object.keys(r.json[0] || {}).slice(0, 12).join(", ")}]` : Object.keys(r.json).slice(0, 12).join(", ")) : "";
        const pick = r.json ? this.pickStudent(r.json, id) : null;
        diag.push(`API ${anon(url)} → ${r.status}${r.error ? " " + r.error : ""}${keys ? `; velden: ${keys}` : ""}` +
          (pick ? `; gevonden: ${["naam", "nr", "klas"].filter((k) => pick[k]).join("+") || "niets"} via ${pick.velden.join(", ")}` : ""));
        if (pick && (!best || pick.score > best.score)) best = pick;
        if (best && best.naam && best.nr && best.klas) break;
      }
      if (best && best.naam && best.nr && best.klas) break;
    }
    if (!seen.size) diag.push("Geen API-call met de leerling-id in het netwerklog (open de leerling opnieuw of herlaad de pagina).");
    return { data: best, diag };
  },

  student(DT) {
    const bits = this.sources(DT);
    const all = bits.join(" | ");
    const nr = (all.match(/\b(\d{5,8})\b/) || [])[1] || "";
    const klas = (all.match(/\b([A-Z]{1,5}\d{1,2}[A-Z0-9]{0,3})\b/) || [])[1] || "";
    // Naam: eerste tekst zonder cijfers die niet een vaste kop is.
    const skip = /^(leerlingen?|logboek|begeleiding|detailkaarten|nieuwe? melding|melding|expertisecentrum|algemeen|samenvatting|velden|magister.*)$/i;
    const clean = (t) => t.replace(/\(.*?\)/g, " ").replace(/\b\d{5,8}\b/g, " ")
      .replace(/\b[A-Z]{1,5}\d{1,2}[A-Z0-9]{0,3}\b/g, " ").replace(/\s*[|:,\-·]+\s*$/, "").replace(/\s+/g, " ").trim();
    // Voorkeur: een regel waar nummer of klas in stond (dan is de rest vrijwel zeker de naam).
    const withId = bits.filter((t) => (nr && t.includes(nr)) || (klas && t.includes(klas)));
    const naam = [...withId, ...bits].map(clean)
      .find((t) => t && !/\d/.test(t) && !skip.test(t) && t.length <= 60) || "";
    return { naam, nr, klas, bronnen: bits };
  },

  summary(DT, root = document) {
    const ed = DT.deepQuery("#inhoud div.ProseMirror", root) || DT.deepQuery("app-summary div.ProseMirror", root) ||
               DT.deepQuery("app-overzicht-tab div.dna-editor-content-area", root);
    return (ed?.innerText || "").trim();
  },

  async collect(DT, root = document) {
    const chk = this.checked(DT, root);
    const dom = this.student(DT);
    const api = await this.studentFromApi(DT);
    const a = api.data || {};
    const d = {
      naam: a.naam || dom.naam, nr: a.nr || dom.nr, klas: a.klas || dom.klas,
      bronnen: dom.bronnen, apiDiag: api.diag,
      viaApi: ["naam", "nr", "klas"].filter((k) => a[k])
    };
    const isItem = root !== document;
    return {
      ...d,
      bestaand: isItem,
      onderwerp: isItem ? this.textOf(DT.deepQuery("dna-card-title div.omschrijving", root))
                        : (DT.deepQuery("#dna-input-0")?.value || "").trim(),
      datum: isItem ? this.textOf(DT.deepQuery("dna-card-title div.datum", root))
                    : (DT.deepQuery("#dna-input-1")?.value || "").trim(),
      voorWie: chk.filter((l) => this.TARGETS.includes(l)),
      problematiek: chk.filter((l) => this.PROBLEMS.includes(l)),
      hulp: chk.filter((l) => /hulp geboden/i.test(l)),
      ouders: chk.filter((l) => /ouders zijn/i.test(l)),
      samenvatting: this.summary(DT, root)
    };
  },

  /* ---------- Mail opbouwen ---------- */

  compose(f, s) {
    const naam = f.naam || "[naam]";
    const wanneer = f.bestaand ? (f.datum ? `op ${f.datum} ` : "") : "zojuist ";
    const regel = (k, v) => (v ? `${k}: ${v}\n` : "");
    let body = `Beste ${(s.name || "").trim().split(" ")[0] || "collega"},\n\n` +
      `Ik heb ${wanneer}in Magister een Melding Expertisecentrum aangemaakt voor:\n\n` +
      regel("Naam", naam) + regel("Studentnummer", f.nr) + regel("Klas", f.klas) +
      regel("Aangemeld voor", f.voorWie.join(", ") || "[niet aangevinkt]") +
      regel("Datum melding", f.datum) + "\n";
    if (s.extra) {
      body += regel("Problematiek", f.problematiek.join(", ")) +
              regel("Hulp", f.hulp.join("; ")) +
              regel("Ouders", f.ouders.join("; "));
      if (f.problematiek.length || f.hulp.length || f.ouders.length) body += "\n";
    }
    body += `Samenvatting:\n${f.samenvatting || "[samenvatting]"}\n\n` +
      `De volledige melding staat in Magister (logboek van de student).\n\nMet vriendelijke groet,\n${s.afzender || ""}`;
    const voor = (f.voorWie || []).join(", ");
    const subject = `Melding Expertisecentrum: ${naam}${f.klas ? ` (${f.klas})` : ""}${voor ? ` - ${voor}` : ""}`;
    return { subject, body };
  },

  mailto(to, subject, body, cc = "") {
    const q = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
    if (cc) q.unshift(`cc=${encodeURIComponent(cc)}`);
    return `mailto:${encodeURIComponent(to)}?${q.join("&")}`;
  },

  /* ---------- Controlescherm ---------- */

  async open(DT, root = document) {
    if (Date.now() - (this._openedAt || 0) < 500) return;
    this._openedAt = Date.now();
    this._dlg?.remove();
    const s = this.defaults();
    DT.toast("Leerlinggegevens ophalen…", "info", 1500);
    const f = await this.collect(DT, root);
    const inp = (label, key, val, attrs = {}) => DT.el("label", { class: "dt-m-field" }, [
      DT.el("span", { text: label }),
      DT.el("input", { type: "text", "data-k": key, value: val, ...attrs })
    ]);
    // Aan: keuzelijst met coaches uit de instellingen, of een los adres.
    const coaches = this.coaches(s);
    const sel = DT.el("select", { "data-k": "coach" });
    coaches.forEach((c, i) => sel.append(DT.el("option", { value: String(i), text: c.name ? `${c.name} <${c.email}>` : c.email })));
    sel.append(DT.el("option", { value: "other", text: coaches.length ? "Ander adres…" : "Adres invullen (of voeg coaches toe bij Instellingen)" }));
    const toInput = DT.el("input", { type: "text", "data-k": "to", value: "", placeholder: "naam@school.nl" });
    const to = DT.el("label", { class: "dt-m-field" }, [DT.el("span", { text: "Aan (begeleidingscoach)" }), sel, toInput]);
    const last = coaches.findIndex((c) => c.email === s.to);
    sel.value = coaches.length ? String(last >= 0 ? last : 0) : "other";
    const coach = () => (sel.value === "other" ? null : coaches[+sel.value]);
    const syncTo = () => {
      const c = coach();
      toInput.hidden = !!c;
      if (c) toInput.value = c.email; else if (toInput.value === "" || coaches.some((x) => x.email === toInput.value)) toInput.value = coaches.length ? "" : s.to;
    };
    syncTo();
    const naam = inp("Naam student", "naam", f.naam);
    const nr = inp("Studentnummer", "nr", f.nr);
    const klas = inp("Klas", "klas", f.klas);
    const voor = inp("Aangemeld voor", "voorWie", f.voorWie.join(", "));
    const extra = DT.el("label", { class: "dt-m-check" }, [
      DT.el("input", { type: "checkbox", "data-k": "extra", ...(s.extra ? { checked: "" } : {}) }),
      DT.el("span", { text: "Problematiek, hulp en ouders meesturen" })
    ]);
    const bodyTa = DT.el("textarea", { rows: "14", spellcheck: "false" });
    const subjEl = DT.el("input", { type: "text", class: "dt-m-subject" });

    const read = () => {
      const g = (el) => el.querySelector("input").value.trim();
      return {
        f: { ...f, naam: g(naam), nr: g(nr), klas: g(klas), voorWie: g(voor).split(/\s*,\s*/).filter(Boolean) },
        s: { ...s, to: g(to), name: coach()?.name || "", extra: extra.querySelector("input").checked }
      };
    };
    const refresh = () => {
      const r = read();
      const m = this.compose(r.f, r.s);
      subjEl.value = m.subject; bodyTa.value = m.body;
    };
    [naam, nr, klas, voor, extra].forEach((el) => el.addEventListener("input", refresh));
    sel.addEventListener("change", () => { syncTo(); refresh(); check(); if (!coach()) toInput.focus(); });
    refresh();

    const warn = DT.el("div", { class: "dt-m-warn" });
    const check = () => {
      const r = read();
      const miss = [];
      if (!r.s.to) miss.push("e-mailadres coach");
      if (!r.f.naam) miss.push("naam");
      if (!r.f.voorWie.length) miss.push("aangemeld voor");
      if (!f.samenvatting) miss.push("samenvatting (nog leeg in het formulier)");
      warn.textContent = miss.length ? "Nog niet ingevuld: " + miss.join(", ") : "";
      return r;
    };
    [to, naam, voor].forEach((el) => el.addEventListener("input", check));
    check();

    const send = async () => {
      const r = check();
      if (!r.s.to) { DT.toast("Vul het e-mailadres van de coach in", "err"); return; }
      await DT.saveSettings({ melding: { enabled: true, to: r.s.to, name: r.s.name, extra: r.s.extra } });
      const url = this.mailto(r.s.to, subjEl.value, bodyTa.value, r.s.cc);
      if (url.length > 1900) DT.toast("Lange mail: als Outlook de tekst afkapt, gebruik dan Kopiëren", "info", 5000);
      window.location.href = url;
      DT.toast("Concept-mail geopend in je mailprogramma", "ok");
      dlg.remove();
    };
    const copy = async () => {
      await DT.copy(`Aan: ${read().s.to}\nOnderwerp: ${subjEl.value}\n\n${bodyTa.value}`);
    };

    const dlg = DT.el("div", { id: "dt-melding", role: "dialog", "aria-label": "Mail naar begeleidingscoach" }, [
      DT.el("div", { class: "dt-m-box" }, [
        DT.el("div", { class: "dt-m-head" }, [
          DT.el("strong", { text: "Mail naar begeleidingscoach" }),
          DT.el("button", { type: "button", class: "dt-m-x", text: "✕", title: "Sluiten", onclick: () => dlg.remove() })
        ]),
        DT.el("div", { class: "dt-m-grid" }, [to, naam, nr, klas, voor]),
        extra,
        DT.el("label", { class: "dt-m-field" }, [DT.el("span", { text: "Onderwerp" }), subjEl]),
        bodyTa,
        warn,
        DT.el("div", { class: "dt-m-actions" }, [
          DT.el("button", { type: "button", class: "dt-m-btn dt-m-ghost", text: "Bronnen", title: "Welke teksten zijn gevonden voor naam, nummer en klas (voor afstemming)",
            onclick: () => DT.copy(
              `leerlingId: ${this.leerlingId() || "(geen)"}\n` +
              `via API: ${f.viaApi?.length ? f.viaApi.join(", ") : "niets"}\n` +
              (f.apiDiag || []).map((l) => "- " + l).join("\n") +
              `\n\nTeksten op de pagina (uitwijk; lak namen weg voor je dit deelt):\n` +
              (f.bronnen || []).map((b) => "- " + b).join("\n")) }),
          DT.el("button", { type: "button", class: "dt-m-btn", text: "Kopiëren", onclick: copy }),
          DT.el("button", { type: "button", class: "dt-m-btn dt-m-primary", text: "Open in Outlook", onclick: send })
        ]),
        DT.el("div", { class: "dt-m-hint", text: (f.viaApi?.length === 3 ? "Naam, nummer en klas komen uit Magister. " : f.viaApi?.length ? `Uit Magister: ${f.viaApi.join(", ")}; de rest is van de pagina afgelezen, controleer die. ` : "Gegevens zijn van de pagina afgelezen, controleer ze (Bronnen helpt bij afstemmen). ") + (s.cc ? `Cc: ${s.cc}. ` : "") + (f.bestaand
          ? "Controleer de gegevens. De mail opent als concept; er wordt niets automatisch verzonden."
          : "Controleer de gegevens. De mail opent als concept; er wordt niets automatisch verzonden. Sla de melding daarna nog wel op in Magister.") })
      ])
    ]);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.remove(); });
    dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") dlg.remove(); });
    document.body.append(dlg);
    this._dlg = dlg;
    (coach() ? naam.querySelector("input") : toInput).focus();
  },

  css() {
    return `
#dt-melding{position:fixed;inset:0;z-index:2147483000;background:rgba(27,58,92,.32);display:flex;align-items:center;justify-content:center;font:14px/1.45 open-sans,"Open Sans",var(--dt-font,system-ui,sans-serif);color:#1f2933}
#dt-melding *{box-sizing:border-box}
#dt-melding .dt-m-box{background:#fff;color:#1f2933;width:min(720px,94vw);max-height:92vh;overflow:auto;border-radius:12px;padding:20px 24px 18px;box-shadow:0 16px 48px rgba(27,58,92,.28);display:flex;flex-direction:column;gap:12px}
#dt-melding .dt-m-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid #e3e7ec}
#dt-melding .dt-m-head strong{font-size:18px;font-weight:600;color:#1B3A5C}
#dt-melding .dt-m-x{width:32px;height:32px;border:0;border-radius:8px;background:none;font-size:16px;line-height:1;cursor:pointer;color:#1B3A5C}
#dt-melding .dt-m-x:hover{background:rgba(27,58,92,.08)}
#dt-melding .dt-m-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}
#dt-melding .dt-m-grid .dt-m-field:first-child{grid-column:1/-1}
#dt-melding .dt-m-field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#1B3A5C}
#dt-melding input[type=text],#dt-melding select,#dt-melding textarea{font:inherit;font-size:14px;font-weight:400;color:#1f2933;background:#fff;border:1px solid #c2cad4;border-radius:8px;padding:8px 10px;width:100%;min-height:38px}
#dt-melding input[type=text]:focus,#dt-melding select:focus,#dt-melding textarea:focus{outline:none;border-color:#1B3A5C;box-shadow:0 0 0 2px rgba(27,58,92,.18)}
#dt-melding [hidden]{display:none}
#dt-melding textarea{resize:vertical;min-height:180px;font-family:inherit}
#dt-melding .dt-m-check{display:flex;gap:8px;align-items:center;font-size:13px}
#dt-melding .dt-m-check input{accent-color:#1B3A5C}
#dt-melding .dt-m-warn{color:#b3261e;font-size:12px;min-height:1em}
#dt-melding .dt-m-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
#dt-melding .dt-m-btn{font:600 14px/1.25rem inherit;padding:7px 16px;border-radius:8px;border:2px solid #1B3A5C;background:#fff;color:#1B3A5C;cursor:pointer;white-space:nowrap}
#dt-melding .dt-m-btn:hover{background:rgba(27,58,92,.08)}
#dt-melding .dt-m-btn:focus-visible{outline:2px solid #1B3A5C;outline-offset:2px}
#dt-melding .dt-m-ghost{border-color:transparent;color:#52606d;margin-right:auto;padding-left:8px;padding-right:8px}
#dt-melding .dt-m-primary{background:#1B3A5C;color:#fff}
#dt-melding .dt-m-primary:hover{background:#16304c}
#dt-melding .dt-m-hint{font-size:12px;color:#52606d}
`;
  }
});
