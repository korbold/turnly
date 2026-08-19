'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { apiErrorMessage } from '@/shared/utils/api-error';
import {
  useServiceStaff,
  useCreateServiceStaff,
  useUpdateServiceStaff,
} from '@/presentation/hooks/use-service-staff';
import { STAFF_POSITION_LABEL, type StaffPosition } from '@/domain/entities/service-staff';

const POSITIONS: StaffPosition[] = ['washer', 'dryer', 'both'];

export function StaffTab() {
  const { data: staff, isLoading } = useServiceStaff();
  const create = useCreateServiceStaff();
  const update = useUpdateServiceStaff();

  const [name, setName] = useState('');
  const [position, setPosition] = useState<StaffPosition>('both');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Escribí un nombre');
      return;
    }

    create.mutate(
      { name: trimmed, position },
      {
        onSuccess: () => {
          toast.success('Personal agregado');
          setName('');
          setPosition('both');
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Error al agregar')),
      },
    );
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  const rows = staff ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">Personal de lavado</CardTitle>
        <p className="text-xs text-[var(--fg-muted)]">
          Quién lava y quién seca. No son usuarios de la app: no tienen contraseña
          y no cuentan contra el límite de empleados de tu plan. Se desactivan, no
          se borran — los servicios que ya hicieron tienen que seguir nombrándolos.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alta: un nombre y un puesto. El punto de que no sean cuentas es que
            agregar a alguien sea esto, y no una invitación con contraseña. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="Nombre y apellido"
            className="sm:flex-1"
            aria-label="Nombre del personal"
          />
          <Select value={position} onValueChange={(v) => setPosition(v as StaffPosition)}>
            <SelectTrigger className="sm:w-40" aria-label="Puesto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {STAFF_POSITION_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={create.isPending} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--fg-secondary)]">
              Todavía no registraste personal. Agregá al primero arriba para poder
              asignar lavador y secador en el Registro Diario.
            </p>
          </div>
        ) : (
          <ul
            role="list"
            className="divide-y divide-[var(--border-soft)] rounded-lg border border-[var(--border)]"
          >
            {rows.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'truncate text-[14px] font-medium',
                      person.isActive
                        ? 'text-[var(--fg-strong)]'
                        : 'text-[var(--fg-muted)] line-through',
                    )}
                  >
                    {person.name}
                  </p>
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    {STAFF_POSITION_LABEL[person.position]}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={person.position}
                    onValueChange={(v) =>
                      update.mutate(
                        { id: person.id, input: { position: v as StaffPosition } },
                        {
                          onSuccess: () => toast.success('Puesto actualizado'),
                          onError: (e) => toast.error(apiErrorMessage(e, 'Error al actualizar')),
                        },
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-32" aria-label={`Puesto de ${person.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {STAFF_POSITION_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: person.id, input: { isActive: !person.isActive } },
                        {
                          onSuccess: () =>
                            toast.success(person.isActive ? 'Desactivado' : 'Activado'),
                          onError: (e) => toast.error(apiErrorMessage(e, 'Error al actualizar')),
                        },
                      )
                    }
                  >
                    {person.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
