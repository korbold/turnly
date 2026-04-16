'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetServiceLogsUseCase } from '@/application/use-cases/service-logs/get-service-logs.use-case';
import { CreateServiceLogUseCase } from '@/application/use-cases/service-logs/create-service-log.use-case';
import { UpdateServiceLogUseCase } from '@/application/use-cases/service-logs/update-service-log.use-case';
import { DeleteServiceLogUseCase } from '@/application/use-cases/service-logs/delete-service-log.use-case';
import { CompleteServiceLogUseCase } from '@/application/use-cases/service-logs/complete-service-log.use-case';
import { GetDailySummaryUseCase } from '@/application/use-cases/service-logs/get-daily-summary.use-case';
import type { ServiceLogFilters } from '@/domain/entities/service-log';
import type { CreateServiceLogData, UpdateServiceLogData } from '@/domain/repositories/service-log.repository';

export function useServiceLogs(filters: ServiceLogFilters) {
  const repo = useRepository('serviceLog');
  return useQuery({
    queryKey: ['service-logs', filters],
    queryFn: () => new GetServiceLogsUseCase(repo).execute(filters),
  });
}

export function useCreateServiceLog() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceLogData) =>
      new CreateServiceLogUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useUpdateServiceLog() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceLogData }) =>
      new UpdateServiceLogUseCase(repo).execute(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useDeleteServiceLog() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new DeleteServiceLogUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useCompleteServiceLog() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new CompleteServiceLogUseCase(repo).execute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useDailySummary(date: string) {
  const repo = useRepository('serviceLog');
  return useQuery({
    queryKey: ['service-logs', 'summary', date],
    queryFn: () => new GetDailySummaryUseCase(repo).execute(date),
  });
}
