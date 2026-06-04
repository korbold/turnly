import type {
  ServiceVariantRepository,
  VariantInput,
} from '@/domain/repositories/service-variant.repository';
import type { BomLine, ServiceVariant } from '@/domain/entities/service-variant';
import api from '../client';
import { mapBomLine, mapServiceVariant } from '../mappers/service-variant.mapper';

function buildVariantBody(input: Partial<VariantInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.label !== undefined) body.label = input.label;
  if (input.price !== undefined) body.price = input.price;
  if (input.durationMin !== undefined) body.duration_min = input.durationMin;
  if (input.sortOrder !== undefined) body.sort_order = input.sortOrder;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

export class ApiServiceVariantRepository implements ServiceVariantRepository {
  async listByService(serviceId: string): Promise<ServiceVariant[]> {
    const { data: res } = await api.get(`/services/${serviceId}/variants`);
    return (res.data as Record<string, unknown>[]).map(mapServiceVariant);
  }

  async create(serviceId: string, input: VariantInput): Promise<ServiceVariant> {
    const { data: res } = await api.post(`/services/${serviceId}/variants`, buildVariantBody(input));
    return mapServiceVariant(res.data);
  }

  async update(id: string, input: Partial<VariantInput>): Promise<ServiceVariant> {
    const { data: res } = await api.patch(`/service-variants/${id}`, buildVariantBody(input));
    return mapServiceVariant(res.data);
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/service-variants/${id}`);
  }

  async getBom(variantId: string): Promise<BomLine[]> {
    const { data: res } = await api.get(`/service-variants/${variantId}/consumption`);
    return (res.data as Record<string, unknown>[]).map(mapBomLine);
  }

  async replaceBom(variantId: string, lines: { productId: string; qty: number }[]): Promise<BomLine[]> {
    const body = { lines: lines.map((l) => ({ product_id: l.productId, qty: l.qty })) };
    const { data: res } = await api.put(`/service-variants/${variantId}/consumption`, body);
    return (res.data as Record<string, unknown>[]).map(mapBomLine);
  }
}
