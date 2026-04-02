#!/bin/bash
# Refresh social proof data from Google Sheets
# Usage: bash scripts/refresh-social-proof.sh
#
# Downloads both spreadsheets, re-classifies orgs, and rebuilds the proof pool.
# Takes about 30 seconds to run.

set -e

DATA_DIR="$(cd "$(dirname "$0")/../data" && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== PCI Social Proof Data Refresh ==="
echo ""

# ── 1. Download Project Results ─────────────────────────────────────────────
echo "[1/4] Downloading project results..."
curl -sL -o "$DATA_DIR/project-results.csv" \
  "https://docs.google.com/spreadsheets/d/1ZflQmozW_E-u0ZCeon11ejzmduyj9jP1/export?format=csv&gid=2147182971"
echo "  Downloaded: $(wc -l < "$DATA_DIR/project-results.csv") lines"

# ── 2. Download OHP Case Studies ────────────────────────────────────────────
echo "[2/4] Downloading OHP case studies..."
curl -sL -o "$DATA_DIR/project-case-studies.csv" \
  "https://docs.google.com/spreadsheets/d/1Qb8NVYFM_iBgYPC2aUKkSWGg-af513VSzOGDWaHmNbY/export?format=csv"
echo "  Downloaded: $(wc -l < "$DATA_DIR/project-case-studies.csv") lines"

# ── 3. Re-classify and rebuild proof pool ───────────────────────────────────
echo "[3/4] Classifying orgs and building proof pool..."
node "$SCRIPTS_DIR/rebuild-proof-pool.js"

# ── 4. Parse OHP case studies ───────────────────────────────────────────────
echo "[4/4] Parsing OHP case studies..."
node "$SCRIPTS_DIR/parse-ohp-cases.js"

echo ""
echo "=== Refresh complete ==="
echo "Files updated:"
echo "  $DATA_DIR/project-results.csv"
echo "  $DATA_DIR/project-case-studies.csv"
echo "  $DATA_DIR/org-classifications.json"
echo "  $DATA_DIR/proof-pool.json"
echo "  $DATA_DIR/ohp-case-studies.json"
echo ""
echo "The API server will pick up changes within 10 minutes (or restart to apply immediately)."
