import type { ClientResource } from '../entities/client-resource';
import type { PaginatedResult } from '../../shared/types/api';

export interface BillingProfileInput {
  docType: 'final_consumer' | 'cedula' | 'ruc' | 'passport';
  docNumber?: string;
  legalName?: string;
  email?: string;
  address?: string;
  phone?: string;
}

export interface CreateClientResourceData {
  clientId?: string;
  data?: Record<string, unknown>;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
  /** Optional SRI billing snapshot. Persisted on the linked user when
      present so check-in can auto-pick it (Fase D). */
  billingProfile?: BillingProfileInput;
}

export interface ClientResourceRepository {
  getAll(page?: number, search?: string): Promise<PaginatedResult<ClientResource>>;
  getById(id: string): Promise<ClientResource>;
  create(data: CreateClientResourceData): Promise<ClientResource>;
  update(id: string, data: Partial<CreateClientResourceData>): Promise<ClientResource>;
  getHistory(id: string): Promise<unknown[]>;
}
