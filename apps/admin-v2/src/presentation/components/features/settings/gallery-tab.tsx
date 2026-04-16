'use client';

import { useRef } from 'react';
import { Plus, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/presentation/components/ui/button';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { useImages, useAddImage, useDeleteImage } from '@/presentation/hooks/use-settings';

const MAX_IMAGES = 10;

export function GalleryTab() {
  const { data: imagesData, isLoading } = useImages();
  const addImage = useAddImage();
  const deleteImage = useDeleteImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = Array.isArray(imagesData) ? imagesData : (imagesData as { data?: typeof imagesData } | undefined)?.data ?? [];
  const count = Array.isArray(images) ? images.length : 0;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (count >= MAX_IMAGES) {
      toast.error(`Maximo ${MAX_IMAGES} fotos`);
      return;
    }
    try {
      await addImage.mutateAsync(file);
      toast.success('Foto agregada');
    } catch {
      toast.error('Error al subir foto');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(id: string) {
    try {
      await deleteImage.mutateAsync(id);
      toast.success('Foto eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {count}/{MAX_IMAGES} fotos
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            disabled={count >= MAX_IMAGES || addImage.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Subir Foto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.isArray(images) &&
          images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-zinc-100">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

        {count === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16">
            <ImageIcon className="mb-2 h-10 w-10 text-zinc-300" />
            <p className="text-sm text-muted-foreground">No hay fotos aun</p>
          </div>
        )}
      </div>
    </div>
  );
}
