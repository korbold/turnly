'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ReservationCard } from './reservation-card';
import { NowLine } from './now-line';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 96; // px per hour — tighter than before to reduce empty drift
const CARD_MIN_HEIGHT = 44;
const GUTTER_WIDTH = 64; // px left rail for hour labels
const COL_GAP = 6; // gap between overlap columns

interface TimelineProps {
  reservations: Reservation[];
  onSelect: (reservation: Reservation) => void;
}

interface Positioned {
  reservation: Reservation;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/**
 * Lay out events into columns so concurrent reservations never sit on top
 * of one another. Walks events left-to-right by start time, reusing the
 * first free column. The number of parallel lanes propagates back to
 * every event in the same cluster so they all share the same width.
 */
function layoutColumns(events: Array<{ reservation: Reservation; top: number; height: number }>) {
  const sorted = [...events].sort((a, b) => a.top - b.top || a.height - b.height);
  const positioned: Positioned[] = [];
  let cluster: Positioned[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    const cols = cluster.reduce((m, e) => Math.max(m, e.col + 1), 0);
    cluster.forEach((e) => (e.cols = cols));
    positioned.push(...cluster);
    cluster = [];
  };

  for (const e of sorted) {
    const start = e.top;
    const end = e.top + e.height;
    if (start >= clusterEnd) {
      flushCluster();
      clusterEnd = end;
    } else {
      clusterEnd = Math.max(clusterEnd, end);
    }
    // Find first column with no overlap inside the active cluster.
    const taken = new Set(
      cluster.filter((c) => c.top + c.height > start).map((c) => c.col),
    );
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ ...e, col, cols: 0 });
  }
  flushCluster();
  return positioned;
}

export function Timeline({ reservations, onSelect }: TimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const hours = useMemo(() => {
    const r: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) r.push(h);
    return r;
  }, []);

  const positioned = useMemo(() => {
    const raw = reservations.map((r) => {
      const d = new Date(r.scheduledAt);
      const endD = new Date(r.estimatedEnd);
      const startFrac = d.getHours() + d.getMinutes() / 60;
      const endFrac = endD.getHours() + endD.getMinutes() / 60;
      const durationH = Math.max(0.25, endFrac - startFrac);
      return {
        reservation: r,
        top: (startFrac - START_HOUR) * HOUR_HEIGHT,
        height: Math.max(durationH * HOUR_HEIGHT, CARD_MIN_HEIGHT),
      };
    });
    return layoutColumns(raw);
  }, [reservations]);

  // First-paint scroll: bring the earliest event into view so the user
  // doesn't open the page on empty 6 AM whitespace.
  useEffect(() => {
    if (!scrollerRef.current || positioned.length === 0) return;
    const firstTop = Math.min(...positioned.map((p) => p.top));
    scrollerRef.current.scrollTop = Math.max(0, firstTop - HOUR_HEIGHT);
  }, [positioned]);

  return (
    <div
      ref={scrollerRef}
      className="relative min-h-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm"
    >
      <div
        className="relative"
        style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
      >
        {/* Hour grid + soft half-hour split */}
        {hours.map((h) => (
          <div key={h}>
            <div
              className="absolute left-0 right-0 border-t border-[var(--border)]"
              style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
            >
              <span
                className="absolute -top-[9px] left-0 w-14 pr-3 text-right text-[11px] font-medium tabular-nums text-[var(--fg-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
            <div
              className="absolute left-16 right-0 border-t border-dashed border-[var(--border)]/60"
              style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
            />
          </div>
        ))}

        {/* Now line */}
        <div
          className="absolute z-20"
          style={{ left: `${GUTTER_WIDTH}px`, right: 8 }}
        >
          <NowLine
            startHour={START_HOUR}
            endHour={END_HOUR}
            hourHeight={HOUR_HEIGHT}
          />
        </div>

        {/* Reservation cards — one per lane, no overlap */}
        <div
          className="absolute z-10"
          style={{ left: `${GUTTER_WIDTH}px`, right: 8, top: 0, bottom: 0 }}
        >
          {positioned.map(({ reservation, top, height, col, cols }) => {
            const widthPct = 100 / cols;
            const leftPct = widthPct * col;
            return (
              <div
                key={reservation.id}
                className={cn(
                  'absolute transition-[box-shadow,transform] duration-200 ease-out',
                  'will-change-transform',
                )}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: `calc(${leftPct}% + ${col === 0 ? 0 : COL_GAP / 2}px)`,
                  width: `calc(${widthPct}% - ${cols === 1 ? 0 : COL_GAP}px)`,
                }}
              >
                <ReservationCard
                  reservation={reservation}
                  onClick={() => onSelect(reservation)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
