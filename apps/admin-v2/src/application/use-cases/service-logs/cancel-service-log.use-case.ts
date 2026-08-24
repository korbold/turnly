import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

/**
 * Anula el registro: queda visible como historia, congelado y fuera de los
 * totales. Revierte el cobro si lo tenía y devuelve lo vendido al inventario.
 */
export class CancelServiceLogUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, reasonCode: string, reasonNote?: string) {
    return this.repo.cancel(id, reasonCode, reasonNote);
  }
}
