'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ReservationCard } from './reservation-card';
import { NowLine } from './now-line';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 96;
const CARD_MIN_HEIGHT = 44;
const GUTTER_WIDTH = 64;
const COL_GAP = 6;
const MAX_VISIBLE_COLS = 3; // cap concurrent lanes so cards stay readable
const MIN_CARD_WIDTH = 140;

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
  /** Hidden overflow: only set on the placeholder pill we render when a
      cluster has more than MAX_VISIBLE_COLS concurrent reservations. */
  overflow?: Reservation[];
}

/**
 * Lay events into columns so concurrent reservations never overlap. Once
 * a cluster exceeds MAX_VISIBLE_COLS lanes, the extras get collapsed
 * into a single "+N más" pill anchored to the last visible column —
 * keeps individual cards above MIN_CARD_WIDTH on most screens.
 */
function layoutColumns(events: Array<{ reservation: Reservation; top: number; height: number }>) {
  const sorted = [...events].sort((a, b) => a.top - b.top || a.height - b.height);
  const positioned: Positioned[] = [];
  let cluster: Positioned[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const rawCols = cluster.reduce((m, e) => Math.max(m, e.col + 1), 0);
    const visibleCols = Math.min(rawCols, MAX_VISIBLE_COLS);

    if (rawCols <= MAX_VISIBLE_COLS) {
      cluster.forEach((e) => (e.cols = visibleCols));
      positioned.push(...cluster);
    } else {
      // Keep events in the first N-1 columns as-is; collapse the rest
      // into a single overflow pill that sits in the last visible
      // column for the entire cluster span.
      const visible = cluster.filter((c) => c.col < MAX_VISIBLE_COLS - 1);
      const overflowed = cluster.filter((c) => c.col >= MAX_VISIBLE_COLS - 1);
      visible.forEach((e) => (e.cols = visibleCols));
      positioned.push(...visible);

      if (overflowed.length > 0) {
        const minTop = Math.min(...overflowed.map((e) => e.top));
        const maxBottom = Math.max(...overflowed.map((e) => e.top + e.height));
        positioned.push({
          reservation: overflowed[0].reservation,
          top: minTop,
          height: maxBottom - minTop,
          col: MAX_VISIBLE_COLS - 1,
          cols: visibleCols,
          overflow: overflowed.map((e) => e.reservation),
        });
      }
    }
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
  const laneRef = useRef<HTMLDivElement>(null);
  const [laneWidth, setLaneWidth] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState<{
    top: number;
    items: Reservation[];
  } | null>(null);

  // Observe the lane width so each card can pick the right density.
  useEffect(() => {
    if (!laneRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setLaneWidth(e.contentRect.width);
    });
    ro.observe(laneRef.current);
    return () => ro.disconnect();
  }, []);

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

        <div
          ref={laneRef}
          className="absolute z-10"
          style={{ left: `${GUTTER_WIDTH}px`, right: 8, top: 0, bottom: 0 }}
        >
          {positioned.map(({ reservation, top, height, col, cols, overflow }) => {
            const widthPct = 100 / cols;
            const leftPct = widthPct * col;
            const cardWidth = laneWidth > 0
              ? (laneWidth * widthPct) / 100 - (cols > 1 ? COL_GAP : 0)
              : MIN_CARD_WIDTH;

            // Density picker — keeps the card readable even at column 3
            // on a narrow viewport. Falls back to compact if width is
            // below the breakpoint.
            const density: 'full' | 'medium' | 'compact' =
              cardWidth >= 320 ? 'full' : cardWidth >= 200 ? 'medium' : 'compact';

            if (overflow) {
              return (
                <button
                  key={`overflow-${top}-${col}`}
                  type="button"
                  onClick={() => setOverflowOpen({ top, items: overflow })}
                  className={cn(
                    'absolute flex flex-col items-center justify-center rounded-lg border border-dashed',
                    'border-[var(--border-strong)] bg-[var(--bg-app)]/60 text-[12px] font-medium',
                    'text-[var(--fg-strong)] transition-colors hover:bg-[var(--bg-app)] cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                  )}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${leftPct}% + ${col === 0 ? 0 : COL_GAP / 2}px)`,
                    width: `calc(${widthPct}% - ${cols === 1 ? 0 : COL_GAP}px)`,
                  }}
                  aria-label={`Ver ${overflow.length} reservas más en este rango`}
                >
                  <span className="text-[15px] font-semibold text-[var(--brand-700)]">
                    +{overflow.length}
                  </span>
                  <span className="text-[11px] text-[var(--fg-muted)]">más</span>
                </button>
              );
            }

            return (
              <div
                key={reservation.id}
                className={cn(
                  'group absolute transition-[box-shadow,transform,z-index] duration-200 ease-out',
                  'will-change-transform hover:z-30',
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
                  density={density}
                  onClick={() => onSelect(reservation)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Overflow popover — lightweight inline list. Tap any row to open
          the same detail panel the visible cards use. */}
      {overflowOpen && (
        <div
          className="absolute z-40 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-2xl"
          style={{
            top: `${overflowOpen.top}px`,
            right: 12,
          }}
          role="dialog"
          aria-label="Reservas adicionales"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              {overflowOpen.items.length} reservas adicionales
            </p>
            <button
              type="button"
              onClick={() => setOverflowOpen(null)}
              className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--fg-strong)]"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="space-y-1.5">
            {overflowOpen.items.map((r) => (
              <div key={r.id} className="h-12">
                <ReservationCard
                  reservation={r}
                  density="medium"
                  onClick={() => {
                    setOverflowOpen(null);
                    onSelect(r);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
