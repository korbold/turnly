import type { Product, StockMovement } from '@/domain/entities/product';

export function mapProduct(raw: Record<string, unknown>): Product {
  const stockRaw = raw.stock as Record<string, unknown> | null | undefined;
  return {
    id: raw.id as string,
    sku: (raw.sku as string | null) ?? null,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    type: raw.type as Product['type'],
    unit: raw.unit as Product['unit'],
    cost: Number(raw.cost ?? 0),
    price: Number(raw.price ?? 0),
    taxRate: Number(raw.tax_rate ?? 0),
    stockMin: Number(raw.stock_min ?? 0),
    isActive: Boolean(raw.is_active),
    stock: stockRaw
      ? {
          onHand: Number(stockRaw.on_hand ?? 0),
          reserved: Number(stockRaw.reserved ?? 0),
          avgCost: Number(stockRaw.avg_cost ?? 0),
          low: Boolean(stockRaw.low),
        }
      : null,
    createdAt: raw.created_at ? new Date(raw.created_at as string) : new Date(),
    updatedAt: raw.updated_at ? new Date(raw.updated_at as string) : new Date(),
  };
}

export function mapStockMovement(raw: Record<string, unknown>): StockMovement {
  return {
    id: raw.id as string,
    productId: raw.product_id as string,
    type: raw.type as StockMovement['type'],
    qty: Number(raw.qty ?? 0),
    unitCost: Number(raw.unit_cost ?? 0),
    refType: (raw.ref_type as string | null) ?? null,
    refId: (raw.ref_id as string | null) ?? null,
    user: raw.user
      ? {
          id: (raw.user as { id: string }).id,
          name: (raw.user as { name: string }).name,
        }
      : null,
    note: (raw.note as string | null) ?? null,
    createdAt: new Date(raw.created_at as string),
  };
}
