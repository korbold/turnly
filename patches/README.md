# Turnly Codebase Patches

Patches to apply the Turnly Design System (Coral brand, Roboto, zinc-cool neutrals)
to `apps/admin-v2` and `apps/customer_v2`.

## Quick start

```bash
# 1) Drop this entire `patches/` folder at your repo root (next to apps/)
# 2) Run:
chmod +x patches/apply-patches.sh
./patches/apply-patches.sh
# 3) Manual: copy the auth layout patch (path with parens can't be batched)
cp patches/admin-v2/src/presentation/app/_auth_/layout.tsx.txt \
   apps/admin-v2/src/presentation/app/\(auth\)/layout.tsx
# 4) Rebuild
cd apps/admin-v2 && pnpm install && pnpm dev
cd apps/customer_v2 && flutter pub get
```

## What gets changed

### admin-v2
| File | Change |
|------|--------|
| `presentation/styles/globals.css` | Coral tokens, Roboto, tightened radii/shadows |
| `shared/constants/colors.ts` | 6 curated tenant palettes (Coral default) |
| `shared/constants/status.ts` | `in_progress` status → coral |
| `presentation/app/layout.tsx` | Inter → Roboto, themeColor coral |
| `presentation/app/(auth)/layout.tsx` | Removes indigo gradient bg, coral wordmark |
| **30+ `.tsx` files** | `bg-indigo-*` / `text-indigo-*` / `border-indigo-*` → `var(--color-primary*)` |
| Chart components | `'#4F46E5'` → `'#F2693A'` (Recharts strokes/fills) |

### customer_v2
| File | Change |
|------|--------|
| `lib/app/theme/app_colors.dart` | Coral accent + zinc-cool neutrals |
| `lib/app/theme/app_typography.dart` | `inter` → `roboto`, weight 800 displays |
| `lib/app/theme/app_theme.dart` | OutlinedButton/TextButton themes, divider tokens |
| `features/explore/.../business_card.dart` | Removed gradient cover, hairline border |
| `features/explore/.../next_reservation_card.dart` | Indigo→violet gradient → coral solid |

## Idempotent
The script is safe to re-run — `cp` overwrites, `sed` replacements don't compound.

## What it does NOT do
- Touch `node_modules/` or `build/` artifacts
- Migrate `Material Icons` → `lucide_icons_flutter` (Material outline icons already match)
- Rename Tailwind utility classes that aren't indigo (zinc/slate neutrals are kept)
- Modify dark mode (no dark mode tokens currently)

After running, check git diff in your editor to spot anything that needs human judgment.
