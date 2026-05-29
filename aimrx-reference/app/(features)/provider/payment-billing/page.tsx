"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentBillingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/provider/profile");
  }, [router]);

  return null;
}
