'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import {
  useCheckInReservation,
  useReservationItems,
} from '@/presentation/hooks/use-reservations';

interface Props {
  open: boolean;
  reservationId: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

type DocType = 'final_consumer' | 'cedula' | 'ruc' | 'passport';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'final_consumer', label: 'Consumidor final' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'ruc', label: 'RUC' },
  { value: 'passport', label: 'Pasaporte' },
];

export function CheckInModal({ open, reservationId, defaultEmail, defaultName, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType>('final_consumer');
  const [docNumber, setDocNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Items snapshot — read-only inside the modal so staff can confirm
  // the customer ordered what they expected before billing is frozen.
  // Editing routes back to the full /reservations/{id} page where the
  // swap-variant + override-price tooling already lives.
  const { data: items } = useReservationItems(open ? reservationId : null);
  const itemsTotal = (items ?? []).reduce((acc, it) => acc + it.lineTotal, 0);
  const moneyFmt = (n: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);

  const mutation = useCheckInReservation(reservationId);

  useEffect(() => {
    if (open) {
      setDocType('final_consumer');
      setDocNumber('');
      setLegalName(defaultName ?? '');
      setEmail(defaultEmail ?? '');
      setAddress('');
      setPhone('');
    }
  }, [open, defaultEmail, defaultName]);

  function submit() {
    const billing = docType === 'final_consumer'
      ? { docType, docNumber: '9999999999999', legalName: 'CONSUMIDOR FINAL' }
      : { docType, docNumber, legalName, email, address, phone };

    if (docType !== 'final_consumer') {
      if (!docNumber.trim() || !legalName.trim()) {
        toast.error('Documento y nombre legal son obligatorios');
        return;
      }
    }

    mutation.mutate(
      { billing },
      {
        onSuccess: () => {
          toast.success('Llegada registrada');
          onSuccess();
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo registrar la llegada');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar llegada</DialogTitle>
          <DialogDescription>
            Revisa los servicios y confirma los datos de facturación. Al
            guardar se reservan los insumos en inventario y la reserva pasa a
            estado <strong>revisando</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Items snapshot — read-only here. "Editar servicios" jumps to
            the full items editor so the staff can swap a variant, drop
            a line, or override a price before billing is frozen. */}
        {items && items.length > 0 && (
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Servicios ({items.length})
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/reservations/${reservationId}`);
                }}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand-700)] hover:underline"
              >
                <Pencil className="h-3 w-3" />
                Editar servicios
              </button>
            </div>
            <ul className="space-y-1">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="flex-1 truncate text-[var(--fg-strong)]">
                    {it.label}
                  </span>
                  {it.qty !== 1 && (
                    <span
                      className="font-mono text-[12px] text-[var(--fg-muted)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      x{it.qty}
                    </span>
                  )}
                  <span
                    className="w-20 text-right font-mono text-[var(--fg-strong)] tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {moneyFmt(it.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-[13px] font-semibold">
              <span>Total</span>
              <span
                className="font-mono tabular-nums"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {moneyFmt(itemsTotal)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">Tipo de comprobante</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {docType !== 'final_consumer' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5">Documento</Label>
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder={docType === 'ruc' ? '13 dígitos' : '10 dígitos'}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Nombre / Razón social</Label>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Obligatorio SRI para envío del XML autorizado.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5">Dirección</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5">Teléfono</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            Hacer check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
