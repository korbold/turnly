'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryState, parseAsString, parseAsStringEnum, parseAsInteger } from 'nuqs';
import { ChevronLeft, ChevronRight, CalendarIcon, Plus, Search, X } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Calendar } from '@/presentation/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { DailySummary } from '@/presentation/components/features/service-logs/daily-summary';
import { LogList } from '@/presentation/components/features/service-logs/log-list';
import { NewServiceModal } from '@/presentation/components/features/service-logs/new-service-modal';
import { EditServiceLogDialog } from '@/presentation/components/features/service-logs/edit-service-log-dialog';
import type { ServiceLog, PaymentFilter, PageSize } from '@/domain/entities/service-log';

/** Mirrors the PAGO column: a payment state, or the concrete method. */
const PAYMENT_OPTIONS: Array<{ value: PaymentFilter; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'paid', label: 'Pagado' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completado' },
] as const;

const ALL = 'all';

/**
 * Master-detail breakpoint. On `lg+` the create form slots into a
 * sticky right rail so the daily log stays visible and editable while
 * the cashier is registering. Below that we fall back to the dialog
 * variant — drawers don't fit a 6-inch screen.
 */
function useIsDesktop(query = '(min-width: 1024px)'): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return isDesktop;
}

function ServiceLogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceLog | null>(null);

  // Day and filters live in the URL: a refresh used to drop the cashier back
  // on today, and a filtered view can now be shared or bookmarked.
  const [dateStr, setDateStr] = useQueryState(
    'date',
    parseAsString.withDefault(format(new Date(), 'yyyy-MM-dd')),
  );
  const [payment, setPayment] = useQueryState(
    'payment',
    parseAsStringEnum<PaymentFilter>(PAYMENT_OPTIONS.map((o) => o.value)),
  );
  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringEnum<'in_progress' | 'completed'>(['in_progress', 'completed']),
  );
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [perPage, setPerPage] = useQueryState(
    'per_page',
    parseAsStringEnum<PageSize>(['10', '15', '20', 'all']).withDefault('15'),
  );

  // The box holds what is being typed; the URL (and the query) only catch up
  // once typing pauses, so a plate isn't re-fetched letter by letter.
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => {
    if (searchDraft === search) return;
    const t = setTimeout(() => {
      setSearch(searchDraft || null);
      setPage(null);
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, search, setSearch, setPage]);

  const selectedDate = useMemo(() => parseISO(dateStr), [dateStr]);
  const setSelectedDate = (d: Date) => {
    setDateStr(format(d, 'yyyy-MM-dd'));
    setPage(null);
  };
  const hasFilters = !!payment || !!status || !!search;

  function clearFilters() {
    setPayment(null);
    setStatus(null);
    setSearch(null);
    setSearchDraft('');
    setPage(null);
  }
  const isDesktop = useIsDesktop();
  const showInlineCreate = isDesktop && createOpen;

  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setCreateOpen(true);
    }
  }, [searchParams]);

  function closeCreate() {
    setCreateOpen(false);
    // Strip the `?create=true` flag so a later URL change (date nav,
    // share-link back) doesn't silently reopen the panel.
    if (searchParams?.has('create')) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }

  return (
    <div
      className={
        showInlineCreate
          ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_480px]'
          : 'grid grid-cols-1 gap-4'
      }
    >
      <main className="min-w-0 space-y-4">
        {/* Toolbar: date selector + primary CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Día anterior"
              className="h-9 w-9 p-0"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 min-w-[200px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>
                    {(() => {
                      const s = format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
                      return s.charAt(0).toUpperCase() + s.slice(1);
                    })()}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              aria-label="Día siguiente"
              className="h-9 w-9 p-0"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => setCreateOpen(true)}
            disabled={showInlineCreate}
            className="sm:self-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Registrar servicio
          </Button>
        </div>

        {/* Summary cards — the day's caja, deliberately not narrowed by the
            filters below: they exist to find a row, not to restate the till. */}
        <DailySummary date={dateStr} />

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]"
              aria-hidden="true"
            />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por placa, marca o cliente…"
              aria-label="Buscar en el registro del día"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          <Select
            value={payment ?? ALL}
            onValueChange={(v) => {
              setPayment(v === ALL ? null : (v as PaymentFilter));
              setPage(null);
            }}
          >
            <SelectTrigger className="h-9 sm:w-[168px]" aria-label="Filtrar por pago">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los pagos</SelectItem>
              {PAYMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status ?? ALL}
            onValueChange={(v) => {
              setStatus(v === ALL ? null : (v as 'in_progress' | 'completed'));
              setPage(null);
            }}
          >
            <SelectTrigger className="h-9 sm:w-[160px]" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={clearFilters}>
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Log list */}
        <LogList
          date={dateStr}
          payment={payment ?? undefined}
          status={status ?? undefined}
          q={search || undefined}
          page={page}
          perPage={perPage}
          onPageChange={(p) => setPage(p <= 1 ? null : p)}
          onPerPageChange={(size) => {
            setPerPage(size === '15' ? null : size);
            setPage(null);
          }}
          onCreate={() => setCreateOpen(true)}
          onEdit={setEditTarget}
        />
      </main>

      {/* Desktop master-detail — embedded panel sticky in the right rail
          so the daily log stays visible while the cashier registers. */}
      {showInlineCreate && (
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <NewServiceModal embedded open onClose={closeCreate} />
          </div>
        </aside>
      )}

      {/* Mobile / tablet — Sheet/Dialog variant, suppressed once the
          inline panel renders so the portal doesn't double-mount. */}
      {!isDesktop && (
        <NewServiceModal open={createOpen} onClose={closeCreate} />
      )}

      <EditServiceLogDialog
        log={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}

export default function ServiceLogPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <ServiceLogContent />
    </Suspense>
  );
}
