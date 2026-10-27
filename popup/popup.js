const $ = (id) => document.getElementById(id);
const note = (t) => { $("note").textContent = t; };
const current = chrome.runtime.getManifest().version;
$("ver").textContent = `Versie ${current}`;

$("options").onclick = () => chrome.runtime.openOptionsPage();
document.querySelectorAll("[data-cmd]").forEach((b) => b.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("magister.net")) { note("Open eerst een Magister-tabblad."); return; }
  chrome.tabs.sendMessage(tab.id, { type: "command", command: b.dataset.cmd }).catch(() => {
    note("Herlaad het Magister-tabblad om de tools te activeren.");
  });
  window.close();
});

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
  // Bevestiging na een update, één keer tonen en dan wissen.
  if (justUpdated?.to === current) {
    note(`Bijgewerkt van ${justUpdated.from} naar ${justUpdated.to}.`);
    chrome.storage.local.remove("justUpdated");
  } else if (justUpdated) {
    chrome.storage.local.remove("justUpdated");
  }
});

/* Privé repo: de zip via de API ophalen met het token (headers komen uit background).
 * Lukt dat niet, dan de gewone downloadlink in een tabblad (werkt als je bij GitHub ingelogd bent). */
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
  } catch (e) {
    note(`Download via API mislukt (${e.message}), downloadpagina geopend.`);
    btn.textContent = "zip downloaden";
    fallback();
  }
}
$("updDownload").onclick = (e) => { e.preventDefault(); downloadZip(); };
$("updNow").onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#update") }); window.close(); };
$("updNotes").onclick = () => { if (upd) chrome.tabs.create({ url: upd.page }); };
$("updReload").onclick = (e) => {
  e.preventDefault();
  note("Extensie wordt herladen…");
  chrome.runtime.sendMessage({ type: "reloadExtension" });
  setTimeout(() => window.close(), 300);
};

$("updCheck").onclick = async (e) => {
  e.preventDefault();
  note("Controleren…");
  const info = await chrome.runtime.sendMessage({ type: "checkUpdate" }).catch(() => null);
  if (!info) { note("Controleren mislukt."); return; }
  renderUpdate(info);
  if (info.error) note(`Kon GitHub niet bereiken: ${info.error}.`);
  else if (info.available) note("");
  else if (!info.latest) note("Er is nog geen release gepubliceerd.");
  else note(`Je hebt de nieuwste versie (${info.current}).`);
};
