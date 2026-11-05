/* GEGENEREERD door scripts/tardy-kern.py uit Tardy (web/index.html). Niet met de hand wijzigen:
 * pas Tardy aan en genereer opnieuw. Bevat de telling, het verzuimprotocol, de mailteksten en het
 * te-laat-briefje, zodat de community-builder-module (cb.js) rekent zoals Tardy. */
var TardyKern = (function () {
"use strict";
const H = { bewaar() {}, toon() {} };
function bewaar() { H.bewaar(); }
function toon(t, lang) { H.toon(t, lang); }
function render() {}
/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const iso = d => { const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const vandaag = () => iso(new Date());
const nuTijd = () => { const d=new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const DAGEN=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const MAANDEN=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
function dmy(s){ if(!s) return ""; const [y,m,d]=s.split("-"); return d+"-"+m+"-"+y; }
function dagvan(s){ return DAGEN[new Date(s+"T12:00:00").getDay()]; }
function langDatum(s){ const d=new Date(s+"T12:00:00"); return dagvan(s)+" "+d.getDate()+" "+MAANDEN[d.getMonth()]; }
function plusDagen(s,n){ const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return iso(d); }
function volgendeSchooldag(s){ let d=plusDagen(s,1),g=new Date(d+"T12:00:00").getDay(); while(g===0||g===6){ d=plusDagen(d,1); g=new Date(d+"T12:00:00").getDay(); } return d; }
function dagenTussen(a,b){ return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000); }
function _toonTardy(t,lang){ const m=$("#toastMount"); m.innerHTML='<div class="toast" role="status">'+esc(t)+"</div>"; clearTimeout(toon._t); toon._t=setTimeout(()=>m.innerHTML="", lang||3200); }
function naamVan(st){ return st ? [st.roepnaam, st.tussenvoegsel, st.achternaam].filter(Boolean).join(" ") : ""; }
function leeftijdOp(gb,op){ if(!gb) return null; const g=new Date(gb+"T12:00:00"), d=new Date((op||vandaag())+"T12:00:00");
  let a=d.getFullYear()-g.getFullYear(); const m=d.getMonth()-g.getMonth(); if(m<0||(m===0&&d.getDate()<g.getDate())) a--; return a; }
function minderjarig(st,op){ const a=leeftijdOp(st&&st.geboortedatum,op); return a===null?null:a<18; }

/* ================= registratiesoorten (zoals in Magister) ================= */
const SOORTEN = [
  {c:"TEL", n:"Te laat",                     g:"telaat",       ok:false, snel:true},
  {c:"ONG", n:"Ongeoorloofd afwezig",        g:"ongeoorloofd", ok:false, snel:true},
  {c:"UIT", n:"Uitgestuurd",                 g:"incident",     ok:false, snel:true},
  {c:"CAL", n:"Calamiteit",                  g:"calamiteit",   ok:true,  snel:true},
  {c:"ZIE", n:"Ziek",                        g:"ziek",         ok:true,  snel:true},
  {c:"DOK", n:"Dokter / Medisch specialist", g:"medisch",      ok:true,  snel:true},
  {c:"TAN", n:"Tandarts / Orthodontist",     g:"medisch",      ok:true,  snel:true},
  {c:"VLF", n:"Verlof",                      g:"geoorloofd",   ok:true},
  {c:"BIJ", n:"Bijzondere reden",            g:"geoorloofd",   ok:true},
  {c:"ING", n:"Ingehaalde les",              g:"geoorloofd",   ok:true},
  {c:"RIJ", n:"Rijexamen",                   g:"geoorloofd",   ok:true},
  {c:"VRS", n:"Vrijstelling",                g:"geoorloofd",   ok:true},
  {c:"GES", n:"Geschorst",                   g:"overig"},
  {c:"PRE", n:"Presentie",                   g:"aanwezig"},
  {c:"ONL", n:"Online",                      g:"aanwezig"},
  {c:"PRO", n:"Project",                     g:"aanwezig"},
  {c:"STA", n:"Stage",                       g:"aanwezig"},
  {c:"HUI", n:"Huiswerk vergeten",           g:"incident"},
  {c:"BOE", n:"Boeken vergeten",             g:"incident"},
  {c:"MOB", n:"Mobiel in de klas",           g:"incident"}
];
const SOORT = Object.fromEntries(SOORTEN.map(s=>[s.c,s]));
const soortNaam = c => (SOORT[c]||{n:c}).n;
const REDENEN = ["OV","Verslapen","Medisch","Overmacht","Privé","Anders"];
const REDENEN_CAL = ["Treinuitval","Wegafsluiting","Weer","Ongeluk onderweg","Familie","Anders"];
const redenLijst = groep => groep==="calamiteit" ? REDENEN_CAL : REDENEN;

/* ================= state ================= */
function standaardPeriodes(){
  return [{id:"p1",naam:"Periode 1",start:"2026-09-01",eind:"2026-11-06"},
          {id:"p2",naam:"Periode 2",start:"2026-11-09",eind:"2027-02-05"},
          {id:"p3",naam:"Periode 3",start:"2027-02-08",eind:"2027-04-23"},
          {id:"p4",naam:"Periode 4",start:"2027-04-26",eind:"2027-07-09"}];
}
function leegeState(){
  return {versie:2, roosters:{},
    instellingen:{schooljaar:"2026-2027", school:"Mediacollege Amsterdam", opleidingen:"MIP · MEP · MR",
      cbNaam:"", cbParaaf:"", cbEmail:"", lokaal:"2.17", verzuimbureauEmail:"", meldTijd:"08:30",
      klokuurPerRegistratie:1, periodes:standaardPeriodes(), klasMentoren:{}, mailteksten:{}, takenOpen:true, detailOpen:true, railOpen:false, demo:false},
    studenten:{}, registraties:[], meldafspraken:[], notities:[], mails:[], afhandelingen:{}, snapshots:[], lesreg:{},
    taken:[], taakAf:{}};
}
let S = null;
let UI = {view:"melden", periodeId:null, soort:"TEL", zoek:"", sel:0, laatste:null, laatsteStudent:null, volDossier:null, meldMoment:null, bulkSt:new Set(), stAlleenSignaal:false, stGroep:false, stOmgekeerd:false, roosterDag:null, roosterKlas:"", instSectie:"jij",
          stZoek:"", stKlas:"", stSort:"ladder", fltNiveau:"", fltSoort:"", fltKlas:"", fltAfgehandeld:false,
          drawer:null, bulk:new Set(), bulkDatum:null, bulkTijd:null};

/* ================= periodes ================= */
function periodes(){ return S.instellingen.periodes; }
function periodeById(id){ return periodes().find(p=>p.id===id)||null; }
const MAAND=["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
function kortDatum(d){ const x=new Date(d+"T12:00:00"); return x.getDate()+" "+MAAND[x.getMonth()]; }
function periodeVanDatum(d){ return periodes().find(p=> d>=p.start && d<=p.eind)||null; }
function huidigePeriode(){
  if(UI.periodeId){ const p=periodeById(UI.periodeId); if(p) return p; }
  const p=periodeVanDatum(vandaag()); if(p) return p;
  const t=periodes().filter(x=>x.start>vandaag()).sort((a,b)=>a.start<b.start?-1:1)[0];
  return t||periodes()[periodes().length-1];
}
function inPeriode(d,p){ return !!p && d>=p.start && d<=p.eind; }

/* ================= mentor ================= */
function klasMentorVan(st){
  const km = (S.instellingen.klasMentoren||{})[st && st.klas];
  return km ? {naam:km.naam||"", email:km.email||""} : {naam:"", email:""};
}
function mentorVan(st){
  if(!st) return {naam:"", email:"", soort:""};
  if(st.persoonlijkeMentor || st.persoonlijkeMentorEmail)
    return {naam:st.persoonlijkeMentor||"", email:st.persoonlijkeMentorEmail||"", soort:"persoonlijk"};
  const km = klasMentorVan(st);
  return (km.naam || km.email) ? {naam:km.naam, email:km.email, soort:"klas"} : {naam:"", email:"", soort:""};
}
function mentorSleutel(st){ const m=mentorVan(st); return (m.email||m.naam||"").toLowerCase(); }

/* ================= snapshots en tellingen ================= */
function snapshotsVan(pid){ return S.snapshots.filter(s=>s.periodeId===pid).sort((a,b)=>a.op<b.op?-1:1); }
function laatsteSnapshot(pid){ const l=snapshotsVan(pid); return l.length?l[l.length-1]:null; }
function vorigeSnapshot(pid){ const l=snapshotsVan(pid); return l.length>1?l[l.length-2]:null; }
function regVan(stamnr, pid, groep){
  const p=periodeById(pid);
  return S.registraties.filter(r=>r.stamnr===stamnr && inPeriode(r.datum,p) && (!groep || (SOORT[r.soort]||{}).g===groep));
}
function dagenUniek(lijst){ return Array.from(new Set(lijst.map(r=>r.datum))).sort(); }
function tellingen(stamnr, pid){
  const p=periodeById(pid), st=S.studenten[stamnr]||{};
  const teLaat = regVan(stamnr,pid,"telaat");
  const ongeoorloofdApp = dagenUniek(regVan(stamnr,pid,"ongeoorloofd")).length;
  const calamiteit = regVan(stamnr,pid,"calamiteit").length;
  const nietGemeld = S.meldafspraken.filter(m=>m.stamnr===stamnr && m.status==="niet-verschenen" && inPeriode(m.datum,p)).length;
  const snap=laatsteSnapshot(pid), rij=(snap&&snap.rijen&&snap.rijen[stamnr])||{};
  const tlMag=+rij.TL||0, on=+rij.ON||0, ge=+rij.GE||0, zk=+rij.ZK||0;
  const onMagister = Math.max(0, on - tlMag);
  const ls = S.lesreg[stamnr]||null;
  const ziekApp = dagenUniek(regVan(stamnr,pid,"ziek"));
  const ziekLes = ls ? ls.ziekDatums.filter(d=>inPeriode(d,p)) : [];
  const ziekDatums = Array.from(new Set(ziekApp.concat(ziekLes))).sort();
  const medApp = dagenUniek(regVan(stamnr,pid,"medisch"));
  const medLes = ls ? ls.medischDatums.filter(d=>inPeriode(d,p)) : [];
  const medDatums = Array.from(new Set(medApp.concat(medLes))).sort();
  const ongeoorloofd = Math.max(onMagister, ongeoorloofdApp);
  const klokurenExact = ls ? ls.onUren.filter(u=>inPeriode(u.datum,p)).reduce((a,u)=>a+u.uren,0) : null;
  const klokuren = klokurenExact!==null ? klokurenExact : ongeoorloofd*(+S.instellingen.klokuurPerRegistratie||1);
  return {teLaat:teLaat.length, teLaatLijst:teLaat, teLaatMagister:tlMag, nietGemeld, calamiteit,
          ongeoorloofd, ongeoorloofdApp, onMagister, geoorloofd:ge, ziekReg:zk,
          ziekDatums, medDatums, klokuren, klokurenExact:klokurenExact!==null,
          magisterOp:snap?snap.op:null, achttienMin:minderjarig(st)};
}
function langsteReeks(datums){
  if(!datums.length) return {lengte:0,reeks:[]};
  const s=datums.slice().sort(); let best=[s[0]], cur=[s[0]];
  for(let i=1;i<s.length;i++){
    const stap=volgendeSchooldag(s[i-1]);
    if(s[i]===stap||s[i]===plusDagen(s[i-1],1)) cur.push(s[i]); else cur=[s[i]];
    if(cur.length>best.length) best=cur.slice();
  }
  return {lengte:best.length, reeks:best};
}
function ziekIn8Weken(stamnr){
  const grens=plusDagen(vandaag(),-56);
  const set=new Set(S.registraties.filter(r=>r.stamnr===stamnr && (SOORT[r.soort]||{}).g==="ziek" && r.datum>=grens).map(r=>r.datum));
  const ls=S.lesreg[stamnr]; if(ls) ls.ziekDatums.filter(d=>d>=grens).forEach(d=>set.add(d));
  return set.size;
}
function klokurenLaatste4Weken(stamnr){
  const ls=S.lesreg[stamnr]; if(!ls) return null;
  const grens=plusDagen(vandaag(),-28);
  return ls.onUren.filter(u=>u.datum>=grens).reduce((a,u)=>a+u.uren,0);
}

/* ================= signaleringsmotor (verzuimprotocol 2026-2027) ================= */
function afh(key){ return S.afhandelingen[key]||null; }
function zetAfh(key,status,notitie){
  if(status===null) delete S.afhandelingen[key];
  else S.afhandelingen[key]={status, op:vandaag(), notitie:notitie||""};
  bewaar();
}
/* sleutelNr bepaalt de identiteit van een signaal. Voor de hoogste trede van een
   ladder is dat de werkelijke telling, niet de drempel: anders levert de zevende
   keer te laat dezelfde sleutel op als de zesde, en blijft die afgehandeld staan
   terwijl er opnieuw iets is gebeurd. */
function sig(stamnr,pid,soort,drempel,niveau,titel,maatregel,consequentie,mails,telling,sleutelNr){
  const nr = sleutelNr==null ? drempel : sleutelNr;
  return {key:stamnr+"|"+pid+"|"+soort+nr, stamnr, pid, soort, drempel, niveau, titel, maatregel,
    consequentie, mails:mails||[], telling, doorlopend: sleutelNr!=null};
}
/* ================= het protocol als gegevens =================
   Elke ladder telt iets (te laat, niet verschenen, ongeoorloofd …) en heeft treden: vanaf
   welk aantal, welk niveau (1 t/m 4, de kleur van de ladder), welke maatregel, welke mails
   en of er een meldafspraak volgt. De standaard is het verzuimprotocol MIP, MEP en MR
   2026-2027; de school kan het aanpassen op de Protocolpagina. De teksten mogen {meldtijd}
   bevatten. Een mail aan ouders vervalt vanzelf bij een meerderjarige student. */
const PROTOCOL_STANDAARD={
  naam:"Verzuimprotocol MIP, MEP en MR 2026-2027",
  niveaus:{1:"Registratie waarschuwing",2:"Dossiernotitie",3:"Formele waarschuwing",4:"Verzuimbureau / BBM"},
  werkwijze:{titel:"Werkwijze te laat komen", regels:[
    "Het lokaal is open van 8.50 tot 9.00 uur. Om 9 uur sluit de deur.",
    "De student meldt zich bij de CB'er en krijgt een te-laat-briefje met tijdstip, paraaf en reden.",
    "De CB'er registreert in Tardy en zet de student in Magister op **Te laat**.",
    "De student geeft het briefje af aan de docent.",
    "Aan het eind van de les haalt de CB'er de briefjes op bij de docenten.",
    "De docent registreert om 09:00 uur alle afwezigen als **ongeoorloofd afwezig**; de CB'er zet dat om naar **te laat** zodra de student zich meldt."]},
  ladders:[
    {id:"telaat", titel:"Herhaald te laat komen — per periode", teller:"telaat",
     intro:"De telling start per periode opnieuw; het jaartotaal blijft zichtbaar bij Studenten.",
     elkeKeer:{kort:"", maatregel:"Vanaf de derde keer te laat volgt een meldafspraak om {meldtijd} uur.", opPagina:false},
     treden:[
      {vanaf:3, niveau:1, label:"Registratie waarschuwing", kort:"Volgende schooldag {meldtijd} melden bij CB'er",
       maatregel:"Volgende schooldag {meldtijd} uur melden bij de CB'er. Kort gesprek over oorzaak, gevolg en verbeterafspraak; noteren in het logboek.",
       mails:["student-meldafspraak"], meldafspraak:true},
      {vanaf:4, niveau:2, label:"Dossiernotitie 1", kort:"Opnieuw melden + melding mentor",
       maatregel:"Opnieuw melden de volgende schooldag én melding aan de mentor.", mails:["mentor-telaat"], meldafspraak:true},
      {vanaf:5, niveau:3, label:"Formele waarschuwing + dossiernotitie 2", kort:"18−: ouders informeren · 18+: gesprek mentor of OM",
       maatregel:"Ouders/verzorgers informeren met een informatieve e-mail. De mentor stelt verbeterafspraken op en zet deze in Magister.",
       maatregel18:"Gesprek met de mentor of de opleidingsmanager. De mentor stelt verbeterafspraken op en zet deze in Magister.",
       mails:["ouders-telaat","mentor-verbeterafspraken"], meldafspraak:true},
      {vanaf:6, niveau:4, label:"Blijf Bij Ma-proces", kort:"Afspraak verzuimbureau, schriftelijk bevestigd",
       maatregel:"Afspraak maken met het verzuimbureau, schriftelijk bevestigd. De mentor start het BBM-proces binnen deze periode.",
       bijMeer:" Elke volgende keer te laat vraagt opnieuw om een melding.",
       mails:["verzuimbureau","mentor-bbm"], meldafspraak:true, doorlopend:true}]},
    {id:"nietgemeld", titel:"Niet verschenen bij de meldafspraak", teller:"nietgemeld", intro:"",
     treden:[
      {vanaf:1, niveau:2, label:"Dossiernotitie 1", kort:"Opnieuw melden volgende dag + melding mentor",
       maatregel:"Opnieuw melden de volgende schooldag én melding aan de mentor. Afspraak noteren in Magister.",
       mails:["mentor-nietgemeld","student-meldafspraak"]},
      {vanaf:2, niveau:3, label:"Formele waarschuwing + dossiernotitie 2", kort:"18−: ouders informeren + gesprek mentor",
       maatregel:"Ouders/verzorgers informeren + afspraak voor een gesprek met de mentor. De mentor legt verbeterafspraken vast in Magister.",
       maatregel18:"Afspraak voor een gesprek met de mentor of de opleidingsmanager. De mentor legt verbeterafspraken vast in Magister.",
       mails:["ouders-nietgemeld","mentor-verbeterafspraken"]},
      {vanaf:3, niveau:4, label:"Blijf Bij Ma-proces", kort:"Afspraak verzuimbureau, schriftelijk bevestigd",
       maatregel:"Afspraak verzuimbureau, schriftelijk bevestigd. Ouders/verzorgers worden uitgenodigd. De mentor start het BBM-proces binnen deze periode.",
       maatregel18:"Afspraak verzuimbureau, schriftelijk bevestigd. De mentor start het BBM-proces binnen deze periode.",
       mails:["verzuimbureau","mentor-bbm"], doorlopend:true}]},
    {id:"ongeoorloofd", titel:"Ongeoorloofd verzuim — per periode", teller:"ongeoorloofd", intro:"",
     elkeKeer:{kort:"Zelfde dag vóór 12:00 bellen, anders bericht via Teams",
       maatregel:"Bel vandaag vóór 12:00 uur en informeer de ouders/verzorgers. Achterhaal waarom de student verzuimt en noteer de reden.",
       maatregel18:"Bel vandaag vóór 12:00 uur. Achterhaal waarom de student verzuimt en noteer de reden.", opPagina:true},
     treden:[
      {vanaf:2, niveau:1, label:"Registratie waarschuwing", kort:"Volgende schooldag {meldtijd} melden bij de CB'er",
       maatregel:"Volgende schooldag {meldtijd} uur melden bij de CB'er.", mails:["student-meldafspraak"], meldafspraak:true},
      {vanaf:3, niveau:3, label:"Formele waarschuwing", kort:"Mentor stelt verbeterafspraken op in Magister",
       maatregel:"De mentor stelt verbeterafspraken op en zet deze in Magister. Ouders/verzorgers informeren. Betrek de begeleidingscoach als het verzuim met zorg samenhangt.",
       maatregel18:"De mentor stelt verbeterafspraken op en zet deze in Magister. Betrek de begeleidingscoach als het verzuim met zorg samenhangt.",
       mails:["ouders-ongeoorloofd-3","mentor-ongeoorloofd"]},
      {vanaf:4, niveau:4, label:"Blijf Bij Ma-proces", kort:"Nogmaals gesprek met de mentor",
       maatregel:"Nogmaals een gesprek met de mentor. De mentor start het BBM-proces binnen deze periode.", mails:["mentor-bbm"], doorlopend:true},
      {vanaf:15, teller:"klokuren", niveau:4, label:"Melding verzuimbureau / leerplicht", kort:"Gesprek met leerplicht",
       maatregel:"Gesprek met leerplicht. Verdere stappen verlopen via het verzuimbureau en de geldende wet- en regelgeving.",
       mails:["verzuimbureau-leerplicht"]},
      {vanaf:16, teller:"klokuren4w", alleenMinderjarig:true, niveau:4, label:"Verplichte melding leerplicht", kort:"18−: verplichte melding bij leerplicht",
       maatregel:"Student is jonger dan 18: melding bij leerplicht is verplicht bij 16 klokuren verzuim in 4 weken. Melden via het verzuimbureau.",
       mails:["verzuimbureau-leerplicht"]}]},
    {id:"calamiteit", titel:"Calamiteiten — per periode", teller:"calamiteit",
     intro:"Aanvulling op het verzuimprotocol, afgesproken binnen de opleiding.",
     elkeKeer:{kort:"Geoorloofd te laat", maatregel:"Telt als geoorloofd te laat en niet mee in de te-laat-ladder. Vanaf 4× in een periode volgt een gesprek.", opPagina:true},
     treden:[
      {vanaf:4, niveau:2, label:"Gesprek met de student", kort:"Gesprek met de student + melding mentor",
       maatregel:"Vier of meer keer te laat door een calamiteit in deze periode. Dit verzuim is geoorloofd, maar voer een gesprek met de student over wat er structureel speelt — reistijd, thuissituatie, route — en informeer de mentor.",
       mails:["mentor-calamiteit"], doorlopend:true}]},
    {id:"ziek", titel:"Ziekte", teller:"ziekReeks", intro:"",
     treden:[
      {vanaf:3, niveau:2, label:"Signaal mentor", kort:"Signaal aan de mentor",
       maatregel:"Signaal aan de mentor. De mentor neemt binnen 2 dagen contact op: informeren naar de situatie, ondersteuning bespreken, zicht houden op de studievoortgang. Korte notitie in Magister.",
       mails:["mentor-ziek"]},
      {vanaf:5, teller:"ziek8w", vergelijking:">", niveau:3, label:"Zorgoverleg", kort:"Zorgoverleg",
       maatregel:"Meer dan 5 ziekmeldingen in 8 schoolweken: zorgoverleg inplannen.", mails:["mentor-zorgoverleg"]}]},
    {id:"medisch", titel:"Medische afspraken onder lestijd", teller:"medisch", intro:"",
     treden:[
      {vanaf:3, vergelijking:">", niveau:1, label:"Signaal mentor", kort:"Signaal aan de mentor",
       maatregel:"Meer dan 3 dokters-/tandartsafspraken in één periode: signaal aan de mentor. De mentor beoordeelt of verdere actie wenselijk is.",
       mails:["mentor-medisch"]}]}
  ],
  extra:[{titel:"Blijf bij Ma (BBM)", tekst:"Het BBM-traject start bij zorgen over studievoortgang, aanwezigheid of gedrag. Drie gesprekken met bijbehorende brieven: met de mentor, met de mentor en een collega, en met de mentor en de opleidingsmanager. Bij elke brief hoort een gesprek, een plan van aanpak en een evaluatiedatum in Magister. Ouders van minderjarige studenten worden betrokken; bij meerderjarige studenten met toestemming. De volledige procedure staat bij 'weten en regelen'."}]
};
/* Wat er geteld kan worden. Dit ligt vast in de code; het protocol kiest eruit. */
const TELLERS={
  telaat:      {naam:"keer te laat",               waarde:(sn,pid,t)=>t.teLaat,        titel:w=>w+"× te laat",            label:(n,v)=>(v===">"?">":"")+n+"×"},
  nietgemeld:  {naam:"keer niet verschenen",       waarde:(sn,pid,t)=>t.nietGemeld,    titel:w=>w+"× niet gemeld om "+S.instellingen.meldTijd, label:(n,v)=>(v===">"?">":"")+n+"e"},
  ongeoorloofd:{naam:"keer ongeoorloofd",          waarde:(sn,pid,t)=>t.ongeoorloofd,  titel:w=>w+"× ongeoorloofd verzuim", label:(n,v)=>(v===">"?">":"")+n+"×"},
  klokuren:    {naam:"klokuren ongeoorloofd",      waarde:(sn,pid,t)=>t.klokuren,      rond:true,
                titel:(w,t)=>Math.round(w)+" klokuren ongeoorloofd"+(t.klokurenExact?"":" (schatting)"), label:(n,v)=>(v===">"?">":"")+n+" klokuren"},
  klokuren4w:  {naam:"klokuren in 4 weken",        waarde:sn=>klokurenLaatste4Weken(sn), rond:true,
                titel:w=>Math.round(w)+" klokuren in 4 weken", label:(n,v)=>(v===">"?">":"")+n+" u / 4 wkn"},
  calamiteit:  {naam:"keer calamiteit",            waarde:(sn,pid,t)=>t.calamiteit,    titel:w=>w+"× calamiteit",          label:(n,v)=>(v===">"?">":"")+n+"×"},
  ziekReeks:   {naam:"ziekdagen achter elkaar",    waarde:(sn,pid,t)=>langsteReeks(t.ziekDatums).lengte, titel:w=>w+" opeenvolgende schooldagen ziek", label:(n,v)=>(v===">"?">":"")+n+" dagen"},
  ziek8w:      {naam:"ziekmeldingen in 8 weken",   waarde:sn=>ziekIn8Weken(sn),        titel:w=>w+" ziekmeldingen in 8 schoolweken", label:(n,v)=>(v===">"?">":"")+n+" / 8 wkn"},
  medisch:     {naam:"medische afspraken",         waarde:(sn,pid,t)=>t.medDatums.length, titel:w=>w+" medische afspraken onder lestijd", label:(n,v)=>(v===">"?">":"")+n+" / periode"}
};
function protocol(){
  const p=S && S.instellingen && S.instellingen.protocol;
  return (p && Array.isArray(p.ladders) && p.ladders.length) ? p : PROTOCOL_STANDAARD;
}
function protocolLadder(id){ return protocol().ladders.find(l=>l.id===id)||null; }
function vulIn(tekst){ return String(tekst||"").split("{meldtijd}").join(S.instellingen.meldTijd||""); }
function tredeTeller(l,tr){ return tr.teller||l.teller; }
function tredeGehaald(w,tr){ return w!=null && (tr.vergelijking===">" ? w>tr.vanaf : w>=tr.vanaf); }
function tredeTekst(tr,min18){ return vulIn(min18===false && tr.maatregel18 ? tr.maatregel18 : tr.maatregel); }
function tredeMails(tr,min18){ return (tr.mails||[]).filter(m=>!(min18===false && (MAILSOORT[m]||{}).aan==="ouders")); }

function signalenVoor(stamnr, pid){
  const t=tellingen(stamnr,pid), st=S.studenten[stamnr]; if(!st) return [];
  const min18=t.achttienMin, out=[], waarden={};
  protocol().ladders.forEach(l=>{
    (l.treden||[]).forEach(tr=>{
      const tid=tredeTeller(l,tr), tel=TELLERS[tid]; if(!tel) return;
      if(tr.alleenMinderjarig && min18===false) return;
      if(!(tid in waarden)) waarden[tid]=tel.waarde(stamnr,pid,t);
      const w=waarden[tid]; if(!tredeGehaald(w,tr)) return;
      const telling=tel.rond?Math.round(w):w;
      const maatregel=tredeTekst(tr,min18)+(tr.bijMeer && telling>tr.vanaf ? vulIn(tr.bijMeer) : "");
      out.push(sig(stamnr,pid,l.id,tr.vanaf,tr.niveau,tel.titel(w,t),maatregel,tr.label,tredeMails(tr,min18),telling,
        tr.doorlopend?telling:undefined));
    });
  });
  out.forEach(x=>{ x.naam=naamVan(st); x.afgehandeld=afh(x.key); });
  return out;
}
/* Eén student staat per ladder op precies één trede: de hoogste die openstaat.
   De zwaardere maatregel omvat de lichtere — een afspraak met het verzuimbureau
   vervangt "meld je morgen om 8:30". De lagere treden blijven in het dossier
   bestaan, maar horen niet als losse taken in de werklijst. */
function hoogsteTreden(lijst){
  const per=new Map();
  lijst.forEach(s=>{
    const k=s.stamnr+"|"+s.soort;
    const b=per.get(k);
    if(!b || s.drempel>b.drempel) per.set(k, s);
  });
  const uit=[];
  per.forEach((s,k)=>{
    const lager=lijst.filter(x=>x.stamnr+"|"+x.soort===k && x.drempel<s.drempel);
    uit.push(Object.assign({}, s, {onderliggend:lager.length, onderliggendeKeys:lager.map(x=>x.key)}));
  });
  return uit;
}
function alleSignalen(pid){
  const out=[];
  Object.keys(S.studenten).forEach(sn=>{ if(!S.studenten[sn].archief) out.push.apply(out, signalenVoor(sn,pid)); });
  return out.sort((a,b)=> b.niveau-a.niveau || b.telling-a.telling || a.naam.localeCompare(b.naam,"nl"));
}
/* Een signaal afhandelen. De lichtere treden van dezelfde ladder gaan op in de zwaardere
   maatregel; anders duiken ze los weer op zodra deze is afgehandeld. Geeft terug hoeveel
   lichtere treden zijn meegenomen. */
function handelAf(key){
  zetAfh(key,"gedaan");
  const bij=alleSignalen(UI.periodeId).find(x=>x.key===key);
  let mee=0;
  if(bij) alleSignalen(UI.periodeId).forEach(x=>{
    if(x.stamnr===bij.stamnr && x.soort===bij.soort && x.drempel<bij.drempel && !x.afgehandeld){ zetAfh(x.key,"gedaan"); mee++; }
  });
  return mee;
}
function hoogsteNiveau(stamnr,pid){ const l=signalenVoor(stamnr,pid).filter(s=>!s.afgehandeld); return l.length?Math.max.apply(null,l.map(s=>s.niveau)):0; }

/* ================= mailteksten ================= */
const MAILSOORT = {
  "student-meldafspraak":     {aan:"student",label:"Mail student (meldafspraak)"},
  "ouders-telaat":            {aan:"ouders", label:"Mail ouders (te laat)"},
  "ouders-nietgemeld":        {aan:"ouders", label:"Mail ouders (niet gemeld)"},
  "ouders-ongeoorloofd":      {aan:"ouders", label:"Mail ouders (ongeoorloofd)"},
  "ouders-ongeoorloofd-3":    {aan:"ouders", label:"Mail ouders (3× ongeoorloofd)"},
  "mentor-telaat":            {aan:"mentor", label:"Melding mentor"},
  "mentor-nietgemeld":        {aan:"mentor", label:"Melding mentor"},
  "mentor-verbeterafspraken": {aan:"mentor", label:"Mentor: verbeterafspraken"},
  "mentor-ongeoorloofd":      {aan:"mentor", label:"Mentor: verbeterafspraken"},
  "mentor-bbm":               {aan:"mentor", label:"Mentor: start BBM"},
  "mentor-ziek":              {aan:"mentor", label:"Signaal mentor (ziekte)"},
  "mentor-zorgoverleg":       {aan:"mentor", label:"Mentor: zorgoverleg"},
  "mentor-medisch":           {aan:"mentor", label:"Signaal mentor (medisch)"},
  "verzuimbureau":            {aan:"bureau", label:"Mail verzuimbureau"},
  "verzuimbureau-leerplicht": {aan:"bureau", label:"Mail verzuimbureau (leerplicht)"},
  "mentor-overzicht":         {aan:"mentor", label:"Overzicht voor de mentor"},
  "mentor-calamiteit":        {aan:"mentor", label:"Signaal mentor (calamiteiten)"}
};
function ondertekening(){
  const i=S.instellingen;
  return "Met vriendelijke groet,\n\n"+(i.cbNaam||"[naam Community Builder]")+"\nCommunity Builder"+
    (i.school?" · "+i.school:"")+(i.cbEmail?"\n"+i.cbEmail:"");
}
function ontvanger(soort, st){
  if(soort==="ouders") return st.ouderEmail||"";
  if(soort==="mentor") return mentorVan(st).email||"";
  if(soort==="student") return st.email||"";
  return S.instellingen.verzuimbureauEmail||"";
}
function aanleidingZin(m, t){
  if(m && m.aanleidingTekst) return m.aanleidingTekst;
  const a = m ? m.aanleiding : "telaat";
  if(a==="ongeoorloofd") return "je "+(t.ongeoorloofd||2)+" keer ongeoorloofd afwezig bent geweest in deze periode";
  if(a==="nietgemeld") return "je de vorige meldafspraak niet bent nagekomen";
  if(a==="handmatig") return "we iets met je willen bespreken";
  return "je deze periode "+(t.teLaat||3)+" keer te laat bent gekomen";
}
function standaardMail(type, stamnr, pid, extra){
  const bewaard=S.instellingen.mailteksten; S.instellingen.mailteksten=null;
  try { return mailTekst(type, stamnr, pid, extra); } finally { S.instellingen.mailteksten=bewaard; }
}
function mailTekst(type, stamnr, pid, extra){
  const st=S.studenten[stamnr], t=tellingen(stamnr,pid), p=periodeById(pid), x=extra||{};
  const naam=naamVan(st), roep=st.roepnaam||naam, klas=st.klas||"", per=p?p.naam.toLowerCase():"deze periode";
  const mentor=mentorVan(st), mnaam=mentor.naam||"collega", i=S.instellingen, nm=naam+(klas?" ("+klas+")":"");
  let onderwerp="", body="";
  switch(type){
    case "student-meldafspraak": {
      const datum=x.datum||volgendeSchooldag(vandaag()), tijd=x.tijd||i.meldTijd;
      onderwerp="Meldafspraak "+langDatum(datum)+" om "+tijd+" uur";
      body="Hoi "+roep+",\n\nJe hebt een meldafspraak bij de Community Builder, omdat "+aanleidingZin(x.melding,t)+".\n\n"+
        "Wanneer:  "+langDatum(datum)+" om "+tijd+" uur\nWaar:     lokaal "+(i.lokaal||"2.17")+"\n\n"+
        "We bespreken kort wat er speelt en wat je nodig hebt om op tijd in de les te zijn. Daarna werk je tot de les begint aan je schoolwerk.\n\n"+
        "Kom je niet opdagen, dan volgt een melding aan je mentor en een notitie in Magister.\n\nTot dan.\n\n"+ondertekening();
      break; }
    case "ouders-telaat":
      onderwerp="Bericht over te laat komen – "+nm;
      body="Beste ouder(s)/verzorger(s),\n\nWij informeren u over het te laat komen van "+naam+". In "+per+" is "+roep+" "+t.teLaat+" keer te laat in de les gekomen.\n\n"+
        "Wat er tot nu toe is gebeurd:\n• Vanaf de derde keer te laat meldt "+roep+" zich de volgende schooldag om "+i.meldTijd+" uur bij de Community Builder in lokaal "+(i.lokaal||"2.17")+". Daar bespreken we de oorzaak en maken we een verbeterafspraak.\n"+
        "• De mentor is op de hoogte gebracht.\n\nWat de volgende stap is:\n• De mentor maakt verbeterafspraken met "+roep+" en legt die vast in Magister.\n"+
        "• Bij 6 keer te laat binnen deze periode volgt een afspraak met het verzuimbureau.\n\n"+
        "Wilt u dit thuis met "+roep+" bespreken? De les begint om 09:00 uur en om 09:00 uur gaat de deur dicht.\n\n"+
        "Speelt er iets waardoor op tijd komen lastig is? Laat het ons weten, dan kijken we samen wat er nodig is.\n\n"+ondertekening();
      break;
    case "ouders-nietgemeld":
      onderwerp="Bericht over gemiste meldafspraken – "+nm;
      body="Beste ouder(s)/verzorger(s),\n\n"+naam+" moest zich na te laat komen melden bij de Community Builder om "+i.meldTijd+" uur, maar is "+t.nietGemeld+" keer niet op die afspraak verschenen.\n\n"+
        "Wat er nu gebeurt:\n• "+roep+" meldt zich opnieuw de volgende schooldag om "+i.meldTijd+" uur.\n"+
        "• Er volgt een gesprek met de mentor; de afspraken daaruit worden vastgelegd in Magister.\n"+
        "• Bij een derde keer niet melden volgt een afspraak met het verzuimbureau, waarvoor u wordt uitgenodigd.\n\nU kunt op deze mail reageren.\n\n"+ondertekening();
      break;
    case "ouders-ongeoorloofd":
      onderwerp="Melding ongeoorloofde afwezigheid – "+nm;
      body="Beste ouder(s)/verzorger(s),\n\nWij hebben gemerkt dat "+naam+" op "+(x.datum?langDatum(x.datum):"een recente lesdag")+" ongeoorloofd afwezig was bij een of meer lessen. Wij houden dit nauwlettend in de gaten en informeren u daarom.\n\n"+
        "Wat u moet weten:\n• Bij aanhoudend of veelvuldig verzuim nemen wij contact op met de leerplichtambtenaar. Voor studenten onder de 18 jaar zijn wij daartoe verplicht bij 16 klokuren verzuim in 4 weken tijd.\n"+
        "• Na 3 keer ongeoorloofd verzuim binnen één periode volgt een gesprek met de mentor.\n\n"+
        "Is er iets aan de hand waardoor "+roep+" niet naar school komt? Neem gerust contact op.\n\n"+ondertekening();
      break;
    case "ouders-ongeoorloofd-3":
      onderwerp="Gesprek over ongeoorloofd verzuim – "+nm;
      body="Beste ouder(s)/verzorger(s),\n\n"+naam+" is in "+per+" "+t.ongeoorloofd+" keer ongeoorloofd afwezig geweest. Volgens ons verzuimprotocol volgt nu een gesprek met de mentor, waarin verbeterafspraken worden gemaakt. Die leggen wij vast in Magister.\n\n"+
        "Dit is een formele waarschuwing. Bij een vierde keer binnen deze periode start het Blijf-Bij-Ma-traject: een reeks gesprekken om te voorkomen dat "+roep+" de opleiding voortijdig verlaat.\n\n"+
        "Wij betrekken u graag bij dat gesprek; u kunt op deze mail reageren.\n\n"+ondertekening();
      break;
    case "mentor-telaat":
      onderwerp="Verzuimmelding: "+nm+" – "+t.teLaat+"× te laat";
      body="Hoi "+mnaam+",\n\n"+nm+" is in "+per+" "+t.teLaat+" keer te laat gekomen. Volgens het verzuimprotocol is dit een melding aan jou (dossiernotitie 1).\n\n"+
        roep+" meldt zich elke volgende schooldag om "+i.meldTijd+" uur bij mij zolang dit doorloopt.\n\n"+
        "Bij 5 keer te laat stel jij verbeterafspraken op en zet je die in Magister; bij 6 keer volgt het verzuimbureau en start je het BBM-proces binnen deze periode.\n\n"+ondertekening();
      break;
    case "mentor-nietgemeld":
      onderwerp="Verzuimmelding: "+nm+" – niet verschenen bij meldafspraak";
      body="Hoi "+mnaam+",\n\n"+nm+" is "+t.nietGemeld+" keer niet verschenen bij de meldafspraak van "+i.meldTijd+" uur. Ik heb contact gezocht en de afspraak als dossiernotitie in Magister gezet.\n\n"+
        "Volgens het protocol is dit een melding aan jou. Bij een tweede keer volgt een gesprek met jou en een formele waarschuwing.\n\n"+ondertekening();
      break;
    case "mentor-verbeterafspraken":
      onderwerp="Verbeterafspraken nodig: "+nm;
      body="Hoi "+mnaam+",\n\nVoor "+nm+" is de grens bereikt waarop jij verbeterafspraken opstelt en vastlegt in Magister.\n\n"+
        "Stand in "+per+":\n• Te laat: "+t.teLaat+"\n• Niet verschenen bij meldafspraak: "+t.nietGemeld+"\n• Ongeoorloofd verzuim: "+t.ongeoorloofd+"\n• Ziekmeldingen: "+t.ziekDatums.length+"\n\n"+
        "Dit telt als dossiernotitie 2 (formele waarschuwing). Wil je de afspraken en de evaluatiedatum in Magister zetten?\n\n"+ondertekening();
      break;
    case "mentor-ongeoorloofd":
      onderwerp="Verzuimmelding: "+nm+" – "+t.ongeoorloofd+"× ongeoorloofd";
      body="Hoi "+mnaam+",\n\n"+nm+" staat in "+per+" op "+t.ongeoorloofd+" keer ongeoorloofd verzuim. Volgens het protocol stel jij nu verbeterafspraken op en zet je die in Magister (formele waarschuwing).\n\n"+
        (t.achttienMin!==false?"Ik informeer de ouders/verzorgers.\n\n":"")+
        "Hangt het verzuim met zorg samen, dan betrekken we de begeleidingscoach. Bij een vierde keer start het BBM-proces binnen deze periode.\n\n"+ondertekening();
      break;
    case "mentor-bbm":
      onderwerp="Start BBM-proces: "+nm;
      body="Hoi "+mnaam+",\n\nVoor "+nm+" is het punt bereikt waarop het Blijf-Bij-Ma-proces start, binnen deze periode.\n\n"+
        "Aanleiding in "+per+":\n• Te laat: "+t.teLaat+"\n• Niet verschenen bij meldafspraak: "+t.nietGemeld+"\n• Ongeoorloofd verzuim: "+t.ongeoorloofd+"\n\n"+
        "Ik maak een afspraak met het verzuimbureau en bevestig die schriftelijk. Wil jij de eerste BBM-brief en het gesprek inplannen en de afspraken met de evaluatiedatum in Magister zetten?\n\n"+ondertekening();
      break;
    case "mentor-ziek":
      onderwerp="Signaal ziekteverzuim: "+nm;
      body="Hoi "+mnaam+",\n\n"+nm+" is "+(x.reeks||t.ziekDatums.length)+" opeenvolgende schooldagen ziekgemeld"+(x.datums?" ("+x.datums.map(dmy).join(", ")+")":"")+".\n\n"+
        "Volgens het verzuimprotocol geef ik dit aan jou door. Wil je binnen 2 dagen contact opnemen met "+roep+" om te informeren naar de situatie, ondersteuning te bespreken en zicht te houden op de studievoortgang? Een korte notitie in Magister is voldoende.\n\n"+ondertekening();
      break;
    case "mentor-zorgoverleg":
      onderwerp="Zorgoverleg aanvragen: "+nm;
      body="Hoi "+mnaam+",\n\n"+nm+" heeft "+(x.aantal||ziekIn8Weken(stamnr))+" ziekmeldingen in de afgelopen 8 schoolweken. Bij meer dan 5 in 8 schoolweken volgt zorgoverleg.\n\nZullen we dat inplannen? Ik lever de verzuimgegevens aan.\n\n"+ondertekening();
      break;
    case "mentor-calamiteit":
      onderwerp="Signaal: "+nm+" – "+t.calamiteit+"× te laat door een calamiteit";
      body="Hoi "+mnaam+",\n\n"+nm+" is in "+per+" "+t.calamiteit+" keer te laat gekomen door een calamiteit. Dat verzuim is geoorloofd en telt niet mee in de te-laat-ladder, maar vier keer of meer in één periode is voor ons een signaal.\n\n"+
        "Ik voer een gesprek met "+roep+" over wat er structureel speelt — reistijd, route, thuissituatie. Wil jij dit meenemen in je begeleiding? Als er iets is waar we mee kunnen helpen, hoor ik het graag.\n\n"+ondertekening();
      break;
    case "mentor-medisch":
      onderwerp="Signaal medische afspraken onder lestijd: "+nm;
      body="Hoi "+mnaam+",\n\n"+nm+" had in "+per+" "+t.medDatums.length+" dokters- en/of tandartsafspraken onder lestijd"+(t.medDatums.length?" ("+t.medDatums.map(dmy).join(", ")+")":"")+". Die gelden als geoorloofd verzuim.\n\n"+
        "Bij meer dan drie afspraken binnen één periode geef ik dit aan jou door. Jij beoordeelt of verdere actie wenselijk is. We stimuleren studenten deze afspraken buiten lestijd te plannen.\n\n"+ondertekening();
      break;
    case "verzuimbureau":
      onderwerp="Aanmelding verzuimbureau: "+nm+" ("+(st.stamnr||"")+")";
      body="Beste collega,\n\nGraag meld ik "+nm+", stamnummer "+(st.stamnr||"")+", aan voor een afspraak bij het verzuimbureau.\n\n"+
        "Stand in "+per+":\n• Te laat: "+t.teLaat+"\n• Niet verschenen bij meldafspraak: "+t.nietGemeld+"\n• Ongeoorloofd verzuim: "+t.ongeoorloofd+" registraties (circa "+Math.round(t.klokuren)+" klokuren"+(t.klokurenExact?"":", schatting")+")\n"+
        "• Leeftijd: "+(t.achttienMin===null?"onbekend":(t.achttienMin?"onder 18 jaar":"18 jaar of ouder"))+"\n\n"+
        "De stappen zijn vastgelegd in Magister. De mentor ("+mnaam+") start het BBM-proces binnen deze periode. Wil je een afspraak inplannen en schriftelijk bevestigen aan de student"+(t.achttienMin===false?"":" en de ouders/verzorgers")+"?\n\n"+ondertekening();
      break;
    case "verzuimbureau-leerplicht":
      onderwerp="Verzuimmelding leerplicht: "+nm+" ("+(st.stamnr||"")+")";
      body="Beste collega,\n\nVoor "+nm+", stamnummer "+(st.stamnr||"")+", is de grens voor een leerplichtmelding in beeld.\n\n"+
        "• Ongeoorloofd verzuim in "+per+": "+t.ongeoorloofd+" registraties, circa "+Math.round(t.klokuren)+" klokuren"+(t.klokurenExact?"":" (schatting op basis van de Magister-export)")+".\n"+
        "• Leeftijd: "+(t.achttienMin===null?"onbekend — graag verifiëren":(t.achttienMin?"onder 18 jaar":"18 jaar of ouder"))+"\n\n"+
        "Wil je beoordelen of melding bij de leerplichtambtenaar aan de orde is? De exacte klokuren zijn te verifiëren via het lesregistratieoverzicht in Magister.\n\n"+ondertekening();
      break;
    default: onderwerp="Verzuim: "+nm; body=ondertekening();
  }
  /* Eigen tekst uit Instellingen overschrijft de standaard. De plaatshouders hieronder
     zijn overal beschikbaar; de standaardtekst blijft de basis om van te beginnen. */
  const vul={
    naam, roepnaam:roep, klas, periode:per, mentor:mnaam,
    telaat:t.teLaat, ongeoorloofd:t.ongeoorloofd, calamiteit:t.calamiteit,
    nietgemeld:t.nietGemeld, ziek:t.ziekDatums.length, medisch:t.medDatums.length,
    datum:langDatum(x.datum||volgendeSchooldag(vandaag())), tijd:x.tijd||i.meldTijd,
    lokaal:i.lokaal||"", school:i.school||"", cb:i.cbNaam||"", ondertekening:ondertekening()
  };
  const eigen = S.instellingen.mailteksten ? (S.instellingen.mailteksten[type]||null) : null;
  if(eigen){
    const vervang=(txt)=>String(txt||"").replace(/\{(\w+)\}/g, (mm,k)=> k in vul ? String(vul[k]) : mm);
    if(eigen.onderwerp && eigen.onderwerp.trim()) onderwerp=vervang(eigen.onderwerp);
    if(eigen.body && eigen.body.trim()) body=vervang(eigen.body);
  }
  return {aan:ontvanger((MAILSOORT[type]||{aan:"mentor"}).aan, st), onderwerp, body, type, stamnr};
}

const NIVEAU_STANDAARD={1:"Registratie waarschuwing",2:"Dossiernotitie",3:"Formele waarschuwing",4:"Verzuimbureau / BBM"};
/* De namen van de vier niveaus komen uit het protocol; overal waar NIVEAUNAAM[n] staat. */
const NIVEAUNAAM={};
[1,2,3,4].forEach(k=>Object.defineProperty(NIVEAUNAAM, k, {enumerable:true,
  get:()=>((S && protocol().niveaus)||{})[k] || NIVEAU_STANDAARD[k]}));

function gevolgVan(soort, aantal, min18){
  // Alleen ladders die de registraties van deze soort zelf tellen (te laat, ongeoorloofd,
  // calamiteit); ziekte telt dagen achter elkaar en geeft bij het melden geen gevolg.
  const l=protocolLadder(soort); if(!l || l.teller!==soort) return {niveau:0, tekst:"", meld:false};
  const tr=(l.treden||[]).filter(x=>tredeTeller(l,x)===l.teller && !(x.alleenMinderjarig&&min18===false) && tredeGehaald(aantal,x))
    .sort((a,b)=>b.vanaf-a.vanaf)[0];
  if(tr) return {niveau:tr.niveau, tekst:tredeTekst(tr,min18), meld:!!tr.meldafspraak};
  return {niveau:0, tekst:l.elkeKeer?tredeTekst(l.elkeKeer,min18):"", meld:false};
}

function meldLijst(){
  return S.meldafspraken.filter(m=>m.status==="open" && S.studenten[m.stamnr])
    .sort((a,b)=> a.datum<b.datum?-1:a.datum>b.datum?1:naamVan(S.studenten[a.stamnr]).localeCompare(naamVan(S.studenten[b.stamnr]),"nl"));
}
const AANLEIDING={telaat:"Te laat", ongeoorloofd:"Ongeoorloofd verzuim", nietgemeld:"Niet gemeld", handmatig:"Handmatig"};

function briefjesHtml(lijst){
  const i=S.instellingen;
  const slips=lijst.map(b=>{
    const s=S.studenten[b.stamnr]||{};
    return '<div class="slip"><div class="hd"><span class="tl">'+esc(soortNaam(b.soort).toUpperCase())+'</span><span class="sch">'+esc(i.school||"")+"</span></div>"+
      '<div class="nm">'+esc(naamVan(s))+'</div><div class="kl">'+esc(s.klas||"")+" · "+esc(b.stamnr)+"</div>"+
      "<table><tr><th>Datum</th><td>"+esc(dmy(b.datum))+"</td></tr>"+
      "<tr><th>Gemeld om</th><td><b>"+esc(b.tijd||"")+"</b> uur bij de CB’er, lokaal "+esc(i.lokaal||"")+"</td></tr>"+
      "<tr><th>Reden</th><td>"+esc(b.reden||"…………………………")+"</td></tr>"+
      "<tr><th>Paraaf CB’er</th><td>"+esc(b.paraaf||"")+"</td></tr></table>"+
      '<div class="ft">Geef dit briefje af aan de docent. De docent levert het aan het eind van de les weer in bij de CB’er.</div></div>';
  }).join("");
  return "<!doctype html><html lang=nl><head><meta charset=utf-8><title>Briefjes</title><style>"+
    "@page{size:A4;margin:12mm}body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;color:#111}"+
    ".wrap{display:grid;grid-template-columns:1fr 1fr;gap:6mm}"+
    ".slip{border:1.2pt solid #111;border-radius:3mm;padding:5mm;height:78mm;display:flex;flex-direction:column;page-break-inside:avoid}"+
    ".hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1pt solid #111;padding-bottom:2mm}"+
    ".tl{font-size:14pt;font-weight:800;letter-spacing:.05em}.sch{font-size:8pt;text-transform:uppercase;letter-spacing:.08em}"+
    ".nm{font-size:14pt;font-weight:700;margin-top:4mm}.kl{font-size:9pt;color:#444;margin-bottom:3mm}"+
    "table{width:100%;border-collapse:collapse;font-size:10pt}th{text-align:left;font-weight:500;color:#555;width:30mm;padding:1.2mm 0;vertical-align:top}"+
    "td{padding:1.2mm 0}.ft{margin-top:auto;font-size:8pt;color:#555;border-top:.6pt solid #bbb;padding-top:2mm}"+
    "</style></head><body><div class=wrap>"+slips+"</div></body></html>";
}
/* ================= bonprinter: protocol =================
   Thermische printertjes uit de Tiny Print-familie (X5h, X6h, GT01 …) spreken
   het "51 78"-protocol. Elk pakket: 51 78, opdracht, 00, lengte (2 bytes, klein
   eind eerst), inhoud, CRC-8 over de inhoud (polynoom 0x07) en FF. Een regel is
   384 puntjes; per regel sturen we een run-lengtecodering als die korter is dan
   de ruwe bits. Afgeleid van TiMini Print (Apache 2.0) en rbaron/catprinter. */
const BON={breedte:384, snelheid:10, energie:8000, doorvoer:48, doorvoerKeer:2};
const CRC8=(()=>{ const t=new Uint8Array(256);
  for(let i=0;i<256;i++){ let c=i; for(let k=0;k<8;k++) c=(c&0x80)?((c<<1)^0x07)&0xFF:(c<<1)&0xFF; t[i]=c; }
  return t; })();
function crc8(bytes){ let c=0; for(let i=0;i<bytes.length;i++) c=CRC8[c^bytes[i]]; return c; }
function bonPakket(cmd, inhoud){
  const n=inhoud.length, uit=new Uint8Array(8+n);
  uit.set([0x51,0x78,cmd,0x00,n&0xFF,(n>>8)&0xFF]); uit.set(inhoud,6);
  uit[6+n]=crc8(inhoud); uit[7+n]=0xFF;
  return uit;
}
/* een regel als runs: bit 7 is de kleur (1 = zwart), bits 0-6 de lengte */
function bonRle(regel){
  const uit=[], run=(kleur,n)=>{ while(n>127){ uit.push((kleur<<7)|127); n-=127; } if(n>0) uit.push((kleur<<7)|n); };
  let vorige=regel[0], n=1;
  for(let i=1;i<regel.length;i++){ if(regel[i]===vorige) n++; else { run(vorige,n); vorige=regel[i]; n=1; } }
  run(vorige,n);
  return uit;
}
/* ruwe regel: het linker puntje is bit 0 */
function bonBits(regel){
  const uit=new Uint8Array(Math.ceil(regel.length/8));
  for(let i=0;i<regel.length;i++) if(regel[i]) uit[i>>3]|=1<<(i&7);
  return uit;
}
function bonOpdracht(pix, breedte, hoogte, opt){
  opt=Object.assign({zwarting:3, energie:BON.energie, tekst:true, snelheid:BON.snelheid, naSnelheid:null, doorvoerKeer:BON.doorvoerKeer}, opt||{});
  const delen=[], perRegel=Math.ceil(breedte/8);
  const P=(cmd,inhoud)=>delen.push(bonPakket(cmd, inhoud instanceof Uint8Array?inhoud:Uint8Array.from(inhoud)));
  P(0xA4,[0x30+Math.max(1,Math.min(5,opt.zwarting))]);   // zwarting 1-5
  P(0xAF,[opt.energie&0xFF,(opt.energie>>8)&0xFF]);      // energie van de printkop
  P(0xBE,[opt.tekst?1:0]);                               // tekst of afbeelding
  P(0xBD,[opt.snelheid]);
  for(let y=0;y<hoogte;y++){
    const regel=pix.subarray(y*breedte,(y+1)*breedte), rle=bonRle(regel);
    if(rle.length<=perRegel) P(0xBF,rle); else P(0xA2,bonBits(regel));
    if((y+1)%200===0) P(0xBD,[opt.snelheid]);
  }
  const na=opt.naSnelheid==null?opt.snelheid:opt.naSnelheid;
  P(0xBD,[na]);
  for(let i=0;i<opt.doorvoerKeer;i++) P(0xA1,[BON.doorvoer,0x00]);   // papier doorvoeren tot voorbij het scheurmes
  P(0xBD,[na]);
  P(0xA3,[0x00]);                                        // status opvragen: sluit de opdracht af
  let lengte=0; delen.forEach(d=>lengte+=d.length);
  const uit=new Uint8Array(lengte); let o=0; delen.forEach(d=>{ uit.set(d,o); o+=d.length; });
  return uit;
}
function naarBase64(bytes){ let s=""; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); return btoa(s); }

/* ================= bonprinter: het ontwerp =================
   Het briefje bestaat uit blokken die de gebruiker aan- en uitzet en in volgorde
   zet. Bovenaan staat altijd de kop (woordmerk, schoollogo, schoolnaam of niets). */
const BON_BLOKNAAM={student:"Student", tijd:"Tijdstip", ladder:"Escalatieladder", afspraak:"Meldafspraak",
  reden:"Reden", cb:"CB’er", handtekening:"Handtekeningen", voet:"Voettekst"};
const BON_BLOKUITLEG={student:"naam, klas en stamnummer", tijd:"hoe laat gemeld, met datum en lokaal",
  ladder:"hoe vaak deze periode en op welke trede", afspraak:"alleen als er een meldafspraak is gemaakt",
  reden:"de gekozen reden, of een lijn om op te schrijven", cb:"wie het briefje uitgaf",
  handtekening:"ruimte om te tekenen", voet:"een vaste tekst onderaan"};
const BON_STANDAARD={
  kop:"tardy", logo:"", logoZacht:false, soortTonen:true,
  blokken:[{id:"student",aan:true},{id:"tijd",aan:true},{id:"ladder",aan:false},{id:"afspraak",aan:false},
           {id:"reden",aan:true},{id:"cb",aan:true},{id:"handtekening",aan:false},{id:"voet",aan:true}],
  klas:true, stamnr:true, datum:true, lokaal:true, cbNaam:"paraaf",
  tekenDocent:true, tekenStudent:false, tekenCb:false,
  voettekst:"Geef dit briefje af aan de docent. De docent levert het aan het eind van de les in bij de CB’er.",
  grootte:"normaal"
};
function bonOntwerp(){
  const o=JSON.parse(JSON.stringify(Object.assign({}, BON_STANDAARD, S.instellingen.bonOntwerp||{})));
  // blokken die er later bij komen, verschijnen vanzelf (uit) onderaan
  o.blokken=(o.blokken||[]).filter(b=>BON_BLOKNAAM[b.id]);
  BON_STANDAARD.blokken.forEach(b=>{ if(!o.blokken.some(x=>x.id===b.id)) o.blokken.push({id:b.id, aan:false}); });
  return o;
}
function bonOntwerpZet(fn){ const o=bonOntwerp(); fn(o); S.instellingen.bonOntwerp=o; bewaar(); }

/* wat de ladder over deze registratie zegt, zoals het nu staat */
function bonInfo(reg){
  if(!S.studenten[reg.stamnr]) return null;
  const groep=(SOORT[reg.soort]||{}).g;
  if(["telaat","calamiteit","ongeoorloofd"].indexOf(groep)<0) return null;
  const per=periodeVanDatum(reg.datum)||huidigePeriode(), t=tellingen(reg.stamnr, per?per.id:UI.periodeId);
  const aantal=groep==="telaat"?t.teLaat:groep==="calamiteit"?t.calamiteit:t.ongeoorloofd;
  const g=gevolgVan(groep, aantal, t.achttienMin)||{niveau:0};
  const afspraak=S.meldafspraken.filter(m=>m.stamnr===reg.stamnr && m.status==="open" && m.datum>=reg.datum)
    .sort((x,y)=>x.datum<y.datum?-1:1)[0]||null;
  return {aantal, soort:groep, periode:per?per.naam:"", niveau:g.niveau||0, afspraak};
}
function bonVoorbeeldGegevens(){
  const i=S.instellingen;
  return {reg:{soort:"TEL", datum:vandaag(), tijd:"09:07", reden:"Bus had vertraging", paraaf:i.cbParaaf||"CB"},
          st:{roepnaam:"Voorbeeld", achternaam:"Student", klas:"KLAS1A", stamnr:"123456"},
          info:{aantal:4, soort:"telaat", periode:(huidigePeriode()||{naam:"Periode 1"}).naam, niveau:2,
                afspraak:{datum:volgendeSchooldag(vandaag()), tijd:i.meldTijd||"08:30"}}};
}
function laadBeeld(url){ return new Promise((ok,nee)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=nee; im.src=url; }); }
/* foto's en verlopen: Floyd-Steinberg, zodat grijs als stippelpatroon overkomt */
function bonRaster(ctx, b, h){
  const d=ctx.getImageData(0,0,b,h), g=new Float32Array(b*h);
  for(let k=0;k<b*h;k++) g[k]=0.299*d.data[k*4]+0.587*d.data[k*4+1]+0.114*d.data[k*4+2];
  for(let y=0;y<h;y++) for(let x=0;x<b;x++){
    const k=y*b+x, oud=g[k], nw=oud<128?0:255, fout=oud-nw; g[k]=nw;
    if(x+1<b) g[k+1]+=fout*7/16;
    if(y+1<h){ if(x>0) g[k+b-1]+=fout*3/16; g[k+b]+=fout*5/16; if(x+1<b) g[k+b+1]+=fout/16; }
  }
  for(let k=0;k<b*h;k++){ const v=g[k]<128?0:255; d.data[k*4]=d.data[k*4+1]=d.data[k*4+2]=v; }
  ctx.putImageData(d,0,0);
}

/* ================= bonprinter: het briefje tekenen =================
   Op 384 puntjes breed (48 mm bij 200 dpi) en daarna zuiver zwart-wit;
   grijs bestaat niet op thermisch papier. */
async function bonBeeld(reg, opt){
  opt=opt||{};
  const i=S.instellingen, o=opt.ontwerp||bonOntwerp(), st=opt.st||S.studenten[reg.stamnr]||{};
  const info=opt.info!==undefined?opt.info:bonInfo(reg);
  const f={compact:.86, normaal:1, groot:1.14}[o.grootte]||1, px=v=>Math.round(v*f);
  const W=BON.breedte, M=10, SYS='-apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif';
  try{ await document.fonts.load('700 44px "Arsenica"'); }catch(e){}
  const c=document.createElement("canvas"); c.width=W; c.height=2600;
  const x=c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,W,c.height); x.fillStyle="#000"; x.textBaseline="alphabetic";
  const font=(gewicht,grootte)=>{ x.font=gewicht+" "+px(grootte)+"px "+SYS; };
  const lijn=(y,dik)=>x.fillRect(M,y,W-2*M,dik||2);
  const label=(t,y)=>{ font(500,19); y+=px(22); x.fillText(t,M,y); return y; };
  const tekst=(t,gewicht,grootte,hoogte,y,breed)=>{        // woorden afbreken binnen de breedte
    font(gewicht,grootte); const max=breed||W-2*M; let regel="";
    String(t).split(/\s+/).filter(Boolean).forEach(w=>{ const probeer=regel?regel+" "+w:w;
      if(x.measureText(probeer).width>max && regel){ y+=px(hoogte); x.fillText(regel,M,y); regel=w; } else regel=probeer; });
    if(regel){ y+=px(hoogte); x.fillText(regel,M,y); }
    return y;
  };
  let y=M;

  // ---- kop ----
  const soort=o.soortTonen?soortNaam(reg.soort).toUpperCase():"";
  font(800,22); const soortB=soort?x.measureText(soort).width+16:0;
  const rechtsSoort=(yb)=>{ if(!soort) return; font(800,22); x.textAlign="right"; x.fillText(soort,W-M,yb); x.textAlign="left"; };
  if(o.kop==="logo" && o.logo){
    try{
      const im=await laadBeeld(o.logo), maxB=W-2*M-soortB, maxH=px(96);
      const sc=Math.min(maxB/im.width, maxH/im.height), b=Math.max(1,Math.round(im.width*sc)), h=Math.max(1,Math.round(im.height*sc));
      const t=document.createElement("canvas"); t.width=b; t.height=h;
      const tx=t.getContext("2d"); tx.fillStyle="#fff"; tx.fillRect(0,0,b,h); tx.drawImage(im,0,0,b,h);
      if(o.logoZacht) bonRaster(tx,b,h);
      x.drawImage(t,M,y); rechtsSoort(y+Math.round(h/2)+px(8)); y+=h+px(10);
    }catch(e){ y+=px(10); }
  } else if(o.kop==="school" && i.school){
    const yb=tekst(i.school,800,24,28,y,W-2*M-soortB); rechtsSoort(y+px(28)); y=yb+px(12);
  } else if(o.kop==="geen"){
    if(soort){ font(800,26); y+=px(28); x.fillText(soort,M,y); y+=px(12); }
  } else {
    x.font='700 '+px(44)+'px "Arsenica",Georgia,serif'; y+=px(38); x.fillText("tardy",M,y);
    rechtsSoort(y-px(4)); y+=px(12);
  }
  if(o.kop!=="geen" || soort){ lijn(y,4); y+=px(6); }

  // ---- blokken ----
  const soortWoord={telaat:"te laat", calamiteit:"calamiteit", ongeoorloofd:"ongeoorloofd"};
  const BLOK={
    student(y){
      y=tekst(naamVan(st)||"Onbekende student",700,34,38,y);
      const sub=[o.klas&&st.klas, o.stamnr&&st.stamnr].filter(Boolean).join("  ·  ");
      if(sub){ font(500,21); y+=px(28); x.fillText(sub,M,y); }
      return y;
    },
    tijd(y){
      y=label("gemeld om",y);
      font(800,76); y+=px(70); x.fillText(reg.tijd||"",M-3,y);
      const sub=[o.datum&&langDatum(reg.datum), o.lokaal&&i.lokaal&&"lokaal "+i.lokaal].filter(Boolean).join("  ·  ");
      if(sub){ font(500,20); y+=px(30); x.fillText(sub,M,y); }
      return y;
    },
    ladder(y){
      if(!info) return null;
      y=label("escalatieladder",y);
      y=tekst(info.aantal+"× "+(soortWoord[info.soort]||"")+(info.periode?" in "+info.periode.toLowerCase():""),700,25,30,y);
      // vier treden als vakjes, gevuld tot de huidige trede
      const vb=px(22), vh=px(28), gat=px(6), top=y+px(10);
      for(let k=0;k<4;k++){
        const vx=M+k*(vb+gat);
        x.fillRect(vx,top,vb,vh);
        if(k>=info.niveau){ x.fillStyle="#fff"; x.fillRect(vx+2,top+2,vb-4,vh-4); x.fillStyle="#000"; }
      }
      font(600,20);
      x.fillText(info.niveau?"trede "+info.niveau+" · "+(NIVEAUNAAM[info.niveau]||""):"nog geen trede", M+4*(vb+gat)+px(8), top+vh-px(7));
      return top+vh;
    },
    afspraak(y){
      const a=info&&info.afspraak; if(!a) return null;
      const top=y+px(8), pad=px(10);
      y=top+pad;
      font(700,17); y+=px(18); x.fillText("MELD JE BIJ DE CB’ER",M+pad,y);
      font(800,27); y+=px(33);
      x.fillText(a.datum===reg.datum?"vandaag":langDatum(a.datum),M+pad,y);
      font(600,21); y+=px(28);
      x.fillText(["om "+(a.tijd||i.meldTijd||""), i.lokaal&&"lokaal "+i.lokaal].filter(Boolean).join("  \u00b7  "),M+pad,y);
      y+=pad+px(4);
      // kader van 3 puntjes rondom
      x.fillRect(M,top,W-2*M,3); x.fillRect(M,y,W-2*M,3); x.fillRect(M,top,3,y-top); x.fillRect(W-M-3,top,3,y-top+3);
      return y+3;
    },
    reden(y){
      y=label("reden",y);
      if(reg.reden) return tekst(reg.reden,700,26,30,y);
      y+=px(38); lijn(y); return y+2;
    },
    cb(y){
      const naam=i.cbNaam||"", paraaf=reg.paraaf||i.cbParaaf||"";
      if(o.cbNaam==="paraaf"){ y=label("paraaf CB’er",y); font(700,26); x.fillText(paraaf,M+px(150),y+1); return y; }
      y=label("CB’er",y);
      return tekst(o.cbNaam==="beide"&&paraaf?(naam||"")+"  ("+paraaf+")":(naam||paraaf),700,24,29,y);
    },
    handtekening(y){
      const wie=[o.tekenDocent&&"docent", o.tekenStudent&&"student", o.tekenCb&&"CB’er"].filter(Boolean);
      if(!wie.length) return null;
      wie.forEach((w,k)=>{ if(k) y+=px(10); y=label("handtekening "+w,y); y+=px(58); lijn(y); y+=2; });
      return y;
    },
    voet(y){
      if(!String(o.voettekst||"").trim()) return null;
      y+=px(4); lijn(y); y+=2;
      return tekst(o.voettekst,500,18,23,y);
    }
  };
  o.blokken.filter(b=>b.aan && BLOK[b.id]).forEach(b=>{ const na=BLOK[b.id](y+px(14)); if(na!=null) y=na; });

  const H=Math.ceil(y+M+6);
  // zwart-wit: donkerder dan middengrijs wordt een puntje
  const data=x.getImageData(0,0,W,H).data, pix=new Uint8Array(W*H);
  for(let k=0;k<W*H;k++){ const q=k*4, l=0.299*data[q]+0.587*data[q+1]+0.114*data[q+2]; pix[k]=l<150?1:0; }
  // voorbeeldplaatje van precies wat er geprint wordt
  const v=document.createElement("canvas"); v.width=W; v.height=H;
  const vx=v.getContext("2d"), vd=vx.createImageData(W,H);
  for(let k=0;k<W*H;k++){ const g=pix[k]?34:255; vd.data[k*4]=g; vd.data[k*4+1]=g; vd.data[k*4+2]=g; vd.data[k*4+3]=255; }
  vx.putImageData(vd,0,0);
  return {pix, breedte:W, hoogte:H, url:v.toDataURL("image/png")};
}

function normaliseer(){
  S.instellingen=Object.assign(leegeState().instellingen, S.instellingen||{});
  if(!Array.isArray(S.instellingen.periodes)||!S.instellingen.periodes.length) S.instellingen.periodes=standaardPeriodes();
  if(!S.instellingen.klasMentoren) S.instellingen.klasMentoren={};
  ["registraties","meldafspraken","notities","mails","snapshots","taken"].forEach(k=>{ if(!Array.isArray(S[k])) S[k]=[]; });
  if(!S.taakAf) S.taakAf={};
  if(!S.studenten) S.studenten={}; if(!S.afhandelingen) S.afhandelingen={}; if(!S.lesreg) S.lesreg={};
  Object.values(S.studenten).forEach(st=>{
    if((st.mentor||st.mentorEmail) && !st.persoonlijkeMentor && !st.persoonlijkeMentorEmail){
      st.persoonlijkeMentor=st.mentor||null; st.persoonlijkeMentorEmail=st.mentorEmail||null;
    }
    delete st.mentor; delete st.mentorEmail;
  });
  S.registraties.forEach(r=>{ const g=(SOORT[r.soort]||{}).g;
    if((g==="telaat"||g==="calamiteit") && r.terug===undefined) r.terug=false; });
}

const kern = { H, UI, leegeState, normaliseer, SOORTEN, SOORT, soortNaam, REDENEN, REDENEN_CAL, redenLijst,
  periodes, periodeById, huidigePeriode, periodeVanDatum, inPeriode, tellingen, signalenVoor, alleSignalen, hoogsteTreden,
  handelAf, zetAfh, afh, hoogsteNiveau, protocol, protocolLadder, gevolgVan, mailTekst, MAILSOORT, mentorVan, mentorSleutel,
  naamVan, minderjarig, volgendeSchooldag, langDatum, kortDatum, dmy, plusDagen, vandaag, nuTijd, uid, esc, meldLijst,
  AANLEIDING, NIVEAUNAAM, briefjesHtml, bonBeeld, bonOpdracht, bonOntwerp, bonInfo, BON, langsteReeks, ondertekening, TELLERS,
  PROTOCOL_STANDAARD, NIVEAU_STANDAARD, tredeTeller, vulIn };
Object.defineProperty(kern, "S", { get: () => S, set: (v) => { S = v; } });
return kern;
})();
