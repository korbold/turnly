'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetServicesUseCase } from '@/application/use-cases/services/get-services.use-case';
import { CreateServiceUseCase } from '@/application/use-cases/services/create-service.use-case';
import { UpdateServiceUseCase } from '@/application/use-cases/services/update-service.use-case';
import { DeleteServiceUseCase } from '@/application/use-cases/services/delete-service.use-case';
import type { CreateServiceData } from '@/domain/repositories/service.repository';

export function useServices(page?: number) {
  const repo = useRepository('service');
  return useQuery({
    queryKey: ['services', page],
    queryFn: () => new GetServicesUseCase(repo).execute(page),
  });
}

export function useService(id: string | null) {
  const repo = useRepository('service');
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => repo.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateService() {
  const repo = useRepository('service');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceData) =>
      new CreateServiceUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdateService() {
  const repo = useRepository('service');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateServiceData> }) =>
      new UpdateServiceUseCase(repo).execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeleteService() {
  const repo = useRepository('service');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteServiceUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
