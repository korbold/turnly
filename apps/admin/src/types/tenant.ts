export interface Tenant {
  id: string;
  slug: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string;
  plan: 'trial' | 'basic' | 'pro';
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  onboarding_step: number;
  activated_at: string | null;
  created_at: string;
}
