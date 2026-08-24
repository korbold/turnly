import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

/**
 * Revierte el cobro entero de un registro. El servicio queda; la plata vuelve
 * a estar por cobrar. No confundir con anular el registro, que mata el ticket.
 */
export class RevertServiceLogPaymentUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string) {
    return this.repo.revertPayment(id);
  }
}
