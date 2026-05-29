"use client";

import React, { createContext, useContext } from "react";
import { useNotifications } from "../hooks/useNotifications";
import type {
  CreateNotificationData,
  UpdateNotificationData,
  Notification,
} from "../services/notificationService";

interface NotificationContextType {
  // State
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;

  // Actions
  loadNotifications: () => Promise<void>;
  loadNotificationsByType: (type: string) => Promise<Notification[]>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotificationById: (notificationId: string) => Promise<void>;
  createNewNotification: (
    data: Omit<CreateNotificationData, "user_id">,
  ) => Promise<Notification | null>;
  updateNotificationById: (
    notificationId: string,
    data: UpdateNotificationData,
  ) => Promise<Notification>;
  refreshUnreadCount: () => Promise<number>;
  refreshNotifications: () => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // Single instance of useNotifications hook for the entire app
  const notificationState = useNotifications();

  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider",
    );
  }
  return context;
}
