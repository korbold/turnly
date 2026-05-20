#!/usr/bin/env bash
# Turnly Design System — apply patches to apps/admin-v2 and apps/customer_v2
#
# Run from the Turnly repo root (where apps/ lives).
# Assumes this script lives next to a `patches/` folder mirroring app/* paths.
#
# What it does:
#   1) Copies pre-built replacement files (tokens, theme, components)
#   2) Runs find/replace for hardcoded indigo Tailwind classes → CSS vars
#   3) Touches a few special files (route groups with parens, Recharts hex)
#
# Idempotent: safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCHES="$SCRIPT_DIR"

if [ ! -d "$ROOT/apps/admin-v2" ] || [ ! -d "$ROOT/apps/customer_v2" ]; then
  echo "✗ Run this from the Turnly monorepo root (must contain apps/admin-v2 and apps/customer_v2)"
  exit 1
fi

echo "▸ Step 1/3 — copying replacement files"
echo

copy_file() {
  local rel="$1"
  local src_rel="${rel#apps/}"
  local src="$PATCHES/$src_rel"
  local dest="$ROOT/$rel"
  if [ ! -f "$src" ]; then
    echo "  ✗ missing patch: $src"
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "  ✓ $1"
}

copy_file "apps/admin-v2/src/presentation/styles/globals.css"
copy_file "apps/admin-v2/src/shared/constants/colors.ts"
copy_file "apps/customer_v2/lib/app/theme/app_colors.dart"
copy_file "apps/customer_v2/lib/app/theme/app_typography.dart"
copy_file "apps/customer_v2/lib/app/theme/app_theme.dart"
copy_file "apps/customer_v2/lib/features/explore/presentation/widgets/business_card.dart"
copy_file "apps/customer_v2/lib/features/explore/presentation/widgets/next_reservation_card.dart"

echo
echo "▸ Step 2/3 — replacing hardcoded indigo Tailwind classes in admin-v2"
echo

# Cross-platform sed in-place (BSD sed needs an empty arg for -i)
sed_inplace() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

ADMIN_SRC="$ROOT/apps/admin-v2/src"

# Order matters: longer patterns first so shorter ones don't overshadow them.
# Background fills
find "$ADMIN_SRC" -type f \( -name "*.tsx" -o -name "*.ts" \) -print0 | while IFS= read -r -d '' f; do
  sed_inplace -e 's|bg-indigo-600|bg-[var(--color-primary)]|g' \
              -e 's|bg-indigo-700|bg-[var(--color-primary-hover)]|g' \
              -e 's|bg-indigo-500|bg-[var(--color-primary)]|g' \
              -e 's|bg-indigo-100|bg-[var(--color-primary-muted)]|g' \
              -e 's|bg-indigo-50|bg-[var(--color-primary-muted)]|g' \
              -e 's|text-indigo-700|text-[var(--color-primary-hover)]|g' \
              -e 's|text-indigo-600|text-[var(--color-primary)]|g' \
              -e 's|text-indigo-500|text-[var(--color-primary)]|g' \
              -e 's|text-indigo-900|text-[var(--color-text-primary)]|g' \
              -e 's|text-indigo-100|text-white/90|g' \
              -e 's|border-indigo-600|border-[var(--color-primary)]|g' \
              -e 's|border-indigo-500|border-[var(--color-primary)]|g' \
              -e 's|border-indigo-300|border-[var(--color-primary)]/40|g' \
              -e 's|border-indigo-200|border-[var(--color-primary)]/20|g' \
              -e 's|hover:bg-indigo-700|hover:bg-[var(--color-primary-hover)]|g' \
              -e 's|hover:bg-indigo-50|hover:bg-[var(--color-primary-muted)]|g' \
              -e 's|hover:text-indigo-500|hover:text-[var(--color-primary-hover)]|g' \
              -e 's|hover:border-indigo-300|hover:border-[var(--color-primary)]/40|g' \
              -e 's|ring-indigo-600|ring-[var(--color-primary)]|g' \
              -e 's|ring-indigo-500|ring-[var(--color-primary)]|g' \
              -e 's|ring-indigo-200|ring-[var(--color-primary)]/20|g' \
              -e 's|focus:ring-indigo-500|focus:ring-[var(--color-primary)]|g' \
              -e 's|fill-indigo-600|fill-[var(--color-primary)]|g' \
              -e 's|shadow-indigo-200|shadow-[var(--color-primary)]/20|g' \
              "$f"
done
echo "  ✓ tailwind class replacements done"

# Recharts / SVG inline hex defaults
find "$ADMIN_SRC" -type f \( -name "*.tsx" -o -name "*.ts" \) -print0 | while IFS= read -r -d '' f; do
  sed_inplace -e "s|'#4F46E5'|'#F2693A'|g" \
              -e 's|"#4F46E5"|"#F2693A"|g' \
              "$f"
done
echo "  ✓ #4F46E5 → #F2693A in charts/SVG"

# layout.tsx — Inter font swap to Roboto
LAYOUT="$ADMIN_SRC/presentation/app/layout.tsx"
if [ -f "$LAYOUT" ]; then
  sed_inplace \
    -e 's|import { Inter } from "next/font/google";|import { Roboto } from "next/font/google";|' \
    -e 's|const inter = Inter({|const roboto = Roboto({|' \
    -e 's|variable: "--font-inter",|variable: "--font-roboto", weight: ["400","500","600","700","800"],|' \
    -e 's|themeColor: "#4F46E5",|themeColor: "#F2693A",|' \
    -e 's|\${inter\.className} \${inter\.variable}|${roboto.className} ${roboto.variable}|' \
    "$LAYOUT"
  echo "  ✓ layout.tsx — Roboto + theme color"
fi

# status.ts — in_progress should be coral
STATUS="$ADMIN_SRC/shared/constants/status.ts"
if [ -f "$STATUS" ]; then
  sed_inplace \
    -e "s|color: 'text-indigo-600'|color: 'text-[var(--color-primary)]'|g" \
    -e "s|bgColor: 'bg-indigo-50'|bgColor: 'bg-[var(--color-primary-muted)]'|g" \
    -e "s|dotColor: 'bg-indigo-500'|dotColor: 'bg-[var(--color-primary)]'|g" \
    "$STATUS"
  echo "  ✓ status.ts — in_progress now coral"
fi

echo
echo "▸ Step 3/3 — manual review remaining"
echo
echo "  These need a human eye (route-group paths can't be safely batched):"
echo "    - apps/admin-v2/src/presentation/app/(auth)/layout.tsx"
echo "      (gradient bg slate→indigo + 'T' chip in indigo-600 — see patches/admin-auth-layout.tsx)"
echo "    - apps/admin-v2/src/presentation/app/(tenant)/plan/page.tsx"
echo "      (verify usage colors render correctly after auto-replace)"
echo
echo "✓ All automatic patches applied."
echo
echo "Next steps:"
echo "  cd apps/admin-v2 && pnpm install && pnpm dev"
echo "  cd apps/customer_v2 && flutter pub get && flutter run"
