# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calendar placeholder with a Google Calendar-style monthly grid showing reservations as mini-cards per day.

**Architecture:** Two new components (`CalendarView` grid + `CalendarDayCell` cells) replace the placeholder in the reservations page. Data fetching reuses `useReservations` with month-wide date range. Page component gains `calendarMonth` state and adapts navigation/filters based on active view.

**Tech Stack:** React, date-fns, Tailwind CSS Grid, existing shadcn/ui components

**Spec:** `docs/superpowers/specs/2026-04-21-calendar-view-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/presentation/components/features/reservations/calendar-day-cell.tsx` | Create | Single day cell with mini-cards |
| `src/presentation/components/features/reservations/calendar-view.tsx` | Create | Monthly grid component |
| `src/presentation/app/(tenant)/reservations/page.tsx` | Modify | Integrate calendar view, add month state, adapt data fetching |
| `src/presentation/components/features/reservations/filters.tsx` | Modify | Export setDateStr for programmatic navigation from calendar |

All paths relative to `apps/admin-v2/`.

---

### Task 1: CalendarDayCell Component

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/reservations/calendar-day-cell.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client';

import { format, isToday } from 'date-fns';
import { RESERVATION_STATUS_CONFIG } from '@/shared/constants/status';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

const MAX_VISIBLE = 3;

const BORDER_COLORS: Record<string, string> = {
  pending: 'border-l-amber-500',
  confirmed: 'border-l-sky-500',
  in_progress: 'border-l-indigo-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-rose-500',
  no_show: 'border-l-slate-500',
};

