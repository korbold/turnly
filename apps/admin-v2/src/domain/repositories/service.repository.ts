import type { Service, ServiceStaffing } from '../entities/service';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceData {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  /** Sólo lavadoras: qué personal lleva el trabajo. */
  staffing?: ServiceStaffing;
  sortOrder?: number;
}

export interface ListServicesParams {
  page?: number;
  perPage?: number;
  /** Búsqueda por nombre o descripción, resuelta en el servidor. */
  q?: string;
}

export interface ServiceRepository {
  /** Sin parámetros devuelve el catálogo entero, que es lo que necesitan los selectores. */
  getAll(params?: ListServicesParams): Promise<PaginatedResult<Service>>;
  getById(id: string): Promise<Service>;
  create(data: CreateServiceData): Promise<Service>;
  update(id: string, data: Partial<CreateServiceData>): Promise<Service>;
  delete(id: string): Promise<void>;
}
