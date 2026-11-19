/* Thema, deel pagina: aanpassingen die de pagina zelf nalopen in plaats van alleen CSS te zetten: agendakleuren,
 * de kop van het lesdashboard en het leerlingenoverzicht, en de dashboardkaarten. Gebruikt door theme.js. */
/* ---------- Agendakleuren (Apple-palet) ----------
 * Leest de titel van een afspraak ("MIP1B - M1INTR - (C2.13)"): deel 1 is de klas, deel 2 het vak.
 * Zet --ev op de afspraak; de CSS mengt daar achtergrond, rand, tekst en chips uit.
 * Voorbije afspraken (links van vandaag, of boven de nu-lijn) krijgen data-dt-past. */
const EV_LIGHT = ["#FF3B30", "#FF9500", "#D4A200", "#34C759", "#00A99D", "#30B0C7", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E"];
const EV_DARK = ["#FF453A", "#FF9F0A", "#FFD60A", "#30D158", "#63E6E2", "#40C8E0", "#0A84FF", "#5E5CE6", "#BF5AF2", "#FF375F", "#AC8E68"];
function agendaColorPass(root, mode, dark) {
  const items = [...root.querySelectorAll("#calendar .fc-event, li.vandaag-agenda-list-item")];
  if (!items.length) return;
  const pal = dark ? EV_DARK : EV_LIGHT;
  // FNV-1a met een extra mengstap: vakken die op elkaar lijken (M1ENG, M1SLB) krijgen verschillende kleuren.
  const hash = (str) => { let h = 0x811c9dc5; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return h >>> 0; };
  const today = root.querySelector("#calendar .fc-day.fc-today, #calendar .fc-bg .fc-today");
  const nowLine = root.querySelector("#calendar .fc-now-indicator-line");
  const todayRect = today && today.getBoundingClientRect(), nowRect = nowLine && nowLine.getBoundingClientRect();
  const keyOf = (el) => {
    const txt = (el.querySelector(".event-description-content, .event-description-content-examen, .classroom, .fc-title") || el).textContent.replace(/\s+/g, " ").trim();
    const parts = txt.split(/\s+-\s+/);
    const klas = /^[A-Z]{1,5}\d[A-Z0-9]*$/.test(parts[0] || "") ? parts[0] : "";
    const vak = klas ? (parts[1] || "").replace(/\(.*$/, "").trim() : "";
    return mode === "klas" ? klas : mode === "vak" ? vak : "";
  };
  // Kleurtoewijzing: hash als voorkeur, maar binnen de zichtbare set geen twee vakken dezelfde kleur
  // (alfabetisch toegewezen, dus stabiel zolang het rooster dezelfde vakken bevat).
  const keys = [...new Set(items.map(keyOf).filter(Boolean))].sort();
  const colorOf = new Map(); const used = new Set();
  for (const k of keys) { let i = hash(k) % pal.length; if (used.size < pal.length) while (used.has(i)) i = (i + 1) % pal.length; used.add(i); colorOf.set(k, pal[i]); }
  // Startscherm: dagkoppen herkennen (vandaag, morgen) en voorbije lessen van vandaag dimmen.
  const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const now = new Date();
  const dayKey = (d) => `${d.getDate()}-${d.getMonth()}`;
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  // Eén paneel per dag (uib-accordion-group); de hele accordion is één .panel-group.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const summary = { lessen: 0, next: null, wijzigingen: 0 };
  for (const panel of root.querySelectorAll("#vandaag-agenda [uib-accordion-group], #vandaag-agenda .panel-group > .panel, sm-agenda-widget .panel-group > .panel")) {
    const head = panel.querySelector(".panel-heading");
    const m = head && head.textContent.toLowerCase().match(/(\d{1,2})\s+([a-z]+)/);
    const idx = m ? MONTHS.indexOf(m[2]) : -1;
    const key = idx >= 0 ? `${parseInt(m[1], 10)}-${idx}` : "";
    panel.dataset.dtDay = key === dayKey(now) ? "vandaag" : key === dayKey(tomorrow) ? "morgen" : "";
    let nextFound = false;
    for (const li of panel.querySelectorAll("li.vandaag-agenda-list-item")) {
      delete li.dataset.dtPast; delete li.dataset.dtNext;
      if (panel.dataset.dtDay !== "vandaag") continue;
      summary.lessen++;
      if (li.classList.contains("alert-info")) summary.wijzigingen++;
      const t = (li.querySelector(".vandaag-agenda-item-lesblok-tijd") || li).textContent.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (!t) continue;
      const start = parseInt(t[1], 10) * 60 + parseInt(t[2], 10), end = parseInt(t[3], 10) * 60 + parseInt(t[4], 10);
      if (end <= nowMin) li.dataset.dtPast = "1";
      else if (start > nowMin && !nextFound && !li.classList.contains("alert-danger")) {
        nextFound = true; li.dataset.dtNext = "1";
        const title = (li.querySelector(".classroom") || li).textContent.replace(/\s+/g, " ").trim();
        summary.next = `${t[1]}:${t[2]} ${title.split(/\s+-\s+\(/)[0]}`;
      }
    }
  }
  dashboardSummary(root, summary);
  for (const el of items) {
    const key = keyOf(el);
    if (key) { el.style.setProperty("--ev", colorOf.get(key)); el.dataset.dtEv = key; }
    else if (el.dataset.dtEv) { el.style.removeProperty("--ev"); delete el.dataset.dtEv; }
    if (todayRect && el.classList.contains("fc-event")) {
      const r = el.getBoundingClientRect();
      const past = r.right <= todayRect.left + 1 || (nowRect && r.left >= todayRect.left - 1 && r.right <= todayRect.right + 1 && r.bottom <= nowRect.top);
      if (past) el.dataset.dtPast = "1"; else delete el.dataset.dtPast;
    }
  }
}

/* De navigatie (vorige/volgende) van FullCalendar naar de titelrij verplaatsen, naast Magisters
 * eigen ronde knoppen. De knoppen houden hun klik-afhandeling; bij een herbouw van de kalender
 * komt er een nieuwe balk in het rooster en wordt de oude in de titelrij opgeruimd. */
function agendaToolbarPass(root) {
  const fresh = root.querySelector("#calendar > .fc-toolbar");
  const bar = root.querySelector(".head-bar");
  if (!bar) return;
  if (fresh) {
    root.querySelectorAll(".head-bar .fc-toolbar").forEach((old) => old.remove());
    fresh.classList.add("dt-moved");
    // Vóór de titel (floats na een blok zakken een regel), na Magisters eigen knoppen (eerste float-right staat het verst rechts).
    const links = bar.querySelector(".head-bar-links");
    if (links) links.after(fresh); else bar.prepend(fresh);
  }
}

/* Lesdashboard: titelbalk, tabbladen en werkbalk op één kaart. De kaart is een los vlak achter die
 * drie (ze staan in Magister op verschillende plekken in de pagina). Breedte en hoogte volgen de
 * inhoudskolom: die verandert als het zijpaneel in- of uitklapt, daarom een ResizeObserver. */
let ldKopRO = null, ldKopMain = null, ldKopMO = null;
const ldPadCache = new Map();
/* Rechtermarge van de inhoud in de EINDtoestand. Magister laat die marge in 0,2s meeschuiven met het
 * zijpaneel; tijdens die overgang geeft getComputedStyle een tussenwaarde. Een onzichtbare kopie met
 * dezelfde klassen geeft direct de eindwaarde, zodat de kaart in dezelfde 0,2s meeschuift. */
function ldEindPadding(main) {
  const key = `${main.className}|${window.innerWidth}`;
  if (ldPadCache.has(key)) return ldPadCache.get(key);
  const probe = document.createElement("section");
  probe.className = main.className;
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "display:none !important";
  main.after(probe);
  const ps = getComputedStyle(probe);
  const v = { l: parseFloat(ps.paddingLeft) || 0, r: parseFloat(ps.paddingRight) || 0 };
  probe.remove();
  ldPadCache.set(key, v);
  return v;
}
function lesdashKopPass(root, on) {
  /* Meestal staan kop en inhoud direct in ui-view main; op het tabblad Hulpmiddelen zitten ze in
   * ld-hulpmiddelen (zonder zijpaneel). Dat element is dan de "host"; de ui-view blijft de maatstaf. */
  const view = root.querySelector('ui-view[name="main"]');
  const uiv = view && (view.querySelector(":scope > section.ld-section") ? view : view.querySelector(":scope > ld-hulpmiddelen"));
  const main = on && uiv ? uiv.querySelector(":scope > section.ld-section") : null;
  const hb = main ? uiv.querySelector(":scope > .head-bar") : null;
  if (!main || !hb) {
    ldKopMO?.disconnect(); ldKopMO = null;
    root.querySelectorAll(".dt-ld-kop").forEach((k) => k.remove());
    root.querySelectorAll(".dt-ld-on").forEach((u) => { u.classList.remove("dt-ld-on"); u.style.removeProperty("--dt-kop-l"); u.style.removeProperty("--dt-kop-r"); });
    if (ldKopRO) { ldKopRO.disconnect(); ldKopRO = null; ldKopMain = null; }
    return;
  }
  /* Bij wisselen tussen tabbladen kan de host veranderen: kaart en klasse van een vorige host weg. */
  root.querySelectorAll(".dt-ld-kop").forEach((k) => { if (k.parentElement !== uiv) k.remove(); });
  root.querySelectorAll(".dt-ld-on").forEach((u) => { if (u !== uiv) { u.classList.remove("dt-ld-on"); u.style.removeProperty("--dt-kop-l"); u.style.removeProperty("--dt-kop-r"); } });
  let kop = uiv.querySelector(":scope > .dt-ld-kop");
  if (!kop) { kop = document.createElement("div"); kop.className = "dt-ld-kop"; kop.setAttribute("aria-hidden", "true"); uiv.prepend(kop); }
  uiv.classList.add("dt-ld-on");
  const meet = () => {
    if (!kop.isConnected) return;
    const ur = view.getBoundingClientRect(), mr = main.getBoundingClientRect(), pad = ldEindPadding(main);
    const binnenL = ur.left + view.clientLeft, binnenR = binnenL + view.clientWidth;
    const l = Math.round(mr.left + pad.l - binnenL);
    const r = Math.round(binnenR - (mr.right - pad.r));
    const top = parseFloat(getComputedStyle(kop).top) || 28;
    let onder = 0;
    for (const el of main.querySelectorAll(":scope > ld-menu .page-nav > ul.tabs, :scope > .verantwoord-container, #leerlinglijst > .dt-att-bar")) {
      if (!el.offsetParent) continue;
      onder = Math.max(onder, el.getBoundingClientRect().bottom);
    }
    const h = onder ? Math.round(onder - ur.top - view.clientTop + view.scrollTop + 16 - top) : 0;
    const zet = (k, v) => { if (uiv.style.getPropertyValue(k) !== v) uiv.style.setProperty(k, v); };
    zet("--dt-kop-l", `${l}px`); zet("--dt-kop-r", `${r}px`);
    /* Per eigenschap en alleen bij verschil: opnieuw zetten zou de CSS-overgang telkens herstarten */
    for (const [k, v] of [["left", `${l}px`], ["right", `${r}px`], ["height", `${Math.max(h, 52)}px`]]) if (kop.style[k] !== v) kop.style[k] = v;
  };
  if (ldKopMain !== main) {
    ldKopRO?.disconnect();
    ldKopRO = new ResizeObserver(() => requestAnimationFrame(meet));
    ldKopRO.observe(main); ldKopRO.observe(uiv);
    /* Klasse van de inhoud wisselt bij in-/uitklappen: meteen de eindmaat zetten (CSS schuift mee in 0,2s). */
    ldKopMO?.disconnect();
    ldKopMO = new MutationObserver(() => meet());
    ldKopMO.observe(main, { attributes: true, attributeFilter: ["class"] });
    const menu = main.querySelector(":scope > ld-menu"); if (menu) ldKopRO.observe(menu);
    ldKopMain = main;
  }
  const bar = main.querySelector("#leerlinglijst > .dt-att-bar");
  if (bar && !bar.dataset.dtKopRo) { bar.dataset.dtKopRo = "1"; ldKopRO.observe(bar); }
  meet();
}

/* Leerlingenoverzicht (frame /op-leerlingen): kruimelpad, titel, tabbladen en werkbalk op één kaart
 * boven de tabel, filterpaneel op dezelfde hoogte ernaast. Zelfde opzet als het lesdashboard. */
let llKopRO = null, llKopPage = null;
function leerlingenKopPass(root, on) {
  const page = on ? root.querySelector("ll-students-overview-page .zoeken-page") : null;
  const links = page?.querySelector(":scope > .left-side");
  const top = links?.querySelector("ll-top-bar");
  const html = root.documentElement;
  if (!page || !links || !top) {
    root.querySelectorAll(".dt-ll-kop").forEach((k) => k.remove());
    if (html.classList.contains("dt-ll-on")) { html.classList.remove("dt-ll-on"); for (const k of ["--dt-ll-rm", "--dt-ll-up", "--dt-ll-ft", "--dt-ll-fl", "--dt-ll-fw", "--dt-ll-fh", "--dt-ll-ph"]) html.style.removeProperty(k); }
    if (llKopRO) { llKopRO.disconnect(); llKopRO = null; llKopPage = null; }
    return;
  }
  let kop = root.querySelector("body > .dt-ll-kop");
  if (!kop) { kop = root.createElement("div"); kop.className = "dt-ll-kop"; kop.setAttribute("aria-hidden", "true"); root.body.prepend(kop); }
  html.classList.add("dt-ll-on");
  const meet = () => {
    if (!kop.isConnected) return;
    const win = root.defaultView, sx = win.scrollX, sy = win.scrollY;
    const lr = links.getBoundingClientRect(), pr = page.getBoundingClientRect(), tr = top.getBoundingClientRect();
    const kopTop = parseFloat(win.getComputedStyle(kop).top) || 8;
    const rm = Math.round(html.clientWidth - lr.right);
    const up = Math.round(pr.top + sy - kopTop);
    const zet = (k, v) => { if (html.style.getPropertyValue(k) !== v) html.style.setProperty(k, v); };
    zet("--dt-ll-rm", `${rm}px`); zet("--dt-ll-up", `${up}px`);
    /* Magister zet het filterpaneel met position: fixed en rekent zelf de plek uit; wij leggen het naast
     * de kaart: zelfde bovenkant, 16px tussenruimte, onderkant gelijk met de tabel. */
    /* Hoogte: de kaart duwt de tabel omlaag; de pagina blijft binnen het venster met 24px ruimte onderaan
     * (het frame loopt door tot de onderrand, zie de regel voor #guest-app-frame) */
    zet("--dt-ll-ph", `${Math.max(300, Math.round(win.innerHeight - pr.top - 24))}px`);
    const tabel = links.querySelector(".table-container") || links;
    const onder = tabel.getBoundingClientRect().bottom;
    zet("--dt-ll-ft", `${kopTop - sy}px`);
    zet("--dt-ll-fl", `${Math.round(lr.right + 16)}px`);
    zet("--dt-ll-fw", `${Math.max(200, Math.round(pr.right - lr.right - 16))}px`);
    zet("--dt-ll-fh", `${Math.max(200, Math.round(onder - (kopTop - sy)))}px`);
    for (const [k, v] of [["left", `${Math.round(lr.left + sx)}px`], ["width", `${Math.round(lr.width)}px`], ["height", `${Math.round(tr.bottom + sy + 16 - kopTop)}px`]]) if (kop.style[k] !== v) kop.style[k] = v;
  };
  if (llKopPage !== page) {
    llKopRO?.disconnect();
    llKopRO = new (root.defaultView.ResizeObserver)(() => root.defaultView.requestAnimationFrame(meet));
    llKopRO.observe(page); llKopRO.observe(links); llKopRO.observe(top);
    const tc = links.querySelector(".result-container"); if (tc) llKopRO.observe(tc);
    llKopPage = page;
  }
  meet();
}

/* Startscherm: samenvattingsregel onder de datum (lessen vandaag, volgende les, meldingen die aandacht vragen). */
function dashboardSummary(root, summary) {
  const header = root.querySelector("dna-page-header");
  const main = header && header.parentElement && header.parentElement.querySelector("section.main");
  if (!header || !main || !root.querySelector("#vandaag-agenda")) return;
  let box = root.querySelector(".dt-summary");
  if (!box) { box = document.createElement("div"); box.className = "dt-summary"; main.parentElement.insertBefore(box, main); }
  const chips = [];
  if (summary.lessen) chips.push(["lessen", `${summary.lessen} ${summary.lessen === 1 ? "les" : "lessen"} vandaag`]);
  if (summary.next) chips.push(["next", `Volgende: ${summary.next}`]);
  else if (summary.lessen) chips.push(["done", "Geen lessen meer vandaag"]);
  if (summary.wijzigingen) chips.push(["wijz", `${summary.wijzigingen} ${summary.wijzigingen === 1 ? "wijziging" : "wijzigingen"}`]);
  const jarig = parseInt((root.documentElement || document.documentElement).dataset.dtJarig || "0", 10);
  if (jarig > 0) chips.push(["jarig", `${jarig} ${jarig === 1 ? "leerling" : "leerlingen"} jarig vandaag`, "#FF2D55"]);
  for (const li of root.querySelectorAll("#vandaag-notificatie .list li.item[data-dt-n='1']")) {
    const n = (li.querySelector(".special")?.textContent || "").trim();
    const txt = [...li.querySelectorAll("a > span")].filter((x) => !x.classList.contains("special") && !x.classList.contains("dt-dash-ico")).map((x) => x.textContent).join(" ").trim();
    chips.push([li.dataset.dtKind || "stip", `${n} ${txt}`, li.style.getPropertyValue("--k")]);
  }
  const html = chips.map(([k, label, color]) => `<span class="dt-chip dt-chip-${k}"${color ? ` style="--k:${color}"` : ""}><i></i>${label.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</span>`).join("");
  if (box.innerHTML !== html) box.innerHTML = html;
}

/* Startscherm: notificaties als widgets. Leest aantal en tekst, kiest een soort (icoon + kleur)
 * op trefwoorden en zet een klein svg-icoon in de rij; de CSS maakt er tegels van. */
const DASH_KINDS = [
  [/logboek/i, "boek", ["#007AFF", "#0A84FF"]],
  [/verantwoord/i, "vink", ["#34C759", "#30D158"]],
  [/ziek/i, "thermo", ["#FF9500", "#FF9F0A"]],
  [/terug/i, "terug", ["#5856D6", "#5E5CE6"]],
  [/toets/i, "kruis", ["#FF3B30", "#FF453A"]],
  [/ouderavond|gesprek/i, "mensen", ["#00A99D", "#63E6E2"]],
  [/deadline/i, "klok", ["#FF2D55", "#FF375F"]],
  [/ingeleverd/i, "inbox", ["#AF52DE", "#BF5AF2"]],
  [/opdracht/i, "doc", ["#5856D6", "#5E5CE6"]],
  [/./, "stip", ["#8E8E93", "#98989D"]]
];
const DASH_ICON = {
  boek: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M20 18v3H6.5"/>',
  vink: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  thermo: '<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 10v6"/>',
  terug: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  kruis: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  mensen: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.5a5 5 0 0 1 5.5 4.5"/>',
  klok: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7"/><path d="M4 13h4l2 3h4l2-3h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  stip: '<circle cx="12" cy="12" r="4"/>'
};
function dashboardPass(root, dark) {
  const rows = root.querySelectorAll("#vandaag-notificatie .list li.item, sm-notificatie-widget2 .list li.item");
  for (const li of rows) {
    const a = li.querySelector("a"); if (!a) continue;
    const cnt = (li.querySelector(".special")?.textContent || "").trim();
    const text = [...a.querySelectorAll("span")].filter((x) => !x.classList.contains("special")).map((x) => x.textContent).join(" ").trim();
    const [, kind, col] = DASH_KINDS.find(([re]) => re.test(text)) || DASH_KINDS[DASH_KINDS.length - 1];
    const n = parseInt(cnt, 10);
    li.dataset.dtN = isNaN(n) ? "" : (n > 0 ? "1" : "0");
    li.dataset.dtKind = kind;
    li.style.setProperty("--k", dark ? col[1] : col[0]);
    if (!a.querySelector(".dt-dash-ico")) {
      const ico = document.createElement("span"); ico.className = "dt-dash-ico";
      ico.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DASH_ICON[kind]}</svg>`;
      a.prepend(ico);
    }
  }
}
