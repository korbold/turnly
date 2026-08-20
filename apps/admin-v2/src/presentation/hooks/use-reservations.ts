'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetReservationsUseCase } from '@/application/use-cases/reservations/get-reservations.use-case';
import { GetAvailableSlotsUseCase } from '@/application/use-cases/reservations/get-available-slots.use-case';
import { CreateReservationUseCase } from '@/application/use-cases/reservations/create-reservation.use-case';
import { TransitionReservationUseCase } from '@/application/use-cases/reservations/transition-reservation.use-case';
import { CancelReservationUseCase } from '@/application/use-cases/reservations/cancel-reservation.use-case';
import type { ReservationFilters, ReservationAction } from '@/domain/entities/reservation';
import type {
  CreateReservationData,
  AddItemInput,
  CheckInInput,
} from '@/domain/repositories/reservation.repository';

export function useReservations(filters: ReservationFilters, enabled = true) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => new GetReservationsUseCase(repo).execute(filters),
    enabled,
  });
}

export function useAvailableSlots(date: string | undefined, serviceId: string | undefined, durationMin?: number) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['available-slots', date, serviceId, durationMin],
    queryFn: () => new GetAvailableSlotsUseCase(repo).execute(date!, serviceId!, durationMin),
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
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      // The detail page reads ['reservation', id] separately, so without
      // these invalidations its status badge + action buttons stay
      // stale, the user clicks again, and the backend rejects with 422
      // ("No se pudo iniciar"). Sibling queries follow the same key.
      queryClient.invalidateQueries({ queryKey: ['reservation', id] });
      queryClient.invalidateQueries({ queryKey: ['reservation-items', id] });
      queryClient.invalidateQueries({ queryKey: ['reservation-changes', id] });
    },
  });
}

export function useCancelReservation() {
  const repo = useRepository('reservation');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      new CancelReservationUseCase(repo).execute(id, reason),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation', id] });
      queryClient.invalidateQueries({ queryKey: ['reservation-items', id] });
      queryClient.invalidateQueries({ queryKey: ['reservation-changes', id] });
    },
  });
}

export function useRescheduleReservation() {
  const repo = useRepository('reservation');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      repo.reschedule(id, scheduledAt),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation', id] });
    },
  });
}

export function useReservation(id: string | null) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: () => repo.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useReservationItems(id: string | null) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservation-items', id],
    queryFn: () => repo.listItems(id as string),
    enabled: Boolean(id),
  });
}

export function useReservationChanges(id: string | null) {
  const repo = useRepository('reservation');
  return useQuery({
    queryKey: ['reservation-changes', id],
    queryFn: () => repo.listChanges(id as string),
    enabled: Boolean(id),
  });
}

export function useCheckInReservation(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) => repo.checkIn(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useUpdateReservationBilling(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckInInput) => repo.updateBilling(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation', id] }),
  });
}

export function useRecordReservationPayment(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      method: 'transfer' | 'card' | 'cash';
      reference?: string | null;
      bank?: string | null;
      billing?: CheckInInput['billing'];
      billingProfileId?: string | null;
    }) => repo.recordPayment(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useAddReservationItem(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddItemInput) => repo.addItem(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation-items', id] });
      qc.invalidateQueries({ queryKey: ['reservation-changes', id] });
      qc.invalidateQueries({ queryKey: ['reservation', id] });
    },
  });
}

export function useRemoveReservationItem(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason?: string }) =>
      repo.removeItem(itemId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation-items', id] });
      qc.invalidateQueries({ queryKey: ['reservation-changes', id] });
    },
  });
}

export function useOverrideReservationItemPrice(id: string) {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      unitPrice,
      reasonCode,
      note,
    }: { itemId: string; unitPrice: number; reasonCode: string; note?: string }) =>
      repo.overrideItemPrice(itemId, unitPrice, reasonCode, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation-items', id] });
      qc.invalidateQueries({ queryKey: ['reservation-changes', id] });
    },
  });
}

export function useEmitReservationInvoice() {
  const repo = useRepository('reservation');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.emitInvoice(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}
