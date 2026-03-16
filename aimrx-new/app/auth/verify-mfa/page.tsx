"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@core/supabase/client";
import { getDashboardUrl, type UserRole } from "@core/routing/role-based-routing";
import { Shield, Mail, Smartphone } from "lucide-react";

export default function VerifyMFAPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [isSwitching, setIsSwitching] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const redirectUrl = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (!userId || !email) {
      window.location.href = "/auth/login";
    }
  }, [userId, email]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleInputChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;
    const newCode = pastedData.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(newCode);
    const nextEmptyIndex = newCode.findIndex(c => !c);
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }
    setIsVerifying(true);
    try {
      const apiUrl = `${window.location.origin}/api/auth/mfa/verify-code`;
      console.log("[MFA] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, code: fullCode }),
      });
      console.log("[MFA] Response status:", response.status, "type:", response.type, "url:", response.url);
      const text = await response.text();
      console.log("[MFA] Response body (first 500):", text.substring(0, 500));
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[MFA] Non-JSON response:", text.substring(0, 1000));
        toast.error("Server returned an unexpected response. Please try again.");
        return;
      }
      if (!data.success) {
        toast.error(data.error || "Invalid code");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      toast.success("Verification successful!");
      try { localStorage.setItem("last_activity", Date.now().toString()); } catch {}

      document.cookie = "totp_verified=true;path=/;max-age=86400;samesite=lax";
      document.cookie = "mfa_pending=;path=/;max-age=0";
      if (data.role) {
        document.cookie = `user_role=${data.role};path=/;max-age=86400;samesite=lax`;
        document.cookie = `user_role_cache=${data.role};path=/;max-age=86400;samesite=lax`;
        document.cookie = `user_role_uid=${userId};path=/;max-age=86400;samesite=lax`;
      }

      const role = data.role as UserRole;
      const targetUrl = role ? getDashboardUrl(role) : (redirectUrl !== "/" ? redirectUrl : "/dashboard");
      window.location.href = targetUrl;
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Failed to verify code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/mfa/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || "Failed to resend code");
        return;
      }
      toast.success("New code sent to your email");
      setCountdown(60);
      setCanResend(false);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleSwitchToAuthenticator = async () => {
    setIsSwitching(true);
    try {
      await fetch("/api/auth/mfa/preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_method: "totp" }),
      });

      document.cookie = `mfa_method=totp;path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
      document.cookie = "mfa_pending=;path=/;max-age=0";

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTOTP = factors?.totp?.some((f) => f.status === "verified");

      if (hasVerifiedTOTP) {
        router.push(`/auth/mfa-verify?redirect=${encodeURIComponent(redirectUrl)}`);
      } else {
        router.push(`/auth/mfa-enroll?redirect=${encodeURIComponent(redirectUrl)}`);
      }
    } catch {
      toast.error("Failed to switch method");
    } finally {
      setIsSwitching(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, "*") + c)
    : "";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="w-full max-w-sm z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-gradient-to-br from-[#00AEEF] to-[#1E3A8A] rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1" data-testid="text-verify-title">
              Check Your Email
            </h1>
            <p className="text-sm text-gray-500">
              We sent a 6-digit code to
            </p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5" data-testid="text-masked-email">
              {maskedEmail}
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-11 h-13 text-center text-2xl font-semibold rounded-lg border-gray-200 focus:border-[#00AEEF] focus:ring-[#00AEEF]"
                  disabled={isVerifying}
                  data-testid={`input-code-${index}`}
                />
              ))}
            </div>

            <Button
              onClick={handleVerify}
              className="w-full h-11 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold text-sm"
              disabled={isVerifying || code.join("").length !== 6}
              data-testid="button-verify-code"
            >
              {isVerifying ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Verifying...</>
              ) : (
                "Verify Code"
              )}
            </Button>

            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1.5">
                Didn&apos;t receive the code?
              </p>
              {canResend ? (
                <button
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="text-sm font-medium text-[#00AEEF] hover:text-[#0098D4] transition-colors"
                  data-testid="button-resend-code"
                >
                  {isResending ? "Sending..." : "Resend Code"}
                </button>
              ) : (
                <p className="text-xs text-gray-400">
                  Resend code in <span className="font-semibold text-gray-600">{countdown}s</span>
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <button
                onClick={handleSwitchToAuthenticator}
                disabled={isSwitching}
                className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1.5"
                data-testid="button-switch-authenticator"
              >
                <Smartphone className="w-4 h-4" />
                {isSwitching ? "Switching..." : "Use authenticator app instead"}
              </button>

              <button
                onClick={async () => {
                  await supabase.auth.signOut({ scope: "local" });
                  window.location.href = "/auth/login";
                }}
                className="text-xs text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                data-testid="button-back-login"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-1.5 text-white/60 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected by two-factor authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
