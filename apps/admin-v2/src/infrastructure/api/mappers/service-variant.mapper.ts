import type { BomLine, ServiceVariant } from '@/domain/entities/service-variant';

export function mapServiceVariant(raw: Record<string, unknown>): ServiceVariant {
  const consumption = (raw.consumption as Record<string, unknown>[] | undefined)?.map(mapBomLine);
  return {
    id: raw.id as string,
    serviceId: raw.service_id as string,
    label: raw.label as string,
    price: Number(raw.price ?? 0),
    durationMin: Number(raw.duration_min ?? 30),
    sortOrder: Number(raw.sort_order ?? 0),
    isActive: Boolean(raw.is_active),
    consumption,
    createdAt: raw.created_at ? new Date(raw.created_at as string) : undefined,
    updatedAt: raw.updated_at ? new Date(raw.updated_at as string) : undefined,
  };
}

export function mapBomLine(raw: Record<string, unknown>): BomLine {
  const product = raw.product as Record<string, unknown> | null | undefined;
  return {
    id: (raw.id as string | undefined),
    productId: raw.product_id as string,
    qty: Number(raw.qty ?? 0),
    product: product
      ? {
          id: product.id as string,
          name: product.name as string,
          unit: product.unit as string,
          sku: (product.sku as string | null) ?? null,
        }
      : null,
  };
}
