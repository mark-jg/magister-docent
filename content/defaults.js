/* Standaardinstellingen, gedeeld door core.js (content), background.js en de instellingenpagina.
 * Eén plek bewerken is genoeg. */
globalThis.DT_DEFAULTS = {
  /* preset: magister | minimal | glass | paper | soft | contrast. mode: auto | light | dark (niet voor Magister).
   * kleur: thema | blauw | mca | groen | paars | roze | oranje | rood | grafiet | eigen (dan geldt accent). */
  theme: { enabled: true, preset: "magister", mode: "auto", kleur: "thema", accent: "#1B3A5C", density: "normal", font: "thema", fontScale: 1, radius: "thema", extra: [], agendaKleur: "vak" },
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
  /* Eigen periodes (bijv. onderwijsperiodes): { id, naam, begin: "JJJJ-MM-DD", einde: "JJJJ-MM-DD" } */
  periodes: { enabled: true, lijst: [] },
  aanwezigexport: { enabled: true },
  /* Lesregistraties: aanwezigheid van klassen per vak/docent over een periode (zijpaneel › Acties). */
  lesreg: { enabled: true },
  /* zonderGeoorloofd: ziek en geoorloofd afwezig tellen niet mee in de ranglijst (knop op het leaderboard). */
  leaderboard: { enabled: true, zonderGeoorloofd: false },
  /* Opleidingen: menu-item met inschrijvingen en aanwezigheid per opleiding, leerjaar en klas. */
  opleidingen: { enabled: true },
  /* volgorde en verborgen: de namen van de menu-items (hun tekst in kleine letters), gezet met "Menu aanpassen". */
  hoofdmenu: { enabled: true, volgorde: [], verborgen: [] },
  lestools: { enabled: true },
  /* Plan van aanpak bij Begeleiding › Logboek van een student (SLB). Concepten blijven in deze browser. */
  pva: { enabled: true },
  /* Community builder: Te laat-balie (Tardy in Magister). Persoonlijke gegevens blijven in de extensie. */
  cb: { enabled: false, naam: "", paraaf: "", email: "", lokaal: "", zwarting: 3, autoPrint: false, printer: null },
  melding: { enabled: true, coaches: [], to: "", cc: "", name: "", extra: true, afzender: "" },
  links: [
    { label: "Magister Web", url: "https://accounts.magister.net" },
    { label: "Mediacollege Amsterdam", url: "https://www.ma-web.nl" }
  ]
};

/* Thema's en accentkleuren voor de keuzelijsten (zijpaneel en instellingen); de definities zelf staan in
 * content/modules/theme-themas.js. */
globalThis.DT_THEMAS_LIST = [
  ["magister", "Magister", "Het origineel, zonder aanpassingen"],
  ["minimal", "Minimal", "Rustig en strak"],
  ["glass", "Glass", "Doorschijnende vlakken"],
  ["paper", "Paper", "Papier en inkt, schreefletter"],
  ["soft", "Soft", "Zacht, rond en speels"],
  ["contrast", "Contrast", "Maximaal contrast"]
];
globalThis.DT_KLEUREN_LIST = [
  ["thema", "Volgens thema", null], ["blauw", "Blauw", "#007AFF"], ["mca", "MCA-blauw", "#1B3A5C"], ["groen", "Groen", "#248A3D"], ["paars", "Paars", "#8944AB"],
  ["roze", "Roze", "#D12A7C"], ["oranje", "Oranje", "#C4520A"], ["rood", "Rood", "#D70015"], ["grafiet", "Grafiet", "#515154"], ["eigen", "Eigen kleur", null]
];

/* Tot en met 0.60 waren er twintig losse thema's. Een bewaarde keuze verhuist naar het dichtstbijzijnde nieuwe
 * thema: [thema, licht of donker, accentkleur]. Het veld versie voorkomt dat dit twee keer gebeurt (het oude
 * "contrast" en het nieuwe thema Contrast heten hetzelfde). Verandert het meegegeven object en geeft het terug. */
globalThis.DT_THEMA_MIGRATIE = (t) => {
  if (!t || t.versie >= 2) return t;
  const OUD = {
    magister: ["magister"], apple: ["minimal", "light"], appleDonker: ["minimal", "dark"], appleGlass: ["glass", "light"], appleGlassDonker: ["glass", "dark"],
    mca: ["minimal", "light", "mca"], mint: ["minimal", "light", "groen"], oceaan: ["minimal", "light", "blauw"],
    nacht: ["minimal", "dark"], marine: ["minimal", "dark", "blauw"], bos: ["minimal", "dark", "groen"], terminal: ["minimal", "dark", "groen"],
    zand: ["paper", "light"], krant: ["paper", "light"], retro: ["paper", "light", "oranje"], sepia: ["paper", "dark"],
    pastel: ["soft", "light"], synthwave: ["soft", "dark"], contrast: ["contrast", "light"], oled: ["contrast", "dark"],
    custom: ["minimal", t.mode || "auto", "eigen"]
  };
  /* Een keuze die al een nieuw thema is (bewaard zonder versie) blijft staan. */
  const nieuw = (globalThis.DT_THEMAS_LIST || []).some((x) => x[0] === t.preset) && t.preset !== "contrast";
  const [preset, mode, kleur] = nieuw ? [t.preset, null, t.kleur] : (OUD[t.preset] || ["magister"]);
  t.preset = preset;
  if (mode) t.mode = mode;
  t.kleur = kleur || "thema";
  for (const k of ["lightPreset", "darkPreset", "darkStyle", "recolor"]) delete t[k];
  t.versie = 2;
  return t;
};

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
  ["periodes", "Periodes", "Eigen periodes in verzuimoverzichten", "#5856D6"],
  ["aanwezigexport", "Aanwezigheid naar Excel", "Per leerling en per klas", "#34C759"],
  ["lesreg", "Lesregistraties", "Klassen per vak of docent", "#30B0C7"],
  ["pva", "Plan van aanpak", "Bij Begeleiding van een student", "#FF9500"],
  ["melding", "Mail bij melding", "Concept naar de coach", "#FF3B30"],
  ["ai", "AI-hulp", "Prompt uit tabel of selectie", "#A2845E"],
  ["opleidingen", "Opleidingen", "Inschrijvingen en aanwezigheid per opleiding", "#5856D6"],
  ["hoofdmenu", "Hoofdmenu aanpassen", "Menu-items rangschikken of verbergen", "#8E8E93"],
  ["leaderboard", "Leaderboard", "Meest aanwezig per week", "#FF9500"],
  ["lestools", "Hulpmiddelen in de les", "Stille safari, kaartenpakje, lesbord", "#30B0C7"],
  ["cb", "Te laat-balie", "Tardy in Magister", "#FF3B30"],
  ["panel", "Handvat", "Opent de zijkolom (Alt+D)", "#636366"]
];
