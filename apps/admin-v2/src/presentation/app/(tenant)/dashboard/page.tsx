'use client';

import { Filter, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/presentation/components/ui/button';
import { useMe } from '@/presentation/hooks/use-auth';
import { RevenueCards } from '@/presentation/components/features/dashboard/revenue-cards';
import { LiveTracker } from '@/presentation/components/features/dashboard/live-tracker';
import { UpcomingReservations } from '@/presentation/components/features/dashboard/upcoming-reservations';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const router = useRouter();

  const greeting = getGreeting();
  const firstName = me?.user?.name?.split(' ')[0] ?? '';

  return (
    <div className="space-y-5">
      {/* Greeting + actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-[var(--fg-strong)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontStretch: '90%',
              letterSpacing: '-0.01em',
            }}
          >
            {greeting}, {firstName}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--fg-secondary)]">
            Aquí tienes un resumen de hoy
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filtros
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/reservations?create=true')}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva reserva
          </Button>
        </div>
      </div>

      {/* Revenue */}
      <RevenueCards />

      {/* Live tracker */}
      <LiveTracker />

      {/* Today's schedule */}
      <UpcomingReservations />
    </div>
  );
}
