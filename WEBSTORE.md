# Teksten voor de Chrome Web Store

Te plakken in het Developer Dashboard. Het is een concept; pas het aan waar nodig.

## Winkelpagina

**Naam:** Docentdeck voor Magister

**Korte beschrijving** (uit `manifest.json`, maximaal 132 tekens):
Extra functies voor docenten in Magister: thema’s, zijkolom, tabellen naar Excel, sneller invoeren en aanwezigheidsoverzichten.

**Categorie:** Hulpmiddelen voor productiviteit (of Onderwijs)
**Taal:** Nederlands

**Uitgebreide beschrijving:**

Docentdeck voor Magister maakt Magister prettiger en sneller voor docenten en ander onderwijspersoneel. Alles draait lokaal in je browser.

• Thema's: Minimal, Glass, Paper, Soft en Contrast, elk in licht en donker, met een eigen accentkleur
• Zijkolom naast Magister: acties, notities, snelle links, klok en weeknummer
• Tabellen naar Excel, CSV of het klembord, met keuze van kolommen en namen maskeren
• Sneller invoeren: met Enter naar de volgende rij, een kolom uit Excel plakken
• Snelle aanwezigheid in de leerlinglijst van de les, met het toetsenbord
• Inzicht in verzuim per vak, docent, weekdag en lesuur; eigen periodes in de verzuimoverzichten
• Lesregistraties en overzichten per opleiding, leerjaar en klas
• Jarige leerlingen op Vandaag, een overzicht op de leerlingkaart en een commandopalet (Ctrl+K)
• Hulpmiddelen voor het digibord: geluidsmeter, kaartenpakje en lesbord

Docentdeck is niet gemaakt door Iddink of Magister en heeft er geen band mee. Magister is een merk van zijn eigenaar.

## Privacy (tabblad Privacy)

**Eén doel:** Magister uitbreiden en makkelijker maken voor docenten: weergave, exports en overzichten van gegevens die de gebruiker in Magister al mag zien.

**Verantwoording van de rechten:**

- `storage`: om instellingen, notities en opgehaalde overzichten lokaal te bewaren.
- `clipboardWrite`: om tabellen en paginatekst op het klembord te zetten als de gebruiker daarom vraagt.
- `sidePanel`: de zijkolom met acties en instellingen naast Magister.
- Hosttoegang `*://*.magister.net/*`: de extensie werkt alleen op Magister en gebruikt daar de eigen sessie van de gebruiker om gegevens te tonen en te exporteren. Het subdomein verschilt per school, daarom is het jokerteken nodig.

**Code op afstand:** Nee. Alle code zit in het pakket.

**Gegevensgebruik:** vink aan:
- Persoonlijk identificeerbare informatie (namen van leerlingen in overzichten en exports)
- Website-inhoud

En verklaar dat de gegevens niet worden verkocht, niet worden gebruikt voor iets dat niets met het doel te maken heeft, en niet worden gebruikt voor kredietwaardigheid.

**URL privacybeleid:** publiceer `PRIVACY.md` (bijvoorbeeld als GitHub Pages of als pagina op de site van de school) en vul hier die link in.

## Afbeeldingen

- Pictogram 128×128: `icons/icon128.png`
- Minstens één screenshot van 1280×800 of 640×400 (namen van leerlingen onherkenbaar maken!)
- Kleine promotietegel 440×280 (verplicht)

## Zichtbaarheid

Ik raad "Niet vermeld" aan: alleen wie de link heeft, kan de extensie installeren. Wil de school hem op beheerde Chromebooks of in een Google Workspace-domein uitrollen, dan kan ook "Privé" voor dat domein.
