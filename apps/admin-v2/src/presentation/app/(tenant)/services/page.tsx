'use client';

import { useState, useMemo, Suspense } from 'react';
import { Plus, Search, Scissors } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useServices } from '@/presentation/hooks/use-services';
import { ServiceCard } from '@/presentation/components/features/services/service-card';
import { ServiceForm } from '@/presentation/components/features/services/service-form';
import type { Service } from '@/domain/entities/service';

function ServicesContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useServices();
  const services = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      [s.name, s.description].some((v) => v?.toLowerCase().includes(q))
    );
  }, [services, search]);

  function handleEdit(service: Service) {
    setEditService(service);
  }

  function handleCloseForm() {
    setCreateOpen(false);
    setEditService(null);
  }

  return (
    <div className="space-y-4">
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
      ) : filtered.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((svc) => (
            <ServiceCard key={svc.id} service={svc} onEdit={handleEdit} />
          ))}
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
