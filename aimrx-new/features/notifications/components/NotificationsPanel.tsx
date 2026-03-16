"use client";

import { NotificationBell } from "./NotificationBell";
import { NotificationPanelContent } from "./NotificationPanelContent";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function NotificationsPanel() {
  return (
    <div data-testid="notifications-panel">
      <Popover>
        <PopoverTrigger asChild>
          <NotificationBell />
        </PopoverTrigger>
        <PopoverContent
          className="w-[400px] p-0 rounded-xl border border-gray-200 shadow-xl"
          align="end"
          sideOffset={8}
        >
          <NotificationPanelContent />
        </PopoverContent>
      </Popover>
    </div>
  );
}
