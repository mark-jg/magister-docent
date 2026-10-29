/* Jarig: (aankomende) jarige leerlingen op het startscherm.
 * Haalt dezelfde lijst op die Magister voor het lesdashboard gebruikt (/api/leerlingen/jarigen),
 * met je eigen Magister-sessie via het netwerk-script in de pagina; er gaat niets naar buiten.
 * De klas komt per leerling uit /api/leerlingen/{id} (stamklas.code), zoals de leerlingkaart.
 * Klikken opent de leerlingkaart via Magisters eigen routering ($state.go "persoonsgegevens").
 * Zet daarnaast Mededelingen onder de agenda, zodat de rechterkolom korter wordt. */
DT.register({
  id: "jarig",
  _stop: null,
  _card: null,
  _data: null,
  _fetchedAt: 0,
  _busy: false,
  _klas: new Map(),
  _style: null,

  init(DT) {
    this._stop = DT.observe(() => this.mount(DT), { debounce: 800, poll: 4000 });
  },

  destroy() {
    this._stop && this._stop();
    this._card?.remove(); this._card = null;
    this._style?.remove(); this._style = null;
    delete document.documentElement.dataset.dtJarig;
  },

  layout() {
    if (!this._style) {
      this._style = document.createElement("style");
      this._style.id = "dt-jarig-style";
      this._style.textContent = `@media (min-width: 1025px) {
        .widget-container:has(> #vandaag-mededelingen) { grid-template-rows: auto 1fr; }
        .widget-container > #vandaag-mededelingen { grid-column: 1; margin: 0; }
        .widget-container > .small-widgets { grid-column: 2; grid-row: 1 / span 2; }
      }`;
      document.head.append(this._style);
    }
    const grid = document.querySelector(".widget-container");
    const mede = grid?.querySelector(".small-widgets #vandaag-mededelingen");
    const agenda = grid?.querySelector(":scope > sm-agenda-widget");
    if (mede && agenda) agenda.after(mede);
  },

  async mount(DT) {
    if (!DT.isTop) return;
    const column = document.querySelector("#vandaag-agenda") && (document.querySelector(".small-widgets") || document.querySelector("#vandaag-notificatie")?.parentElement);
    if (!column) { if (this._card) { this._card.remove(); this._card = null; } return; }
    this.layout();
    if (this._card && this._card.isConnected && Date.now() - this._fetchedAt < 6 * 3600e3) return;
    if (this._busy) return;
    this._busy = true;
    try {
      if (!this._data || Date.now() - this._fetchedAt > 6 * 3600e3) {
        const r = await DT.api("/api/leerlingen/jarigen", { full: true, timeout: 12000 });
        if (r.status !== 200 || !r.json) { this._busy = false; return; }
        this._data = Array.isArray(r.json) ? r.json : (r.json.items || r.json.Items || []);
        this._fetchedAt = Date.now();
      }
      const dagen = Number(DT.settings.jarig?.dagen) || 14;
      const list = jarigList(this._data, new Date(), dagen, this._klas);
      document.documentElement.dataset.dtJarig = String(list.filter((x) => x.days === 0).length);
      this.render(column, list, dagen);
      /* Klas per leerling opzoeken (alleen wie in de kaart staat), daarna opnieuw tekenen. */
      const todo = list.filter((x) => x.id && !this._klas.has(x.id)).slice(0, 40);
      if (todo.length) {
        await this.lookupKlas(DT, todo);
        this.render(column, jarigList(this._data, new Date(), dagen, this._klas), dagen);
      }
    } finally { this._busy = false; }
  },

  async lookupKlas(DT, items) {
    const one = async (x) => {
      let klas = "";
      const r = await DT.api(`/api/leerlingen/${encodeURIComponent(x.id)}`, { full: true, timeout: 8000 });
      if (r.status === 200 && r.json) klas = klasOf(r.json);
      if (!klas) {
        const z = await DT.api(`/api/leerlingen/zoeken?q=${encodeURIComponent(x.name)}&top=5&rol=Leerling`, { full: true, timeout: 8000 });
        const items = z.status === 200 && z.json ? (Array.isArray(z.json) ? z.json : z.json.items || []) : [];
        const hit = items.find((p) => String(p.id) === String(x.id)) || (items.length === 1 ? items[0] : null);
        if (hit) klas = klasOf(hit);
      }
      this._klas.set(x.id, klas || "");
    };
    const queue = items.slice();
    await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await one(queue.shift()); }));
  },

  render(column, list, dagen) {
    const html = jarigCardHtml(list, dagen);
    if (!this._card || !this._card.isConnected) {
      this._card = document.createElement("dna-card");
      this._card.id = "dt-jarig";
      this._card.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-id]");
        if (!a || e.metaKey || e.ctrlKey || e.button) return;
        e.preventDefault();
        openLeerling(a.dataset.id, a.getAttribute("href"));
      });
      const mede = column.querySelector("#vandaag-mededelingen");
      if (mede) column.insertBefore(this._card, mede); else column.append(this._card);
    }
    if (this._card.innerHTML !== html) this._card.innerHTML = html;
  }
});

