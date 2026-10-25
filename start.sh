#!/bin/sh
# Start the gulshan-trading-command-center dev server in the background.
cd "$(dirname "$0")" || exit 1
nohup npm run dev -- --port 5173 > /tmp/opencode/dashboard-dev.log 2>&1 &
echo "dev server starting (pid $!), log: /tmp/opencode/dashboard-dev.log"
echo "on this device: http://localhost:5173"
