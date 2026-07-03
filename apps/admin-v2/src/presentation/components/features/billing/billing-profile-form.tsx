'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { isCedula, isRuc } from '@/shared/utils/ecuador-id';

export type BillingDocType = 'final_consumer' | 'cedula' | 'ruc' | 'passport';

export interface BillingProfileDraft {
  docType: BillingDocType;
  docNumber: string;
  legalName: string;
  email: string;
  address: string;
  phone: string;
}

export const EMPTY_BILLING_PROFILE: BillingProfileDraft = {
  docType: 'final_consumer',
  docNumber: '',
  legalName: '',
  email: '',
  address: '',
  phone: '',
};

const DOC_TYPES: { value: BillingDocType; label: string }[] = [
  { value: 'final_consumer', label: 'Consumidor final' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'ruc', label: 'RUC' },
  { value: 'passport', label: 'Pasaporte' },
];

interface Props {
  value: BillingProfileDraft;
  onChange: (next: BillingProfileDraft) => void;
  /** When true the section renders expanded by default. */
  defaultOpen?: boolean;
  /** Visual nesting — used inside other forms (NewServiceModal). */
  compact?: boolean;
}

/**
 * Reusable collapsible form that captures the SRI billing snapshot for
 * a new customer. The parent owns the state so the same component
 * powers both the service-log create flow and the reservation client
 * resource creation flow. Optional by default — leaving it collapsed
 * means the cashier doesn't have to fill anything.
 *
 * Doc-number validation runs client-side via the public SRI checksum
 * so the cashier sees red borders on typos before submitting. Server
 * re-runs the same check.
 */
export function BillingProfileForm({ value, onChange, defaultOpen = false, compact = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  function patch(p: Partial<BillingProfileDraft>) {
    onChange({ ...value, ...p });
  }

  const docNumberInvalid =
    (value.docType === 'cedula' && value.docNumber !== '' && !isCedula(value.docNumber)) ||
    (value.docType === 'ruc' && value.docNumber !== '' && !isRuc(value.docNumber));
  const showFields = value.docType !== 'final_consumer';

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border)]',
        compact ? 'bg-[var(--bg-app)]' : 'bg-[var(--bg-surface)]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] rounded-lg"
      >
        <span className="flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-[var(--fg-secondary)]" aria-hidden="true" />
          <span className="text-[12.5px] font-semibold text-[var(--fg-strong)]">
            Datos de facturación
          </span>
          <span className="text-[11px] font-normal text-[var(--fg-muted)]">(opcional)</span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
              Tipo de comprobante
            </Label>
            <Select
              value={value.docType}
              onValueChange={(v) => patch({ docType: v as BillingDocType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFields ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Documento
                  </Label>
                  <Input
                    value={value.docNumber}
                    onChange={(e) => patch({ docNumber: e.target.value })}
                    placeholder={value.docType === 'ruc' ? '13 dígitos' : value.docType === 'cedula' ? '10 dígitos' : 'Número'}
                    className={cn(docNumberInvalid && 'border-[var(--danger-500)]')}
                    aria-invalid={docNumberInvalid || undefined}
                  />
                  {docNumberInvalid && (
                    <p className="text-[11px] text-[var(--danger-600)]">
                      {value.docType === 'cedula' ? 'Cédula' : 'RUC'} inválida — revisa el dígito verificador.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Razón social
                  </Label>
                  <Input
                    value={value.legalName}
                    onChange={(e) => patch({ legalName: e.target.value })}
                    placeholder="Nombre / Razón social"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                  Email
                </Label>
                <Input
                  type="email"
                  value={value.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                />
                <p className="text-[11px] text-[var(--fg-muted)]">
                  Obligatorio SRI para envío del XML autorizado.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Dirección
                  </Label>
                  <Input
                    value={value.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--fg-muted)]">
                    Teléfono
                  </Label>
                  <Input
                    value={value.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-[var(--fg-muted)]">
              Sin captura — el sistema usa <span className="font-mono">9999999999999</span> y razón social <strong>CONSUMIDOR FINAL</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Returns true when the draft is complete enough to send to the
 * backend. `final_consumer` only needs the doc_type. Others need the
 * minimum SRI fields.
 */
export function isBillingProfileValid(value: BillingProfileDraft): boolean {
  if (value.docType === 'final_consumer') return true;
  if (!value.docNumber.trim()) return false;
  if (value.docType === 'cedula' && !isCedula(value.docNumber)) return false;
  if (value.docType === 'ruc' && !isRuc(value.docNumber)) return false;
  if (!value.legalName.trim()) return false;
  if (!value.email.trim()) return false;
  return true;
}

/**
 * Returns true when the draft carries enough signal to bother
 * serializing it to the backend. Used by the create-resource flows to
 * skip the backend call when the cashier left it untouched.
 */
export function isBillingProfileDirty(value: BillingProfileDraft): boolean {
  if (value.docType !== 'final_consumer') return true;
  if (value.docNumber.trim()) return true;
  if (value.legalName.trim()) return true;
  if (value.email.trim()) return true;
  if (value.address.trim()) return true;
  if (value.phone.trim()) return true;
  return false;
}
