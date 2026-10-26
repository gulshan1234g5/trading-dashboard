#!/bin/sh
# Build with the Pages base path and force-push dist to the gh-pages branch.
# Live site: https://gulshan1234g5.github.io/trading-dashboard/
set -e
cd "$(dirname "$0")"
# refresh live.json from the real engine output before every deploy
python3 /root/rlt/scripts/export_dashboard.py --out "$(pwd)/public/live.json"

# No-change guard: skip the build+push when the live data is identical to the
# last deployed snapshot. generated_at is stamped fresh by export_dashboard on
# every run, so it is excluded before hashing — otherwise the guard never fires.
# Pass "force" to bypass (bash deploy.sh force).
hash=$(python3 - public/live.json <<'PY'
import sys, json, hashlib
d = json.load(open(sys.argv[1]))
d.pop("generated_at", None)
print(hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest())
PY
)
if [ -f .live_deployed_hash ] && [ "$(cat .live_deployed_hash)" = "$hash" ] && [ "${1:-}" != "force" ]; then
    echo "no data change since last deploy - skipping"
    exit 0
fi

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
# record the snapshot hash only AFTER a successful build+push, so a failed
# deploy can never poison the guard into skipping future deploys
echo "$hash" > /root/dashboard/.live_deployed_hash
echo "deployed"
