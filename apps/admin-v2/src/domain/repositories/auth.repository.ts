import type { User } from '../entities/user';
import type { Tenant } from '../entities/tenant';

export interface LoginResult {
  user: User;
  token: string;
  tenant: Tenant | null;
}

export interface RegisterResult extends LoginResult {
  emailVerified: boolean;
}

export interface AuthRepository {
  login(identifier: string, password: string): Promise<LoginResult>;
  register(data: {
    name: string;
    email: string;
    password: string;
    businessName?: string;
    businessType?: string;
  }): Promise<RegisterResult>;
  verifyEmail(email: string, code: string): Promise<LoginResult>;
  resendVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(input: { email: string; token: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<{ user: User; tenant: Tenant | null }>;
}
