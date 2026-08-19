import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';
import type { ServiceStaff, StaffPosition } from '@/domain/entities/service-staff';

export class ListServiceStaffUseCase {
  constructor(private repo: ServiceStaffRepository) {}
  execute(position?: StaffPosition): Promise<ServiceStaff[]> {
    return this.repo.list(position);
  }
}
