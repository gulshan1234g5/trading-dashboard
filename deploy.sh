#!/bin/sh
# Build with the Pages base path and force-push dist to the gh-pages branch.
# Live site: https://gulshan1234g5.github.io/trading-dashboard/
set -e
cd "$(dirname "$0")"
# refresh live.json from the real engine output before every deploy
python3 /root/rlt/scripts/export_dashboard.py --out "$(pwd)/public/live.json"

# No-change guard: skip the build+push when the live data is identical to the
# last deployed snapshot. Pass "force" to bypass (bash deploy.sh force).
hash=$(sha256sum public/live.json | cut -d' ' -f1)
if [ -f .live_deployed_hash ] && [ "$(cat .live_deployed_hash)" = "$hash" ] && [ "${1:-}" != "force" ]; then
    echo "no data change since last deploy - skipping"
    exit 0
fi
echo "$hash" > .live_deployed_hash

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
