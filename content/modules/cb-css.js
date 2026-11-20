/* Te laat-balie, de opmaak.
 * Deel van de module in cb.js: voegt methoden toe aan DtCb. */
Object.assign(DtCb, {
  css() {
    if (document.getElementById("dt-cb-style")) return;
    const st = document.createElement("style"); st.id = "dt-cb-style";
    /* Alles op Magisters eigen ontwerptokens (--sl-…), zodat de balie meekleurt met Magister en met het thema. */
    st.textContent = `
      ui-view.dt-cb-open > mg-att-tiles { display: none !important; }
      .dt-cb, .dt-cb-vars {
        --cb-fg: var(--sl-color-tab-default-foreground, #233243); --cb-zacht: color-mix(in srgb, var(--cb-fg) 62%, transparent);
        --cb-lijn: var(--sl-color-card-border, #bcbcbc); --cb-lijnzacht: color-mix(in srgb, var(--cb-lijn) 45%, transparent);
        --cb-kaart: var(--sl-color-card-background, #fefefe); --cb-vlak: var(--sl-elevation-surface-raised-sunken, #f6f8fa);
        --cb-acc: var(--sl-color-button-primary-solid-idle-background, var(--dt-accent, #056dc2));
        --cb-hover: var(--sl-color-tab-hover-background, #ddeffe); --cb-actief: var(--sl-color-tab-active-background, #b7defd);
        --cb-rood: var(--sl-color-border-accent-red-bold, #d7263d); --cb-groen: #1e8a4c;
        --cb-r: var(--sl-size-borderRadius-default, 4px); --cb-rl: var(--sl-size-borderRadius-lg, 8px);
        --cb-schaduw: var(--sl-elevation-shadow-sm, 0 2px 4px rgba(34,34,34,.08));
        color: var(--cb-fg); font-family: var(--sl-text-typeset-font-family-body, open-sans), sans-serif; font-size: 14px; line-height: 20px; }
      .dt-cb * , .dt-cb-vars * { box-sizing: border-box; }
      /* Zelfde maten als Magisters eigen subpagina's: kop en tabbalk 2rem van de rand (dezelfde variabele die
       * Magister op Meldingen zet), inhoud hooguit 1200px breed en gecentreerd. */
      /* Zelfde ondergrond als Magisters Aanwezigheid (lichtblauw in het Magister-thema, de themakleur in de andere). */
      #dt-cbp { background: var(--sl-elevation-surface-base-default, transparent); min-height: 100vh; display: block; --dna-page-layout-max-width: min(100%, calc(100% - 2 * 2rem)); min-width: 0; }
      /* Magisters paginaopmaak geeft de kop 0,5rem ruimte boven en 1rem onder (samen 94px hoog). Onze kop staat
       * niet in die opmaak en krijgt de ruimte daarom hier, zodat hij even hoog is als bij Aanwezigheid. */
      #dt-cbp dna-page-header { --_padding-block: .5rem 1rem; --padding-block: .5rem 1rem; }
      #dt-cbp dna-tabs { display: block; }
      #dt-cbp dna-tab { width: 100%; justify-self: stretch; }
      .dt-cb-tardy { font-size: 12px; opacity: .8; letter-spacing: .02em; white-space: nowrap; }
      .dt-cb-tel { margin-left: 6px; min-width: 18px; padding: 0 6px; border-radius: 999px; font-size: 11px; line-height: 18px; font-weight: 700; text-align: center; background: var(--cb-acc); color: #fff; }
      .dt-cb-tel:empty { display: none; }
      .dt-cb-tabblad { width: min(1200px, calc(100% - 4rem)); margin: 0 auto; padding: 16px 0 32px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .dt-cb-paneel { display: flex; flex-direction: column; gap: 16px; }
      .dt-cb-paneel:empty { display: none; }
      .dt-cb-inhoud { display: flex; flex-direction: column; gap: 16px; }
      .dt-cb-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .dt-cb-stand { color: var(--cb-zacht); font-size: 13px; }
      .dt-cb-stand.is-kijk { color: var(--cb-rood); font-weight: 600; }
      .dt-cb-periode { min-width: 240px; }
      dna-card.dt-cb-kaart { display: block; min-width: 0; }
      .dt-cb-kaart, .dt-cb-kaart p, .dt-cb-kaart label, .dt-cb-kaart span, .dt-cb-kaart small, .dt-cb-kaart td, .dt-cb-modalin p { font-size: 14px; line-height: 20px; }
      .dt-cb-kaart p, .dt-cb-modalin p { margin: 0 0 8px; overflow-wrap: anywhere; }
      .dt-cb-kaart h2 + p { margin-top: 4px; }
      .dt-cb-kaart small, .dt-cb-wie small, .dt-cb-tabel td small { font-size: 13px; }
      .dt-cb input, .dt-cb select, .dt-cb-vars input, .dt-cb-vars select { font-family: inherit; font-size: 14px; }
      .dt-cb-kaart h2, .dt-cb-kaart h3, .dt-cb-modalin h2 { margin: 0; font-family: var(--sl-text-typeset-font-family-heading, open-sans), sans-serif; font-size: 16px; line-height: 24px; font-weight: 700; color: var(--cb-fg); }
      .dt-cb-kaartkop { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .dt-cb-wie { flex: 1; min-width: 200px; } .dt-cb-wie small { display: block; color: var(--cb-zacht); font-size: 13px; }
      .dt-cb-rij { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .dt-cb-rij.eind { justify-content: flex-end; margin-top: 16px; }
      .dt-cb-zacht { color: var(--cb-zacht); margin: 0; } .dt-cb-waarschuw { color: var(--cb-rood); font-weight: 600; margin: 0; }
      .dt-cb-leeg { text-align: center; } .dt-cb-leeg p { color: var(--cb-zacht); } .dt-cb-leeg .dt-cb-rij { justify-content: center; }
      .dt-cb-veld, .dt-cb-meer, .dt-cb-bulk input { height: 36px; padding: 0 10px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-fg); font: inherit; min-width: 220px; }
      .dt-cb-veld.klein { height: 30px; min-width: 140px; }
      .dt-cb-redenrij .dt-cb-veld { flex: 0 1 320px; background: var(--cb-kaart) !important; }
      .dt-cb-veld:focus, .dt-cb-zoek:focus, .dt-cb-tijd:focus, .dt-cb-meer:focus { outline: none; border-color: var(--cb-acc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--cb-acc) 30%, transparent); }
      .dt-cb input[type="checkbox"], .dt-cb-vars input[type="checkbox"] { appearance: auto !important; -webkit-appearance: checkbox !important; width: 16px !important; height: 16px !important; margin: 0 !important; opacity: 1 !important; position: static !important; accent-color: var(--cb-acc); cursor: pointer; }
      .dt-cb-zoekrij { display: flex; gap: 8px; align-items: center; }
      .dt-cb-zoek { flex: 1; height: 44px; padding: 0 14px 0 40px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart) no-repeat 14px 50% / 16px
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='5' fill='none' stroke='%23778899' stroke-width='1.6'/%3E%3Cpath d='m11 11 3.5 3.5' stroke='%23778899' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
        color: var(--cb-fg); font: inherit; font-size: 16px; }
      /* Magister (padding) en de Apple-thema's (padding en background, met !important) stijlen elk zoekveld met
       * zwaardere selectors: dan schoof de tekst onder het vergrootglas, of verdween het vergrootglas. Daarom hier
       * met het id van de pagina en als losse eigenschappen afdwingen. */
      :is(#dt-cbp, .dt-cb-vars) input.dt-cb-zoek { padding: 0 14px 0 40px !important; text-indent: 0 !important; box-sizing: border-box !important; height: 44px !important; -webkit-appearance: none; appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='5' fill='none' stroke='%23778899' stroke-width='1.6'/%3E%3Cpath d='m11 11 3.5 3.5' stroke='%23778899' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") !important; background-position: 14px 50% !important; background-size: 16px !important; background-repeat: no-repeat !important; }
      :is(#dt-cbp, .dt-cb-vars) input.dt-cb-zoek::-webkit-search-decoration { -webkit-appearance: none; }
      .dt-cb-tijd { height: 44px; width: 120px; padding: 0 10px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-fg); font: inherit; }
      .dt-cb-hits { display: flex; flex-direction: column; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); overflow: hidden; box-shadow: var(--cb-schaduw); }
      .dt-cb-hits:empty { display: none; }
      .dt-cb-hit { appearance: none; border: 0; border-top: 1px solid var(--cb-lijnzacht); display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .dt-cb-hit:first-child { border-top: 0; }
      .dt-cb-hit[aria-selected="true"], .dt-cb-hit:hover { background: var(--cb-hover); }
      .dt-cb-hitnaam { flex: 1; display: flex; flex-direction: column; } .dt-cb-hitnaam small, .dt-cb-hitstand { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-mono { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; background: var(--cb-actief); color: var(--cb-fg); }
      .dt-cb-soorten { display: grid; grid-template-columns: 3fr 4fr; gap: 16px; }
      .dt-cb-groep { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; padding: 12px; border-radius: var(--cb-rl); border: 1px solid var(--cb-lijnzacht); }
      .dt-cb-groep > span { grid-column: 1 / -1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .dt-cb-groep.nok > span { color: var(--cb-rood); } .dt-cb-groep.ok > span { color: var(--cb-groen); }
      .dt-cb-groep.nok { background: color-mix(in srgb, var(--cb-rood) 5%, var(--cb-kaart)); } .dt-cb-groep.ok { background: color-mix(in srgb, var(--cb-groen) 5%, var(--cb-kaart)); }
      .dt-cb-soort { appearance: none; min-height: 60px; padding: 8px 12px; border: 1px solid var(--cb-lijn); border-radius: var(--cb-r); background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
      .dt-cb-soort b { font-size: 14px; font-weight: 700; } .dt-cb-soort small { color: var(--cb-zacht); font-size: 12px; }
      .dt-cb-soort:hover { background: var(--cb-hover); border-color: var(--cb-acc); }
      .dt-cb-soort.nok:hover { border-color: var(--cb-rood); } .dt-cb-soort.ok:hover { border-color: var(--cb-groen); }
      .dt-cb-meer { margin-top: 12px; min-width: 200px; }
      .dt-cb-uitslag, .dt-cb-signaal { border-left: 4px solid var(--cb-lijn); }
      .dt-cb-uitslag.n1, .dt-cb-signaal.n1 { border-left-color: #f2c400; } .dt-cb-uitslag.n2, .dt-cb-signaal.n2 { border-left-color: #f08a00; }
      .dt-cb-uitslag.n3, .dt-cb-signaal.n3 { border-left-color: #d7263d; } .dt-cb-uitslag.n4, .dt-cb-signaal.n4 { border-left-color: #8e44ad; }
      .dt-cb-signaal.is-af { opacity: .6; } .dt-cb-signaal p { margin: 0 0 12px; }
      .dt-cb-stats { margin: 0 0 12px !important; padding: 6px 10px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px !important; }
      .dt-cb-stats b { font-weight: 700; }
      .dt-cb-haal { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-haal[hidden] { display: none; }
      .dt-cb-haal b { flex: 0 0 200px; height: 6px; border-radius: 3px; background: var(--cb-lijnzacht); overflow: hidden; }
      .dt-cb-haal i { display: block; height: 100%; background: var(--cb-acc); transition: width .3s; }
      .dt-cb-afspraakmelding { margin: 8px 0 12px; padding: 10px 14px; border-radius: var(--cb-r); background: var(--cb-hover); border-left: 4px solid var(--cb-acc); font-size: 14px; }
      .dt-cb-ook { margin: 0 0 12px; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px; }
      .dt-cb-ook summary { cursor: pointer; color: var(--cb-zacht); font-size: 13px; line-height: 20px; }
      .dt-cb-ookregel { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; } .dt-cb-ookregel.is-af { opacity: .6; }
      .dt-cb-ookregel b, .dt-cb-ookregel small { display: block; font-size: 13px; line-height: 18px; } .dt-cb-ookregel small { color: var(--cb-zacht); }
      .dt-cb-proc { margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 22px; }
      .dt-cb-ladder { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .dt-cb-stap { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: start; padding: 10px 12px; border-radius: var(--cb-r); border: 1px solid var(--cb-lijnzacht); border-left: 4px solid var(--cb-lijn); }
      .dt-cb-stap.s1 { border-left-color: #f2c400; } .dt-cb-stap.s2 { border-left-color: #f08a00; } .dt-cb-stap.s3 { border-left-color: #d7263d; } .dt-cb-stap.s4 { border-left-color: #8e44ad; }
      .dt-cb-stap b { font-size: 14px; line-height: 20px; } .dt-cb-stap p { margin: 2px 0 0 !important; }
      .dt-cb-stapn { justify-self: start; font-size: 12px; font-weight: 700; line-height: 20px; white-space: nowrap; }
      .dt-cb-meter { display: inline-flex; gap: 2px; } .dt-cb-meter i { width: 6px; height: 14px; border-radius: 2px; background: var(--cb-lijnzacht); }
      .dt-cb-meter.m1 i:nth-child(-n+1), .dt-cb-meter.m2 i:nth-child(-n+2), .dt-cb-meter.m3 i:nth-child(-n+3), .dt-cb-meter.m4 i { background: var(--cb-acc); }
      .dt-cb-treden { display: flex; flex-direction: column; margin: 12px 0; border: 1px solid var(--cb-lijnzacht); border-radius: var(--cb-r); overflow: hidden; }
      .dt-cb-trede + .dt-cb-trede { border-top: 1px solid var(--cb-lijnzacht); }
      .dt-cb-protkop { appearance: none; width: 100%; display: grid; grid-template-columns: 110px auto 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border: 0; background: var(--cb-kaart); color: inherit; font: inherit; text-align: left; cursor: pointer; }
      .dt-cb-protkop:hover, .dt-cb-trede.open .dt-cb-protkop { background: var(--cb-hover); }
      .dt-cb-protnaam b, .dt-cb-protnaam small { display: block; font-size: 14px; line-height: 20px; } .dt-cb-protnaam small { font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-pijl { color: var(--cb-zacht); }
      .dt-cb-protform { padding: 12px 16px 16px; background: var(--cb-vlak); border-top: 1px solid var(--cb-lijnzacht); }
      .dt-cb-protveld { display: flex; flex-direction: column; gap: 4px; margin: 0 0 12px; font-size: 13px; font-weight: 600; }
      .dt-cb-protveld .dt-cb-veld { min-width: 0; width: 100%; box-sizing: border-box; font-weight: 400; }
      .dt-cb-tekstvak { height: auto !important; padding: 8px 10px !important; line-height: 20px; resize: vertical; }
      .dt-cb-protrij { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0 12px; }
      .dt-cb-protsub { margin: 4px 0 8px; font-size: 13px; font-weight: 700; }
      .dt-cb-protvinkjes { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 12px; }
      .dt-cb-naamknop { appearance: none; border: 0; padding: 0; background: none; font: inherit; font-weight: 700; color: var(--cb-acc); cursor: pointer; text-align: left; }
      .dt-cb-naamknop:hover { text-decoration: underline; }
      .dt-cb-vervolg { color: var(--cb-zacht); } .dt-cb-blok { display: block; }
      .dt-cb-uitkomst { display: inline-flex; padding: 0 8px; border-radius: var(--cb-r); font-size: 12px; line-height: 20px; font-weight: 700; white-space: nowrap; background: var(--cb-vlak); }
      .dt-cb-uitkomst.ok { background: #d9f2e3; color: #145c33; } .dt-cb-uitkomst.nok { background: #fdd8dc; color: #9b1424; }
      .dt-cb-uitkomst.verzet { background: #ddeffe; color: #0b4f8a; } .dt-cb-uitkomst.open { background: #ffe3c2; color: #7a4100; } .dt-cb-uitkomst.weg { color: var(--cb-zacht); }
      .dt-cb-telregel { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: var(--cb-zacht); margin: 4px 0 0; }
      .dt-cb-telregel .ok { color: var(--cb-groen); } .dt-cb-telregel .nok { color: var(--cb-rood); } .dt-cb-telregel b { color: var(--cb-fg); }
      .dt-cb-groepkop td .dt-cb-telregel { font-weight: 400; }
      .dt-cb-hist td { vertical-align: top; }
      .dt-cb-keuze { padding: 8px 12px; margin: 0 0 8px; border-radius: var(--cb-r); background: var(--cb-vlak); } .dt-cb-keuze b, .dt-cb-keuze small { display: block; font-size: 14px; line-height: 20px; } .dt-cb-keuze small { font-size: 13px; color: var(--cb-zacht); }
      .dt-cb-stapblok { margin: 8px 0; padding: 12px; border-radius: var(--cb-r); border: 1px solid var(--cb-lijnzacht); border-left: 4px solid var(--cb-lijn); }
      .dt-cb-stapblok.n1 { border-left-color: #f2c400; } .dt-cb-stapblok.n2 { border-left-color: #f08a00; } .dt-cb-stapblok.n3 { border-left-color: #d7263d; } .dt-cb-stapblok.n4 { border-left-color: #8e44ad; }
      .dt-cb-modal.breed .dt-cb-modalin { width: min(1000px, calc(100vw - 48px)); max-height: calc(100vh - 64px); overflow: auto; }
      .dt-cb-niveaugroep { padding-bottom: 4px; } .dt-cb-niveaugroep h2 { margin-bottom: 4px !important; }
      .dt-cb-siglijst { display: flex; flex-direction: column; margin: 0 -16px; }
      .dt-cb-sig { border-top: 1px solid var(--cb-lijnzacht); border-left: 3px solid transparent; }
      .dt-cb-sig.n1 { border-left-color: #f2c400; } .dt-cb-sig.n2 { border-left-color: #f08a00; } .dt-cb-sig.n3 { border-left-color: #d7263d; } .dt-cb-sig.n4 { border-left-color: #8e44ad; }
      .dt-cb-sig.is-af { opacity: .6; } .dt-cb-sig.is-open { background: var(--cb-vlak); }
      .dt-cb-sigrij { display: grid; grid-template-columns: 24px minmax(140px, 190px) minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 6px 13px; }
      .dt-cb-sigrij:hover { background: var(--cb-hover); }
      .dt-cb-sigpijl { appearance: none; border: 0; background: none; padding: 0; width: 24px; height: 24px; color: var(--cb-zacht); cursor: pointer; font-size: 12px; }
      .dt-cb-sigwie { min-width: 0; display: flex; flex-direction: column; } .dt-cb-sigwie small { font-size: 12px !important; color: var(--cb-zacht); line-height: 16px; }
      .dt-cb-sigwie .dt-cb-naamknop { font-size: 14px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dt-cb-sigwat { min-width: 0; cursor: pointer; }
      .dt-cb-sigregel { display: flex; gap: 8px; align-items: center; min-width: 0; }
      .dt-cb-sigtitel { font-size: 13px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-sigmaat { font-size: 12px; line-height: 18px; color: var(--cb-zacht); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-ookchip, .dt-cb-pct { flex: none; font-size: 12px !important; line-height: 18px; padding: 0 6px; border-radius: 999px; border: 1px solid var(--cb-lijnzacht); color: var(--cb-zacht); }
      .dt-cb-sigknoppen { display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
      .dt-cb-acties-in { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
      .dt-cb-actiegroep { display: inline-flex; align-items: center; }
      .dt-cb-terug { appearance: none; border: 0; background: none; width: 26px; height: 26px; border-radius: 50%; color: var(--cb-zacht); cursor: pointer; font-size: 17px; line-height: 26px; padding: 0; }
      .dt-cb-terug:hover { background: var(--cb-hover); color: var(--cb-fg); }
      .dt-cb-sigdetail { padding: 0 16px 12px 52px; } .dt-cb-sigdetail p { margin: 0 0 8px !important; font-size: 14px; }
      .dt-cb-sigdetail .dt-cb-ookregel { margin: 0 0 8px; }
      .dt-cb-siglijst { container-type: inline-size; }
      .dt-cb-sigregel { overflow: hidden; } .dt-cb-sigregel .dt-cb-niveau { min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
      .dt-cb-sigtitel { flex: 0 1 auto; min-width: 0; }
      @container (max-width: 720px) {
        .dt-cb-sigrij { grid-template-columns: 24px minmax(0, 1fr) auto; }
        .dt-cb-sigwie { grid-column: 2; grid-row: 1; } .dt-cb-sigknoppen { grid-column: 3; grid-row: 1; }
        .dt-cb-sigwat { grid-column: 2 / 4; grid-row: 2; }
        .dt-cb-sigdetail { padding-left: 16px; }
      }
      .dt-cb-ikoon { position: relative; appearance: none; width: 34px; height: 32px; display: inline-grid; place-items: center; padding: 0; border: 1px solid var(--cb-acc); border-radius: var(--cb-r); background: var(--cb-kaart); color: var(--cb-acc); cursor: pointer; }
      .dt-cb-ikoon:hover { background: var(--cb-hover); }
      .dt-cb-ikoon:focus-visible { outline: 2px solid var(--cb-acc); outline-offset: 2px; }
      .dt-cb-ikoon.is-hoofd { background: var(--cb-acc); color: #fff; } .dt-cb-ikoon.is-hoofd:hover { filter: brightness(1.1); }
      .dt-cb-ikoon.is-gedaan { border-color: var(--cb-groen); color: var(--cb-groen); background: color-mix(in srgb, var(--cb-groen) 8%, var(--cb-kaart)); }
      .dt-cb-ikoon:disabled { border-color: var(--cb-lijnzacht); color: var(--cb-lijn); cursor: default; background: none; }
      .dt-cb-vink { position: absolute; right: -5px; top: -6px; width: 15px; height: 15px; border-radius: 50%; background: var(--cb-groen); color: #fff; font-size: 10px; line-height: 15px; text-align: center; font-weight: 700; }
      .dt-cb-sigknoppen .dt-cb-acties-in { gap: 6px; }
      .dt-cb-sig.is-open .dt-cb-sigmaat { display: none; }
      .dt-cb-detailknoppen { margin: 0 0 10px; }
      dna-card.dt-cb-periodeaf { border-left: 4px solid var(--cb-acc); }
      .dt-cb-datum { width: 150px; } .dt-cb-datum.is-anders { border-color: var(--cb-acc); background: var(--cb-hover); font-weight: 700; }
      .dt-cb-anderedag { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-hover); border-left: 4px solid var(--cb-acc); font-size: 14px; }
      .dt-cb-waar:empty { display: none; } .dt-cb-waar { margin-top: 12px; padding: 12px 16px; border-radius: var(--cb-rl); border: 1px solid var(--cb-lijnzacht); background: var(--cb-vlak); display: flex; flex-direction: column; gap: 10px; }
      .dt-cb-waar h3 { margin: 0; font-size: 16px; line-height: 24px; }
      .dt-cb-nu { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: var(--cb-r); background: var(--cb-kaart); border-left: 4px solid #1e8a4c; }
      .dt-cb-nu b { font-size: 16px; } .dt-cb-nu small { font-size: 12px !important; color: var(--cb-zacht); text-transform: uppercase; letter-spacing: .04em; }
      .dt-cb-nu.is-weg { border-left-color: var(--cb-rood); } .dt-cb-nu.is-leeg { border-left-color: var(--cb-lijn); }
      .dt-cb-aanwezig { margin: 0 !important; font-weight: 700; color: #1e8a4c; } .dt-cb-aanwezig.is-weg { color: var(--cb-rood); }
      .dt-cb-rooster tr.is-nu td { background: var(--cb-hover); font-weight: 600; } .dt-cb-rooster tr.is-voorbij td { color: var(--cb-zacht); }
      .dt-cb-ovbalk { align-items: center; } .dt-cb-ovbalk .dt-cb-veld { min-width: 0; } .dt-cb-ovbalk input[type=search] { flex: 1 1 200px; }
      .dt-cb-ovchips { margin: 8px 0; }
      .dt-cb-ovchip { font-size: 13px !important; padding: 2px 10px; border-radius: 999px; background: var(--cb-vlak); border: 1px solid var(--cb-lijnzacht); }
      .dt-cb-ovchip.nok { color: var(--cb-rood); font-weight: 600; } .dt-cb-ovchip.meld { background: #ddeffe; color: #0b4f8a; }
      .dt-cb-ovsoort { display: inline-block; font-size: 12px !important; line-height: 18px; padding: 0 8px; border-radius: 999px; background: var(--cb-vlak); border: 1px solid var(--cb-lijnzacht); white-space: nowrap; }
      .dt-cb-ovsoort.g-telaat, .dt-cb-ovsoort.c-TL { background: #fff4e0; color: #8a5300; border-color: #f5c46b; }
      .dt-cb-ovsoort.g-ongeoorloofd, .dt-cb-ovsoort.c-AB_NO, .dt-cb-ovsoort.c-UI { background: color-mix(in srgb, var(--cb-rood) 12%, var(--cb-kaart)); color: var(--cb-rood); border-color: color-mix(in srgb, var(--cb-rood) 35%, transparent); }
      .dt-cb-ovsoort.g-ziek, .dt-cb-ovsoort.c-ZK, .dt-cb-ovsoort.g-medisch, .dt-cb-ovsoort.c-AB_OK, .dt-cb-ovsoort.g-geoorloofd, .dt-cb-ovsoort.g-calamiteit { background: #eef2f7; color: #3c4f66; }
      .dt-cb-ovsoort.g-meld { background: #ddeffe; color: #0b4f8a; border-color: #9fcdf5; }
      .dt-cb-magchip { flex: none; font-size: 12px !important; line-height: 18px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--cb-rood) 12%, var(--cb-kaart)); color: var(--cb-rood); font-weight: 600; }
      .dt-cb-magvink { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; }
      .dt-cb-magvink small { font-size: 12px !important; color: var(--cb-zacht); }
      .dt-cb-magvink.is-ok small { color: #1e8a4c; } .dt-cb-magvink.is-nok small { color: var(--cb-rood); font-weight: 600; }
      .dt-cb-magvink input:disabled { cursor: default; }
      .dt-cb-bronnen { margin: 8px 0; } .dt-cb-bronnen .dt-cb-tabel { margin-top: 6px; } .dt-cb-bronnen td, .dt-cb-bronnen th { font-size: 13px !important; }
      .dt-cb-meldchip { flex: none; font-size: 12px !important; line-height: 18px; padding: 0 6px; border-radius: 999px; background: #ddeffe; color: #0b4f8a; }
      .dt-cb-meldregel { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0 0 10px; padding: 8px 10px; border-radius: var(--cb-r); background: color-mix(in srgb, var(--cb-acc) 8%, var(--cb-kaart)); font-size: 14px; }
      .dt-cb-meldregel .dt-cb-acties3 { margin: 0; padding: 0; border: 0; } .dt-cb-detailknoppen .dt-cb-acties3 { margin: 0; }
      .dt-cb-voorbeeld { margin: 0; padding: 12px; border-radius: var(--cb-r); background: var(--cb-vlak); border: 1px solid var(--cb-lijnzacht); white-space: pre-wrap; font: 13px/19px var(--sl-text-typeset-font-family-body, open-sans), sans-serif; max-height: 320px; overflow: auto; }
      .dt-cb-chip.is-extra { border-style: dashed; }
      .dt-cb-acties3 { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; padding: 8px; border-radius: var(--cb-r); border: 1px dashed var(--cb-lijnzacht); }
      .dt-cb-actie.is-gedaan { color: var(--cb-groen); }
      .dt-cb-gevolg { display: flex; gap: 8px; align-items: baseline; margin: 0 0 8px; }
      .dt-cb-afspraak { margin: 0 0 8px; font-weight: 600; }
      .dt-cb-niveau { display: inline-flex; align-items: center; padding: 0 8px; border-radius: var(--cb-r); font-size: 12px; line-height: 20px; font-weight: 700; white-space: nowrap; background: var(--cb-vlak); }
      .dt-cb-niveau.n1 { background: #fff4c2; color: #6b5200; } .dt-cb-niveau.n2 { background: #ffe3c2; color: #7a4100; } .dt-cb-niveau.n3 { background: #fdd8dc; color: #9b1424; } .dt-cb-niveau.n4 { background: #ecdcf5; color: #5e2a7e; }
      .dt-cb-redenrij { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
      .dt-cb-label { font-size: 12px; font-weight: 700; color: var(--cb-zacht); text-transform: uppercase; letter-spacing: .04em; }
      .dt-cb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dt-cb-chip { appearance: none; height: 30px; padding: 0 12px; border: 1px solid var(--cb-lijn); border-radius: 999px; background: var(--cb-kaart); color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
      .dt-cb-chip:hover { background: var(--cb-hover); }
      .dt-cb-chip[aria-pressed="true"] { background: var(--cb-actief); border-color: var(--cb-acc); font-weight: 700; }
      .dt-cb-magister { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-vlak); font-size: 13px; }
      .dt-cb-magister code { padding: 2px 6px; border-radius: var(--cb-r); background: var(--cb-kaart); border: 1px solid var(--cb-lijnzacht); font: 600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .dt-cb-tabel { width: 100%; border-collapse: collapse; }
      .dt-cb-tabel th { text-align: left; font-size: 12px; font-weight: 700; color: var(--cb-zacht); padding: 8px; border-bottom: 1px solid var(--cb-lijn); }
      .dt-cb-tabel td { padding: 6px 8px; border-bottom: 1px solid var(--cb-lijnzacht); vertical-align: middle; }
      .dt-cb-tabel tr:hover td { background: color-mix(in srgb, var(--cb-hover) 50%, transparent); }
      .dt-cb-tabel td small { color: var(--cb-zacht); }
      .dt-cb-groepkop td { font-weight: 700; background: var(--cb-vlak); }
      .dt-cb-acties { white-space: nowrap; text-align: right; }
      .dt-cb-bulk { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--cb-r); background: var(--cb-hover); }
      .dt-cb-bulk[hidden] { display: none; }
      .dt-cb-bulk input { min-width: 0; }
      .dt-cb-niveaugroep { display: flex; flex-direction: column; gap: 8px; } .dt-cb-niveaugroep h2 { display: flex; gap: 8px; align-items: center; margin: 4px 0 0; font-size: 15px; }
      .dt-cb-schakel { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
      .dt-cb-veldrij { display: grid; grid-template-columns: 140px minmax(200px, 340px) 1fr; gap: 12px; align-items: center; margin: 8px 0; }
      .dt-cb-veldrij .dt-cb-veld { width: 100%; min-width: 0; }
      .dt-cb-veldrij small { color: var(--cb-zacht); }
      .dt-cb-modal { position: fixed; inset: 0; z-index: 1350; display: grid; place-items: center; background: rgba(34,34,34,.4); }
      .dt-cb-modalin { display: flex; flex-direction: column; gap: 12px; width: min(720px, 92vw); max-height: 86vh; overflow: auto; box-shadow: var(--sl-elevation-shadow-overlay, 0 12px 32px rgba(0,0,0,.2)); }
      .dt-cb-modalin .dt-cb-veld { width: 100%; }
      .dt-cb-mails { display: flex; flex-direction: column; gap: 8px; }
      .dt-cb-mail { border: 1px solid var(--cb-lijnzacht); border-radius: var(--cb-r); padding: 8px 12px; }
      .dt-cb-mail .dt-cb-rij b { flex: 1; } .dt-cb-onderwerp { font-weight: 700; margin: 4px 0; }
      .dt-cb-mail pre { margin: 0; white-space: pre-wrap; font: inherit; font-size: 13px; color: var(--cb-zacht); max-height: 220px; overflow: auto; }
      .dt-cb-scanvak { position: relative; border-radius: var(--cb-rl); overflow: hidden; background: #000; aspect-ratio: 4 / 3; }
      .dt-cb-scanvak video { width: 100%; height: 100%; object-fit: cover; }
      .dt-cb-scanvak i { position: absolute; inset: 30% 12%; border: 3px solid rgba(255,255,255,.85); border-radius: var(--cb-rl); }
      .dt-cb-toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px); opacity: 0; pointer-events: none; padding: 10px 16px; border-radius: var(--cb-r); background: #233243; color: #fff; font-weight: 600; max-width: 80vw; transition: opacity .2s, transform .2s; z-index: 1400; box-shadow: var(--sl-elevation-shadow-overlay, 0 8px 24px rgba(0,0,0,.2)); }
      .dt-cb-toast.is-aan { opacity: 1; transform: translate(-50%, 0); } .dt-cb-toast[data-soort="err"] { background: var(--cb-rood); }
      @media (max-width: 900px) { .dt-cb-soorten { grid-template-columns: 1fr; } .dt-cb-tabblad { width: calc(100% - 2rem); } }
    `;
    document.head.append(st);
  },
});
