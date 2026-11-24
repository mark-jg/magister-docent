/* In de zijkolom van de browser wordt deze pagina smal en zonder eigen kop getoond (zie sidepanel/). */
const vraag = new URLSearchParams(location.search);
if (vraag.has("kolom")) document.documentElement.classList.add("kolom");
if (vraag.get("blad")) document.documentElement.dataset.blad = vraag.get("blad");

/* Een onderdeel open- of dichtklappen (klik op de naam). */
function klap(sectie, open) {
  const knop = sectie?.querySelector(".modnaam"), inhoud = sectie?.querySelector(".inhoud");
  if (!knop || !inhoud) return;
  const aan = open ?? knop.getAttribute("aria-expanded") !== "true";
  knop.setAttribute("aria-expanded", String(aan)); inhoud.hidden = !aan;
}
document.addEventListener("click", (e) => { const knop = e.target.closest?.(".modnaam"); if (knop) klap(knop.closest(".mod")); });
/* Een link naar een onderdeel (options.html#updates) klapt het open en zet het in beeld. In de zijkolom hoort
 * het onderdeel bij een tabblad; dat wordt dan ook gekozen. */
function naarAnker() {
  const sectie = location.hash.length > 1 ? document.getElementById(location.hash.slice(1) === "update" ? "updates" : location.hash.slice(1)) : null;
  if (!sectie) return;
  if (sectie.dataset.blad && document.documentElement.dataset.blad) document.documentElement.dataset.blad = sectie.dataset.blad;
  klap(sectie, true);
  setTimeout(() => sectie.scrollIntoView({ block: "start" }), 60);
}
window.addEventListener("hashchange", naarAnker);
document.addEventListener("DOMContentLoaded", naarAnker);

const DEFAULTS = globalThis.DT_DEFAULTS;

let settings;
const get = (obj, path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
const set = (obj, path, val) => { const ks = path.split("."); const last = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), obj); o[last] = val; };

function fillPresets() {
  const vul = (id, lijst) => {
    const sel = document.getElementById(id); if (!sel || sel.options.length) return;
    for (const [v, l] of lijst) { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.append(o); }
  };
  vul("presetSelect", globalThis.DT_THEMAS_LIST.map(([v, l, sub]) => [v, `${l}: ${sub.toLowerCase()}`]));
  vul("kleurSelect", globalThis.DT_KLEUREN_LIST);
}
/* Wat bij de gekozen combinatie niet van toepassing is, wordt uitgeschakeld in plaats van genegeerd. */
function syncThema() {
  const t = settings.theme;
  const uit = (id, aan) => { const el = document.getElementById(id); if (el) el.disabled = aan; };
  uit("modeSelect", t.preset === "magister");
  uit("kleurSelect", t.preset === "magister" || t.preset === "contrast");
  uit("accentKleur", t.preset === "magister" || t.preset === "contrast" || t.kleur !== "eigen");
}
function syncDev() {
  const on = settings.developer?.enabled === true;
  document.querySelectorAll(".dev-only").forEach((el) => { el.hidden = !on; });
}
async function load() {
  fillPresets();
  const stored = (await chrome.storage.sync.get("settings")).settings || {};
  settings = merge(structuredClone(DEFAULTS), stored);
  globalThis.DT_THEMA_MIGRATIE(settings.theme);
  for (const el of document.querySelectorAll("[data-path]")) {
    const v = get(settings, el.dataset.path);
    if (el.type === "checkbox") el.checked = v !== false;
    else if (el.dataset.type === "lines") el.value = (v || []).join("\n");
    else if (el.dataset.type === "csv") el.value = (v || []).join(", ");
    else el.value = v ?? "";
  }
  renderLinks();
  // Oude instelling (één adres + naam) overzetten naar de coachlijst.
  settings.melding.coaches ||= [];
  if (!settings.melding.coaches.length && settings.melding.to) {
    settings.melding.coaches.push({ name: settings.melding.name || "", email: settings.melding.to });
    save();
  }
  renderCoaches();
  syncDev();
  syncThema();
  const ex = document.getElementById("extraList");
  ex.value = (settings.theme.extra || []).map((x) => `${x.role} | ${x.sel}`).join("\n");
  ex.oninput = () => {
    settings.theme.extra = ex.value.split("\n").map((l) => l.split("|")).filter((p) => p.length >= 2).map(([r, ...sel]) => ({ role: r.trim(), sel: sel.join("|").trim() })).filter((x) => x.sel);
    save();
  };
}

