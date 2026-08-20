'use client';

import { useQuery } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetRangeReportUseCase } from '@/application/use-cases/reports/get-range-report.use-case';
import { GetDailyReportUseCase } from '@/application/use-cases/reports/get-daily-report.use-case';
import { GetDiscountReportUseCase } from '@/application/use-cases/reports/get-discount-report.use-case';
import type { RangeReportFilters } from '@/domain/repositories/report.repository';

export function useRangeReport(from: string, to: string, filters?: RangeReportFilters) {
  const repo = useRepository('report');
  const method = filters?.paymentMethod ?? null;
  const bank = filters?.paymentBank ?? null;
  return useQuery({
    queryKey: ['reports', 'range', from, to, method, bank],
    queryFn: () => new GetRangeReportUseCase(repo).execute(from, to, { paymentMethod: method, paymentBank: bank }),
    enabled: !!from && !!to,
  });
}

export function useDailyReport(date: string) {
  const repo = useRepository('report');
  return useQuery({
    queryKey: ['reports', 'daily', date],
    queryFn: () => new GetDailyReportUseCase(repo).execute(date),
    enabled: !!date,
  });
}

export function useDiscountReport(from: string, to: string) {
  const repo = useRepository('report');
  return useQuery({
    queryKey: ['reports', 'discounts', from, to],
    queryFn: () => new GetDiscountReportUseCase(repo).execute(from, to),
    enabled: !!from && !!to,
  });
}
