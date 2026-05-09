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
        <p className="text-sm text-[var(--fg-muted)]">
          <span className="font-medium text-[var(--fg-default,#2E3441)]">{count}</span>
          <span className="text-[var(--fg-muted)]"> de {MAX_IMAGES} fotos</span>
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
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Subir foto
          </Button>
        </div>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)] py-16">
          <ImageIcon className="mb-2 h-10 w-10 text-[var(--fg-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--fg-muted)]">Aún no hay fotos</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-[var(--brand-700)] hover:text-[var(--brand-600)]"
            onClick={() => fileInputRef.current?.click()}
          >
            Sube la primera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.isArray(images) &&
            images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--niebla-clara,#F4F5F7)]"
              >
                <img src={img.url} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
                <button
                  onClick={() => handleDelete(img.id)}
                  aria-label="Eliminar foto"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-150 ease-out hover:bg-black/80 active:scale-[0.94] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
