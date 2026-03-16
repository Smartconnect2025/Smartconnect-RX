"use client";

import { useUser } from "@core/auth";
import { FullHeader } from "./Header";
import { ProviderHeader } from "./ProviderHeader";
import { AdminHeader } from "./AdminHeader";

export function RoleBasedHeader() {
  const { userRole, isLoading } = useUser();

  // Show loading state while determining user role
  if (isLoading) {
    return <FullHeader />;
  }

  // Render role-specific headers
  switch (userRole) {
    case "admin":
      return <AdminHeader />;
    case "provider":
      return <ProviderHeader />;
    default:
      // For patients and unauthenticated users, use the default header
      return <FullHeader />;
  }
}
