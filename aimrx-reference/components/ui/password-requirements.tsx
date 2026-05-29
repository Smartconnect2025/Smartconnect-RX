import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/utils/tailwind-utils";
import { PasswordRequirement } from "@/core/utils/password-validation";

interface PasswordRequirementsProps {
  requirements: PasswordRequirement[];
  className?: string;
}

export function PasswordRequirements({
  requirements,
  className,
}: PasswordRequirementsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-gray-700">Password must contain:</p>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li
            key={index}
            className={cn(
              "text-sm flex items-center gap-2",
              req.met ? "text-green-600" : "text-gray-600"
            )}
          >
            {req.met ? (
              <Check className="h-4 w-4 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
