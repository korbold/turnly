import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import type { InvoiceFilters } from '@/domain/entities/invoice';

export class GetInvoicesUseCase {
  constructor(private repo: InvoiceRepository) {}

  execute(filters: InvoiceFilters) {
    return this.repo.getAll(filters);
  }
}
