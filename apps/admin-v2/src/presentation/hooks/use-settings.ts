'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetSettingsUseCase } from '@/application/use-cases/settings/get-settings.use-case';
import { UpdateSettingsUseCase } from '@/application/use-cases/settings/update-settings.use-case';
import { GetImagesUseCase } from '@/application/use-cases/settings/get-images.use-case';
import { AddImageUseCase } from '@/application/use-cases/settings/add-image.use-case';
import { DeleteImageUseCase } from '@/application/use-cases/settings/delete-image.use-case';
import { ReorderImagesUseCase } from '@/application/use-cases/settings/reorder-images.use-case';
import { GetBillingProfileUseCase } from '@/application/use-cases/settings/get-billing-profile.use-case';
import { UpdateBillingProfileUseCase } from '@/application/use-cases/settings/update-billing-profile.use-case';
import { LookupTaxIdUseCase } from '@/application/use-cases/settings/lookup-tax-id.use-case';
import type { TenantSettings, BillingProfileInput, TaxIdType } from '@/domain/entities/tenant';

export function useSettings() {
  const repo = useRepository('tenant');
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => new GetSettingsUseCase(repo).execute(),
  });
}

export function useUpdateSettings() {
  const repo = useRepository('tenant');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TenantSettings>) =>
      new UpdateSettingsUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useImages() {
  const repo = useRepository('tenant');
  return useQuery({
    queryKey: ['settings', 'images'],
    queryFn: () => new GetImagesUseCase(repo).execute(),
  });
}

export function useAddImage() {
  const repo = useRepository('tenant');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => new AddImageUseCase(repo).execute(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'images'] });
    },
  });
}

export function useDeleteImage() {
  const repo = useRepository('tenant');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteImageUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'images'] });
    },
  });
}

export function useReorderImages() {
  const repo = useRepository('tenant');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => new ReorderImagesUseCase(repo).execute(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'images'] });
    },
  });
}

export function useBillingProfile() {
  const repo = useRepository('tenant');
  return useQuery({
    queryKey: ['billing-profile'],
    queryFn: () => new GetBillingProfileUseCase(repo).execute(),
  });
}

export function useUpdateBillingProfile() {
  const repo = useRepository('tenant');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BillingProfileInput) =>
      new UpdateBillingProfileUseCase(repo).execute(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profile'] });
    },
  });
}

export function useLookupTaxId(type: TaxIdType | null, taxId: string, enabled: boolean) {
  const repo = useRepository('tenant');
  return useQuery({
    queryKey: ['billing-profile', 'lookup', type, taxId],
    queryFn: () => new LookupTaxIdUseCase(repo).execute(type as TaxIdType, taxId),
    enabled: enabled && type !== null && taxId.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}
