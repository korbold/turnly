export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  maxServices: number | null;
  maxReservationsPerMonth: number | null;
  maxEmployees: number | null;
  hasPushNotifications: boolean;
  hasReports: boolean;
  hasReminders: boolean;
  hasCustomPage: boolean;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  tenantsCount?: number;
  createdAt: Date;
}

export interface PlanSummary {
  id: string;
  name: string;
  slug: string;
  price: number;
}
