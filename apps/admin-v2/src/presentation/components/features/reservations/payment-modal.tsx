'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
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
import { useRecordReservationPayment } from '@/presentation/hooks/use-reservations';
import { cn } from '@/shared/utils/cn';
import { ECUADOR_BANKS } from '@/shared/constants/banks';
import { BankChip } from '@/presentation/components/features/reservations/bank-chip';
import type {
  ReservationPaymentMethod,
  ClientBillingProfile,
  BillingSnapshot,
} from '@/domain/entities/reservation';

type DocType = 'final_consumer' | 'cedula' | 'ruc' | 'passport';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'final_consumer', label: 'Consumidor final' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'ruc', label: 'RUC' },
  { value: 'passport', label: 'Pasaporte' },
];

interface Props {
  open: boolean;
  reservationId: string;
  total: number;
  /** Client's saved default fiscal profile — prefills the billing fields. */
  defaultProfile?: ClientBillingProfile | null;
  /** Billing captured earlier (e.g. at check-in) — takes precedence for prefill. */
  currentBilling?: BillingSnapshot | null;
  defaultEmail?: string | null;
  defaultName?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const METHODS: {
  value: ReservationPaymentMethod;
  label: string;
  icon: typeof Banknote;
  hint: string;
}[] = [
  {
    value: 'cash',
    label: 'Efectivo',
    icon: Banknote,
    hint: 'Pago en caja al momento del retiro',
  },
  {
    value: 'card',
    label: 'Tarjeta',
    icon: CreditCard,
    hint: 'Crédito o débito · POS',
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    icon: ArrowLeftRight,
    hint: 'Captura el # de comprobante en la referencia',
  },
];

export function PaymentModal({
  open,
  reservationId,
  total,
  defaultProfile,
  currentBilling,
  defaultEmail,
  defaultName,
  onClose,
  onSuccess,
}: Props) {
  const [method, setMethod] = useState<ReservationPaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>('final_consumer');
  const [docNumber, setDocNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const mutation = useRecordReservationPayment(reservationId);

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setReference('');
    setBank(null);

    // Prefill fiscal data: billing already captured on this reservation
    // (check-in) wins; otherwise the client's saved profile; else CONSUMIDOR
    // FINAL with name/email seeded.
    const src =
      currentBilling && currentBilling.docType !== 'final_consumer'
        ? currentBilling
        : defaultProfile && defaultProfile.docType !== 'final_consumer'
          ? defaultProfile
          : null;

    if (src) {
      setDocType(src.docType);
      setDocNumber(src.docNumber ?? '');
      setLegalName(src.legalName || (defaultName ?? ''));
      setEmail(src.email || (defaultEmail ?? ''));
      setAddress(src.address ?? '');
      setPhone(src.phone ?? '');
    } else {
      setDocType('final_consumer');
      setDocNumber('');
      setLegalName(defaultName ?? '');
      setEmail(defaultEmail ?? '');
      setAddress('');
      setPhone('');
    }
  }, [open, currentBilling, defaultProfile, defaultEmail, defaultName]);

  // Clear bank selection if cashier switches away from transfer.
  useEffect(() => {
    if (method !== 'transfer') setBank(null);
  }, [method]);

  function submit() {
    if (method === 'transfer' && !bank) {
      toast.error('Selecciona el banco emisor');
      return;
    }
    if (docType !== 'final_consumer' && (!docNumber.trim() || !legalName.trim())) {
      toast.error('Documento y nombre legal son obligatorios');
      return;
    }

    const billing =
      docType === 'final_consumer'
        ? { docType, docNumber: '9999999999999', legalName: 'CONSUMIDOR FINAL' }
        : { docType, docNumber, legalName, email, address, phone };

    mutation.mutate(
      {
        method,
        reference: reference.trim() || null,
        bank: method === 'transfer' ? bank : null,
        billing,
      },
      {
        onSuccess: () => {
          toast.success('Pago registrado');
          onSuccess?.();
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          toast.error(e?.message ?? 'No se pudo registrar el pago');
        },
      },
    );
  }

  const moneyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Confirma el método con el que el cliente pagó. Al marcar pagado se
            emite la factura electrónica y los items quedan bloqueados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total recap so the cashier confirms the amount before
              picking a method. Mono font + tabular nums so it scans
              like a receipt line. */}
          <div className="flex items-baseline justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-4 py-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
              Total a cobrar
            </span>
            <span
              className="font-mono text-[20px] font-bold tabular-nums text-[var(--fg-strong)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {moneyFmt}
            </span>
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Método de pago
            </Label>
            <div className="grid gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                        active
                          ? 'bg-[var(--brand-100)] text-[var(--brand-700)]'
                          : 'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--fg-strong)]">
                        {m.label}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--fg-muted)]">
                        {m.hint}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-full border-2',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-500)]'
                          : 'border-[var(--border-strong)] bg-[var(--bg-app)]',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bank picker — only appears for transferencia. Color chip +
              full bank name keeps it scannable for the cashier picking
              from across the counter. */}
          {method === 'transfer' && (
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                Banco emisor
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ECUADOR_BANKS.map((b) => {
                  const active = bank === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => setBank(b.slug)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]',
                        active
                          ? 'border-[var(--brand-500)] bg-[var(--brand-50)]'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <BankChip bank={b} size={28} />
                      <span className="min-w-0 truncate text-[12px] font-medium text-[var(--fg-strong)]">
                        {b.name.replace(/^Banco\s/, '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Referencia <span className="font-normal normal-case text-[var(--fg-muted)]">(opcional)</span>
            </Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={
                method === 'transfer'
                  ? '# de comprobante'
                  : method === 'card'
                  ? 'Últimos 4 dígitos · voucher'
                  : 'Detalle interno'
              }
              maxLength={100}
            />
          </div>

          {/* Fiscal data for the invoice — captured here (like check-in) so
              the factura carries the buyer's identity. Defaults to consumidor
              final; prefilled when known. */}
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Datos de facturación
            </Label>
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
        </div>

        <p className="mt-3 rounded-md bg-[var(--warning-50,#fef9ec)] px-3 py-2 text-[12px] text-[var(--warning-700,#92640a)]">
          Al marcar pagado se emite la factura electrónica al SRI y ya no se
          pueden modificar los servicios. Esta acción no se puede deshacer.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="cursor-pointer">
            Marcar pagado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
