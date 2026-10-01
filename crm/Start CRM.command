#!/bin/bash
# Double-click to start the CRM on a Mac.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Opening the download page — install it, then double-click this file again."
  open "https://nodejs.org"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
[ -d node_modules ] || npm install
(sleep 2 && open "http://localhost:3000") &
if [ -f .env ]; then npm start; else echo "No .env yet, so showing sample data."; npm run demo; fi
