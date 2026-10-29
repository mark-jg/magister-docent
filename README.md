# Docent Tools voor Magister (v0.13.4)

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
| Jarig: kaart op Vandaag met (aankomende) jarige leerlingen, klikbaar naar de leerlingkaart | automatisch op het startscherm; Instellingen > Jarig voor hoe ver vooruit |
| Thema's: 20 presets (van Magister-standaard tot Krant, Terminal, Synthwave, Apple en Apple Glass) of een eigen accentkleur; lettertype, lettergrootte, hoeken en dichtheid apart instelbaar | in het zijpaneel (Alt+D), Alt+T wisselt tussen je lichte en donkere thema |
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

- 0.13.4: maandgrafiek: de lege grijze achtergrond van de staven is weg; alleen de gevulde stapel is zichtbaar, met afgeronde hoeken, en een maand zonder registraties krijgt een streepje.
- 0.13.3: aanwezigheidstegel: donut met de aanwezigheid in groen en de afwezige lessen per type in de kleuren van de grafiek (ziek, absent geoorloofd en ongeoorloofd, uitgestuurd, vrijstelling); tekst begint met het aantal aanwezige lessen; de tegel kleurt niet meer rood of groen.
- 0.13.2: de maandgrafiek op de leerlingkaart toont nu alle registraties gestapeld per type (absent geoorloofd en ongeoorloofd, ziek, uitgestuurd, vrijstelling, te laat, overig), met een legenda van de typen die voorkomen en het aantal per maand.
- 0.13.1: aanwezigheid: Magister levert het registratietype als naam (absent, teLaat, ziek, uitgestuurd, vrijstelling) en niet als code; de ring en de maandgrafiek tellen nu goed. Onbekende types worden in de tegel genoemd.
- 0.13.0: Leerlingoverzicht: aanwezigheid als ring (percentage aanwezig dit schooljaar, met lessen, afwezig, ongeoorloofd, te laat en ziek) en een grafiek met afwezigheid per maand (geoorloofd en ongeoorloofd als aandeel van de lessen); klikken opent Verzuim. Gebaseerd op dezelfde registraties die het scherm Verzuim toont.
- 0.12.0: module "Leerlingoverzicht": kaart "Overzicht" bovenaan het tabblad Algemeen van de leerlingkaart, in de widgetstijl van de notificaties op Vandaag: lessen vandaag (met huidige of volgende les), ongelezen logboeken (met recent en prioriteit), open taken deze week, openstaande terugkommaatregelen en dagen tot de verjaardag, plus het rooster van vandaag en het laatste logboekformulier; tegels met logboek openen Begeleiding. Gevoed door Magisters eigen leerling-aanroepen via je sessie; eigen aanroepen van de extensie staan nu ook in het netwerkrapport (Alt+I, N). Leerlingkaart: naam en stamnummer onder de foto lopen niet meer over de klas-chip.
- 0.11.1: leerlingkaart: de camera-knop is een klein blauw rondje op de foto in plaats van een grote cirkel over de naam; het actieve tabblad heeft geen blauwe rand meer (de onderstreep-regel voor oudere tabbladen gold ook voor deze capsules).
- 0.11.0: leerlingkaart (detailkaarten) in de Apple-thema's: kop zonder wit vlak met grote naam en klas, tabbladen als capsules, kaarten in een gelijkmatig raster met gelijke hoogte, profielkaart met klas-chip en ronde actieknoppen, gegevens als rustige rijen, adres en contact als groepen in de kaart, toestemmingen met gekleurde vinkjes; werkt ook in de donkere varianten.
- 0.10.1: Jarig toont nu de klas (stamklas, per leerling opgehaald zoals op de leerlingkaart) en klikken opent de leerlingkaart via Magisters eigen routering; op Vandaag staan de Mededelingen voortaan onder de agenda, zodat de rechterkolom korter is.
- 0.10.0: module "Jarig": kaart op Vandaag met de (aankomende) jarige leerlingen uit Magisters eigen lijst (/api/leerlingen/jarigen, via je eigen sessie), gegroepeerd op vandaag, morgen en datum, met initialen, klas en leeftijd, klikbaar naar de leerlingkaart; instelbaar hoe ver vooruit (1 week, 2 weken, 1 maand); jarigen van vandaag staan ook als chip in de samenvatting.
- 0.9.10: startscherm: dagkoppen per dag herkend (geen dubbele "Vandaag", vrijdag niet meer gedimd), labels "gewijzigd/vervallen" niet meer afgesneden, "niet verantwoord" als oranje stip, de eerstvolgende les licht op, en onder de datum een samenvattingsregel met lessen vandaag, volgende les, wijzigingen en de meldingen die aandacht vragen.
- 0.9.9: startscherm: notificatietegels en dagkoppen beginnen met een hoofdletter; de agenda op Vandaag heeft per les een balkje in de vakkleur, de lopende les licht op, voorbije lessen van vandaag dimmen, vervallen lessen zijn doorgestreept, en de dagkoppen heten "Vandaag · …" en "Morgen · …".
- 0.9.8: notificaties op het startscherm als widget-raster in Apple-stijl: tegels met groot getal, icoon in een getinte cirkel en het onderwerp eronder; meldingen boven nul lichten op in een eigen kleur (logboeken blauw, verantwoorden groen, ziek oranje, terugkomen indigo, toets gemist rood, ouderavond teal, deadline roze, ingeleverd paars), nul-meldingen rustig grijs.
- 0.9.7: menu-items met een afbeelding als icoon (Cijfers, ELO) krijgen in de Apple-thema's ook het accentblauw, wit bij het actieve item.
- 0.9.6: agenda: de knoppen vorige/volgende staan in de titelrij naast Magisters ronde knoppen, de schaduw onder "Hele dag" is weg.
- 0.9.5: agenda ruimer: hogere uurrijen en grotere afspraaktekst; navigatie als twee ronde pijlknoppen rechtsboven, geen lijnen rond dagkoppen en "Hele dag"; rechterpaneel als losse kaarten op de achtergrond met de segmentknop erboven.
- 0.9.4: afspraken in de agenda zonder zijlijn, als één getint vlak met meer ruimte rondom de tekst en een kleine marge ertussen.
- 0.9.3: agenda zonder kaart: het rooster ligt direct op de achtergrond, alleen de afspraken zijn vlakken; uurlijnen heel licht, halve uren weg, kolomlijnen nog lichter.
- 0.9.2: agenda in de taal van Apple Agenda: kleur per vak of klas uit Apples agendapalet (instelling "Agendakleur": per vak, per klas, uit), ook op het startscherm; voorbije afspraken gedimd; tekst en chips in de donkere variant van de afspraakkleur; markeringen (toets, huiswerk, niet verantwoord) klein rechtsonder, "niet verantwoord" als oranje stip.
- 0.9.1: agenda rustiger: uurlijnen licht, halve uren bijna onzichtbaar, geen streep onder de dagkoppen en geen kader om de "Hele dag"-rij, geen lijn naast de tijdas, lesuur-chips als lichte tint, dunnere schuifbalk.
- 0.9.0: agenda en startscherm op het niveau van Aanwezigheid, gebouwd op een nabouw met de echte kalendercomponent (FullCalendar) en Magisters stylesheet: ronde navigatieknoppen, geen arcering buiten werktijd, rustige dag- en uurlabels, rode nu-lijn met stip, afspraken met meer lucht en geweigerde afspraken in rood, zijbalk met segmentknop en kaarten van 20px; startscherm met kaarten van 20px, capsules voor "nieuw / gewijzigd / vervallen" en een onthullingspijl op notificaties.
- 0.8.14: geen fouten meer in frames zonder body (sessie-iframe); de kleurvertaler slaat bij de Apple-thema's over (scheelt werk elke 2,5 s); het netwerkrapport (Alt+I, N) toont per API-call de duur, grootte en eventuele fout, zodat trage schermen te herleiden zijn; grote antwoorden worden niet meer geparsed; skelet-tegels met 20px hoeken.
- 0.8.13: pijl op de Aanwezigheid-tegels staat midden in de cirkel.
- 0.8.12: tegels op Aanwezigheid even hoog (alle rijen volgen de hoogste kaart) met de pijl overal op dezelfde plek.
- 0.8.11: tegels op Aanwezigheid verfijnd: icoon linksboven in een zacht blauw afgerond vlak, titel en omschrijving links uitgelijnd, pijl als lichte tint die bij aanwijzen vult, raster dat met de tekst meegroeit; getest op de echte component.
- 0.8.10: nieuwere dna-componenten (o.a. de aanwezigheidsapp) lezen privévariabelen met underscore; elke componentvariabele van het thema krijgt nu een tweeling met underscore, waardoor paginakop, broodkruimels en tegels van Aanwezigheid het thema volgen; getest op de echte aanwezigheidscomponent.
- 0.8.9: het paginarapport (Alt+I, R) meldt nu versie, thema en of de themastijl de shadow roots bereikt (aantal roots, aantal met stijl, hoekradius van een tegel, achtergrond van de paginakop), om verschillen tussen de nabouw en de echte pagina te kunnen herleiden.
- 0.8.8: thema bereikt nu elke shadow root: een script in de hoofdwereld (`content/shadowroots.js`) geeft elke shadow root bij het aanmaken de themastijl mee, ook gesloten roots en roots die later ontstaan (Aanwezigheid, roosters); tegels op Aanwezigheid groter, met lift bij aanwijzen.
- 0.8.7: agenda-afwerking: geen blauwe streep meer onder de kopbalk (regel was bij 0.8.1 weggevallen), navigatiebalk in de roosterkaart, afspraaktekst donkerblauw, minikalender met maandtitel op één regel; ronde knoppen in de kopbalk in accenttint.
- 0.8.6: agenda in de stijl van Apple Agenda (kaart zonder kaders, lichte hairlines, afspraken als zachte tint met gekleurde linkerrand, rode nu-lijn, minikalender met vandaag in accent en keuze als gevulde cirkel, keuzelijsten met ronde hoeken); leerlingenlijst als kaart; de kleurvertaler blijft bij de Apple-thema's uit alle componenten weg, zodat tegels en paginakoppen (Aanwezigheid) nu wél het thema volgen.
- 0.8.5: Apple-thema's doorgezet naar de nieuwe schermen: de blauwe paginakop (Aanwezigheid e.d.) wordt een gewone kop met grijze broodkruimels, de lichtblauwe achtergrond van de SL-schermen volgt het thema, tegels krijgen 20px hoeken, hairline-schaduw en een blauwe pijlknop, SL-roosters krijgen een rustige kop en lichte lijnen, en de leerlingenlijst (eigen tabel in een iframe) verliest de randen om elke cel en de rand om het filterpaneel; in Apple Glass zijn tegels en tabelkoppen van glas.
- 0.8.4: Apple-thema's: lijsten en tabellen in de rustige inset-stijl van Apple (geen kader, dagkoppen als groepskopje met ruimte in plaats van een lijn, lichte scheidingslijnen die bij de tekst beginnen, zachte markering van de lopende les, kleine grijze tabelkoppen); de iconenrail en zijbalk worden als allerlaatste in de cascade gezet en winnen daarmee ook van eigen aanvullingen uit de Inspector.
- 0.8.3: Apple-thema's: uitlijning van lijsten (rijen 44px, tellers als pil in het midden van de rij, uitklapkoppen zonder tabblad-streep, geen kader om de agenda), submenu's onder Cijfers en ELO zonder losse streepjes, de iconenrail blijft licht (de kleurvertaler laat de schil met rust), en meer diepte in Apple Glass (sterkere kleurwas, transparantere kaarten met glanslaag en diepere schaduw).
- 0.8.2: thema's "Apple Glass (licht)" en "Apple Glass (donker)" in de Liquid Glass-stijl: doorschijnende zijbalk, kaarten, kopbalken en menu's met vervaging en een lichtrand, een zachte kleurwas als achtergrond (in iframes doorzichtig zodat die doorloopt), capsulevormige knoppen, tabbladen, chips en zoekvelden, en een glanzende blauwe hoofdknop.
- 0.8.1: Apple-thema opnieuw opgebouwd op Magisters eigen selectors en de variabelen van de dna-componenten: zijbalk en iconenrail als één licht vlak met woordmerk in SF Pro, kaarten zonder rand met 14px hoeken, agenda- en notificatielijsten met hairlines, lesuur-chips en tellers als blauwe tinten, tabbladen als segmentknop, tabellen met alleen horizontale lijnen, donkere menu-tooltips, en een leesbare donkere variant (tekstvariabelen van Magister werden in het donker verkeerd gezet).
- 0.8.0: thema's "Apple (licht)" en "Apple (donker)" naar de Human Interface Guidelines: systeemlettertype (SF Pro), systeemblauw, gegroepeerde grijze achtergrond met witte vlakken, hairline-scheidingslijnen in plaats van randen, 10px/14px hoeken, doorschijnende balken, lichte zijbalk met blauwe selectie en een focusring; werkt ook binnen Magisters dna-componenten. Lettertype "Apple (SF Pro)" apart kiesbaar.
- 0.7.10: mailknop probeert meerdere plaatsingen rond Magisters knoppenbalk en meet welke op dezelfde rij uitkomt; de Bronnen-tekst meldt de gekozen plaatsing en de opbouw van de balk (alleen maten en structuur).
- 0.7.9: mailknop staat op dezelfde rij als prullenbak, printer en plus (vóór Magisters knoppenbalk, met controle dat hij echt op die rij staat); icoon in Magisters navy en iets groter.
- 0.7.8: mailknop in het logboek is weer een eigen, randloze icoonknop op de plek van 0.7.6; hij meet maat, kleur en icoongrootte van de prullenbak-knop ernaast op (het kopiëren van Magisters knop uit 0.7.7 brak de indeling).
- 0.7.7: mailknop in het logboek is nu een kopie van Magisters eigen icoonknoppen (zelfde maat, kleur en hover) met een envelop-icoon; knop "Mail coach" op de aanmaakpagina en het controlescherm in Magisters navy en Open Sans.
- 0.7.6: na een update toont het menu één keer "Bijgewerkt van X naar Y"; eerste versie die via de ingebouwde updater wordt binnengehaald.
- 0.7.5: zelf bijwerken: na het eenmalig kiezen van de extensiemap (Instellingen > Updates) haalt de extensie de nieuwe versie op, schrijft de bestanden en herlaadt zichzelf; knop "Nu bijwerken" in het menu; zip-uitpakker zonder externe bibliotheek.
- 0.7.4: meerdere begeleidingscoaches (naam en e-mail) in de instellingen, keuzelijst in het controlescherm met "Ander adres" als uitwijk; bestaande instelling wordt automatisch overgenomen; klasherkenning op de pagina ook voor klassen met één cijfer (zoals MM2A); "aangemeld voor" staat ook in het onderwerp van de mail.
- 0.7.3: mailmodule haalt naam, studentnummer en klas op via Magisters eigen API (leerling-id uit de adresbalk, API-calls van de bovenliggende detailkaart), met de koppen op de pagina als uitwijk; het controlescherm zegt waar de gegevens vandaan komen en de Bronnen-knop toont welke API-calls en veldnamen gevonden zijn (zonder waarden).
- 0.7.2: updatecontrole werkt met een privé repo: GitHub-tokenveld bij Instellingen > Updates (lokaal bewaard), zip-download via de API, duidelijkere foutmeldingen (geen toegang, token ongeldig, limiet bereikt).
- 0.7.1: updatecontrole via GitHub Releases (badge op het icoon, downloadknop en Herladen in het menu, instelling om de controle uit te zetten); versienummer komt uit `manifest.json`; releaseworkflow en `scripts/release.sh`.
- 0.7.0: module "Mail bij Melding Expertisecentrum" (nieuw formulier en logboek), Alt+M, instellingen voor adres, aanhef, cc en ondertekening; standaardinstellingen samengevoegd in `content/defaults.js`; paginarapport toont bovenliggende frames en koppen van de hoofdpagina (namen en nummers gemaskeerd).
- 0.6.1: zwevende exportknop, recolor-engine, snelle aanwezigheid, commandopalet, Inspector met netwerkrapport.
