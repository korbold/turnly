'use client';

import { useState, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useServices } from '@/presentation/hooks/use-services';
import { ServiceCard } from '@/presentation/components/features/services/service-card';
import { ServiceForm } from '@/presentation/components/features/services/service-form';
import type { Service } from '@/domain/entities/service';

function ServicesContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const { data, isLoading } = useServices();
  const services = data?.data ?? [];

  function handleEdit(service: Service) {
    setEditService(service);
  }

  function handleCloseForm() {
    setCreateOpen(false);
    setEditService(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Servicios</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-16 text-center">
          <p className="text-sm text-muted-foreground">No hay servicios configurados</p>
          <Button variant="link" onClick={() => setCreateOpen(true)}>
            Crear primer servicio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
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
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
