#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Finance Tracker on http://localhost:8080"
echo "Press Ctrl+C to stop."
echo ""
open "http://localhost:8080"
python3 -m http.server 8080
