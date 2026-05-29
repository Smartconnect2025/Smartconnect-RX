'use client';

import { NotificationProvider } from '../context/NotificationContext';

interface ClientNotificationProviderProps {
  children: React.ReactNode;
}

export function ClientNotificationProvider({ children }: ClientNotificationProviderProps) {
  return (
    <NotificationProvider>
      {children}
    </NotificationProvider>
  );
}