'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { Plus, Search, Users, Wallet } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useQueryState, parseAsBoolean } from 'nuqs';
import { cn } from '@/shared/utils/cn';
import { useClients } from '@/presentation/hooks/use-clients';
import { useSettings } from '@/presentation/hooks/use-settings';
import { ClientCard } from '@/presentation/components/features/clients/client-card';
import { ClientForm } from '@/presentation/components/features/clients/client-form';

function ClientsContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // El toggle vive en la URL: la pantalla del lunes se comparte y se marca.
  const [onlyDebt, setOnlyDebt] = useQueryState(
    'with_debt', parseAsBoolean.withDefault(false),
  );

  const { data, isLoading } = useClients(page, debouncedSearch || undefined, onlyDebt);
  const { data: settings } = useSettings();
  // El orden por deuda es en memoria y SOBRE LA PÁGINA, no sobre el tenant:
  // con el filtro activo la lista son los deudores, que son pocos. Hacerlo en
  // SQL obligaría a arrastrar la agregación a la consulta principal.
  const clients = useMemo(() => {
    const rows = data?.data ?? [];
    return onlyDebt ? [...rows].sort((a, b) => b.debt - a.debt) : rows;
  }, [data, onlyDebt]);
  const meta = data?.meta;
  const firstField = settings?.customFields?.[0]?.label?.toLowerCase();
  const placeholder = firstField
    ? `Buscar por ${firstField}, email…`
    : 'Buscar cliente o email…';
  const hasSearch = debouncedSearch.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: search + primary CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            className="pl-9"
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOnlyDebt(onlyDebt ? null : true);
              setPage(1);
            }}
            aria-pressed={onlyDebt}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-pointer',
              onlyDebt
                ? 'border-[var(--warning-200)] bg-[var(--warning-50)] text-[var(--warning-700)]'
                : 'border-[var(--border)] text-[var(--fg-secondary)] hover:bg-[var(--bg-sunken)]',
            )}
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            Solo con deuda
          </button>
          <Button onClick={() => setCreateOpen(true)} className="sm:self-auto">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <Users className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
            {hasSearch ? 'Sin coincidencias' : 'Aún no tienes clientes'}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
            {hasSearch
              ? 'Prueba con otro término o limpia la búsqueda.'
              : 'Cada vez que registres un servicio, el cliente aparecerá acá.'}
          </p>
          {!hasSearch && (
            <Button onClick={() => setCreateOpen(true)} className="mt-5">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Crear primer cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c, i) => (
            <ClientCard key={c.id} client={c} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span
            className="text-[13px] tabular-nums text-[var(--fg-secondary)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {meta.currentPage} / {meta.lastPage}
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

      {/* Create modal */}
      <ClientForm open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:max-w-md" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
