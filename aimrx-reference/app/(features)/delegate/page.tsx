"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Provider Assistance — simple model.
 *
 * Assistants ("delegate" role) use the regular provider terminal exactly
 * like a provider does — their own patients, their own Rx history, their
 * own dashboard. The ONLY difference happens at Rx submit time, where the
 * outgoing prescription stamps the authorizing provider's name + NPI and
 * the audit log records both names.
 *
 * The dedicated /delegate dashboard from the earlier prototype has been
 * retired. This page just bounces the user into the standard provider
 * terminal so any old bookmarks keep working.
 */
export default function DelegateLegacyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/prescriptions");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      Loading your terminal…
    </div>
  );
}
