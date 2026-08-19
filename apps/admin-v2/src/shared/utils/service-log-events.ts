import type { ServiceLogEvent } from '@/domain/entities/service-log';

const POSITION_LABEL: Record<string, string> = {
  washer: 'Lavador',
  dryer: 'Secador',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const INVOICE_LABEL: Record<string, string> = {
  pendiente: 'Factura pendiente',
  enviada: 'Factura enviada al SRI',
  autorizada: 'Factura autorizada',
  rechazada: 'Factura rechazada',
};

function money(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n);
}

/**
 * Una línea en castellano por evento. La bitácora se lee cuando entra un
 * reclamo, así que tiene que decir qué pasó sin que nadie traduzca claves.
 */
export function describeServiceLogEvent(event: ServiceLogEvent): string {
  const d = event.detail;

  switch (event.event) {
    case 'created':
      return 'Registró el servicio';

    case 'assignee_changed': {
      const position = POSITION_LABEL[String(d.position)] ?? 'Asignado';
      const from = (d.from_name as string | null) ?? '—';
      const to = (d.to_name as string | null) ?? '—';
      return `${position}: ${from} → ${to}`;
    }

    case 'items_changed':
      return `Cambió los servicios · ${money(d.total_before)} → ${money(d.total_after)}`;

    case 'payment_recorded': {
      const method = METHOD_LABEL[String(d.method)] ?? String(d.method);
      const bank = d.bank ? ` · ${String(d.bank)}` : '';
      return `Cobró ${money(d.amount)} · ${method}${bank}`;
    }

    case 'status_changed':
      return d.to === 'completed' ? 'Completó el servicio' : `Estado: ${String(d.to)}`;

    case 'invoice_requested':
      return 'Solicitó factura';

    case 'invoice_status_changed': {
      const label = INVOICE_LABEL[String(d.to)] ?? `Factura ${String(d.to)}`;
      return d.reason ? `${label}: ${String(d.reason)}` : label;
    }

    default:
      return event.event;
  }
}
