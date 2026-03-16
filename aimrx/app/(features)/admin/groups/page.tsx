/**
 * Admin Groups Management Page
 *
 * Page for managing provider groups and their platform managers
 */

"use client";

import { Suspense } from "react";
import { GroupsManagement } from "@/features/admin-dashboard/components/GroupsManagement";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";

export default function AdminGroupsPage() {
  return (
    <>
      <AdminNavigationTabs />
      <Suspense>
        <GroupsManagement />
      </Suspense>
    </>
  );
}
