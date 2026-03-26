"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProvidersManagement } from "@/features/admin-dashboard";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";
import { useUser } from "@core/auth";
import { useState, useEffect } from "react";
import { createClient } from "@core/supabase";

function ProvidersPageContent() {
  const searchParams = useSearchParams();
  const initialPharmacyId = searchParams.get("pharmacy") || undefined;
  const { user } = useUser();
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsPharmacyAdmin(!!data);
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <>
      {isPharmacyAdmin === false && <AdminNavigationTabs />}
      <ProvidersManagement initialPharmacyFilter={initialPharmacyId} />
    </>
  );
}

export default function AdminProvidersPage() {
  return (
    <Suspense>
      <ProvidersPageContent />
    </Suspense>
  );
}
