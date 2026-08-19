'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AuthRepository } from '@/domain/repositories/auth.repository';
import type { OnboardingRepository } from '@/domain/repositories/onboarding.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { ServiceRepository } from '@/domain/repositories/service.repository';
import type { ServiceLogRepository } from '@/domain/repositories/service-log.repository';
import type { ClientResourceRepository } from '@/domain/repositories/client-resource.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import type { TenantRepository } from '@/domain/repositories/tenant.repository';
import type { ReportRepository } from '@/domain/repositories/report.repository';
import type { AvailabilityRepository } from '@/domain/repositories/availability.repository';
import type { UploadRepository } from '@/domain/repositories/upload.repository';
import type { SuperAdminRepository } from '@/domain/repositories/super-admin.repository';
import type { PublicRepository } from '@/domain/repositories/public.repository';
import type { NotificationRepository } from '@/domain/repositories/notification.repository';
import type { ProductRepository } from '@/domain/repositories/product.repository';
import type { ServiceVariantRepository } from '@/domain/repositories/service-variant.repository';
import type { BusinessResourceRepository } from '@/domain/repositories/business-resource.repository';
import type { InvoiceRepository } from '@/domain/repositories/invoice.repository';
import type { ServiceStaffRepository } from '@/domain/repositories/service-staff.repository';

import { ApiAuthRepository } from '../api/repositories/api-auth.repository';
import { ApiOnboardingRepository } from '../api/repositories/api-onboarding.repository';
import { ApiReservationRepository } from '../api/repositories/api-reservation.repository';
import { ApiServiceRepository } from '../api/repositories/api-service.repository';
import { ApiServiceLogRepository } from '../api/repositories/api-service-log.repository';
import { ApiServiceStaffRepository } from '../api/repositories/api-service-staff.repository';
import { ApiClientResourceRepository } from '../api/repositories/api-client-resource.repository';
import { ApiUserRepository } from '../api/repositories/api-user.repository';
import { ApiTenantRepository } from '../api/repositories/api-tenant.repository';
import { ApiReportRepository } from '../api/repositories/api-report.repository';
import { ApiAvailabilityRepository } from '../api/repositories/api-availability.repository';
import { ApiUploadRepository } from '../api/repositories/api-upload.repository';
import { ApiSuperAdminRepository } from '../api/repositories/api-super-admin.repository';
import { ApiPublicRepository } from '../api/repositories/api-public.repository';
import { ApiNotificationRepository } from '../api/repositories/api-notification.repository';
import { ApiProductRepository } from '../api/repositories/api-product.repository';
import { ApiServiceVariantRepository } from '../api/repositories/api-service-variant.repository';
import { ApiBusinessResourceRepository } from '../api/repositories/api-business-resource.repository';
import { ApiInvoiceRepository } from '../api/repositories/api-invoice.repository';

interface Repositories {
  auth: AuthRepository;
  onboarding: OnboardingRepository;
  reservation: ReservationRepository;
  service: ServiceRepository;
  serviceLog: ServiceLogRepository;
  clientResource: ClientResourceRepository;
  user: UserRepository;
  tenant: TenantRepository;
  report: ReportRepository;
  availability: AvailabilityRepository;
  upload: UploadRepository;
  superAdmin: SuperAdminRepository;
  public: PublicRepository;
  notification: NotificationRepository;
  product: ProductRepository;
  serviceVariant: ServiceVariantRepository;
  businessResource: BusinessResourceRepository;
  serviceStaff: ServiceStaffRepository;
  invoice: InvoiceRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo<Repositories>(
    () => ({
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
      notification: new ApiNotificationRepository(),
      product: new ApiProductRepository(),
      serviceVariant: new ApiServiceVariantRepository(),
      businessResource: new ApiBusinessResourceRepository(),
      serviceStaff: new ApiServiceStaffRepository(),
      invoice: new ApiInvoiceRepository(),
    }),
    [],
  );

  return (
    <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
  );
}

export function useRepository<K extends keyof Repositories>(name: K): Repositories[K] {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }
  return ctx[name];
}
