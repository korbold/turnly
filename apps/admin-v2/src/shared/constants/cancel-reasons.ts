/**
 * Espejo de `App\Domain\ServiceLog\CancelReason`. Lista cerrada a propósito,
 * igual que los motivos de precio: texto libre se degrada a "error", "x",
 * "prueba" en un mes y deja sin agrupar la única pregunta que importa — por
 * qué desaparecen tickets del día.
 *
 * Si esto y el backend divergen, el backend rechaza con 422.
 */
export const CANCEL_REASONS = [
  { code: 'duplicado',   label: 'Duplicado',             hint: 'Se registró dos veces el mismo auto.' },
  { code: 'error_carga', label: 'Error de carga',        hint: 'Vehículo, servicio o precio equivocados.' },
  { code: 'arrepentido', label: 'Cliente se arrepintió', hint: 'Se fue antes de que se hiciera el trabajo.' },
  { code: 'otro',        label: 'Otro',                  hint: 'Exige escribir de qué se trata.' },
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number]['code'];

/** El único que exige nota escrita. */
export const CANCEL_REASON_REQUIRES_NOTE: CancelReasonCode = 'otro';
