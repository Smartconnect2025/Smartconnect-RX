"use client";

import { useUser } from "@core/auth";
import { Eye } from "lucide-react";

export function DemoBanner() {
  const { isDemo } = useUser();

  if (!isDemo) return null;

  return (
    <div
      data-testid="banner-demo-account"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
    >
      <Eye className="h-4 w-4" />
      <span>Demo Account — View Only</span>
    </div>
  );
}
