// Import database schema types
import type {
  Notification as DBNotification,
  NotificationAction as DBNotificationAction,
} from "@/core/database/schema";

// Frontend NotificationAction interface extending database schema with camelCase compatibility
export interface NotificationAction
  extends Omit<
    DBNotificationAction,
    | "created_at"
    | "action_type"
    | "action_data"
    | "display_order"
    | "notification_id"
  > {
  actionType: string; // camelCase for frontend compatibility
  action_type: string; // Keep snake_case for database compatibility
  actionData?: Record<string, unknown>; // camelCase for frontend compatibility
  action_data?: Record<string, unknown>; // Keep snake_case for database compatibility
  displayOrder: number; // camelCase for frontend compatibility
  display_order: number; // Keep snake_case for database compatibility
  notificationId: string; // camelCase for frontend compatibility
  notification_id: string; // Keep snake_case for database compatibility
  createdAt: Date; // camelCase for frontend compatibility
  created_at: Date; // Keep snake_case for database compatibility
}

// Frontend Notification interface extending database schema with proper date handling and joined actions
export interface Notification
  extends Omit<
    DBNotification,
    | "created_at"
    | "updated_at"
    | "related_entity_type"
    | "related_entity_id"
    | "user_id"
  > {
  createdAt: Date; // camelCase for frontend compatibility
  created_at: Date; // Keep snake_case for database compatibility
  updatedAt: Date; // camelCase for frontend compatibility
  updated_at: Date; // Keep snake_case for database compatibility
  relatedEntityType?: string; // camelCase for frontend compatibility
  related_entity_type?: string; // Keep snake_case for database compatibility
  relatedEntityId?: string; // camelCase for frontend compatibility
  related_entity_id?: string; // Keep snake_case for database compatibility
  userId: string; // camelCase for frontend compatibility
  user_id: string; // Keep snake_case for database compatibility
  actions: NotificationAction[]; // Joined actions from notification_actions table
}

// Notification types enum
export const NotificationTypes = {
  VITAL: "vital",
  SYMPTOM: "symptom",
  APPOINTMENT: "appointment",
  CHAT: "chat",
  ORDER: "order",
  GOAL: "goal",
  SYSTEM: "system",
} as const;

export type NotificationType =
  (typeof NotificationTypes)[keyof typeof NotificationTypes];

// Action types enum
export const ActionTypes = {
  REVIEW: "review",
  MESSAGE: "message",
  CALL: "call",
  REPLY: "reply",
  RESCHEDULE: "reschedule",
  CANCEL: "cancel",
  ARCHIVE: "archive",
  TRACK: "track",
  SUPPORT: "support",
} as const;

export type ActionType = (typeof ActionTypes)[keyof typeof ActionTypes];

// Filter options for notifications
export type NotificationFilter = "all" | NotificationType;

// Database operation types (re-import for CRUD operations)
export type {
  InsertNotification as CreateNotificationData,
  InsertNotificationAction as CreateNotificationActionData,
  UpdateNotification as UpdateNotificationData,
  UpdateNotificationAction as UpdateNotificationActionData,
} from "@/core/database/schema";
