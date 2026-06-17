import type { BusinessResource, CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export interface BusinessResourceRepository {
  list(): Promise<BusinessResource[]>;
  create(input: CreateBusinessResourceInput): Promise<BusinessResource>;
  update(id: string, input: UpdateBusinessResourceInput): Promise<BusinessResource>;
  remove(id: string): Promise<void>;
}
