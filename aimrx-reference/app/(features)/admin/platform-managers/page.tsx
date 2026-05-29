/**
 * Admin Platform Managers Management Page
 *
 * Page for managing platform managers
 */

"use client";

import { Suspense } from "react";
import { PlatformManagersManagement } from "@/features/admin-dashboard/components/PlatformManagersManagement";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";

export default function AdminPlatformManagersPage() {
  return (
    <>
      <AdminNavigationTabs />
      <Suspense>
        <PlatformManagersManagement />
      </Suspense>
    </>
  );
}
