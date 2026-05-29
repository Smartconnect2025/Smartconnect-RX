"use client";
import { useUser } from "@core/auth";
import { createClient } from "@core/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createNotification,
  deleteNotification,
  getUnreadNotificationCount,
  getUserNotifications,
  getUserNotificationsByType,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotification,
  type CreateNotificationData,
  type DatabaseNotification,
  type DatabaseNotificationAction,
  type Notification,
  type UpdateNotificationData,
} from "../services/notificationService";

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();
  const initialLoadComplete = useRef(false);
  /**
   * Load all notifications for the current user
   */
  const loadNotifications = useCallback(async () => {
    if (!user?.id || loading) {
      return;
    }

    setLoading(true);
    try {
      const userNotifications = await getUserNotifications(user.id);
      setNotifications(userNotifications);

      // Update unread count
      const count = userNotifications.filter((n) => !n.read).length;
      setUnreadCount(count);
    } catch {
      toast.error("Failed to load notifications");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, loading]);

  /**
   * Load notifications filtered by type
   */
  const loadNotificationsByType = useCallback(
    async (type: string) => {
      if (!user?.id) {
        return [];
      }

      setLoading(true);
      try {
        const filteredNotifications = await getUserNotificationsByType(
          user.id,
          type,
        );
        return filteredNotifications;
      } catch {
        toast.error("Failed to load filtered notifications");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    setLoading(true);
    try {
      await markNotificationAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      );

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));

      toast.success("Notification marked as read");
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark notification as read");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) {
      toast.error("You must be logged in to mark notifications as read");
      return;
    }

    setLoading(true);
    try {
      await markAllNotificationsAsRead(user.id);

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read: true,
        })),
      );

      // Reset unread count
      setUnreadCount(0);

      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      toast.error("Failed to mark all notifications as read");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Delete a notification
   */
  const deleteNotificationById = useCallback(
    async (notificationId: string) => {
      setLoading(true);
      try {
        await deleteNotification(notificationId);

        // Update local state
        const deletedNotification = notifications.find(
          (n) => n.id === notificationId,
        );
        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== notificationId),
        );

        // Update unread count if deleted notification was unread
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        toast.success("Notification deleted");
      } catch (error) {
        console.error("Error deleting notification:", error);
        toast.error("Failed to delete notification");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [notifications],
  );

  /**
   * Create a new notification
   */
  const createNewNotification = useCallback(
    async (data: Omit<CreateNotificationData, "user_id">) => {
      if (!user?.id) {
        toast.error("You must be logged in to create notifications");
        return null;
      }

      setLoading(true);
      try {
        const notification = await createNotification({
          ...data,
          user_id: user.id,
        });

        // Add to local state
        setNotifications((prev) => [notification, ...prev]);

        // Update unread count if notification is unread
        if (!notification.read) {
          setUnreadCount((prev) => prev + 1);
        }

        toast.success("Notification created successfully");
        return notification;
      } catch (error) {
        console.error("Error creating notification:", error);
        toast.error("Failed to create notification");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  /**
   * Update an existing notification
   */
  const updateNotificationById = useCallback(
    async (notificationId: string, data: UpdateNotificationData) => {
      setLoading(true);
      try {
        const updatedNotification = await updateNotification(
          notificationId,
          data,
        );

        // Update local state
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? updatedNotification
              : notification,
          ),
        );

        // Update unread count if read status changed
        if (data.read !== undefined) {
          const originalNotification = notifications.find(
            (n) => n.id === notificationId,
          );
          if (originalNotification) {
            if (!originalNotification.read && data.read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            } else if (originalNotification.read && !data.read) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }

        toast.success("Notification updated successfully");
        return updatedNotification;
      } catch (error) {
        console.error("Error updating notification:", error);
        toast.error("Failed to update notification");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [notifications],
  );

  /**
   * Get current unread count
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
      return count;
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return 0;
    }
  }, [user?.id]);

  /**
   * Refresh notifications list
   */
  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  /**
   * Clear notifications list
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  /**
   * Set up real-time subscriptions for notifications
   */
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user?.id) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Create new subscription channel
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Handle new notification
            const newNotification = payload.new as DatabaseNotification;

            // Fetch actions for the new notification
            const { data: actions } = await supabase
              .from("notification_actions")
              .select("*")
              .eq("notification_id", newNotification.id)
              .order("display_order");

            // Transform and add to local state
            const transformedNotification = {
              id: newNotification.id,
              type: newNotification.type,
              title: newNotification.title,
              body: newNotification.body,
              read: newNotification.read,
              critical: newNotification.critical,
              createdAt: new Date(newNotification.created_at),
              updatedAt: new Date(newNotification.updated_at),
              relatedEntityType:
                newNotification.related_entity_type || undefined,
              relatedEntityId: newNotification.related_entity_id || undefined,
              metadata: newNotification.metadata || undefined,
              actions: (actions || []).map(
                (action: DatabaseNotificationAction) => ({
                  id: action.id,
                  label: action.label,
                  actionType: action.action_type,
                  actionData: action.action_data || undefined,
                  displayOrder: action.display_order,
                }),
              ),
            };

            setNotifications((prev) => [transformedNotification, ...prev]);

            // Update unread count if notification is unread
            if (!newNotification.read) {
              setUnreadCount((prev) => prev + 1);

              // Show toast for new notification
              toast(newNotification.title, {
                description: newNotification.body,
                className: newNotification.critical
                  ? "bg-red-50 border-red-200"
                  : undefined,
              });
            }
          } else if (payload.eventType === "UPDATE") {
            // Handle notification update
            const updatedNotification = payload.new as DatabaseNotification;

            setNotifications((prev) =>
              prev.map((notification) => {
                if (notification.id === updatedNotification.id) {
                  const wasUnread = !notification.read;
                  const isNowRead = updatedNotification.read;

                  // Update unread count if read status changed
                  if (wasUnread && isNowRead) {
                    setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
                  } else if (!wasUnread && !isNowRead) {
                    setUnreadCount((prevCount) => prevCount + 1);
                  }

                  return {
                    ...notification,
                    type: updatedNotification.type,
                    title: updatedNotification.title,
                    body: updatedNotification.body,
                    read: updatedNotification.read,
                    critical: updatedNotification.critical,
                    updatedAt: new Date(updatedNotification.updated_at),
                    relatedEntityType:
                      updatedNotification.related_entity_type || undefined,
                    relatedEntityId:
                      updatedNotification.related_entity_id || undefined,
                    metadata: updatedNotification.metadata || undefined,
                  };
                }
                return notification;
              }),
            );
          } else if (payload.eventType === "DELETE") {
            // Handle notification deletion
            const deletedNotification = payload.old as DatabaseNotification;

            setNotifications((prev) => {
              const notification = prev.find(
                (n) => n.id === deletedNotification.id,
              );

              // Update unread count if deleted notification was unread
              if (notification && !notification.read) {
                setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
              }

              return prev.filter((n) => n.id !== deletedNotification.id);
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_actions",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            // Handle new action
            const newAction = payload.new as DatabaseNotificationAction;

            setNotifications((prev) =>
              prev.map((notification) => {
                if (notification.id === newAction.notification_id) {
                  const updatedActions = [
                    ...notification.actions,
                    {
                      id: newAction.id,
                      label: newAction.label,
                      actionType: newAction.action_type,
                      actionData: newAction.action_data || undefined,
                      displayOrder: newAction.display_order,
                    },
                  ].sort((a, b) => a.displayOrder - b.displayOrder);

                  return { ...notification, actions: updatedActions };
                }
                return notification;
              }),
            );
          } else if (payload.eventType === "UPDATE") {
            // Handle action update
            const updatedAction = payload.new as DatabaseNotificationAction;

            setNotifications((prev) =>
              prev.map((notification) => {
                if (notification.id === updatedAction.notification_id) {
                  const updatedActions = notification.actions
                    .map((action) =>
                      action.id === updatedAction.id
                        ? {
                            ...action,
                            label: updatedAction.label,
                            actionType: updatedAction.action_type,
                            actionData: updatedAction.action_data || undefined,
                            displayOrder: updatedAction.display_order,
                          }
                        : action,
                    )
                    .sort((a, b) => a.displayOrder - b.displayOrder);

                  return { ...notification, actions: updatedActions };
                }
                return notification;
              }),
            );
          } else if (payload.eventType === "DELETE") {
            // Handle action deletion
            const deletedAction = payload.old as DatabaseNotificationAction;

            setNotifications((prev) =>
              prev.map((notification) => {
                if (notification.id === deletedAction.notification_id) {
                  const updatedActions = notification.actions.filter(
                    (action) => action.id !== deletedAction.id,
                  );
                  return { ...notification, actions: updatedActions };
                }
                return notification;
              }),
            );
          }
        },
      )
      .subscribe(() => {});

    subscriptionRef.current = channel;
  }, [user?.id, supabase]);

  /**
   * Clean up real-time subscriptions
   */
  const cleanupSubscriptions = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  // Auto-load notifications and set up real-time subscriptions when user changes
  useEffect(() => {
    if (user?.id && !initialLoadComplete.current) {
      initialLoadComplete.current = true;
      loadNotifications();
      setupRealtimeSubscriptions();
    } else if (!user?.id) {
      cleanupSubscriptions();
      setNotifications([]);
      setUnreadCount(0);
      initialLoadComplete.current = false;
    }

    // Cleanup on unmount
    return () => {
      cleanupSubscriptions();
    };
  }, [
    user?.id,
    loadNotifications,
    setupRealtimeSubscriptions,
    cleanupSubscriptions,
  ]);

  return {
    // State
    notifications,
    loading,
    unreadCount,

    // Actions
    loadNotifications,
    loadNotificationsByType,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    createNewNotification,
    updateNotificationById,
    refreshUnreadCount,
    refreshNotifications,
    clearNotifications,
  };
}
