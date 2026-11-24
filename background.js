importScripts("content/defaults.js");

/* ---------- Ontwikkelversie ----------
 * package.json zit niet in de zip voor de Chrome Web Store, alleen in een map die uit git komt. Zo'n map krijgt
 * het label DEV op het icoon, zodat je ziet welke versie je voor je hebt. Updates lopen via de Web Store. */
async function devLabel() {
  const dev = await fetch(chrome.runtime.getURL("package.json")).then((r) => r.ok, () => false);
  await chrome.storage.local.set({ dev });
  if (!dev) return;
  await chrome.action.setBadgeText({ text: "DEV" });
  await chrome.action.setBadgeBackgroundColor({ color: "#AF52DE" });
  await chrome.action.setTitle({ title: `Docentdeck voor Magister ${chrome.runtime.getManifest().version} (ontwikkelversie)` });
}
chrome.runtime.onStartup.addListener(() => { devLabel(); });

/* ---------- Zijkolom ----------
 * Het paneel en de instellingen staan in de zijkolom van de browser (sidepanel/). Een klik op het
 * icoon opent hem. De kolom meldt zich hier per venster aan, zodat Alt+D hem ook weer kan sluiten en een ander
 * onderdeel hem een tabblad kan laten tonen. De browser opent de kolom alleen direct na een klik of toets:
 * daarom hier nergens eerst wachten (await) vóór chrome.sidePanel.open. */
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
const kolommen = new Map();   // venster -> verbinding met de open kolom
const straks = new Map();     // venster -> { blad, anker } om te tonen zodra de kolom open is
chrome.runtime.onConnect.addListener((lijn) => {
  if (lijn.name !== "dt-kolom") return;
  let venster = null;
  lijn.onMessage.addListener((m) => {
    if (m?.windowId == null) return;
    venster = m.windowId; kolommen.set(venster, lijn);
    const wens = straks.get(venster);
    if (wens) { straks.delete(venster); lijn.postMessage({ type: "toon", ...wens }); }
  });
  lijn.onDisconnect.addListener(() => { if (venster != null && kolommen.get(venster) === lijn) kolommen.delete(venster); });
});
function zijkolom(windowId, { alleenOpenen = false, blad = null, anker = "" } = {}) {
  if (windowId == null || !chrome.sidePanel) return chrome.runtime.openOptionsPage();
  const open = kolommen.get(windowId);
  if (open) {
    try { open.postMessage(blad ? { type: "toon", blad, anker } : alleenOpenen ? { type: "toon", blad: "start" } : { type: "sluit" }); } catch {}
    return;
  }
  if (blad) straks.set(windowId, { blad, anker });
  chrome.sidePanel.open({ windowId }).catch(() => { straks.delete(windowId); if (blad === "instellingen") chrome.runtime.openOptionsPage(); });
}

/* ---------- Sneltoetsen ---------- */
// Alt+D opent of sluit de zijkolom; de andere sneltoetsen gaan door naar het actieve Magister-tabblad.
chrome.commands.onCommand.addListener(async (command, actief) => {
  if (command === "toggle-panel") return zijkolom(actief?.windowId);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes("magister.net")) return;
  chrome.tabs.sendMessage(tab.id, { type: "command", command }).catch(() => {});
});

/* ---------- Installatie en herladen ---------- */
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  devLabel();
  // Na een update: één keer "Bijgewerkt van X naar Y" in het menu tonen.
  const current = chrome.runtime.getManifest().version;
  if (reason === "update" && previousVersion && previousVersion !== current) {
    await chrome.storage.local.set({ justUpdated: { from: previousVersion, to: current, at: Date.now() } });
  }
  if (reason !== "install") return;
  const { settings } = await chrome.storage.sync.get("settings");
  if (settings) return;
  await chrome.storage.sync.set({ settings: structuredClone(globalThis.DT_DEFAULTS) });
});

/* ---------- Berichten van popup, instellingen en content ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg?.type) {
    case "zijkolom":   // het handvat of Alt+D op de pagina
      zijkolom(sender.tab?.windowId, { alleenOpenen: msg.alleenOpenen === true });
      return false;
    case "openPopup":
      zijkolom(sender.tab?.windowId, { alleenOpenen: true });
      return false;
    case "openOptions":
      zijkolom(sender.tab?.windowId, { blad: "instellingen", anker: msg.anker || "" });
      return false;
    case "openExtensionsPage": {
      const scheme = /Edg\//.test(navigator.userAgent) ? "edge" : "chrome";
      chrome.tabs.create({ url: `${scheme}://extensions/?id=${chrome.runtime.id}` });
      return false;
    }
  }
  return false;
});
