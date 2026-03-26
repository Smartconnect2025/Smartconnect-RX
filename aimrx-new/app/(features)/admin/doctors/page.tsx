"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ManageDoctorsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/providers");
  }, [router]);

  return null;
}
