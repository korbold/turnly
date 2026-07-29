'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Wallet,
  CheckCircle2,
  FileText,
  Pencil,
  Receipt,
  Play,
  Trophy,
  Car,
  User as UserIcon,
  Clock,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import {
  useServiceLog,
  useCompleteServiceLog,
} from '@/presentation/hooks/use-service-logs';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { RegisterPaymentDialog } from '@/presentation/components/features/service-logs/register-payment-dialog';
import { FiscalProfileDialog } from '@/presentation/components/features/service-logs/fiscal-profile-dialog';
import { EditServiceLogDialog } from '@/presentation/components/features/service-logs/edit-service-log-dialog';
import type { PaymentMethod } from '@/domain/entities/service-log';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12.5px] text-[var(--fg-secondary)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[var(--fg-strong)]">{value ?? '—'}</span>
    </div>
  );
}

function ServiceLogDetail({ id }: { id: string }) {
  const { data: log, isLoading } = useServiceLog(id);
  const completeMutation = useCompleteServiceLog();
  const emitMutation = useEmitInvoice();

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  if (isLoading || !log) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isUnpaid = log.paymentStatus === 'unpaid';
  const recurso =
    log.clientResource?.plate ||
    log.clientResource?.client?.name ||
    log.clientResource?.label ||
    'Sin recurso';
  const items = log.items ?? [];
  const total = log.priceCharged;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/service-logs"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--fg-secondary)] hover:text-[var(--fg-strong)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Registro Diario
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-bold text-[var(--fg-strong)]">{recurso}</h1>
            <p className="mt-0.5 text-[13px] text-[var(--fg-secondary)]">
              {log.servicesSummary && log.servicesSummary.count > 1
                ? `${log.servicesSummary.labels[0]} +${log.servicesSummary.count - 1} más`
                : log.service?.name ?? '—'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                'inline-flex items-center gap-1.5 border-0 px-2.5 py-1 text-[11.5px] font-semibold',
                log.status === 'in_progress'
                  ? 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]'
                  : 'bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]',
              )}
            >
              {log.status === 'in_progress' ? (
                <Play className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Trophy className="h-3 w-3" aria-hidden="true" />
              )}
              {log.status === 'in_progress' ? 'En progreso' : 'Completado'}
            </Badge>
            <InvoiceStatusBadge status={log.invoiceStatus} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isUnpaid ? (
            <Button
              onClick={() => setPayOpen(true)}
              className="cursor-pointer gap-1.5 bg-[var(--warning-600)] text-white hover:bg-[var(--warning-700)]"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Cobrar
            </Button>
          ) : (
            log.invoiceStatus !== 'autorizada' && (
              <Button
                onClick={() =>
                  emitMutation.mutate(log.id, {
                    onSuccess: () => toast.success('Facturación iniciada'),
                    onError: () => toast.error('Error al iniciar facturación'),
                  })
                }
                disabled={emitMutation.isPending}
                className="cursor-pointer gap-1.5 bg-[var(--info-500)] text-white hover:bg-[var(--info-700)]"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {log.invoiceStatus === 'rechazada' ? 'Reintentar factura' : 'Facturar'}
              </Button>
            )
          )}
          {log.status === 'in_progress' && (
            <Button
              variant="outline"
              onClick={() =>
                completeMutation.mutate(log.id, {
                  onSuccess: () => toast.success('Servicio completado'),
                  onError: () => toast.error('Error al completar'),
                })
              }
              disabled={completeMutation.isPending}
              className="cursor-pointer gap-1.5 border-[var(--success-200)] text-[var(--success-700)] hover:bg-[var(--success-50)]"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Completar
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)} className="cursor-pointer gap-1.5">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
          {log.clientResource?.client && (
            <Button variant="outline" onClick={() => setBillingOpen(true)} className="cursor-pointer gap-1.5">
              <Receipt className="h-4 w-4" aria-hidden="true" />
              Datos de facturación
            </Button>
          )}
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Items */}
          <Card title="Detalle del servicio">
            {items.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((it) => (
                  <li key={it.id} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="min-w-0 text-[13.5px] text-[var(--fg-strong)]">
                      {it.label}
                      {it.qty > 1 && (
                        <span className="ml-1 text-[12px] text-[var(--fg-muted)]">×{it.qty}</span>
                      )}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--fg-strong)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {fmt(it.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--fg-secondary)]">{log.service?.name ?? 'Servicio'}</p>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
                Total
              </span>
              <span
                className="font-mono text-[18px] font-bold tabular-nums text-[var(--fg-strong)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {fmt(total)}
              </span>
            </div>
          </Card>

          {/* Factura */}
          <Card title="Factura electrónica (SRI)">
            <Row
              label="Estado"
              value={log.invoiceStatus ? <InvoiceStatusBadge status={log.invoiceStatus} /> : 'Sin emitir'}
            />
            {log.invoiceNumeroAutorizacion && (
              <Row label="N° autorización" value={<span className="font-mono text-[12px]">{log.invoiceNumeroAutorizacion}</span>} />
            )}
            {log.invoiceClaveAcceso && (
              <Row label="Clave de acceso" value={<span className="break-all font-mono text-[11px]">{log.invoiceClaveAcceso}</span>} />
            )}
            {log.invoicedAt && (
              <Row label="Emitida" value={format(new Date(log.invoicedAt), "d MMM yyyy, HH:mm", { locale: es })} />
            )}
            {log.invoiceStatus === 'rechazada' && log.invoiceError && (
              <p className="mt-2 rounded-md bg-[var(--danger-50)] px-3 py-2 text-[12px] text-[var(--danger-700)]">
                {log.invoiceError}
              </p>
            )}
          </Card>

          {log.notes && (
            <Card title="Notas">
              <p className="whitespace-pre-line text-[13px] text-[var(--fg-strong)]">{log.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card title="Pago">
            <Row
              label="Estado"
              value={
                isUnpaid ? (
                  <span className="text-[var(--warning-700)]">Pendiente</span>
                ) : (
                  <span className="text-[var(--success-700)]">Pagado</span>
                )
              }
            />
            {log.paymentMethod && <Row label="Método" value={PAYMENT_LABEL[log.paymentMethod]} />}
            {log.paymentBank && <Row label="Banco" value={log.paymentBank} />}
            {log.paidAt && (
              <Row label="Fecha de pago" value={format(new Date(log.paidAt), "d MMM yyyy, HH:mm", { locale: es })} />
            )}
          </Card>

          <Card title="Cliente">
            <div className="flex items-start gap-2.5">
              <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--fg-strong)]">
                  {log.clientResource?.client?.name ?? 'Sin cliente'}
                </p>
                {log.clientResource?.client?.email && (
                  <p className="truncate text-[12px] text-[var(--fg-secondary)]">
                    {log.clientResource.client.email}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Recurso">
            <div className="flex items-start gap-2.5">
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
              <div className="min-w-0 text-[13.5px] text-[var(--fg-strong)]">{recurso}</div>
            </div>
          </Card>

          <Card title="Tiempos">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
              <div className="w-full">
                <Row label="Iniciado" value={format(new Date(log.startedAt), "d MMM yyyy, HH:mm", { locale: es })} />
                {log.finishedAt && (
                  <Row label="Finalizado" value={format(new Date(log.finishedAt), "d MMM yyyy, HH:mm", { locale: es })} />
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Dialogs (reused from the list) */}
      <RegisterPaymentDialog serviceLogId={log.id} total={total} open={payOpen} onClose={() => setPayOpen(false)} />
      <EditServiceLogDialog log={editOpen ? log : null} open={editOpen} onClose={() => setEditOpen(false)} />
      <FiscalProfileDialog
        serviceLogId={log.id}
        clientName={log.clientResource?.client?.name}
        open={billingOpen}
        onClose={() => setBillingOpen(false)}
      />
    </div>
  );
}

export default function ServiceLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ServiceLogDetail id={id} />;
}
