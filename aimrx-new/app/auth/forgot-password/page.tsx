"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      toast.success(
        "If an account exists with this email, you will receive a password reset link.",
      );

      router.push("/auth");
    } catch {
      toast.success(
        "If an account exists with this email, you will receive a password reset link.",
      );
      router.push("/auth");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="font-heading text-center font-medium text-2xl">
        Forgot password
      </h1>
      <p className="text-center mt-2 mb-8">
        Enter your email address to reset your password
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            "Send"
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
