#!/usr/bin/env bash
# Sync Hackathon proto-hub → ~/ProtoHub without wiping local draft data.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${PROTO_HUB_DIR:-$HOME/ProtoHub}"

mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude 'data/prototypes.json' \
  --exclude 'data/comments.json' \
  --exclude 'data/team-registry.json' \
  --exclude 'data/issue-reports.json' \
  "$SRC/" "$DEST/"

# Production Electron serves .next. drop the build so the next launch rebuilds fresh UI
rm -rf "$DEST/.next"

echo "Synced $SRC → $DEST (kept local data/*.json, cleared .next for rebuild)"
