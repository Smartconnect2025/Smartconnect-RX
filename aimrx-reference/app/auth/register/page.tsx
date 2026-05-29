"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { crmEventTriggers } from "@/core/services/crm/crmEventTriggers";
import { Eye, EyeOff } from "lucide-react";
import { validatePassword } from "@/core/utils/password-validation";
import { PasswordRequirements } from "@/components/ui/password-requirements";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreements, setAgreements] = useState({
    terms: false,
  });

  const supabase = createClient();

  // Get password validation state
  const passwordValidation = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate agreements
      if (!agreements.terms) {
        throw new Error("Please accept all required agreements");
      }

      // Validate password
      if (!passwordValidation.isValid) {
        throw new Error("Password does not meet all requirements");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Assign "user" role to the newly created account
      if (data.user) {
        // Send Register event to CRM (non-blocking)
        if (data.user.email) {
          crmEventTriggers.accountCreated(data.user.id, data.user.email);
        }
      }

      // New users start with intake process
      router.replace("/intake/patient-information");
      toast.success("Your account has been created.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
        <h1 className="font-heading text-2xl font-semibold mb-2">
          Create your account
        </h1>
        <p className="text-muted-foreground">
          Sign up to get started with your health journey
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={agreements.terms}
              onCheckedChange={(checked) =>
                setAgreements((prev) => ({
                  ...prev,
                  terms: checked as boolean,
                }))
              }
              className="mt-1"
            />
            <label
              htmlFor="terms"
              className="text-sm font-light text-foreground leading-5"
            >
              I have read and agreed to the{" "}
              <Link
                href="/policies/refund"
                className="underline text-foreground hover:text-foreground/80"
              >
                refund policy
              </Link>
              , the{" "}
              <Link
                href="/policies/terms"
                className="underline text-foreground hover:text-foreground/80"
              >
                terms and conditions
              </Link>
              , and the{" "}
              <Link
                href="/policies/privacy"
                className="underline text-foreground hover:text-foreground/80"
              >
                privacy policy
              </Link>
              .
            </label>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !agreements.terms}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            Log in here
          </Link>
        </p>
      </div>
      </div>
    </div>
  );
}
