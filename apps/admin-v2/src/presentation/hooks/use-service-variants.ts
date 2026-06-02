'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import type { VariantInput } from '@/domain/repositories/service-variant.repository';

export function useServiceVariants(serviceId: string | null) {
  const repo = useRepository('serviceVariant');
  return useQuery({
    queryKey: ['service-variants', serviceId],
    queryFn: () => repo.listByService(serviceId as string),
    enabled: Boolean(serviceId),
  });
}

export function useCreateVariant(serviceId: string) {
  const repo = useRepository('serviceVariant');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VariantInput) => repo.create(serviceId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-variants', serviceId] }),
  });
}

export function useUpdateVariant(serviceId: string) {
  const repo = useRepository('serviceVariant');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VariantInput> }) =>
      repo.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-variants', serviceId] }),
  });
}

export function useDeleteVariant(serviceId: string) {
  const repo = useRepository('serviceVariant');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-variants', serviceId] }),
  });
}

export function useBom(variantId: string | null) {
  const repo = useRepository('serviceVariant');
  return useQuery({
    queryKey: ['bom', variantId],
    queryFn: () => repo.getBom(variantId as string),
    enabled: Boolean(variantId),
  });
}

export function useReplaceBom(variantId: string) {
  const repo = useRepository('serviceVariant');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: { productId: string; qty: number }[]) =>
      repo.replaceBom(variantId, lines),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', variantId] });
      qc.invalidateQueries({ queryKey: ['service-variants'] });
    },
  });
}
