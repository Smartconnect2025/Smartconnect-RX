"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntakePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the first step of intake
    router.replace("/intake/patient-information");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
