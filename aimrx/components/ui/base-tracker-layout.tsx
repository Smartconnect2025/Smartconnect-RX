"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";

export interface BaseTrackerLayoutProps {
  title: string;
  description?: string;
  onBack: () => void;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export const BaseTrackerLayout: React.FC<BaseTrackerLayoutProps> = ({
  title,
  description,
  onBack,
  children,
  className,
  headerActions,
}) => {
  return (
    <div className={cn("container mx-auto max-w-5xl py-16 px-4", className)}>
      {/* Header with back button and consistent title styling */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2 hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Go back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          {headerActions && (
            <div className="flex items-center space-x-2">{headerActions}</div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="space-y-6">{children}</div>
    </div>
  );
};
