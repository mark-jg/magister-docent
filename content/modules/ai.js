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
      ta.value = ta.value
        .replace(/\b([A-Z][a-zà-ÿ]+)(?:\s+(?:van|de|der|den|le|du|te|ten)\s+)?(\s+[A-Z][a-zà-ÿ]+)+\b/g, "[naam]")
        .replace(/\b\d{5,8}\b/g, "[nummer]");
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
