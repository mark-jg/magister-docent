/* Jarig: (aankomende) jarige leerlingen op het startscherm.
 * Haalt dezelfde lijst op die Magister voor het lesdashboard gebruikt (/api/leerlingen/jarigen),
 * met je eigen Magister-sessie via het netwerk-script in de pagina; er gaat niets naar buiten.
 * Toont een kaart "Jarig" naast de notificaties: vandaag, morgen en de komende dagen. */
DT.register({
  id: "jarig",
  _stop: null,
  _card: null,
  _data: null,
  _fetchedAt: 0,
  _busy: false,

  init(DT) {
    this._stop = DT.observe(() => this.mount(DT), { debounce: 800, poll: 4000 });
  },

  destroy() {
    this._stop && this._stop();
    this._card?.remove(); this._card = null;
    delete document.documentElement.dataset.dtJarig;
  },

  async mount(DT) {
    if (!DT.isTop) return;
    const column = document.querySelector("#vandaag-agenda") && (document.querySelector(".small-widgets") || document.querySelector("#vandaag-notificatie")?.parentElement);
    if (!column) { if (this._card) { this._card.remove(); this._card = null; } return; }
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
      const list = jarigList(this._data, new Date(), dagen);
      document.documentElement.dataset.dtJarig = String(list.filter((x) => x.days === 0).length);
      const html = jarigCardHtml(list, dagen);
      if (!this._card || !this._card.isConnected) {
        this._card = document.createElement("dna-card");
        this._card.id = "dt-jarig";
        const mede = column.querySelector("#vandaag-mededelingen");
        if (mede) column.insertBefore(this._card, mede); else column.append(this._card);
      }
      if (this._card.innerHTML !== html) this._card.innerHTML = html;
    } finally { this._busy = false; }
  }
});

/* Lijst van jarigen binnen `dagen` dagen: naam, klas, dagen tot verjaardag, leeftijd die ze worden. */
function jarigList(items, now, dagen) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (const p of items || []) {
    const geb = p.geboortedatum || p.Geboortedatum; if (!geb) continue;
    const g = new Date(geb); if (isNaN(g)) continue;
    let next = new Date(today.getFullYear(), g.getMonth(), g.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, g.getMonth(), g.getDate());
    const days = Math.round((next - today) / 864e5);
    if (days > dagen) continue;
    const name = [p.roepnaam || p.Roepnaam, p.tussenvoegsel || p.Tussenvoegsel, p.achternaam || p.Achternaam].filter(Boolean).join(" ").trim();
    const klasRaw = p.stamklas || p.klas || p.groep || p.Stamklas || p.Klas || "";
    const klas = typeof klasRaw === "string" ? klasRaw : (klasRaw && (klasRaw.naam || klasRaw.omschrijving || klasRaw.code)) || "";
    out.push({ id: p.id || p.Id, name, klas, days, age: next.getFullYear() - g.getFullYear(), date: next, initials: name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).map((w) => w[0].toUpperCase()).filter((c, i, a) => i === 0 || i === a.length - 1).join("") });
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
      <a href="#/contactdetails/Docent/leerling/${esc(x.id)}/naw" title="Open leerlingkaart">
        <span class="dt-jarig-av" style="--k:${color(x.name)}">${esc(x.initials || "?")}</span>
        <span class="dt-jarig-text"><span class="dt-jarig-name">${esc(x.name)}</span><span class="dt-jarig-sub">${esc(x.klas ? x.klas + " · " : "")}${x.days === 0 ? `${x.age} jaar` : `wordt ${x.age}`}</span></span>
        <span class="dt-jarig-when">${when(x)}</span>
      </a>
    </li>`).join("");
  const count = list.filter((x) => x.days === 0).length;
  return `<dna-card-title>Jarig${count ? ` <span class="dt-jarig-badge">${count}</span>` : ""}</dna-card-title>
    ${list.length ? `<ul class="dt-jarig-list">${rows}</ul>` : `<div class="dt-jarig-empty">Geen jarigen de komende ${dagen} dagen.</div>`}`;
}
