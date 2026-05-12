'use client';

import { useState, useEffect, Suspense } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
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

  const { data, isLoading } = useClients(page, debouncedSearch || undefined);
  const { data: settings } = useSettings();
  const clients = data?.data ?? [];
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
        <Button onClick={() => setCreateOpen(true)} className="sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuevo cliente
        </Button>
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
