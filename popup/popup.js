/* Bedieningspaneel (popup bij het extensie-icoon): thema, modules aan/uit, acties en updates.
 * Instellingen worden in chrome.storage.sync bewaard; open Magister-tabbladen reageren direct. */
const $ = (id) => document.getElementById(id);
const note = (t) => { $("note").textContent = t; };
const current = chrome.runtime.getManifest().version;
$("ver").textContent = `v${current}`;
const DEFAULTS = globalThis.DT_DEFAULTS, PRESETS = globalThis.DT_PRESETS_LIST, MODULES = globalThis.DT_MODULES_LIST;
let settings;

const merge = (base, patch) => { for (const [k, v] of Object.entries(patch || {})) { if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], v); else base[k] = v; } return base; };
async function load() {
  const stored = (await chrome.storage.sync.get("settings")).settings || {};
  settings = merge(structuredClone(DEFAULTS), stored);
  render();
}
async function save(patch) {
  merge(settings, patch);
  await chrome.storage.sync.set({ settings });
  render();
}

const ICON = {
  compact: `<path d="M4 7h16M4 12h10M4 17h7"/>`,
  tables: `<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 11h16M10 5v14"/>`,
  quickinput: `<path d="M5 12h11M12 7l5 5-5 5"/>`,
  aanwezigheid: `<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>`,
  navigation: `<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>`,
  jarig: `<path d="M4 20h16M5 20v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 15c2 1.5 4 1.5 6 0s4-1.5 6 0M12 7v4"/>`,
  leerlingdash: `<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>`,
  verzuiminzicht: `<path d="M4 19h16M6 15l4-5 3 3 5-7"/>`,
  melding: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  ai: `<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>`,
  panel: `<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>`,
  theme: `<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>`,
  export: `<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  mail: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>`,
  options: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  inspector: `<path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/>`,
  sidebar: `<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>`,
};
const svg = (k) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ""}</svg>`;

function render() {
  const t = settings.theme;
  /* Thema */
  const sel = $("preset");
  sel.replaceChildren(
    optgroup("Licht", PRESETS.filter((p) => p[2] === false)), optgroup("Donker", PRESETS.filter((p) => p[2] === true)), optgroup("Zelf", PRESETS.filter((p) => p[2] === null))
  );
  sel.value = t.preset || "magister";
  sel.onchange = () => { const p = PRESETS.find((x) => x[0] === sel.value); save({ theme: { preset: sel.value, ...(p && p[2] !== null ? { [p[2] ? "darkPreset" : "lightPreset"]: sel.value } : {}) } }); };
  const cur = PRESETS.find((x) => x[0] === t.preset);
  const isDark = cur ? cur[2] === true || (cur[2] === null && t.mode === "dark") : false;
  $("modeSeg").querySelectorAll("button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.mode === "dark") === isDark);
    b.onclick = () => {
      if (cur && cur[2] === null) { save({ theme: { mode: b.dataset.mode } }); return; }
      const target = b.dataset.mode === "dark" ? (t.darkPreset || "nacht") : (t.lightPreset || "magister");
      save({ theme: { preset: target } });
    };
  });
  /* Modules */
  const tiles = $("tiles"); tiles.replaceChildren();
  for (const [id, label, sub, k] of MODULES) {
    const on = settings[id]?.enabled !== false;
    const b = document.createElement("button"); b.type = "button"; b.className = "tile" + (on ? " on" : ""); b.style.setProperty("--k", k);
    b.setAttribute("aria-pressed", String(on)); b.title = (on ? "Uitzetten: " : "Aanzetten: ") + label;
    b.innerHTML = `<span class="ico">${svg(id)}</span><span><b>${label}</b><small>${sub}</small></span>`;
    b.onclick = () => save({ [id]: { enabled: !on } });
    tiles.append(b);
  }
  /* Acties */
  const acts = [["toggle-panel", "Zijpaneel", "Alt+D", "sidebar"], ["export", "Excel", "Alt+E", "export"], ["mail-coach", "Mail coach", "Alt+M", "mail"]];
  if (settings.developer?.enabled) acts.push(["inspector", "Inspector", "Alt+I", "inspector"]);
  else acts.push(["options", "Instellingen", "", "options"]);
  const host = $("actions"); host.replaceChildren();
  for (const [cmd, label, kbd, icon] of acts) {
    const b = document.createElement("button"); b.type = "button";
    b.innerHTML = `<span class="ico">${svg(icon)}</span><span>${label}</span>${kbd ? `<kbd>${kbd}</kbd>` : ""}`;
    b.onclick = () => cmd === "options" ? chrome.runtime.openOptionsPage() : sendCommand(cmd);
    host.append(b);
  }
}
function optgroup(label, list) {
  const g = document.createElement("optgroup"); g.label = label;
  for (const [v, l] of list) { const o = document.createElement("option"); o.value = v; o.textContent = l; g.append(o); }
  return g;
}
async function sendCommand(cmd) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("magister.net")) { note("Open eerst een Magister-tabblad."); return; }
  chrome.tabs.sendMessage(tab.id, { type: "command", command: cmd }).catch(() => note("Herlaad het Magister-tabblad om de tools te activeren."));
  window.close();
}
$("options").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

/* ---------- Updates ---------- */
let upd = null;
function renderUpdate(info) {
  upd = info || null;
  const box = $("update");
  if (!upd?.available) { box.hidden = true; return; }
  box.hidden = false;
  $("updTitle").textContent = `Versie ${upd.latest} beschikbaar`;
  $("updText").textContent = `Je gebruikt nu ${upd.current}.` + (upd.publishedAt ? ` Uitgebracht op ${new Date(upd.publishedAt).toLocaleDateString("nl-NL")}.` : "");
  $("updDownload").disabled = !upd.zip && !upd.page;
}
chrome.storage.local.get(["update", "justUpdated"]).then(({ update, justUpdated }) => {
  renderUpdate(update);
  if (justUpdated?.to === current) { note(`Bijgewerkt van ${justUpdated.from} naar ${justUpdated.to}.`); chrome.storage.local.remove("justUpdated"); }
  else if (justUpdated) chrome.storage.local.remove("justUpdated");
});
async function downloadZip() {
  if (!upd) return;
  const btn = $("updDownload");
  const fallback = () => chrome.tabs.create({ url: upd.zip || upd.page });
  if (!upd.zipApi) return fallback();
  btn.textContent = "downloaden…";
  try {
    const headers = await chrome.runtime.sendMessage({ type: "getDownloadHeaders" });
    const res = await fetch(upd.zipApi, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: upd.zipName || `magister-docent-tools-v${upd.latest}.zip` });
    document.body.append(a); a.click(); a.remove();
    note("Zip gedownload. Pak uit, vervang de bestanden en klik op Herladen.");
    btn.textContent = "zip downloaden";
  } catch (e) { note(`Download mislukt (${e.message}), downloadpagina geopend.`); btn.textContent = "zip downloaden"; fallback(); }
}
$("updDownload").onclick = (e) => { e.preventDefault(); downloadZip(); };
$("updNow").onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#update") }); window.close(); };
$("updNotes").onclick = () => { if (upd) chrome.tabs.create({ url: upd.page }); };
$("updReload").onclick = (e) => { e.preventDefault(); note("Extensie wordt herladen…"); chrome.runtime.sendMessage({ type: "reloadExtension" }); setTimeout(() => window.close(), 300); };
$("updCheck").onclick = async (e) => {
  e.preventDefault(); note("Controleren…");
  const info = await chrome.runtime.sendMessage({ type: "checkUpdate" }).catch(() => null);
  if (!info) { note("Controleren mislukt."); return; }
  renderUpdate(info);
  if (info.error) note(`Kon GitHub niet bereiken: ${info.error}.`);
  else if (info.available) note("");
  else if (!info.latest) note("Er is nog geen release gepubliceerd.");
  else note(`Je hebt de nieuwste versie (${info.current}).`);
};
load();
