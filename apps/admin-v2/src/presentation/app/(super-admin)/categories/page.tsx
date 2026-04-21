'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
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
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type BusinessCategory,
} from '@/presentation/hooks/use-categories';

export default function CategoriesPage() {
  const { data: categories, isLoading, error } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: newName.trim() });
      setNewName('');
      toast.success('Categoria creada');
    } catch {
      toast.error('Error al crear categoria');
    }
  }

  function startEdit(cat: BusinessCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    try {
      await updateCategory.mutateAsync({ id, name: editName.trim() });
      setEditingId(null);
      toast.success('Categoria actualizada');
    } catch {
      toast.error('Error al actualizar');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Categoria eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  async function handleToggle(cat: BusinessCategory) {
    try {
      await updateCategory.mutateAsync({ id: cat.id, is_active: !cat.is_active });
      toast.success(cat.is_active ? 'Categoria desactivada' : 'Categoria activada');
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Administra los tipos de negocio disponibles en la plataforma
        </p>
      </div>

      {/* Create new */}
      <div className="flex gap-2">
        <Input
          placeholder="Nombre de nueva categoria..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="max-w-sm"
        />
        <Button onClick={handleCreate} disabled={!newName.trim() || createCategory.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          Crear
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          Error al cargar categorias: {(error as { message?: string })?.message ?? 'Error desconocido'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.sort_order}
                  </TableCell>
                  <TableCell>
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(cat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-8 w-48"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(cat.id)}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 text-zinc-400" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{cat.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{cat.slug}</code>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => handleToggle(cat)}>
                      <Badge
                        variant="outline"
                        className={
                          cat.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 cursor-pointer'
                        }
                      >
                        {cat.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(cat)}
                        disabled={editingId !== null}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(cat.id)}
                        disabled={deleteCategory.isPending}
                      >
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
