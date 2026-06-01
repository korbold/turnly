export type UserRole = 'owner' | 'tenant_admin' | 'cashier' | 'washer' | 'client';

export interface User {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  isSuperAdmin: boolean;
  createdAt: Date;
  role?: UserRole;
}
