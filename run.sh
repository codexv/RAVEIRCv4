#!/usr/bin/env bash
# RAVEIRC launcher.
#   ./run.sh         → development mode (hot-reload window)
#   ./run.sh build   → production build (.app + .dmg installer)
set -e

cd "$(dirname "$0")"

# Install JS deps on first run.
if [ ! -d node_modules ]; then
  echo "Installing dependencies…"
  npm install
fi

if [ "$1" = "build" ]; then
  echo "Building RAVEIRC (release)…"
  npm run tauri build
  echo
  echo "Done. Find the app + installer under:"
  echo "  src-tauri/target/release/bundle/"
else
  # Free the dev port if a previous run is still holding it.
  lsof -ti tcp:1420 2>/dev/null | xargs kill 2>/dev/null || true
  echo "Starting RAVEIRC (dev)…"
  npm run tauri dev
fi
