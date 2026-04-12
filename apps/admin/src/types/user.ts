export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string;
  role?: string;
}
