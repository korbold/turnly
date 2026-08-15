import api from '../client';
import { mapClientReservation } from '../mappers/client-reservation.mapper';
import type { ClientReservation } from '@/domain/entities/client-reservation';

export interface MagicLinkSession {
  token: string;
  user: { id: string; name: string; email: string; termsAcceptedAt: string | null };
  accountRestored: boolean;
}

/**
 * The customer-facing slice of the API. These routes are deliberately
 * tenant-less: a customer books with several businesses and sees them
 * all in one list, so no X-Tenant header is sent.
 */
export const clientPortalRepository = {
  async requestMagicLink(email: string): Promise<void> {
    await api.post('/auth/magic-link/request', { email });
  },

  async verifyMagicLink(token: string): Promise<MagicLinkSession> {
    const { data: res } = await api.post('/auth/magic-link/verify', { token });
    const d = res.data ?? res;
    return {
      token: String(d.token),
      user: {
        id: String(d.user?.id ?? ''),
        name: String(d.user?.name ?? ''),
        email: String(d.user?.email ?? ''),
        termsAcceptedAt: (d.user?.terms_accepted_at as string | null) ?? null,
      },
      accountRestored: Boolean(d.account_restored),
    };
  },

  async myReservations(status?: string): Promise<ClientReservation[]> {
    const { data: res } = await api.get('/client/reservations', {
      params: status ? { status } : undefined,
    });
    return ((res.data ?? []) as Array<Record<string, unknown>>).map(mapClientReservation);
  },

  async myReservation(id: string): Promise<ClientReservation> {
    const { data: res } = await api.get(`/client/reservations/${id}`);
    return mapClientReservation(res.data ?? res);
  },

  async cancelReservation(id: string, reason: string): Promise<void> {
    await api.patch(`/client/reservations/${id}/cancel`, { reason });
  },

  async deleteAccount(): Promise<void> {
    await api.delete('/auth/account');
  },
};
