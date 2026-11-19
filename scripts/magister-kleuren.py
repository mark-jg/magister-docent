#!/usr/bin/env python3
"""Maakt content/modules/theme-magisterkleuren.js: alle plekken waar Magisters eigen stijlbladen een vast
Magister-blauw gebruiken, zodat een thema ze kan overnemen met gewone CSS (zie dtMagisterKleurenCss in theme.js).

Magister kleurt op zijn oudere schermen veel pictogrammen, knoppen, randen en vlakken met vaste kleuren in plaats van
met de variabelen van het designsysteem; die gaan anders niet mee met een thema of accentkleur.

Gebruik (na een update van Magister, als er weer blauw doorschemert):
    python3 -I scripts/magister-kleuren.py [https://school.magister.net]

Leest alleen de openbare stijlbladen van de inlogpagina's (geen inlog, geen leerlinggegevens).
"""
import colorsys, json, pathlib, re, sys, urllib.request

BASIS = (sys.argv[1] if len(sys.argv) > 1 else "https://mediacollege.magister.net").rstrip("/")
APPS = ["op", "op-leerlingen", "op-detailkaarten", "magister-lvs", "magister-berichten"]
UIT = pathlib.Path(__file__).resolve().parent.parent / "content" / "modules" / "theme-magisterkleuren.js"

def haal(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "ignore")

def kleur(v):
    """(r, g, b) uit #abc, #aabbcc of rgb(a)(…); None als het geen vaste kleur is."""
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if m:
        h = m.group(1)
        if len(h) == 3: h = "".join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+[\d.]+%?)?\s*\)", v)
    return tuple(int(x) for x in m.groups()) if m else None

def tint(rgb):
    """Magister-blauw? Dan de trede (1 = heel licht … 5 = donker), anders None."""
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    if not (190 <= h * 360 <= 225 and s > 0.4): return None
    return 1 if l > .88 else 2 if l > .75 else 3 if l > .55 else 5 if l < .3 else 4

SOORT = {"color": "tekst", "fill": "tekst", "stroke": "tekst", "background-color": "vlak", "background": "vlak", "outline-color": "rand"}
PSEUDO = re.compile(r"(::?(?:before|after|placeholder|selection|first-letter|first-line|marker|-webkit-[a-z-]+|-moz-[a-z-]+))$")

def delen(sel):
    """Splitst een selectorlijst op komma's, maar niet binnen haakjes (:not(a, b), [attr="a,b"])."""
    uit, diep, stuk, aanh = [], 0, "", ""
    for c in sel:
        if aanh: aanh = "" if c == aanh else aanh
        elif c in "\"'": aanh = c
        elif c in "([": diep += 1
        elif c in ")]": diep -= 1
        if c == "," and diep == 0 and not aanh: uit.append(stuk); stuk = ""
        else: stuk += c
    return uit + [stuk]

def regels(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        sel = sel.strip()
        if not sel or "@" in sel or re.match(r"^(from|to|\d+(\.\d+)?%)", sel): continue   # @font-face, @keyframes
        for decl in body.split(";"):
            if ":" not in decl: continue
            prop, val = (x.strip().lower() for x in decl.split(":", 1))
            val = val.replace("!important", "").strip()
            if prop in SOORT:
                doel, soort = (prop if prop != "background" else "background-color"), SOORT[prop]
            elif re.fullmatch(r"border(-(top|right|bottom|left))?(-color)?", prop):
                doel, soort = (prop if prop.endswith("-color") else prop + "-color"), "rand"
                val = next((w for w in re.findall(r"#[0-9a-f]{3,6}\b|rgba?\([^)]*\)", val)), val)   # "1px solid #0096db"
            else: continue
            rgb = kleur(val)
            t = rgb and tint(rgb)
            if not t: continue
            for s in delen(sel):
                s = " ".join(s.split())
                if not s or "::-webkit-scrollbar" in s: continue
                m = PSEUDO.search(s)
                kern, pseudo = (s[:m.start()], m.group(1)) if m else (s, "")
                if not kern or PSEUDO.search(kern) or "::" in kern: continue
                yield f"{doel}|{soort}{t}|{pseudo}", kern

def main():
    groepen, bronnen = {}, []
    for app in APPS:
        pagina = haal(f"{BASIS}/{app}/")
        for href in dict.fromkeys(re.findall(r'href="([^"]+\.css)[^"]*"', pagina)):
            if href.startswith("//") or href.startswith("http"): continue
            css = haal(f"{BASIS}/{app}/{href}")
            n = 0
            for sleutel, sel in regels(css):
                groepen.setdefault(sleutel, {})[sel] = 1; n += 1
            naam = re.sub(r"[.-][0-9A-Za-z]{8,}(?=[.]css)", "", href)   # zonder het versienummer in de bestandsnaam
            bronnen.append(app + "/" + naam + ": " + str(n))
    data = {k: ",".join(v) for k, v in sorted(groepen.items())}
    totaal = sum(len(v) for v in groepen.values())
    UIT.write_text(
        "/* Gegenereerd door scripts/magister-kleuren.py; niet met de hand bewerken.\n"
        " * Plekken waar Magisters eigen stijlbladen een vast Magister-blauw gebruiken, gegroepeerd per\n"
        " * \"eigenschap|soort+trede|pseudo-element\" (trede 1 = heel licht … 5 = donker). theme.js maakt hier CSS van\n"
        " * in de kleuren van het thema.\n"
        f" * Bronnen ({totaal} selectors): {'; '.join(bronnen)}. */\n"
        "const DT_MAGISTER_KLEUREN = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"{UIT.name}: {len(data)} groepen, {totaal} selectors, {UIT.stat().st_size // 1024} KB")
    for b in bronnen: print("  " + b)

main()
