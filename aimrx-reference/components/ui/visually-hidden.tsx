"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/utils/tailwind-utils";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        className={cn(
          "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
          "clip-path-[inset(50%)]", // Modern approach
          className,
        )}
        style={{
          // Fallback for older browsers
          clip: "rect(0, 0, 0, 0)",
          clipPath: "inset(50%)",
        }}
        {...props}
      />
    );
  },
);
VisuallyHidden.displayName = "VisuallyHidden";

export { VisuallyHidden };
