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
  Undo2,
  Ban,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { apiErrorCode, apiErrorMessage } from '@/shared/utils/api-error';
import {
  useServiceLog,
  useCompleteServiceLog,
  useRevertServiceLogPayment,
} from '@/presentation/hooks/use-service-logs';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { useSettings } from '@/presentation/hooks/use-settings';
import { describeServiceLogEvent } from '@/shared/utils/service-log-events';
import { AssignStaffDialog } from '@/presentation/components/features/service-logs/assign-staff-dialog';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { RegisterPaymentDialog } from '@/presentation/components/features/service-logs/register-payment-dialog';
import { FiscalProfileDialog } from '@/presentation/components/features/service-logs/fiscal-profile-dialog';
import { EditServiceLogDialog } from '@/presentation/components/features/service-logs/edit-service-log-dialog';
import { CancelLogDialog } from '@/presentation/components/features/service-logs/cancel-log-dialog';
import type { PaymentMethod } from '@/domain/entities/service-log';
import { formatInvoiceError } from '@/shared/utils/format-invoice-error';

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

  const revertMutation = useRevertServiceLogPayment();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  // Abierto desde Completar: exige ambos y completa al guardar.
  const [assignToComplete, setAssignToComplete] = useState(false);
  const { canAssign, isOwnerOrAdmin } = usePermissions();
  const { data: settings } = useSettings();
  const isCarWash = settings?.businessType === 'car_wash';

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
  const anulado = log.status === 'cancelled';
  const recurso =
    log.clientResource?.label ||
    log.clientResource?.plate ||
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

        {/* Actions — un registro anulado es historia: no se cobra, no se
            completa, no se edita, no se factura. */}
        {anulado ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2.5">
            <p className="text-[13px] font-medium text-[var(--fg-strong)]">
              Registro anulado{log.cancelReasonLabel ? ` · ${log.cancelReasonLabel}` : ''}
            </p>
            {log.cancelReasonNote && (
              <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">{log.cancelReasonNote}</p>
            )}
            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
              Queda a la vista como historia, fuera de los totales del día.
            </p>
          </div>
        ) : (
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
                    onError: (e) => toast.error(apiErrorMessage(e, 'Error al iniciar facturación'), { duration: 8000 }),
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
          {log.status === 'in_progress' && !anulado && (
            <Button
              variant="outline"
              onClick={() => {
                // Mismo trato que en la lista: quién hace falta lo dice el
                // servicio y lo resuelve el backend. Su 422 abre el diálogo.
                completeMutation.mutate(log.id, {
                  onSuccess: () => toast.success('Servicio completado'),
                  onError: (e) => {
                    if (apiErrorCode(e) === 'ASSIGNEES_REQUIRED') {
                      setAssignToComplete(true);
                      setAssignOpen(true);
                      toast.error(apiErrorMessage(e, 'Faltan asignados.'));
                      return;
                    }
                    toast.error(apiErrorMessage(e, 'Error al completar'));
                  },
                });
              }}
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
        )}
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
              <p
                className="mt-2 rounded-md bg-[var(--danger-50)] px-3 py-2 text-[12px] text-[var(--danger-700)]"
                title={log.invoiceError}
              >
                {formatInvoiceError(log.invoiceError)}
              </p>
            )}
          </Card>

          {log.notes && (
            <Card title="Notas">
              <p className="whitespace-pre-line text-[13px] text-[var(--fg-strong)]">{log.notes}</p>
            </Card>
          )}

          {/* La bitácora vive en la columna ancha: es lo único de esta pantalla
              que se lee de corrido, y la derecha es una pila de resúmenes. */}
          {(log.events ?? []).length > 0 && (
            <Card title="Bitácora">
              <ol className="space-y-2.5">
                {(log.events ?? []).map((event) => (
                  <li key={event.id} className="border-l-2 border-[var(--border)] pl-2.5">
                    <p className="text-[12.5px] text-[var(--fg-strong)]">
                      {describeServiceLogEvent(event)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">
                      {format(new Date(event.changedAt), "d MMM, HH:mm", { locale: es })}
                      {' · '}
                      {/* Sin actor = lo hizo el SRI, no una persona. */}
                      {event.changedBy?.name ?? 'SRI'}
                    </p>
                  </li>
                ))}
              </ol>
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

            {/* Anular vive acá y no en el menú de la fila: deshacer plata no
                puede estar a un clic en una lista donde el dedo va rápido.
                Sólo dueño o admin —el backend lo exige igual— y nunca sobre
                algo facturado, que se corrige con nota de crédito. */}
            {!isUnpaid && isOwnerOrAdmin && log.invoiceStatus === null && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('¿Revertir el pago de este registro? El servicio queda, pero vuelve a estar por cobrar.')) return;
                  revertMutation.mutate(log.id, {
                    onSuccess: () => toast.success('Pago revertido. El registro quedó por cobrar.'),
                    onError: (e) => toast.error(apiErrorMessage(e, 'No se pudo revertir el pago')),
                  });
                }}
                disabled={revertMutation.isPending}
                className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--danger-700)] hover:underline disabled:opacity-60"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                {revertMutation.isPending ? 'Revirtiendo…' : 'Revertir pago'}
              </button>
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

          {isCarWash && (
            <Card title="Asignados">
              <Row label="Lavador" value={log.washer?.name ?? 'Sin asignar'} />
              <Row label="Secador" value={log.dryer?.name ?? 'Sin asignar'} />
              {/* Quién atendió el mostrador y cobró. No es un asignado, pero es
                  lo primero que se pregunta cuando la caja no cuadra. */}
              <Row label="Registrado por" value={log.attendant?.name ?? '—'} />
              {!anulado && canAssign(log.status === 'completed') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => { setAssignToComplete(false); setAssignOpen(true); }}
                >
                  Cambiar
                </Button>
              )}
            </Card>
          )}

        </div>
      </div>

      {/* Anular vive al pie y separado del resto: es lo único acá que mata el
          registro, y no puede compartir jerarquía con Cobrar o Editar. Sólo
          dueño o admin —el backend lo exige igual— y nunca sobre algo
          facturado, que se corrige con nota de crédito. */}
      {!anulado && isOwnerOrAdmin && log.invoiceStatus === null && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--danger-700)] hover:underline"
          >
            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
            Anular registro
          </button>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            El registro deja de contar en el día pero queda a la vista, con el
            motivo y quién lo anuló.
          </p>
        </div>
      )}

      <CancelLogDialog log={log} open={cancelOpen} onClose={() => setCancelOpen(false)} />

      {/* Dialogs (reused from the list) */}
      <RegisterPaymentDialog serviceLogId={log.id} total={total} open={payOpen} onClose={() => setPayOpen(false)} />
      <EditServiceLogDialog log={editOpen ? log : null} open={editOpen} onClose={() => setEditOpen(false)} />
      {assignOpen && (
        <AssignStaffDialog
          log={log}
          open
          thenComplete={assignToComplete}
          reason={assignToComplete ? 'Asigná quién hizo el trabajo para poder completar el servicio.' : undefined}
          onClose={() => { setAssignOpen(false); setAssignToComplete(false); }}
        />
      )}
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
