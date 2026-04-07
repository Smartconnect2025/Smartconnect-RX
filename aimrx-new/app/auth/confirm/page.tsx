"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const tokenHash = searchParams.get("token_hash") || "";
  const type = searchParams.get("type") || "";

  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(
    !tokenHash || !type ? "Invalid or missing reset link. Please request a new one." : null
  );

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "recovery",
      });

      if (verifyError) {
        console.error("OTP verification error:", verifyError);
        setError("This reset link has expired or has already been used. Please request a new one.");
        return;
      }

      router.push("/auth/reset-password");
    } catch (err) {
      console.error("Verification failed:", err);
      setError("Something went wrong. Please try again or request a new link.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <h1 className="font-heading font-medium text-2xl text-red-600 mb-2">
          Link Expired
        </h1>
        <p className="text-muted-foreground mb-8">
          {error}
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link href="/auth/forgot-password">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Request New Reset Link
            </Button>
          </Link>
          <Link
            href="/auth"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="flex justify-center mb-4">
        <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      <h1 className="font-heading font-medium text-2xl mb-2">
        Reset Your Password
      </h1>
      <p className="text-muted-foreground mb-8">
        Click the button below to verify your identity and set a new password.
      </p>

      <Button
        onClick={handleVerify}
        disabled={isVerifying}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base"
        size="lg"
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Verifying...
          </>
        ) : (
          "Reset My Password"
        )}
      </Button>

      <p className="text-xs text-muted-foreground mt-6">
        If you didn&apos;t request a password reset, you can safely ignore this page.
      </p>

      <div className="mt-4">
        <Link
          href="/auth"
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
