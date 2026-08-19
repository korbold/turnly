'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { apiErrorMessage } from '@/shared/utils/api-error';
import { useServiceStaff } from '@/presentation/hooks/use-service-staff';
import { useAssignServiceLogStaff, useCompleteServiceLog } from '@/presentation/hooks/use-service-logs';
import { usePermissions } from '@/presentation/hooks/use-permissions';
import type { ServiceLog } from '@/domain/entities/service-log';

interface Props {
  log: ServiceLog;
  open: boolean;
  onClose: () => void;
  /** Por qué se abrió solo, cuando viene de Completar. */
  reason?: string;
  /**
   * Abierto desde Completar: los dos puestos son obligatorios y guardar
   * completa el servicio. Sin esto el usuario queda en un callejón — apretó
   * Completar, guardó, y el servicio sigue en progreso.
   */
  requireBoth?: boolean;
}

/**
 * Asignar lavador y secador. Camino propio y no el editor completo porque es
 * la acción del día: se asigna al lavador cuando arranca y al secador cuando
 * seca, dos veces por auto.
 */
export function AssignStaffDialog({ log, open, onClose, reason, requireBoth = false }: Props) {
  const { data: washers } = useServiceStaff('washer');
  const { data: dryers } = useServiceStaff('dryer');
  const assign = useAssignServiceLogStaff();
  const complete = useCompleteServiceLog();
  const { canAssign } = usePermissions();

  const isCompleted = log.status === 'completed';
  const locked = !canAssign(isCompleted);

  // Estado inicial y no un efecto de siembra: los dos llamadores montan el
  // dialog recién al abrirlo ({open && <AssignStaffDialog …>}), así que el
  // primer render ya ve los valores del registro.
  const [washedBy, setWashedBy] = useState(log.washedBy ?? '');
  const [driedBy, setDriedBy] = useState(log.driedBy ?? '');

  function handleSave() {
    // Venir de Completar y guardar sin nadie asignado cerraba el dialog con un
    // toast de éxito, dejando el servicio igual que antes. Nombrar al que
    // falta es más útil que un "completá los campos".
    if (requireBoth && (!washedBy || !driedBy)) {
      const faltan = [!washedBy && 'lavador', !driedBy && 'secador'].filter(Boolean);
      toast.error(`Falta asignar ${faltan.join(' y ')} para completar el servicio`);
      return;
    }

    assign.mutate(
      {
        id: log.id,
        data: {
          washedBy: washedBy || null,
          driedBy: driedBy || null,
        },
      },
      {
        onSuccess: () => {
          if (!requireBoth) {
            toast.success('Asignados actualizados');
            onClose();
            return;
          }

          // El usuario apretó Completar: terminar el trabajo que pidió.
          complete.mutate(log.id, {
            onSuccess: () => {
              toast.success('Servicio completado');
              onClose();
            },
            onError: (e) => toast.error(apiErrorMessage(e, 'Error al completar')),
          });
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Error al asignar')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar personal</DialogTitle>
          <DialogDescription>
            {reason ?? 'Quién lavó y quién secó este vehículo.'}
          </DialogDescription>
        </DialogHeader>

        {locked && (
          <p className="rounded-lg bg-[var(--warning-50)] px-3 py-2 text-[12.5px] text-[var(--warning-700)]">
            El servicio está completado: solo el administrador puede corregir los
            asignados.
          </p>
        )}

        <div className="flex flex-col gap-4 py-1">
          <div>
            <Label className="mb-1.5 block">Lavador</Label>
            <Select value={washedBy} onValueChange={setWashedBy} disabled={locked}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {(washers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Secador</Label>
            <Select value={driedBy} onValueChange={setDriedBy} disabled={locked}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {(dryers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={locked || assign.isPending || complete.isPending}>
            {requireBoth ? 'Guardar y completar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
