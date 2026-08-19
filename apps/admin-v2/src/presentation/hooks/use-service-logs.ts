'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetServiceLogsUseCase } from '@/application/use-cases/service-logs/get-service-logs.use-case';
import { CreateServiceLogUseCase } from '@/application/use-cases/service-logs/create-service-log.use-case';
import { UpdateServiceLogUseCase } from '@/application/use-cases/service-logs/update-service-log.use-case';
import { DeleteServiceLogUseCase } from '@/application/use-cases/service-logs/delete-service-log.use-case';
import { CompleteServiceLogUseCase } from '@/application/use-cases/service-logs/complete-service-log.use-case';
import { RecordServiceLogPaymentUseCase } from '@/application/use-cases/service-logs/record-service-log-payment.use-case';
import { GetDailySummaryUseCase } from '@/application/use-cases/service-logs/get-daily-summary.use-case';
import { UpdateServiceLogItemsUseCase } from '@/application/use-cases/service-logs/update-service-log-items.use-case';
import type { ServiceLogFilters } from '@/domain/entities/service-log';
import type { AssignStaffData, CreateServiceLogData, UpdateServiceLogData, RecordPaymentData, UpdateServiceLogItemsData, ServiceLogBillingProfile } from '@/domain/repositories/service-log.repository';

export function useServiceLogs(filters: ServiceLogFilters) {
  const repo = useRepository('serviceLog');
  return useQuery({
    queryKey: ['service-logs', filters],
    queryFn: () => new GetServiceLogsUseCase(repo).execute(filters),
    // While an invoice is sent and awaiting the SRI verdict ('enviada'),
    // poll so the row resolves to its final status (autorizada / rechazada)
    // — and its loading spinner stops — without a manual refresh.
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((r) => r.invoiceStatus === 'enviada') ? 4000 : false;
    },
  });
}

/** Single service log for the detail page (GET /service-logs/{id}). */
export function useServiceLog(id: string) {
  const repo = useRepository('serviceLog');
  return useQuery({
    queryKey: ['service-logs', 'detail', id],
    queryFn: () => repo.getById(id),
    enabled: !!id,
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

export function useAssignServiceLogStaff() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignStaffData }) =>
      repo.assignStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useUpdateServiceLogItems() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: UpdateServiceLogItemsData }) =>
      new UpdateServiceLogItemsUseCase(repo).execute(id, items),
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
    // Acepta el id solo (los llamadores viejos) o el objeto con la marca.
    mutationFn: (input: string | { id: string; leftOwing?: boolean }) => {
      const { id, leftOwing } = typeof input === 'string' ? { id: input, leftOwing: undefined } : input;
      return new CompleteServiceLogUseCase(repo).execute(id, leftOwing);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-logs'] });
      // Salir debiendo cambia la deuda de la placa y la columna de Clientes.
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useRecordServiceLogPayment() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordPaymentData }) =>
      new RecordServiceLogPaymentUseCase(repo).execute(id, data),
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

/** Fiscal profile prefill for the "Datos de facturación" dialog. Only
    fetches while `enabled` (i.e. the dialog is open). */
export function useServiceLogBilling(id: string, enabled: boolean) {
  const repo = useRepository('serviceLog');
  return useQuery({
    queryKey: ['service-logs', 'billing', id],
    queryFn: () => repo.getBilling(id),
    enabled,
  });
}

export function useUpdateServiceLogBilling() {
  const repo = useRepository('serviceLog');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceLogBillingProfile }) =>
      repo.updateBilling(id, data),
    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['service-logs', 'billing', id] });
    },
  });
}
