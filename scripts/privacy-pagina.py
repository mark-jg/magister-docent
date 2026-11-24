"""Maakt docs/privacy.html (GitHub Pages) uit PRIVACY.md. Gebruik: python3 scripts/privacy-pagina.py
Daarna committen en pushen; de pagina staat dan op https://mark-jg.github.io/magister-docent/privacy.html"""
import re, html, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
md = (root / "PRIVACY.md").read_text().splitlines()
out, inlist = [], False
def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    return re.sub(r"`(.+?)`", r"<code>\1</code>", t)
for l in md:
    if l.startswith("- "):
        if not inlist: out.append("<ul>"); inlist = True
        out.append(f"<li>{inline(l[2:])}</li>"); continue
    if inlist: out.append("</ul>"); inlist = False
    if l.startswith("# "): out.append(f"<h1>{inline(l[2:])}</h1>")
    elif l.startswith("## "): out.append(f"<h2>{inline(l[3:])}</h2>")
    elif l.strip(): out.append(f"<p>{inline(l)}</p>")
if inlist: out.append("</ul>")
oud = (root / "docs/privacy.html").read_text()
kop, rest = oud.split("<main>\n", 1)
(root / "docs/privacy.html").write_text(kop + "<main>\n" + "\n".join(out) + "\n</main>" + rest.split("</main>", 1)[1])
print("docs/privacy.html bijgewerkt")