function renderLinks() {
  const host = document.getElementById("links");
  host.replaceChildren();
  settings.links.forEach((l, i) => {
    const label = Object.assign(document.createElement("input"), { type: "text", value: l.label, placeholder: "Naam" });
    const url = Object.assign(document.createElement("input"), { type: "url", value: l.url, placeholder: "https://…" });
    const del = Object.assign(document.createElement("button"), { textContent: "Verwijderen" });
    label.oninput = () => { settings.links[i].label = label.value; save(); };
    url.oninput = () => { settings.links[i].url = url.value; save(); };
    del.onclick = () => { settings.links.splice(i, 1); renderLinks(); save(); };
    host.append(label, url, del);
  });
}

function renderCoaches() {
  const host = document.getElementById("coaches");
  host.replaceChildren();
  settings.melding.coaches.forEach((c, i) => {
    const name = Object.assign(document.createElement("input"), { type: "text", value: c.name || "", placeholder: "Naam (voor de aanhef)" });
    const email = Object.assign(document.createElement("input"), { type: "text", value: c.email || "", placeholder: "naam@school.nl" });
    const del = Object.assign(document.createElement("button"), { textContent: "Verwijderen" });
    name.oninput = () => { settings.melding.coaches[i].name = name.value; save(); };
    email.oninput = () => { settings.melding.coaches[i].email = email.value.trim(); save(); };
    del.onclick = () => { settings.melding.coaches.splice(i, 1); renderCoaches(); save(); };
    host.append(name, email, del);
  });
}

/* Bewaren met een korte vertraging: Chrome staat maar een beperkt aantal schrijfacties per minuut toe, en
 * bij elke toetsaanslag bewaren liep daar tegenaan. Een mislukte opslag blijft zichtbaar in de statusregel. */
let t, saveTimer, wachtend = false;
function save() {
  wachtend = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (!wachtend) return;
  wachtend = false;
  const s = document.getElementById("status");
  clearTimeout(t);
  try {
    await chrome.storage.sync.set({ settings });
    s.textContent = "Opgeslagen"; s.style.background = ""; s.style.color = "";
    s.classList.add("show"); t = setTimeout(() => s.classList.remove("show"), 1200);
  } catch (e) {
    const m = String(e?.message || e);
    s.textContent = /QUOTA_BYTES/i.test(m) ? "Niet opgeslagen: de instellingen zijn te groot voor Chrome. Verwijder iets (links, coaches, periodes, verborgen elementen)."
      : /MAX_WRITE/i.test(m) ? "Niet opgeslagen: te veel wijzigingen kort na elkaar. Wacht een minuut en wijzig nog iets."
      : `Niet opgeslagen: ${m}`;
    s.style.background = "#b3261e"; s.style.color = "#fff";
    /* In de zijkolom staat deze statusregel onderaan een lange pagina: daar de melding van de kolom gebruiken. */
    if (document.documentElement.classList.contains("kolom")) { try { parent.DT.toast(s.textContent, "err", 9000); } catch {} }
    s.classList.add("show");
  }
}
window.addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });

document.addEventListener("input", (e) => {
  const el = e.target; if (!el.dataset?.path) return;
  let v;
  if (el.id === "extraList") return;
  if (el.type === "checkbox") v = el.checked;
  else if (el.dataset.type === "lines") v = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
  else if (el.dataset.type === "csv") v = el.value.split(",").map((s) => s.trim()).filter(Boolean);
  else v = el.value;
  set(settings, el.dataset.path, v);
  save();
  if (el.dataset.path === "developer.enabled") syncDev();
  if (el.dataset.path.startsWith("theme.")) syncThema();
});

document.getElementById("addLink").onclick = () => { settings.links.push({ label: "", url: "" }); renderLinks(); };
document.getElementById("addCoach").onclick = () => { settings.melding.coaches.push({ name: "", email: "" }); renderCoaches(); document.querySelector("#coaches input:last-of-type")?.focus(); };
document.getElementById("reset").onclick = async () => {
  if (!confirm("Alle instellingen terugzetten naar standaard?")) return;
  settings = structuredClone(DEFAULTS); save(); await saveNow(); load();
};

