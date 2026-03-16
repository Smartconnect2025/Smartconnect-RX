"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/utils/tailwind-utils";

export interface TrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  className?: string;
  size?: "default" | "large" | "fullscreen";
}

export const TrackerModal: React.FC<TrackerModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footerActions,
  className,
  size = "default",
}) => {
  const sizeClasses = {
    default: "max-w-md",
    large: "max-w-2xl",
    fullscreen: "max-w-[95vw] max-h-[95vh] w-full h-full",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          size === "fullscreen" && "sm:max-w-[95vw] sm:max-h-[95vh]",
          "border-border",
          className,
        )}
        hideClose={true}
      >
        {/* Custom header with close button */}
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer actions */}
        {footerActions && (
          <div className="flex items-center justify-end space-x-2 pt-4">
            {footerActions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
