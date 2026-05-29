"use client";

import { RoleBasedHeader } from "@/components/layout/RoleBasedHeader";
import { DemoBanner } from "@/components/layout/DemoBanner";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <RoleBasedHeader />
      <main className="flex flex-col flex-1 w-full">{children}</main>
    </div>
  );
}