document.getElementById("versionLine").textContent = `Versie ${chrome.runtime.getManifest().version}`;
function showUpdateStatus(info) {
  const out = document.getElementById("updateStatus");
  if (!info) out.textContent = "Controleren mislukt.";
  else if (info.error) out.textContent = `Kon GitHub niet bereiken: ${info.error}.`;
  else if (info.available) { out.textContent = ""; out.append(`Versie ${info.latest} beschikbaar: `, Object.assign(document.createElement("a"), { href: info.page, target: "_blank", rel: "noopener", textContent: "open het extensiemenu om te downloaden" })); }
  else if (!info.latest) out.textContent = "Toegang in orde, er is nog geen release gepubliceerd.";
  else out.textContent = `Je hebt de nieuwste versie (${info.current}).`;
}

document.getElementById("checkUpdate").onclick = async () => {
  document.getElementById("updateStatus").textContent = "Controleren…";
  showUpdateStatus(await chrome.runtime.sendMessage({ type: "checkUpdate" }).catch(() => null));
};

/* GitHub-token: apart van de gesynchroniseerde instellingen, alleen lokaal op dit apparaat. */
const tokenField = document.getElementById("ghToken");
chrome.storage.local.get("ghToken").then(({ ghToken }) => { tokenField.value = ghToken || ""; });
let tokenTimer;
tokenField.oninput = () => {
  clearTimeout(tokenTimer);
  tokenTimer = setTimeout(async () => {
    document.getElementById("updateStatus").textContent = "Token opgeslagen, controleren…";
    showUpdateStatus(await chrome.runtime.sendMessage({ type: "setToken", token: tokenField.value }).catch(() => null));
  }, 600);
};
document.getElementById("ghTokenClear").onclick = async () => {
  tokenField.value = "";
  document.getElementById("updateStatus").textContent = "Token gewist.";
  await chrome.runtime.sendMessage({ type: "setToken", token: "" }).catch(() => null);
};

/* ---------- Back-up en opslag ----------
 * De map hoort bij Magister (de pagina bewaart hem), niet bij de extensie: daarom gaan de vragen via het
 * Magister-tabblad (content/kolom.js, vraag "map"). Kiezen en toegang geven tonen daar een venstertje met een knop. */
async function magisterTab() {
  try {
    const [actief] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (actief && /^https?:\/\/[^/]*\.magister\.net\//.test(actief.url || "")) return actief;
    const [ander] = await chrome.tabs.query({ url: "*://*.magister.net/*" });
    return ander || null;
  } catch { return null; }
}
async function mapVraag(actie) {
  const tab = await magisterTab();
  if (!tab) return null;
  try { return await chrome.tabs.sendMessage(tab.id, { type: "dt:kolom", vraag: "map", actie }, { frameId: 0 }); } catch { return null; }
}
async function toonMap() {
  const status = document.getElementById("mapStatus"), kies = document.getElementById("mapKies"), toegang = document.getElementById("mapToegang"), vergeet = document.getElementById("mapVergeet");
  const r = await mapVraag("status");
  if (!r) {
    status.textContent = "Open een Magister-tabblad (en herlaad het als het al open stond) om de map te zien of te kiezen.";
    kies.disabled = true; toegang.hidden = vergeet.hidden = true; return;
  }
  if (r.ok && !r.kan) {
    status.textContent = "Deze browser kan geen map openen. Gebruik Chrome of Edge op een computer.";
    kies.disabled = true; toegang.hidden = vergeet.hidden = true; return;
  }
  kies.disabled = false;
  kies.textContent = r.naam ? "Andere map kiezen" : "Map kiezen";
  status.textContent = !r.naam ? "Nog geen map gekozen: er wordt niets buiten de browser bewaard."
    : r.mag ? `Map: "${r.naam}". Toegang is gegeven voor deze sessie.`
    : `Map: "${r.naam}". Chrome vraagt deze sessie nog om toegang (dat gebeurt ook vanzelf bij Ophalen).`;
  toegang.hidden = !r.naam || r.mag; vergeet.hidden = !r.naam;
}
document.getElementById("mapKies").onclick = () => mapVraag("kies");
document.getElementById("mapToegang").onclick = () => mapVraag("toegang");
document.getElementById("mapVergeet").onclick = async () => {
  if (!confirm("De map vergeten? De bestanden in de map blijven staan; Docent Tools schrijft er alleen niet meer in.")) return;
  await mapVraag("vergeet"); toonMap();
};
chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === "dt:map") toonMap(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") toonMap(); });
toonMap();

function merge(base, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], v);
    else base[k] = v;
  }
  return base;
}

load();
