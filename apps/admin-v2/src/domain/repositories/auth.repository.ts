import type { User } from '../entities/user';
import type { Tenant } from '../entities/tenant';

export interface LoginResult {
  user: User;
  token: string;
  tenant: Tenant | null;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<LoginResult>;
  register(data: {
    name: string;
    email: string;
    password: string;
    businessName?: string;
    businessType?: string;
  }): Promise<LoginResult>;
  logout(): Promise<void>;
  me(): Promise<{ user: User; tenant: Tenant | null }>;
}
