'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetCashSessionUseCase } from '@/application/use-cases/cash/get-cash-session.use-case';
import { OpenCashSessionUseCase } from '@/application/use-cases/cash/open-cash-session.use-case';
import { AddCashMovementUseCase } from '@/application/use-cases/cash/add-cash-movement.use-case';
import { CloseCashSessionUseCase } from '@/application/use-cases/cash/close-cash-session.use-case';
import { ReopenCashSessionUseCase } from '@/application/use-cases/cash/reopen-cash-session.use-case';
import type {
  OpenCashSessionInput,
  AddCashMovementInput,
  CloseCashSessionInput,
  ReopenCashSessionInput,
} from '@/domain/entities/cash-session';

export function useCashSession(date: string) {
  const repo = useRepository('cashSession');
  return useQuery({
    queryKey: ['cash-session', date],
    queryFn: () => new GetCashSessionUseCase(repo).execute(date),
  });
}

/**
 * Las tres mutaciones invalidan también `service-logs`: cerrar la caja no
 * cambia un cobro, pero el cajero que acaba de cerrar mira la misma pantalla
 * y no debería tener que recargarla para verla al día.
 */
function useCashMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session'] });
      qc.invalidateQueries({ queryKey: ['service-logs'] });
    },
  });
}

export function useOpenCashSession() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: OpenCashSessionInput) =>
    new OpenCashSessionUseCase(repo).execute(input),
  );
}

export function useAddCashMovement() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: AddCashMovementInput) =>
    new AddCashMovementUseCase(repo).execute(input),
  );
}

export function useCloseCashSession() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: CloseCashSessionInput) =>
    new CloseCashSessionUseCase(repo).execute(input),
  );
}

export function useReopenCashSession() {
  const repo = useRepository('cashSession');
  return useCashMutation((input: ReopenCashSessionInput) =>
    new ReopenCashSessionUseCase(repo).execute(input),
  );
}
