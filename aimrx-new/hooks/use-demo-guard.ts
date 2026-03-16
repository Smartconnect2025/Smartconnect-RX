"use client";

import { useUser } from "@core/auth";
import { toast } from "sonner";
import { useCallback } from "react";

export function useDemoGuard() {
  const { isDemo } = useUser();

  const guardAction = useCallback(
    (action: () => void) => {
      if (isDemo) {
        toast.error("Demo Account — View Only", {
          description:
            "This is a demo account. Contact us to get a full account.",
        });
        return;
      }
      action();
    },
    [isDemo],
  );

  return { isDemo, guardAction };
}
