"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

export default function MFAVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const rawRedirect = decodeURIComponent(searchParams.get("redirect") || "/");
  const redirectUrl = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
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

      let targetUrl = redirectUrl && redirectUrl !== "/" ? redirectUrl : null;

      if (!targetUrl && data.role) {
        const role = data.role;
        if (role === "admin" || role === "super_admin" || role === "pharmacy_admin") {
          targetUrl = "/admin";
        } else if (role === "provider") {
          targetUrl = "/prescriptions";
        } else {
          targetUrl = "/";
        }
      }

      window.location.href = targetUrl || "/";
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("Not authenticated") || errMsg.includes("session")) {
        toast.error("Session expired. Please log in again.");
        setTimeout(() => { window.location.href = "/auth/login"; }, 1500);
      } else {
        toast.error(errMsg);
      }
      setCode("");
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
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
            <p className="text-sm text-gray-600">
              Enter the 6-digit code from your authenticator app, or use a recovery code.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
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
              className="w-full h-12 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold"
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
                onClick={handleBackToLogin}
                className="text-sm text-gray-400 hover:text-gray-600 w-full text-center transition-colors"
                disabled={isLoading}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
