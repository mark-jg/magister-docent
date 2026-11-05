#!/usr/bin/env python3
"""Maakt content/modules/cb-kern.js uit de broncode van Tardy (web/index.html).

De telling, het verzuimprotocol, de mailteksten en het te-laat-briefje worden letterlijk
overgenomen, zodat de community-builder-module precies hetzelfde rekent als Tardy.
Gebruik: python3 scripts/tardy-kern.py [pad/naar/tardy/web/index.html]
"""
import sys, pathlib

bron = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path.home() / "tardy/web/index.html").read_text()

def stuk(begin, eind, eind_incl=False):
    a = bron.index(begin)
    b = bron.index(eind, a + len(begin))
    if eind_incl:
        b = bron.index("\n", b) + 1
    return bron[a:b]

delen = [
    stuk("/* ================= helpers =================", "</script>"),
    stuk("/* ================= signaleringsmotor", "</script>"),
    stuk("const NIVEAU_STANDAARD=", "const VIEWTITEL="),
    stuk("function gevolgVan(", "function meldNu("),
    stuk("function meldLijst(){", "const AANLEIDING=", eind_incl=True),
    stuk("function briefjesHtml(lijst){", "async function bonPrint("),
    stuk("function normaliseer(){", "/* ================= start"),
]
code = "\n".join(delen)
# Tardy's eigen meldingen en opslag lopen in de extensie via haken.
code = code.replace("function toon(t,lang){", "function _toonTardy(t,lang){", 1)

EXPORT = """S:{get:()=>S,set:v=>{S=v;}}"""
uit = f"""/* GEGENEREERD door scripts/tardy-kern.py uit Tardy (web/index.html). Niet met de hand wijzigen:
 * pas Tardy aan en genereer opnieuw. Bevat de telling, het verzuimprotocol, de mailteksten en het
 * te-laat-briefje, zodat de community-builder-module (cb.js) rekent zoals Tardy. */
var TardyKern = (function () {{
"use strict";
const H = {{ bewaar() {{}}, toon() {{}} }};
function bewaar() {{ H.bewaar(); }}
function toon(t, lang) {{ H.toon(t, lang); }}
function render() {{}}
{code}
const kern = {{ H, UI, leegeState, normaliseer, SOORTEN, SOORT, soortNaam, REDENEN, REDENEN_CAL, redenLijst,
  periodes, periodeById, huidigePeriode, periodeVanDatum, inPeriode, tellingen, signalenVoor, alleSignalen, hoogsteTreden,
  handelAf, zetAfh, afh, hoogsteNiveau, protocol, protocolLadder, gevolgVan, mailTekst, MAILSOORT, mentorVan, mentorSleutel,
  naamVan, minderjarig, volgendeSchooldag, langDatum, kortDatum, dmy, plusDagen, vandaag, nuTijd, uid, esc, meldLijst,
  AANLEIDING, NIVEAUNAAM, briefjesHtml, bonBeeld, bonOpdracht, bonOntwerp, bonInfo, BON, langsteReeks, ondertekening, TELLERS }};
Object.defineProperty(kern, "S", {{ get: () => S, set: (v) => {{ S = v; }} }});
return kern;
}})();
"""
doel = pathlib.Path(__file__).resolve().parent.parent / "content/modules/cb-kern.js"
doel.write_text(uit)
print(f"{doel} geschreven ({len(uit)} tekens)")
