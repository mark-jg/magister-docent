/* Opstarten: instellingen laden, modules starten, en live reageren op wijzigingen uit de instellingenpagina. */
(async () => {
  // Frames zonder body of head (zoals Magisters sessie-iframe) hebben niets te themen.
  if (!document.body || !document.head) return;
  /* Staan er twee versies tegelijk aan (bijvoorbeeld de gewone en de ontwikkelversie), dan zou alles dubbel
   * verschijnen. De tweede start niet en meldt het. */
  const eerste = document.documentElement.dataset.dtExt;
  if (eerste && eerste !== chrome.runtime.id) {
    if (DT.isTop) setTimeout(() => DT.toast(`Er staan twee versies van Docentdeck aan. Versie ${DT.version} is nu niet actief: zet op chrome://extensions één van de twee uit en herlaad dit tabblad.`, "err", 15000), 1500);
    return;
  }
  document.documentElement.dataset.dtExt = chrome.runtime.id;
  await DT.loadSettings();
  DT.startAll();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync" || !changes.settings) return;
    await DT.loadSettings();
    DT.startAll();
    DT.notify();
    document.dispatchEvent(new CustomEvent("dt:settings"));
  });
  if (DT.isTop) console.info(`[Docentdeck voor Magister] v${DT.version} actief`);
})();
