import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';

/**
 * Deshace el cobro entero de un registro. El servicio queda; la plata vuelve
 * a estar por cobrar. El backend exige dueño o admin y bloquea lo facturado y
 * lo que ya entró en una caja cerrada.
 */
export class VoidServiceLogPaymentUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string) {
    return this.repo.voidPayment(id);
  }
}
