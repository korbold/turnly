import type {
  ServiceRepository,
  CreateServiceData,
  ListServicesParams,
} from '@/domain/repositories/service.repository';
import type { Service } from '@/domain/entities/service';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapService } from '../mappers/service.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiServiceRepository implements ServiceRepository {
  async getAll(params?: ListServicesParams): Promise<PaginatedResult<Service>> {
    // Sin parámetros el que llama quiere el catálogo entero. Los selectores
    // dependen de eso: paginarlos escondería servicios sin que nadie se entere,
    // que es exactamente el bug que el paginado no debe reintroducir.
    const paged = Boolean(params?.page || params?.perPage || params?.q);

    const query: Record<string, unknown> = paged
      ? {
          page: params?.page ?? 1,
          ...(params?.perPage ? { per_page: params.perPage } : {}),
          ...(params?.q ? { q: params.q } : {}),
        }
      : { per_page: 'all' };

    const { data: res } = await api.get('/services', { params: query });
    return mapPaginatedResponse(res, mapService);
  }

  async getById(id: string): Promise<Service> {
    const { data: res } = await api.get(`/services/${id}`);
    return mapService(res.data);
  }

  async create(data: CreateServiceData): Promise<Service> {
    const { data: res } = await api.post('/services', {
      name: data.name,
      price: data.price,
      description: data.description,
      image_url: data.imageUrl || null,
      is_active: data.isActive,
      staffing: data.staffing ?? 'washer',
      sort_order: data.sortOrder,
    });
    return mapService(res.data);
  }

  async update(id: string, data: Partial<CreateServiceData>): Promise<Service> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.price !== undefined) body.price = data.price;
    if (data.description !== undefined) body.description = data.description;
    if (data.imageUrl !== undefined) body.image_url = data.imageUrl || null;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    if (data.staffing !== undefined) body.staffing = data.staffing;
    if (data.sortOrder !== undefined) body.sort_order = data.sortOrder;

    const { data: res } = await api.put(`/services/${id}`, body);
    return mapService(res.data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  }
}
