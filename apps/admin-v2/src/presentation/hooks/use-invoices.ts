'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetInvoicesUseCase, EmitInvoiceUseCase } from '@/application/use-cases/invoices';
import type { InvoiceFilters } from '@/domain/entities/invoice';

export function useInvoices(filters: InvoiceFilters) {
  const repo = useRepository('invoice');
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => new GetInvoicesUseCase(repo).execute(filters),
  });
}

export function useEmitInvoice() {
  const repo = useRepository('invoice');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceLogId: string) =>
      new EmitInvoiceUseCase(repo).execute(serviceLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
