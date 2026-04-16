import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';

export class GetStatsUseCase {
  constructor(private repo: SuperAdminRepository) {}

  execute() {
    return this.repo.getStats();
  }
}
