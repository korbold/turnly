# Admin V2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Turnly admin panel with Clean Architecture, modern SaaS UI/UX for non-technical business owners.

**Architecture:** Clean Architecture with 4 layers: domain (entities + repository interfaces), application (use cases + DTOs), infrastructure (API repos + mappers + storage), presentation (Next.js pages + components + hooks). Dependency rule: arrows point inward.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, shadcn/ui, Tailwind CSS 4, TanStack Query 5, React Hook Form, Zod, Framer Motion, Recharts, nuqs, Axios

**Spec:** `docs/superpowers/specs/2026-04-16-admin-v2-redesign.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `apps/admin-v2/package.json`
- Create: `apps/admin-v2/next.config.ts`
- Create: `apps/admin-v2/tsconfig.json`
- Create: `apps/admin-v2/.env.local`
- Create: `apps/admin-v2/src/presentation/app/layout.tsx`
- Create: `apps/admin-v2/src/presentation/app/page.tsx`

- [ ] **Step 1: Create Next.js 16 app**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps
npx create-next-app@latest admin-v2 --typescript --tailwind --app --src-dir --no-import-alias --no-turbopack
```

- [ ] **Step 2: Move src/app to src/presentation/app**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2
mkdir -p src/presentation
mv src/app src/presentation/app
```

- [ ] **Step 3: Update next.config.ts for custom app directory**

Read `node_modules/next/dist/docs/` first for Next.js 16 specifics, then configure:

```ts
// apps/admin-v2/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Adjust if Next.js 16 supports custom app directory — otherwise use symlink
};

export default nextConfig;
```

Note: If Next.js 16 doesn't support moving app dir, create a symlink: `ln -s src/presentation/app src/app` or keep `src/app` as thin route files that re-export from presentation.

- [ ] **Step 4: Install dependencies**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2
npm install axios @tanstack/react-query @tanstack/react-query-devtools react-hook-form @hookform/resolvers zod framer-motion recharts nuqs date-fns lucide-react sonner cmdk clsx tailwind-merge class-variance-authority
npm install -D @types/node
```

- [ ] **Step 5: Create folder structure**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2/src
mkdir -p domain/entities domain/repositories domain/value-objects
mkdir -p application/use-cases application/dto
mkdir -p infrastructure/api/repositories infrastructure/api/mappers infrastructure/storage infrastructure/providers
mkdir -p presentation/components/ui presentation/components/layout presentation/components/features
mkdir -p presentation/hooks presentation/styles
mkdir -p shared/constants shared/utils shared/types
```

- [ ] **Step 6: Create .env.local**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

- [ ] **Step 7: Verify dev server runs**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2
npm run dev
```

Expected: Dev server starts on localhost:3000

- [ ] **Step 8: Commit**

```bash
git add apps/admin-v2/
git commit -m "feat(admin-v2): scaffold Next.js 16 project with clean architecture folders"
```

---

## Task 2: Design Tokens & Global Styles

**Files:**
- Create: `apps/admin-v2/src/presentation/styles/globals.css`
- Create: `apps/admin-v2/src/shared/constants/colors.ts`
- Create: `apps/admin-v2/src/shared/constants/status.ts`

- [ ] **Step 1: Write CSS custom properties**

```css
/* apps/admin-v2/src/presentation/styles/globals.css */
@import 'tailwindcss';

:root {
  /* Primary */
  --color-primary: #4F46E5;
  --color-primary-hover: #4338CA;
  --color-primary-muted: #EEF2FF;
  --color-primary-foreground: #FFFFFF;

  /* Backgrounds */
  --color-background: #F8FAFC;
  --color-card: #FFFFFF;
  --color-card-border: #E2E8F0;

  /* Text */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #94A3B8;

  /* Semantic */
  --color-success: #10B981;
  --color-success-muted: #D1FAE5;
  --color-error: #F43F5E;
  --color-error-muted: #FFE4E6;
  --color-warning: #F59E0B;
  --color-warning-muted: #FEF3C7;
  --color-info: #0EA5E9;
  --color-info-muted: #E0F2FE;

  /* Reservation Status */
  --color-status-pending: #F59E0B;
  --color-status-pending-bg: #FEF3C7;
  --color-status-confirmed: #0EA5E9;
  --color-status-confirmed-bg: #E0F2FE;
  --color-status-in-progress: #4F46E5;
  --color-status-in-progress-bg: #EEF2FF;
  --color-status-completed: #10B981;
  --color-status-completed-bg: #D1FAE5;
  --color-status-cancelled: #F43F5E;
  --color-status-cancelled-bg: #FFE4E6;
  --color-status-no-show: #64748B;
  --color-status-no-show-bg: #F1F5F9;

  /* Spacing */
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-button-lg: 20px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-card-hover: 0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06);
}

body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
  font-family: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 2: Write status constants**

```ts
// apps/admin-v2/src/shared/constants/status.ts
import type { ReservationStatus } from '@/domain/entities/reservation';

export const RESERVATION_STATUS_CONFIG: Record<ReservationStatus, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  pending: { label: 'Pendiente', color: 'var(--color-status-pending)', bgColor: 'var(--color-status-pending-bg)', dotColor: 'bg-amber-500' },
  confirmed: { label: 'Confirmada', color: 'var(--color-status-confirmed)', bgColor: 'var(--color-status-confirmed-bg)', dotColor: 'bg-sky-500' },
  in_progress: { label: 'En Progreso', color: 'var(--color-status-in-progress)', bgColor: 'var(--color-status-in-progress-bg)', dotColor: 'bg-indigo-500' },
  completed: { label: 'Completada', color: 'var(--color-status-completed)', bgColor: 'var(--color-status-completed-bg)', dotColor: 'bg-emerald-500' },
  cancelled: { label: 'Cancelada', color: 'var(--color-status-cancelled)', bgColor: 'var(--color-status-cancelled-bg)', dotColor: 'bg-rose-500' },
  no_show: { label: 'No Show', color: 'var(--color-status-no-show)', bgColor: 'var(--color-status-no-show-bg)', dotColor: 'bg-slate-500' },
};

