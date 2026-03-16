import { AdminHeader } from "@/components/layout/AdminHeader";
import { DemoBanner } from "@/components/layout/DemoBanner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <AdminHeader />
      <main className="flex flex-col flex-1 w-full">{children}</main>
    </div>
  );
}
