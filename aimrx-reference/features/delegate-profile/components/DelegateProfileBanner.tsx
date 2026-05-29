"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Banner shown on the assistant's home (prescriptions page) until they have
 * filled in BOTH their physical and billing address. Self-fetches against the
 * delegate-only profile-check endpoint, which 403s for everyone else, so this
 * component is safe to render unconditionally — it will simply render nothing
 * for non-delegates.
 */
export function DelegateProfileBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/delegate/profile-check", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return; // 401/403 → not a delegate, render nothing
        const json = await res.json();
        if (!cancelled && json && json.complete === false) {
          setShow(true);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div
      data-testid="banner-delegate-profile-incomplete"
      className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Finish setting up your profile</p>
          <p className="text-sm">
            Add your physical and billing address so providers and admins have
            your contact details on file.
          </p>
        </div>
      </div>
      <Link href="/delegate/profile">
        <Button
          size="sm"
          data-testid="button-complete-delegate-profile"
          className="bg-amber-600 text-white hover:bg-amber-700"
        >
          Complete profile
        </Button>
      </Link>
    </div>
  );
}
