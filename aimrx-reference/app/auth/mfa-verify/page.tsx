"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Shield, Mail, KeyRound } from "lucide-react";

export default function MFAVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [factorId, setFactorId] = useState<string>("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const supabase = createClient();
  const rawRedirect = decodeURIComponent(searchParams.get("redirect") || "/");
  const redirectUrl = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  useEffect(() => {
    checkMFAChallenge();
  }, []);

  const checkMFAChallenge = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Session expired. Please log in again.");
        router.push("/auth/login");
        return;
      }

      // Get the user's enrolled MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const totpFactor = factors?.totp?.find((f) => f.status === "verified");

      if (!totpFactor) {
        router.push(`/auth/mfa-enroll?redirect=${encodeURIComponent(redirectUrl || "/")}`);
        return;
      }

      setFactorId(totpFactor.id);
    } catch (error) {
      console.error("MFA check error:", error);
      toast.error("Failed to verify MFA status.");
      router.push("/auth/login");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!factorId) {
        throw new Error("No MFA factor found");
      }

      // Create a challenge and verify the code
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (error) throw error;

      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}

      toast.success("Authentication successful!");

      let finalTarget: string | null = null;
      try {
        const completeRes = await fetch("/api/auth/mfa/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            method: "totp",
            rememberDevice,
            redirect: redirectUrl,
          }),
        });
        if (completeRes.ok) {
          const completeData = await completeRes.json().catch(() => ({}));
          if (typeof completeData?.redirect === "string" && completeData.redirect.startsWith("/")) {
            finalTarget = completeData.redirect;
          }
        } else {
          console.warn("[mfa-verify] /complete returned", completeRes.status, "- falling back");
        }
      } catch (completeErr) {
        console.error("[mfa-verify] /complete failed:", completeErr);
      }

      if (!finalTarget) {
        finalTarget = redirectUrl && redirectUrl !== "/" ? redirectUrl : "/";
      }

      window.location.href = finalTarget;
    } catch (error: unknown) {
      console.error("MFA verification error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("session") || errMsg.includes("expired") || errMsg.includes("not authenticated") || errMsg.includes("refresh_token")) {
        toast.error("Session expired. Please log in again.");
        setTimeout(() => { window.location.href = "/auth/login"; }, 1500);
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
      setVerificationCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          method: "recovery_code",
          code: recoveryInput.trim(),
          rememberDevice,
          redirect: redirectUrl,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        toast.error(json?.error || "Invalid recovery code");
        setRecoveryInput("");
        return;
      }

      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}

      toast.success("Recovery code accepted");

      const role = json.role;
      let targetUrl =
        typeof json?.redirect === "string" && json.redirect.startsWith("/")
          ? json.redirect
          : (redirectUrl && redirectUrl !== "/" ? redirectUrl : null);
      if (!targetUrl) {
        if (role === "admin" || role === "super_admin" || role === "pharmacy_admin") {
          targetUrl = "/admin";
        } else if (role === "provider" || role === "delegate") {
          targetUrl = "/prescriptions";
        } else {
          targetUrl = "/";
        }
      }

      window.location.href = targetUrl;
    } catch (error) {
      console.error("Recovery code verification error:", error);
      toast.error("Failed to verify recovery code. Please try again.");
      setRecoveryInput("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    setIsLoading(true);
    try {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}

      await supabase.auth.signOut({ scope: 'global' });

      try {
        localStorage.removeItem("last_activity");
        localStorage.removeItem("inactivity_logout");
      } catch {}

      await new Promise(resolve => setTimeout(resolve, 300));

      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Sign out error:", error);
      window.location.href = "/auth/login";
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] flex items-center justify-center p-4">
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
            <p className="text-sm text-gray-600">
              {recoveryMode
                ? "Enter one of your saved recovery codes"
                : "Enter the code from your authenticator app"}
            </p>
          </div>

          {recoveryMode ? (
            <form onSubmit={handleVerifyRecovery} className="space-y-6" data-testid="form-recovery-code">
              <div className="space-y-2">
                <Label htmlFor="recovery-code" className="text-sm font-medium">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="XXXXX-XXXXX"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value.toUpperCase().slice(0, 20))}
                  required
                  disabled={isLoading}
                  className="h-12 text-center text-lg tracking-wider font-mono"
                  autoComplete="off"
                  autoFocus
                  data-testid="input-recovery-code"
                />
                <p className="text-xs text-gray-500 text-center">
                  Enter one of the 8 recovery codes you saved when setting up two-factor authentication.
                </p>
              </div>

              <div className="flex items-start gap-2.5 px-1">
                <Checkbox
                  id="remember-device-recovery"
                  checked={rememberDevice}
                  onCheckedChange={(v) => setRememberDevice(v === true)}
                  disabled={isLoading}
                  className="mt-0.5"
                  data-testid="checkbox-remember-device"
                />
                <label htmlFor="remember-device-recovery" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium text-gray-700">
                    Remember this device for 90 days
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Skip the code on this device for 90 days. Don&apos;t use on shared computers.
                  </p>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold"
                disabled={isLoading || recoveryInput.replace(/[^A-Z0-9]/g, "").length < 6}
                data-testid="button-verify-recovery"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  "Use Recovery Code"
                )}
              </Button>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryMode(false);
                    setRecoveryInput("");
                  }}
                  className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1.5"
                  disabled={isLoading}
                  data-testid="button-back-to-totp"
                >
                  <Shield className="w-4 h-4" />
                  Back to authenticator code
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                  disabled={isLoading}
                  data-testid="button-back-login"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className="h-14 text-center text-3xl tracking-widest font-mono"
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-xs text-gray-500 text-center">Enter the 6-digit code from your authenticator app</p>
              </div>

              <div className="flex items-start gap-2.5 px-1">
                <Checkbox
                  id="remember-device-totp"
                  checked={rememberDevice}
                  onCheckedChange={(v) => setRememberDevice(v === true)}
                  disabled={isLoading}
                  className="mt-0.5"
                  data-testid="checkbox-remember-device"
                />
                <label htmlFor="remember-device-totp" className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium text-gray-700">
                    Remember this device for 90 days
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Skip the code on this device for 90 days. Don&apos;t use on shared computers.
                  </p>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold"
                disabled={isLoading || verificationCode.length !== 6 || !factorId}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setRecoveryMode(true)}
                  className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1.5"
                  disabled={isLoading}
                  data-testid="button-use-recovery-code"
                >
                  <KeyRound className="w-4 h-4" />
                  Use a recovery code instead
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { data: { user: u } } = await supabase.auth.getUser();
                      if (!u?.id || !u?.email) {
                        toast.error("Session expired");
                        window.location.href = "/auth/login";
                        return;
                      }
                      await fetch("/api/auth/mfa/preference", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mfa_method: "email" }),
                      });
                      document.cookie = `mfa_method=email;path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
                      const sendRes = await fetch("/api/auth/mfa/send-code", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: u.id, email: u.email }),
                      });
                      if (!sendRes.ok) {
                        toast.error("Failed to send email code. Please try again.");
                        return;
                      }
                      router.push(`/auth/verify-mfa?userId=${u.id}&email=${encodeURIComponent(u.email)}&redirect=${encodeURIComponent(redirectUrl)}`);
                    } catch {
                      toast.error("Failed to switch to email verification");
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1.5"
                  disabled={isLoading}
                  data-testid="button-switch-email"
                >
                  <Mail className="w-4 h-4" />
                  Send me an email code instead
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                  disabled={isLoading}
                  data-testid="button-back-login"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
