import type { ClientResource } from '@/domain/entities/client-resource';

export function mapClientResource(raw: Record<string, unknown>): ClientResource {
  const client = raw.client as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    tenantId: raw.tenant_id as string,
    clientId: raw.client_id as string,
    label: (raw.label as string) ?? null,
    data: (raw.data as Record<string, unknown>) ?? null,
    plate: (raw.plate as string) ?? null,
    brand: (raw.brand as string) ?? null,
    model: (raw.model as string) ?? null,
    color: (raw.color as string) ?? null,
    type: (raw.type as string) ?? null,
    createdAt: new Date(raw.created_at as string),
    client: client
      ? {
          name: client.name as string,
          email: client.email as string,
        }
      : undefined,
  };
}
