'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getDailyReport, getWeeklyReport, getMonthlyReport } from '@/lib/api/reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DollarSign, Car, CalendarDays, TrendingUp } from 'lucide-react';

type TabType = 'daily' | 'weekly' | 'monthly';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function DailyTab() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => getDailyReport(date),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Fecha:</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando reporte...</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total lavados"
              value={data.washes.total}
              subtitle={`${data.washes.completed} completados`}
              icon={Car}
            />
            <StatCard
              title="Ingresos"
              value={`$${data.washes.revenue?.toFixed(2) ?? '0.00'}`}
              subtitle={`Efectivo: $${data.washes.by_payment_method?.cash?.toFixed(2) ?? '0'}`}
              icon={DollarSign}
            />
            <StatCard
              title="Reservaciones"
              value={data.reservations.total}
              subtitle={`${data.reservations.pending} pendientes`}
              icon={CalendarDays}
            />
            <StatCard
              title="En progreso"
              value={data.washes.in_progress}
              icon={TrendingUp}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Desglose por método de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Efectivo</p>
                  <p className="text-xl font-bold">
                    ${data.washes.by_payment_method?.cash?.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Tarjeta</p>
                  <p className="text-xl font-bold">
                    ${data.washes.by_payment_method?.card?.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Transferencia</p>
                  <p className="text-xl font-bold">
                    ${data.washes.by_payment_method?.transfer?.toFixed(2) ?? '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No hay datos para la fecha seleccionada.
        </div>
      )}
    </div>
  );
}

function WeeklyTab() {
  const currentWeek = format(new Date(), "yyyy-'W'ww");
  const [week, setWeek] = useState(currentWeek);

  const { data, isLoading } = useQuery({
    queryKey: ['report-weekly', week],
    queryFn: () => getWeeklyReport(week),
  });

  const report = data as Record<string, unknown> | null | undefined;

  const totalWashes =
    typeof report?.total_washes === 'number'
      ? report.total_washes
      : typeof report?.washes === 'object' && report?.washes !== null
      ? (report.washes as Record<string, unknown>).total ?? '—'
      : '—';

  const revenue =
    typeof report?.revenue === 'number'
      ? `$${report.revenue.toFixed(2)}`
      : typeof report?.washes === 'object' && report?.washes !== null
      ? `$${((report.washes as Record<string, unknown>).revenue as number)?.toFixed(2) ?? '0.00'}`
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Semana:</label>
        <Input
          type="week"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="w-48"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando reporte...</div>
      ) : report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Total lavados"
            value={String(totalWashes)}
            icon={Car}
          />
          <StatCard
            title="Ingresos"
            value={String(revenue)}
            icon={DollarSign}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No hay datos para la semana seleccionada.
        </div>
      )}
    </div>
  );
}

function MonthlyTab() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [month, setMonth] = useState(currentMonth);

  const { data, isLoading } = useQuery({
    queryKey: ['report-monthly', month],
    queryFn: () => getMonthlyReport(month),
  });

  const report = data as Record<string, unknown> | null | undefined;

  const totalWashes =
    typeof report?.total_washes === 'number'
      ? report.total_washes
      : typeof report?.washes === 'object' && report?.washes !== null
      ? (report.washes as Record<string, unknown>).total ?? '—'
      : '—';

  const revenue =
    typeof report?.revenue === 'number'
      ? `$${report.revenue.toFixed(2)}`
      : typeof report?.washes === 'object' && report?.washes !== null
      ? `$${((report.washes as Record<string, unknown>).revenue as number)?.toFixed(2) ?? '0.00'}`
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Mes:</label>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando reporte...</div>
      ) : report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Total lavados"
            value={String(totalWashes)}
            icon={Car}
          />
          <StatCard
            title="Ingresos"
            value={String(revenue)}
            icon={DollarSign}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No hay datos para el mes seleccionado.
        </div>
      )}
    </div>
  );
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'daily', label: 'Diario' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('daily');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500">Estadísticas y resumen de operaciones</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'daily' && <DailyTab />}
      {activeTab === 'weekly' && <WeeklyTab />}
      {activeTab === 'monthly' && <MonthlyTab />}
    </div>
  );
}
