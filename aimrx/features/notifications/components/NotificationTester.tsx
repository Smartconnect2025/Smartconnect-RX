"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNotificationContext } from "../context/NotificationContext";
import { createTestNotification } from "../services/notificationService";
import { useUser } from "@core/auth";
import {
  Activity,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Package,
  RefreshCw,
  Trash2,
  CheckCheck,
} from "lucide-react";

export function NotificationTester() {
  const { user } = useUser();
  const {
    notifications,
    loading,
    unreadCount,
    markAllAsRead,
    deleteNotificationById,
    refreshNotifications,
  } = useNotificationContext();

  const handleCreateTestNotification = async (
    type: "vital" | "symptom" | "appointment" | "chat" | "order",
  ) => {
    if (!user?.id) {
      toast.error("You must be logged in to create test notifications");
      return;
    }

    try {
      await createTestNotification(user.id, type);
      toast.success(`Test ${type} notification created!`);
    } catch (error) {
      console.error("Error creating test notification:", error);
      toast.error("Failed to create test notification");
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotificationById(id);
    } catch {
      // Error handling is done in the hook
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "vital":
        return <Activity className="h-4 w-4 text-red-500" />;
      case "symptom":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "appointment":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "chat":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "order":
        return <Package className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!user) {
    return (
      <Card className="w-full max-w-5xl mx-auto px-4 ">
        <CardHeader>
          <CardTitle>Notification Tester</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please log in to test notifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Test Controls */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Notification Tester
            <Badge variant="secondary">{unreadCount} unread</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateTestNotification("vital")}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <Activity className="h-4 w-4 text-red-500" />
              Vital Alert
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateTestNotification("symptom")}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Symptom
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateTestNotification("appointment")}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <Calendar className="h-4 w-4 text-blue-500" />
              Appointment
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateTestNotification("chat")}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <MessageSquare className="h-4 w-4 text-green-500" />
              Chat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreateTestNotification("order")}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <Package className="h-4 w-4 text-purple-500" />
              Order
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshNotifications}
              disabled={loading}
              className="flex items-center gap-2 border border-border"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={markAllAsRead}
              disabled={loading || unreadCount === 0}
              className="flex items-center gap-2 border border-border"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Real-time Testing:</strong> Open this page in multiple
              tabs to see notifications appear instantly across all tabs.
            </p>
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
            <p>
              <strong>Total Notifications:</strong> {notifications.length}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Current Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications yet. Create some test notifications above!
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border border-border ${
                    notification.read ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getIconForType(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4
                          className={`text-sm font-medium ${!notification.read ? "font-semibold" : ""}`}
                        >
                          {notification.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className="text-xs border border-border"
                          >
                            {notification.type}
                          </Badge>
                          {notification.critical && (
                            <Badge
                              variant="destructive"
                              className="text-xs border border-border"
                            >
                              Critical
                            </Badge>
                          )}
                          {!notification.read && (
                            <Badge variant="default" className="text-xs">
                              Unread
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {notification.createdAt.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleDeleteNotification(notification.id)
                        }
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {notification.actions.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {notification.actions.map((action) => (
                          <Button
                            key={action.id}
                            size="sm"
                            variant="outline"
                            className="text-xs h-6 px-2 border border-border"
                            onClick={() => {
                              toast(`Action: ${action.label}`, {
                                description: `Action type: ${action.actionType}`,
                              });
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
