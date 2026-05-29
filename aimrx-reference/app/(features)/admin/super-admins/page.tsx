"use client";

import { Suspense } from "react";
import { SuperAdminsManagement } from "@/features/admin-dashboard/components/SuperAdminsManagement";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";

export default function AdminSuperAdminsPage() {
  return (
    <>
      <AdminNavigationTabs />
      <Suspense>
        <SuperAdminsManagement />
      </Suspense>
    </>
  );
}
