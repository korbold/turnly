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
    // Refresh the row's invoice status after ANY outcome (autorizada,
    // rechazada, or a billing error that still flipped the status), so the
    // badge reflects the real result once the retry resolves.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
