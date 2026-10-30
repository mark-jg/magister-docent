/* Standaardinstellingen, gedeeld door core.js (content), background.js en de instellingenpagina.
 * Eén plek bewerken is genoeg. */
globalThis.DT_DEFAULTS = {
  theme: { enabled: true, preset: "magister", lightPreset: "magister", darkPreset: "nacht", mode: "auto", darkStyle: "invert", accent: "#1B3A5C", density: "normal", font: "thema", fontScale: 1, radius: "thema", extra: [], recolor: true, agendaKleur: "vak" },
  compact: { enabled: false, hideSelectors: [] },
  panel: { enabled: true, position: "right", handle: true, widgets: ["klok", "links", "notities", "export"] },
  tables: { enabled: true, alwaysAsk: false, mode: "hover" },
  quickinput: { enabled: true, shortcuts: true },
  ai: { enabled: true, provider: "claude" },
  navigation: { enabled: true },
  aanwezigheid: { enabled: true },
  inspector: { enabled: true },
  developer: { enabled: false },
  updates: { check: true },
  jarig: { enabled: true, dagen: 14 },
  leerlingdash: { enabled: true },
  verzuiminzicht: { enabled: true },
  melding: { enabled: true, coaches: [], to: "", cc: "", name: "", extra: true, afzender: "" },
  links: [
    { label: "Magister Web", url: "https://accounts.magister.net" },
    { label: "Mediacollege Amsterdam", url: "https://www.ma-web.nl" }
  ]
};

/* Thema's voor keuzelijsten (popup en instellingen); de definities zelf staan in theme.js. */
globalThis.DT_PRESETS_LIST = [
  ["magister", "Magister (standaard)", false], ["mca", "MCA blauw", false], ["zand", "Zand (warm licht)", false], ["mint", "Mint (rustig licht)", false],
  ["contrast", "Hoog contrast licht", false], ["krant", "Krant (serif, scherp)", false], ["pastel", "Pastel (zacht, rond)", false], ["retro", "Retro (jaren 70)", false],
  ["oceaan", "Oceaan (fris blauw)", false], ["apple", "Apple (licht)", false], ["appleGlass", "Apple Glass (licht, doorschijnend)", false],
  ["nacht", "Nacht (donkergrijs)", true], ["marine", "Marine (donkerblauw)", true], ["bos", "Bos (donkergroen)", true], ["oled", "Zwart (OLED)", true],
  ["sepia", "Sepia (avondlezen)", true], ["terminal", "Terminal (groen op zwart)", true], ["synthwave", "Synthwave (paars/roze)", true],
  ["appleDonker", "Apple (donker)", true], ["appleGlassDonker", "Apple Glass (donker, doorschijnend)", true],
  ["custom", "Eigen accentkleur", null]
];
/* Modules met een aan/uit-schakelaar in het bedieningspaneel (popup). */
globalThis.DT_MODULES_LIST = [
  ["compact", "Opgeruimd", "Verbergt gekozen elementen", "#8E8E93"],
  ["tables", "Tabelexport", "Excel, CSV en kopiëren", "#34C759"],
  ["quickinput", "Sneller invoeren", "Enter en plakken in rijen", "#007AFF"],
  ["aanwezigheid", "Snelle aanwezigheid", "Leerlinglijst van de les", "#30B0C7"],
  ["navigation", "Commandopalet", "Zoeken en springen", "#5856D6"],
  ["jarig", "Jarig", "Kaart op Vandaag", "#FF2D55"],
  ["leerlingdash", "Leerlingoverzicht", "Bento op de leerlingkaart", "#FF9500"],
  ["verzuiminzicht", "Inzicht verzuim", "Tabblad op Verzuim", "#AF52DE"],
  ["melding", "Mail bij melding", "Concept naar de coach", "#FF3B30"],
  ["ai", "AI-hulp", "Prompt uit tabel of selectie", "#A2845E"],
  ["panel", "Zijpaneel", "Klok, notities, links (Alt+D)", "#636366"]
];
