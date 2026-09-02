'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, CheckCircle2, Pencil, Plus, ClipboardList, Wallet, Play, Trophy, FileText, Receipt, Eye, Loader2, ChevronLeft, ChevronRight, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { formatCurrency } from '@/shared/utils/format';
import { apiErrorCode, apiErrorMessage } from '@/shared/utils/api-error';
import {
  useServiceLogs,
  useCompleteServiceLog,
} from '@/presentation/hooks/use-service-logs';
import { PAYMENT_METHOD_CONFIG } from '@/shared/constants/status';
import { RegisterPaymentDialog } from '@/presentation/components/features/service-logs/register-payment-dialog';
import { CompleteServiceDialog } from '@/presentation/components/features/service-logs/complete-service-dialog';
import { FiscalProfileDialog } from '@/presentation/components/features/service-logs/fiscal-profile-dialog';
import { InvoiceStatusBadge } from '@/presentation/components/features/service-logs/invoice-status-badge';
import { useEmitInvoice } from '@/presentation/hooks/use-invoices';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import { useSettings } from '@/presentation/hooks/use-settings';
import { AssignStaffDialog } from '@/presentation/components/features/service-logs/assign-staff-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import type { ServiceLog, ServiceLogStatus, PaymentFilter, PageSize } from '@/domain/entities/service-log';
import { formatCounterCurrency } from '@/shared/utils/format';

const STATUS_CONFIG: Record<ServiceLogStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'En progreso', color: 'text-[var(--status-progress-fg)]', bg: 'bg-[var(--status-progress-bg)]' },
  completed: { label: 'Completado', color: 'text-[var(--status-completed-fg)]', bg: 'bg-[var(--status-completed-bg)]' },
  // Anulado no es un estado del trabajo sino su epitafio: la fila queda para
  // que se vea que existió, en gris y sin acciones.
  cancelled: { label: 'Anulado', color: 'text-[var(--fg-muted)]', bg: 'bg-[var(--bg-sunken)]' },
};

const fmt = formatCounterCurrency;
/** Con centavos siempre: un desvío de $0.25 no puede leerse como "$15 → $15". */
const fmtCents = (v: number) => formatCurrency(v, { decimals: true });

/** Lo que el ícono de precio modificado no dice en pantalla. Es la única
    versión escrita de la marca, así que lleva el hecho entero: cuánto era,
    cuánto se cobró, por qué y quién lo decidió. */
const priceChangeLabel = (pc: NonNullable<ServiceLog['priceChange']>) =>
  [
    `Precio modificado: ${fmtCents(pc.catalog)} → ${fmtCents(pc.charged)}`,
    pc.reasonLabel,
    pc.by,
    pc.changes > 1 ? `${pc.changes} cambios` : null,
    'Abrir el detalle',
  ]
    .filter(Boolean)
    .join(' · ')

interface LogListProps {
  date: string;
  payment?: PaymentFilter;
  status?: 'in_progress' | 'completed';
  q?: string;
  page?: number;
  perPage?: PageSize;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (size: PageSize) => void;
  onEdit?: (log: ServiceLog) => void;
  /** Recibe el texto buscado cuando el vacío viene de una búsqueda sin resultados. */
  onCreate?: (prefill?: string) => void;
  /** Dashboard preview: no pager, no size selector — the full list is a click away. */
  compact?: boolean;
}

