'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  useBusinessResources,
  useCreateBusinessResource,
  useUpdateBusinessResource,
  useDeleteBusinessResource,
} from '@/presentation/hooks/use-business-resources';
import { useTeam } from '@/presentation/hooks/use-team';
import type { BusinessResource, ResourceType } from '@/domain/entities/business-resource';

interface ResourceFormState {
  name: string;
  description: string;
  type: ResourceType;
  isActive: boolean;
  employeeId: string | null;
}

const EMPTY_FORM: ResourceFormState = {
  name: '',
  description: '',
  type: 'physical',
  isActive: true,
  employeeId: null,
};

export function ResourcesTab() {
  const { data: resources, isLoading } = useBusinessResources();
  const { data: team } = useTeam();
  const createMutation = useCreateBusinessResource();
  const updateMutation = useUpdateBusinessResource();
  const deleteMutation = useDeleteBusinessResource();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessResource | null>(null);
  const [form, setForm] = useState<ResourceFormState>(EMPTY_FORM);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(resource: BusinessResource) {
    setEditing(resource);
    setForm({
      name: resource.name,
      description: resource.description ?? '',
      type: resource.type,
      isActive: resource.isActive,
      employeeId: resource.employeeId ?? null,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          input: {
            name: form.name.trim(),
            description: form.description.trim() || null,
            type: form.type,
            isActive: form.isActive,
            employeeId: form.employeeId,
          },
        });
        toast.success('Recurso actualizado');
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type,
          isActive: form.isActive,
          employeeId: form.employeeId,
        });
        toast.success('Recurso creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Error al guardar recurso');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Recurso eliminado');
    } catch {
      toast.error('Error al eliminar recurso');
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-semibold">Recursos</CardTitle>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Estaciones, sillas, salas — los espacios o personas que se pueden reservar.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!resources?.length ? (
            <div className="px-6 py-8 text-center text-sm text-[var(--fg-muted)]">
              Sin recursos. Agrega estaciones, sillas o salas.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-soft)]">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-[var(--fg-muted)] truncate">{r.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[11px] shrink-0">
                    {r.type === 'physical' ? 'Físico' : 'Persona'}
                  </Badge>
                  {!r.isActive && (
                    <Badge variant="secondary" className="text-[11px] shrink-0">
                      Inactivo
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="p-1.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]"
                    aria-label={`Editar ${r.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded text-[var(--fg-muted)] hover:text-red-600 hover:bg-red-50"
                    aria-label={`Eliminar ${r.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar recurso' : 'Nuevo recurso'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                className="mt-1"
                placeholder="Estación 1, Silla Juan, Sala masaje..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                className="mt-1"
                placeholder="Notas internas sobre este recurso"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <div className="flex gap-2 mt-1">
                {(['physical', 'person'] as ResourceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      form.type === t
                        ? 'bg-[var(--brand-50)] border-[var(--brand-200)] text-[var(--brand-700)] font-medium'
                        : 'border-[var(--border-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {t === 'physical' ? 'Físico' : 'Persona'}
                  </button>
                ))}
              </div>
            </div>
            {form.type === 'person' && (
              <div>
                <label className="text-sm font-medium">Empleado vinculado (opcional)</label>
                <select
                  className="mt-1 w-full rounded-md border border-[var(--border-soft)] px-3 py-2 text-sm bg-white"
                  value={form.employeeId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value || null }))}
                >
                  <option value="">Sin vincular</option>
                  {team?.data.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
