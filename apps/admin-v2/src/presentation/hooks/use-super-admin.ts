'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetStatsUseCase } from '@/application/use-cases/super-admin/get-stats.use-case';
import { GetTenantsUseCase } from '@/application/use-cases/super-admin/get-tenants.use-case';
import { GetUsersUseCase } from '@/application/use-cases/super-admin/get-users.use-case';
import { SuspendTenantUseCase } from '@/application/use-cases/super-admin/suspend-tenant.use-case';
import { ActivateTenantUseCase } from '@/application/use-cases/super-admin/activate-tenant.use-case';

export function useSuperAdminStats() {
  const repo = useRepository('superAdmin');
  return useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: () => new GetStatsUseCase(repo).execute(),
  });
}

export function useSuperAdminTenants(page?: number) {
  const repo = useRepository('superAdmin');
  return useQuery({
    queryKey: ['super-admin', 'tenants', page],
    queryFn: () => new GetTenantsUseCase(repo).execute(page),
  });
}

export function useSuperAdminUsers(page?: number) {
  const repo = useRepository('superAdmin');
  return useQuery({
    queryKey: ['super-admin', 'users', page],
    queryFn: () => new GetUsersUseCase(repo).execute(page),
  });
}

export function useSuspendTenant() {
  const repo = useRepository('superAdmin');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new SuspendTenantUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] });
    },
  });
}

export function useActivateTenant() {
  const repo = useRepository('superAdmin');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new ActivateTenantUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'tenants'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'stats'] });
    },
  });
}
