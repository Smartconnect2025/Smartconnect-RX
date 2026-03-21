"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Loader2, QrCode, Mail, ArrowLeft } from "lucide-react";

type Method = "choose" | "totp" | "email-sent";

export default function MFAVerifyPage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [method, setMethod] = useState<Method>("choose");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const supabase = createClient();
  const rawRedirect = decodeURIComponent(searchParams.get("redirect") || "/");
  const redirectUrl = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setTimeout(() => setEmailCooldown(emailCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  async function handleSendEmail() {
    setIsSendingEmail(true);
    try {
      const res = await fetch("/api/mfa/send-email-code", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send code");
      }
      setMaskedEmail(data.email || "your email");
      setEmailCooldown(60);
      setMethod("email-sent");
      toast.success("Verification code sent to your email!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email code");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleResendEmail() {
    if (emailCooldown > 0) return;
    setIsSendingEmail(true);
    try {
      const res = await fetch("/api/mfa/send-email-code", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resend code");
      }
      setEmailCooldown(60);
      toast.success("New code sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleVerifyTotp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (code.length < 6) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/mfa/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid code");
      }
      toast.success("Authentication successful!");
      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}
      handleRedirectAfterVerify(data);
    } catch (error: unknown) {
      handleVerifyError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyEmail(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (code.length < 6) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/mfa/verify-email-code", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid code");
      }
      toast.success("Authentication successful!");
      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}
      handleRedirectAfterVerify(data);
    } catch (error: unknown) {
      handleVerifyError(error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleRedirectAfterVerify(data: { role?: string }) {
    let targetUrl = redirectUrl && redirectUrl !== "/" ? redirectUrl : null;
    if (data.role) {
      const role = data.role;
      if (role === "admin" || role === "super_admin" || role === "pharmacy_admin") {
        targetUrl = "/admin";
      } else if (role === "provider") {
        targetUrl = targetUrl || "/prescriptions";
      } else {
        targetUrl = targetUrl || "/";
      }
    }
    window.location.href = targetUrl || "/";
  }

  function handleVerifyError(error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("Not authenticated") || errMsg.includes("session")) {
      toast.error("Session expired. Please log in again.");
      setTimeout(() => { window.location.href = "/auth/login"; }, 1500);
    } else {
      toast.error(errMsg);
    }
    setCode("");
  }

  const handleBackToLogin = async () => {
    setIsLoading(true);
    try {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}
      await supabase.auth.signOut({ scope: "global" });
      try {
        localStorage.removeItem("last_activity");
        localStorage.removeItem("inactivity_logout");
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = "/auth/login";
    } catch {
      window.location.href = "/auth/login";
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {method === "choose" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
                <p className="text-sm text-gray-600">
                  Choose how to verify your identity
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setMethod("totp"); setCode(""); }}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#1D4E89] hover:bg-[#1D4E89]/5 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-[#1D4E89]/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1D4E89]/20">
                    <QrCode className="h-6 w-6 text-[#1D4E89]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Authenticator App</p>
                    <p className="text-sm text-gray-500">Enter code from your authenticator app</p>
                  </div>
                </button>

                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#1D4E89] hover:bg-[#1D4E89]/5 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-12 h-12 bg-[#1D4E89]/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#1D4E89]/20">
                    {isSendingEmail ? (
                      <Loader2 className="h-6 w-6 text-[#1D4E89] animate-spin" />
                    ) : (
                      <Mail className="h-6 w-6 text-[#1D4E89]" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Email Verification</p>
                    <p className="text-sm text-gray-500">Receive a code at your email address</p>
                  </div>
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-sm text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                  disabled={isLoading}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {method === "totp" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#1D4E89]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <QrCode className="w-8 h-8 text-[#1D4E89]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Authenticator Code</h1>
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code from your authenticator app, or use a recovery code.
                </p>
              </div>

              <form onSubmit={handleVerifyTotp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8))}
                    maxLength={8}
                    required
                    disabled={isLoading}
                    className="h-14 text-center text-2xl tracking-[0.4em] font-mono"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Enter a 6-digit code or an 8-character recovery code
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#1D4E89] hover:bg-[#163d6e] text-white font-semibold"
                  disabled={isLoading || code.length < 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>

                <div className="border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => { setMethod("choose"); setCode(""); }}
                    className="text-sm text-gray-400 hover:text-gray-600 w-full text-center transition-colors inline-flex items-center justify-center gap-1"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Choose different method
                  </button>
                </div>
              </form>
            </>
          )}

          {method === "email-sent" && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#1D4E89]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-[#1D4E89]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
                <p className="text-sm text-gray-600">
                  We sent a 6-digit verification code to <strong>{maskedEmail}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyEmail} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email-code" className="text-sm font-medium">Email Verification Code</Label>
                  <Input
                    id="email-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                    disabled={isLoading}
                    className="h-14 text-center text-2xl tracking-[0.4em] font-mono"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#1D4E89] hover:bg-[#163d6e] text-white font-semibold"
                  disabled={isLoading || code.length < 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => { setMethod("choose"); setCode(""); }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={emailCooldown > 0 || isSendingEmail}
                    className="text-sm text-[#1D4E89] hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {isSendingEmail
                      ? "Sending..."
                      : emailCooldown > 0
                        ? `Resend in ${emailCooldown}s`
                        : "Resend code"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
