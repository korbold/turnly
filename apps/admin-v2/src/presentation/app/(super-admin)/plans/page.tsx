'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/presentation/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/presentation/components/ui/dialog';
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from '@/presentation/hooks/use-plans';
import type { Plan } from '@/domain/entities/plan';

const EMPTY_FORM = {
  name: '',
  price: '',
  max_services: '',
  max_reservations_per_month: '',
  max_employees: '',
  has_push_notifications: false,
  has_reports: false,
  has_reminders: false,
  has_custom_page: false,
  description: '',
};

type PlanForm = typeof EMPTY_FORM;

function parseLimit(val: string): number | null {
  if (val === '' || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function limitDisplay(val: number | null): string {
  return val === null ? '∞' : String(val);
}

function formFromPlan(plan: Plan): PlanForm {
  return {
    name: plan.name,
    price: String(plan.price),
    max_services: plan.maxServices !== null ? String(plan.maxServices) : '',
    max_reservations_per_month: plan.maxReservationsPerMonth !== null ? String(plan.maxReservationsPerMonth) : '',
    max_employees: plan.maxEmployees !== null ? String(plan.maxEmployees) : '',
    has_push_notifications: plan.hasPushNotifications,
    has_reports: plan.hasReports,
    has_reminders: plan.hasReminders,
    has_custom_page: plan.hasCustomPage,
    description: plan.description ?? '',
  };
}

export default function PlansPage() {
  const { data: plans, isLoading, error } = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm(formFromPlan(plan));
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.price) return;

    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      max_services: parseLimit(form.max_services),
      max_reservations_per_month: parseLimit(form.max_reservations_per_month),
      max_employees: parseLimit(form.max_employees),
      has_push_notifications: form.has_push_notifications,
      has_reports: form.has_reports,
      has_reminders: form.has_reminders,
      has_custom_page: form.has_custom_page,
      description: form.description || undefined,
    };

    try {
      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...payload });
        toast.success('Plan actualizado');
      } else {
        await createPlan.mutateAsync(payload);
        toast.success('Plan creado');
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingPlan ? 'Error al actualizar plan' : 'Error al crear plan');
    }
  }

  async function handleToggle(plan: Plan) {
    try {
      await updatePlan.mutateAsync({ id: plan.id, is_active: !plan.isActive });
      toast.success(plan.isActive ? 'Plan desactivado' : 'Plan activado');
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlan.mutateAsync(id);
      toast.success('Plan eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Planes</h1>
          <p className="text-sm text-muted-foreground">Administra los planes de membresía</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Crear plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar plan' : 'Crear plan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Pro"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Precio ($/mes)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="19.99"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción corta del plan"
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Límites (vacío = ilimitado)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Max servicios</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_services}
                      onChange={(e) => setForm({ ...form, max_services: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max reservas/mes</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_reservations_per_month}
                      onChange={(e) => setForm({ ...form, max_reservations_per_month: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max empleados</label>
                    <Input
                      type="number"
                      min="0"
                      value={form.max_employees}
                      onChange={(e) => setForm({ ...form, max_employees: e.target.value })}
                      placeholder="∞"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Features</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'has_push_notifications', label: 'Push notifications' },
                    { key: 'has_reports', label: 'Reportes' },
                    { key: 'has_reminders', label: 'Recordatorios' },
                    { key: 'has_custom_page', label: 'Página personalizada' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form[key as keyof PlanForm] as boolean}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="rounded border-zinc-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.price || createPlan.isPending || updatePlan.isPending}
                className="w-full"
              >
                {editingPlan ? 'Guardar cambios' : 'Crear plan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Error al cargar planes
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Reservas/mes</TableHead>
                <TableHead>Empleados</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                  </TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxServices)}</TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxReservationsPerMonth)}</TableCell>
                  <TableCell className="text-sm">{limitDisplay(plan.maxEmployees)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {plan.hasPushNotifications && <Badge variant="outline" className="text-xs">Push</Badge>}
                      {plan.hasReports && <Badge variant="outline" className="text-xs">Reportes</Badge>}
                      {plan.hasReminders && <Badge variant="outline" className="text-xs">Recordatorios</Badge>}
                      {plan.hasCustomPage && <Badge variant="outline" className="text-xs">Página</Badge>}
                      {!plan.hasPushNotifications && !plan.hasReports && !plan.hasReminders && !plan.hasCustomPage && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{plan.tenantsCount ?? 0}</TableCell>
                  <TableCell>
                    <button onClick={() => handleToggle(plan)}>
                      <Badge
                        variant="outline"
                        className={
                          plan.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 cursor-pointer'
                        }
                      >
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(plan.id)} disabled={deletePlan.isPending}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
