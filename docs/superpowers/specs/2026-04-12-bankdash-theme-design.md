# TurnLy — BankDash Theme Application

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Apply BankDash Figma design system to TurnLy admin app (colors, typography, sidebar, topbar, border radius)
**Source:** BankDash Figma — `figma.com/design/mrKSm79G2EVaYpvNwHNdZB`

---

## 1. Overview

Replace the current Alpha/custom design theme with the BankDash design system. This is a visual-only change — no logic, routing, or data changes. The goal is a clean, modern, professional look that works for any business type.

## 2. Typography

### Font Change: Geist → Inter

- Remove `next/font/google` Geist and Geist_Mono imports
- Add `Inter` from `next/font/google` (weights: 400, 500, 600, 700)
- Update CSS variable `--font-sans` to use Inter
- Remove `--font-mono` (not used in BankDash)

### Type Scale (from BankDash)

| Role | Font | Weight | Size |
|------|------|--------|------|
| Heading 1 | Inter | 600 | 28px |
| Heading 2 | Inter | 600 | 22px |
| Heading 3 | Inter | 500 | 18px |
| Body 1 | Inter | 400 | 16px |
| Body 2 | Inter | 400 | 15px |
| Caption | Inter | 400 | 13px |
| Small | Inter | 400 | 12px |

## 3. Color Palette (CSS Variables)

### Light Mode (`:root`)

| Variable | Current | New (BankDash) |
|----------|---------|----------------|
| `--background` | `#F1F6FD` | `#F5F7FA` |
| `--foreground` | `#1a1a2e` | `#343C6A` |
| `--card` | `#ffffff` | `#FFFFFF` |
| `--card-foreground` | `#1a1a2e` | `#343C6A` |
| `--primary` | `#304FDB` | `#396AFF` |
| `--primary-foreground` | `#ffffff` | `#FFFFFF` |
| `--secondary` | `#EEF2FF` | `#E7EDFF` |
| `--secondary-foreground` | `#1a1a2e` | `#343C6A` |
| `--accent` | `#EEF2FF` | `#E7EDFF` |
| `--accent-foreground` | `#1a1a2e` | `#343C6A` |
| `--muted` | `#E8ECF4` | `#EDF1F7` |
| `--muted-foreground` | `#6A84A8` | `#718EBF` |
| `--destructive` | current oklch | `#FF4B4A` |
| `--border` | `#E2E8F0` | `#DFE5EE` |
| `--input` | `#E2E8F0` | `#DFE5EE` |
| `--ring` | `#304FDB` | `#396AFF` |

### Sidebar Variables (light sidebar)

| Variable | Current | New (BankDash) |
|----------|---------|----------------|
| `--sidebar` | `#050417` | `#FFFFFF` |
| `--sidebar-foreground` | `#E2E8F0` | `#B1B1B1` |
| `--sidebar-primary` | `#304FDB` | `#1814F3` |
| `--sidebar-primary-foreground` | `#ffffff` | `#1814F3` |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | `#E7EDFF` |
| `--sidebar-accent-foreground` | `#E2E8F0` | `#343C6A` |
| `--sidebar-border` | (none) | `#DFE5EE` |

### Chart Colors

| Variable | New |
|----------|-----|
| `--chart-1` | `#396AFF` |
| `--chart-2` | `#41D4A8` |
| `--chart-3` | `#FFBB38` |
| `--chart-4` | `#FF82AC` |
| `--chart-5` | `#FC7900` |

### Semantic Colors (for status badges, alerts)

| Name | Color | Usage |
|------|-------|-------|
| Green/Success | `#16DBCC` / bg `#DCFAF8` | Completed, active |
| Yellow/Warning | `#FFBB38` / bg `#FFF5D9` | Pending, on hold |
| Red/Destructive | `#FF4B4A` | Cancelled, error |
| Blue/Info | `#396AFF` / bg `#E7EDFF` | In progress |

## 4. Border Radius

| Variable | Current | New (BankDash) |
|----------|---------|----------------|
| `--radius` | `0.75rem` (12px) | `1.5625rem` (25px) |
| `--radius-sm` | `calc(var(--radius) * 0.6)` | `0.625rem` (10px) |
| `--radius-lg` | `var(--radius)` | `1.5625rem` (25px) |

Note: BankDash uses 25px for cards, 40px for buttons/pills, 50px for badges. The shadcn components will pick up `--radius` automatically. Buttons may need explicit `rounded-full` or custom radius.

## 5. Sidebar Redesign

### Current
- Dark gradient background (`from-[#050417] to-[#171365]`)
- White text and icons
- Active item: `border-l-2 border-[#304FDB]` with `bg-white/10`

### New (BankDash style)
- White background with right border `#DFE5EE`
- Logo at top (keep existing logo, update colors if needed)
- Menu items: icon + text in `#B1B1B1` (inactive)
- Active item: icon + text in `#1814F3`, left border indicator `3px solid #1814F3`, subtle blue background `#E7EDFF`
- Hover: text transitions to `#343C6A`
- No gradient, no dark theme
- Search box: light gray background `#EDF1F7`, rounded, placeholder in `#718EBF`

## 6. TopBar Redesign

### Current
- White background with bottom border
- Mobile hamburger + notification bell + user avatar

### New (BankDash style)
- White background, border-bottom `1px solid #DFE5EE`
- Left side: page title in `#343C6A` font-semibold 28px
- Right side: search input (rounded pill, `#F5F7FA` bg), notification icon, settings icon, user avatar
- Icons in `#718EBF`
- On mobile: hamburger menu replaces search

## 7. Files to Modify

1. **`apps/admin/src/app/globals.css`** — All CSS custom properties
2. **`apps/admin/src/app/layout.tsx`** — Font import (Geist → Inter)
3. **`apps/admin/src/components/layout/Sidebar.tsx`** — Complete visual redesign
4. **`apps/admin/src/components/layout/MobileSidebar.tsx`** — Match new sidebar style
5. **`apps/admin/src/components/layout/TopBar.tsx`** — Style adjustments

## 8. What Does NOT Change

- Component library (shadcn/ui) — just picks up new CSS vars
- Layout structure (sidebar + topbar + content)
- Routing, data fetching, business logic
- Permission-based menu visibility
- Dark mode variables (update later if needed, low priority)
- SuperAdminSidebar (separate scope)

## 9. Acceptance Criteria

- All pages use Inter font
- Background is `#F5F7FA`, cards are white with 25px radius
- Sidebar is white with blue active indicators
- TopBar shows page title and icons in BankDash style
- No hardcoded old colors remain in the 5 files listed
- Existing functionality is unaffected
