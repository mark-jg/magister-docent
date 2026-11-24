#!/usr/bin/env bash
# Rendert de afbeeldingen voor de Chrome Web Store uit de HTML-bestanden in deze map (headless Chrome).
#   store/maak.sh
# De schermafbeeldingen (bron-*.jpg) komen uit Magister, zonder namen van studenten; ze staan niet in git.
set -euo pipefail
cd "$(dirname "$0")"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
P="$(mktemp -d)"
for spec in "promo-klein 440 280" "promo-groot 1400 560" "scherm-opleidingen 1280 800" "scherm-lesregistraties 1280 800" "scherm-functies 1280 800"; do
  set -- $spec
  "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$P" \
    --allow-file-access-from-files --window-size="$2,$3" --screenshot="$PWD/$1.png" "file://$PWD/$1.html" >/dev/null 2>&1
  echo "$1.png"
done
rm -rf "$P"
# De store wil voor tegels en screenshots 24-bits PNG zonder alfakanaal.
python3 -c "
from PIL import Image
for n in ['promo-klein','promo-groot','scherm-opleidingen','scherm-lesregistraties','scherm-functies']:
    Image.open(n + '.png').convert('RGB').save(n + '.png')
"
# Pictogram voor de store: 128×128 met 96×96 beeld en 16 px lege rand (richtlijn van Google).
python3 - <<'PY'
from PIL import Image
im = Image.open("../icons/icon128.png").convert("RGBA").resize((96, 96), Image.LANCZOS)
uit = Image.new("RGBA", (128, 128), (0, 0, 0, 0)); uit.alpha_composite(im, (16, 16)); uit.save("store-icoon-128.png")
print("store-icoon-128.png")
PY
