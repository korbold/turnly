#!/usr/bin/env bash
# Round 2 patches — fixes things the broad sed couldn't catch.
# Run from Turnly repo root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_SRC="$ROOT/apps/admin-v2/src"

sed_inplace() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

echo "▸ Round 2 — non-indigo brand-y colors that should be coral"
echo

# upcoming-reservations: sky-500 calendar icon → coral (decorative, not semantic)
F1="$ADMIN_SRC/presentation/components/features/dashboard/upcoming-reservations.tsx"
if [ -f "$F1" ]; then
  sed_inplace -e 's|<CalendarCheck className="h-4 w-4 text-sky-500" />|<CalendarCheck className="h-4 w-4 text-[var(--color-primary)]" />|' "$F1"
  echo "  ✓ upcoming-reservations.tsx — title icon → coral"
fi

# Quick scan for any other lingering primary-as-non-coral cases.
echo
echo "▸ Quick lint — any remaining indigo/sky/non-brand accents in admin-v2:"
echo

grep -rn --include='*.tsx' --include='*.ts' \
  -E 'text-(indigo|sky|cyan)-[0-9]+|bg-(indigo|sky|cyan)-[0-9]+|border-(indigo|sky|cyan)-[0-9]+' \
  "$ADMIN_SRC" || echo "  (none found — clean)"

echo
echo "✓ Round 2 done."
