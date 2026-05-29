/**
 * Admin Providers Page
 *
 * Dedicated page for managing provider accounts and data.
 * Thin wrapper that imports and renders the ProvidersManagement feature component.
 */

import { Suspense } from "react";
import { ProvidersManagement } from "@/features/admin-dashboard";

export default function AdminProvidersPage() {
  return (
    <Suspense>
      <ProvidersManagement />
    </Suspense>
  );
}
