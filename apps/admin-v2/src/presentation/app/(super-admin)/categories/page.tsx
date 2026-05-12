'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Badge } from '@/presentation/components/ui/badge';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/presentation/components/ui/popover';
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

  const [newForm, setNewForm] = useState({ name: '', emoji: '', color: '#6B7280', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', emoji: '', color: '', description: '' });

  async function handleCreate() {
    if (!newForm.name.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: newForm.name.trim(),
        emoji: newForm.emoji || undefined,
        color: newForm.color || undefined,
        description: newForm.description || undefined,
      });
      setNewForm({ name: '', emoji: '', color: '#6B7280', description: '' });
      toast.success('Categoria creada');
    } catch {
      toast.error('Error al crear categoria');
    }
  }

  function startEdit(cat: BusinessCategory) {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      emoji: cat.emoji ?? '',
      color: cat.color ?? '#6B7280',
      description: cat.description ?? '',
    });
  }

  async function handleUpdate(id: string) {
    if (!editForm.name.trim()) return;
    try {
      await updateCategory.mutateAsync({
        id,
        name: editForm.name.trim(),
        emoji: editForm.emoji || undefined,
        color: editForm.color || undefined,
        description: editForm.description || undefined,
      });
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
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <p className="text-sm font-medium">Nueva categoria</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Nombre"
            value={newForm.name}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-xl">
                {newForm.emoji || 'Emoji...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <EmojiPicker
                onEmojiClick={(e: EmojiClickData) => setNewForm({ ...newForm, emoji: e.emoji })}
                width={300}
                height={350}
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newForm.color}
              onChange={(e) => setNewForm({ ...newForm, color: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border"
            />
            <Input
              placeholder="Descripción corta"
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
            />
          </div>
          <Button onClick={handleCreate} disabled={!newForm.name.trim() || createCategory.isPending}>
            <Plus className="mr-1.5 h-4 w-4" />
            Crear
          </Button>
        </div>
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
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-16">Emoji</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-16">Color</TableHead>
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-xl hover:scale-110 transition-transform">
                            {editForm.emoji || '🏪'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <EmojiPicker
                            onEmojiClick={(e: EmojiClickData) => setEditForm({ ...editForm, emoji: e.emoji })}
                            width={300}
                            height={350}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-xl">{cat.emoji ?? '🏪'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === cat.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(cat.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-8 w-40"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{cat.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === cat.id ? (
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="h-8 w-48"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{cat.description ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === cat.id ? (
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded border"
                      />
                    ) : (
                      <div
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: cat.color ?? '#6B7280' }}
                      />
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
                      {editingId === cat.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdate(cat.id)}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4 text-zinc-400" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(cat)} disabled={editingId !== null}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)} disabled={deleteCategory.isPending}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                        </>
                      )}
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
