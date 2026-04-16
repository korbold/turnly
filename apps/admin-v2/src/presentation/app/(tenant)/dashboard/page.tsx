'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/presentation/components/ui/button';
import { useMe } from '@/presentation/hooks/use-auth';
import { RevenueCards } from '@/presentation/components/features/dashboard/revenue-cards';
import { LiveTracker } from '@/presentation/components/features/dashboard/live-tracker';
import { QuickActions } from '@/presentation/components/features/dashboard/quick-actions';
import { UpcomingReservations } from '@/presentation/components/features/dashboard/upcoming-reservations';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const router = useRouter();

  const todayFormatted = useMemo(
    () => format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es }),
    []
  );

  const greeting = getGreeting();
  const firstName = me?.user?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm capitalize text-muted-foreground">
            {todayFormatted}
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => router.push('/reservations?create=true')}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva Reserva
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: wider */}
        <div className="space-y-6 lg:col-span-2">
          <LiveTracker />
          <UpcomingReservations />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <RevenueCards />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
