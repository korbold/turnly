import type {
  RecordPaymentData,
  ServiceLogRepository,
} from '@/domain/repositories/service-log.repository';

export class RecordServiceLogPaymentUseCase {
  constructor(private repo: ServiceLogRepository) {}

  execute(id: string, data: RecordPaymentData) {
    return this.repo.recordPayment(id, data);
  }
}