/* Klascode uit een leerling- of zoekresultaat (stamklas.code zoals Magister die toont). */
function klasOf(o) {
  if (!o || typeof o !== "object") return "";
  const sk = o.stamklas || o.Stamklas || o.groep || o.klas;
  if (typeof sk === "string") return sk;
  if (sk && typeof sk === "object") return sk.code || sk.naam || sk.omschrijving || "";
  return "";
}

/* Leerlingkaart openen zoals Magister zelf: $state.go("persoonsgegevens", {type:"leerling", id}).
 * Lukt dat niet, dan via de URL. */
function openLeerling(id, href) {
  const mid = Math.random().toString(36).slice(2);
  let done = false;
  const h = (e) => {
    if (e.source !== window || e.data?.type !== "dt:state:result" || e.data.id !== mid) return;
    window.removeEventListener("message", h); done = true;
    if (!e.data.ok && href) location.hash = href.replace(/^#/, "");
  };
  window.addEventListener("message", h);
  window.postMessage({ type: "dt:state:go", id: mid, name: "persoonsgegevens", params: { type: "leerling", id: String(id) } }, "*");
  setTimeout(() => { if (!done) { window.removeEventListener("message", h); if (href) location.hash = href.replace(/^#/, ""); } }, 1500);
}

/* Lijst van jarigen binnen `dagen` dagen: naam, klas, dagen tot verjaardag, leeftijd die ze worden. */
function jarigList(items, now, dagen, klasMap) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (const p of items || []) {
    const geb = p.geboortedatum || p.Geboortedatum; if (!geb) continue;
    const g = new Date(geb); if (isNaN(g)) continue;
    let next = new Date(today.getFullYear(), g.getMonth(), g.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, g.getMonth(), g.getDate());
    const days = Math.round((next - today) / 864e5);
    if (days > dagen) continue;
    const id = p.id || p.Id;
    const name = [p.roepnaam || p.Roepnaam, p.tussenvoegsel || p.Tussenvoegsel, p.achternaam || p.Achternaam].filter(Boolean).join(" ").trim();
    const klas = klasOf(p) || (klasMap && klasMap.get(id)) || "";
    out.push({ id, name, klas, days, age: next.getFullYear() - g.getFullYear(), date: next, initials: name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).map((w) => w[0].toUpperCase()).filter((c, i, a) => i === 0 || i === a.length - 1).join("") });
  }
  return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

function jarigCardHtml(list, dagen) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"], MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const when = (x) => x.days === 0 ? "Vandaag" : x.days === 1 ? "Morgen" : `${DAYS[x.date.getDay()]} ${x.date.getDate()} ${MONTHS[x.date.getMonth()]}`;
  const PAL = ["#FF2D55", "#FF9500", "#34C759", "#007AFF", "#AF52DE", "#5856D6", "#00A99D"];
  const color = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
  const rows = list.map((x) => `
    <li class="dt-jarig-row${x.days === 0 ? " dt-jarig-today" : ""}">
      <a href="#/contactdetails/Docent/leerling/${esc(x.id)}/naw" data-id="${esc(x.id)}" title="Open leerlingkaart">
        <span class="dt-jarig-av" style="--k:${color(x.name)}">${esc(x.initials || "?")}</span>
        <span class="dt-jarig-text"><span class="dt-jarig-name">${esc(x.name)}</span><span class="dt-jarig-sub">${esc(x.klas ? x.klas + " · " : "")}${x.days === 0 ? `${x.age} jaar` : `wordt ${x.age}`}</span></span>
        <span class="dt-jarig-when">${when(x)}</span>
      </a>
    </li>`).join("");
  const count = list.filter((x) => x.days === 0).length;
  return `<dna-card-title>Jarig${count ? ` <span class="dt-jarig-badge">${count}</span>` : ""}</dna-card-title>
    ${list.length ? `<ul class="dt-jarig-list">${rows}</ul>` : `<div class="dt-jarig-empty">Geen jarigen de komende ${dagen} dagen.</div>`}`;
}
