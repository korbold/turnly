'use client';

import { Suspense, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Download } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Calendar } from '@/presentation/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useInvoices } from '@/presentation/hooks/use-invoices';
import type { InvoiceFilters, InvoiceStatus } from '@/domain/entities/invoice';

const BILLING_SERVICE_URL =
  process.env.NEXT_PUBLIC_BILLING_SERVICE_URL ?? 'http://localhost:8100';

const fmtCurrency = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function FacturasContent() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<InvoiceStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const filters: InvoiceFilters = {
    dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
    dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    status,
    page,
  };

  const { data, isLoading } = useInvoices(filters);
  const invoices = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">Facturas</h1>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, 'dd MMM', { locale: es }) : 'Desde'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(val) => { setDateFrom(val); setPage(1); }} initialFocus />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, 'dd MMM', { locale: es }) : 'Hasta'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(val) => { setDateTo(val); setPage(1); }} initialFocus />
          </PopoverContent>
        </Popover>

        <Select
          value={status ?? 'all'}
          onValueChange={(v) => { setStatus(v === 'all' ? undefined : (v as InvoiceStatus)); setPage(1); }}
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>

        {(dateFrom || dateTo || status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
              setStatus(undefined);
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay facturas con los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Servicio</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Clave acceso</th>
                <th className="px-3 py-2 text-center font-medium">XML</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{inv.logDate}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{inv.clientName ?? '—'}</div>
                    {inv.clientPlate && (
                      <div className="text-xs text-muted-foreground">{inv.clientPlate}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{inv.serviceName ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency.format(inv.priceCharged)}</td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.invoiceStatus} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[160px]">
                    {inv.claveAcceso ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {inv.invoiceStatus === 'autorizada' && inv.externalId ? (
                      <a
                        href={`${BILLING_SERVICE_URL}/api/invoices/${inv.externalId}/xml`}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.lastPage > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm self-center text-muted-foreground">
            {page} / {meta.lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FacturasPage() {
  return (
    <Suspense>
      <FacturasContent />
    </Suspense>
  );
}
