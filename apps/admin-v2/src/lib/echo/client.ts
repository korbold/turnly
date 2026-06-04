'use client';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { authStorage } from '@/infrastructure/storage/auth-storage';

// Reverb compatible with Pusher protocol, so we reuse pusher-js as transport.
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<'reverb'> | undefined;
  }
}

let echoInstance: Echo<'reverb'> | null = null;

function authEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  // baseURL ends in /api/v1 — broadcasting auth lives at /api/broadcasting/auth
  return base.replace(/\/v1\/?$/, '') + '/broadcasting/auth';
}

export function getEcho(): Echo<'reverb'> | null {
  if (typeof window === 'undefined') return null;
  if (echoInstance) return echoInstance;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST;
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);
  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http';
  if (!key || !host) return null;

  window.Pusher = Pusher;
  echoInstance = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (err: Error | null, data: unknown) => void) => {
        const token = authStorage.getToken();
        const tenantSlug = authStorage.getTenantSlug();
        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (tenantSlug) headers['X-Tenant'] = tenantSlug;

        fetch(authEndpoint(), {
          method: 'POST',
          headers,
          body: `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channel.name)}`,
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`Broadcast auth failed: ${res.status}`);
            return res.json();
          })
          .then((data) => callback(null, data))
          .catch((err: Error) => callback(err, null));
      },
    }),
  });

  window.Echo = echoInstance;
  return echoInstance;
}

export function disconnectEcho() {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
    if (typeof window !== 'undefined') window.Echo = undefined;
  }
}
