export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
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
    color: 'text-[var(--status-pending-fg)]',
    bgColor: 'bg-[var(--status-pending-bg)]',
    dotColor: 'bg-[var(--status-pending-fg)]',
  },
  confirmed: {
    label: 'Confirmada',
    color: 'text-[var(--status-confirmed-fg)]',
    bgColor: 'bg-[var(--status-confirmed-bg)]',
    dotColor: 'bg-[var(--status-confirmed-fg)]',
  },
  checked_in: {
    label: 'Revisando',
    color: 'text-[var(--warning-700)]',
    bgColor: 'bg-[var(--warning-50)]',
    dotColor: 'bg-[var(--warning-700)]',
  },
  in_progress: {
    label: 'En progreso',
    color: 'text-[var(--status-progress-fg)]',
    bgColor: 'bg-[var(--status-progress-bg)]',
    dotColor: 'bg-[var(--status-progress-fg)]',
  },
  completed: {
    label: 'Completada',
    color: 'text-[var(--status-completed-fg)]',
    bgColor: 'bg-[var(--status-completed-bg)]',
    dotColor: 'bg-[var(--status-completed-fg)]',
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-[var(--status-cancelled-fg)]',
    bgColor: 'bg-[var(--status-cancelled-bg)]',
    dotColor: 'bg-[var(--status-cancelled-fg)]',
  },
  no_show: {
    label: 'Ausente',
    color: 'text-[var(--status-noshow-fg)]',
    bgColor: 'bg-[var(--status-noshow-bg)]',
    dotColor: 'bg-[var(--status-noshow-fg)]',
  },
};

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface PaymentMethodConfig {
  label: string;
  icon: string;
}

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, PaymentMethodConfig> = {
  cash: { label: 'Efectivo', icon: '💵' },
  card: { label: 'Tarjeta', icon: '💳' },
  transfer: { label: 'Transferencia', icon: '🔄' },
  other: { label: 'Otro', icon: '📋' },
};
