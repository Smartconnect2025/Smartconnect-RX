import React from "react";
import { cn } from "@/utils/tailwind-utils";

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
  minItemWidth?: string;
}

export const ResponsiveGrid = ({
  children,
  columns = { sm: 1, md: 2, lg: 3, xl: 3 },
  gap = 6,
  className,
  minItemWidth,
}: ResponsiveGridProps) => {
  const gridClasses = cn(
    "grid",
    `gap-${gap}`,
    minItemWidth && `grid-cols-[repeat(auto-fit,minmax(${minItemWidth},1fr))]`,
    !minItemWidth && [
      columns.sm && `grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`,
    ],
    className
  );

  return <div className={gridClasses}>{children}</div>;
};

export const GridPresets = {
  cards: { sm: 1, md: 2, lg: 3 },
  wideCards: { sm: 1, md: 2, lg: 2 },
  dense: { sm: 2, md: 3, lg: 4 },
  list: { sm: 1, md: 1, lg: 2 },
} as const;
