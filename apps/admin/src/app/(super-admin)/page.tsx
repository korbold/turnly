'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Users, CalendarDays, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getStats, SystemStats } from '@/lib/api/super-admin';

const statCards = [
  {
    key: 'total_tenants' as const,
    label: 'Total negocios',
    icon: Building2,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'active_tenants' as const,
    label: 'Negocios activos',
    icon: CheckCircle2,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    key: 'total_users' as const,
    label: 'Total usuarios',
    icon: Users,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    key: 'total_reservations' as const,
    label: 'Total reservaciones',
    icon: CalendarDays,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    key: 'total_services' as const,
    label: 'Total servicios',
    icon: Wrench,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
  },
];

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="flex flex-col items-center text-center gap-3 pt-4">
                <div className={`p-3 rounded-full ${card.iconBg}`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
                {loading ? (
                  <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
                ) : (
                  <span className="text-3xl font-bold text-gray-900">
                    {stats?.[card.key] ?? 0}
                  </span>
                )}
                <span className="text-sm text-gray-500">{card.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
