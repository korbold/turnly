'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { ListBusinessResourcesUseCase } from '@/application/use-cases/business-resources/list-business-resources.use-case';
import { CreateBusinessResourceUseCase } from '@/application/use-cases/business-resources/create-business-resource.use-case';
import { UpdateBusinessResourceUseCase } from '@/application/use-cases/business-resources/update-business-resource.use-case';
import { DeleteBusinessResourceUseCase } from '@/application/use-cases/business-resources/delete-business-resource.use-case';
import type { CreateBusinessResourceInput, UpdateBusinessResourceInput } from '@/domain/entities/business-resource';

export function useBusinessResources() {
  const repo = useRepository('businessResource');
  return useQuery({
    queryKey: ['business-resources'],
    queryFn: () => new ListBusinessResourcesUseCase(repo).execute(),
  });
}

export function useCreateBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessResourceInput) =>
      new CreateBusinessResourceUseCase(repo).execute(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}

export function useUpdateBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBusinessResourceInput }) =>
      new UpdateBusinessResourceUseCase(repo).execute(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}

export function useDeleteBusinessResource() {
  const repo = useRepository('businessResource');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteBusinessResourceUseCase(repo).execute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-resources'] }),
  });
}