export const PAYMENT_METHOD_CONFIG = {
  cash: { label: 'Efectivo', icon: '💵' },
  card: { label: 'Tarjeta', icon: '💳' },
  transfer: { label: 'Transferencia', icon: '🔄' },
  other: { label: 'Otro', icon: '📋' },
} as const;
```

- [ ] **Step 3: Write color constants**

```ts
// apps/admin-v2/src/shared/constants/colors.ts
export const TENANT_PALETTES = [
  { name: 'Indigo', primary: '#4F46E5', primaryHover: '#4338CA', primaryMuted: '#EEF2FF', accent: '#818CF8' },
  { name: 'Emerald', primary: '#059669', primaryHover: '#047857', primaryMuted: '#D1FAE5', accent: '#34D399' },
  { name: 'Rose', primary: '#E11D48', primaryHover: '#BE123C', primaryMuted: '#FFE4E6', accent: '#FB7185' },
  { name: 'Violet', primary: '#7C3AED', primaryHover: '#6D28D9', primaryMuted: '#EDE9FE', accent: '#A78BFA' },
  { name: 'Orange', primary: '#EA580C', primaryHover: '#C2410C', primaryMuted: '#FFF7ED', accent: '#FB923C' },
  { name: 'Teal', primary: '#0D9488', primaryHover: '#0F766E', primaryMuted: '#CCFBF1', accent: '#2DD4BF' },
  { name: 'Pink', primary: '#DB2777', primaryHover: '#BE185D', primaryMuted: '#FCE7F3', accent: '#F472B6' },
  { name: 'Sky', primary: '#0284C7', primaryHover: '#0369A1', primaryMuted: '#E0F2FE', accent: '#38BDF8' },
  { name: 'Amber', primary: '#D97706', primaryHover: '#B45309', primaryMuted: '#FEF3C7', accent: '#FBBF24' },
  { name: 'Cyan', primary: '#0891B2', primaryHover: '#0E7490', primaryMuted: '#CFFAFE', accent: '#22D3EE' },
  { name: 'Lime', primary: '#65A30D', primaryHover: '#4D7C0F', primaryMuted: '#ECFCCB', accent: '#A3E635' },
  { name: 'Slate', primary: '#475569', primaryHover: '#334155', primaryMuted: '#F1F5F9', accent: '#94A3B8' },
] as const;
```

- [ ] **Step 4: Configure Inter font in layout**

```tsx
// apps/admin-v2/src/presentation/app/layout.tsx
import { Inter } from 'next/font/google';
import '@/presentation/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin-v2): add design tokens, global styles, status/color constants"
```

---

## Task 3: shadcn/ui Setup

**Files:**
- Create: `apps/admin-v2/components.json`
- Create: `apps/admin-v2/src/presentation/components/ui/*.tsx` (multiple)
- Create: `apps/admin-v2/src/shared/utils/cn.ts`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2
npx shadcn@latest init
```

Select: TypeScript, default style, CSS variables, custom components path `src/presentation/components/ui`.

- [ ] **Step 2: Create cn utility**

```ts
// apps/admin-v2/src/shared/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Add all needed components**

```bash
cd /Users/korbold/Documents/Freelancer/Turnly/apps/admin-v2
npx shadcn@latest add button card dialog input textarea label select table tabs popover sheet badge avatar separator dropdown-menu command skeleton tooltip sonner calendar
```

- [ ] **Step 4: Customize button variants for design system**

Edit `src/presentation/components/ui/button.tsx` to add custom variants matching our design tokens: radius-20px for large, scale animations, primary color.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin-v2): setup shadcn/ui with all components"
```

---

## Task 4: Domain Layer — Entities

**Files:**
- Create: `apps/admin-v2/src/domain/entities/reservation.ts`
- Create: `apps/admin-v2/src/domain/entities/service.ts`
- Create: `apps/admin-v2/src/domain/entities/service-log.ts`
- Create: `apps/admin-v2/src/domain/entities/client-resource.ts`
- Create: `apps/admin-v2/src/domain/entities/user.ts`
- Create: `apps/admin-v2/src/domain/entities/tenant.ts`
- Create: `apps/admin-v2/src/domain/entities/availability.ts`
- Create: `apps/admin-v2/src/domain/entities/index.ts`

- [ ] **Step 1: Create reservation entity**

```ts
// apps/admin-v2/src/domain/entities/reservation.ts
export type ReservationStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type ReservationAction = 'confirm' | 'start' | 'complete' | 'cancel';

export interface ReservationClientResource {
  label: string | null;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
}

export interface ReservationService {
  name: string;
  price: string;
}

export interface ReservationClient {
  name: string;
  email: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientResourceId: string;
  serviceId: string;
  assignedTo: string | null;
  scheduledAt: Date;
  estimatedEnd: Date;
  status: ReservationStatus;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: string;
  createdAt: Date;
  clientResource?: ReservationClientResource;
  service?: ReservationService;
  client?: ReservationClient;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  available: number;
}

export interface ReservationFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus;
  serviceId?: string;
  page?: number;
}
```

- [ ] **Step 2: Create service entity**

```ts
// apps/admin-v2/src/domain/entities/service.ts
export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}
```

- [ ] **Step 3: Create service-log entity**

```ts
// apps/admin-v2/src/domain/entities/service-log.ts
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type ServiceLogStatus = 'in_progress' | 'completed';

export interface ServiceLogClientResource {
  plate: string;
  brand: string | null;
}

export interface ServiceLogService {
  name: string;
}

export interface ServiceLogAttendant {
  name: string;
}

export interface ServiceLog {
  id: string;
  clientResourceId: string;
  serviceId: string;
  reservationId: string | null;
  attendedBy: string;
  createdBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  priceCharged: number;
  paymentMethod: PaymentMethod;
  status: ServiceLogStatus;
  notes: string | null;
  logDate: string;
  createdAt: Date;
  clientResource?: ServiceLogClientResource;
  service?: ServiceLogService;
  attendant?: ServiceLogAttendant;
}

export interface DailySummary {
  totalWashes: number;
  totalRevenue: number;
  byPaymentMethod: Record<string, { count: number; total: number }>;
  byStatus: Record<string, number>;
}

export interface ServiceLogFilters {
  date?: string;
  page?: number;
}
```

- [ ] **Step 4: Create client-resource entity**

```ts
// apps/admin-v2/src/domain/entities/client-resource.ts
export interface ClientResourceClient {
  name: string;
  email: string;
}

export interface ClientResource {
  id: string;
  tenantId: string;
  clientId: string;
  data: Record<string, unknown> | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: string | null;
  createdAt: Date;
  client?: ClientResourceClient;
}
```

- [ ] **Step 5: Create user entity**

```ts
// apps/admin-v2/src/domain/entities/user.ts
export type UserRole = 'tenant_admin' | 'cashier' | 'washer' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  createdAt: Date;
  role?: UserRole;
}
```

- [ ] **Step 6: Create tenant entity**

```ts
// apps/admin-v2/src/domain/entities/tenant.ts
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
}

export interface TenantImage {
  id: string;
  url: string;
  sortOrder: number;
}
```

- [ ] **Step 7: Create availability entity**

```ts
// apps/admin-v2/src/domain/entities/availability.ts
export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxConcurrent: number;
  isActive: boolean;
}

export interface AvailabilityBlock {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: Date;
}
```

- [ ] **Step 8: Create barrel export**

```ts
// apps/admin-v2/src/domain/entities/index.ts
export * from './reservation';
export * from './service';
export * from './service-log';
export * from './client-resource';
export * from './user';
export * from './tenant';
export * from './availability';
```

- [ ] **Step 9: Commit**

```bash
git add apps/admin-v2/src/domain/entities/
git commit -m "feat(admin-v2): add domain entities with clean types"
```

---

## Task 5: Domain Layer — Value Objects

**Files:**
- Create: `apps/admin-v2/src/domain/value-objects/money.ts`
- Create: `apps/admin-v2/src/domain/value-objects/time-slot.ts`
- Create: `apps/admin-v2/src/domain/value-objects/date-range.ts`

- [ ] **Step 1: Create value objects**

```ts
// apps/admin-v2/src/domain/value-objects/money.ts
export class Money {
  constructor(readonly amount: number, readonly currency: string = 'COP') {}

  format(): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: this.currency, minimumFractionDigits: 0 }).format(this.amount);
  }

  formatShort(): string {
    if (this.amount >= 1_000_000) return `$${(this.amount / 1_000_000).toFixed(1)}M`;
    if (this.amount >= 1_000) return `$${(this.amount / 1_000).toFixed(0)}k`;
    return `$${this.amount}`;
  }
}
```

```ts
// apps/admin-v2/src/domain/value-objects/time-slot.ts
export class TimeSlot {
  constructor(readonly start: Date, readonly end: Date) {}

  get durationMinutes(): number {
    return Math.round((this.end.getTime() - this.start.getTime()) / 60000);
  }

  formatRange(): string {
    const fmt = (d: Date) => d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(this.start)} - ${fmt(this.end)}`;
  }
}
```

```ts
// apps/admin-v2/src/domain/value-objects/date-range.ts
export class DateRange {
  constructor(readonly from: Date, readonly to: Date) {}

  toQueryParams(): { date_from: string; date_to: string } {
    return {
      date_from: this.from.toISOString().split('T')[0],
      date_to: this.to.toISOString().split('T')[0],
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin-v2/src/domain/value-objects/
git commit -m "feat(admin-v2): add domain value objects"
```

---

## Task 6: Domain Layer — Repository Interfaces

**Files:**
- Create: `apps/admin-v2/src/domain/repositories/auth.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/reservation.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/service.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/service-log.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/client-resource.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/user.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/tenant.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/report.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/availability.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/upload.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/super-admin.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/public.repository.ts`
- Create: `apps/admin-v2/src/domain/repositories/onboarding.repository.ts`

- [ ] **Step 1: Create shared types**

```ts
// apps/admin-v2/src/shared/types/api.ts
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}
```

- [ ] **Step 2: Create auth repository interface**

```ts
// apps/admin-v2/src/domain/repositories/auth.repository.ts
import type { User } from '../entities/user';
import type { Tenant } from '../entities/tenant';

export interface LoginResult {
  user: User;
  token: string;
  tenant: Tenant | null;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<LoginResult>;
  register(data: { name: string; email: string; password: string }): Promise<LoginResult>;
  logout(): Promise<void>;
  me(): Promise<{ user: User; tenant: Tenant | null }>;
}
```

- [ ] **Step 3: Create onboarding repository interface**

```ts
// apps/admin-v2/src/domain/repositories/onboarding.repository.ts
import type { Tenant } from '../entities/tenant';
import type { BusinessType } from '../entities/tenant';

export interface RegisterTenantData {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface OnboardingRepository {
  register(data: RegisterTenantData): Promise<{ token: string; tenant: Tenant }>;
  verify(code: string): Promise<void>;
  checkSlug(slug: string): Promise<{ available: boolean }>;
  setBusinessType(type: BusinessType, createServices: boolean): Promise<void>;
}
```

- [ ] **Step 4: Create reservation repository interface**

```ts
// apps/admin-v2/src/domain/repositories/reservation.repository.ts
import type { Reservation, ReservationFilters, ReservationAction, AvailableSlot } from '../entities/reservation';
import type { PaginatedResult } from '@/shared/types/api';

export interface CreateReservationData {
  clientResourceId: string;
  serviceId: string;
  scheduledAt: string;
  assignedTo?: string;
  notes?: string;
}

export interface ReservationRepository {
  getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>>;
  getById(id: string): Promise<Reservation>;
  create(data: CreateReservationData): Promise<Reservation>;
  cancel(id: string, reason: string): Promise<Reservation>;
  transition(id: string, action: ReservationAction): Promise<Reservation>;
  getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]>;
}
```

- [ ] **Step 5: Create service repository interface**

```ts
// apps/admin-v2/src/domain/repositories/service.repository.ts
import type { Service } from '../entities/service';
import type { PaginatedResult } from '@/shared/types/api';

export interface CreateServiceData {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ServiceRepository {
  getAll(page?: number): Promise<PaginatedResult<Service>>;
  create(data: CreateServiceData): Promise<Service>;
  update(id: string, data: Partial<CreateServiceData>): Promise<Service>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 6: Create service-log repository interface**

```ts
// apps/admin-v2/src/domain/repositories/service-log.repository.ts
import type { ServiceLog, ServiceLogFilters, DailySummary, PaymentMethod } from '../entities/service-log';
import type { PaginatedResult } from '@/shared/types/api';

export interface CreateServiceLogData {
  clientResourceId: string;
  serviceId: string;
  attendedBy: string;
  priceCharged: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface UpdateServiceLogData {
  serviceId?: string;
  attendedBy?: string;
  priceCharged?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface ServiceLogRepository {
  getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>>;
  getById(id: string): Promise<ServiceLog>;
  create(data: CreateServiceLogData): Promise<ServiceLog>;
  update(id: string, data: UpdateServiceLogData): Promise<ServiceLog>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<ServiceLog>;
  getSummary(date: string): Promise<DailySummary>;
}
```

- [ ] **Step 7: Create client-resource repository interface**

```ts
// apps/admin-v2/src/domain/repositories/client-resource.repository.ts
import type { ClientResource } from '../entities/client-resource';
import type { PaginatedResult } from '@/shared/types/api';

export interface CreateClientResourceData {
  clientId?: string;
  data?: Record<string, unknown>;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
}

export interface ClientResourceRepository {
  getAll(page?: number, search?: string): Promise<PaginatedResult<ClientResource>>;
  getById(id: string): Promise<ClientResource>;
  create(data: CreateClientResourceData): Promise<ClientResource>;
  update(id: string, data: Partial<CreateClientResourceData>): Promise<ClientResource>;
  getHistory(id: string): Promise<unknown[]>;
}
```

- [ ] **Step 8: Create user repository interface**

```ts
// apps/admin-v2/src/domain/repositories/user.repository.ts
import type { User, UserRole } from '../entities/user';
import type { PaginatedResult } from '@/shared/types/api';

export interface UserRepository {
  getAll(filters?: { role?: UserRole; excludeRole?: UserRole }): Promise<PaginatedResult<User>>;
  getById(id: string): Promise<User>;
  invite(email: string, role: UserRole): Promise<User>;
  changeRole(id: string, role: UserRole): Promise<User>;
}
```

- [ ] **Step 9: Create tenant repository interface**

```ts
// apps/admin-v2/src/domain/repositories/tenant.repository.ts
import type { TenantSettings, TenantImage } from '../entities/tenant';

export interface TenantRepository {
  getSettings(): Promise<TenantSettings>;
  updateSettings(data: Partial<TenantSettings>): Promise<TenantSettings>;
  getImages(): Promise<TenantImage[]>;
  addImage(file: File): Promise<TenantImage>;
  deleteImage(id: string): Promise<void>;
  reorderImages(ids: string[]): Promise<void>;
}
```

- [ ] **Step 10: Create report repository interface**

```ts
// apps/admin-v2/src/domain/repositories/report.repository.ts
export interface ReportStats {
  totalServices: number;
  totalRevenue: number;
  totalReservations: number;
  averageDailyRevenue: number;
}

export interface DailyBreakdown {
  date: string;
  services: number;
  revenue: number;
  byCash: number;
  byCard: number;
  byTransfer: number;
  reservations: number;
}

export interface RangeReport {
  stats: ReportStats;
  dailyBreakdown: DailyBreakdown[];
  byPaymentMethod: Record<string, { count: number; total: number }>;
}

export interface ReportRepository {
  getDaily(date: string): Promise<RangeReport>;
  getRange(from: string, to: string): Promise<RangeReport>;
  getWeekly(week: string): Promise<RangeReport>;
  getMonthly(month: string): Promise<RangeReport>;
}
```

- [ ] **Step 11: Create availability repository interface**

```ts
// apps/admin-v2/src/domain/repositories/availability.repository.ts
import type { AvailabilitySlot, AvailabilityBlock } from '../entities/availability';

export interface CreateBlockData {
  date: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface AvailabilityRepository {
  getSlots(): Promise<AvailabilitySlot[]>;
  updateSlots(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]>;
  getBlocks(): Promise<AvailabilityBlock[]>;
  createBlock(data: CreateBlockData): Promise<AvailabilityBlock>;
  deleteBlock(id: string): Promise<void>;
}
```

- [ ] **Step 12: Create upload repository interface**

```ts
// apps/admin-v2/src/domain/repositories/upload.repository.ts
export interface UploadResult {
  url: string;
}

export interface UploadRepository {
  upload(file: File, folder: string): Promise<UploadResult>;
}
```

- [ ] **Step 13: Create super-admin repository interface**

```ts
// apps/admin-v2/src/domain/repositories/super-admin.repository.ts
import type { Tenant } from '../entities/tenant';
import type { User } from '../entities/user';
import type { PaginatedResult } from '@/shared/types/api';

export interface SuperAdminStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalReservations: number;
  totalServices: number;
}

export interface SuperAdminRepository {
  getStats(): Promise<SuperAdminStats>;
  getTenants(page?: number): Promise<PaginatedResult<Tenant>>;
  suspendTenant(id: string): Promise<Tenant>;
  activateTenant(id: string): Promise<Tenant>;
  getUsers(page?: number): Promise<PaginatedResult<User>>;
}
```

- [ ] **Step 14: Create public repository interface**

```ts
// apps/admin-v2/src/domain/repositories/public.repository.ts
import type { AvailableSlot } from '../entities/reservation';

export interface PublicTenant {
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  themeColor: string | null;
  socialLinks: { instagram: string | null; facebook: string | null; whatsapp: string | null };
  address: string | null;
  phone: string | null;
  services: Array<{ id: string; name: string; price: string; imageUrl: string | null; description: string | null }>;
  customFields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>;
}

export interface BookingData {
  serviceId: string;
  scheduledAt: string;
  name: string;
  phone: string;
  resourceData: Record<string, unknown>;
}

export interface PublicRepository {
  getTenantBySlug(slug: string): Promise<PublicTenant>;
  getAvailableSlots(slug: string, serviceId: string, date: string): Promise<AvailableSlot[]>;
  book(slug: string, data: BookingData): Promise<{ reservationId: string }>;
}
```

- [ ] **Step 15: Create barrel export**

```ts
// apps/admin-v2/src/domain/repositories/index.ts
export type { AuthRepository, LoginResult } from './auth.repository';
export type { OnboardingRepository, RegisterTenantData } from './onboarding.repository';
export type { ReservationRepository, CreateReservationData } from './reservation.repository';
export type { ServiceRepository, CreateServiceData } from './service.repository';
export type { ServiceLogRepository, CreateServiceLogData, UpdateServiceLogData } from './service-log.repository';
export type { ClientResourceRepository, CreateClientResourceData } from './client-resource.repository';
export type { UserRepository } from './user.repository';
export type { TenantRepository } from './tenant.repository';
export type { ReportRepository, RangeReport, ReportStats, DailyBreakdown } from './report.repository';
export type { AvailabilityRepository, CreateBlockData } from './availability.repository';
export type { UploadRepository, UploadResult } from './upload.repository';
export type { SuperAdminRepository, SuperAdminStats } from './super-admin.repository';
export type { PublicRepository, PublicTenant, BookingData } from './public.repository';
```

- [ ] **Step 16: Commit**

```bash
git add apps/admin-v2/src/domain/repositories/ apps/admin-v2/src/shared/types/
git commit -m "feat(admin-v2): add domain repository interfaces and shared types"
```

---

## Task 7: Infrastructure — API Client & Storage

**Files:**
- Create: `apps/admin-v2/src/infrastructure/api/client.ts`
- Create: `apps/admin-v2/src/infrastructure/storage/auth-storage.ts`

- [ ] **Step 1: Create API client**

```ts
// apps/admin-v2/src/infrastructure/api/client.ts
import axios from 'axios';
import { authStorage } from '../storage/auth-storage';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const slug = authStorage.getTenantSlug();
  if (slug) config.headers['X-Tenant'] = slug;
  return config;
});

let redirecting = false;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && typeof window !== 'undefined' && !redirecting) {
      redirecting = true;
      authStorage.clear();
      window.location.href = '/login';
    }
    const data = error.response?.data;
    const message = data?.error?.message ?? data?.message ?? error.message ?? 'Error inesperado';
    const fieldErrors = data?.errors ?? null;
    return Promise.reject({ message, fieldErrors, status: error.response?.status });
  },
);

export default api;
```

- [ ] **Step 2: Create auth storage**

```ts
// apps/admin-v2/src/infrastructure/storage/auth-storage.ts
const KEYS = {
  TOKEN: 'auth_token',
  TENANT_SLUG: 'tenant_slug',
  IS_SUPER_ADMIN: 'is_super_admin',
  SUPER_ADMIN_MODE: 'super_admin_mode',
} as const;

export const authStorage = {
  getToken: () => localStorage.getItem(KEYS.TOKEN),
  setToken: (token: string) => localStorage.setItem(KEYS.TOKEN, token),

  getTenantSlug: () => localStorage.getItem(KEYS.TENANT_SLUG),
  setTenantSlug: (slug: string) => localStorage.setItem(KEYS.TENANT_SLUG, slug),

  getIsSuperAdmin: () => localStorage.getItem(KEYS.IS_SUPER_ADMIN) === 'true',
  setIsSuperAdmin: (val: boolean) => localStorage.setItem(KEYS.IS_SUPER_ADMIN, String(val)),

  getSuperAdminMode: () => localStorage.getItem(KEYS.SUPER_ADMIN_MODE) === 'true',
  setSuperAdminMode: (val: boolean) => localStorage.setItem(KEYS.SUPER_ADMIN_MODE, String(val)),

  clear: () => {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.TENANT_SLUG);
    localStorage.removeItem(KEYS.IS_SUPER_ADMIN);
    localStorage.removeItem(KEYS.SUPER_ADMIN_MODE);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/infrastructure/
git commit -m "feat(admin-v2): add API client with interceptors and auth storage"
```

---

## Task 8: Infrastructure — API Repositories & Mappers

**Files:**
- Create: `apps/admin-v2/src/infrastructure/api/mappers/reservation.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/service.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/client-resource.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/user.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/mappers/tenant.mapper.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-auth.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-onboarding.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-reservation.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-service.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-client-resource.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-user.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-tenant.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-report.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-availability.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-upload.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-super-admin.repository.ts`
- Create: `apps/admin-v2/src/infrastructure/api/repositories/api-public.repository.ts`

- [ ] **Step 1: Create mappers**

```ts
// apps/admin-v2/src/infrastructure/api/mappers/reservation.mapper.ts
import type { Reservation, AvailableSlot } from '@/domain/entities/reservation';

export function mapReservation(raw: Record<string, unknown>): Reservation {
  return {
    id: raw.id as string,
    clientId: raw.client_id as string,
    clientResourceId: raw.client_resource_id as string,
    serviceId: raw.service_id as string,
    assignedTo: raw.assigned_to as string | null,
    scheduledAt: new Date(raw.scheduled_at as string),
    estimatedEnd: new Date(raw.estimated_end as string),
    status: raw.status as Reservation['status'],
    notes: raw.notes as string | null,
    cancelledAt: raw.cancelled_at ? new Date(raw.cancelled_at as string) : null,
    cancelReason: raw.cancel_reason as string | null,
    createdBy: raw.created_by as string,
    createdAt: new Date(raw.created_at as string),
    clientResource: raw.client_resource as Reservation['clientResource'],
    service: raw.service as Reservation['service'],
    client: raw.client as Reservation['client'],
  };
}

export function mapAvailableSlot(raw: Record<string, unknown>): AvailableSlot {
  return {
    start: new Date(raw.start as string),
    end: new Date(raw.end as string),
    available: raw.available as number,
  };
}
```

```ts
// apps/admin-v2/src/infrastructure/api/mappers/service.mapper.ts
import type { Service } from '@/domain/entities/service';

export function mapService(raw: Record<string, unknown>): Service {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string | null,
    price: Number(raw.price),
    isActive: raw.is_active as boolean,
    imageUrl: raw.image_url as string | null,
    sortOrder: raw.sort_order as number,
    createdAt: new Date(raw.created_at as string),
  };
}
```

```ts
// apps/admin-v2/src/infrastructure/api/mappers/service-log.mapper.ts
import type { ServiceLog, DailySummary } from '@/domain/entities/service-log';

export function mapServiceLog(raw: Record<string, unknown>): ServiceLog {
  return {
    id: raw.id as string,
    clientResourceId: raw.client_resource_id as string,
    serviceId: raw.service_id as string,
    reservationId: raw.reservation_id as string | null,
    attendedBy: raw.attended_by as string,
    createdBy: raw.created_by as string,
    startedAt: new Date(raw.started_at as string),
    finishedAt: raw.finished_at ? new Date(raw.finished_at as string) : null,
    priceCharged: Number(raw.price_charged),
    paymentMethod: raw.payment_method as ServiceLog['paymentMethod'],
    status: raw.status as ServiceLog['status'],
    notes: raw.notes as string | null,
    logDate: raw.log_date as string,
    createdAt: new Date(raw.created_at as string),
    clientResource: raw.client_resource as ServiceLog['clientResource'],
    service: raw.service as ServiceLog['service'],
    attendant: raw.attendant as ServiceLog['attendant'],
  };
}

export function mapDailySummary(raw: Record<string, unknown>): DailySummary {
  return {
    totalWashes: raw.total_washes as number,
    totalRevenue: raw.total_revenue as number,
    byPaymentMethod: raw.by_payment_method as DailySummary['byPaymentMethod'],
    byStatus: raw.by_status as DailySummary['byStatus'],
  };
}
```

```ts
// apps/admin-v2/src/infrastructure/api/mappers/user.mapper.ts
import type { User } from '@/domain/entities/user';

export function mapUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as string,
    name: raw.name as string,
    email: raw.email as string,
    phone: raw.phone as string | null,
    isSuperAdmin: raw.is_super_admin as boolean,
    createdAt: new Date(raw.created_at as string),
    role: raw.role as User['role'],
  };
}
```

```ts
// apps/admin-v2/src/infrastructure/api/mappers/tenant.mapper.ts
import type { Tenant } from '@/domain/entities/tenant';

export function mapTenant(raw: Record<string, unknown>): Tenant {
  return {
    id: raw.id as string,
    slug: raw.slug as string,
    name: raw.name as string,
    ownerName: raw.owner_name as string,
    email: raw.email as string,
    phone: raw.phone as string | null,
    city: raw.city as string | null,
    country: raw.country as string,
    plan: raw.plan as Tenant['plan'],
    status: raw.status as Tenant['status'],
    trialEndsAt: raw.trial_ends_at ? new Date(raw.trial_ends_at as string) : null,
    onboardingStep: raw.onboarding_step as number,
    activatedAt: raw.activated_at ? new Date(raw.activated_at as string) : null,
    createdAt: new Date(raw.created_at as string),
  };
}
```

```ts
// apps/admin-v2/src/infrastructure/api/mappers/client-resource.mapper.ts
import type { ClientResource } from '@/domain/entities/client-resource';

export function mapClientResource(raw: Record<string, unknown>): ClientResource {
  return {
    id: raw.id as string,
    tenantId: raw.tenant_id as string,
    clientId: raw.client_id as string,
    data: raw.data as Record<string, unknown> | null,
    plate: raw.plate as string | null,
    brand: raw.brand as string | null,
    model: raw.model as string | null,
    color: raw.color as string | null,
    type: raw.type as string | null,
    createdAt: new Date(raw.created_at as string),
    client: raw.client as ClientResource['client'],
  };
}
```

- [ ] **Step 2: Create API auth repository**

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-auth.repository.ts
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import { mapTenant } from '../mappers/tenant.mapper';
import type { AuthRepository, LoginResult } from '@/domain/repositories/auth.repository';

export class ApiAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data } = await api.post('/auth/login', { email, password });
    return {
      user: mapUser(data.data.user),
      token: data.data.token,
      tenant: data.data.tenant ? mapTenant(data.data.tenant) : null,
    };
  }

  async register(input: { name: string; email: string; password: string }): Promise<LoginResult> {
    const { data } = await api.post('/auth/register', input);
    return {
      user: mapUser(data.data.user),
      token: data.data.token,
      tenant: data.data.tenant ? mapTenant(data.data.tenant) : null,
    };
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  }

  async me() {
    const { data } = await api.get('/auth/me');
    return {
      user: mapUser(data.data.user),
      tenant: data.data.tenant ? mapTenant(data.data.tenant) : null,
    };
  }
}
```

- [ ] **Step 3: Create API reservation repository**

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-reservation.repository.ts
import api from '../client';
import { mapReservation, mapAvailableSlot } from '../mappers/reservation.mapper';
import type { ReservationRepository, CreateReservationData } from '@/domain/repositories/reservation.repository';
import type { ReservationFilters, ReservationAction } from '@/domain/entities/reservation';
import type { PaginatedResult } from '@/shared/types/api';
import type { Reservation, AvailableSlot } from '@/domain/entities/reservation';

function mapPaginated(data: Record<string, unknown>): PaginatedResult<Reservation> {
  return {
    data: (data.data as Record<string, unknown>[]).map(mapReservation),
    meta: {
      currentPage: (data.meta as Record<string, unknown>).current_page as number,
      lastPage: (data.meta as Record<string, unknown>).last_page as number,
      perPage: (data.meta as Record<string, unknown>).per_page as number,
      total: (data.meta as Record<string, unknown>).total as number,
    },
  };
}

export class ApiReservationRepository implements ReservationRepository {
  async getAll(filters: ReservationFilters): Promise<PaginatedResult<Reservation>> {
    const params: Record<string, string> = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.status) params.status = filters.status;
    if (filters.serviceId) params.service_id = filters.serviceId;
    if (filters.page) params.page = String(filters.page);
    const { data } = await api.get('/reservations', { params });
    return mapPaginated(data);
  }

  async getById(id: string) {
    const { data } = await api.get(`/reservations/${id}`);
    return mapReservation(data.data);
  }

  async create(input: CreateReservationData) {
    const { data } = await api.post('/reservations', {
      client_resource_id: input.clientResourceId,
      service_id: input.serviceId,
      scheduled_at: input.scheduledAt,
      assigned_to: input.assignedTo,
      notes: input.notes,
    });
    return mapReservation(data.data);
  }

  async cancel(id: string, reason: string) {
    const { data } = await api.patch(`/reservations/${id}/cancel`, { cancel_reason: reason });
    return mapReservation(data.data);
  }

  async transition(id: string, action: ReservationAction) {
    const { data } = await api.patch(`/reservations/${id}/${action}`);
    return mapReservation(data.data);
  }

  async getAvailableSlots(date: string, serviceId: string): Promise<AvailableSlot[]> {
    const { data } = await api.get('/reservations/available-slots', { params: { date, service_id: serviceId } });
    return (data.data as Record<string, unknown>[]).map(mapAvailableSlot);
  }
}
```

- [ ] **Step 4: Create remaining API repositories**

Create each following the same pattern (api call → mapper → return domain type):

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-service.repository.ts
import api from '../client';
import { mapService } from '../mappers/service.mapper';
import type { ServiceRepository, CreateServiceData } from '@/domain/repositories/service.repository';
import type { PaginatedResult } from '@/shared/types/api';
import type { Service } from '@/domain/entities/service';

export class ApiServiceRepository implements ServiceRepository {
  async getAll(page?: number): Promise<PaginatedResult<Service>> {
    const { data } = await api.get('/services', { params: page ? { page } : {} });
    return {
      data: (data.data as Record<string, unknown>[]).map(mapService),
      meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 },
    };
  }
  async create(input: CreateServiceData) { const { data } = await api.post('/services', input); return mapService(data.data); }
  async update(id: string, input: Partial<CreateServiceData>) { const { data } = await api.put(`/services/${id}`, input); return mapService(data.data); }
  async delete(id: string) { await api.delete(`/services/${id}`); }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-service-log.repository.ts
import api from '../client';
import { mapServiceLog, mapDailySummary } from '../mappers/service-log.mapper';
import type { ServiceLogRepository, CreateServiceLogData, UpdateServiceLogData } from '@/domain/repositories/service-log.repository';
import type { ServiceLogFilters } from '@/domain/entities/service-log';
import type { PaginatedResult } from '@/shared/types/api';
import type { ServiceLog, DailySummary } from '@/domain/entities/service-log';

export class ApiServiceLogRepository implements ServiceLogRepository {
  async getAll(filters: ServiceLogFilters): Promise<PaginatedResult<ServiceLog>> {
    const params: Record<string, string> = {};
    if (filters.date) params.date = filters.date;
    if (filters.page) params.page = String(filters.page);
    const { data } = await api.get('/service-logs', { params });
    return {
      data: (data.data as Record<string, unknown>[]).map(mapServiceLog),
      meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 },
    };
  }
  async getById(id: string) { const { data } = await api.get(`/service-logs/${id}`); return mapServiceLog(data.data); }
  async create(input: CreateServiceLogData) {
    const { data } = await api.post('/service-logs', {
      client_resource_id: input.clientResourceId, service_id: input.serviceId,
      attended_by: input.attendedBy, price_charged: input.priceCharged,
      payment_method: input.paymentMethod, notes: input.notes,
    });
    return mapServiceLog(data.data);
  }
  async update(id: string, input: UpdateServiceLogData) {
    const payload: Record<string, unknown> = {};
    if (input.serviceId) payload.service_id = input.serviceId;
    if (input.attendedBy) payload.attended_by = input.attendedBy;
    if (input.priceCharged) payload.price_charged = input.priceCharged;
    if (input.paymentMethod) payload.payment_method = input.paymentMethod;
    if (input.notes !== undefined) payload.notes = input.notes;
    const { data } = await api.patch(`/service-logs/${id}`, payload);
    return mapServiceLog(data.data);
  }
  async delete(id: string) { await api.delete(`/service-logs/${id}`); }
  async complete(id: string) { const { data } = await api.patch(`/service-logs/${id}/complete`); return mapServiceLog(data.data); }
  async getSummary(date: string): Promise<DailySummary> { const { data } = await api.get('/service-logs/summary', { params: { date } }); return mapDailySummary(data.data); }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-client-resource.repository.ts
import api from '../client';
import { mapClientResource } from '../mappers/client-resource.mapper';
import type { ClientResourceRepository, CreateClientResourceData } from '@/domain/repositories/client-resource.repository';
import type { PaginatedResult } from '@/shared/types/api';
import type { ClientResource } from '@/domain/entities/client-resource';

export class ApiClientResourceRepository implements ClientResourceRepository {
  async getAll(page?: number, search?: string): Promise<PaginatedResult<ClientResource>> {
    const params: Record<string, string> = {};
    if (page) params.page = String(page);
    if (search) params.search = search;
    const { data } = await api.get('/client-resources', { params });
    return {
      data: (data.data as Record<string, unknown>[]).map(mapClientResource),
      meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 },
    };
  }
  async getById(id: string) { const { data } = await api.get(`/client-resources/${id}`); return mapClientResource(data.data); }
  async create(input: CreateClientResourceData) { const { data } = await api.post('/client-resources', input); return mapClientResource(data.data); }
  async update(id: string, input: Partial<CreateClientResourceData>) { const { data } = await api.patch(`/client-resources/${id}`, input); return mapClientResource(data.data); }
  async getHistory(id: string) { const { data } = await api.get(`/client-resources/${id}/history`); return data.data; }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-user.repository.ts
import api from '../client';
import { mapUser } from '../mappers/user.mapper';
import type { UserRepository } from '@/domain/repositories/user.repository';
import type { UserRole } from '@/domain/entities/user';
import type { PaginatedResult } from '@/shared/types/api';
import type { User } from '@/domain/entities/user';

export class ApiUserRepository implements UserRepository {
  async getAll(filters?: { role?: UserRole; excludeRole?: UserRole }): Promise<PaginatedResult<User>> {
    const params: Record<string, string> = {};
    if (filters?.role) params.role = filters.role;
    if (filters?.excludeRole) params.exclude_role = filters.excludeRole;
    const { data } = await api.get('/users', { params });
    return {
      data: (data.data as Record<string, unknown>[]).map(mapUser),
      meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 },
    };
  }
  async getById(id: string) { const { data } = await api.get(`/users/${id}`); return mapUser(data.data); }
  async invite(email: string, role: UserRole) { const { data } = await api.post('/users/invite', { email, role }); return mapUser(data.data); }
  async changeRole(id: string, role: UserRole) { const { data } = await api.patch(`/users/${id}/role`, { role }); return mapUser(data.data); }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-tenant.repository.ts
import api from '../client';
import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { TenantSettings, TenantImage } from '@/domain/entities/tenant';

export class ApiTenantRepository implements TenantRepository {
  async getSettings(): Promise<TenantSettings> { const { data } = await api.get('/tenant/settings'); return data.data; }
  async updateSettings(input: Partial<TenantSettings>) { const { data } = await api.patch('/tenant/settings', input); return data.data; }
  async getImages(): Promise<TenantImage[]> { const { data } = await api.get('/tenant/images'); return data.data; }
  async addImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'gallery');
    const { data } = await api.post('/tenant/images', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data.data;
  }
  async deleteImage(id: string) { await api.delete(`/tenant/images/${id}`); }
  async reorderImages(ids: string[]) { await api.post('/tenant/images/reorder', { ids }); }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-report.repository.ts
import api from '../client';
import type { ReportRepository, RangeReport } from '@/domain/repositories/report.repository';

export class ApiReportRepository implements ReportRepository {
  async getDaily(date: string): Promise<RangeReport> { const { data } = await api.get('/reports/daily', { params: { date } }); return data.data; }
  async getRange(from: string, to: string): Promise<RangeReport> { const { data } = await api.get('/reports/range', { params: { from, to } }); return data.data; }
  async getWeekly(week: string): Promise<RangeReport> { const { data } = await api.get('/reports/weekly', { params: { week } }); return data.data; }
  async getMonthly(month: string): Promise<RangeReport> { const { data } = await api.get('/reports/monthly', { params: { month } }); return data.data; }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-availability.repository.ts
import api from '../client';
import type { AvailabilityRepository, CreateBlockData } from '@/domain/repositories/availability.repository';
import type { AvailabilitySlot, AvailabilityBlock } from '@/domain/entities/availability';

export class ApiAvailabilityRepository implements AvailabilityRepository {
  async getSlots(): Promise<AvailabilitySlot[]> { const { data } = await api.get('/availability-slots'); return data.data; }
  async updateSlots(slots: AvailabilitySlot[]) { const { data } = await api.put('/availability-slots', { slots }); return data.data; }
  async getBlocks(): Promise<AvailabilityBlock[]> { const { data } = await api.get('/availability-blocks'); return data.data; }
  async createBlock(input: CreateBlockData) { const { data } = await api.post('/availability-blocks', input); return data.data; }
  async deleteBlock(id: string) { await api.delete(`/availability-blocks/${id}`); }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-upload.repository.ts
import api from '../client';
import type { UploadRepository, UploadResult } from '@/domain/repositories/upload.repository';

export class ApiUploadRepository implements UploadRepository {
  async upload(file: File, folder: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const { data } = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return { url: data.data.url };
  }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-super-admin.repository.ts
import api from '../client';
import { mapTenant } from '../mappers/tenant.mapper';
import { mapUser } from '../mappers/user.mapper';
import type { SuperAdminRepository, SuperAdminStats } from '@/domain/repositories/super-admin.repository';
import type { PaginatedResult } from '@/shared/types/api';
import type { Tenant } from '@/domain/entities/tenant';
import type { User } from '@/domain/entities/user';

export class ApiSuperAdminRepository implements SuperAdminRepository {
  async getStats(): Promise<SuperAdminStats> { const { data } = await api.get('/superadmin/stats'); return data.data; }
  async getTenants(page?: number): Promise<PaginatedResult<Tenant>> {
    const { data } = await api.get('/superadmin/tenants', { params: page ? { page } : {} });
    return { data: (data.data as Record<string, unknown>[]).map(mapTenant), meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 } };
  }
  async suspendTenant(id: string) { const { data } = await api.patch(`/superadmin/tenants/${id}/suspend`); return mapTenant(data.data); }
  async activateTenant(id: string) { const { data } = await api.patch(`/superadmin/tenants/${id}/activate`); return mapTenant(data.data); }
  async getUsers(page?: number): Promise<PaginatedResult<User>> {
    const { data } = await api.get('/superadmin/users', { params: page ? { page } : {} });
    return { data: (data.data as Record<string, unknown>[]).map(mapUser), meta: { currentPage: data.meta?.current_page ?? 1, lastPage: data.meta?.last_page ?? 1, perPage: data.meta?.per_page ?? 50, total: data.meta?.total ?? 0 } };
  }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-public.repository.ts
import api from '../client';
import { mapAvailableSlot } from '../mappers/reservation.mapper';
import type { PublicRepository, PublicTenant, BookingData } from '@/domain/repositories/public.repository';
import type { AvailableSlot } from '@/domain/entities/reservation';

export class ApiPublicRepository implements PublicRepository {
  async getTenantBySlug(slug: string): Promise<PublicTenant> { const { data } = await api.get(`/v1/public/tenants/${slug}`); return data.data; }
  async getAvailableSlots(slug: string, serviceId: string, date: string): Promise<AvailableSlot[]> {
    const { data } = await api.get(`/v1/public/tenants/${slug}/available-slots`, { params: { service_id: serviceId, date } });
    return (data.data as Record<string, unknown>[]).map(mapAvailableSlot);
  }
  async book(slug: string, input: BookingData) {
    const { data } = await api.post(`/v1/public/tenants/${slug}/book`, {
      service_id: input.serviceId, scheduled_at: input.scheduledAt,
      name: input.name, phone: input.phone, resource_data: input.resourceData,
    });
    return { reservationId: data.data.reservation_id };
  }
}
```

```ts
// apps/admin-v2/src/infrastructure/api/repositories/api-onboarding.repository.ts
import api from '../client';
import { mapTenant } from '../mappers/tenant.mapper';
import type { OnboardingRepository, RegisterTenantData } from '@/domain/repositories/onboarding.repository';
import type { BusinessType } from '@/domain/entities/tenant';

export class ApiOnboardingRepository implements OnboardingRepository {
  async register(input: RegisterTenantData) {
    const { data } = await api.post('/onboarding/register', {
      business_name: input.businessName, owner_name: input.ownerName,
      email: input.email, password: input.password,
    });
    return { token: data.data.token, tenant: mapTenant(data.data.tenant) };
  }
  async verify(code: string) { await api.post('/onboarding/verify', { code }); }
  async checkSlug(slug: string) { const { data } = await api.get('/onboarding/check-slug', { params: { slug } }); return { available: data.data.available }; }
  async setBusinessType(type: BusinessType, createServices: boolean) { await api.post('/onboarding/business-type', { business_type: type, create_services: createServices }); }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-v2/src/infrastructure/
git commit -m "feat(admin-v2): add all API repositories and mappers"
```

---

## Task 9: Infrastructure — Repository Provider (DI)

**Files:**
- Create: `apps/admin-v2/src/infrastructure/providers/repository.provider.tsx`

- [ ] **Step 1: Create repository provider**

```tsx
// apps/admin-v2/src/infrastructure/providers/repository.provider.tsx
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ApiAuthRepository } from '../api/repositories/api-auth.repository';
import { ApiOnboardingRepository } from '../api/repositories/api-onboarding.repository';
import { ApiReservationRepository } from '../api/repositories/api-reservation.repository';
import { ApiServiceRepository } from '../api/repositories/api-service.repository';
import { ApiServiceLogRepository } from '../api/repositories/api-service-log.repository';
import { ApiClientResourceRepository } from '../api/repositories/api-client-resource.repository';
import { ApiUserRepository } from '../api/repositories/api-user.repository';
import { ApiTenantRepository } from '../api/repositories/api-tenant.repository';
import { ApiReportRepository } from '../api/repositories/api-report.repository';
import { ApiAvailabilityRepository } from '../api/repositories/api-availability.repository';
import { ApiUploadRepository } from '../api/repositories/api-upload.repository';
import { ApiSuperAdminRepository } from '../api/repositories/api-super-admin.repository';
import { ApiPublicRepository } from '../api/repositories/api-public.repository';

interface Repositories {
  auth: ApiAuthRepository;
  onboarding: ApiOnboardingRepository;
  reservation: ApiReservationRepository;
  service: ApiServiceRepository;
  serviceLog: ApiServiceLogRepository;
  clientResource: ApiClientResourceRepository;
  user: ApiUserRepository;
  tenant: ApiTenantRepository;
  report: ApiReportRepository;
  availability: ApiAvailabilityRepository;
  upload: ApiUploadRepository;
  superAdmin: ApiSuperAdminRepository;
  public: ApiPublicRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repos = useMemo<Repositories>(() => ({
    auth: new ApiAuthRepository(),
    onboarding: new ApiOnboardingRepository(),
    reservation: new ApiReservationRepository(),
    service: new ApiServiceRepository(),
    serviceLog: new ApiServiceLogRepository(),
    clientResource: new ApiClientResourceRepository(),
    user: new ApiUserRepository(),
    tenant: new ApiTenantRepository(),
    report: new ApiReportRepository(),
    availability: new ApiAvailabilityRepository(),
    upload: new ApiUploadRepository(),
    superAdmin: new ApiSuperAdminRepository(),
    public: new ApiPublicRepository(),
  }), []);

  return <RepositoryContext value={repos}>{children}</RepositoryContext>;
}

export function useRepository<K extends keyof Repositories>(name: K): Repositories[K] {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be inside RepositoryProvider');
  return ctx[name];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin-v2/src/infrastructure/providers/
git commit -m "feat(admin-v2): add repository provider for dependency injection"
```

---

## Task 10: Application Layer — Use Cases

**Files:**
- Create: `apps/admin-v2/src/application/use-cases/auth/*.ts` (4 files)
- Create: `apps/admin-v2/src/application/use-cases/reservations/*.ts` (5 files)
- Create: `apps/admin-v2/src/application/use-cases/services/*.ts` (4 files)
- Create: `apps/admin-v2/src/application/use-cases/service-logs/*.ts` (6 files)
- Create: `apps/admin-v2/src/application/use-cases/clients/*.ts` (5 files)
- Create: `apps/admin-v2/src/application/use-cases/team/*.ts` (3 files)
- Create: `apps/admin-v2/src/application/use-cases/reports/*.ts` (2 files)
- Create: `apps/admin-v2/src/application/use-cases/settings/*.ts` (6 files)

- [ ] **Step 1: Create auth use cases**

```ts
// apps/admin-v2/src/application/use-cases/auth/login.ts
import type { AuthRepository } from '@/domain/repositories/auth.repository';
export class LoginUseCase {
  constructor(private repo: AuthRepository) {}
  execute(email: string, password: string) { return this.repo.login(email, password); }
}

// apps/admin-v2/src/application/use-cases/auth/logout.ts
import type { AuthRepository } from '@/domain/repositories/auth.repository';
export class LogoutUseCase {
  constructor(private repo: AuthRepository) {}
  execute() { return this.repo.logout(); }
}

// apps/admin-v2/src/application/use-cases/auth/get-me.ts
import type { AuthRepository } from '@/domain/repositories/auth.repository';
export class GetMeUseCase {
  constructor(private repo: AuthRepository) {}
  execute() { return this.repo.me(); }
}

// apps/admin-v2/src/application/use-cases/auth/register.ts
import type { AuthRepository } from '@/domain/repositories/auth.repository';
export class RegisterUseCase {
  constructor(private repo: AuthRepository) {}
  execute(data: { name: string; email: string; password: string }) { return this.repo.register(data); }
}
```

- [ ] **Step 2: Create reservation use cases**

```ts
// apps/admin-v2/src/application/use-cases/reservations/get-reservations.ts
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { ReservationFilters } from '@/domain/entities/reservation';
export class GetReservationsUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(filters: ReservationFilters) { return this.repo.getAll(filters); }
}

// apps/admin-v2/src/application/use-cases/reservations/get-reservation.ts
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
export class GetReservationUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(id: string) { return this.repo.getById(id); }
}

// apps/admin-v2/src/application/use-cases/reservations/create-reservation.ts
import type { ReservationRepository, CreateReservationData } from '@/domain/repositories/reservation.repository';
export class CreateReservationUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(data: CreateReservationData) { return this.repo.create(data); }
}

// apps/admin-v2/src/application/use-cases/reservations/transition-reservation.ts
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { ReservationAction } from '@/domain/entities/reservation';
export class TransitionReservationUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(id: string, action: ReservationAction) { return this.repo.transition(id, action); }
}

// apps/admin-v2/src/application/use-cases/reservations/cancel-reservation.ts
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
export class CancelReservationUseCase {
  constructor(private repo: ReservationRepository) {}
  execute(id: string, reason: string) { return this.repo.cancel(id, reason); }
}
```

- [ ] **Step 3: Create remaining use cases following same pattern**

All other use cases follow identical pattern: class with constructor(repo) and execute(...args) that delegates to repository. Create for:

- **services/**: GetServicesUseCase, CreateServiceUseCase, UpdateServiceUseCase, DeleteServiceUseCase
- **service-logs/**: GetServiceLogsUseCase, CreateServiceLogUseCase, UpdateServiceLogUseCase, DeleteServiceLogUseCase, CompleteServiceLogUseCase, GetDailySummaryUseCase
- **clients/**: GetClientsUseCase, GetClientUseCase, CreateClientUseCase, UpdateClientUseCase, GetClientHistoryUseCase
- **team/**: GetTeamUseCase, InviteUserUseCase, ChangeRoleUseCase
- **reports/**: GetRangeReportUseCase, GetDailyReportUseCase
- **settings/**: GetSettingsUseCase, UpdateSettingsUseCase, GetImagesUseCase, AddImageUseCase, DeleteImageUseCase, ReorderImagesUseCase

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/application/
git commit -m "feat(admin-v2): add application layer use cases"
```

---

## Task 11: Presentation — React Hooks

**Files:**
- Create: `apps/admin-v2/src/presentation/hooks/use-auth.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-reservations.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-services.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-service-logs.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-clients.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-team.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-reports.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-settings.ts`
- Create: `apps/admin-v2/src/presentation/hooks/use-availability.ts`

- [ ] **Step 1: Create auth hooks**

```ts
// apps/admin-v2/src/presentation/hooks/use-auth.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { LoginUseCase } from '@/application/use-cases/auth/login';
import { LogoutUseCase } from '@/application/use-cases/auth/logout';
import { GetMeUseCase } from '@/application/use-cases/auth/get-me';
import { authStorage } from '@/infrastructure/storage/auth-storage';

export function useMe() {
  const repo = useRepository('auth');
  const uc = new GetMeUseCase(repo);
  return useQuery({ queryKey: ['auth', 'me'], queryFn: () => uc.execute() });
}

export function useLogin() {
  const repo = useRepository('auth');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      new LoginUseCase(repo).execute(email, password),
    onSuccess: (result) => {
      authStorage.setToken(result.token);
      if (result.tenant) authStorage.setTenantSlug(result.tenant.slug);
      authStorage.setIsSuperAdmin(result.user.isSuperAdmin);
      qc.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useLogout() {
  const repo = useRepository('auth');
  return useMutation({
    mutationFn: () => new LogoutUseCase(repo).execute(),
    onSuccess: () => authStorage.clear(),
  });
}
```

- [ ] **Step 2: Create reservation hooks**

```ts
// apps/admin-v2/src/presentation/hooks/use-reservations.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetReservationsUseCase } from '@/application/use-cases/reservations/get-reservations';
import { CreateReservationUseCase } from '@/application/use-cases/reservations/create-reservation';
import { TransitionReservationUseCase } from '@/application/use-cases/reservations/transition-reservation';
import { CancelReservationUseCase } from '@/application/use-cases/reservations/cancel-reservation';
import type { ReservationFilters, ReservationAction } from '@/domain/entities/reservation';
import type { CreateReservationData } from '@/domain/repositories/reservation.repository';

export function useReservations(filters: ReservationFilters) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => new GetReservationsUseCase(repo).execute(filters),
  });
}

export function useAvailableSlots(date: string, serviceId: string) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['available-slots', date, serviceId],
    queryFn: () => repo.getAvailableSlots(date, serviceId),
    enabled: !!date && !!serviceId,
  });
}

export function useCreateReservation() {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReservationData) => new CreateReservationUseCase(repo).execute(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
}

export function useTransitionReservation() {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReservationAction }) =>
      new TransitionReservationUseCase(repo).execute(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
}

export function useCancelReservation() {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      new CancelReservationUseCase(repo).execute(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });
}
```

- [ ] **Step 3: Create remaining hooks following same pattern**

Each hook file follows the pattern: import use case → import useRepository → create query/mutation hooks that wire TanStack Query to use cases. Create for: use-services.ts, use-service-logs.ts, use-clients.ts, use-team.ts, use-reports.ts, use-settings.ts, use-availability.ts.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-v2/src/presentation/hooks/
git commit -m "feat(admin-v2): add presentation hooks with TanStack Query"
```

---

## Task 12: Presentation — App Providers & Root Layout

**Files:**
- Modify: `apps/admin-v2/src/presentation/app/layout.tsx`
- Create: `apps/admin-v2/src/presentation/components/providers.tsx`

- [ ] **Step 1: Create providers wrapper**

```tsx
// apps/admin-v2/src/presentation/components/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RepositoryProvider } from '@/infrastructure/providers/repository.provider';
import { Toaster } from '@/presentation/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider>
        {children}
        <Toaster position="top-right" richColors />
      </RepositoryProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update root layout**

```tsx
// apps/admin-v2/src/presentation/app/layout.tsx
import { Inter } from 'next/font/google';
import { Providers } from '../components/providers';
import '@/presentation/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = { title: 'Turnly Admin', description: 'Panel de administración Turnly' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-v2/src/presentation/
git commit -m "feat(admin-v2): add providers and root layout"
```

---

## Task 13-33: Presentation Pages

From this point, each task builds a specific page/feature using the foundation established above. Each task follows the same pattern:

1. Create page component in `presentation/app/(group)/route/page.tsx`
2. Create feature components in `presentation/components/features/{domain}/`
3. Wire to hooks from Task 11
4. Add Framer Motion transitions
5. Add skeleton loaders
6. Test manually
7. Commit

### Task 13: Layout Shell — Sidebar + Bottom Tabs + Topbar

**Files:**
- Create: `apps/admin-v2/src/presentation/components/layout/sidebar.tsx`
- Create: `apps/admin-v2/src/presentation/components/layout/bottom-tabs.tsx`
- Create: `apps/admin-v2/src/presentation/components/layout/topbar.tsx`
- Create: `apps/admin-v2/src/presentation/components/layout/app-shell.tsx`
- Create: `apps/admin-v2/src/presentation/components/layout/quick-actions-sheet.tsx`
- Create: `apps/admin-v2/src/presentation/app/(tenant)/layout.tsx`

Build: Desktop sidebar (240px/64px collapsible) with nav items (Dashboard, Reservaciones, Registro Diario, Clientes, Servicios, Equipo, Reportes) + Settings at bottom. Mobile bottom tab bar (5 items: Home, Reservations, +FAB, Reports, More). Topbar with breadcrumb, search (Cmd+K), notification bell, avatar dropdown. AppShell that switches layout at breakpoint. Tenant layout wraps all (tenant) routes.

### Task 14: Auth Pages — Login + Register

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(auth)/login/page.tsx`
- Create: `apps/admin-v2/src/presentation/app/(auth)/register/page.tsx`
- Create: `apps/admin-v2/src/presentation/app/(auth)/layout.tsx`

Build: Login page (centered card, gradient bg, email+password, RHF+Zod validation). Register page (4 fields: business name, name, email, password, slug auto-gen). Auth layout with centered max-width container.

### Task 15: Dashboard Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/dashboard/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/dashboard/live-tracker.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/dashboard/revenue-cards.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/dashboard/quick-actions.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/dashboard/upcoming-reservations.tsx`

Build: Greeting + date, revenue cards (today/week/month with trends), live service tracker (cards with timer, optional progress bar, complete button), quick action buttons, upcoming reservations list. Responsive grid layout.

### Task 16: Reservations — Timeline View

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/reservations/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/timeline.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/reservation-card.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/filters.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/now-line.tsx`

Build: Vertical timeline with hour axis, reservation cards positioned by time with status-colored borders, "now" line, filter tabs with counts, date selector. URL state via nuqs.

### Task 17: Reservations — Detail Panel + Actions + Create Modal

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/reservations/detail-panel.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/status-actions.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/create-modal.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/cancel-dialog.tsx`

Build: Slide-over detail panel (Sheet), contextual action buttons per status, cancel with reason dialog, multi-step create modal (service → date/slot → client → confirm).

### Task 18: Reservations — Calendar View

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/reservations/calendar-view.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reservations/view-toggle.tsx`

Build: Lightweight custom week/month calendar (no FullCalendar), color dots per status, click cell shows day list, toggle between timeline/calendar views.

### Task 19: Service Log Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/service-log/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/daily-summary.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/log-list.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/log-card.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/service-logs/new-service-modal.tsx`

Build: Summary cards (total, revenue, payment breakdown), reverse-chronological list with inline complete button, new service modal with service cards selection + client search + price/payment/employee.

### Task 20: Clients Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/clients/page.tsx`
- Create: `apps/admin-v2/src/presentation/app/(tenant)/clients/[id]/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/clients/client-card.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/clients/client-detail.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/clients/client-form.tsx`

Build: Card list adaptive to custom fields, debounced search, frequent client badge, detail page with stats + history tabs, create/edit modal with dynamic fields.

### Task 21: Services Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/services/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/services/service-card.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/services/service-form.tsx`

Build: Grid cards with image/price/duration/status, toggle active, drag-to-reorder, create/edit modal with image upload.

### Task 22: Team Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/team/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/team/staff-card.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/team/invite-modal.tsx`

Build: Staff cards with role badges, inline role change dropdown, invite modal with email + role.

### Task 23: Reports Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/reports/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reports/stats-cards.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reports/revenue-chart.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reports/payment-donut.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reports/daily-table.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/reports/range-selector.tsx`

Build: Range presets + custom picker (nuqs URL state), stat cards, Recharts area chart, payment donut with amounts+percentages, daily breakdown table with cash/card/transfer columns, PDF export.

### Task 24: Settings Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(tenant)/settings/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/general-tab.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/schedule-tab.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/gallery-tab.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/custom-fields-tab.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/permissions-tab.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/settings/brand-tab.tsx`

Build: 6-tab layout (side tabs desktop, top chips mobile). General (form + image uploads), Schedule (weekly hours editor + blocks), Gallery (image grid drag-reorder), Custom Fields (drag list), Permissions (matrix), Brand (palette grid with live preview).

### Task 25: Onboarding Contextual

**Files:**
- Create: `apps/admin-v2/src/presentation/components/features/onboarding/onboarding-banner.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/onboarding/business-type-prompt.tsx`

Build: Dashboard banner with progress bar + step links, business type modal prompt, skip/dismiss logic, reappear as sidebar indicator.

### Task 26: Public Page

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(public)/[slug]/page.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/public/booking-flow.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/public/service-cards.tsx`
- Create: `apps/admin-v2/src/presentation/components/features/public/gallery-carousel.tsx`

Build: Tenant-branded page (dynamic palette), gallery carousel, service cards with reserve button, inline booking flow (service → date → slot → data → confirm), social links footer.

### Task 27: Super Admin Pages

**Files:**
- Create: `apps/admin-v2/src/presentation/app/(super-admin)/layout.tsx`
- Create: `apps/admin-v2/src/presentation/app/(super-admin)/page.tsx`
- Create: `apps/admin-v2/src/presentation/app/(super-admin)/tenants/page.tsx`
- Create: `apps/admin-v2/src/presentation/app/(super-admin)/users/page.tsx`

Build: Separate layout with super admin sidebar, dashboard with stat cards + trend chart, tenants table with search/filter/actions, users table.

### Task 28: Polish & Integration

**Files:** Multiple across all components

Build: Add Framer Motion page transitions (AnimatePresence + motion.div wrappers), skeleton loaders on all data-loading pages, consistent error states, empty states with illustrations, command palette (Cmd+K) with global search, notification bell with badge.

- [ ] **Each task above: implement → test manually → commit**

```bash
# Pattern for each task commit:
git add apps/admin-v2/src/
git commit -m "feat(admin-v2): add [page/feature name]"
```

---

## Execution Notes

- Tasks 1-12 are foundational and MUST be completed in order
- Tasks 13-27 can be parallelized after Task 12 (all depend on hooks + providers being ready)
- Task 28 should be done last as it touches all components
- Each task should take 15-45 minutes for an experienced developer
- Total estimated: ~33 tasks across foundation + all pages
