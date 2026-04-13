'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getClientResources, createClientResource, updateClientResource } from '@/lib/api/client-resources';
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
  uppercase?: boolean;
  options?: string[] | null;
}

interface DynamicFormData {
  data: Record<string, string>;
}

function emptyDynamicForm(customFields: CustomField[]): DynamicFormData {
  const data: Record<string, string> = {};
  for (const field of customFields) {
    data[field.key] = '';
  }
  return { data };
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ClientResource | null>(null);
  const [form, setForm] = useState<DynamicFormData>({ data: {} });

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { data?: Record<string, string> } }) =>
      updateClientResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-resources'] });
      setEditDialogOpen(false);
      setEditingResource(null);
    },
  });

  function handleOpenDialog() {
    setForm(emptyDynamicForm(customFields));
    setDialogOpen(true);
  }

  function handleOpenEdit(cr: ClientResource) {
    setEditingResource(cr);
    const data: Record<string, string> = {};
    for (const field of customFields) {
      data[field.key] = cr.data?.[field.key] != null
        ? String(cr.data[field.key])
        : (cr as unknown as Record<string, unknown>)[field.key] != null
          ? String((cr as unknown as Record<string, unknown>)[field.key])
          : '';
    }
    setForm({ data });
    setEditDialogOpen(true);
  }

  function handleFieldChange(key: string, value: string, uppercase?: boolean) {
    const val = uppercase ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, data: { ...prev.data, [key]: val } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      data: form.data,
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingResource) return;
    updateMutation.mutate({
      id: editingResource.id,
      data: { data: form.data },
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
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
                        placeholder={field.label}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={form.data[field.key] ?? ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
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
                        onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
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
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientResources.map((cr) => (
                    <TableRow
                      key={cr.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/clients/${cr.id}`)}
                    >
                      <TableCell className="font-medium">{cr.id.slice(0, 8)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {clientResources.map((cr) => (
                  <div
                    key={`mob-${cr.id}`}
                    className="rounded-xl border bg-white p-4 space-y-2 cursor-pointer"
                    onClick={() => router.push(`/clients/${cr.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {getFieldValue(cr, customFields[0]?.key ?? '')}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(cr);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {customFields.slice(1).map((field) => (
                        <p key={field.key}>
                          <span className="font-medium text-gray-600">{field.label}:</span>{' '}
                          {getFieldValue(cr, field.key)}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {customFields.map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientResources.map((cr) => (
                      <TableRow
                        key={cr.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/clients/${cr.id}`)}
                      >
                        {customFields.map((field) => (
                          <TableCell key={field.key}>{getFieldValue(cr, field.key)}</TableCell>
                        ))}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(cr);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {customFields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    value={form.data[field.key] ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
                    placeholder={field.label}
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.required}
                    value={form.data[field.key] ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
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
                    onChange={(e) => handleFieldChange(field.key, e.target.value, field.uppercase)}
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}

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
