"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { Suspense } from "react";

function ConfirmPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | "invite" | null;

  const handleConfirm = async () => {
    if (!tokenHash || !type) {
      setError("Invalid or missing confirmation parameters.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type,
      });

      if (verifyError) {
        console.error("OTP verification error:", verifyError);
        setError("This link has expired or has already been used. Please request a new one.");
        setIsProcessing(false);
        return;
      }

      if (type === "recovery") {
        router.push("/auth/reset-password");
      } else {
        router.push("/auth");
      }
    } catch (err) {
      console.error("Confirmation error:", err);
      setError("Something went wrong. Please try again or request a new link.");
      setIsProcessing(false);
    }
  };

  if (!tokenHash || !type) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="font-heading font-medium text-2xl text-red-600 mb-2">
          Invalid Link
        </h1>
        <p className="text-muted-foreground mb-6">
          This confirmation link is missing required parameters.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Request new reset link
          </Link>
          <span className="text-muted-foreground">|</span>
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

  if (error) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="font-heading font-medium text-2xl text-red-600 mb-2">
          Link Expired
        </h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="flex justify-center gap-4">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Request new reset link
          </Link>
          <span className="text-muted-foreground">|</span>
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
      <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
      <h1 className="font-heading font-medium text-2xl mb-2">
        {type === "recovery" ? "Reset Your Password" : "Confirm Your Email"}
      </h1>
      <p className="text-muted-foreground mb-8">
        {type === "recovery"
          ? "Click the button below to continue resetting your password."
          : "Click the button below to confirm your email address."}
      </p>
      <Button
        onClick={handleConfirm}
        className="w-full max-w-xs"
        size="lg"
        disabled={isProcessing}
        data-testid="button-confirm-reset"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Verifying...
          </>
        ) : type === "recovery" ? (
          "Reset My Password"
        ) : (
          "Confirm Email"
        )}
      </Button>
      <div className="mt-6">
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
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ConfirmPageContent />
    </Suspense>
  );
}
