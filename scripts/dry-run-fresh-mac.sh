#!/usr/bin/env bash
# Simulate a brand-new Mac installing Team Proto Hub. without touching your real setup.
#
# Safe: uses ~/ProtoHub-dry-run and a sandbox .app only.
# Does NOT modify ~/ProtoHub or ~/Applications/Proto Hub.app
#
# Usage:
#   ./scripts/dry-run-fresh-mac.sh
#   ./scripts/dry-run-fresh-mac.sh --no-launch

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PROTO_HUB_DRY_RUN=1
export PROTO_HUB_APP_NAME="${PROTO_HUB_APP_NAME:-Team Proto Hub (dry-run)}"

echo ""
echo "════════════════════════════════════════════════════"
echo "  Team Proto Hub · fresh-Mac dry-run"
echo "  Real ~/ProtoHub stays untouched"
echo "════════════════════════════════════════════════════"
echo ""

cd "$ROOT"
node bin/proto-hub.js --dry-run "$@"
