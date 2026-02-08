// Browser notification utilities

/**
 * Check if notifications are enabled in localStorage
 */
function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('dashboard_notifications_enabled') === 'true'
}

/**
 * Show browser notification if enabled and permission granted
 */
export function showNotification(title: string, body: string): void {
  if (typeof window === 'undefined') return
  if (!isNotificationsEnabled()) return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  
  try {
    new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: 'opencode-dashboard' // Prevents duplicate notifications
    })
  } catch (err) {
    console.warn('[Notification] Failed to show:', err)
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied'
  if (!('Notification' in window)) return 'denied'
  
  return Notification.requestPermission()
}
