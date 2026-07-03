export type ResourceType = 'physical' | 'person';

export interface BusinessResource {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  employeeId: string | null;
  type: ResourceType;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessResourceInput {
  name: string;
  description?: string | null;
  employeeId?: string | null;
  type?: ResourceType;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateBusinessResourceInput extends Partial<CreateBusinessResourceInput> {}
