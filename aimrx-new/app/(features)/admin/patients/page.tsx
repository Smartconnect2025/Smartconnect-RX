/**
 * Admin Patients Page
 *
 * Dedicated page for managing patient accounts and data.
 * Thin wrapper that imports and renders the PatientsManagement feature component.
 */

import { Suspense } from "react";
import { PatientsManagement } from "@/features/admin-dashboard";

export default function AdminPatientsPage() {
  return (
    <Suspense>
      <PatientsManagement />
    </Suspense>
  );
}
