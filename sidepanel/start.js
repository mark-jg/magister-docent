/* Zet de zijkolom in gang: instellingen laden, het paneel tekenen en bijblijven bij wat er elders verandert. */
(async () => {
  await DT.loadSettings();
  DtKolom.thema();
  document.body.dataset.blad = "start";
  DT.module("panel").init(DT);
  DtKolom.versie();

  /* Instellingen die elders zijn gewijzigd (de pagina, het tabblad Instellingen hiernaast, een andere computer). */
  chrome.storage.onChanged.addListener(async (wat, gebied) => {
    if (gebied === "sync" && wat.settings) { await DT.loadSettings(); DtKolom.thema(); DT.notify(); }
    if (gebied === "local" && (wat.update || wat.dev)) DtKolom.versie();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => DtKolom.thema());

  /* Tabbladen van de kolom, met pijltjestoetsen zoals bij een tablijst hoort. */
  const tabs = [...document.querySelectorAll(".kolom-tabs button")];
  for (const knop of tabs) knop.addEventListener("click", () => DtKolom.toon(knop.dataset.blad));
  document.querySelector(".kolom-tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const nu = tabs.findIndex((k) => k.getAttribute("aria-selected") === "true");
    const naar = tabs[(nu + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    e.preventDefault(); DtKolom.toon(naar.dataset.blad); naar.focus();
  });
  for (const id of ["updKnop", "updatesKnop"]) document.getElementById(id).addEventListener("click", () => DtKolom.toon("meer", "updates"));
  document.getElementById("herlaadKnop").addEventListener("click", async () => { const tab = await DtKolom.tab(); if (tab) chrome.tabs.reload(tab.id); });

  /* De lijst met tabellen hoort bij de pagina die je voor je hebt: bijwerken als je van tabblad of scherm wisselt. */
  let wacht;
  const ververs = () => { clearTimeout(wacht); wacht = setTimeout(() => DT.module("panel").tabellen(), 700); };
  chrome.tabs.onActivated.addListener(ververs);
  chrome.tabs.onUpdated.addListener((_id, wijziging, tab) => { if (tab.active && (wijziging.status === "complete" || wijziging.url)) ververs(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) ververs(); });

  /* De achtergrond weet zo dat de kolom in dit venster open staat (Alt+D sluit hem dan), en kan hem vragen een
   * tabblad te tonen of te sluiten. */
  const venster = await chrome.windows.getCurrent().catch(() => null);
  const lijn = chrome.runtime.connect({ name: "dt-kolom" });
  lijn.postMessage({ windowId: venster?.id ?? null });
  lijn.onMessage.addListener((m) => { if (m?.type === "sluit") window.close(); else if (m?.type === "toon") DtKolom.toon(m.blad, m.anker || ""); });
})();
