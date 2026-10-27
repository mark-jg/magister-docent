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

chrome.storage.local.get("update").then(({ update }) => renderUpdate(update));

$("updDownload").onclick = () => { if (upd) chrome.tabs.create({ url: upd.zip || upd.page }); };
$("updNotes").onclick = () => { if (upd) chrome.tabs.create({ url: upd.page }); };
$("updReload").onclick = () => {
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
  if (info.error) note(`Kon GitHub niet bereiken (${info.error}).`);
  else if (info.available) note("");
  else if (!info.latest) note("Er is nog geen release gepubliceerd.");
  else note(`Je hebt de nieuwste versie (${info.current}).`);
};
