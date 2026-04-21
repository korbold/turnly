# Calendar View — Monthly Reservations Grid

## Summary

Replace the "Vista de calendario próximamente" placeholder with a Google Calendar-style monthly grid showing reservations as mini-cards per day. Provides month-level overview with navigation to daily Timeline for details.

## Data Fetching

Reuse existing `useReservations` hook. When view is `calendar`, change filters:

- `dateFrom` = first visible day in grid (may be last Monday of previous month)
- `dateTo` = last visible day in grid (may be first Sunday of next month)
- No status filter override (show all, but respect status tabs if active)
- Backend already supports `date_from`/`date_to` range and returns up to 500 results

New state: `calendarMonth` (Date) — controls which month is displayed. Navigation arrows change this state by ±1 month.

## CalendarView Component

**Grid:** CSS Grid, 7 columns (Lun, Mar, Mié, Jue, Vie, Sáb, Dom). Rows dynamically generated based on weeks in the visible range.

**Header row:** Day names (Lun-Dom), styled like Google Calendar column headers.

## CalendarDayCell Component

Each cell renders:

- **Day number** — clickable, navigates to Timeline view for that day
- **Up to 3 mini-cards** — one per reservation, clickable, opens DetailPanel
- **"+N más" overflow** — shown when >3 reservations, clickable, opens DetailPanel with first overflow reservation
- **Today indicator** — day number with blue circle (like Google Calendar)
- **Out-of-month days** — gray/muted text and background

### Mini-card Design

Single line: `09:30 María López`
- Left border colored by reservation status (uses `RESERVATION_STATUS_CONFIG` colors)
- ~24px height, truncated text with ellipsis
- Click opens DetailPanel directly

## Navigation and Integration

### Changes to reservations page.tsx

- New state: `calendarMonth` (Date, default: today)
- When `view === 'calendar'`:
  - Filters use month range instead of single date
  - `< >` arrows navigate by month (not day)
  - Header shows "Abril de 2026" format (not "21 de abr 2026")
  - "Hoy" button navigates to current month
- When `view === 'timeline'`: existing behavior unchanged
- Status tabs remain visible and filter calendar reservations too

### Interactions

| Action | Result |
|--------|--------|
| Click day number | `setView('timeline')` + `setDate(day)` — navigates to Timeline |
| Click mini-card | `setSelectedReservation(reservation)` — opens DetailPanel |
| Click "+N más" | `setSelectedReservation(firstOverflow)` — opens DetailPanel |
| `< >` arrows | `calendarMonth` ± 1 month |
| "Hoy" button | `calendarMonth` = current month |

## New Files

| File | Purpose |
|------|---------|
| `src/presentation/components/features/reservations/calendar-view.tsx` | Monthly grid component |
| `src/presentation/components/features/reservations/calendar-day-cell.tsx` | Day cell with mini-cards |

## Modified Files

| File | Change |
|------|--------|
| `src/presentation/app/(tenant)/reservations/page.tsx` | Replace placeholder, add calendarMonth state, adapt navigation for month view |

All paths relative to `apps/admin-v2/`.

## Not In Scope

- Week view, year view, agenda view
- Drag-and-drop reservations
- Create reservation by clicking empty day cell
- External calendar library
- Backend changes
