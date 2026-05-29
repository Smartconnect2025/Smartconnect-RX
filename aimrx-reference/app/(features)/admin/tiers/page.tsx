/**
 * Admin Tiers Management Page
 *
 * Page for managing tier levels and discount percentages
 */

import { Suspense } from "react";
import { TiersManagement } from "@/features/admin-dashboard/components/TiersManagement";

export default function AdminTiersPage() {
  return (
    <Suspense>
      <TiersManagement />
    </Suspense>
  );
}
