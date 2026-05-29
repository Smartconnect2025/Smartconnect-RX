// Main components
export { NotificationBell } from './components/NotificationBell';
export { NotificationPanel } from './components/NotificationPanel';
export { NotificationPanelContent } from './components/NotificationPanelContent';
export { NotificationItem } from './components/NotificationItem';
export { NotificationsPanel } from './components/NotificationsPanel';
export { NotificationTester } from './components/NotificationTester';
export { ClientNotificationProvider } from './components/ClientNotificationProvider';

// Context and Hooks
export { NotificationProvider, useNotificationContext } from './context/NotificationContext';
export { useNotifications } from './hooks/useNotifications';

// Services
export {
  createNotification,
  updateNotification,
  getUserNotifications,
  getUserNotificationsByType,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  createTestNotification,
  type CreateNotificationData,
  type UpdateNotificationData,
  type NotificationAction as ServiceNotificationAction,
  type Notification as ServiceNotification,
} from './services/notificationService';

// Types
export {
  type Notification,
  type NotificationAction,
  type NotificationType,
  type ActionType,
  type NotificationFilter,
  NotificationTypes,
  ActionTypes,
} from './types';

// Legacy store (for backward compatibility)
export {
  useNotificationStore,
  useNotificationStoreSync,
  getUnreadCount,
} from './components/notificationData';

// Component prop types
export type { NotificationItemProps } from './components/NotificationItem';