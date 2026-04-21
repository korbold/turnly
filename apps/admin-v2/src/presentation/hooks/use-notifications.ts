'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetNotificationsUseCase } from '@/application/use-cases/notifications/get-notifications.use-case';
import { MarkNotificationReadUseCase } from '@/application/use-cases/notifications/mark-notification-read.use-case';
import { MarkAllReadUseCase } from '@/application/use-cases/notifications/mark-all-read.use-case';
import { RegisterDeviceTokenUseCase } from '@/application/use-cases/notifications/register-device-token.use-case';
import { requestPushToken, onForegroundMessage } from '@/lib/firebase/config';
import { toast } from 'sonner';

export function useNotifications() {
  const repo = useRepository('notification');
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => new GetNotificationsUseCase(repo).execute(),
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

export function useMarkNotificationRead() {
  const repo = useRepository('notification');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => new MarkNotificationReadUseCase(repo).execute(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const repo = useRepository('notification');
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => new MarkAllReadUseCase(repo).execute(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRegisterPushToken() {
  const repo = useRepository('notification');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setup() {
      const token = await requestPushToken();
      if (token) {
        await new RegisterDeviceTokenUseCase(repo).execute(token, 'web');
      }

      unsubscribe = onForegroundMessage((payload) => {
        if (payload.title) {
          toast(payload.title, { description: payload.body });
        }
      });
    }

    setup();
    return () => unsubscribe?.();
  }, [repo]);
}
