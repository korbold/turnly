'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import { Plus, Search, Scissors } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useServicesPage } from '@/presentation/hooks/use-services';
import { Pager } from '@/presentation/components/ui/pager';
import { ServiceCard } from '@/presentation/components/features/services/service-card';
import { ServiceForm } from '@/presentation/components/features/services/service-form';
import type { Service } from '@/domain/entities/service';

const PER_PAGE = 24;

function ServicesContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);

  // Página y búsqueda viven en la URL: la pantalla se comparte y sobrevive al
  // refresh, igual que en el Registro Diario.
  const topRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [search, setSearch] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === query) return;
      setQuery(search || null);
      // Buscar reinicia la paginación: la página 3 de otra búsqueda saldría vacía.
      setPage(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query, setQuery, setPage]);

  // La búsqueda la resuelve el servidor sobre TODO el catálogo. Filtrar en el
  // cliente sólo miraría la página que ya llegó y volvería a esconder servicios.
  const { data, isLoading } = useServicesPage({
    page,
    perPage: PER_PAGE,
    q: query || undefined,
  });

  const services = data?.data ?? [];
  const meta = data?.meta;

  // Borrar el último servicio de la última página dejaría al usuario mirando
  // una página vacía que además miente ("aún no tienes servicios").
  useEffect(() => {
    if (meta && page > meta.lastPage) setPage(meta.lastPage <= 1 ? null : meta.lastPage);
  }, [meta, page, setPage]);

  function handleEdit(service: Service) {
    setEditService(service);
  }

  function handleCloseForm() {
    setCreateOpen(false);
    setEditService(null);
  }

  // En un teléfono el paginador queda al final de 24 tarjetas: sin esto, tocar
  // "2" deja al usuario abajo del todo viendo las ÚLTIMAS de la página nueva.
  // scrollIntoView sirve a los dos casos, porque en móvil scrollea la ventana y
  // en escritorio el <main> que tiene el overflow.
  function goToPage(next: number) {
    setPage(next <= 1 ? null : next);
    topRef.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="space-y-4" ref={topRef}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <Input
            className="pl-9"
            placeholder="Buscar servicio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="sm:self-auto">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuevo servicio
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--bg-sunken)]">
            <Scissors className="h-5 w-5 text-[var(--fg-secondary)]" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-semibold text-[var(--fg-strong)]">
            {search ? 'Sin coincidencias' : 'Aún no tienes servicios'}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--fg-secondary)]">
            {search
              ? 'Prueba con otro nombre o limpia la búsqueda.'
              : 'Define los servicios que tu negocio ofrece para empezar a registrar reservas.'}
          </p>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} className="mt-5">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Crear primer servicio
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => (
              <ServiceCard key={svc.id} service={svc} onEdit={handleEdit} />
            ))}
          </div>

          <Pager
            currentPage={meta?.currentPage ?? 1}
            lastPage={meta?.lastPage ?? 1}
            total={meta?.total ?? services.length}
            perPage={meta?.perPage ?? PER_PAGE}
            onPageChange={goToPage}
            noun="servicios"
          />
        </div>
      )}

      <ServiceForm
        open={createOpen || !!editService}
        onClose={handleCloseForm}
        service={editService}
      />
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full sm:max-w-md" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
