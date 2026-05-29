"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@core/supabase/client";

export default function LogoutPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const logout = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}

      await supabase.auth.signOut({ scope: "local" });

      try {
        localStorage.removeItem("last_activity");
        localStorage.removeItem("inactivity_logout");
      } catch {}

      try {
        const cookiesToClear = ["mfa_pending", "totp_verified", "session_started", "user_role_cache", "user_role", "user_role_uid", "intake_complete_cache", "provider_active_cache"];
        cookiesToClear.forEach((name) => {
          document.cookie = `${name}=; path=/; max-age=0`;
          document.cookie = `${name}=; path=/; max-age=0; secure`;
        });
      } catch {}

      const reason = searchParams.get("reason");
      const loginUrl = reason ? `/auth/login?reason=${reason}` : "/auth/login";
      window.location.href = loginUrl;
    };
    logout();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Signing out...</h1>
        <p className="text-gray-600">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}
