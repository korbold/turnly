import type { ServiceRepository, CreateServiceData } from '@/domain/repositories/service.repository';
import type { Service } from '@/domain/entities/service';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapService } from '../mappers/service.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiServiceRepository implements ServiceRepository {
  async getAll(page?: number): Promise<PaginatedResult<Service>> {
    const { data } = await api.get('/services', { params: { page } });
    return mapPaginatedResponse(data, mapService);
  }

  async create(data: CreateServiceData): Promise<Service> {
    const { data: res } = await api.post('/services', {
      name: data.name,
      price: data.price,
      description: data.description,
      image_url: data.imageUrl,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    });
    return mapService(res.data ?? res);
  }

  async update(id: string, data: Partial<CreateServiceData>): Promise<Service> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.description !== undefined) body.description = data.description;
    if (data.imageUrl !== undefined) body.image_url = data.imageUrl;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    if (data.sortOrder !== undefined) body.sort_order = data.sortOrder;

    const { data: res } = await api.put(`/services/${id}`, body);
    return mapService(res.data ?? res);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  }
}
