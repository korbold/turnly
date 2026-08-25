'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Car, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useClients } from '@/presentation/hooks/use-clients';
import { useAssignServiceLogResource } from '@/presentation/hooks/use-service-logs';
import type { ServiceLog } from '@/domain/entities/service-log';

interface Props {
  log: ServiceLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Le devuelve el vehículo a un registro que lo perdió.
 *
 * Un vehículo borrado a nivel de base deja el servicio suelto: con su precio,
 * su cobro y su bitácora, y sin el auto sobre el que se trabajó. Quien atendió
 * sabe de quién era; esto es el lugar donde decirlo.
 *
 * Sólo aparece cuando el registro NO tiene vehículo. Cambiar el de un registro
 * que ya lo tiene está prohibido a propósito, y el backend lo rechaza igual.
 */
export function AssignResourceDialog({ log, open, onOpenChange }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);

  // El buscador del backend ya mira placa, marca y nombre del dueño.
  const { data: resultados, isLoading } = useClients(1, busqueda.trim() || undefined);
  const asignar = useAssignServiceLogResource();

  const vehiculos = resultados?.data ?? [];

  async function confirmar() {
    if (!elegido) return;

    try {
      await asignar.mutateAsync({ id: log.id, clientResourceId: elegido });
      toast.success('Vehículo asignado');
      onOpenChange(false);
      setBusqueda('');
      setElegido(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'No se pudo asignar el vehículo'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar vehículo</DialogTitle>
          <DialogDescription>
            Este registro quedó sin vehículo. Elegí sobre cuál se hizo el trabajo — queda
            anotado en la bitácora.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
          <Input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por placa, marca o cliente…"
            className="pl-9"
          />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </>
          ) : vehiculos.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--fg-muted)]">
              {busqueda.trim() ? 'Ningún vehículo coincide.' : 'No hay vehículos registrados.'}
            </p>
          ) : (
            vehiculos.map((v) => {
              const activo = elegido === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setElegido(v.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    activo
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--border)] hover:bg-[var(--bg-sunken)]'
                  }`}
                >
                  <Car className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-[var(--fg-strong)]">
                      {v.label || v.plate || 'Sin placa'}
                    </span>
                    {v.client?.name && (
                      <span className="block truncate text-[12px] text-[var(--fg-muted)]">
                        {v.client.name}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!elegido || asignar.isPending}>
            {asignar.isPending ? 'Asignando…' : 'Asignar vehículo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
