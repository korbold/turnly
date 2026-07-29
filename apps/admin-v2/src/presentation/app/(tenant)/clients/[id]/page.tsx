'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Pencil,
  CalendarDays,
  Activity,
  ClipboardList,
  Calendar,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Avatar, AvatarFallback } from '@/presentation/components/ui/avatar';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { useClient, useClientHistory } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { ClientForm } from '@/presentation/components/features/clients/client-form';
import { ClientBillingSection } from '@/presentation/components/features/clients/client-billing-section';
import { cn } from '@/shared/utils/cn';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

function getInitials(text: string | null | undefined): string {
  if (!text) return '?';
  return text
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function isSyntheticEmail(email: string | undefined | null): boolean {
  return !!email && /@client\.local$/i.test(email);
}

function ClientDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useClient(id);
  const { data: history } = useClientHistory(id);
  const { data: settings } = useSettings();

  const customFields = settings?.customFields ?? [];
  const historyItems = (history ?? []) as Array<{
    id: string;
    type: 'service' | 'reservation';
    date: string;
    serviceName?: string;
    amount?: number;
    status?: string;
    paymentStatus?: 'paid' | 'unpaid';
  }>;

  const serviceHistory = historyItems.filter((h) => h.type === 'service');
  const reservationHistory = historyItems.filter((h) => h.type === 'reservation');

  const clientData = (client?.data as Record<string, unknown> | null) ?? {};
  // Aggregates aren't persisted on the resource, so derive them from the
  // history (backend returns it sorted newest-first).
  const totalVisits = (clientData.totalVisits as number) ?? serviceHistory.length;
  const totalSpent =
    (clientData.totalSpent as number) ??
    serviceHistory
      .filter((h) => h.paymentStatus === 'paid')
      .reduce((sum, h) => sum + (h.amount ?? 0), 0);
  const lastVisit = (clientData.lastVisit as string) ?? (serviceHistory[0]?.date ?? null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-sm text-[var(--fg-secondary)]">Cliente no encontrado</p>
        <Button variant="link" onClick={() => router.push('/clients')}>
          Volver a clientes
        </Button>
      </div>
    );
  }

  const hasPlate = !!client.plate;
  const clientName = client.client?.name ?? null;
  const primary = hasPlate ? client.plate! : clientName ?? client.label ?? 'Sin identificar';
  const realEmail = !isSyntheticEmail(client.client?.email) ? client.client?.email : null;
  const vehicleChips = [client.brand, client.model, client.color, client.type].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Clientes
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
      </div>

      {/* Client info card */}
      <section
        aria-label="Información del cliente"
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="bg-[var(--ink-75)] text-[16px] font-semibold text-[var(--fg-strong)]">
              {getInitials(clientName ?? primary)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2
              className="text-[24px] font-bold leading-tight text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-display)', fontStretch: '90%', letterSpacing: '-0.01em' }}
            >
              {clientName ?? primary}
            </h2>
            {hasPlate && clientName && (
              <p
                className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--fg-secondary)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {client.plate}
              </p>
            )}
            {realEmail && (
              <p className="mt-1 text-[13px] text-[var(--fg-secondary)]">{realEmail}</p>
            )}

            {vehicleChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {vehicleChips.map((c) => (
                  <span
                    key={c as string}
                    className="rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--fg)]"
                  >
                    {c as string}
                  </span>
                ))}
              </div>
            )}

            {customFields.length > 0 && client.data && (
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {customFields.map((cf) => {
                  const val = (client.data as Record<string, unknown>)?.[cf.key];
                  if (val == null || val === '') return null;
                  return (
                    <div key={cf.key} className="flex flex-col gap-0.5">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                        {cf.label}
                      </dt>
                      <dd className="font-medium text-[var(--fg-strong)]">{String(val)}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* Stats: hero + split */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section
          aria-label="Total gastado"
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Total gastado
          </p>
          <p
            className="mt-2 text-[34px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {fmt(totalSpent)}
          </p>
          <p className="mt-2 text-[13px] text-[var(--fg-secondary)]">
            {totalVisits === 0
              ? 'Sin servicios todavía'
              : `${totalVisits} ${totalVisits === 1 ? 'servicio' : 'servicios'} registrados`}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section
            aria-label="Total de visitas"
            className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-sunken)]">
                <Activity className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Visitas
              </p>
            </div>
            <p
              className="mt-3 text-[22px] font-bold leading-none tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {totalVisits}
            </p>
          </section>

          <section
            aria-label="Última visita"
            className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-sunken)]">
                <CalendarDays className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Última visita
              </p>
            </div>
            <p
              className={cn(
                'mt-3 text-[15px] font-semibold leading-tight',
                lastVisit ? 'text-[var(--fg-strong)]' : 'text-[var(--fg-muted)]'
              )}
            >
              {lastVisit
                ? formatDistanceToNow(new Date(lastVisit), { addSuffix: true, locale: es })
                : 'Sin visitas'}
            </p>
          </section>
        </div>
      </div>

      {/* Datos de facturación — the client's real fiscal identity, editable
          here; this is the profile the SRI factura reads. Only for clients
          with an associated person (billing is keyed to the user). */}
      {client.client && <ClientBillingSection clientResourceId={id} />}

      {/* History tabs */}
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            Servicios{' '}
            <span className="ml-1.5 rounded-full bg-[var(--bg-sunken)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--fg-secondary)]">
              {serviceHistory.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reservations">
            Reservas{' '}
            <span className="ml-1.5 rounded-full bg-[var(--bg-sunken)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--fg-secondary)]">
              {reservationHistory.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-3">
          {serviceHistory.length === 0 ? (
            <EmptyHistory
              icon={ClipboardList}
              title="Sin servicios registrados"
              subtitle="Cuando registres un servicio para este cliente, aparecerá aquí."
            />
          ) : (
            <ul role="list" className="space-y-2">
              {serviceHistory.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--fg-strong)]">
                      {item.serviceName ?? 'Servicio'}
                    </p>
                    <p className="text-[12.5px] text-[var(--fg-secondary)]">
                      {format(new Date(item.date), "d 'de' MMMM yyyy · HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.amount != null && (
                      <span
                        className="text-[14px] font-bold tabular-nums text-[var(--fg-strong)]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {fmt(item.amount)}
                      </span>
                    )}
                    {item.status && (
                      <span
                        className={cn(
                          'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em]',
                          item.status === 'completed'
                            ? 'bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]'
                            : 'bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]'
                        )}
                      >
                        {item.status === 'completed' ? 'Completado' : 'En progreso'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="mt-3">
          {reservationHistory.length === 0 ? (
            <EmptyHistory
              icon={Calendar}
              title="Sin reservas registradas"
              subtitle="Las próximas reservas que cree este cliente aparecerán aquí."
            />
          ) : (
            <ul role="list" className="space-y-2">
              {reservationHistory.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--fg-strong)]">
                      {item.serviceName ?? 'Reserva'}
                    </p>
                    <p className="text-[12.5px] text-[var(--fg-secondary)]">
                      {format(new Date(item.date), "d 'de' MMMM yyyy · HH:mm", { locale: es })}
                    </p>
                  </div>
                  {item.status && (
                    <span className="whitespace-nowrap rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--fg-secondary)]">
                      {item.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} />
    </div>
  );
}

interface EmptyHistoryProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}

function EmptyHistory({ icon: Icon, title, subtitle }: EmptyHistoryProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
        <Icon className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
      </div>
      <p className="text-[15px] font-semibold text-[var(--fg-strong)]">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">{subtitle}</p>
    </div>
  );
}

export default function ClientDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ClientDetailContent />
    </Suspense>
  );
}
