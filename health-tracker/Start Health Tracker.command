#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Health Tracker on http://localhost:8081"
echo "Press Ctrl+C to stop."
echo ""
open "http://localhost:8081"
python3 -m http.server 8081
