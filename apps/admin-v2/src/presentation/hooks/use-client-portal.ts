'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientPortalRepository } from '@/infrastructure/api/repositories/api-client-portal.repository';

export function useMyReservations(status?: string) {
  return useQuery({
    queryKey: ['client-reservations', status ?? 'all'],
    queryFn: () => clientPortalRepository.myReservations(status),
  });
}

export function useMyReservation(id: string) {
  return useQuery({
    queryKey: ['client-reservations', 'detail', id],
    queryFn: () => clientPortalRepository.myReservation(id),
    enabled: !!id,
  });
}

export function useCancelMyReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      clientPortalRepository.cancelReservation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-reservations'] });
    },
  });
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) => clientPortalRepository.requestMagicLink(email),
  });
}

export function useVerifyMagicLink() {
  return useMutation({
    mutationFn: (token: string) => clientPortalRepository.verifyMagicLink(token),
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: (idToken: string) => clientPortalRepository.googleLogin(idToken),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => clientPortalRepository.deleteAccount(),
  });
}
