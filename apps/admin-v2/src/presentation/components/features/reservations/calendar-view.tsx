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
