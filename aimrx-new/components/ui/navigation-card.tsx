"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/tailwind-utils";

export interface NavigationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  className?: string;
  variant?: "default" | "large";
}

export const NavigationCard: React.FC<NavigationCardProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  className,
  variant = "default",
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-6 text-left transition-all hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        variant === "large" && "col-span-2 row-span-1",
        className,
      )}
    >
      <div className="flex items-start space-x-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
};
