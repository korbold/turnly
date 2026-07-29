'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Receipt, Pencil } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import {
  BillingProfileForm,
  EMPTY_BILLING_PROFILE,
  isBillingProfileValid,
  type BillingProfileDraft,
} from '@/presentation/components/features/billing/billing-profile-form';
import { useClientBilling, useUpdateClientBilling } from '@/presentation/hooks/use-clients';

const DOC_LABEL: Record<BillingProfileDraft['docType'], string> = {
  final_consumer: 'Consumidor final',
  cedula: 'Cédula',
  ruc: 'RUC',
  passport: 'Pasaporte',
};

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--fg-strong)]">{value}</dd>
    </div>
  );
}

/**
 * Client-detail "Datos de facturación" card. Shows the client's real
 * fiscal identity and lets the user correct it — the same profile the SRI
 * factura reads. Occasional edit, decoupled from the cobro/facturar flow.
 */
export function ClientBillingSection({ clientResourceId }: { clientResourceId: string }) {
  const { data, isLoading } = useClientBilling(clientResourceId);
  const [open, setOpen] = useState(false);

  const hasFiscal = !!data && data.docType !== 'final_consumer' && !!data.docNumber;

  return (
    <section
      aria-label="Datos de facturación"
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden="true" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
            Datos de facturación
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Editar
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-3 text-[13px] text-[var(--fg-muted)]">Cargando…</p>
      ) : hasFiscal ? (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
          <Field label="Tipo" value={DOC_LABEL[data!.docType]} />
          <Field label="Documento" value={data!.docNumber} />
          <Field label="Razón social" value={data!.legalName} />
          <Field label="Email" value={data!.email} />
          <Field label="Dirección" value={data!.address} />
          <Field label="Teléfono" value={data!.phone} />
        </dl>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--fg-secondary)]">
          Sin datos fiscales — se factura como <strong>CONSUMIDOR FINAL</strong>. Toca Editar para
          registrar la cédula/RUC del cliente.
        </p>
      )}

      <ClientBillingDialog
        clientResourceId={clientResourceId}
        current={data}
        open={open}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}

function ClientBillingDialog({
  clientResourceId,
  current,
  open,
  onClose,
}: {
  clientResourceId: string;
  current?: BillingProfileDraft;
  open: boolean;
  onClose: () => void;
}) {
  const mutation = useUpdateClientBilling();
  const [edited, setEdited] = useState<BillingProfileDraft | null>(null);
  const value: BillingProfileDraft = edited ?? current ?? EMPTY_BILLING_PROFILE;

  function submit() {
    if (!isBillingProfileValid(value)) {
      toast.error('Revisa los datos fiscales (documento, razón social y email).');
      return;
    }
    mutation.mutate(
      { id: clientResourceId, data: value },
      {
        onSuccess: () => {
          toast.success('Datos de facturación actualizados');
          setEdited(null);
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setEdited(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos de facturación</DialogTitle>
          <DialogDescription>
            Se usan para emitir la factura electrónica de este cliente.
          </DialogDescription>
        </DialogHeader>

        <BillingProfileForm value={value} onChange={setEdited} defaultOpen />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setEdited(null);
              onClose();
            }}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="cursor-pointer">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
