'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setCreateOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-4">
      {/* Toolbar: date selector + primary CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Día anterior"
            className="h-9 w-9 p-0"
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>
                  {(() => {
                    const s = format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
                    return s.charAt(0).toUpperCase() + s.slice(1);
                  })()}
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
            aria-label="Día siguiente"
            className="h-9 w-9 p-0"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Registrar servicio
        </Button>
      </div>

      {/* Summary cards */}
      <DailySummary date={dateStr} />

      {/* Log list */}
      <LogList date={dateStr} onCreate={() => setCreateOpen(true)} />

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
