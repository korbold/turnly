'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  useServiceVariants,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
} from '@/presentation/hooks/use-service-variants';
import { BomEditor } from './bom-editor';
import type { ServiceVariant } from '@/domain/entities/service-variant';

interface Props {
  serviceId: string;
}

interface VariantFormState {
  label: string;
  price: string;
  durationMin: string;
}

function emptyForm(): VariantFormState {
  return { label: '', price: '0', durationMin: '30' };
}

function formatMoney(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export function VariantEditor({ serviceId }: Props) {
  const { data: variants, isLoading } = useServiceVariants(serviceId);
  const create = useCreateVariant(serviceId);
  const update = useUpdateVariant(serviceId);
  const remove = useDeleteVariant(serviceId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceVariant | null>(null);
  const [form, setForm] = useState<VariantFormState>(emptyForm());
  const [bomOpen, setBomOpen] = useState<ServiceVariant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceVariant | null>(null);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function startEdit(v: ServiceVariant) {
    setEditing(v);
    setForm({ label: v.label, price: String(v.price), durationMin: String(v.durationMin) });
    setOpen(true);
  }

  function save() {
    if (!form.label.trim()) return;
    const input = {
      label: form.label.trim(),
      price: parseFloat(form.price) || 0,
      durationMin: parseInt(form.durationMin, 10) || 30,
    };
    const onError = () => toast.error('Error al guardar variante');
    if (editing) {
      update.mutate({ id: editing.id, input }, {
        onSuccess: () => { toast.success('Variante actualizada'); setOpen(false); },
        onError,
      });
    } else {
      create.mutate(input, {
        onSuccess: () => { toast.success('Variante creada'); setOpen(false); },
        onError,
      });
    }
  }

  function doDelete() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, {
      onSuccess: () => { toast.success('Variante eliminada'); setConfirmDelete(null); },
      onError: () => toast.error('No se pudo eliminar'),
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--fg-strong)]">Variantes</h2>
          <p className="text-[12px] text-[var(--fg-muted)]">
            Diferentes precios o duraciones del mismo servicio (tamaño, tipo, etc.)
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nueva variante
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] w-full rounded-lg" />
          ))}
        </div>
      ) : !variants?.length ? (
        <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-center">
          <p className="text-[14px] font-medium text-[var(--fg-strong)]">Sin variantes aún</p>
          <p className="mt-1 text-[12px] text-[var(--fg-secondary)]">
            Crea variantes para ofrecer distintos precios según tamaño, tipo o duración.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map((v) => (
            <article
              key={v.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--fg-strong)]">{v.label}</span>
                  {!v.isActive && (
                    <span className="rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--fg-secondary)]">
                  <span>{formatMoney(v.price)}</span>
                  <span>{v.durationMin} min</span>
                  <span>
                    BOM:{' '}
                    <strong className="text-[var(--fg-strong)]">
                      {v.consumption?.length ?? 0} insumo{v.consumption?.length === 1 ? '' : 's'}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setBomOpen(v)}>
                  <Package className="mr-1.5 h-3.5 w-3.5" /> Receta
                </Button>
                <Button variant="ghost" size="icon" onClick={() => startEdit(v)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(v)}
                  aria-label="Eliminar"
                  className="text-[var(--danger-500)] hover:text-[var(--danger-600)]"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar variante' : 'Nueva variante'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Modifica los datos de la variante.' : 'Crea una variante con su propio precio y duración.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5">Etiqueta</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ej. Pequeño, Mediano, Grande"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Precio</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5">Duración (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationMin}
                  onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending || !form.label.trim()}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar variante</DialogTitle>
            <DialogDescription>
              {confirmDelete && (
                <>¿Eliminar la variante <strong>{confirmDelete.label}</strong>? Las reservas
                pasadas la mantienen como referencia histórica.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              onClick={doDelete}
              disabled={remove.isPending}
              className="bg-[var(--danger-500)] text-white hover:bg-[var(--danger-600)]"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BomEditor variant={bomOpen} open={!!bomOpen} onClose={() => setBomOpen(null)} />
    </section>
  );
}
