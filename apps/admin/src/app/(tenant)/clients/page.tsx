'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getClientResources, createClientResource } from '@/lib/api/client-resources';
import type { ClientResource } from '@/types/client-resource';
import { getTenantSettings } from '@/lib/api/tenant';
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

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  required: boolean;
  options?: string[] | null;
}

interface DynamicFormData {
  label: string;
  data: Record<string, string>;
}

function emptyDynamicForm(customFields: CustomField[]): DynamicFormData {
  const data: Record<string, string> = {};
  for (const field of customFields) {
    data[field.key] = '';
  }
  return { label: '', data };
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DynamicFormData>({ label: '', data: {} });

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: getTenantSettings,
  });

  const customFields: CustomField[] = tenantData?.custom_fields ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['client-resources'],
    queryFn: () => getClientResources({ per_page: 100 }),
  });

  const clientResources = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createClientResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-resources'] });
      setDialogOpen(false);
      setForm(emptyDynamicForm(customFields));
    },
  });

  function handleOpenDialog() {
    setForm(emptyDynamicForm(customFields));
    setDialogOpen(true);
  }

  function handleFieldChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, data: { ...prev.data, [key]: value } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      label: form.label || undefined,
      data: form.data,
    });
  }

  function getFieldValue(cr: ClientResource, fieldKey: string): string {
    if (cr.data && cr.data[fieldKey] != null) {
      return String(cr.data[fieldKey]);
    }
    // Fallback to old flat fields (plate, brand, model, color, type)
    const flatValue = (cr as unknown as Record<string, unknown>)[fieldKey];
    if (flatValue != null) {
      return String(flatValue);
    }
    return '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Registro de clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleOpenDialog} />}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo cliente
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Etiqueta
                </label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Ej: Toyota ABC-123"
                />
              </div>

              {customFields.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3">
                  <Settings className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    No hay campos personalizados configurados. Ve a{' '}
                    <a href="/settings" className="underline text-primary">
                      Configuración
                    </a>{' '}
                    para definir los campos del cliente.
                  </span>
                </div>
              ) : (
                customFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        required={field.required}
                        value={form.data[field.key] ?? ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
                        placeholder={field.label}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={form.data[field.key] ?? ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Seleccionar...</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={form.data[field.key] ?? ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.label}
                      />
                    )}
                  </div>
                ))
              )}

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
              : `${clientResources.length} cliente${clientResources.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
          ) : clientResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay clientes registrados.
            </div>
          ) : customFields.length === 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3">
                <Settings className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  No hay campos personalizados configurados. Ve a{' '}
                  <a href="/settings" className="underline text-primary">
                    Configuración
                  </a>{' '}
                  para definir los campos del cliente.
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etiqueta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientResources.map((cr) => (
                    <TableRow
                      key={cr.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/clients/${cr.id}`)}
                    >
                      <TableCell className="font-medium">{cr.label ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  {customFields.map((field) => (
                    <TableHead key={field.key}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientResources.map((cr) => (
                  <TableRow
                    key={cr.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/clients/${cr.id}`)}
                  >
                    <TableCell className="font-medium">{cr.label ?? '—'}</TableCell>
                    {customFields.map((field) => (
                      <TableCell key={field.key}>{getFieldValue(cr, field.key)}</TableCell>
                    ))}
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
