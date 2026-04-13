'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { getRangeReport, type RangeReport } from '@/lib/api/reports';
import { getServiceLogs } from '@/lib/api/service-log';
import { getReservations } from '@/lib/api/reservations';
import { DailyLogTable } from '@/components/service-log/DailyLogTable';
import { generateRangePDF } from '@/lib/generate-range-pdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DollarSign, Car, CalendarDays, FileDown, Calendar } from 'lucide-react';

interface DateRange {
  from: Date;
  to: Date;
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Hoy', range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Ayer', range: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Esta semana', range: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfDay(new Date()) }) },
  { label: 'Semana pasada', range: () => {
    const prev = subWeeks(new Date(), 1);
    return { from: startOfWeek(prev, { weekStartsOn: 1 }), to: endOfWeek(prev, { weekStartsOn: 1 }) };
  }},
  { label: 'Últimas 2 semanas', range: () => ({ from: startOfDay(subWeeks(new Date(), 2)), to: endOfDay(new Date()) }) },
  { label: 'Este mes', range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Mes pasado', range: () => {
    const prev = subMonths(new Date(), 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }},
  { label: 'Este año', range: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }) },
];

function StatCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle?: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(today),
    to: endOfDay(today),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRange, setPickerRange] = useState<{ from?: Date; to?: Date }>({
    from: dateRange.from,
    to: dateRange.to,
  });

  const fromStr = format(dateRange.from, 'yyyy-MM-dd');
  const toStr = format(dateRange.to, 'yyyy-MM-dd');
  const isSingleDay = fromStr === toStr;

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-range', fromStr, toStr],
    queryFn: () => getRangeReport(fromStr, toStr),
  });

  const { data: logsData } = useQuery({
    queryKey: ['service-logs-range', fromStr],
    queryFn: () => getServiceLogs({ date: fromStr, per_page: 100 }),
    enabled: isSingleDay,
  });

  const { data: reservationsData } = useQuery({
    queryKey: ['reservations-range', fromStr],
    queryFn: () => getReservations({ date: fromStr, per_page: 100 }),
    enabled: isSingleDay,
  });

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const range = preset.range();
    setDateRange(range);
    setPickerRange({ from: range.from, to: range.to });
    setPickerOpen(false);
  };

  const handlePickerApply = () => {
    if (pickerRange.from && pickerRange.to) {
      setDateRange({ from: pickerRange.from, to: pickerRange.to });
    } else if (pickerRange.from) {
      setDateRange({ from: pickerRange.from, to: pickerRange.from });
    }
    setPickerOpen(false);
  };

  const rangeLabel = isSingleDay
    ? format(dateRange.from, "d 'de' MMMM yyyy", { locale: es })
    : `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500">Estadísticas y resumen de operaciones</p>
        </div>
        {report && (
          <Button variant="outline" onClick={() => generateRangePDF(report)}>
            <FileDown className="h-4 w-4 mr-1" />
            Descargar PDF
          </Button>
        )}
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="justify-start text-left font-normal min-w-[280px]"
          onClick={() => setPickerOpen(true)}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {rangeLabel}
        </Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Seleccionar rango de fechas</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4">
            {/* Presets */}
            <div className="flex flex-col gap-1 min-w-[160px] border-r pr-4">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <div className="flex flex-col gap-3">
              <DayPicker
                mode="range"
                selected={pickerRange.from && pickerRange.to ? { from: pickerRange.from, to: pickerRange.to } : undefined}
                onSelect={(range) => {
                  setPickerRange({ from: range?.from, to: range?.to });
                }}
                numberOfMonths={2}
                locale={es}
                weekStartsOn={1}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handlePickerApply}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando reporte...</div>
      ) : report ? (
        <>
          {/* Stat Cards */}
          <div className="stat-cards-scroll">
            <StatCard
              title="Total atenciones"
              value={report.total_services}
              subtitle={`${report.services_count} servicios, ${report.reservations_count} reservaciones`}
              icon={Car}
            />
            <StatCard
              title="Ingresos"
              value={`$${report.total_revenue.toFixed(2)}`}
              subtitle={`Efectivo: $${report.by_payment_method.cash.toFixed(2)}`}
              icon={DollarSign}
            />
            <StatCard
              title="Reservaciones"
              value={report.reservations_total}
              subtitle={`${report.reservations_cancelled} canceladas`}
              icon={CalendarDays}
            />
            <StatCard
              title="Promedio diario"
              value={report.daily.length > 0
                ? `$${(report.total_revenue / report.daily.length).toFixed(2)}`
                : '$0.00'}
              subtitle={`${report.daily.length} días`}
              icon={DollarSign}
            />
          </div>

          {/* Detail table - only for single day */}
          {isSingleDay && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle del día</CardTitle>
              </CardHeader>
              <CardContent>
                <DailyLogTable
                  logs={logsData?.data ?? []}
                  reservations={reservationsData?.data ?? []}
                  date={fromStr}
                />
              </CardContent>
            </Card>
          )}

          {/* Daily breakdown - for ranges > 1 day */}
          {!isSingleDay && (
            <Card>
              <CardHeader>
                <CardTitle>Desglose por día</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-500">Fecha</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Servicios</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Reservaciones</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.filter(d => d.services > 0 || d.reservations > 0).map((d) => (
                        <tr key={d.date} className="border-b last:border-0">
                          <td className="py-2">
                            {format(new Date(d.date + 'T12:00:00'), "EEE dd/MM", { locale: es })}
                          </td>
                          <td className="py-2 text-right">{d.services}</td>
                          <td className="py-2 text-right">{d.reservations}</td>
                          <td className="py-2 text-right font-medium">${d.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                      {report.daily.filter(d => d.services > 0 || d.reservations > 0).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground">
                            No hay datos en este rango.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Desglose por método de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Efectivo</p>
                  <p className="text-xl font-bold">${report.by_payment_method.cash.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Tarjeta</p>
                  <p className="text-xl font-bold">${report.by_payment_method.card.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Transferencia</p>
                  <p className="text-xl font-bold">${report.by_payment_method.transfer.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No hay datos para el rango seleccionado.
        </div>
      )}
    </div>
  );
}
