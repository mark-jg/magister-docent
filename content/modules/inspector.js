/* Inspector: ontwikkelhulp.
 * Alt+I of knop in het paneel. Beweeg over een element, klik om de selector te
 * kopiëren, of druk op:
 *   H  verberg dit element (voegt toe aan "Opgeruimde interface")
 *   R  maak een paginarapport (structuur + tabellen + formulieren, zonder persoonsgegevens)
 *   Esc stop
 * Het paginarapport kun je naar Claude plakken; daarmee kunnen de
 * Magister-specifieke modules (absentie, cijfers, dashboard) precies op jullie
 * omgeving worden afgestemd.
 */
DT.register({
  id: "inspector",
  _active: false,
  _hover: null,
  _bar: null,
  _handlers: null,

  init() {},

  start(DT) {
    if (this._active) return;
    this._active = true;
    this._bar = DT.el("div", { id: "dt-inspect-bar" }, [
      DT.el("span", { text: "Inspector:" }),
      DT.el("code", { text: "beweeg over een element" }),
      DT.el("span", { text: "klik = selector · C = laat meekleuren · H = verbergen · R = rapport · N = netwerk · P = probe · Esc" })
    ]);
    document.body.append(this._bar);
    const over = (e) => {
      if (e.target.closest("#dt-inspect-bar, #dt-panel, #dt-handle, #dt-role-menu")) return;
      this._hover?.classList.remove("dt-inspect-hover");
      this._hover = e.target; this._hover.classList.add("dt-inspect-hover");
      this._bar.querySelector("code").textContent = DT.selectorFor(e.target);
    };
    const click = (e) => {
      if (e.target.closest("#dt-inspect-bar, #dt-panel, #dt-handle, #dt-role-menu")) return;
      e.preventDefault(); e.stopPropagation();
      DT.copy(DT.selectorFor(e.target));
    };
    const key = (e) => {
      if (/^(input|textarea)$/i.test(e.target.tagName)) return;
      if (e.key.toLowerCase() === "c" && this._hover) { e.preventDefault(); this.colorPicker(DT, this._hover); }
      if (e.key.toLowerCase() === "h" && this._hover) { e.preventDefault(); DT.module("compact")?.hide(DT, DT.selectorFor(this._hover)); }
      if (e.key.toLowerCase() === "r") { e.preventDefault(); this.report(DT); }
      if (e.key.toLowerCase() === "n") { e.preventDefault(); this.netReport(DT); }
      if (e.key.toLowerCase() === "p") { e.preventDefault(); this.probe(DT); }
    };
    this._handlers = { over, click, key };
    document.addEventListener("mouseover", over, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    DT.toast("Inspector actief");
  },

  colorPicker(DT, el) {
    const sel = DT.selectorFor(el);
    document.getElementById("dt-role-menu")?.remove();
    const r = el.getBoundingClientRect();
    const pick = (role) => { menu.remove(); DT.module("theme")?.addExtra(DT, sel, role); };
    const menu = DT.el("div", { id: "dt-role-menu", style: `top:${Math.min(innerHeight - 200, Math.max(8, r.top + 8))}px;left:${Math.min(innerWidth - 240, Math.max(8, r.left + 8))}px` }, [
      DT.el("div", { class: "dt-menu-head" }, [DT.el("strong", { text: "Laat meekleuren als…" }), DT.el("small", { text: sel.slice(-60) })]),
      ...[["achtergrond", "Achtergrond (pagina)"], ["vlak", "Vlak (kaart, balk)"], ["accent", "Accent (gekleurde balk)"], ["tekst", "Tekst in accentkleur"]].map(([k, l]) =>
        DT.el("button", { type: "button", class: "dt-menu-item", onclick: (e) => { e.stopPropagation(); pick(k); } }, [DT.el("span", { text: l })]))
    ]);
    menu.className = "dt-role-menu";
    document.body.append(menu);
  },

  stop(DT) {
    document.getElementById("dt-role-menu")?.remove();
    if (!this._active) return;
    this._active = false;
    this._hover?.classList.remove("dt-inspect-hover");
    this._bar?.remove();
    const h = this._handlers;
    document.removeEventListener("mouseover", h.over, true);
    document.removeEventListener("click", h.click, true);
    document.removeEventListener("keydown", h.key, true);
  },

  /* Netwerkrapport: welke API-calls deed deze pagina (en de iframes erin) en welke
   * velden kwamen terug. Alleen structuur (veldnamen en types), geen waarden. */
  netReport(DT) {
    const parts = [];
    const handler = (e) => { if (e.data && e.data.type === "dt:netlog:data") parts.push({ frame: e.data.frame || "?", log: e.data.log || [] }); };
    window.addEventListener("message", handler);
    const ask = (win) => { try { win.postMessage({ type: "dt:netlog:get" }, "*"); for (let i = 0; i < win.frames.length; i++) ask(win.frames[i]); } catch {} };
    ask(window);
    DT.toast("Netwerklog verzamelen…");
    setTimeout(() => {
      window.removeEventListener("message", handler);
      const out = [`# Magister netwerkrapport`, `Pagina: ${location.origin}${location.pathname.replace(/\d{3,}/g, "{id}")}${location.hash.replace(/\d{3,}/g, "{id}")}`, `Datum: ${new Date().toISOString().slice(0, 10)}`, `Frames: ${parts.length} (alleen structuur, geen waarden)`, ``];
      let total = 0;
      for (const part of parts) {
        out.push(`# Frame: ${part.frame} (${part.log.length} calls)`, ``);
        const seen = new Set();
        for (const c of part.log) {
          const key = `${c.method} ${c.url}`;
          if (seen.has(key)) continue; seen.add(key); total++;
          out.push(`## ${key} → ${c.status}`);
          out.push(c.fields ? "```json\n" + JSON.stringify(c.fields, null, 1).replace(/"(string|number|boolean|object|undefined)"/g, "$1") + "\n```" : "(geen JSON)", "");
        }
      }
      const text = out.join("\n");
      DT.download(`magister-netwerk-${(location.hash || "pagina").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.md`, text, "text/markdown");
      DT.copy(text);
      DT.toast(`Netwerkrapport: ${total} unieke calls in ${parts.length} frame(s). Gedownload en gekopieerd.`, "ok", 4000);
    }, 1500);
  },

  /* Probe: volgt op het lesdashboard de links van één deelnemer en rapporteert
   * alleen veldnamen. De calls doet de pagina zelf, met Magister's eigen headers. */
  async probe(DT) {
    const anon = (u) => String(u).replace(/\d{3,}/g, "{id}");
    const fmt = (r) => r.shape ? "```json\n" + JSON.stringify(r.shape, null, 1).replace(/"(string|number|boolean|object|undefined)"/g, "$1") + "\n```" : `(geen JSON${r.error ? ", " + r.error : ""})`;
    const out = [`# Magister probe (veldnamen, geen waarden)`, `Datum: ${new Date().toISOString().slice(0, 10)}`, ``];
    DT.toast("Probe bezig…");
    const src = await DT.apiFind("/deelnemers\\?type=leerling") || await DT.apiFind("/leerlingen/zoeken\\?");
    if (!src) { DT.toast("Geen deelnemers- of leerlingencall gezien. Open eerst Lesdashboard > leerlinglijst of Leerlingen en wacht tot de lijst er staat.", "err", 5000); return; }
    out.push(`Bron: ${anon(src)}`);
    const d = await DT.api(src, { full: true });
    out.push(`Headers van Magister beschikbaar: ${d.hadHeaders ? "ja" : "nee"}`, ``, `## bron → ${d.status}`, fmt(d), ``);
    const first = d.json?.items?.[0];
    if (!first) { out.push("Geen leerlingen in het antwoord (status hierboven)."); }
    else {
      const links = first.links || {};
      out.push(`## links van een deelnemer`, ...Object.entries(links).map(([k, v]) => `- ${k}: ${anon(v?.href || v)}`), ``);
      const targets = [...new Set([`/api/leerlingen/${first.id}`, ...Object.values(links).map((v) => v?.href).filter((h) => typeof h === "string")])].slice(0, 8);
      for (const url of targets) { const r = await DT.api(url); out.push(`## GET ${anon(url)} → ${r.status}`, fmt(r), ``); }
      const l = await DT.api(`/api/leerlingen/${first.id}`, { full: true });
      const sub = Object.entries(l.json?.links || {}).map(([k, v]) => [k, v?.href]).filter(([, h]) => typeof h === "string" && !targets.includes(h)).slice(0, 12);
      for (const [k, url] of sub) { const r = await DT.api(url); out.push(`## leerling.links.${k}: GET ${anon(url)} → ${r.status}`, fmt(r), ``); }
    }
    const text = out.join("\n");
    DT.download(`magister-probe.md`, text, "text/markdown");
    DT.copy(text);
    DT.toast("Probe klaar: gedownload en gekopieerd.", "ok", 4000);
  },

  /* Paginarapport zonder inhoud van cellen (alleen koppen, structuur en attributen).
   * Gaat 7 niveaus diep, kijkt ook in shadow DOM en herkent Magister's eigen
   * componenten (tags met een streepje) en div-gebaseerde grids. */
  report(DT) {
    const out = [];
    const skip = (el) => el.closest?.("#dt-panel, #dt-handle, #dt-toasts, #dt-inspect-bar, #dt-ai-dialog, .dt-table-tools");
    const kids = (el) => [...(el.shadowRoot ? el.shadowRoot.children : []), ...el.children];
    const anon = (s) => s.replace(/\d{3,}/g, "{id}");

    out.push(`# Magister paginarapport`);
    out.push(`URL-patroon: ${location.origin}${anon(location.pathname)}${anon(location.hash)}`);
    out.push(`Titel: ${document.title}`);
    out.push(`Datum: ${new Date().toISOString().slice(0, 10)}`);
    out.push(`Frame: ${DT.isTop ? "hoofdpagina" : "iframe (" + location.host + location.pathname + ")"}`);
    const frames = [...document.querySelectorAll("iframe")].map((f) => `${f.id ? "#" + f.id : "iframe"} → ${(f.src || "").replace(/\d{3,}/g, "{id}") || "(geen src)"}`);
    if (frames.length) out.push(`Iframes op deze pagina: ${frames.join("; ")} (klik eerst in het frame en druk dan op Alt+I, R voor een rapport van de inhoud)`);
    // Bovenliggende frames (zelfde domein): handig om te zien in welke schil een pagina zit.
    if (!DT.isTop) {
      const up = []; let w = window;
      while (w !== w.parent) { w = w.parent; try { up.push((w.location.host + w.location.pathname + w.location.hash).replace(/\d{3,}/g, "{id}")); } catch { up.push("(ander domein)"); break; } }
      out.push(`Bovenliggende frames: ${up.join(" ← ")}`);
      try {
        const title = window.top.document.title;
        const heads = DT.deepQueryAll("h1, h2, [class*=title], [class*=header]", window.top.document).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()).filter((t) => t && t.length <= 80);
        out.push(`Hoofdpagina: titel "${title.replace(/\d{3,}/g, "{id}")}", koppen: ${[...new Set(heads)].slice(0, 12).map((t) => t.replace(/\b\d{5,8}\b/g, "{nr}").replace(/\b([A-Z][a-zà-ÿ]+)(?:\s+(?:van|de|der|den|le|du|te|ten)\s+)?(\s+[A-Z][a-zà-ÿ]+)+\b/g, "{naam}")).join(" | ") || "(geen)"}`);
      } catch {}
    }
    out.push(``);

    out.push(`## Hoofdstructuur (tot 12 niveaus diep, shadow DOM inbegrepen)`);
    const customTags = new Map();
    const walk = (el, depth) => {
      if (depth > 12 || !el) return;
      for (const c of kids(el)) {
        if (skip(c)) continue;
        if (/^(script|style|link|svg|path|template)$/i.test(c.tagName)) continue;
        if (c.localName.includes("-")) customTags.set(c.localName, (customTags.get(c.localName) || 0) + 1);
        const rect = c.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 16) continue;
        if (rect.bottom < 0 || rect.top > innerHeight * 3) continue;
        const shadow = c.shadowRoot ? " [shadow]" : "";
        const role = c.getAttribute("role") ? ` role=${c.getAttribute("role")}` : "";
        const n = kids(c).length;
        out.push(`${"  ".repeat(depth)}- ${DT.selectorFor(c)}${role}${shadow} (${Math.round(rect.width)}x${Math.round(rect.height)}, ${n} kind${n === 1 ? "" : "eren"})`);
        // Repetitieve lijsten: alleen de eerste twee kinderen uitdiepen.
        const ch = kids(c);
        if (ch.length > 6 && depth >= 2) {
          out.push(`${"  ".repeat(depth + 1)}(${ch.length} vergelijkbare kinderen, eerste 2 getoond)`);
          ch.slice(0, 2).forEach((x) => walk(wrap(x), depth + 1));
        } else walk(c, depth + 1);
      }
    };
    const wrap = (x) => ({ children: [x], shadowRoot: null });
    walk(document.body, 0);

    out.push(``, `## Eigen componenten (tagnaam: aantal)`);
    [...customTags.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => out.push(`- ${t}: ${n}`));

    out.push(``, `## Tabellen en grids`);
    const grids = DT.deepQueryAll("table, [role=grid], [role=table], [role=treegrid], [role=list], [class*=grid], [class*=Grid], [class*=datatable], [class*=table], [class*=list]").filter((t) => !skip(t) && t.getBoundingClientRect().height > 60);
    grids.forEach((t, i) => {
      const rows = t.querySelectorAll("tr, [role=row], [class*=row]:not([class*=rows])").length;
      const head = t.querySelector("thead tr, [role=row], [class*=header]");
      const heads = head ? [...head.querySelectorAll("th, [role=columnheader], [role=gridcell], [class*=cell], [class*=col]")].map((c) => c.textContent.trim()).filter(Boolean).slice(0, 15) : [];
      out.push(`- ${i + 1}: ${DT.selectorFor(t)} | tag: ${t.localName} | rijen: ${rows} | koppen: ${heads.join(" | ") || "(geen)"}`);
    });
    if (!grids.length) out.push("(geen tabellen of grids gevonden)");

    out.push(``, `## Formuliervelden`);
    const fields = [];
    const collectFields = (root) => {
      root.querySelectorAll("input, select, textarea, button, [role=button], [role=checkbox], [contenteditable=true]").forEach((f) => { if (!skip(f)) fields.push(f); });
      root.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) collectFields(e.shadowRoot); });
    };
    collectFields(document);
    const seenF = new Set();
    fields.forEach((f) => {
      const label = f.labels?.[0]?.textContent || f.getAttribute("aria-label") || f.placeholder || f.textContent || "";
      const norm = (t) => t.replace(/\b\d+\b/g, "#").replace(/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b/gi, "~");
      const line = `- ${f.localName}${f.type ? `[type=${f.type}]` : ""}${f.getAttribute("role") ? `[role=${f.getAttribute("role")}]` : ""} name="${f.name || ""}" label="${label.trim().replace(/\s+/g, " ").slice(0, 40)}" → ${DT.selectorFor(f)}`;
      const key = norm(line);
      if (!seenF.has(key)) { seenF.add(key); out.push(line); }
    });

    out.push(``, `## CSS-variabelen (designsysteem, voor echte thema's)`);
    const tokens = new Map();
    const readSheet = (sheet) => {
      let rules; try { rules = sheet.cssRules; } catch { return; }
      for (const r of rules) {
        if (!r.style) continue;
        for (const name of r.style) if (name.startsWith("--") && !tokens.has(name)) tokens.set(name, r.style.getPropertyValue(name).trim().slice(0, 60));
        if (tokens.size > 400) return;
      }
    };
    [...document.styleSheets].forEach(readSheet);
    document.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) { [...e.shadowRoot.styleSheets, ...(e.shadowRoot.adoptedStyleSheets || [])].forEach(readSheet); } });
    const cs = getComputedStyle(document.documentElement);
    [...tokens.entries()].slice(0, 400).forEach(([k, v]) => out.push(`- ${k}: ${v}${cs.getPropertyValue(k) ? ` (berekend: ${cs.getPropertyValue(k).trim().slice(0, 40)})` : ""}`));
    if (!tokens.size) out.push("(geen variabelen gevonden)");

    out.push(``, `## Menu en navigatie`);
    const seen = new Set();
    document.querySelectorAll("nav a, nav li, [role=navigation] a, aside a, header a, .menu a, .menu li, [class*=menu] a, [class*=nav] a").forEach((a) => {
      if (skip(a)) return;
      const txt = a.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
      const href = anon(a.getAttribute("href") || a.closest("a")?.getAttribute("href") || "");
      const key = txt + href;
      if (!txt || seen.has(key)) return; seen.add(key);
      out.push(`- ${txt}${href ? " → " + href : ""} (${DT.selectorFor(a)})`);
    });

    const text = out.join("\n");
    const slug = (location.hash || location.pathname).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "pagina";
    DT.download(`magister-rapport-${DT.isTop ? "" : "frame-"}${slug}.md`, text, "text/markdown");
    DT.copy(text);
    DT.toast("Rapport gedownload en gekopieerd. Plak het naar Claude.", "ok", 4000);
  }
});
