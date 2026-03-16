import {
  Activity,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Package,
  Target,
  Bell,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { Notification } from "../services/notificationService";

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
    case "payment":
      return CreditCard;
    case "shipping":
      return Truck;
    case "approval":
      return CheckCircle;
    case "processing":
      return Clock;
    case "goal":
      return Target;
    default:
      return Bell;
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000,
  );

  if (diffInSeconds < 30) {
    return "Just now";
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
};

export const transformNotificationForUI = (notification: Notification) => {
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
        if (action.actionData) {
          const data = action.actionData as Record<string, string>;
          if (data.url) {
            window.location.href = data.url;
          } else if (data.prescriptionId) {
            window.location.href = `/prescriptions?highlight=${data.prescriptionId}`;
          }
        }
      },
    })),
  };
};
