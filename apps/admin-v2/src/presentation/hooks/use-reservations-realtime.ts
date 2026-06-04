'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/presentation/hooks/use-auth';
import { getEcho } from '@/lib/echo/client';

interface ReservationUpdatedPayload {
  id: string;
  tenantId: string;
  clientId: string | null;
  status: string;
  scheduledAt: string | null;
}

/**
 * Subscribes the current staff session to `private-tenant.{id}` and
 * invalidates the reservation list + the specific reservation detail
 * whenever the backend broadcasts `reservation.updated`. Mount once at
 * an app shell level — repeat mounts share the same Echo instance.
 */
export function useReservationsRealtime() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenant?.id ?? null;

  useEffect(() => {
    if (!tenantId) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.private(`tenant.${tenantId}`);
    channel.listen('.reservation.updated', (payload: ReservationUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      if (payload?.id) {
        queryClient.invalidateQueries({ queryKey: ['reservation', payload.id] });
        queryClient.invalidateQueries({ queryKey: ['reservation-items', payload.id] });
        queryClient.invalidateQueries({ queryKey: ['reservation-changes', payload.id] });
      }
    });

    return () => {
      echo.leave(`tenant.${tenantId}`);
    };
  }, [tenantId, queryClient]);
}
