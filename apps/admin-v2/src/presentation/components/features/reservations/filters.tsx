'use client';

import { useMemo } from 'react';
import { format, addDays, subDays, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useQueryState, parseAsString } from 'nuqs';
import { Button } from '@/presentation/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { Calendar } from '@/presentation/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  RESERVATION_STATUS_CONFIG,
  type ReservationStatus,
} from '@/shared/constants/status';
import type { Reservation } from '@/domain/entities/reservation';
import { cn } from '@/shared/utils/cn';

interface FiltersProps {
  reservations: Reservation[];
  onServiceChange?: (serviceId: string | null) => void;
  onEmployeeChange?: (employeeId: string | null) => void;
  calendarMonth?: Date;
  onMonthChange?: (month: Date) => void;
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completadas' },
];

export function ReservationFilters({
  reservations,
  onServiceChange,
  onEmployeeChange,
  calendarMonth,
  onMonthChange,
}: FiltersProps) {
  const [dateStr, setDateStr] = useQueryState(
    'date',
    parseAsString.withDefault(format(new Date(), 'yyyy-MM-dd'))
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsString.withDefault('all')
  );

  const selectedDate = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: reservations.length };
    for (const r of reservations) {
      map[r.status] = (map[r.status] ?? 0) + 1;
    }
    return map;
  }, [reservations]);

  return (
    <div className="space-y-3">
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

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          const count = counts[tab.value] ?? 0;
          const cfg =
            tab.value !== 'all'
              ? RESERVATION_STATUS_CONFIG[tab.value as ReservationStatus]
              : null;

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? cfg
                    ? `border-transparent ${cfg.bgColor} ${cfg.color}`
                    : 'border-transparent bg-[var(--ink-700)] text-[var(--bg-surface)]'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg)] hover:border-[var(--border-strong)]'
              )}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-white/20' : 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
