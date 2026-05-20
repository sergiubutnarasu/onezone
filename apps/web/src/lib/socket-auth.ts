import { Socket } from 'socket.io-client';
import { API_BASE } from './http-client';

let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * Attaches a listener to the socket's 'error' event. When the server rejects
 * the connection as Unauthorized, it refreshes the access token so the next
 * socket.io auto-reconnect attempt uses the new cookie.
 */
export function attachSocketAuthRefresh(socket: Socket): void {
  socket.on('error', (err: { message?: string }) => {
    if (err?.message === 'Unauthorized') {
      tryRefresh().then((ok) => {
        if (!ok && typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }).catch(() => {});
    }
  });
}
