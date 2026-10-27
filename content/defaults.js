/* Standaardinstellingen, gedeeld door core.js (content), background.js en de instellingenpagina.
 * Eén plek bewerken is genoeg. */
globalThis.DT_DEFAULTS = {
  theme: { enabled: true, preset: "magister", lightPreset: "magister", darkPreset: "nacht", mode: "auto", darkStyle: "invert", accent: "#1B3A5C", density: "normal", font: "thema", fontScale: 1, radius: "thema", extra: [], recolor: true },
  compact: { enabled: false, hideSelectors: [] },
  panel: { enabled: true, position: "right", widgets: ["klok", "links", "notities", "export", "instellingen"] },
  tables: { enabled: true, alwaysAsk: false, mode: "hover" },
  quickinput: { enabled: true, shortcuts: true },
  ai: { enabled: true, provider: "claude" },
  navigation: { enabled: true },
  aanwezigheid: { enabled: true },
  inspector: { enabled: true },
  updates: { check: true },
  melding: { enabled: true, to: "", cc: "", name: "Esther Benschop", extra: true, afzender: "" },
  links: [
    { label: "Magister Web", url: "https://accounts.magister.net" },
    { label: "Mediacollege Amsterdam", url: "https://www.ma-web.nl" }
  ]
};
