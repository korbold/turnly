'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getVehicles, createVehicle } from '@/lib/api/vehicles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedán' },
  { value: 'suv', label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Van' },
  { value: 'motorcycle', label: 'Moto' },
  { value: 'other', label: 'Otro' },
];

interface VehicleFormData {
  plate: string;
  brand: string;
  model: string;
  color: string;
  type: string;
}

const emptyForm: VehicleFormData = {
  plate: '',
  brand: '',
  model: '',
  color: '',
  type: '',
};

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<VehicleFormData>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => getVehicles({ per_page: 100 }),
  });

  const vehicles = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDialogOpen(false);
      setForm(emptyForm);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      plate: form.plate,
      brand: form.brand || undefined,
      model: form.model || undefined,
      color: form.color || undefined,
      type: form.type || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Registro de clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo vehículo
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo vehículo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Placa <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
                  placeholder="ABC-123"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Marca</label>
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Modelo</label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="Corolla"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Color</label>
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="Blanco"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tipo</label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v ?? '' })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Guardando...' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading
              ? 'Cargando...'
              : `${vehicles.length} vehículo${vehicles.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando vehículos...</div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay vehículos registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Propietario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow
                    key={vehicle.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                  >
                    <TableCell className="font-medium font-mono">{vehicle.plate}</TableCell>
                    <TableCell>{vehicle.brand ?? '—'}</TableCell>
                    <TableCell>{vehicle.model ?? '—'}</TableCell>
                    <TableCell>{vehicle.color ?? '—'}</TableCell>
                    <TableCell>
                      {VEHICLE_TYPES.find((t) => t.value === vehicle.type)?.label ?? vehicle.type}
                    </TableCell>
                    <TableCell>{vehicle.owner?.name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
