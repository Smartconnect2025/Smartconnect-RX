import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/tailwind-utils";

interface InteractiveTagProps {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "destructive";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  hoverEffect?: "scale" | "glow" | "none";
}

export const InteractiveTag = ({
  children,
  isActive = false,
  onClick,
  variant = "outline",
  size = "sm",
  disabled = false,
  className,
  hoverEffect = "scale",
}: InteractiveTagProps) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const getHoverClasses = () => {
    if (disabled || hoverEffect === "none") return "";

    switch (hoverEffect) {
      case "scale":
        return "hover:scale-105 transition-transform duration-150";
      case "glow":
        return "hover:shadow-md transition-shadow duration-150";
      default:
        return "";
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-1";
      case "md":
        return "text-sm px-3 py-1.5";
      case "lg":
        return "text-base px-4 py-2";
      default:
        return "text-xs px-2 py-1";
    }
  };

  return (
    <Badge
      variant={isActive ? "default" : variant}
      className={cn(
        "cursor-pointer transition-colors border border-border",
        getSizeClasses(),
        getHoverClasses(),
        isActive && "bg-primary text-primary-foreground",
        !isActive && "hover:bg-primary/10",
        disabled &&
          "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none",
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </Badge>
  );
};

interface TagListProps {
  tags: string[];
  activeTags?: string[];
  onTagClick?: (tag: string) => void;
  maxTags?: number;
  tagProps?: Partial<InteractiveTagProps>;
  className?: string;
}

export const TagList = ({
  tags,
  activeTags = [],
  onTagClick,
  maxTags,
  tagProps,
  className,
}: TagListProps) => {
  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const remainingCount =
    maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayTags.map((tag) => (
        <InteractiveTag
          key={tag}
          className="whitespace-nowrap"
          isActive={activeTags.includes(tag)}
          onClick={() => onTagClick?.(tag)}
          {...tagProps}
        >
          {tag}
        </InteractiveTag>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
};
