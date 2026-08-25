'use client';

import { useEffect, useState } from 'react';
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
import { PersonPicker, type Person } from '@/presentation/components/features/clients/person-picker';
import { useUpdateClient } from '@/presentation/hooks/use-clients';
import { apiErrorMessage } from '@/shared/utils/api-error';
import type { ClientResource } from '@/domain/entities/client-resource';

interface Props {
  open: boolean;
  resource: ClientResource;
  /** El nombre que ya estaba escrito en el vehículo, para arrancar buscándolo. */
  nombreActual: string | null;
  onClose: () => void;
}

/**
 * Ponerle dueño a un vehículo que ya existe.
 *
 * El buscador de personas une los autos cuando se crea uno nuevo, pero los que
 * ya estaban no pasan por ahí: en producción quedaron 277 vehículos sueltos, y
 * los dos autos de la misma persona no tenían forma de juntarse desde ninguna
 * pantalla. Ésta es esa pantalla.
 *
 * Vale también sobre un auto que ya tiene dueño: equivocarse de persona
 * buscando por nombre es fácil, y sin poder corregirlo el auto queda trabado.
 */
export function AssignOwnerDialog({ open, resource, nombreActual, onClose }: Props) {
  const [nombre, setNombre] = useState('');
  const [persona, setPersona] = useState<Person | null>(null);
  const mutation = useUpdateClient();

  useEffect(() => {
    if (open) {
      // Arranca con el nombre que ya está escrito en el auto: en el caso
      // normal la persona buscada es justamente ésa, y aparece sola.
      setNombre(nombreActual ?? '');
      setPersona(null);
    }
  }, [open, nombreActual]);

  const escrito = nombre.trim();
  // Una persona elegida de la lista, o un nombre nuevo que el backend crea.
  // Sobre un auto que YA tiene dueño hace falta elegirla: el nombre suelto
  // sólo promueve a los que están sueltos, y adivinar un traspaso a partir de
  // texto es justo lo que no queremos.
  const puedeGuardar = !!persona || (!resource.clientId && escrito.length >= 3);

  async function guardar() {
    if (!puedeGuardar) return;

    const nombreFinal = persona?.name ?? escrito;

    try {
      await mutation.mutateAsync({
        id: resource.id,
        data: {
          // El nombre del vehículo pasa a ser el de la persona elegida: si
          // quedara el viejo, la fila diría una cosa y el dueño otra.
          data: { ...(resource.data ?? {}), nombre: nombreFinal },
          ...(persona ? { clientId: persona.id } : {}),
        },
      });
      toast.success(`Este vehículo ahora es de ${nombreFinal}`);
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'No se pudo asignar el dueño'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar dueño</DialogTitle>
          <DialogDescription>
            Busca a la persona y elígela de la lista. Sus vehículos quedan juntos y su
            deuda se suma entre todos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Persona</Label>
          <PersonPicker
            value={nombre}
            onChange={(v) => {
              setNombre(v);
              setPersona(null);
            }}
            selected={persona}
            onSelect={setPersona}
          />
          {!persona && escrito.length > 0 && (
            <p className="text-[12px] text-[var(--fg-muted)]">
              {resource.clientId
                ? 'Para cambiar de dueño hay que elegir a la persona de la lista.'
                : 'Si no aparece en la lista, se crea con ese nombre.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar || mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
