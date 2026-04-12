# Reservations Calendar View

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Replace reservations table with interactive calendar (month/week/day views)

---

## 1. Overview

Replace the current table/list view in the reservations page with a FullCalendar-based interactive calendar. Users can view reservations in month, week, or day views. Clicking an event opens a modal with details and actions. Clicking an empty slot opens the new reservation form with the date pre-filled.

## 2. Library

**@fullcalendar/react** with plugins:
- `@fullcalendar/daygrid` — month view
- `@fullcalendar/timegrid` — week and day views
- `@fullcalendar/interaction` — click events

## 3. Calendar Events

Each reservation maps to a FullCalendar event:
- `id`: reservation.id
- `title`: client name
- `start`: reservation.scheduled_at
- `end`: reservation.estimated_end (or scheduled_at + 1 hour fallback)
- `backgroundColor`: based on status
- `extendedProps`: full reservation object

### Status Colors

| Status | Background | Text |
|--------|-----------|------|
| pending | `#FFF5D9` | `#FFBB38` |
| confirmed | `#E7EDFF` | `#396AFF` |
| in_progress | `#F3E8FF` | `#7C3AED` |
| completed | `#DCFAF8` | `#16DBCC` |
| cancelled | `#FFE2E6` | `#FF4B4A` |
| no_show | `#EDF1F7` | `#718EBF` |

## 4. Page Layout

- Header: title + "Nueva reservación" button (same as current)
- Toolbar: FullCalendar built-in toolbar with month/week/day buttons, navigation arrows, today button
- Filters: status and service dropdowns above calendar (date filter removed — calendar handles that)
- Calendar: fills remaining space

## 5. Interactions

- **Click event** → opens Dialog with reservation details (reuses `ReservationCard`) and action buttons
- **Click empty date/slot** → opens Dialog with `ReservationForm`, date pre-filled from clicked slot
- **Navigate month/week** → triggers new API call with updated date range

## 6. API Changes

### Backend: Add date range filtering

In `ReservationController::index()`, add support for `date_from` and `date_to` params alongside existing `date` param:

```php
if ($request->has('date_from') && $request->has('date_to')) {
    $query->whereDate('scheduled_at', '>=', $request->date_from)
          ->whereDate('scheduled_at', '<=', $request->date_to);
} elseif ($request->has('date')) {
    $query->whereDate('scheduled_at', $request->date);
}
```

Also increase default per_page to 200 when using date range (calendar needs all events in range, not paginated):

```php
$perPage = ($request->has('date_from')) ? 200 : $request->get('per_page', 15);
```

### Frontend: Update API client

Add `date_from` and `date_to` to `getReservations` params type.

## 7. Files

1. **Install:** `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`
2. **Create:** `apps/admin/src/components/reservations/ReservationCalendar.tsx` — FullCalendar wrapper
3. **Modify:** `apps/admin/src/app/(tenant)/reservations/page.tsx` — replace table with calendar + event/date click handlers
4. **Modify:** `apps/admin/src/lib/api/reservations.ts` — add date_from/date_to params
5. **Modify:** `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php` — add date range filter

## 8. Styling

- FullCalendar ships with its own CSS. Override with BankDash theme:
  - Toolbar buttons: match BankDash pill style
  - Event colors: use status color map above
  - Today highlight: light blue `#E7EDFF`
  - Border colors: `#DFE5EE`
  - Font: inherits Inter from body

## 9. What Does NOT Change

- ReservationCard component (reused in modal)
- ReservationForm component (reused for new reservation)
- Reservation model, routes, business logic
- Other API endpoints
