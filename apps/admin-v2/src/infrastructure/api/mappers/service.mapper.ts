import type { Service } from '@/domain/entities/service';

export function mapService(raw: Record<string, unknown>): Service {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    price: typeof raw.price === 'string' ? parseFloat(raw.price) : (raw.price as number),
    isActive: (raw.is_active as boolean) ?? true,
    imageUrl: (raw.image_url as string) ?? null,
    sortOrder: (raw.sort_order as number) ?? 0,
    createdAt: new Date(raw.created_at as string),
  };
}
