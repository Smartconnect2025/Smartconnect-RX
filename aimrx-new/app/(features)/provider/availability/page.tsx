import { Suspense } from "react";
import { ProviderProfile } from "@/features/provider-profile";

export default function ProviderAvailabilityPage() {
  return (
    <Suspense>
      <ProviderProfile />
    </Suspense>
  );
}
