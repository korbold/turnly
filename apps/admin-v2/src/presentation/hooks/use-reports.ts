'use client';

import { useQuery } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetRangeReportUseCase } from '@/application/use-cases/reports/get-range-report.use-case';
import { GetDailyReportUseCase } from '@/application/use-cases/reports/get-daily-report.use-case';

export function useRangeReport(from: string, to: string) {
  const repo = useRepository('report');
  return useQuery({
    queryKey: ['reports', 'range', from, to],
    queryFn: () => new GetRangeReportUseCase(repo).execute(from, to),
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
