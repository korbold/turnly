'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetDebtUseCase } from '@/application/use-cases/debt/get-debt.use-case';
import { AddManualDebtUseCase } from '@/application/use-cases/debt/add-manual-debt.use-case';
import { PayDebtUseCase } from '@/application/use-cases/debt/pay-debt.use-case';
import type { AddManualDebtInput, PayDebtInput, PayClientDebtInput } from '@/domain/entities/debt';

export function useDebt(clientResourceId: string, enabled = true) {
  const repo = useRepository('debt');
  return useQuery({
    queryKey: ['debt', clientResourceId],
    queryFn: () => new GetDebtUseCase(repo).execute(clientResourceId),
    enabled: enabled && !!clientResourceId,
  });
}

/**
 * Las dos mutaciones invalidan tres cosas: la ficha de deuda, la columna de
 * la lista de Clientes, y la fila del Registro Diario del día en que se
 * registró el servicio — cobrar una deuda vieja la cambia de "Pendiente" a
 * pagada, y nadie debería tener que recargar para verlo.
 */
function useDebtMutation<TInput>(run: (input: TInput) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['service-logs'] });
      qc.invalidateQueries({ queryKey: ['cash-session'] });
    },
  });
}

export function useAddManualDebt() {
  const repo = useRepository('debt');
  return useDebtMutation((input: AddManualDebtInput) =>
    new AddManualDebtUseCase(repo).execute(input),
  );
}

export function usePayDebt() {
  const repo = useRepository('debt');
  return useDebtMutation((input: PayDebtInput) =>
    new PayDebtUseCase(repo).execute(input),
  );
}


/** La deuda de una persona: la de todos sus vehículos, sumada. */
export function useClientDebt(clientId: string | null) {
  const repo = useRepository('debt');
  return useQuery({
    queryKey: ['debt', 'client', clientId],
    queryFn: () => repo.getForClient(clientId as string),
    enabled: !!clientId,
  });
}

export function usePayClientDebt() {
  const repo = useRepository('debt');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PayClientDebtInput) => repo.payForClient(input),
    onSuccess: () => {
      // Un pago reparte entre varios autos: se invalida la deuda de la
      // persona, la de cada placa, el registro del día y la caja.
      qc.invalidateQueries({ queryKey: ['debt'] });
      qc.invalidateQueries({ queryKey: ['service-logs'] });
      qc.invalidateQueries({ queryKey: ['cash-session'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
