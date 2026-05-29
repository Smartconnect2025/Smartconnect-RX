"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center hover:text-primary my-8 cursor-pointer"
    >
      <ChevronLeft className="mr-2 h-6 w-6" />
      Back
    </button>
  );
}
