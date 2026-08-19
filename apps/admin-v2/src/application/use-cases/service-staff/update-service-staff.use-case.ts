import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, UpdateServiceStaffInput } from '@/domain/entities/service-staff';

export class UpdateServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff> {
    return this.repo.update(id, input);
  }
}
