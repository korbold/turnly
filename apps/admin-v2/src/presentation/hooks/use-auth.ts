'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetMeUseCase } from '@/application/use-cases/auth/get-me.use-case';
import { LoginUseCase } from '@/application/use-cases/auth/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/auth/logout.use-case';
import { RegisterUseCase } from '@/application/use-cases/auth/register.use-case';
import { VerifyEmailUseCase } from '@/application/use-cases/auth/verify-email.use-case';
import { ResendVerificationUseCase } from '@/application/use-cases/auth/resend-verification.use-case';
import { authStorage } from '@/infrastructure/storage/auth-storage';
import api from '@/infrastructure/api/client';

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
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      new LoginUseCase(repo).execute(identifier, password),
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
    mutationFn: (data: {
      name: string;
      email: string;
      password: string;
      businessName?: string;
      businessType?: string;
    }) => new RegisterUseCase(repo).execute(data),
    // No token storage on register: user must verify email first.
  });
}

export function useVerifyEmail() {
  const repo = useRepository('auth');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      new VerifyEmailUseCase(repo).execute(email, code),
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

export function useResendVerification() {
  const repo = useRepository('auth');
  return useMutation({
    mutationFn: (email: string) =>
      new ResendVerificationUseCase(repo).execute(email),
  });
}

export function useImpersonate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data: res } = await api.post(`/superadmin/tenants/${tenantId}/impersonate`);
      return res.data as { token: string; tenant: { slug: string; id: string; name: string; status: string }; user: { id: string; name: string; email: string; is_super_admin: boolean } };
    },
    onSuccess: (result) => {
      authStorage.setToken(result.token);
      authStorage.setTenantSlug(result.tenant.slug);
      authStorage.setIsSuperAdmin(false);
      queryClient.clear();
    },
  });
}
