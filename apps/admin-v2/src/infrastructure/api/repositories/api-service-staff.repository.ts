import api from '@/infrastructure/api/client';
import type {
  ServiceStaff,
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';
import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';

function mapStaff(raw: Record<string, unknown>): ServiceStaff {
  return {
    id: raw.id as string,
    name: raw.name as string,
    position: raw.position as StaffPosition,
    isActive: raw.is_active as boolean,
    createdAt: new Date(raw.created_at as string),
  };
}

export class ApiServiceStaffRepository implements ServiceStaffRepository {
  async list(position?: StaffPosition): Promise<ServiceStaff[]> {
    const { data: res } = await api.get<{ data: Record<string, unknown>[] }>(
      '/service-staff',
      { params: position ? { position } : undefined },
    );
    return res.data.map(mapStaff);
  }

  async create(input: CreateServiceStaffInput): Promise<ServiceStaff> {
    const { data: res } = await api.post<{ data: Record<string, unknown> }>('/service-staff', {
      name: input.name,
      position: input.position,
      is_active: input.isActive ?? true,
    });
    return mapStaff(res.data);
  }

  async update(id: string, input: UpdateServiceStaffInput): Promise<ServiceStaff> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.position !== undefined) payload.position = input.position;
    if (input.isActive !== undefined) payload.is_active = input.isActive;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(
      `/service-staff/${id}`,
      payload,
    );
    return mapStaff(res.data);
  }
}
