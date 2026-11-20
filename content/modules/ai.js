/* AI-hulp: bouwt een prompt op basis van een tabel of de geselecteerde tekst,
 * kopieert die naar het klembord en opent je AI-assistent in een nieuw tabblad.
 * Er wordt niets automatisch verstuurd: jij bepaalt wat er in de prompt staat
 * en kunt namen eerst anonimiseren (knop "Namen maskeren").
 */
DT.register({
  id: "ai",

  providers: {
    claude: "https://claude.ai/new",
    chatgpt: "https://chatgpt.com/",
    copilot: "https://copilot.microsoft.com/"
  },

  templates: [
    { label: "Samenvatten", text: "Vat deze gegevens uit Magister kort samen voor een docent. Benoem opvallende punten." },
    { label: "Leerlingen die aandacht nodig hebben", text: "Analyseer deze gegevens en geef aan welke leerlingen (op basis van cijfers/absentie) extra aandacht nodig hebben, met een korte onderbouwing per leerling." },
    { label: "Mailtekst voor ouders/leerlingen", text: "Schrijf op basis van deze gegevens een korte, vriendelijke en professionele mail in het Nederlands. Geen em-dashes." },
    { label: "Logboek-/SLB-notitie", text: "Maak van deze aantekeningen een beknopte, feitelijke logboeknotitie voor Magister (max 5 zinnen)." },
    { label: "Eigen prompt", text: "" }
  ],

  init() {},

  open(DT, data) {
    const content = data || window.getSelection()?.toString().trim() || "";
    const dlg = DT.el("dialog", { id: "dt-ai-dialog", style: "border:0;border-radius:12px;padding:0;max-width:640px;width:92vw;font:14px var(--dt-font);color:var(--dt-fg);background:var(--dt-bg);box-shadow:var(--dt-shadow)" });
    const ta = DT.el("textarea", { style: "width:100%;box-sizing:border-box;min-height:180px;font:13px/1.4 var(--dt-font);border:1px solid var(--dt-line);border-radius:7px;padding:8px;background:var(--dt-bg);color:var(--dt-fg)", "aria-label": "Prompt" });
    const sel = DT.el("select", { class: "dt-btn", "aria-label": "Sjabloon" }, this.templates.map((t) => DT.el("option", { value: t.text, text: t.label })));
    const build = () => { ta.value = (sel.value ? sel.value + "\n\n" : "") + (content ? "Gegevens:\n" + content : ""); };
    sel.addEventListener("change", build); build();

    const mask = () => {
      // Maskeert waarschijnlijke namen (twee of meer woorden met hoofdletter achter elkaar) en leerlingnummers.
      ta.value = dtMaskeerNamen(ta.value);
      DT.toast("Namen en nummers gemaskeerd");
    };

    const go = async () => {
      await DT.copy(ta.value);
      const url = this.providers[DT.settings.ai.provider] || this.providers.claude;
      window.open(url, "_blank", "noopener");
      dlg.close(); dlg.remove();
    };

    dlg.append(
      DT.el("div", { class: "dt-panel-head" }, [DT.el("h2", { text: "Naar AI-assistent" }), DT.el("button", { class: "dt-btn dt-btn-sm", text: "Sluiten", onclick: () => { dlg.close(); dlg.remove(); } })]),
      DT.el("div", { style: "padding:14px 16px;display:flex;flex-direction:column;gap:10px" }, [
        DT.el("div", { class: "dt-row" }, [sel, DT.el("button", { class: "dt-btn", text: "Namen maskeren", onclick: mask })]),
        ta,
        DT.el("div", { style: "font-size:12px;color:var(--dt-muted)", text: "De prompt wordt gekopieerd naar je klembord en de assistent opent in een nieuw tabblad. Plak daar met Ctrl+V. Let op: deel geen herleidbare leerlinggegevens met externe diensten zonder dat dit volgens het schoolbeleid mag." }),
        DT.el("div", { class: "dt-row", style: "justify-content:flex-end" }, [
          DT.el("button", { class: "dt-btn", text: "Alleen kopiëren", onclick: () => DT.copy(ta.value) }),
          DT.el("button", { class: "dt-btn dt-btn-primary", text: "Kopiëren en openen", onclick: go })
        ])
      ])
    );
    document.body.append(dlg);
    dlg.showModal();
  }
});

/* Maskeert waarschijnlijke namen en leerlingnummers in een tekst.
 *  - voor- en achternaam, ook met tussenvoegsels (Jan de Vries, Sanne van der Berg), een koppelteken
 *    (Anne-Marie Bakker), een apostrof (Noah O'Brien) of letters met accenten (Zoë Çelik);
 *  - de schrijfwijze "Vries, Jan de";
 *  - een voor- of achternaam die elders in de tekst los terugkomt ("Jan was er niet");
 *  - getallen van 5 tot 8 cijfers (stamnummers).
 * Het blijft een hulpmiddel op basis van hoofdletters: een losse voornaam die nergens met achternaam staat wordt
 * niet herkend, en twee woorden met een hoofdletter achter elkaar (een schoolnaam) worden ook gemaskeerd. Lees de
 * tekst dus altijd na voor je hem deelt. */
function dtMaskeerNamen(tekst) {
  const W = "\\p{Lu}[\\p{L}'’]+(?:-\\p{Lu}[\\p{L}'’]+)*";   // woord met een hoofdletter, eventueel met koppelteken
  const TV = "(?:van|de|der|den|het|ter|te|ten|la|le|du|el|al|bin|ben|op|in|aan|uit|v\\.?d\\.?|'t)";
  const S = "[ \\u00A0]+";   // alleen spaties: een tab of regeleinde scheidt cellen, geen delen van een naam
  const VOL = new RegExp(`(?<![\\p{L}'’-])${W}(?:${S}(?:${TV}${S}){0,3}${W})+`, "gu");
  const OMGEKEERD = new RegExp(`(?<![\\p{L}'’-])${W},${S}${W}(?:${S}${TV})*(?![\\p{L}])`, "gu");
  const tvRe = new RegExp(`^${TV}$`, "iu"), delen = new Set();
  const onthoud = (m) => { for (const d of m.split(/[\s,]+/)) if (d.length > 2 && !tvRe.test(d)) delen.add(d); return "[naam]"; };
  let uit = String(tekst).replace(OMGEKEERD, onthoud).replace(VOL, onthoud);
  if (delen.size) {
    // De delen bestaan alleen uit letters, apostroffen en koppeltekens: er hoeft niets te worden ge-escaped.
    const los = new RegExp(`(?<![\\p{L}'’-])(?:${[...delen].sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}'’-])`, "gu");
    uit = uit.replace(los, "[naam]");
  }
  return uit.replace(/(?<!\d)\d{5,8}(?!\d)/g, "[nummer]");
}
