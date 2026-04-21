import type { AppNotification } from '@/domain/entities/app-notification';

export function mapNotification(raw: Record<string, unknown>): AppNotification {
  return {
    id: raw.id as string,
    type: raw.type as string,
    title: raw.title as string,
    body: raw.body as string,
    actionType: (raw.action_type as string) ?? null,
    actionId: (raw.action_id as string) ?? null,
    tenantId: (raw.tenant_id as string) ?? null,
    tenantName: (raw.tenant_name as string) ?? null,
    icon: (raw.icon as string) ?? null,
    readAt: raw.read_at ? new Date(raw.read_at as string) : null,
    createdAt: new Date(raw.created_at as string),
  };
}
