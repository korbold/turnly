'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { useCheckInReservation } from '@/presentation/hooks/use-reservations';

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
  const [docType, setDocType] = useState<DocType>('final_consumer');
  const [docNumber, setDocNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

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
          toast.success('Check-in registrado');
          onSuccess();
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo hacer check-in');
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in</DialogTitle>
          <DialogDescription>
            Confirma los datos de facturación. Una vez guardados se reservan los
            insumos en inventario y la reserva pasa a estado <strong>checked_in</strong>.
          </DialogDescription>
        </DialogHeader>

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
