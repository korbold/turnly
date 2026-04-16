'use client';

import { useMemo } from 'react';
import { ReservationCard } from './reservation-card';
import { NowLine } from './now-line';
import type { Reservation } from '@/domain/entities/reservation';

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 120; // px per hour

interface TimelineProps {
  reservations: Reservation[];
  onSelect: (reservation: Reservation) => void;
}

export function Timeline({ reservations, onSelect }: TimelineProps) {
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      result.push(h);
    }
    return result;
  }, []);

  const positioned = useMemo(() => {
    return reservations.map((r) => {
      const d = new Date(r.scheduledAt);
      const startFrac = d.getHours() + d.getMinutes() / 60;
      const endD = new Date(r.estimatedEnd);
      const endFrac = endD.getHours() + endD.getMinutes() / 60;
      const durationH = Math.max(0.25, endFrac - startFrac);

      return {
        reservation: r,
        top: (startFrac - START_HOUR) * HOUR_HEIGHT,
        height: durationH * HOUR_HEIGHT,
      };
    });
  }, [reservations]);

  return (
    <div className="relative min-h-0 overflow-y-auto rounded-lg border bg-white">
      <div
        className="relative"
        style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
      >
        {/* Hour grid lines */}
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-start border-t border-zinc-100"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
          >
            <span className="w-14 shrink-0 px-2 pt-1 text-right text-xs text-muted-foreground">
              {String(h).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        {/* Now line */}
        <div className="absolute left-14 right-0">
          <NowLine
            startHour={START_HOUR}
            endHour={END_HOUR}
            hourHeight={HOUR_HEIGHT}
          />
        </div>

        {/* Reservation cards */}
        <div className="absolute left-16 right-2">
          {positioned.map(({ reservation, top }) => (
            <div
              key={reservation.id}
              className="absolute left-0 right-0 z-10"
              style={{ top: `${top}px` }}
            >
              <ReservationCard
                reservation={reservation}
                onClick={() => onSelect(reservation)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
