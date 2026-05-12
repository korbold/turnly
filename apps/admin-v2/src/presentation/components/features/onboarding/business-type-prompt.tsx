'use client';

import { useState, useEffect } from 'react';
import { Car, Scissors, Stethoscope, Flower2, Dumbbell, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui/dialog';
import { cn } from '@/shared/utils/cn';
import { useSettings, useUpdateSettings } from '@/presentation/hooks/use-settings';
import type { BusinessType } from '@/domain/entities/tenant';

const STORAGE_KEY = 'turnly_business_type_shown';

const BUSINESS_OPTIONS: { value: BusinessType; label: string; icon: React.ElementType }[] = [
  { value: 'car_wash', label: 'Car Wash', icon: Car },
  { value: 'barbershop', label: 'Barberia', icon: Scissors },
  { value: 'medical', label: 'Clinica', icon: Stethoscope },
  { value: 'spa', label: 'Spa', icon: Flower2 },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'other', label: 'Otro', icon: MoreHorizontal },
];

export function BusinessTypePrompt() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessType | null>(null);
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  useEffect(() => {
    // Show only if business type is not set and hasn't been shown before
    const shown = localStorage.getItem(STORAGE_KEY);
    if (!shown && settings && !settings.businessType) {
      setOpen(true);
    }
  }, [settings]);

  async function handleSelect(type: BusinessType) {
    setSelected(type);
    try {
      await update.mutateAsync({ businessType: type });
      localStorage.setItem(STORAGE_KEY, 'true');
      toast.success('Tipo de negocio configurado');
      setOpen(false);
    } catch {
      toast.error('Error al configurar');
      setSelected(null);
    }
  }

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Que tipo de negocio tienes?</DialogTitle>
          <DialogDescription>
            Esto nos ayuda a personalizar tu experiencia
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3">
          {BUSINESS_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={update.isPending}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:shadow-md',
                selected === value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]'
                  : 'border-zinc-200 hover:border-[var(--color-primary)]/40'
              )}
            >
              <Icon className={cn('h-8 w-8', selected === value ? 'text-[var(--color-primary)]' : 'text-zinc-500')} />
              <span className={cn('text-sm font-medium', selected === value ? 'text-[var(--color-primary-hover)]' : 'text-zinc-700')}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
