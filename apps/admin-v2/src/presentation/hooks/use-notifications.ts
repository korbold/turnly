'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/infrastructure/providers/repository.provider';
import { GetNotificationsUseCase } from '@/application/use-cases/notifications/get-notifications.use-case';
import { MarkNotificationReadUseCase } from '@/application/use-cases/notifications/mark-notification-read.use-case';
import { MarkAllReadUseCase } from '@/application/use-cases/notifications/mark-all-read.use-case';
import { RegisterDeviceTokenUseCase } from '@/application/use-cases/notifications/register-device-token.use-case';
import { requestPushToken, onForegroundMessage, getNotificationPermission } from '@/lib/firebase/config';
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

function isIosPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && isStandalone;
}

const PUSH_GRANTED_KEY = 'push-permission-granted';

export function useRegisterPushToken() {
  const repo = useRepository('notification');
  const [needsPrompt, setNeedsPrompt] = useState(false);

  const registerToken = useCallback(async () => {
    const token = await requestPushToken();
    if (token) {
      await new RegisterDeviceTokenUseCase(repo).execute(token, 'web');
    }
    if (getNotificationPermission() === 'granted') {
      localStorage.setItem(PUSH_GRANTED_KEY, '1');
      setNeedsPrompt(false);
    }
  }, [repo]);

  // Called from a button click on iOS (requires user gesture)
  const enableNotifications = useCallback(async () => {
    await registerToken();
  }, [registerToken]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setup() {
      const permission = getNotificationPermission();
      const wasGranted = localStorage.getItem(PUSH_GRANTED_KEY) === '1';

      if (permission === 'granted' || wasGranted) {
        setNeedsPrompt(false);
        await registerToken();
      } else if (isIosPwa() && permission === 'default') {
        // iOS PWA: can't request permission without user gesture — show prompt button
        setNeedsPrompt(true);
      } else {
        await registerToken();
      }

      unsubscribe = onForegroundMessage((payload) => {
        if (payload.title) {
          toast(payload.title, { description: payload.body });
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const permission = getNotificationPermission();
        if (permission === 'granted') registerToken();
      }
    }

    setup();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [registerToken]);

  return { needsPrompt, enableNotifications };
}
