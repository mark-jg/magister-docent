/* De zijkolom van de browser: verbinding met het Magister-tabblad, tabbladen, het thema van de kolom zelf en de
 * meldingen bovenaan. De inhoud van het tabblad Start staat in paneel.js; start.js zet alles in gang. */
const DtKolom = {
  /* Het tabblad dat in dit venster voor staat, als dat Magister is; anders null. */
  async tab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab && /^https?:\/\/[^/]*\.magister\.net\//.test(tab.url || "") ? tab : null;
    } catch { return null; }
  },

  /* Een vraag aan de pagina (content/kolom.js). Geeft het antwoord, of null als er geen Magister-tabblad is of de
   * pagina niet antwoordt (dan draait daar nog een oude versie: de melding "Herlaad" verschijnt). */
  async vraag(bericht) {
    const tab = await this.tab();
    this.meld("geenMagister", !tab);
    if (!tab) { this.meld("herladen", false); return null; }
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: "dt:kolom", ...bericht }, { frameId: 0 });
      this.meld("herladen", !r);
      return r || null;
    } catch { this.meld("herladen", true); return null; }
  },

  /* Een sneltoets-opdracht (export, mail-coach, inspector) naar alle frames van het tabblad: de melding of de
   * tabel kan in een iframe staan. */
  async opdracht(command) {
    const tab = await this.tab();
    if (!tab) return DT.toast("Open eerst een Magister-tabblad", "err");
    chrome.tabs.sendMessage(tab.id, { type: "command", command }).catch(() => this.meld("herladen", true));
  },

  meld(id, aan) { const el = document.getElementById(id); if (el) el.hidden = !aan; },

  /* De instellingenpagina (options.html?kolom=1) wordt één keer geladen, zodra een tabblad haar nodig heeft. Ze
   * krijgt de hoogte van haar inhoud, zodat de kolom als één geheel schuift. */
  instellingen() {
    return this._frame ||= new Promise((klaar) => {
      const frame = document.getElementById("instellingen");
      frame.addEventListener("load", () => {
        const doc = frame.contentDocument, hoogte = () => { frame.style.height = `${Math.ceil(doc.querySelector("main").getBoundingClientRect().height) + 4}px`; };
        new ResizeObserver(hoogte).observe(doc.querySelector("main")); hoogte();
        klaar(frame);
      }, { once: true });
      frame.src = chrome.runtime.getURL("options/options.html") + "?kolom=1&blad=uiterlijk";
    });
  },

  /* Een tabblad tonen: start, uiterlijk, modules of meer. `anker` is een onderdeel van de instellingen
   * (bijvoorbeeld "updates"): het tabblad waar dat bij hoort wordt gekozen en het onderdeel klapt open. */
  async toon(blad, anker = "") {
    if (!["start", "uiterlijk", "modules", "meer"].includes(blad)) blad = "meer";   // oude naam "instellingen"
    let frame = null, sectie = null;
    if (blad !== "start" || anker) {
      frame = await this.instellingen();
      sectie = anker ? frame.contentDocument.getElementById(anker) : null;
      if (sectie?.dataset.blad) blad = sectie.dataset.blad;
    }
    document.body.dataset.blad = blad;
    for (const knop of document.querySelectorAll(".kolom-tabs button")) {
      const aan = knop.dataset.blad === blad;
      knop.setAttribute("aria-selected", String(aan)); knop.tabIndex = aan ? 0 : -1;
      if (aan) document.getElementById("blad").setAttribute("aria-labelledby", knop.id);
    }
    const instel = document.getElementById("instellingen"), main = document.getElementById("blad");
    instel.hidden = blad === "start";
    if (frame && blad !== "start") frame.contentDocument.documentElement.dataset.blad = blad;
    if (sectie) {
      frame.contentWindow.klap?.(sectie, true);
      requestAnimationFrame(() => main.scrollTo({ top: instel.offsetTop + sectie.offsetTop - main.offsetTop - 6 }));
    } else main.scrollTo({ top: 0 });
  },

  /* De kolom volgt het gekozen thema: licht of donker, de accentkleur en bij een opgemaakt thema ook de vlakken. */
  thema() {
    const p = dtThemaPalet(DT.settings.theme, matchMedia("(prefers-color-scheme: dark)").matches);
    const html = document.documentElement, st = html.style;
    const systeemDonker = p.id === "magister" && matchMedia("(prefers-color-scheme: dark)").matches;   // Magister: de kolom volgt de computer
    html.classList.toggle("dt-dark", p.dark === true || systeemDonker);
    for (const n of ["--dt-accent", "--dt-accent-ink", "--dt-bg", "--dt-fg", "--dt-muted", "--dt-line", "--dt-font"]) st.removeProperty(n);
    document.body.style.cssText = "";
    if (DT.settings.theme.enabled === false || !p.bg) return;
    st.setProperty("--dt-accent", p.accent); st.setProperty("--dt-accent-ink", "#ffffff");
    st.setProperty("--dt-bg", p.surface); st.setProperty("--dt-fg", p.fg); st.setProperty("--dt-muted", p.muted); st.setProperty("--dt-line", p.border);
    if (FONTS[p.font]) st.setProperty("--dt-font", FONTS[p.font]);
    document.body.style.setProperty("--dt-panel-bg", p.bg); document.body.style.setProperty("--dt-card", p.surface);
  },

  /* Meldingen bovenaan: een nieuwe versie, of net bijgewerkt. */
  async versie() {
    const versie = chrome.runtime.getManifest().version;
    const { update, dev, justUpdated } = await chrome.storage.local.get(["update", "dev", "justUpdated"]);
    document.getElementById("versie").textContent = `v${versie}${dev ? " · dev" : ""}`;
    document.getElementById("versieVoet").textContent = dev ? "Ontwikkelversie: bijwerken met git" : update?.available ? `Versie ${update.latest} beschikbaar` : update?.error ? "Updatecontrole mislukt" : `Je hebt de nieuwste versie (${versie})`;
    this.meld("update", !!update?.available);
    if (update?.available) {
      document.getElementById("updTitel").textContent = `Versie ${update.latest} beschikbaar`;
      document.getElementById("updTekst").textContent = `Je gebruikt nu ${versie}.`;
    }
    if (justUpdated) {
      if (justUpdated.to === versie) { document.getElementById("bijgewerktTekst").textContent = `Bijgewerkt van ${justUpdated.from} naar ${justUpdated.to}.`; this.meld("bijgewerkt", true); }
      chrome.storage.local.remove("justUpdated");
    }
  },
};
