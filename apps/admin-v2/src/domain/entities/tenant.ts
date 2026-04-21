export type TenantPlan = 'trial' | 'basic' | 'pro';
export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type BusinessType = 'car_wash' | 'barbershop' | 'medical' | 'spa' | 'gym' | 'other';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string;
  plan: TenantPlan;
  status: TenantStatus;
  trialEndsAt: Date | null;
  onboardingStep: number;
  activatedAt: Date | null;
  createdAt: Date;
}

export interface TenantSettings {
  name: string;
  slug: string;
  businessType: BusinessType | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  themeColor: string | null;
  slotDuration: number;
  cancellationHours: number;
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
    whatsapp: string | null;
  };
  customFields: CustomField[];
  permissions: Record<string, Record<string, string>>;
}

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  capitalize?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
}

export interface TenantImage {
  id: string;
  url: string;
  sortOrder: number;
}
