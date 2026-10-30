/* Popup bij het extensie-icoon: bewust klein. Bijwerken, de tab van het zijpaneel, de
 * ontwikkelaarsmodus en de weg naar het zijpaneel en de instellingen. Alle tools zitten in het
 * zijpaneel (Alt+D) in Magister. */
const $ = (id) => document.getElementById(id);
const note = (t) => { $("note").textContent = t; };
const current = chrome.runtime.getManifest().version;
$("ver").textContent = `v${current}`;
const DEFAULTS = globalThis.DT_DEFAULTS;
let settings;
const merge = (base, patch) => { for (const [k, v] of Object.entries(patch || {})) { if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], v); else base[k] = v; } return base; };

async function load() {
  const stored = (await chrome.storage.sync.get("settings")).settings || {};
  settings = merge(structuredClone(DEFAULTS), stored);
  $("handle").checked = settings.panel?.handle !== false;
  $("developer").checked = settings.developer?.enabled === true;
}
async function save(patch) { merge(settings, patch); await chrome.storage.sync.set({ settings }); }
$("handle").onchange = () => save({ panel: { handle: $("handle").checked } });
$("developer").onchange = () => save({ developer: { enabled: $("developer").checked } });
$("options").onclick = () => chrome.runtime.openOptionsPage();
$("panelBtn").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("magister.net")) { note("Open eerst een Magister-tabblad; daar staat het zijpaneel (Alt+D)."); return; }
  chrome.tabs.sendMessage(tab.id, { type: "command", command: "toggle-panel" }).catch(() => note("Herlaad het Magister-tabblad om de tools te activeren."));
  window.close();
};

/* ---------- Updates: tonen; het bijwerken zelf doet updater.js (gedeeld met de instellingen) ---------- */
let upd = null;
function renderUpdate(info) {
  upd = info || null;
  const avail = !!upd?.available;
  $("update").hidden = !avail;
  $("upToDate").hidden = avail;
  $("upToDate").textContent = upd?.error ? `Kon GitHub niet bereiken: ${upd.error}.` : upd?.latest ? `Je hebt de nieuwste versie (${current}).` : "Nog niet gecontroleerd op updates.";
  if (!avail) return;
  $("updTitle").textContent = `Versie ${upd.latest} beschikbaar`;
  $("updText").textContent = `Je gebruikt nu ${upd.current}.` + (upd.publishedAt ? ` Uitgebracht op ${new Date(upd.publishedAt).toLocaleDateString("nl-NL")}.` : "");
}
chrome.storage.local.get(["update", "justUpdated"]).then(({ update, justUpdated }) => {
  renderUpdate(update);
  if (justUpdated?.to === current) { note(`Bijgewerkt van ${justUpdated.from} naar ${justUpdated.to}.`); chrome.storage.local.remove("justUpdated"); }
  else if (justUpdated) chrome.storage.local.remove("justUpdated");
});
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.update) renderUpdate(ch.update.newValue); });
$("updNotes").onclick = () => { if (upd) chrome.tabs.create({ url: upd.page }); };
$("updReload").onclick = (e) => { e.preventDefault(); note("Extensie wordt herladen…"); chrome.runtime.sendMessage({ type: "reloadExtension" }); setTimeout(() => window.close(), 300); };
$("updCheck").onclick = async (e) => {
  e.preventDefault(); note("Controleren…");
  const info = await chrome.runtime.sendMessage({ type: "checkUpdate" }).catch(() => null);
  if (!info) { note("Controleren mislukt."); return; }
  renderUpdate(info); note(info.available ? "" : info.error ? "" : `Je hebt de nieuwste versie (${info.current}).`);
};
load();
