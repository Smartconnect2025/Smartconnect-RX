/**
 * Admin Dashboard Page
 *
 * Main admin dashboard page with administrative tools and overview.
 * Redirects pharmacy admins to their prescriptions queue.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/features/admin-dashboard";
import { createClient } from "@core/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsPharmacyAdmin(false);
        return;
      }

      // Check if user is a pharmacy admin
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pharmacyAdmin) {
        // User is a pharmacy admin, redirect to prescriptions queue
        router.replace("/admin/prescriptions");
      } else {
        // User is platform admin, show dashboard
        setIsPharmacyAdmin(false);
      }
    };

    checkUserRole();
  }, [router, supabase]);

  // While checking role, show nothing
  if (isPharmacyAdmin === null) {
    return null;
  }

  // If pharmacy admin, this will be redirected (but just in case)
  if (isPharmacyAdmin) {
    return null;
  }

  // Show platform admin dashboard
  return <AdminDashboard />;
}
