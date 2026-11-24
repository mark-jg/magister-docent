/* Antwoordt op vragen van de zijkolom (sidepanel/): de tabellen van deze pagina, een export, de tekst van de
 * pagina, of een onderdeel openen. De kolom is een eigen pagina van de extensie en kan zelf niet bij Magister.
 * Alleen het hoofdvenster antwoordt; frames zwijgen, zodat er precies één antwoord komt. */
(() => {
  if (window !== window.top || !globalThis.DT) return;
  const ACTIES = {
    klasExcel: () => DT.module("aanwezigexport")?.klas(DT),
    bespreeklijst: () => DT.module("aanwezigexport")?.bespreeklijst(DT),
    lesreg: () => DT.module("lesreg")?.open(DT, null),
  };
  const MODULE = { klasExcel: "aanwezigexport", bespreeklijst: "aanwezigexport", lesreg: "lesreg" };

  function antwoord(msg) {
    const T = DT.module("tables");
    switch (msg.vraag) {
      case "status": return { ok: true, versie: DT.version };
      case "tabellen": {
        if (!DT.actief("tables")) return { ok: true, uit: true, tabellen: [] };
        T.scan(DT);
        return { ok: true, tabellen: (T._tables || []).map((t, i) => ({ naam: T.name(t, i), rijen: Math.max(0, DT.tableToMatrix(t).length - 1) })) };
      }
      case "tabel": {
        if (!DT.actief("tables")) return { ok: false, fout: "De module Tabelexport staat uit." };
        const t = (T._tables || [])[msg.index];
        if (!t || !t.isConnected) return { ok: false, fout: "Deze tabel staat niet meer op de pagina." };
        const naam = T.name(t, msg.index);
        if (msg.actie === "toon") t.scrollIntoView({ behavior: "smooth", block: "center" });
        else if (msg.actie === "opties") T.dialog(DT, t, null, naam);
        else if (msg.actie === "xlsx" || msg.actie === "csv") T.run(DT, t, msg.actie, naam);
        else return { ok: false, fout: "Onbekende actie." };
        return { ok: true };
      }
      case "paginaTekst": {
        const hoofd = document.querySelector('ui-view[name="main"]') || document.body;
        return { ok: true, tekst: (hoofd.innerText || hoofd.textContent || "").replace(/\n{3,}/g, "\n\n").trim() };
      }
      case "actie": {
        const doe = ACTIES[msg.naam];
        if (!doe) return { ok: false, fout: "Onbekende actie." };
        if (!DT.actief(MODULE[msg.naam])) return { ok: false, fout: "Dit onderdeel staat uit. Zet het aan bij Modules." };
        doe();
        return { ok: true };
      }
    }
    return { ok: false, fout: "Onbekende vraag." };
  }

  chrome.runtime.onMessage.addListener((msg, _afzender, stuur) => {
    if (msg?.type !== "dt:kolom") return;
    let uit;
    try { uit = antwoord(msg); } catch (e) { uit = { ok: false, fout: String(e?.message || e) }; }
    if (uit && uit.ok === false && uit.fout) { try { DT.toast(uit.fout, "err", 4500); } catch {} }
    stuur(uit);
  });
  globalThis.DT_KOLOM_ANTWOORD = antwoord;   // voor de tests
})();
