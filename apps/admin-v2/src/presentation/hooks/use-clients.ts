'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetClientsUseCase } from '@/application/use-cases/clients/get-clients.use-case';
import { GetClientUseCase } from '@/application/use-cases/clients/get-client.use-case';
import { CreateClientUseCase } from '@/application/use-cases/clients/create-client.use-case';
import { UpdateClientUseCase } from '@/application/use-cases/clients/update-client.use-case';
import { GetClientHistoryUseCase } from '@/application/use-cases/clients/get-client-history.use-case';
import type { CreateClientResourceData } from '@/domain/repositories/client-resource.repository';

export function useClients(page?: number, search?: string) {
  const repo = useRepository('clientResource');
  return useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => new GetClientsUseCase(repo).execute(page, search),
  });
}

export function useClient(id: string) {
  const repo = useRepository('clientResource');
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => new GetClientUseCase(repo).execute(id),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const repo = useRepository('clientResource');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientResourceData) =>
      new CreateClientUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const repo = useRepository('clientResource');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateClientResourceData> }) =>
      new UpdateClientUseCase(repo).execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useClientHistory(id: string) {
  const repo = useRepository('clientResource');
  return useQuery({
    queryKey: ['clients', id, 'history'],
    queryFn: () => new GetClientHistoryUseCase(repo).execute(id),
    enabled: !!id,
  });
}
