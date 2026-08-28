import { CANCEL_REASONS } from '@/shared/constants/cancel-reasons';

const CANCEL_REASON_LABEL: Record<string, string> = Object.fromEntries(
  CANCEL_REASONS.map((r) => [r.code, r.label]),
);

import type { ServiceLogEvent } from '@/domain/entities/service-log';
import { REASON_LABEL } from '@/shared/constants/price-change-reasons';
import { formatCurrency } from '@/shared/utils/format';

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

/** Nombre legible de cada campo que el editor puede tocar. */
const FIELD_LABEL: Record<string, string> = {
  attended_by: 'Empleado',
  payment_method: 'Método de pago',
  payment_bank: 'Banco',
  notes: 'Notas',
  price_charged: 'Precio',
};

function money(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  // es-EC pone la coma como separador decimal y el signo donde no va; en
  // Ecuador el dólar se escribe $1,234.56. formatCurrency ya lo resuelve.
  return formatCurrency(n, { decimals: true });
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

    case 'log_updated': {
      const changes = Array.isArray(d.changes) ? (d.changes as Array<Record<string, unknown>>) : [];
      const parts = changes.map((c) => {
        const label = FIELD_LABEL[String(c.field)] ?? String(c.field);
        // El método de pago se lee en castellano; el resto tal cual quedó.
        const val = (v: unknown) => {
          if (v === null || v === undefined || v === '') return '—';
          if (c.field === 'payment_method') return METHOD_LABEL[String(v)] ?? String(v);
          if (c.field === 'price_charged') return money(v);
          return String(v);
        };
        return `${label}: ${val(c.from)} → ${val(c.to)}`;
      });
      return parts.length ? `Editó el registro · ${parts.join(' · ')}` : 'Editó el registro';
    }

    case 'resource_assigned': {
      // Se le devolvió el vehículo a un registro que lo había perdido. La
      // placa y no el id: la bitácora se lee.
      const placa = typeof d.plate === 'string' && d.plate.trim() ? d.plate.trim() : 'sin placa';
      return `Asignó el vehículo · ${placa}`;
    }

    case 'items_changed':
      return `Cambió los servicios · ${money(d.total_before)} → ${money(d.total_after)}`;

    case 'price_changed': {
      // Sin los dos números el evento no dice nada: la bitácora es donde se
      // lee quién descontó y cuándo cuando entra un reclamo.
      const motivo = REASON_LABEL[String(d.reason)] ?? 'Sin motivo';
      const nota = typeof d.note === 'string' && d.note.trim() ? ` — ${d.note.trim()}` : '';
      return `Precio: ${money(d.catalog)} → ${money(d.charged)} · ${motivo}${nota}`;
    }

    case 'payment_recorded': {
      const method = METHOD_LABEL[String(d.method)] ?? String(d.method);
      const bank = d.bank ? ` · ${String(d.bank)}` : '';
      return `Cobró ${money(d.amount)} · ${method}${bank}`;
    }

    case 'payment_reverted': {
      const method = METHOD_LABEL[String(d.method)] ?? String(d.method);
      return `Revirtió el pago de ${money(d.amount)}${d.method ? ` · ${method}` : ''}`;
    }

    case 'log_cancelled': {
      const motivo = CANCEL_REASON_LABEL[String(d.reason)] ?? 'Sin motivo';
      const nota = typeof d.note === 'string' && d.note.trim() ? ` — ${d.note.trim()}` : '';
      return `Anuló el registro · ${motivo}${nota}`;
    }

    // El impago del cierre. Sin esta línea la bitácora imprimía la clave
    // cruda —"left_owing"— justo en el evento que explica por qué el ticket
    // se completó sin plata.
    case 'left_owing':
      return `Se fue debiendo ${money(d.amount)}`;

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
