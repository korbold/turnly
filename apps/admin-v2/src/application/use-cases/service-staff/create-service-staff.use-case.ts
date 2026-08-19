import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, CreateServiceStaffInput } from '@/domain/entities/service-staff';

export class CreateServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(input: CreateServiceStaffInput): Promise<ServiceStaff> {
    return this.repo.create(input);
  }
}
