'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { ListServiceStaffUseCase } from '@/application/use-cases/service-staff/list-service-staff.use-case';
import { CreateServiceStaffUseCase } from '@/application/use-cases/service-staff/create-service-staff.use-case';
import { UpdateServiceStaffUseCase } from '@/application/use-cases/service-staff/update-service-staff.use-case';
import type {
  CreateServiceStaffInput,
  UpdateServiceStaffInput,
  StaffPosition,
} from '@/domain/entities/service-staff';

export function useServiceStaff(position?: StaffPosition) {
  const repo = useRepository('serviceStaff');
  return useQuery({
    queryKey: ['service-staff', position ?? 'all'],
    queryFn: () => new ListServiceStaffUseCase(repo).execute(position),
  });
}

export function useCreateServiceStaff() {
  const repo = useRepository('serviceStaff');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceStaffInput) =>
      new CreateServiceStaffUseCase(repo).execute(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-staff'] }),
  });
}

export function useUpdateServiceStaff() {
  const repo = useRepository('serviceStaff');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateServiceStaffInput }) =>
      new UpdateServiceStaffUseCase(repo).execute(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-staff'] }),
  });
}
