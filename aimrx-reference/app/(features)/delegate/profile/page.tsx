"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { useUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { DelegateProfileForm } from "@/features/delegate-profile";

export const dynamic = "force-dynamic";

/**
 * Assistant ("delegate" role) profile screen. Lets the assistant fill in
 * their physical and billing address. Only the calling assistant can read or
 * write their own row; everyone else is blocked at the API layer.
 */
export default function DelegateProfilePage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        const role = (data as { role?: string } | null)?.role ?? null;
        if (cancelled) return;
        if (role === "delegate") {
          setAllowed(true);
        } else {
          router.replace("/prescriptions");
        }
      } finally {
        if (!cancelled) setRoleChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userLoading, router]);

  if (userLoading || !roleChecked || !allowed) {
    return (
      <DefaultLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading your profile…
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Your profile
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Keep your physical and billing address on file for the providers
            you assist.
          </p>
        </div>
        <DelegateProfileForm />
      </div>
    </DefaultLayout>
  );
}
