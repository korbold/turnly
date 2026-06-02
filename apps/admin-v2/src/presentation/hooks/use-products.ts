'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import type {
  CreateProductInput,
  ListProductsParams,
  RecordMovementInput,
  UpdateProductInput,
} from '@/domain/repositories/product.repository';

export function useProducts(params?: ListProductsParams) {
  const repo = useRepository('product');
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => repo.list(params),
  });
}

export function useProduct(id: string | null) {
  const repo = useRepository('product');
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => repo.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const repo = useRepository('product');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => repo.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const repo = useRepository('product');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      repo.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const repo = useRepository('product');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useProductMovements(productId: string | null, page = 1) {
  const repo = useRepository('product');
  return useQuery({
    queryKey: ['product-movements', productId, page],
    queryFn: () => repo.listMovements(productId as string, page),
    enabled: Boolean(productId),
  });
}

export function useRecordMovement() {
  const repo = useRepository('product');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordMovementInput) => repo.recordMovement(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-movements', vars.productId] });
    },
  });
}
