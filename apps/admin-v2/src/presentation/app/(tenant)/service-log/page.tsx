'use client';

import { useState, Suspense } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Calendar } from '@/presentation/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { DailySummary } from '@/presentation/components/features/service-logs/daily-summary';
import { LogList } from '@/presentation/components/features/service-logs/log-list';
import { NewServiceModal } from '@/presentation/components/features/service-logs/new-service-modal';

function ServiceLogContent() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Registro de Servicios</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setSelectedDate((d) => subDays(d, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[200px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="capitalize">
                {format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <DailySummary date={dateStr} />

      {/* Log list */}
      <LogList date={dateStr} />

      {/* Create modal */}
      <NewServiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function ServiceLogPage() {
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
      <ServiceLogContent />
    </Suspense>
  );
}
