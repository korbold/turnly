import type { Plan, PlanSummary } from '@/domain/entities/plan';

export function mapPlan(raw: Record<string, unknown>): Plan {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    price: raw.price as number,
    maxServices: (raw.max_services as number) ?? null,
    maxReservationsPerMonth: (raw.max_reservations_per_month as number) ?? null,
    maxEmployees: (raw.max_employees as number) ?? null,
    hasPushNotifications: raw.has_push_notifications as boolean,
    hasReports: raw.has_reports as boolean,
    hasReminders: raw.has_reminders as boolean,
    hasCustomPage: raw.has_custom_page as boolean,
    isActive: raw.is_active as boolean,
    sortOrder: (raw.sort_order as number) ?? 0,
    description: (raw.description as string) ?? null,
    tenantsCount: raw.tenants_count as number | undefined,
    createdAt: new Date(raw.created_at as string),
  };
}

export function mapPlanSummary(raw: Record<string, unknown>): PlanSummary {
  return {
    id: raw.id as string,
    name: raw.name as string,
    slug: raw.slug as string,
    price: raw.price as number,
  };
}
