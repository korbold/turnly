import api from '@/infrastructure/api/client';
import type { BusinessResource, CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';

function mapResource(raw: Record<string, unknown>): BusinessResource {
  return {
    id: raw.id as string,
    tenantId: raw.tenant_id as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    employeeId: (raw.employee_id as string | null) ?? null,
    type: raw.type as 'physical' | 'person',
    isActive: raw.is_active as boolean,
    sortOrder: raw.sort_order as number,
    createdAt: new Date(raw.created_at as string),
    updatedAt: new Date(raw.updated_at as string),
  };
}

export class ApiBusinessResourceRepository implements BusinessResourceRepository {
  async list(): Promise<BusinessResource[]> {
    const { data: res } = await api.get<{ data: Record<string, unknown>[] }>('/business-resources');
    return res.data.map(mapResource);
  }

  async create(input: CreateBusinessResourceInput): Promise<BusinessResource> {
    const { data: res } = await api.post<{ data: Record<string, unknown> }>('/business-resources', {
      name: input.name,
      description: input.description ?? null,
      employee_id: input.employeeId ?? null,
      type: input.type ?? 'physical',
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    });
    return mapResource(res.data);
  }

  async update(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource> {
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.employeeId !== undefined) payload.employee_id = input.employeeId;
    if (input.type !== undefined) payload.type = input.type;
    if (input.isActive !== undefined) payload.is_active = input.isActive;
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

    const { data: res } = await api.patch<{ data: Record<string, unknown> }>(`/business-resources/${id}`, payload);
    return mapResource(res.data);
  }

  async remove(id: string): Promise<void> {
    await api.delete(`/business-resources/${id}`);
  }
}
