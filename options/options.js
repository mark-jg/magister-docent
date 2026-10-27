const DEFAULTS = globalThis.DT_DEFAULTS;

let settings;
const get = (obj, path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
const set = (obj, path, val) => { const ks = path.split("."); const last = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), obj); o[last] = val; };

async function load() {
  const stored = (await chrome.storage.sync.get("settings")).settings || {};
  settings = merge(structuredClone(DEFAULTS), stored);
  for (const el of document.querySelectorAll("[data-path]")) {
    const v = get(settings, el.dataset.path);
    if (el.type === "checkbox") el.checked = v !== false;
    else if (el.dataset.type === "lines") el.value = (v || []).join("\n");
    else if (el.dataset.type === "csv") el.value = (v || []).join(", ");
    else el.value = v ?? "";
  }
  renderLinks();
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

let t;
async function save() {
  await chrome.storage.sync.set({ settings });
  const s = document.getElementById("status");
  s.classList.add("show"); clearTimeout(t); t = setTimeout(() => s.classList.remove("show"), 1200);
}

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
});

document.getElementById("addLink").onclick = () => { settings.links.push({ label: "", url: "" }); renderLinks(); };
document.getElementById("reset").onclick = async () => {
  if (!confirm("Alle instellingen terugzetten naar standaard?")) return;
  settings = structuredClone(DEFAULTS); await save(); load();
};

document.getElementById("versionLine").textContent = `Versie ${chrome.runtime.getManifest().version}`;
document.getElementById("checkUpdate").onclick = async () => {
  const out = document.getElementById("updateStatus");
  out.textContent = "Controleren…";
  const info = await chrome.runtime.sendMessage({ type: "checkUpdate" }).catch(() => null);
  if (!info) out.textContent = "Controleren mislukt.";
  else if (info.error) out.textContent = `Kon GitHub niet bereiken (${info.error}).`;
  else if (info.available) { out.textContent = ""; out.append(`Versie ${info.latest} beschikbaar: `, Object.assign(document.createElement("a"), { href: info.zip || info.page, target: "_blank", rel: "noopener", textContent: "downloaden" })); }
  else if (!info.latest) out.textContent = "Er is nog geen release gepubliceerd.";
  else out.textContent = `Je hebt de nieuwste versie (${info.current}).`;
};

function merge(base, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], v);
    else base[k] = v;
  }
  return base;
}

load();
