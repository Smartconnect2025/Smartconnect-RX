"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PharmacyOrdersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/prescriptions");
  }, [router]);

  return null;
}
