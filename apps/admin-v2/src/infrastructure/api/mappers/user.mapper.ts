import type { User } from '@/domain/entities/user';

export function mapUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as string,
    name: raw.name as string,
    email: (raw.email as string | null) ?? null,
    username: (raw.username as string | null) ?? null,
    phone: (raw.phone as string) ?? null,
    isSuperAdmin: (raw.is_super_admin as boolean) ?? false,
    createdAt: raw.created_at ? new Date(raw.created_at as string) : new Date(),
    role: raw.role as User['role'],
  };
}
