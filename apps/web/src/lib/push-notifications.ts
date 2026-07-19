// Wraps the browser Notification API to show OS-level system notifications
// for real-time events (e.g. new in-app notifications) while the PWA is open.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Requests permission to show system notifications if not already decided. */
export function requestNotificationPermission(): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/**
 * Shows a system notification via the service worker (so it works even when
 * the tab isn't focused). Falls back to the plain Notification API if no
 * service worker is registered. No-ops if permission hasn't been granted.
 */
export async function showSystemNotification(
  title: string,
  options?: NotificationOptions,
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  // Skip while the page is focused — the in-app UI already reflects the update.
  if (document.hasFocus()) return;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    }

    new Notification(title, options);
  } catch (err) {
    console.error('Failed to show system notification', err);
  }
}
