"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { SetAvailability } from "@/features/provider-dashboard";
import { Loader2 } from "lucide-react";

export function AvailabilityCard() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Availability</h2>
      </div>
      <div className="p-6 space-y-6">
        <SetAvailability onSubmitStateChange={setIsSubmitting} />
        <div className="flex justify-end">
          <Button
            type="submit"
            form="availability-form"
            variant="default"
            className="px-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
