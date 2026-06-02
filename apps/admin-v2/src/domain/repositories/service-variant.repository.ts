import type { BomLine, ServiceVariant } from '../entities/service-variant';

export interface VariantInput {
  label: string;
  price?: number;
  durationMin?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ServiceVariantRepository {
  listByService(serviceId: string): Promise<ServiceVariant[]>;
  create(serviceId: string, input: VariantInput): Promise<ServiceVariant>;
  update(id: string, input: Partial<VariantInput>): Promise<ServiceVariant>;
  delete(id: string): Promise<void>;
  getBom(variantId: string): Promise<BomLine[]>;
  replaceBom(variantId: string, lines: { productId: string; qty: number }[]): Promise<BomLine[]>;
}
