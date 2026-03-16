"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Home } from "lucide-react";
import { useEffect } from "react";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="container mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
        {error.message}
        {error.digest && <div>Digest: {error.digest}</div>}
        {error.stack && <div>Stack: {error.stack}</div>}
      </pre>
      <div className="flex justify-center items-center py-4">
        <Button variant="default" asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Return to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
