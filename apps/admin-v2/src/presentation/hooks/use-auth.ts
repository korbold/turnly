'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetMeUseCase } from '@/application/use-cases/auth/get-me.use-case';
import { LoginUseCase } from '@/application/use-cases/auth/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/auth/logout.use-case';
import { RegisterUseCase } from '@/application/use-cases/auth/register.use-case';
import { authStorage } from '@/infrastructure/storage/auth-storage';

export function useMe() {
  const repo = useRepository('auth');
  return useQuery({
    queryKey: ['me'],
    queryFn: () => new GetMeUseCase(repo).execute(),
    retry: false,
  });
}

export function useLogin() {
  const repo = useRepository('auth');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      new LoginUseCase(repo).execute(email, password),
    onSuccess: (result) => {
      authStorage.setToken(result.token);
      if (result.tenant) {
        authStorage.setTenantSlug(result.tenant.slug);
      }
      authStorage.setIsSuperAdmin(result.user.isSuperAdmin);
      queryClient.removeQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const repo = useRepository('auth');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => new LogoutUseCase(repo).execute(),
    onSuccess: () => {
      authStorage.clear();
      queryClient.clear();
    },
  });
}

export function useRegister() {
  const repo = useRepository('auth');
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      new RegisterUseCase(repo).execute(data),
    onSuccess: (result) => {
      authStorage.setToken(result.token);
      if (result.tenant) {
        authStorage.setTenantSlug(result.tenant.slug);
      }
      authStorage.setIsSuperAdmin(result.user.isSuperAdmin);
    },
  });
}
