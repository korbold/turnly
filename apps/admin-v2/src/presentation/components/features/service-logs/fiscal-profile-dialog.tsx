'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import {
  BillingProfileForm,
  EMPTY_BILLING_PROFILE,
  isBillingProfileValid,
  type BillingProfileDraft,
} from '@/presentation/components/features/billing/billing-profile-form';
import {
  useServiceLogBilling,
  useUpdateServiceLogBilling,
} from '@/presentation/hooks/use-service-logs';

interface Props {
  serviceLogId: string;
  clientName?: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Occasional-correction dialog for a client's fiscal data. Reached from
 * the Registro Diario row's ⋯ menu — NOT part of the one-click Facturar
 * action. Prefills from the client's current default billing profile and
 * saves the correction in place, so the next factura reads the fixed data.
 */
export function FiscalProfileDialog({ serviceLogId, clientName, open, onClose }: Props) {
  const { data, isLoading } = useServiceLogBilling(serviceLogId, open);
  const mutation = useUpdateServiceLogBilling();
  // The dialog mounts fresh on each open (parent renders it conditionally),
  // so local edits start empty and fall back to the fetched profile until
  // the cashier types. No effect needed to sync the two.
  const [edited, setEdited] = useState<BillingProfileDraft | null>(null);
  const value: BillingProfileDraft = edited ?? data ?? EMPTY_BILLING_PROFILE;

  function submit() {
    if (!isBillingProfileValid(value)) {
      toast.error('Revisa los datos fiscales (documento, razón social y email).');
      return;
    }
    mutation.mutate(
      { id: serviceLogId, data: value },
      {
        onSuccess: () => {
          toast.success('Datos de facturación actualizados');
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo guardar');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos de facturación</DialogTitle>
          <DialogDescription>
            {clientName
              ? `Corrige los datos fiscales de ${clientName}.`
              : 'Corrige los datos fiscales del cliente.'}{' '}
            Se usarán la próxima vez que emitas su factura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-[13px] text-[var(--fg-muted)]">Cargando…</p>
          ) : (
            <BillingProfileForm value={value} onChange={setEdited} defaultOpen />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || isLoading}
            className="cursor-pointer"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
