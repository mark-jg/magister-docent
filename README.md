# Docent Tools voor Magister (v0.7.6)

Chrome-extensie voor Magister (docenten/personeel). Alles draait lokaal in je browser: er wordt niets naar een server gestuurd.

## Installeren (lokaal laden)

1. Download de nieuwste `magister-docent-tools-vX.Y.Z.zip` van de [Releases-pagina](https://github.com/mark-jg/magister-docent/releases/latest). De repo is privé: je moet bij GitHub ingelogd zijn met een account dat toegang heeft.
2. Pak de zip uit in een map die je laat staan (bijvoorbeeld `Documenten/magister-docent-tools`).
3. Open Chrome en ga naar `chrome://extensions`.
4. Zet rechtsboven **Ontwikkelaarsmodus** aan.
5. Klik op **Uitgepakte extensie laden** en kies de map met `manifest.json`.
6. Open (of herlaad) Magister. Rechts verschijnt een handvat "Docent Tools".

Werkt ook in Edge (`edge://extensions`).

## Bijwerken

De extensie kijkt om de 6 uur op GitHub of er een nieuwere release is (alleen versienummer en downloadlink, er gaat niets over jou mee; uit te zetten bij Instellingen > Updates). Is er een nieuwe versie, dan krijgt het extensie-icoon een gele badge en staat bovenin het menu een blok met:

1. **Nu bijwerken**: opent Instellingen > Updates. De eerste keer kies je daar de map waarin je de extensie hebt uitgepakt (de map met `manifest.json`); die keuze wordt onthouden.
2. Klik op **Nu bijwerken naar X**. Chrome vraagt om toestemming voor de map (één klik). De extensie haalt de zip op met je token, schrijft de bestanden in de map en herlaadt zichzelf. Herlaad daarna open Magister-tabbladen.
3. Handmatig blijft mogelijk: zip downloaden, uitpakken over de extensiemap en op Herladen klikken.

Er worden alleen bestanden geschreven of overschreven, nooit verwijderd. Het manifest wordt als laatste geschreven, zodat een afgebroken update geen half nieuwe extensie achterlaat.

### GitHub-token (eenmalig)

Omdat de repo privé is, heeft de updatecontrole een token nodig. Zonder token meldt de extensie "de repo is privé; vul een GitHub-token in".

1. Ga naar [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) (ingelogd met een account dat toegang heeft tot de repo).
2. Token name: bijvoorbeeld `magister-docent-tools`. Expiration: kies zelf; na afloop vraagt de extensie om een nieuw token.
3. Resource owner: `mark-jg`. Repository access: **Only select repositories** → `magister-docent`.
4. Repository permissions: **Contents: Read-only** (Metadata wordt automatisch meegenomen). Verder niets.
5. Generate token, kopieer het en plak het in de extensie bij **Instellingen > Updates > GitHub-token**. De controle start direct.

Het token staat alleen in de lokale opslag van de extensie op dat apparaat (niet in de gesynchroniseerde instellingen) en gaat alleen naar `api.github.com`.

Chrome laat een uitgepakte extensie zijn eigen map alleen beschrijven als de gebruiker die map zelf aanwijst (File System Access API); daarom die eenmalige keuze en de toestemmingsvraag per update. Wie liever met git werkt: `git clone https://github.com/mark-jg/magister-docent`, die map als uitgepakte extensie laden, en bijwerken met `git pull` plus Herladen.

## Wat zit erin

| Functie | Hoe |
|---|---|
| Thema's: 16 presets (van Magister-standaard tot Krant, Terminal en Synthwave) of een eigen accentkleur; lettertype, lettergrootte, hoeken en dichtheid apart instelbaar | in het zijpaneel (Alt+D), Alt+T wisselt tussen je lichte en donkere thema |
| Docentenpaneel: klok en weeknummer, snelle links, notities, exportknoppen | Alt+D, of klik op het handvat |
| Tabellen: zwevend knopje "Exporteren" bij hover over een datatabel (kalenders en roosters worden overgeslagen), en een overzicht van alle tabellen in het zijpaneel. Naar Excel, CSV of klembord (plakt als cellen), sorteerbare koppen; per soort tabel instelbaar welke kolommen meegaan, kopregel, namen maskeren, lege rijen en kolommen weglaten | knoppen boven elke tabel, "Instellen" voor de opties; Alt+E exporteert alle tabellen op de pagina |
| Sneller invoeren: Enter springt naar de volgende rij, Ctrl+Shift+V plakt een kolom uit Excel in opeenvolgende velden | automatisch in invoertabellen |
| AI-hulp: prompt uit tabel of selectie, met sjablonen en knop "Namen maskeren" | knop "Naar AI" boven een tabel of in het paneel |
| Opgeruimde interface: verberg elementen die je niet gebruikt | Inspector (Alt+I), beweeg over een element en druk op H |
| Snelle aanwezigheid (Lesdashboard > leerlinglijst): "Iedereen aanwezig", springen naar een naam, toetsenbordmodus met letters per kolom | Alt+A, of de balk boven de registratielijst |
| Navigatie: commandopalet met alle menu-onderdelen en acties | Ctrl+K (of Alt+K); Alt+1 t/m 9 springt naar hoofdmenu-items; Alt+S naar het zoekveld |
| Thema bijwerken: elementen die niet meekleuren zelf toevoegen | Alt+I, beweeg over het element, C, kies achtergrond/vlak/accent/tekst |
| Mail bij Melding Expertisecentrum: controlescherm met naam, studentnummer, klas, "aangemeld voor" en samenvatting, daarna een concept-mail in Outlook naar de begeleidingscoach (niets wordt automatisch verzonden) | knop "Mail coach" naast "Volgende" bij een nieuwe melding, ✉ in de knoppenbalk van een bestaande melding in het logboek, of Alt+M; coaches (naam en e-mail) in de instellingen, in het controlescherm kies je aan wie |
| Inspector: selectors vinden, paginarapport (R, nu ook met bovenliggende frames en koppen van de hoofdpagina) en netwerkrapport (N, welke API-calls en velden, zonder waarden) | Alt+I |

Instellingen: klik op het extensie-icoon > Instellingen, of in het paneel.

## Verfijnen op jullie Magister-omgeving

De bovenstaande functies werken op elke Magister-pagina zonder kennis van de interne opbouw. Voor de Magister-specifieke onderdelen (absentie in één klik, standaardopmerkingen bij cijfers, logboeknotities, een klassen- en leerlingendashboard, echte donkere kleuren in plaats van inversie) heb ik de opbouw van jullie docentenmodule nodig. Zo lever je die aan:

1. Open in Magister de pagina waar het om gaat (bijvoorbeeld absentie-invoer of een cijferoverzicht).
2. Druk op **Alt+I** en daarna op **R**. Er wordt een `magister-rapport-….md` gedownload en op het klembord gezet. Het rapport bevat alleen structuur, kolomkoppen en veldnamen, geen leerlinggegevens.
3. Plak het rapport in het gesprek met Claude, met een korte beschrijving van wat je op die pagina sneller wilt doen.
4. Handig erbij: een screenshot van de pagina (namen mogen weggelakt).

Per pagina volgt dan een module die precies op die structuur werkt.

Voor de mailmodule: klopt de naam, het nummer of de klas niet, klik dan in het controlescherm op **Bronnen**. Dat zet op het klembord welke API-calls en veldnamen gevonden zijn (zonder waarden) en welke teksten op de pagina stonden; plak dat in het gesprek, met de naam weggelakt.

## Mappen

```
manifest.json            Extensiebeschrijving (Manifest V3)
background.js            Sneltoetsen, eerste installatie, updatecontrole (GitHub Releases)
content/defaults.js      Standaardinstellingen (één plek, gedeeld door alles)
content/core.js          Modulesysteem, instellingen, helpers
content/base.css         Stijl van de eigen UI (paneel, knoppen, toasts)
content/modules/*.js     Eén bestand per functie
options/                 Instellingenpagina en zelf-updater (updater.js)
popup/                   Menu onder het extensie-icoon
lib/xlsx.full.min.js     SheetJS (Excel-export), Apache 2.0
scripts/release.sh       Nieuwe versie taggen en pushen (zie hieronder)
.github/workflows/       Bouwt bij elke tag v* de zip en publiceert de release
```

## Nieuwe versie uitbrengen (ontwikkelaar)

1. Pas de code aan en zet een regel `- X.Y.Z: ...` bovenaan **Wijzigingen** hieronder. Commit.
2. Voer uit: `scripts/release.sh X.Y.Z`. Dat zet het versienummer in `manifest.json` en deze README, commit, maakt tag `vX.Y.Z` en pusht.
3. GitHub Actions bouwt `magister-docent-tools-vX.Y.Z.zip` en zet die als release op GitHub. Het versienummer in `manifest.json` moet gelijk zijn aan de tag, anders stopt de workflow.
4. Geïnstalleerde extensies zien de nieuwe versie bij de volgende controle (uiterlijk na 6 uur, of direct via "Controleer op updates" in het menu).

## Goed om te weten

- Magister OP bestaat uit drie lagen: nieuwe webcomponenten (dna/sl, bijvoorbeeld Aanwezigheid), oude AngularJS-schermen (Lesdashboard) en "guest apps" in een iframe (Leerlingen, Toetsinvoer). De extensie draait in alle drie.
- Donker thema: "Inversie" werkt overal; "Echte kleuren" gebruikt de designsysteem-variabelen van Magister en is mooier op de nieuwe schermen, maar laat oude schermen licht.
- Magister is een single-page app; de extensie volgt paginawijzigingen automatisch.
- Als Iddink de interface aanpast, kan een module tijdelijk niet werken. De generieke functies (thema, export, paneel) zijn daar het minst gevoelig voor.
- Overleg met ICT/FG van de school voor je de extensie op een beheerde werkplek installeert, en deel geen herleidbare leerlinggegevens met externe AI-diensten zonder dat dit volgens het schoolbeleid is toegestaan.

## Wijzigingen

- 0.7.7: mailknop in het logboek is nu een kopie van Magisters eigen icoonknoppen (zelfde maat, kleur en hover) met een envelop-icoon; knop "Mail coach" op de aanmaakpagina en het controlescherm in Magisters navy en Open Sans.
- 0.7.6: na een update toont het menu één keer "Bijgewerkt van X naar Y"; eerste versie die via de ingebouwde updater wordt binnengehaald.
- 0.7.5: zelf bijwerken: na het eenmalig kiezen van de extensiemap (Instellingen > Updates) haalt de extensie de nieuwe versie op, schrijft de bestanden en herlaadt zichzelf; knop "Nu bijwerken" in het menu; zip-uitpakker zonder externe bibliotheek.
- 0.7.4: meerdere begeleidingscoaches (naam en e-mail) in de instellingen, keuzelijst in het controlescherm met "Ander adres" als uitwijk; bestaande instelling wordt automatisch overgenomen; klasherkenning op de pagina ook voor klassen met één cijfer (zoals MM2A); "aangemeld voor" staat ook in het onderwerp van de mail.
- 0.7.3: mailmodule haalt naam, studentnummer en klas op via Magisters eigen API (leerling-id uit de adresbalk, API-calls van de bovenliggende detailkaart), met de koppen op de pagina als uitwijk; het controlescherm zegt waar de gegevens vandaan komen en de Bronnen-knop toont welke API-calls en veldnamen gevonden zijn (zonder waarden).
- 0.7.2: updatecontrole werkt met een privé repo: GitHub-tokenveld bij Instellingen > Updates (lokaal bewaard), zip-download via de API, duidelijkere foutmeldingen (geen toegang, token ongeldig, limiet bereikt).
- 0.7.1: updatecontrole via GitHub Releases (badge op het icoon, downloadknop en Herladen in het menu, instelling om de controle uit te zetten); versienummer komt uit `manifest.json`; releaseworkflow en `scripts/release.sh`.
- 0.7.0: module "Mail bij Melding Expertisecentrum" (nieuw formulier en logboek), Alt+M, instellingen voor adres, aanhef, cc en ondertekening; standaardinstellingen samengevoegd in `content/defaults.js`; paginarapport toont bovenliggende frames en koppen van de hoofdpagina (namen en nummers gemaskeerd).
- 0.6.1: zwevende exportknop, recolor-engine, snelle aanwezigheid, commandopalet, Inspector met netwerkrapport.
