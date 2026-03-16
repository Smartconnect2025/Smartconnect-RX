import { createClient } from "@core/supabase";

// Database types matching the schema
export interface DatabaseNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  critical: boolean;
  created_at: string;
  updated_at: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DatabaseNotificationAction {
  id: string;
  notification_id: string;
  label: string;
  action_type: string;
  action_data: Record<string, unknown> | null;
  display_order: number;
  created_at: string;
}

// Application types
export interface NotificationAction {
  id: string;
  label: string;
  actionType: string;
  actionData?: Record<string, unknown>;
  displayOrder: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  critical: boolean;
  createdAt: Date;
  updatedAt: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  actions: NotificationAction[];
}

// Input types for creating/updating notifications
export interface CreateNotificationData {
  user_id: string;
  type: string;
  title: string;
  body: string;
  critical?: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{
    label: string;
    action_type: string;
    action_data?: Record<string, unknown>;
    display_order?: number;
  }>;
}

export interface UpdateNotificationData {
  title?: string;
  body?: string;
  read?: boolean;
  critical?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new notification with optional actions
 */
export async function createNotification(
  data: CreateNotificationData,
): Promise<Notification> {
  try {
    const supabase = createClient();

    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        body: data.body,
        critical: data.critical || false,
        related_entity_type: data.related_entity_type,
        related_entity_id: data.related_entity_id,
        metadata: data.metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Create actions if provided
    let actions: DatabaseNotificationAction[] = [];
    if (data.actions && data.actions.length > 0) {
      const { data: createdActions, error: actionsError } = await supabase
        .from("notification_actions")
        .insert(
          data.actions.map((action, index) => ({
            notification_id: notification.id,
            label: action.label,
            action_type: action.action_type,
            action_data: action.action_data,
            display_order: action.display_order || index,
          })),
        )
        .select();

      if (actionsError) throw actionsError;
      actions = createdActions;
    }

    return transformDatabaseNotificationToNotification(notification, actions);
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Update an existing notification
 */
export async function updateNotification(
  notificationId: string,
  data: UpdateNotificationData,
): Promise<Notification> {
  try {
    const supabase = createClient();

    const { data: notification, error } = await supabase
      .from("notifications")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .select()
      .single();

    if (error) throw error;

    // Fetch actions for the updated notification
    const { data: actions, error: actionsError } = await supabase
      .from("notification_actions")
      .select("*")
      .eq("notification_id", notificationId)
      .order("display_order");

    if (actionsError) throw actionsError;

    return transformDatabaseNotificationToNotification(
      notification,
      actions || [],
    );
  } catch (error) {
    console.error("Error updating notification:", error);
    throw error;
  }
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(
  userId: string,
): Promise<Notification[]> {
  try {
    const supabase = createClient();

    // First get all notifications for the user
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!notifications || notifications.length === 0) {
      return [];
    }

    // Get all actions for these notifications
    const notificationIds = notifications.map((n) => n.id);
    const { data: actions, error: actionsError } = await supabase
      .from("notification_actions")
      .select("*")
      .in("notification_id", notificationIds)
      .order("display_order");

    if (actionsError) throw actionsError;

    // Group actions by notification_id
    const actionsByNotificationId = (actions || []).reduce(
      (acc, action) => {
        if (!acc[action.notification_id]) {
          acc[action.notification_id] = [];
        }
        acc[action.notification_id].push(action);
        return acc;
      },
      {} as Record<string, DatabaseNotificationAction[]>,
    );

    // Transform notifications with their actions
    return notifications.map((notification) =>
      transformDatabaseNotificationToNotification(
        notification,
        actionsByNotificationId[notification.id] || [],
      ),
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Get notifications filtered by type
 */
export async function getUserNotificationsByType(
  userId: string,
  type: string,
): Promise<Notification[]> {
  try {
    const supabase = createClient();

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("type", type)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!notifications || notifications.length === 0) {
      return [];
    }

    // Get all actions for these notifications
    const notificationIds = notifications.map((n) => n.id);
    const { data: actions, error: actionsError } = await supabase
      .from("notification_actions")
      .select("*")
      .in("notification_id", notificationIds)
      .order("display_order");

    if (actionsError) throw actionsError;

    // Group actions by notification_id
    const actionsByNotificationId = (actions || []).reduce(
      (acc, action) => {
        if (!acc[action.notification_id]) {
          acc[action.notification_id] = [];
        }
        acc[action.notification_id].push(action);
        return acc;
      },
      {} as Record<string, DatabaseNotificationAction[]>,
    );

    return notifications.map((notification) =>
      transformDatabaseNotificationToNotification(
        notification,
        actionsByNotificationId[notification.id] || [],
      ),
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  userId: string,
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  try {
    const supabase = createClient();

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
): Promise<void> {
  try {
    const supabase = createClient();

    // Actions will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Transform database notification to application notification format
 */
function transformDatabaseNotificationToNotification(
  dbNotification: DatabaseNotification,
  dbActions: DatabaseNotificationAction[],
): Notification {
  return {
    id: dbNotification.id,
    type: dbNotification.type,
    title: dbNotification.title,
    body: dbNotification.body,
    read: dbNotification.read,
    critical: dbNotification.critical,
    createdAt: new Date(dbNotification.created_at),
    updatedAt: new Date(dbNotification.updated_at),
    relatedEntityType: dbNotification.related_entity_type || undefined,
    relatedEntityId: dbNotification.related_entity_id || undefined,
    metadata: dbNotification.metadata || undefined,
    actions: dbActions.map((action) => ({
      id: action.id,
      label: action.label,
      actionType: action.action_type,
      actionData: action.action_data || undefined,
      displayOrder: action.display_order,
    })),
  };
}

/**
 * Create a test notification for development/testing purposes
 */
export async function createTestNotification(
  userId: string,
  type: "vital" | "symptom" | "appointment" | "chat" | "order" = "vital",
): Promise<Notification> {
  const testData = {
    vital: {
      title: "Test Vital Alert",
      body: "This is a test vital sign notification",
      critical: true,
      actions: [
        { label: "Review", action_type: "review" },
        { label: "Message Provider", action_type: "message" },
      ],
    },
    symptom: {
      title: "Test Symptom Report",
      body: "This is a test symptom notification",
      critical: false,
      actions: [
        { label: "Review", action_type: "review" },
        { label: "Call Patient", action_type: "call" },
      ],
    },
    appointment: {
      title: "Test Appointment Reminder",
      body: "This is a test appointment notification",
      critical: false,
      actions: [{ label: "Reschedule", action_type: "reschedule" }],
    },
    chat: {
      title: "Test Message",
      body: "This is a test chat notification",
      critical: false,
      actions: [{ label: "Reply", action_type: "reply" }],
    },
    order: {
      title: "Test Order Update",
      body: "This is a test order notification",
      critical: false,
      actions: [{ label: "Track Order", action_type: "track" }],
    },
  };

  const data = testData[type];

  return createNotification({
    user_id: userId,
    type,
    title: data.title,
    body: data.body,
    critical: data.critical,
    metadata: {
      test: true,
      timestamp: new Date().toISOString(),
    },
    actions: data.actions,
  });
}
