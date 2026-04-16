import type { Service } from '../entities/service';
import type { PaginatedResult } from '../../shared/types/api';

export interface CreateServiceData {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ServiceRepository {
  getAll(page?: number): Promise<PaginatedResult<Service>>;
  create(data: CreateServiceData): Promise<Service>;
  update(id: string, data: Partial<CreateServiceData>): Promise<Service>;
  delete(id: string): Promise<void>;
}
