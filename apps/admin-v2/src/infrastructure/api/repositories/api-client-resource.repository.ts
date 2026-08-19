import type {
  ClientResourceRepository,
  CreateClientResourceData,
  ClientBillingProfile,
} from '@/domain/repositories/client-resource.repository';
import type { ClientResource } from '@/domain/entities/client-resource';
import type { PaginatedResult } from '@/shared/types/api';
import api from '../client';
import { mapClientResource } from '../mappers/client-resource.mapper';
import { mapPaginatedResponse } from '../mappers/pagination';

export class ApiClientResourceRepository implements ClientResourceRepository {
  async getAll(
    page?: number,
    search?: string,
    withDebt?: boolean,
  ): Promise<PaginatedResult<ClientResource>> {
    const params: Record<string, unknown> = {};
    if (page) params.page = page;
    if (search) params.search = search;
    // Sólo cuando está activo: mandarlo siempre haría que el backend
    // evaluara el filtro en cada listado.
    if (withDebt) params.with_debt = 1;

    const { data: res } = await api.get('/client-resources', { params: { ...params, all: 1 } });
    return mapPaginatedResponse(res, mapClientResource);
  }

  async getById(id: string): Promise<ClientResource> {
    const { data: res } = await api.get(`/client-resources/${id}`);
    // Response is the resource directly (no data wrapper for single resource)
    return mapClientResource(res.id ? res : res.data);
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
    if (data.billingProfile) {
      body.billing_profile = {
        doc_type:   data.billingProfile.docType,
        doc_number: data.billingProfile.docNumber ?? null,
        legal_name: data.billingProfile.legalName ?? null,
        email:      data.billingProfile.email ?? null,
        address:    data.billingProfile.address ?? null,
        phone:      data.billingProfile.phone ?? null,
      };
    }

    const { data: res } = await api.post('/client-resources', body);
    return mapClientResource(res.id ? res : res.data);
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
    return mapClientResource(res.id ? res : res.data);
  }

  async getHistory(id: string): Promise<unknown[]> {
    const { data: res } = await api.get(`/client-resources/${id}/history`);
    return Array.isArray(res) ? res : (res.data ?? []);
  }

  async getBilling(id: string): Promise<ClientBillingProfile> {
    const { data: res } = await api.get(`/client-resources/${id}/billing`);
    return mapBilling(res.data);
  }

  async updateBilling(id: string, data: ClientBillingProfile): Promise<ClientBillingProfile> {
    const { data: res } = await api.put(`/client-resources/${id}/billing`, {
      doc_type:   data.docType,
      doc_number: data.docNumber,
      legal_name: data.legalName,
      email:      data.email,
      address:    data.address,
      phone:      data.phone,
    });
    return mapBilling(res.data);
  }
}

function mapBilling(raw: Record<string, unknown>): ClientBillingProfile {
  return {
    docType:   (raw.doc_type as ClientBillingProfile['docType']) ?? 'final_consumer',
    docNumber: (raw.doc_number as string) ?? '',
    legalName: (raw.legal_name as string) ?? '',
    email:     (raw.email as string) ?? '',
    address:   (raw.address as string) ?? '',
    phone:     (raw.phone as string) ?? '',
  };
}
