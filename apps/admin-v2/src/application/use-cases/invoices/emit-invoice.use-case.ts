import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';

export class EmitInvoiceUseCase {
  constructor(private repo: InvoiceRepository) {}

  execute(serviceLogId: string) {
    return this.repo.emit(serviceLogId);
  }
}
