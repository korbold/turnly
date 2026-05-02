export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}

export const RESERVATION_STATUS_CONFIG: Record<ReservationStatus, StatusConfig> = {
  pending: {
    label: 'Pendiente',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    dotColor: 'bg-amber-500',
  },
  confirmed: {
    label: 'Confirmada',
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    dotColor: 'bg-sky-500',
  },
  in_progress: {
    label: 'En Progreso',
    color: 'text-[var(--color-primary)]',
    bgColor: 'bg-[var(--color-primary-muted)]',
    dotColor: 'bg-[var(--color-primary)]',
  },
  completed: {
    label: 'Completada',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    dotColor: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    dotColor: 'bg-rose-500',
  },
  no_show: {
    label: 'Ausente',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-slate-500',
  },
};

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface PaymentMethodConfig {
  label: string;
  icon: string;
}

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, PaymentMethodConfig> = {
  cash: { label: 'Efectivo', icon: '\uD83D\uDCB5' },
  card: { label: 'Tarjeta', icon: '\uD83D\uDCB3' },
  transfer: { label: 'Transferencia', icon: '\uD83D\uDD04' },
  other: { label: 'Otro', icon: '\uD83D\uDCCB' },
};
