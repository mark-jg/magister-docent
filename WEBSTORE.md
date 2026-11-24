# Teksten voor de Chrome Web Store

Per tabblad van het [Developer Dashboard](https://chrome.google.com/webstore/devconsole), in de volgorde waarin je ze tegenkomt. Tussen haakjes staat de Engelse naam van het veld, voor als het dashboard in het Engels staat. Teksten in een codeblok kun je zo plakken.

## 1. Pakket (Package)

Upload `dist/docentdeck-vX.Y.Z.zip` (gemaakt met `scripts/webstore-zip.sh`). Naam, korte beschrijving, versie en pictogram komen uit `manifest.json`.

## 2. Winkelvermelding (Store listing)

**Beschrijving (Description)**, maximaal 16.000 tekens:

```
Docentdeck maakt Magister sneller en overzichtelijker voor docenten, mentoren en teamleiders. De extensie werkt in je eigen Magister, met je eigen inlog, en draait helemaal in je browser: er gaat niets naar de maker of naar andere partijen.

OVERZICHT EN INZICHT
• Opleidingen: studenten en aanwezigheid per opleiding, leerjaar en klas, met aandachtspunten, het verloop over het schooljaar en mutaties.
• Lesregistraties: aanwezigheid van één of meer klassen over een periode naar keuze, te filteren op vak of docent, en naar Excel.
• Inzicht in verzuim: een extra tabblad op de verzuimpagina van een leerling, met de aanwezigheid per vak, docent, weekdag en lesuur.
• Periodes: je eigen onderwijsperiodes als keuze naast Week, Maand en Jaar in de verzuimoverzichten.
• Leerlingoverzicht: een overzichtskaart bovenaan de leerlingkaart, met het rooster van vandaag.

SNELLER WERKEN
• Tabellen naar Excel, CSV of het klembord, met keuze van kolommen, de kopregel en namen maskeren.
• Sneller invoeren: Enter springt naar de volgende rij, en een kolom uit Excel plak je in één keer in opeenvolgende velden.
• Snelle aanwezigheid in de leerlinglijst van de les: iedereen aanwezig in één klik, of registreren met het toetsenbord.
• Commandopalet (Ctrl+K): typ een paar letters en spring naar elk onderdeel van Magister.
• Hoofdmenu aanpassen: items rangschikken of verbergen.

PRETTIGER IN GEBRUIK
• Thema's: Minimal, Glass, Paper, Soft en Contrast, elk in licht en donker, met je eigen accentkleur, lettertype en lettergrootte.
• Zijkolom naast Magister (Alt+D): acties, notities, snelle links, klok en weeknummer, en alle instellingen.
• Jarige leerlingen op de pagina Vandaag.
• Hulpmiddelen voor het digibord, zoals een geluidsmeter voor een stille klas, een kaartenpakje en een lesbord.

PRIVACY
Docentdeck leest alleen wat jij in Magister al mag zien, en alleen op het Magister-domein van je school. Instellingen en opgehaalde overzichten blijven in je browser. Wil je een back-up of lijsten bewaren, dan kies je zelf een map op je computer of in OneDrive. Er zijn geen accounts, geen statistieken en geen advertenties.

Overleg met de ICT-afdeling of de functionaris gegevensbescherming van je school voordat je de extensie op een beheerde werkplek gebruikt.

Docentdeck is niet gemaakt door Iddink of Magister en is er niet aan verbonden. Magister is een merk van zijn eigenaar.
```

**Categorie (Category):** Hulpmiddelen (Tools). Onderwijs (Education) kan ook; Hulpmiddelen past beter bij wat de extensie doet.

**Taal (Language):** Nederlands.

**Afbeeldingen:** zie *Afbeeldingen* onderaan.

**Officiële URL (Official URL):** leeg laten (alleen nodig met een geverifieerd eigen domein).

**Startpagina (Homepage URL):**
```
https://github.com/mark-jg/magister-docent/tree/webstore
```

**Ondersteuning (Support URL):**
```
https://github.com/mark-jg/magister-docent/issues
```

**Inhoud voor volwassenen (Mature content):** Nee.

## 3. Privacy (Privacy practices)

**Eén doel (Single purpose description):**
```
Docentdeck breidt Magister (het leerlingvolgsysteem dat scholen gebruiken) uit voor docenten: een prettigere weergave, sneller invoeren, exports naar Excel en overzichten van aanwezigheid en inschrijvingen, op basis van gegevens die de gebruiker in Magister al mag zien.
```

**Verantwoording van de rechten (Permission justification):**

storage:
```
Bewaart de instellingen van de gebruiker (thema, onderdelen aan of uit, notities, snelle links, eigen periodes) en de opgehaalde overzichten van Opleidingen en Lesregistraties, zodat die niet elke keer opnieuw uit Magister hoeven te worden gehaald. Alles blijft in de browser.
```

clipboardWrite:
```
Zet een tabel of de tekst van de pagina op het klembord als de gebruiker op Kopiëren klikt, zodat die in Excel of een ander programma geplakt kan worden.
```

sidePanel:
```
Toont de zijkolom van de extensie naast Magister, met acties, notities, snelle links en de instellingen. Zo valt de extensie niet over de pagina van Magister heen.
```

Hostrechten (Host permission justification) voor `*://*.magister.net/*`:
```
De extensie werkt alleen in Magister. Elke school heeft een eigen subdomein (bijvoorbeeld school.magister.net), daarom is het jokerteken nodig. Op die pagina's past de extensie de weergave aan, voegt knoppen en eigen pagina's toe, en haalt met de bestaande inlog van de gebruiker gegevens op die de gebruiker zelf in Magister mag zien (klassen, roosters, aanwezigheid) om overzichten en exports te maken. Er gaat niets naar een andere server.
```

**Code op afstand (Remote code):** Nee, ik gebruik geen code op afstand. (No, I am not using remote code.) Alle scripts zitten in het pakket, ook de Excel-bibliotheek (SheetJS).

**Gegevensgebruik (Data usage)**, aanvinken:
- **Persoonlijk identificeerbare informatie (Personally identifiable information):** namen en stamnummers van leerlingen in overzichten en exports.
- **Website-inhoud (Website content):** tabellen en gegevens van Magister-pagina's.
- **Gezondheidsinformatie (Health information):** voorzichtigheidshalve aanvinken. Aanwezigheidsregistraties bevatten de categorie "ziek". Dat is geen medische informatie, maar wie het aanvinkt, kan er later niet op worden afgewezen.

Niet aanvinken: financiële gegevens, authenticatiegegevens, persoonlijke communicatie, locatie, webgeschiedenis, gebruikersactiviteit.

De drie verklaringen aanvinken:
- Ik verkoop of draag geen gebruikersgegevens over aan derden, behalve in de toegestane gevallen.
- Ik gebruik of draag geen gebruikersgegevens over voor doelen die niets met het hoofddoel van het item te maken hebben.
- Ik gebruik of draag geen gebruikersgegevens over om kredietwaardigheid te bepalen of voor leningen.

**URL privacybeleid (Privacy policy URL):** de webpagina `docs/privacy.html`, gemaakt uit `PRIVACY.md` en gepubliceerd via GitHub Pages (branch `webstore`, map `docs`). Vul eerst de contactgegevens onderaan in en maak de pagina dan opnieuw.
```
https://mark-jg.github.io/magister-docent/privacy.html
```

## 4. Distributie (Distribution)

**Betaling (Payments):** Gratis (Free).

**Zichtbaarheid (Visibility):** "Niet vermeld" (Unlisted): alleen wie de link heeft, kan de extensie installeren. Wil de school hem uitrollen op beheerde Chromebooks of binnen een Google Workspace-domein, dan kan ook "Privé" (Private) voor dat domein.

**Regio's (Distribution regions):** Nederland en België (Magister wordt vooral in Nederland gebruikt), of Alle regio's.

## 5. Testinstructies (Test instructions)

Optioneel, maximaal 500 tekens:
```
Works only on Magister (*.magister.net), the student information system of Dutch schools. It needs a school staff account, so we cannot provide test credentials. Without an account you can check: it does nothing on other sites; the toolbar icon (or Alt+D) opens the side panel with settings; there is no remote code, analytics or tracking, and requests only go to the school's own Magister domain. Screenshots show the features with demo data.
```

## 6. Afbeeldingen (Graphic assets)

Gemaakt met `store/maak.sh` (headless Chrome, ontwerp in de HTML-bestanden in `store/`). De schermafbeeldingen tonen Magister met verzonnen demogegevens (opleidingen ICT, Media en Zorg, verzonnen klassen en cijfers); de bronschermen staan niet in git.

| Veld in het dashboard | Bestand | Formaat |
|---|---|---|
| Storepictogram | `store/store-icoon-128.png` | 128×128 (96×96 beeld met lege rand) |
| Schermafbeeldingen (in deze volgorde) | `store/scherm-functies.png`, `store/scherm-opleidingen.png`, `store/scherm-lesregistraties.png` | 1280×800 |
| Kleine promotietegel (verplicht) | `store/promo-klein.png` | 440×280 |
| Marquee-promotietegel (optioneel) | `store/promo-groot.png` | 1400×560 |

## Voor het indienen

- Contactgegevens invullen in `PRIVACY.md`, en die online zetten.
- Laten nakijken door de ICT-afdeling of de functionaris gegevensbescherming van school.
- Het e-mailadres van het ontwikkelaarsaccount bevestigen (het dashboard vraagt erom).
