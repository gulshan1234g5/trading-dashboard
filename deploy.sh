#!/bin/sh
# Build with the Pages base path and force-push dist to the gh-pages branch.
# Live site: https://gulshan1234g5.github.io/trading-dashboard/
set -e
cd "$(dirname "$0")"
# refresh live.json from the real engine output before every deploy
python3 /root/rlt/scripts/export_dashboard.py --out "$(pwd)/public/live.json"
npx vite build --base=/trading-dashboard/ --outDir dist
tmp=$(mktemp -d)
cp -r dist/. "$tmp"/
touch "$tmp"/.nojekyll
cd "$tmp"
git init -q && git checkout -q -b gh-pages
git add -A
git -c user.name="Gulshan Toppo" -c user.email="gulshan1234g5@gmail.com" commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
git push -q --force https://github.com/gulshan1234g5/trading-dashboard.git gh-pages:gh-pages
rm -rf "$tmp"
echo "deployed"
