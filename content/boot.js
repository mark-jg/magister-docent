/* Opstarten: instellingen laden, modules starten, en live reageren op wijzigingen uit de instellingenpagina. */
(async () => {
  // Frames zonder body of head (zoals Magisters sessie-iframe) hebben niets te themen.
  if (!document.body || !document.head) return;
  await DT.loadSettings();
  DT.startAll();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync" || !changes.settings) return;
    await DT.loadSettings();
    DT.startAll();
    DT.notify();
    document.dispatchEvent(new CustomEvent("dt:settings"));
  });
  if (DT.isTop) console.info(`[Docent Tools voor Magister] v${DT.version} actief`);
})();