interface CalendarDayCellProps {
  date: Date;
  reservations: Reservation[];
  isCurrentMonth: boolean;
  onSelectDay: (date: Date) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export function CalendarDayCell({
  date,
  reservations,
  isCurrentMonth,
  onSelectDay,
  onSelectReservation,
}: CalendarDayCellProps) {
  const visible = reservations.slice(0, MAX_VISIBLE);
  const overflow = reservations.length - MAX_VISIBLE;

  function getClientName(r: Reservation): string {
    const data = r.clientResource?.data as Record<string, unknown> | null | undefined;
    if (data) {
      const field = Object.entries(data).find(
        ([k, v]) => k.startsWith('field_') && typeof v === 'string' && v.trim()
      );
      if (field) return field[1] as string;
    }
    return r.clientResource?.plate ?? r.client?.name ?? 'Cliente';
  }

  return (
    <div
      className={cn(
        'min-h-[100px] border-b border-r p-1',
        !isCurrentMonth && 'bg-zinc-50'
      )}
    >
      <button
        onClick={() => onSelectDay(date)}
        className={cn(
          'mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-indigo-50',
          isToday(date) && 'bg-indigo-600 text-white hover:bg-indigo-700',
          !isCurrentMonth && 'text-zinc-400'
        )}
      >
        {format(date, 'd')}
      </button>

      <div className="space-y-0.5">
        {visible.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectReservation(r)}
            className={cn(
              'flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] leading-tight hover:opacity-80',
              BORDER_COLORS[r.status] ?? 'border-l-zinc-400'
            )}
          >
            <span className="shrink-0 font-medium text-zinc-600">
              {format(new Date(r.scheduledAt), 'HH:mm')}
            </span>
            <span className="truncate text-zinc-500">
              {getClientName(r)}
            </span>
          </button>
        ))}

        {overflow > 0 && (
          <button
            onClick={() => onSelectReservation(reservations[MAX_VISIBLE])}
            className="w-full rounded px-1 py-0.5 text-left text-[11px] text-indigo-600 hover:bg-indigo-50"
          >
            +{overflow} más
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/admin-v2 && npx tsc --noEmit 2>&1 | grep calendar-day-cell || echo "No errors"`
Expected: No errors (component not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/reservations/calendar-day-cell.tsx
git commit -m "feat(calendar): add CalendarDayCell component"
```

---

### Task 2: CalendarView Component

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/reservations/calendar-view.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { CalendarDayCell } from './calendar-day-cell';
import type { Reservation } from '@/domain/entities/reservation';

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface CalendarViewProps {
  month: Date;
  reservations: Reservation[];
  onSelectDay: (date: Date) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export function CalendarView({
  month,
  reservations,
  onSelectDay,
  onSelectReservation,
}: CalendarViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = new Date(r.scheduledAt).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    // Sort each day's reservations by time
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    }
    return map;
  }, [reservations]);

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b bg-zinc-50">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="border-r px-2 py-2 text-center text-xs font-medium text-zinc-500 last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          return (
            <CalendarDayCell
              key={key}
              date={day}
              reservations={reservationsByDay.get(key) ?? []}
              isCurrentMonth={isSameMonth(day, month)}
              onSelectDay={onSelectDay}
              onSelectReservation={onSelectReservation}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/admin-v2 && npx tsc --noEmit 2>&1 | grep calendar-view || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/components/features/reservations/calendar-view.tsx
git commit -m "feat(calendar): add CalendarView monthly grid component"
```

---

### Task 3: Integrate CalendarView into Reservations Page

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx`
- Modify: `apps/admin-v2/src/presentation/components/features/reservations/filters.tsx`

- [ ] **Step 1: Export setDateStr from filters.tsx**

In `apps/admin-v2/src/presentation/components/features/reservations/filters.tsx`, modify `useFilterParams` (lines 154-164) to also return `setDateStr`:

```tsx
export function useFilterParams() {
  const [dateStr, setDateStr] = useQueryState(
    'date',
    parseAsString.withDefault(format(new Date(), 'yyyy-MM-dd'))
  );
  const [statusFilter] = useQueryState(
    'status',
    parseAsString.withDefault('all')
  );
  return {
    dateStr,
    setDateStr,
    statusFilter: statusFilter === 'all' ? undefined : (statusFilter as ReservationStatus),
  };
}
```

- [ ] **Step 2: Rewrite page.tsx with calendar integration**

Replace entire content of `apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx` with:

```tsx
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, LayoutList, CalendarDays } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useReservations } from '@/presentation/hooks/use-reservations';
import {
  ReservationFilters,
  useFilterParams,
} from '@/presentation/components/features/reservations/filters';
import { Timeline } from '@/presentation/components/features/reservations/timeline';
import { CalendarView } from '@/presentation/components/features/reservations/calendar-view';
import { DetailPanel } from '@/presentation/components/features/reservations/detail-panel';
import { CreateModal } from '@/presentation/components/features/reservations/create-modal';
import type { Reservation, ReservationStatus } from '@/domain/entities/reservation';

function ReservationsContent() {
  const { dateStr, setDateStr, statusFilter } = useFilterParams();
  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Check URL for create=true
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateOpen(true);
    }
  }, [searchParams]);

  // Calendar month date range (full visible grid)
  const calendarRange = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return {
      from: format(gridStart, 'yyyy-MM-dd'),
      to: format(gridEnd, 'yyyy-MM-dd'),
    };
  }, [calendarMonth]);

  // Data for timeline view (single day)
  const { data: timelineData, isLoading: timelineLoading } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
    status: statusFilter as ReservationStatus | undefined,
  });

  // Unfiltered for status counts (timeline)
  const { data: allTimelineData } = useReservations({
    dateFrom: dateStr,
    dateTo: dateStr,
  });

  // Data for calendar view (full month range)
  const { data: calendarData, isLoading: calendarLoading } = useReservations(
    view === 'calendar'
      ? {
          dateFrom: calendarRange.from,
          dateTo: calendarRange.to,
          status: statusFilter as ReservationStatus | undefined,
        }
      : { dateFrom: '', dateTo: '' } // disabled when not in calendar view
  );

  // Unfiltered for status counts (calendar)
  const { data: allCalendarData } = useReservations(
    view === 'calendar'
      ? { dateFrom: calendarRange.from, dateTo: calendarRange.to }
      : { dateFrom: '', dateTo: '' }
  );

  const isLoading = view === 'timeline' ? timelineLoading : calendarLoading;

  const allReservations = view === 'timeline'
    ? (allTimelineData?.data ?? [])
    : (allCalendarData?.data ?? []);

  const displayReservations = view === 'timeline'
    ? (statusFilter ? (timelineData?.data ?? []) : allReservations)
    : (statusFilter ? (calendarData?.data ?? []) : allReservations);

  function handleCalendarSelectDay(date: Date) {
    setDateStr(format(date, 'yyyy-MM-dd'));
    setView('timeline');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Reservas</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'timeline'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setView('timeline')}
            >
              <LayoutList className="mr-1 inline h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setView('calendar')}
            >
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              Calendario
            </button>
          </div>

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nueva Reserva
          </Button>
        </div>
      </div>

      {/* Filters — shown for timeline, calendar has its own nav */}
      {view === 'timeline' ? (
        <ReservationFilters reservations={allReservations} />
      ) : (
        <ReservationFilters
          reservations={allReservations}
          calendarMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : view === 'timeline' ? (
        <Timeline
          reservations={displayReservations}
          onSelect={setSelectedReservation}
        />
      ) : (
        <CalendarView
          month={calendarMonth}
          reservations={displayReservations}
          onSelectDay={handleCalendarSelectDay}
          onSelectReservation={setSelectedReservation}
        />
      )}

      {/* Detail panel */}
      <DetailPanel
        reservation={selectedReservation}
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      {/* Create modal */}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <ReservationsContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add calendar month navigation to filters.tsx**

In `apps/admin-v2/src/presentation/components/features/reservations/filters.tsx`, add `addMonths`/`subMonths` to date-fns imports and add optional calendar props:

Add to imports at top (line 4):
```tsx
import { format, addDays, subDays, addMonths, subMonths } from 'date-fns';
```

Update interface (line 29-33):
```tsx
interface FiltersProps {
  reservations: Reservation[];
  onServiceChange?: (serviceId: string | null) => void;
  onEmployeeChange?: (employeeId: string | null) => void;
  calendarMonth?: Date;
  onMonthChange?: (month: Date) => void;
}
```

Update function signature (line 43-48):
```tsx
export function ReservationFilters({
  reservations,
  onServiceChange,
  onEmployeeChange,
  calendarMonth,
  onMonthChange,
}: FiltersProps) {
```

Replace the date selector section (lines 70-118) with conditional rendering:

```tsx
      {/* Date selector */}
      {calendarMonth && onMonthChange ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(subMonths(calendarMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="h-8 min-w-[160px] flex items-center justify-center text-sm font-medium capitalize">
            {format(calendarMonth, "MMMM 'de' yyyy", { locale: es })}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMonthChange(addMonths(calendarMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onMonthChange(new Date())}
          >
            Hoy
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDateStr(format(subDays(selectedDate, 1), 'yyyy-MM-dd'))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 min-w-[160px] justify-start text-sm font-normal"
              >
                <CalendarDays className="mr-2 h-3.5 w-3.5" />
                {format(selectedDate, "d 'de' MMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) setDateStr(format(d, 'yyyy-MM-dd'));
                }}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDateStr(format(addDays(selectedDate, 1), 'yyyy-MM-dd'))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setDateStr(format(new Date(), 'yyyy-MM-dd'))}
          >
            Hoy
          </Button>
        </div>
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/admin-v2 && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Verify in browser**

Open `http://localhost:3000/reservations`, click "Calendario" toggle. Should show monthly grid with day headers (Lun-Dom), today highlighted in blue circle, and month navigation arrows. Click a day number to switch to Timeline for that day.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-v2/src/presentation/app/\(tenant\)/reservations/page.tsx apps/admin-v2/src/presentation/components/features/reservations/filters.tsx
git commit -m "feat(calendar): integrate CalendarView into reservations page with month navigation"
```

---

### Task 4: Visual Polish and Edge Cases

**Files:**
- Modify: `apps/admin-v2/src/presentation/components/features/reservations/calendar-day-cell.tsx`
- Modify: `apps/admin-v2/src/presentation/components/features/reservations/calendar-view.tsx`

- [ ] **Step 1: Fix last column border and bottom row border**

In `calendar-view.tsx`, add `last:border-r-0` handling. The grid already has `overflow-hidden rounded-lg border` so outer borders are handled. But the last cell in each row has a redundant right border. Update the cell in `calendar-day-cell.tsx`:

Change the outer div className from:
```tsx
'min-h-[100px] border-b border-r p-1',
```
to:
```tsx
'min-h-[100px] border-b border-r p-1 last:border-r-0',
```

Wait — CSS `last:` won't work correctly in a grid because it only targets the very last child. Instead, leave as-is since the outer container's `overflow-hidden` clips the extra right border on the last column. This is already correct.

No changes needed. The outer `overflow-hidden rounded-lg border` on the grid container handles clipping cleanly.

- [ ] **Step 2: Test with browser — verify all interactions**

Test checklist in browser at `http://localhost:3000/reservations`:

1. Click "Calendario" → monthly grid appears
2. Today has blue circle
3. Out-of-month days are grayed
4. Month name shows "abril de 2026"
5. `<` arrow goes to March, `>` goes to May
6. "Hoy" returns to current month
7. Click day number → switches to Timeline for that day
8. Status tabs filter calendar reservations
9. If reservations exist, mini-cards show with colored left border
10. Click mini-card → DetailPanel opens

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(calendar): visual polish and edge case fixes"
```

Only commit if changes were made. Skip if no fixes needed.
