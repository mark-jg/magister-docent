#!/usr/bin/env bash
# Zip voor de Chrome Web Store bouwen: scripts/webstore-zip.sh
# Draait eerst de linter en de tests, en laat alles weg wat niet in de extensie hoort (tests, scripts, node_modules,
# package.json). Zonder package.json ziet de extensie zichzelf niet als ontwikkelversie (geen label DEV).
# De zip upload je in het Developer Dashboard: https://chrome.google.com/webstore/devconsole
set -euo pipefail
cd "$(dirname "$0")/.."

V="$(node -p "require('./manifest.json').version")"
[ -z "$(git status --porcelain)" ] || echo "Let op: er zijn niet-gecommitte wijzigingen; die gaan mee in de zip."
npm run -s check >/dev/null || { echo "De linter of een test faalt: draai 'npm run check'."; exit 1; }

D="$(node -p "require('./manifest.json').description.length")"
[ "$D" -le 132 ] || { echo "De beschrijving in manifest.json is $D tekens; de Web Store staat er maximaal 132 toe."; exit 1; }

rm -rf dist && mkdir -p dist/pakket
rsync -a ./ dist/pakket/ \
  --exclude .git --exclude .github --exclude scripts --exclude dist --exclude tests \
  --exclude node_modules --exclude package.json --exclude package-lock.json --exclude eslint.config.js \
  --exclude .gitignore --exclude '.DS_Store' --exclude README.md --exclude PRIVACY.md --exclude WEBSTORE.md
(cd dist/pakket && zip -qr "../docentdeck-v$V.zip" .)
rm -rf dist/pakket
ls -l "dist/docentdeck-v$V.zip"
