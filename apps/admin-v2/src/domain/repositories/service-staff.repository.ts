import type {
  ServiceStaff,
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';

/** Sin `remove`: el personal se desactiva, nunca se borra — los servicios que
    ya hizo tienen que seguir nombrándolo cuando llega un reclamo. */
export interface ServiceStaffRepository {
  /** `position` pide los de ese puesto más los de puesto `both`. */
  list(position?: StaffPosition): Promise<ServiceStaff[]>;
  create(input: CreateServiceStaffInput): Promise<ServiceStaff>;
  update(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff>;
}
