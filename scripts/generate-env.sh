#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================
VAULT="AIBuilderDay"
# Only items whose 1Password title starts with this prefix go to the frontend.
# Backend secrets (anthropic-api-key, eagleview-api-key, etc.) live in the same
# vault but are loaded at runtime by `op run --env-file=backend/.env`.
ITEM_PREFIX="vite-"
# =============================================================================

ENV="${1:-local}"
FRONTEND_DIR="$(dirname "$0")/../frontend"

case "$ENV" in
    local) OUTFILE="$FRONTEND_DIR/.env.local" ;;
    prod)  OUTFILE="$FRONTEND_DIR/.env.prod" ;;
    *)
        echo "Usage: generate-env.sh [local|prod]"
        exit 1
        ;;
esac

echo "Generating $(basename "$OUTFILE") from 1Password vault: $VAULT (filter: ${ITEM_PREFIX}*)"

cat > "$OUTFILE" << EOF
# Environment: ${ENV}
# Source: 1Password/${VAULT} (items prefixed '${ITEM_PREFIX}')
# Generated: $(date)
# DO NOT COMMIT THIS FILE TO GIT

EOF

op item list --vault="$VAULT" --format json \
    | jq -r --arg prefix "$ITEM_PREFIX" '.[] | select(.title | startswith($prefix)) | .title' \
    | xargs -P 10 -I {} sh -c '
        TITLE="$1"
        VAR_NAME=$(echo "$TITLE" | tr "[:lower:]-" "[:upper:]_")
        VALUE=$(op read "op://'"$VAULT"'/${TITLE}/credential" 2>/dev/null) || {
            echo "⚠️  Failed to read ${TITLE}" >&2
            exit 0
        }
        if [ -n "$VALUE" ]; then
            echo "${VAR_NAME}=$VALUE"
        fi
    ' _ {} >> "$OUTFILE"

VAR_COUNT=$(grep -c '^[A-Z_]' "$OUTFILE" || echo "0")
echo "✅ Wrote $OUTFILE ($VAR_COUNT variables)"
