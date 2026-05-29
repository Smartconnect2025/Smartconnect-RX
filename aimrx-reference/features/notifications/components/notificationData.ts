import React from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Package,
  Target,
  Bell,
  LucideIcon,
} from "lucide-react";
import { create } from "zustand";
import { useNotifications } from "../hooks/useNotifications";
import type { Notification } from "../services/notificationService";

// Icon mapping for notification types
const getIconForNotificationType = (type: string) => {
  switch (type) {
    case "vital":
      return Activity;
    case "symptom":
      return AlertTriangle;
    case "appointment":
      return Calendar;
    case "chat":
      return MessageSquare;
    case "order":
      return Package;
    case "goal":
      return Target;
    default:
      return Bell;
  }
};

// Transform database notification to legacy format for backward compatibility
const transformNotificationForLegacyComponents = (
  notification: Notification,
) => {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    time: formatTimeAgo(notification.createdAt),
    read: notification.read,
    critical: notification.critical,
    icon: getIconForNotificationType(notification.type),
    actions: notification.actions.map((action) => ({
      label: action.label,
      action: () => {
        // Stub action - these will be implemented later
      },
    })),
  };
};

// Helper function to format time ago
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) {
    return "Just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
};

// Legacy interface for backward compatibility
interface LegacyNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  critical: boolean;
  icon: LucideIcon;
  actions: Array<{
    label: string;
    action: () => void;
  }>;
}

// Create a Zustand store that bridges to the new notification system
interface NotificationState {
  notifications: LegacyNotification[];
  loading: boolean;
  setNotifications: (notifications: Notification[]) => void;
  setLoading: (loading: boolean) => void;
  markAllAsRead: () => Promise<void>;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,

  setNotifications: (notifications: Notification[]) => {
    const transformedNotifications = notifications.map(
      transformNotificationForLegacyComponents,
    );
    set({ notifications: transformedNotifications });
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  markAllAsRead: async () => {
    // This will be overridden by useNotificationStoreSync
    // Default implementation for fallback
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    }));
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },
}));

// Hook to sync the store with the notification service
export const useNotificationStoreSync = () => {
  const {
    notifications,
    loading,
    markAllAsRead: serviceMarkAllAsRead,
  } = useNotifications();
  const { setNotifications, setLoading } = useNotificationStore();

  // Sync notifications from service to store
  React.useEffect(() => {
    setNotifications(notifications);
  }, [notifications, setNotifications]);

  // Sync loading state
  React.useEffect(() => {
    setLoading(loading);
  }, [loading, setLoading]);

  // Override the store's markAllAsRead to use the service
  React.useEffect(() => {
    useNotificationStore.setState({
      markAllAsRead: serviceMarkAllAsRead,
    });
  }, [serviceMarkAllAsRead]);
};

// Get the count of unread notifications
export const getUnreadCount = () =>
  useNotificationStore.getState().getUnreadCount();

// Re-export types for convenience
export type { Notification } from "../types";
export { NotificationTypes, ActionTypes } from "../types";
