#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR="$(dirname "$0")/../frontend"
VAULT="AIBuilderDay"

ENV="${1:-local}"

case "$ENV" in
  local)
    OUTFILE="$FRONTEND_DIR/.env.local"
    ;;
  prod)
    OUTFILE="$FRONTEND_DIR/.env.prod"
    ;;
  *)
    echo "Usage: populate-env.sh [local|prod]"
    exit 1
    ;;
esac

if ! command -v op &>/dev/null; then
  echo "Error: 1Password CLI (op) not installed"
  exit 1
fi

echo "Fetching all items from 1Password vault '$VAULT'..."

ITEMS=$(op item list --vault "$VAULT" --format json)
TITLES=$(echo "$ITEMS" | python3 -c "
import json, sys
for item in json.load(sys.stdin):
    print(item['title'])
")

> "$OUTFILE"

while IFS= read -r title; do
  [[ -z "$title" ]] && continue
  VAR_NAME=$(echo "$title" | tr '[:lower:]-' '[:upper:]_')
  VALUE=$(op read "op://$VAULT/$title/credential" 2>/dev/null) || {
    echo "  Skipping '$title' (no credential field)"
    continue
  }
  echo "$VAR_NAME=$VALUE" >> "$OUTFILE"
  echo "  $VAR_NAME=***"
done <<< "$TITLES"

echo "Wrote $OUTFILE"
