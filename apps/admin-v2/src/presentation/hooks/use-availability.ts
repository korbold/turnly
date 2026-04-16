'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetSlotsUseCase } from '@/application/use-cases/availability/get-slots.use-case';
import { UpdateSlotsUseCase } from '@/application/use-cases/availability/update-slots.use-case';
import { GetBlocksUseCase } from '@/application/use-cases/availability/get-blocks.use-case';
import { CreateBlockUseCase } from '@/application/use-cases/availability/create-block.use-case';
import { DeleteBlockUseCase } from '@/application/use-cases/availability/delete-block.use-case';
import type { AvailabilitySlot } from '@/domain/entities/availability';
import type { CreateBlockData } from '@/domain/repositories/availability.repository';

export function useAvailabilitySlots() {
  const repo = useRepository('availability');
  return useQuery({
    queryKey: ['availability', 'slots'],
    queryFn: () => new GetSlotsUseCase(repo).execute(),
  });
}

export function useUpdateSlots() {
  const repo = useRepository('availability');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slots: AvailabilitySlot[]) =>
      new UpdateSlotsUseCase(repo).execute(slots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', 'slots'] });
    },
  });
}

export function useBlocks() {
  const repo = useRepository('availability');
  return useQuery({
    queryKey: ['availability', 'blocks'],
    queryFn: () => new GetBlocksUseCase(repo).execute(),
  });
}

export function useCreateBlock() {
  const repo = useRepository('availability');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBlockData) =>
      new CreateBlockUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', 'blocks'] });
    },
  });
}

export function useDeleteBlock() {
  const repo = useRepository('availability');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteBlockUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', 'blocks'] });
    },
  });
}
