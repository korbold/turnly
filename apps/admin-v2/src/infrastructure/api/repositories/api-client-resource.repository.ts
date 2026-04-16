import type {
  ClientResourceRepository,
  CreateClientResourceData,
} from '@/domain/repositories/client-resource.repository';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapClientResource } from '../mappers/client-resource.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiClientResourceRepository implements ClientResourceRepository {
  async getAll(page?: number, search?: string): Promise<PaginatedResult<ClientResource>> {
    const params: Record<string, unknown> = {};
    if (page) params.page = page;
    if (search) params.search = search;

    const { data } = await api.get('/client-resources', { params });
    return mapPaginatedResponse(data, mapClientResource);
  }

  async getById(id: string): Promise<ClientResource> {
    const { data } = await api.get(`/client-resources/${id}`);
    return mapClientResource(data.data ?? data);
  }

  async create(data: CreateClientResourceData): Promise<ClientResource> {
    const body: Record<string, unknown> = {};
    if (data.clientId) body.client_id = data.clientId;
    if (data.data) body.data = data.data;
    if (data.plate) body.plate = data.plate;
    if (data.brand) body.brand = data.brand;
    if (data.model) body.model = data.model;
    if (data.color) body.color = data.color;
    if (data.type) body.type = data.type;

    const { data: res } = await api.post('/client-resources', body);
    return mapClientResource(res.data ?? res);
  }

  async update(id: string, data: Partial<CreateClientResourceData>): Promise<ClientResource> {
    const body: Record<string, unknown> = {};
    if (data.clientId !== undefined) body.client_id = data.clientId;
    if (data.data !== undefined) body.data = data.data;
    if (data.plate !== undefined) body.plate = data.plate;
    if (data.brand !== undefined) body.brand = data.brand;
    if (data.model !== undefined) body.model = data.model;
    if (data.color !== undefined) body.color = data.color;
    if (data.type !== undefined) body.type = data.type;

    const { data: res } = await api.patch(`/client-resources/${id}`, body);
    return mapClientResource(res.data ?? res);
  }

  async getHistory(id: string): Promise<unknown[]> {
    const { data } = await api.get(`/client-resources/${id}/history`);
    return data.data ?? data;
  }
}
