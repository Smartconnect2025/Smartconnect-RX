"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { useNotificationContext } from "../context/NotificationContext";

interface NotificationAction {
  label: string;
  action: () => void;
}

export interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    time: string;
    read: boolean;
    critical: boolean;
    icon: LucideIcon;
    actions: NotificationAction[];
  };
}

const typeColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  vital: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  symptom: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  appointment: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  chat: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  order: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500" },
  goal: { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-500" },
  system: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-500" },
};

export const NotificationItem = ({ notification }: NotificationItemProps) => {
  const { markAsRead } = useNotificationContext();
  const {
    id,
    title,
    body,
    time,
    read,
    critical,
    type,
    icon: Icon,
    actions,
  } = notification;

  const colors = typeColorMap[type] || typeColorMap.system;

  const handleClick = () => {
    if (!read) {
      markAsRead(id);
    }
  };

  return (
    <div
      className={`group relative mb-1 rounded-lg p-2.5 cursor-pointer transition-all duration-200 border ${
        read
          ? "bg-white border-transparent hover:bg-gray-50"
          : "bg-blue-50/40 border-blue-100 hover:bg-blue-50/60"
      }`}
      onClick={handleClick}
      data-testid={`notification-item-${id}`}
    >
      {!read && (
        <span className={`absolute top-3 left-1.5 w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      )}

      <div className="flex items-start gap-2.5 pl-2">
        <div
          className={`rounded-lg p-1.5 flex-shrink-0 ${colors.bg} ${colors.text}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <h4
              className={`text-xs leading-tight ${
                !read ? "font-semibold text-gray-900" : "font-medium text-gray-700"
              }`}
            >
              {title}
            </h4>
            {critical && (
              <Badge
                variant="destructive"
                className="h-4 px-1.5 text-[10px] font-semibold shrink-0"
              >
                Urgent
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {body}
          </p>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-400 font-medium">{time}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px] font-medium text-[#1E3A8A] hover:text-[#1E3A8A] hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                  data-testid={`button-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
