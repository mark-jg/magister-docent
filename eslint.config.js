/* Linter voor de extensie. Bewust smal: alleen regels die echte fouten vangen (onbekende namen, dubbele
 * sleutels, onbereikbare code). Opmaak en stijl blijven vrij.
 *
 * Alle content-scripts delen één scope (zie de volgorde in manifest.json). Namen die een bestand voor andere
 * bestanden beschikbaar maakt staan hieronder bij GEDEELD: wie zo'n naam gebruikt, leunt op de laadvolgorde. */
const globals = require("globals");

const GEDEELD = {
  DT: "writable", DT_DEFAULTS: "writable", DT_PRESETS_LIST: "writable", DT_MODULES_LIST: "writable", DT_ICONS: "readonly",
  XLSX: "readonly",                       // lib/xlsx.full.min.js
  TardyKern: "writable",                  // modules/cb-kern.js
  OplReken: "writable",                   // modules/opleidingen-reken.js
  MenuReken: "writable",                  // modules/hoofdmenu.js
  DtCb: "writable",                       // modules/cb.js, aangevuld door modules/cb-*.js
  DTForms: "writable",                    // modules/magisterforms.js
  PvaDocx: "writable",                    // modules/pva-docx.js
  XlsxVisueel: "writable",                // modules/xlsx-visueel.js
  vzStats: "writable", vzLosseLessen: "writable", docentenVan: "writable", isoWeek: "writable",   // modules/verzuiminzicht.js
  openLeerling: "writable", klasOf: "writable", jarigList: "writable", jarigCardHtml: "writable",   // modules/jarig.js
  dtWeekNummer: "writable",               // sidepanel/paneel.js
  DtKolom: "writable",                    // sidepanel/sidepanel.js
  DT_KOLOM_ANTWOORD: "writable",          // content/kolom.js
  setValue: "writable",                   // modules/quickinput.js
  dtUnzip: "writable",                    // options/updater.js
};

/* Een module die over meerdere bestanden is verdeeld deelt haar namen op het hoogste niveau: die worden hier uit
 * de bestanden zelf gelezen, zodat de lijst niet met de hand hoeft te worden bijgehouden. */
const fs = require("node:fs"), path = require("node:path");
function namenUit(...bestanden) {
  const uit = {};
  for (const b of bestanden) {
    for (const m of fs.readFileSync(path.join(__dirname, b), "utf8").matchAll(/^(?:async\s+)?(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/gm)) uit[m[1]] = "writable";
  }
  return uit;
}
const THEMA = ["content/modules/theme-kleur.js", "content/modules/theme-pagina.js", "content/modules/theme-apple.js", "content/modules/theme-themas.js", "content/modules/theme-magisterkleuren.js"];

module.exports = [
  { ignores: ["lib/**", "node_modules/**", "dist/**", "content/modules/cb-kern.js"] },   // cb-kern.js wordt gegenereerd (scripts/tardy-kern.py)
  {
    files: ["content/**/*.js", "options/**/*.js", "sidepanel/**/*.js", "background.js"],
    languageOptions: {
      ecmaVersion: 2024, sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions, ...globals.serviceworker, module: "readonly", ...GEDEELD },
    },
    rules: {
      "no-undef": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-self-assign": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "getter-return": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  {
    files: ["content/modules/theme.js", ...THEMA],
    languageOptions: { globals: namenUit(...THEMA) },
  },
  {
    /* De zijkolom laadt de kleurfuncties en de thema's om het gekozen thema te volgen. */
    files: ["sidepanel/**/*.js"],
    languageOptions: { globals: namenUit("content/modules/theme-kleur.js", "content/modules/theme-themas.js") },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "no-undef": "error", "no-unreachable": "error" },
  },
];
