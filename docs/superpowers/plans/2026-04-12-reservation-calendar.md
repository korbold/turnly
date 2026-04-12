# Reservation Calendar View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reservations table/list with an interactive FullCalendar view supporting month, week, and day views with click-to-view and click-to-create interactions.

**Architecture:** Install FullCalendar, add date range filtering to backend, create a calendar wrapper component, and rewire the reservations page to use it with event click → modal pattern.

**Tech Stack:** @fullcalendar/react, @fullcalendar/daygrid, @fullcalendar/timegrid, @fullcalendar/interaction, Next.js 16, React Query, shadcn/ui Dialog

---

### Task 1: Install FullCalendar packages

**Files:**
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/admin
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/package.json apps/admin/package-lock.json
git commit -m "chore: install fullcalendar packages for reservation calendar"
```

---

### Task 2: Add date range filtering to backend

**Files:**
- Modify: `apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php` (lines 32-49)

- [ ] **Step 1: Update the index method**

In the `index` method of `ReservationController.php`, replace the date filtering block (lines 36-38):

```php
if ($request->has('date')) {
    $query->whereDate('scheduled_at', $request->date);
}
```

with:

```php
if ($request->has('date_from') && $request->has('date_to')) {
    $query->whereDate('scheduled_at', '>=', $request->date_from)
          ->whereDate('scheduled_at', '<=', $request->date_to);
} elseif ($request->has('date')) {
    $query->whereDate('scheduled_at', $request->date);
}
```

- [ ] **Step 2: Update the pagination line**

Replace line 46:

```php
$reservations = $query->orderBy('scheduled_at')->paginate($request->get('per_page', 15));
```

with:

```php
$perPage = $request->has('date_from') ? 500 : (int) $request->get('per_page', 15);
$reservations = $query->orderBy('scheduled_at')->paginate($perPage);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/backend/app/Infrastructure/Http/Controllers/Reservation/ReservationController.php
git commit -m "feat: add date range filtering to reservations index endpoint"
```

---

### Task 3: Update frontend API client

**Files:**
- Modify: `apps/admin/src/lib/api/reservations.ts` (lines 5-14)

- [ ] **Step 1: Add date_from and date_to params**

Replace the `getReservations` function (lines 5-14) with:

```typescript
export async function getReservations(params?: {
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  service_id?: string;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<Reservation>> {
  const response = await api.get('/reservations', { params });
  return response.data;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/lib/api/reservations.ts
git commit -m "feat: add date_from/date_to params to getReservations API client"
```

---

### Task 4: Create ReservationCalendar component

**Files:**
- Create: `apps/admin/src/components/reservations/ReservationCalendar.tsx`

- [ ] **Step 1: Create the calendar component**

Create `apps/admin/src/components/reservations/ReservationCalendar.tsx` with:

```tsx
'use client';

import { useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { Reservation, ReservationStatus } from '@/types/reservation';

const STATUS_COLORS: Record<ReservationStatus, { bg: string; text: string; border: string }> = {
  pending:     { bg: '#FFF5D9', text: '#946B00', border: '#FFBB38' },
  confirmed:   { bg: '#E7EDFF', text: '#1814F3', border: '#396AFF' },
  in_progress: { bg: '#F3E8FF', text: '#6B21A8', border: '#7C3AED' },
  completed:   { bg: '#DCFAF8', text: '#0E8A7D', border: '#16DBCC' },
  cancelled:   { bg: '#FFE2E6', text: '#C41432', border: '#FF4B4A' },
  no_show:     { bg: '#EDF1F7', text: '#5A6B85', border: '#718EBF' },
};

function toEvents(reservations: Reservation[]): EventInput[] {
  return reservations.map((r) => {
    const colors = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
    return {
      id: r.id,
      title: r.client?.name ?? 'Sin cliente',
      start: r.scheduled_at,
      end: r.estimated_end || undefined,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: { reservation: r },
    };
  });
}

interface ReservationCalendarProps {
  reservations: Reservation[];
  onEventClick: (reservation: Reservation) => void;
  onDateSelect: (dateStr: string) => void;
  onDatesChange: (start: string, end: string) => void;
}

export function ReservationCalendar({
  reservations,
  onEventClick,
  onDateSelect,
  onDatesChange,
}: ReservationCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);

  const handleEventClick = (info: EventClickArg) => {
    const reservation = info.event.extendedProps.reservation as Reservation;
    onEventClick(reservation);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    onDateSelect(info.startStr);
  };

  const handleDatesSet = (info: DatesSetArg) => {
    const start = info.startStr.split('T')[0];
    const end = info.endStr.split('T')[0];
    onDatesChange(start, end);
  };

  return (
    <div className="fc-bankdash">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'dayGridMonth,timeGridWeek,timeGridDay',
          center: 'title',
          right: 'today prev,next',
        }}
        locale="es"
        firstDay={1}
        selectable
        selectMirror
        dayMaxEvents={3}
        events={toEvents(reservations)}
        eventClick={handleEventClick}
        select={handleDateSelect}
        datesSet={handleDatesSet}
        height="auto"
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
          day: 'Día',
        }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        nowIndicator
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/components/reservations/ReservationCalendar.tsx
git commit -m "feat: create ReservationCalendar component with FullCalendar"
```

---

### Task 5: Add FullCalendar BankDash styles

**Files:**
- Modify: `apps/admin/src/app/globals.css`

- [ ] **Step 1: Add calendar theme overrides**

Append the following CSS at the end of `apps/admin/src/app/globals.css` (after the `@layer base` block):

```css
/* FullCalendar BankDash Theme */
.fc-bankdash {
  --fc-border-color: #DFE5EE;
  --fc-button-bg-color: #FFFFFF;
  --fc-button-border-color: #DFE5EE;
  --fc-button-text-color: #343C6A;
  --fc-button-hover-bg-color: #E7EDFF;
  --fc-button-hover-border-color: #396AFF;
  --fc-button-active-bg-color: #396AFF;
  --fc-button-active-border-color: #396AFF;
  --fc-button-active-text-color: #FFFFFF;
  --fc-today-bg-color: #E7EDFF;
  --fc-page-bg-color: #FFFFFF;
  --fc-neutral-bg-color: #F5F7FA;
  --fc-event-border-color: transparent;
}

.fc-bankdash .fc-toolbar-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: #343C6A;
}

.fc-bankdash .fc-button {
  border-radius: 0.625rem;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.375rem 0.75rem;
  text-transform: none;
  box-shadow: none !important;
}

.fc-bankdash .fc-button-group .fc-button {
  border-radius: 0;
}

.fc-bankdash .fc-button-group .fc-button:first-child {
  border-radius: 0.625rem 0 0 0.625rem;
}

.fc-bankdash .fc-button-group .fc-button:last-child {
  border-radius: 0 0.625rem 0.625rem 0;
}

.fc-bankdash .fc-daygrid-event {
  border-radius: 0.375rem;
  padding: 2px 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border-left-width: 3px;
}

.fc-bankdash .fc-timegrid-event {
  border-radius: 0.375rem;
  border-left-width: 3px;
}

.fc-bankdash .fc-timegrid-event .fc-event-main {
  padding: 2px 4px;
  font-size: 0.75rem;
}

.fc-bankdash .fc-col-header-cell-cushion {
  font-weight: 500;
  color: #718EBF;
  font-size: 0.875rem;
}

.fc-bankdash .fc-daygrid-day-number {
  color: #343C6A;
  font-weight: 500;
  font-size: 0.875rem;
}

.fc-bankdash .fc-day-today .fc-daygrid-day-number {
  background-color: #396AFF;
  color: #FFFFFF;
  border-radius: 50%;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fc-bankdash .fc-scrollgrid {
  border-radius: 1rem;
  overflow: hidden;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/app/globals.css
git commit -m "style: add FullCalendar BankDash theme overrides"
```

---

### Task 6: Rewrite reservations page with calendar

**Files:**
- Modify: `apps/admin/src/app/(tenant)/reservations/page.tsx`

- [ ] **Step 1: Replace the full page**

Replace the entire content of `apps/admin/src/app/(tenant)/reservations/page.tsx` with:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { getReservations } from '@/lib/api/reservations';
import { getServices } from '@/lib/api/services';
import { ReservationCard } from '@/components/reservations/ReservationCard';
import { ReservationForm } from '@/components/reservations/ReservationForm';
import { ReservationCalendar } from '@/components/reservations/ReservationCalendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Reservation } from '@/types/reservation';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No asistió' },
];

export default function ReservationsPage() {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('all');
  const [serviceId, setServiceId] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    };
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const queryParams = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    status: status !== 'all' ? status : undefined,
    service_id: serviceId !== 'all' ? serviceId : undefined,
  };

  const queryKey = ['reservations', queryParams];

  const { data } = useQuery({
    queryKey,
    queryFn: () => getReservations(queryParams),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const reservations = data?.data ?? [];
  const services = servicesData?.data ?? [];

  const handleDatesChange = useCallback((from: string, to: string) => {
    setDateRange({ from, to });
  }, []);

  const handleEventClick = useCallback((reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailDialogOpen(true);
  }, []);

  const handleDateSelect = useCallback((dateStr: string) => {
    setCreateDate(dateStr);
    setCreateDialogOpen(true);
  }, []);

  const handleCreated = () => {
    setCreateDialogOpen(false);
    setCreateDate(undefined);
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };

  const handleDetailClose = () => {
    setDetailDialogOpen(false);
    setSelectedReservation(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#343C6A]">Reservaciones</h1>
          <p className="text-[#718EBF]">Gestión de citas y reservaciones</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva reservación
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nueva reservación</DialogTitle>
            </DialogHeader>
            <ReservationForm
              defaultDate={createDate}
              onSuccess={handleCreated}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[#343C6A]">Estado:</label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[#343C6A]">Servicio:</label>
          <Select value={serviceId} onValueChange={(v) => setServiceId(v ?? 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los servicios</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-[1.5625rem] p-4 shadow-sm">
        <ReservationCalendar
          reservations={reservations}
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
          onDatesChange={handleDatesChange}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => { if (!open) handleDetailClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de reservación</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <ReservationCard
              reservation={selectedReservation}
              queryKey={queryKey}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Note:** The `ReservationForm` component may not have a `defaultDate` prop yet. If it doesn't, the subagent should check the component and either:
- Add a `defaultDate` prop that pre-fills the date field, OR
- Remove the `defaultDate` prop from the calendar page if it's too complex to add

- [ ] **Step 2: Commit**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash
git add apps/admin/src/app/\(tenant\)/reservations/page.tsx
git commit -m "feat: replace reservation table with calendar view (month/week/day)"
```

---

### Task 7: Verify build and test

- [ ] **Step 1: Build the frontend**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/admin
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd /Users/korbold/Documents/Freelancer/CarWash/apps/admin
npx tsc --noEmit
```

Expected: No type errors.
