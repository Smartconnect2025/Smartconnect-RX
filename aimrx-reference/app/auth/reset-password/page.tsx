"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { validatePassword } from "@/core/utils/password-validation";
import { PasswordRequirements } from "@/components/ui/password-requirements";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Get password validation state
  const passwordValidation = validatePassword(password);

  // Process the recovery token from URL hash on mount
  useEffect(() => {
    const processRecoveryToken = async () => {
      // Check if there's a hash fragment with token
      const hash = window.location.hash;

      if (!hash) {
        // No hash - check if there's already a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsVerifying(false);
          return;
        }
        setVerificationError("No reset token found. Please use the link from your email.");
        setIsVerifying(false);
        return;
      }

      // Parse hash fragment: #access_token=xxx&refresh_token=xxx&type=recovery&...
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken) {
        setVerificationError("Invalid reset link. Please request a new one.");
        setIsVerifying(false);
        return;
      }

      try {
        // First, give Supabase a moment to auto-process the hash
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if session was already established by Supabase auto-processing
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setIsVerifying(false);
          // Clear hash from URL for cleaner UX
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }

        // If no session yet, try to set it manually using the tokens from hash
        if (accessToken && refreshToken) {
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setError) {
            console.error("Failed to set session:", setError);
            setVerificationError("Your reset link has expired. Please request a new one.");
          } else {
            // Clear hash from URL
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else if (accessToken && !refreshToken) {
          // Some invite links may only have access_token
          // Try to use it anyway
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: "", // Empty refresh token
          });

          if (setError) {
            console.error("Failed to set session with access_token only:", setError);
            setVerificationError("Your reset link has expired or is invalid. Please request a new one.");
          } else {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else {
          setVerificationError("Invalid reset link. Please request a new one.");
        }
      } catch (error) {
        console.error("Error processing recovery token:", error);
        setVerificationError("Failed to verify reset link. Please try again.");
      }

      setIsVerifying(false);
    };

    processRecoveryToken();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verify we still have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expired. Please use the reset link from your email again.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (!passwordValidation.isValid) {
        throw new Error("Password does not meet all requirements");
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Your password has been updated successfully.");

      router.push("/auth");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while verifying token
  if (isVerifying) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-center text-muted-foreground">
            Verifying your reset link...
          </p>
        </div>
      </div>
    );
  }

  // Show error state if verification failed
  if (verificationError) {
    return (
      <div className="w-full max-w-md mx-auto">
        <h1 className="font-heading text-center font-medium text-2xl text-red-600">
          Reset Link Invalid
        </h1>
        <p className="text-center mt-2 mb-8 text-muted-foreground">
          {verificationError}
        </p>
        <div className="text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Request new reset link
          </Link>
          <span className="mx-2 text-muted-foreground">|</span>
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
    <div className="w-full max-w-md mx-auto">
      <h1 className="font-heading text-center font-medium text-2xl">
        Set new password
      </h1>
      <p className="text-center mt-2 mb-8">
        Create a new password for your account
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {password && (
              <PasswordRequirements
                requirements={passwordValidation.requirements}
                className="mt-3"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            "Confirm"
          )}
        </Button>

        <div className="text-center mt-4">
          <Link
            href="/auth"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}
