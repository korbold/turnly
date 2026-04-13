'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { getServiceLogs, getDailySummary, updateServiceLog } from '@/lib/api/service-log';
import { getReservations } from '@/lib/api/reservations';
import { getServices } from '@/lib/api/services';
import { getUsers } from '@/lib/api/users';
import { DailyLogTable } from '@/components/service-log/DailyLogTable';
import { DailySummaryCard } from '@/components/service-log/DailySummaryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { ServiceLog } from '@/types/service-log';

export default function ServiceLogPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ServiceLog | null>(null);
  const [editForm, setEditForm] = useState({
    service_id: '',
    attended_by: '',
    price_charged: '',
    payment_method: '',
    notes: '',
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['service-logs', date],
    queryFn: () => getServiceLogs({ date, per_page: 100 }),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', date],
    queryFn: () => getDailySummary(date),
  });

  const reservationsQueryKey = ['reservations', 'daily', date];
  const { data: reservationsData, isLoading: reservationsLoading } = useQuery({
    queryKey: reservationsQueryKey,
    queryFn: () => getReservations({ date, per_page: 100 }),
  });

  const reservations = reservationsData?.data ?? [];

  const { data: servicesData } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices({ per_page: 100 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => getUsers({ per_page: 100, exclude_role: 'client' }),
  });

  const services = servicesData?.data ?? [];
  const users = usersData?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateServiceLog>[1] }) =>
      updateServiceLog(id, data),
    onSuccess: () => {
      toast.success('Registro actualizado');
      setEditDialogOpen(false);
      setEditingLog(null);
      queryClient.invalidateQueries({ queryKey: ['service-logs', date] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', date] });
    },
    onError: () => {
      toast.error('Error al actualizar el registro');
    },
  });

  const handleEdit = (log: ServiceLog) => {
    setEditingLog(log);
    setEditForm({
      service_id: log.service_id ?? '',
      attended_by: log.attended_by ?? '',
      price_charged: String(log.price_charged ?? ''),
      payment_method: log.payment_method ?? '',
      notes: log.notes ?? '',
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    updateMutation.mutate({
      id: editingLog.id,
      data: {
        service_id: editForm.service_id || undefined,
        attended_by: editForm.attended_by || undefined,
        price_charged: editForm.price_charged ? Number(editForm.price_charged) : undefined,
        payment_method: editForm.payment_method || undefined,
        notes: editForm.notes || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro del día</h1>
          <p className="text-gray-500">Registro de servicios del día</p>
        </div>
        <Link href="/service-log/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Registrar servicio
          </Button>
        </Link>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Fecha:</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {/* Log table */}
      <Card>
        <CardHeader>
          <CardTitle>Servicios del día</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <DailyLogTable logs={logsData?.data ?? []} reservations={reservations} date={date} onEdit={handleEdit} />
          )}
        </CardContent>
      </Card>

      {/* Daily summary */}
      {summaryLoading ? (
        <div className="text-center py-4 text-muted-foreground">Cargando resumen...</div>
      ) : summary ? (
        <DailySummaryCard summary={summary} />
      ) : null}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Servicio</Label>
              <Select value={editForm.service_id} onValueChange={(v) => {
                const s = services.find((s) => s.id === v);
                setEditForm((f) => ({ ...f, service_id: v ?? '', price_charged: s ? s.price : f.price_charged }));
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar servicio">
                    {editForm.service_id
                      ? (() => {
                          const s = services.find((s) => s.id === editForm.service_id);
                          return s ? `${s.name} — $${Number(s.price).toFixed(2)}` : editForm.service_id;
                        })()
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — ${Number(s.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Empleado</Label>
              <Select value={editForm.attended_by} onValueChange={(v) => setEditForm((f) => ({ ...f, attended_by: v ?? '' }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar empleado">
                    {editForm.attended_by
                      ? (() => {
                          const u = users.find((u) => u.id === editForm.attended_by);
                          return u ? u.name : editForm.attended_by;
                        })()
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Precio</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.price_charged}
                onChange={(e) => setEditForm((f) => ({ ...f, price_charged: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Método de pago</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm((f) => ({ ...f, payment_method: v ?? '' }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar método">
                    {editForm.payment_method
                      ? { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' }[editForm.payment_method] ?? editForm.payment_method
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observaciones..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
