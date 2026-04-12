'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/lib/api/uploads';

interface ImageUploadProps {
  currentUrl?: string | null;
  folder: 'logos' | 'covers' | 'gallery' | 'services';
  onUpload: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  label?: string;
  rounded?: boolean;
}

export function ImageUpload({
  currentUrl,
  folder,
  onUpload,
  onRemove,
  className,
  label = 'Click para subir imagen',
  rounded = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const url = await uploadImage(file, folder);
      onUpload(url);
    } catch {
      setError('Error al subir la imagen. Intenta de nuevo.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploading ? (
        <div
          className={cn(
            'flex items-center justify-center gap-2 bg-muted text-muted-foreground text-sm',
            rounded ? 'rounded-full size-24' : 'rounded-lg w-full h-32 border border-dashed border-border'
          )}
        >
          <svg
            className="animate-spin size-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span>Subiendo...</span>
        </div>
      ) : currentUrl ? (
        <div className={cn('relative inline-block', rounded ? 'size-24' : 'w-full h-32')}>
          <Image
            src={currentUrl}
            alt="Preview"
            fill
            className={cn('object-cover', rounded ? 'rounded-full' : 'rounded-lg')}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 z-10 flex items-center justify-center size-6 rounded-full bg-destructive text-destructive-foreground shadow hover:opacity-90 transition-opacity"
              aria-label="Eliminar imagen"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-medium',
              rounded ? 'rounded-full' : 'rounded-lg'
            )}
            aria-label="Cambiar imagen"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer w-full',
            rounded ? 'rounded-full size-24' : 'rounded-lg h-32'
          )}
        >
          <Upload className="size-5 shrink-0" />
          <span className="text-xs text-center px-2">{label}</span>
        </button>
      )}

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
