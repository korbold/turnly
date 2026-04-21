'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetReservationsUseCase } from '@/application/use-cases/reservations/get-reservations.use-case';
import { GetAvailableSlotsUseCase } from '@/application/use-cases/reservations/get-available-slots.use-case';
import { CreateReservationUseCase } from '@/application/use-cases/reservations/create-reservation.use-case';
import { TransitionReservationUseCase } from '@/application/use-cases/reservations/transition-reservation.use-case';
import { CancelReservationUseCase } from '@/application/use-cases/reservations/cancel-reservation.use-case';
import type { ReservationFilters, ReservationAction } from '@/domain/entities/reservation';
import type { CreateReservationData } from '@/domain/repositories/reservation.repository';

export function useReservations(filters: ReservationFilters, enabled = true) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => new GetReservationsUseCase(repo).execute(filters),
    enabled,
  });
}

export function useAvailableSlots(date: string | undefined, serviceId: string | undefined) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['available-slots', date, serviceId],
    queryFn: () => new GetAvailableSlotsUseCase(repo).execute(date!, serviceId!),
    enabled: !!date && !!serviceId,
  });
}

export function useCreateReservation() {
  const repo = useRepository('reservation');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReservationData) =>
      new CreateReservationUseCase(repo).execute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useTransitionReservation() {
  const repo = useRepository('reservation');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReservationAction }) =>
      new TransitionReservationUseCase(repo).execute(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useCancelReservation() {
  const repo = useRepository('reservation');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      new CancelReservationUseCase(repo).execute(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}
