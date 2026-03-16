"use client";

import { useState } from "react";
import { X, Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PopoverClose } from "@/components/ui/popover";
import { NotificationItem } from "./NotificationItem";
import { useNotificationContext } from "../context/NotificationContext";
import { transformNotificationForUI } from "../utils/transformNotification";

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "system", label: "System" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export const NotificationPanelContent = () => {
  const { notifications, loading, unreadCount, markAllAsRead } =
    useNotificationContext();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !n.read;
    return n.type === activeFilter;
  });

  return (
    <div
      className="flex flex-col h-[480px] rounded-lg overflow-hidden bg-white"
      data-testid="notification-panel"
    >
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" data-testid="text-unread-count">
                {unreadCount}
              </span>
            )}
          </div>
          <PopoverClose className="rounded-full h-7 w-7 flex items-center justify-center hover:bg-gray-100 transition-colors" data-testid="button-close-notifications">
            <X className="h-4 w-4 text-gray-400" />
            <span className="sr-only">Close</span>
          </PopoverClose>
        </div>

        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                activeFilter === tab.key
                  ? "bg-[#1E3A8A] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
              data-testid={`button-filter-${tab.key}`}
            >
              {tab.label}
              {tab.key === "unread" && unreadCount > 0 && (
                <span className="ml-1 text-[10px]">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="notification-loading">
              <Loader2 className="h-8 w-8 text-[#1E3A8A] animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6" data-testid="notification-empty">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                {activeFilter === "unread" ? (
                  <CheckCheck className="h-7 w-7 text-green-400" />
                ) : (
                  <BellOff className="h-7 w-7 text-gray-300" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {activeFilter === "unread"
                  ? "You're all caught up!"
                  : "No notifications yet"}
              </p>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[200px]">
                {activeFilter === "unread"
                  ? "All notifications have been read."
                  : "Notifications about orders, payments, and updates will appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={transformNotificationForUI(notification)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {notifications.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-[11px] text-gray-400">
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5 text-[#1E3A8A] hover:text-[#1E3A8A] hover:bg-blue-50 font-medium"
              onClick={markAllAsRead}
              disabled={loading}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
