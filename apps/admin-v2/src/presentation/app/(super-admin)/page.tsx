'use client';

import { Building2, Users, CalendarCheck, Wrench, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useSuperAdminStats } from '@/presentation/hooks/use-super-admin';

// Mock trend data - would come from API in production
const TREND_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  tenants: Math.floor(Math.random() * 5) + 10 + i,
  users: Math.floor(Math.random() * 20) + 50 + i * 3,
}));

const STAT_CARDS = [
  { key: 'totalTenants' as const, label: 'Total Tenants', icon: Building2 },
  { key: 'activeTenants' as const, label: 'Tenants Activos', icon: TrendingUp },
  { key: 'totalUsers' as const, label: 'Total Usuarios', icon: Users },
  { key: 'totalReservations' as const, label: 'Total Reservas', icon: CalendarCheck },
];

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useSuperAdminStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Super Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vista global de la plataforma</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="p-4">
                {isLoading ? (
                  <>
                    <Skeleton className="mb-2 h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </>
                ) : (
                  <>
                    <div className="mb-1 flex items-center gap-2">
                      <div className="rounded-md bg-amber-50 p-1.5">
                        <Icon className="h-4 w-4 text-amber-600" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                    </div>
                    <p className="text-2xl font-semibold">
                      {stats?.[card.key]?.toLocaleString() ?? 0}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Crecimiento (ultimos 14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={TREND_DATA}>
              <defs>
                <linearGradient id="tenantGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F2693A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F2693A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="tenants" name="Tenants" stroke="#F59E0B" strokeWidth={2} fill="url(#tenantGrad)" />
              <Area type="monotone" dataKey="users" name="Usuarios" stroke="#F2693A" strokeWidth={2} fill="url(#userGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