export function LogList({
  date,
  payment,
  status,
  q,
  page = 1,
  perPage = '15',
  onPageChange,
  onPerPageChange,
  onEdit,
  onCreate,
  compact = false,
}: LogListProps) {
  const router = useRouter();
  const { data, isLoading } = useServiceLogs({ date, payment, status, q, page, perPage });
  const completeMutation = useCompleteServiceLog();
  const emitInvoiceMutation = useEmitInvoice();
  // Erasing a service is granted per role in Configuración → Permisos
  // (default: Admin only). A cashier without it asks instead. The backend
  // reads the same matrix.
  const { data: settings } = useSettings();
  const isCarWash = settings?.businessType === 'car_wash';
  const [assignTarget, setAssignTarget] = useState<{
    log: ServiceLog;
    reason?: string;
    thenComplete?: boolean;
    leftOwing?: boolean;
  } | null>(null);
  const [payTarget, setPayTarget] = useState<ServiceLog | null>(null);
  const [billingTarget, setBillingTarget] = useState<ServiceLog | null>(null);

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const lastPage = data?.meta?.lastPage ?? 1;
  const currentPage = data?.meta?.currentPage ?? 1;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * (data?.meta?.perPage ?? 0) + 1;
  const rangeEnd = Math.min(rangeStart + logs.length - 1, total);

  const [completeTarget, setCompleteTarget] = useState<ServiceLog | null>(null);

  function handleComplete(log: ServiceLog) {
    // Quién hace falta lo decide el servicio, no la fila: un cambio de aceite
    // no lleva a nadie y una lavada completa lleva dos. La fila no conoce el
    // `staffing` de sus líneas, así que no se adivina acá — se intenta
    // completar y, si el backend contesta que faltan asignados, su 422 abre el
    // diálogo con el motivo. Una sola fuente de la regla.
    // Con saldo pendiente hay una pregunta que hacer antes de cerrar: esto
    // es deuda o es un olvido. Nadie más va a saber la respuesta después.
    if (log.amountDue > 0.005) {
      setCompleteTarget(log);
      return;
    }

    completeMutation.mutate(log.id, {
      onSuccess: () => toast.success('Servicio completado'),
      onError: (e) => {
        // Si lo que falta es el secador, el backend es quien lo sabe. Abrir el
        // diálogo con su mensaje es la diferencia entre "arreglalo acá" y un
        // toast de "Error al completar" que no dice qué hacer.
        if (apiErrorCode(e) === 'ASSIGNEES_REQUIRED') {
          setAssignTarget({ log, reason: apiErrorMessage(e, 'Faltan asignados.'), thenComplete: true });
          return;
        }
        toast.error(apiErrorMessage(e, 'Error al completar'));
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    // An empty result under a filter is not an empty day — saying "aún no
    // registras servicios" there reads as data loss, and offering to create a
    // service is the wrong next step when the row probably exists unfiltered.
    //
    // Con una BÚSQUEDA el razonamiento se da vuelta: si el mostrador escribió
    // una placa y el día no la tiene, es porque ese auto todavía no vino, y
    // registrarlo es exactamente el paso siguiente. Por eso la búsqueda se
    // separa de los filtros de pago y estado, donde la fila sí existe y sólo
    // está tapada.
    const buscada = q?.trim() ?? '';
    const conFiltros = !!payment || !!status;
    const soloBusqueda = !!buscada && !conFiltros;
    const filtered = conFiltros || !!buscada;

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
          <ClipboardList className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
          {soloBusqueda
            ? 'Sin servicios hoy para esa búsqueda'
            : filtered
              ? 'Sin resultados para este filtro'
              : 'Aún no registras servicios hoy'}
        </p>
        <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
          {soloBusqueda
            ? 'Ese cliente no tiene servicios registrados hoy. Podés registrarle uno ahora.'
            : filtered
              ? 'Prueba con otra búsqueda o limpia los filtros para ver todo el día.'
              : 'Cada vez que completes un servicio, anótalo aquí para llevar caja del día.'}
        </p>
        {onCreate && !conFiltros && (
          <Button onClick={() => onCreate(soloBusqueda ? buscada : undefined)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {soloBusqueda ? `Registrar servicio para ${buscada}` : 'Registrar servicio'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Desktop header — proportions match the row grid below. The
          last slot (estado + acciones) is wider than before because
          the "Cobrar"/"Completar" labeled buttons no longer fit in
          180px next to the status badge + overflow ⋯, which was
          clipping them at the right edge. */}
      <div className="hidden rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)] xl:grid xl:grid-cols-[60px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_84px_112px_minmax(368px,auto)] xl:items-center xl:gap-3">
        <span>Hora</span>
        <span>Recurso</span>
        <span>Servicio</span>
        <span>Empleado</span>
        <span className="text-right">Precio</span>
        <span>Pago</span>
        <span className="text-right">Estado · Acciones</span>
      </div>

      {logs.map((log, idx) => {
        const statusCfg = STATUS_CONFIG[log.status];
        const pmCfg = log.paymentMethod ? PAYMENT_METHOD_CONFIG[log.paymentMethod] : null;
        // Dos tramos del MISMO método (dos abonos en efectivo) no son un pago
        // partido: mostrarlos por separado no le dice nada nuevo al mostrador.
        // Lo que confunde es que el ticket entró por dos vías distintas.
        const partido = new Set(log.paymentBreakdown.map((p) => p.method)).size > 1;
        // "Falta cobrar", no "no se cobró nada": un servicio con $10 de $30
        // sigue necesitando el botón de Cobrar. Comparar contra 'unpaid'
        // dejaba los abonos sin forma de cobrarse desde la lista.
        // Un registro anulado no debe nada ni tiene trabajo abierto: es
        // historia. Sin esto la fila seguiría pidiendo cobrar plata que ya se
        // revirtió.
        const anulado = log.status === 'cancelled';
        const isOwing = !anulado && log.paymentStatus !== 'paid';
        const isPartial = !anulado && log.paymentStatus === 'partial';
        const inProgress = !anulado && log.status === 'in_progress';
        // Los tramos se imprimen cuando aportan algo que el chip no dice: un
        // cobro partido (el chip mostraría un solo método) o una fila que
        // todavía debe y ya recibió plata (el chip habla de lo que falta, no
        // de por dónde entró lo que hay). Un cobro completo con un método
        // único sigue siendo un chip, como siempre.
        const mostrarTramos = log.paymentBreakdown.length > 0 && (partido || isOwing);
        // The row carries both axes at once: blue for work still open (the
        // "En progreso" badge's own colour), amber for money still owed (the
        // "Sin cobrar" tile's). A row that is both fades one into the other
        // rather than picking a winner. Done and paid stays plain — nothing
        // left to do on it.
        const rowTint = anulado
          ? 'border-[var(--border)] bg-[var(--bg-sunken)]/60 opacity-70 hover:opacity-100'
          : inProgress
          ? isOwing
            ? 'border-[var(--warning-200)] bg-gradient-to-r from-[var(--status-progress-bg)] to-[var(--warning-50)] hover:from-[var(--info-200)] hover:to-[var(--warning-100)]'
            : 'border-[var(--info-200)] bg-[var(--status-progress-bg)] hover:bg-[var(--info-200)]'
          : isOwing
            ? 'border-[var(--warning-200)] bg-[var(--warning-50)] hover:bg-[var(--warning-100)]'
            : 'border-[var(--border)] bg-white hover:bg-[var(--bg-sunken)]/40';
        // Recurso = the vehicle/resource, never the client name (the client
        // has its own column/sub-line). Prefer the composed label, then plate.
        // A counter sale is not a ticket missing its vehicle — it is a
        // product handed over with nothing to attach it to, so name it
        // instead of showing "Sin recurso" like a broken row.
        const isCounterSale = !log.clientResource && !log.service;
        // `log_date` viaja como ISO en UTC ("2026-08-30T00:00:00.000000Z"):
        // parsearlo entero en -05 devuelve el día anterior, así que se corta
        // a la fecha desnuda antes de leerla. Vacío cuando la fila es del día
        // que se está mirando, que es el caso normal.
        const registeredOn = (() => {
          const raw = log.logDate?.slice(0, 10);
          return raw && raw !== date ? raw : null;
        })();
        const recursoLabel =
          log.clientResource?.label ||
          log.clientResource?.plate ||
          (isCounterSale ? 'Venta de mostrador' : 'Sin recurso');
        const serviceLabel = (() => {
          const summary = log.servicesSummary;
          if (summary && summary.count > 1) {
            const head = summary.labels[0] ?? log.service?.name ?? '';
            const extra = summary.count - 1;
            return `${head} +${extra} más`;
          }
          return summary?.labels[0] ?? log.service?.name ?? 'N/A';
        })();

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={cn(
              'rounded-lg border p-3 transition-colors',
              // Alineado por la PRIMERA línea, no por el centro: las celdas tienen
              // alturas distintas (el recurso puede traer chip de deuda, el
              // empleado tres líneas) y centrarlas dejaba la placa arriba del
              // nombre del servicio. La primera línea es la que el ojo usa
              // para escanear la fila.
              // Debajo de `xl` no es una tabla: es una tarjeta de dos columnas.
              // Meter siete columnas en una tablet trunca todo a "PBT…", y
              // apilarlas hace que un servicio coma media pantalla. La
              // tarjeta pone hora y precio en la misma línea, y el chip de
              // pago junto a los botones: cuatro filas en vez de ocho.
              'grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5',
              // Alineado por la PRIMERA línea, no por el centro: las celdas
              // tienen alturas distintas (el recurso puede traer chip de
              // deuda, el empleado tres líneas) y centrarlas dejaba la placa
              // arriba del nombre del servicio. La primera línea es la que el
              // ojo usa para escanear.
              //
              // El piso de 368px en la última columna no es estético: cada
              // fila es su PROPIA grilla, así que una columna `auto` cambia de
              // ancho según cuántos botones tenga la fila y arrastra a todas
              // las demás. Con `auto` puro los precios caían en tres x
              // distintos (350 / 280 / 359 medidos). El piso cubre el caso más
              // ancho normal y deja que sólo el raro —"Reintentar factura" con
              // badge de estado— lo supere.
              'xl:grid-cols-[60px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_84px_112px_minmax(368px,auto)] xl:items-start xl:gap-3',
              rowTint,
            )}
          >
            {/* Hora — bigger weight on mobile to read like a chip,
                lighter on desktop where the column header carries it. */}
            <div className="col-start-1 row-start-1 xl:col-auto xl:row-auto">
              <span className="block font-mono text-[14px] font-semibold tabular-nums text-[var(--fg-strong)] xl:font-normal" style={{ fontFamily: 'var(--font-mono)' }}>
                {format(new Date(log.startedAt), 'HH:mm')}
              </span>
              {/* Un registro de otra fecha entra a esta lista porque su plata
                  entró HOY —la caja ya lo suma en "Ingresos del día"— pero la
                  hora sola lo haría pasar por trabajo de hoy y le inventaría
                  al día un servicio que no hizo. La fecha de registro va
                  debajo, en el mismo ámbar que marca lo que falta cobrar. */}
              {registeredOn && (
                <span
                  className="mt-0.5 inline-block rounded px-1 py-px text-[10.5px] font-semibold leading-tight text-[var(--warning-700)] ring-1 ring-inset ring-[var(--warning-200)]"
                  title={`Registrado el ${format(parseISO(registeredOn), "d 'de' MMMM", { locale: es })} · cobrado en esta fecha`}
                >
                  {format(parseISO(registeredOn), 'd MMM', { locale: es })}
                </span>
              )}
            </div>

            {/* Recurso */}
            <div className="col-span-3 row-start-2 min-w-0 xl:col-span-1 xl:row-auto">
              <p
                className={cn(
                  'truncate text-[13.5px] font-medium',
                  isCounterSale ? 'italic text-[var(--fg-muted)]' : 'text-[var(--fg-strong)]',
                )}
                title={recursoLabel}
              >
                {recursoLabel}
              </p>
              {log.clientResource?.client?.name && log.clientResource?.plate && (
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)] xl:hidden">
                  {log.clientResource.client.name}
                </p>
              )}
              {/* Deuda vieja de la placa. Va junto al vehículo y no en la
                  columna PAGO porque no es de este servicio: es lo que el
                  cajero puede pedir mientras el cliente está en el mostrador,
                  que es el único momento en que se puede pedir. */}
              {log.otherDebt > 0 && (
                <span
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--danger-50)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger-700)] ring-1 ring-[var(--danger-200)]"
                  title="Deuda anterior de esta placa, aparte de este servicio"
                >
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  debe {fmt(log.otherDebt)}
                </span>
              )}
            </div>

            {/* Servicio */}
            <div className="col-span-3 row-start-3 min-w-0 xl:col-span-1 xl:row-auto">
              <p className="truncate text-[13.5px] text-[var(--fg-strong)]" title={serviceLabel}>
                {serviceLabel}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)] xl:hidden">
                {isCarWash
                  ? ([log.washer?.name, log.dryer?.name].filter(Boolean).join(' · ') || 'Sin asignar')
                    + (log.attendant?.name ? ` · Caja: ${log.attendant.name}` : '')
                  : (log.attendant?.name ?? '-')}
              </p>
            </div>

            {/* Empleado (desktop only — moved into the servicio sub-line
                on mobile so the row stays compact). En lavadora son dos
                personas: lavador arriba, secador debajo. */}
            {isCarWash ? (
              <div className="hidden min-w-0 xl:block">
                <p className="truncate text-[13px] text-[var(--fg-secondary)]">
                  {log.washer?.name ?? (
                    <span className="text-[var(--fg-muted)]">Sin asignar</span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-muted)]">
                  {log.dryer?.name ?? 'Sin secador'}
                </p>
                {/* Quién cobró, no quién trabajó: más chico y con etiqueta,
                    para que no se lea como un tercer asignado. */}
                {log.attendant?.name && (
                  <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">
                    Caja: {log.attendant.name}
                  </p>
                )}
              </div>
            ) : (
              <span className="hidden truncate text-[13px] text-[var(--fg-secondary)] xl:inline">
                {log.attendant?.name ?? '-'}
              </span>
            )}

            {/* Precio */}
            <div className="col-start-3 row-start-1 flex items-center gap-1.5 justify-self-end xl:col-auto xl:row-auto xl:justify-end xl:justify-self-auto">
              {/* Que el precio no es el del catálogo, y nada más: la fila ya
                  carga recurso, servicio, dos asignados, pago y tres botones,
                  y escribir acá la historia entera truncaba la placa.
                  Es un botón, no un adorno con tooltip: en el celular como PWA
                  no hay hover, así que el detalle se abre tocándolo — la
                  bitácora de allá tiene el catálogo, el motivo y el autor.
                  El `aria-label` lo dice completo para quien no ve el ícono. */}
              {log.priceChange && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/service-logs/${log.id}`);
                  }}
                  aria-label={priceChangeLabel(log.priceChange)}
                  // El círculo mide 20px porque más grande compite con el
                  // precio, pero 20px es un blanco imposible con el pulgar:
                  // el `before` invisible lo lleva a 36px sin mover nada.
                  className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--warning-50)] text-[var(--warning-700)] ring-1 ring-[var(--warning-200)] transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-[var(--warning-100)]"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              <span
                className="font-mono text-[15px] font-semibold tabular-nums text-[var(--fg-strong)] xl:text-[14px]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {fmt(log.priceCharged)}
              </span>
            </div>

            {/* Pago */}
            <div className="col-start-2 row-start-1 flex flex-col items-end gap-1 justify-self-end xl:col-auto xl:row-auto xl:items-start xl:justify-self-auto">
              {isOwing ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--warning-50)] xl:whitespace-normal px-2.5 py-1 text-[11.5px] font-semibold text-[var(--warning-700)] ring-1 ring-[var(--warning-200)]">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  {log.leftOwing
                    ? `Debe ${fmt(log.amountDue)}`
                    : isPartial
                      ? `Abonado ${fmt(log.amountPaid)} · falta ${fmt(log.amountDue)}`
                      : 'Pendiente'}
                </span>
              ) : mostrarTramos ? null : pmCfg ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--bg-sunken)] xl:whitespace-normal px-2.5 py-1 text-[11.5px] font-medium text-[var(--fg-strong)]">
                  <span aria-hidden="true">{pmCfg.icon}</span>
                  {pmCfg.label}
                </span>
              ) : (
                <span className="text-[12px] text-[var(--fg-muted)]">—</span>
              )}

              {/* Por dónde entró la plata que ya entró. Va DEBAJO del chip de
                  deuda en vez de competir con él: un abono de $25 por
                  transferencia con $13 pendientes deja dos preguntas abiertas
                  —cuánto falta y por qué vía llegó lo pagado— y la fila
                  respondía sólo la primera. Impreso, no en un tooltip: en la
                  PWA no hay hover. */}
              {mostrarTramos &&
                log.paymentBreakdown.map((tramo, i) => {
                  const cfg = PAYMENT_METHOD_CONFIG[tramo.method];
                  return (
                    <span
                      key={`${tramo.method}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-strong)]"
                    >
                      <span aria-hidden="true">{cfg.icon}</span>
                      <span className="tabular-nums font-semibold">{fmt(tramo.amount)}</span>
                      <span className="text-[var(--fg-muted)]">{cfg.label}</span>
                    </span>
                  );
                })}
            </div>

            {/* Estado + acciones — primary action gets a labeled
                button (40px target) so PWA taps land cleanly. Overflow
                ⋯ keeps editar/eliminar. `flex-nowrap + shrink-0` on the
                primary CTA so it never clips at intermediate breakpoints
                (the bug that made the Cobrar button only show on
                hover). */}
            <div className="col-span-3 row-start-4 flex flex-nowrap items-center justify-end gap-2 xl:col-span-1 xl:row-auto xl:self-center">
              <InvoiceStatusBadge status={log.invoiceStatus} className="ml-1" />

              <Badge
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap border-0 px-2.5 py-1 text-[11.5px] font-semibold',
                  statusCfg.bg,
                  statusCfg.color,
                )}
              >
                {log.status === 'in_progress' ? (
                  <Play className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Trophy className="h-3 w-3" aria-hidden="true" />
                )}
                {statusCfg.label}
              </Badge>

              {/* Primary actions — surfaced as labeled buttons so the
                  cashier doesn't fish for icons. Unpaid → Cobrar. Once paid,
                  facturación is a manual step: Completar (while in progress)
                  and Facturar (until the SRI invoice is autorizada) can both
                  show.

                  Una fila que debe también muestra Completar mientras está en
                  progreso: el auto puede estar listo y el cliente deber, y sin
                  ese botón la pregunta "¿cobrás o se va debiendo?" no tendría
                  por dónde entrar.

                  Una fila anulada no ofrece ninguna: es historia, y el único
                  camino que le queda es abrir el detalle. */}
              {anulado ? null : isOwing ? (
                <>
                  {log.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(log)}
                      disabled={completeMutation.isPending}
                      className="h-9 shrink-0 cursor-pointer gap-1.5 border-[var(--success-200)] px-3 text-[var(--success-700)] hover:bg-[var(--success-50)] hover:text-[var(--success-800)]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Completar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setPayTarget(log)}
                    className="h-9 shrink-0 cursor-pointer gap-1.5 bg-[var(--warning-600)] px-3 text-white hover:bg-[var(--warning-700)]"
                  >
                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                    Cobrar
                  </Button>
                </>
              ) : (
                <>
                  {log.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(log)}
                      disabled={completeMutation.isPending}
                      className="h-9 shrink-0 cursor-pointer gap-1.5 border-[var(--success-200)] px-3 text-[var(--success-700)] hover:bg-[var(--success-50)] hover:text-[var(--success-800)]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Completar
                    </Button>
                  )}
                  {log.invoiceStatus !== 'autorizada' && (() => {
                    // Spinner stays up from the click through the SRI verdict:
                    // the mutation covers click→"enviada"; invoiceStatus
                    // 'enviada' covers "enviada"→autorizada/rechazada (the list
                    // polls meanwhile). FEDER-style immediate rejection settles
                    // the mutation straight to 'rechazada' (never 'enviada').
                    const isEmitting =
                      (emitInvoiceMutation.isPending && emitInvoiceMutation.variables === log.id) ||
                      log.invoiceStatus === 'enviada';
                    const isRetry = log.invoiceStatus === 'rechazada';
                    return (
                      <Button
                        size="sm"
                        onClick={() =>
                          emitInvoiceMutation.mutate(log.id, {
                            onSuccess: () => toast.success('Facturación iniciada'),
                            onError: (e) => toast.error(apiErrorMessage(e, 'Error al iniciar facturación'), { duration: 8000 }),
                          })
                        }
                        disabled={isEmitting || isOwing}
                        title={isOwing
                          ? `No se puede facturar con saldo pendiente: faltan ${fmt(log.amountDue)}.`
                          : undefined}
                        className="h-9 shrink-0 cursor-pointer gap-1.5 bg-[var(--info-500)] px-3 text-white hover:bg-[var(--info-700)] disabled:opacity-100"
                      >
                        {isEmitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {isEmitting
                          ? isRetry
                            ? 'Reintentando…'
                            : 'Facturando…'
                          : isRetry
                            ? 'Reintentar factura'
                            : 'Facturar'}
                      </Button>
                    );
                  })()}
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Más acciones"
                    className="h-9 w-9 cursor-pointer text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-strong)]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem onClick={() => router.push(`/service-logs/${log.id}`)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Ver detalle
                  </DropdownMenuItem>
                  {/* Todo lo que sigue toca el registro: en uno anulado no
                      tiene sentido ofrecerlo. Queda sólo Ver detalle, que es
                      donde se lee por qué se anuló. */}
                  {!anulado && <DropdownMenuSeparator />}
                  {!anulado && log.status === 'in_progress' && (
                    <>
                      <DropdownMenuItem onClick={() => handleComplete(log)} disabled={completeMutation.isPending}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Completar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {!anulado && isCarWash && (
                    <DropdownMenuItem onClick={() => setAssignTarget({ log })}>
                      <UserCog className="mr-2 h-3.5 w-3.5" />
                      Asignar
                    </DropdownMenuItem>
                  )}
                  {!anulado && (
                    <DropdownMenuItem onClick={() => onEdit?.(log)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {/* Facturar itself is a visible row button (see the
                      primary-actions block above). This is the occasional
                      correction path for the client's fiscal data. */}
                  {!anulado && log.clientResource?.client && (
                    <DropdownMenuItem onClick={() => setBillingTarget(log)}>
                      <Receipt className="mr-2 h-3.5 w-3.5" />
                      Datos de facturación
                    </DropdownMenuItem>
                  )}
                  {/* Anular vive en el detalle y no acá: mata el registro, y
                      no puede estar a un clic en una lista donde el dedo va
                      rápido. Eliminar ya no existe — borraba sin dejar rastro. */}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        );
      })}

      {/* Pager. The size selector stays put even on a single page — it is how
          the cashier asks for "Todos" — while the prev/next pair only appears
          when there is somewhere to go. */}
      {!compact && (
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-[var(--fg-muted)]">
          {total === 0
            ? 'Sin registros'
            : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}
        </p>

        <div className="flex items-center gap-2">
          {lastPage > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Página anterior"
                disabled={currentPage <= 1}
                onClick={() => onPageChange?.(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="px-1 text-[12px] tabular-nums text-[var(--fg-secondary)]">
                {currentPage} / {lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Página siguiente"
                disabled={currentPage >= lastPage}
                onClick={() => onPageChange?.(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          <Select value={perPage} onValueChange={(v) => onPerPageChange?.(v as PageSize)}>
            <SelectTrigger className="h-8 w-[104px]" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 filas</SelectItem>
              <SelectItem value="15">15 filas</SelectItem>
              <SelectItem value="20">20 filas</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      )}

      {/* Pago dialog — triggered from the unpaid rows' overflow menu. */}
      {payTarget && (
        <RegisterPaymentDialog
          serviceLogId={payTarget.id}
          // Una venta de mostrador no tiene placa: sin recurso no hay deuda
          // vieja que consultar, y el diálogo ya trata la ausencia.
          clientResourceId={payTarget.clientResourceId ?? undefined}
          total={payTarget.amountDue}
          open
          onClose={() => setPayTarget(null)}
        />
      )}

      {completeTarget && (
        <CompleteServiceDialog
          open
          amountDue={completeTarget.amountDue}
          pending={completeMutation.isPending}
          onCharge={() => {
            setPayTarget(completeTarget);
            setCompleteTarget(null);
          }}
          onLeaveOwing={() =>
            completeMutation.mutate(
              { id: completeTarget.id, leftOwing: true },
              {
                onSuccess: () => {
                  toast.success('Se lleva el vehículo debiendo');
                  setCompleteTarget(null);
                },
                // Mismo trato que completar sin saldo: si lo que falta son los
                // asignados, se abre el diálogo que lo arregla en vez de un
                // toast que no dice qué hacer. La respuesta "se va debiendo"
                // viaja con él — es el camino más común del lavadero y era
                // justo el que la perdía.
                onError: (e) => {
                  if (apiErrorCode(e) === 'ASSIGNEES_REQUIRED') {
                    setAssignTarget({
                      log: completeTarget,
                      reason: apiErrorMessage(e, 'Faltan asignados.'),
                      thenComplete: true,
                      leftOwing: true,
                    });
                    setCompleteTarget(null);
                    return;
                  }
                  toast.error(apiErrorMessage(e, 'Error al completar'));
                },
              },
            )
          }
          onClose={() => setCompleteTarget(null)}
        />
      )}

      {/* Asignar lavador y secador. */}
      {assignTarget && isCarWash && (
        <AssignStaffDialog
          log={assignTarget.log}
          reason={assignTarget.reason}
          thenComplete={assignTarget.thenComplete}
          leftOwing={assignTarget.leftOwing}
          open
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* Datos de facturación — occasional fiscal-data correction. */}
      {billingTarget && (
        <FiscalProfileDialog
          serviceLogId={billingTarget.id}
          clientName={billingTarget.clientResource?.client?.name}
          open
          onClose={() => setBillingTarget(null)}
        />
      )}
    </div>
  );
}
