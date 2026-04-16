import type { ClientResource } from '../entities/client-resource';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateClientResourceData {
  clientId?: string;
  data?: Record<string, unknown>;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
}

export interface ClientResourceRepository {
  getAll(page?: number, search?: string): Promise<PaginatedResult<ClientResource>>;
  getById(id: string): Promise<ClientResource>;
  create(data: CreateClientResourceData): Promise<ClientResource>;
  update(id: string, data: Partial<CreateClientResourceData>): Promise<ClientResource>;
  getHistory(id: string): Promise<unknown[]>;
}
