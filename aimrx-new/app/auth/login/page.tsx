"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { crmEventTriggers } from "@/core/services/crm";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { resetAuthRedirectFlag } from "@core/auth";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isCleanupDone, setIsCleanupDone] = useState(false);
  const supabase = createClient();

  // Get redirect URL only after mount to avoid hydration mismatch
  const redirectUrl = isMounted ? decodeURIComponent(searchParams.get("redirect") || "/") : "/";
  const reason = isMounted ? searchParams.get("reason") : null;
  const sessionExpired = reason === "session_expired" || reason === "inactivity";

  useEffect(() => {
    setIsMounted(true);
    setIsVisible(true);
    resetAuthRedirectFlag();

    const staleCookies = [
      "totp_verified",
      "session_started",
      "user_role_cache",
      "user_role",
      "user_role_uid",
      "intake_complete_cache",
      "provider_active_cache",
      "mfa_pending",
      "mfa_method",
    ];
    staleCookies.forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });

    const cleanupTimeout = setTimeout(() => setIsCleanupDone(true), 3000);

    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(() => {})
      .finally(() => {
        clearTimeout(cleanupTimeout);
        setIsCleanupDone(true);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error details:", {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name
        });
        throw error;
      }

      if (!data.user?.id || !data.user?.email) {
        throw new Error("Login failed: unable to retrieve account information.");
      }

      crmEventTriggers.userLoggedIn(data.user.id, data.user.email);

      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}

      const mfaRes = await fetch("/api/mfa/status", { credentials: "same-origin" });
      const mfaData = await mfaRes.json();

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      const role = roleData?.role;
      let targetUrl = redirectUrl || "/";
      if (role === "admin" || role === "super_admin" || role === "pharmacy_admin") {
        targetUrl = "/admin";
      } else if (role === "provider") {
        targetUrl = "/prescriptions";
      }

      document.cookie = "mfa_pending=true;path=/;max-age=600;samesite=lax";
      window.location.href = "/auth/mfa-setup?redirect=" + encodeURIComponent(targetUrl);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] overflow-hidden flex flex-col relative">
        {/* Subtle animated helix/DNA background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        </div>

        {/* Header with logo on the left */}
        <header className="w-full px-4 py-3 z-10">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Logo - Left side */}
            <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
              <div className="bg-white/95 rounded-lg px-3 py-1.5 shadow-md">
                <img
                  src="/logo-header.png"
                  alt="AIM Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
            </Link>

            {/* HIPAA Trust Badge - Right side */}
            <div className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border border-green-500/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">HIPAA Compliant</div>
                  <div className="text-[10px] text-gray-600 hidden sm:block">Secure & Private</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Center headline */}
        <div className="pt-2 pb-2 text-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white rounded-2xl shadow-xl px-8 py-4 inline-flex items-center justify-center">
              <img
                src="/logo-header.png"
                alt="AIM Logo"
                className="h-20 w-auto object-contain"
              />
            </div>
            <p className="text-lg text-white/90 font-semibold">The Amazon of Regenerative Medicine</p>
            <p className="text-base text-white/95 italic max-w-2xl mt-1 font-medium">&quot;Elevating Patient Care with AI-Driven Clinical Innovations&quot;</p>
          </div>
        </div>

        {/* Centered login card with fade-in - COMPACT */}
        <div className={`flex-1 flex flex-col items-center justify-center px-4 py-4 z-10 transition-opacity duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}>
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-600">Sign in to access the marketplace</p>
            </div>

            {sessionExpired && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">
                  {reason === "inactivity"
                    ? "You were signed out due to inactivity. Please sign in again."
                    : "Your session has expired. Please sign in again."}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder=""
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-[#00AEEF] hover:text-[#0098D4]"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold bg-[#00AEEF] hover:bg-[#00AEEF] text-white shadow-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,174,239,0.6)]"
                disabled={isLoading || !isCleanupDone}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  "SIGN IN"
                )}
              </Button>
            </form>

            {/* Invitation Only Message */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Invitation Only
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Access by invitation or request below</p>
            </div>
            </div>
          </div>

          {/* Elegant Access Request Cards - COMPACT */}
          <div className="mt-4 flex flex-col md:flex-row gap-4 w-full max-w-4xl">
            {/* Doctor Card */}
            <Link href="/request-doctor-access" className="block group flex-1">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-5 shadow-xl border-2 border-[#00AEEF]/20 hover:border-[#00AEEF] transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:shadow-[0_0_25px_rgba(0,174,239,0.4)]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#0098D4] flex items-center justify-center text-white text-lg font-bold group-hover:scale-110 transition-transform duration-300">
                    Dr
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#00AEEF] transition-colors">For Doctors</h3>
                    <p className="text-xs text-gray-600">Join the network</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">Empower your practice with regenerative medicine. Access peptides, PRP, and more.</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#00AEEF] font-semibold group-hover:translate-x-2 transition-transform">Request Provider Access →</span>
                </div>
              </div>
            </Link>

            {/* Pharmacy Card */}
            <Link href="/request-pharmacy-access" className="block group flex-1">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-5 shadow-xl border-2 border-[#1E3A8A]/20 hover:border-[#1E3A8A] transition-all duration-300 hover:shadow-2xl hover:scale-105 hover:shadow-[0_0_25px_rgba(30,58,138,0.4)]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-white text-lg font-bold group-hover:scale-110 transition-transform duration-300">
                    Rx
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#1E3A8A] transition-colors">For Pharmacies</h3>
                    <p className="text-xs text-gray-600">Grow your business</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">Join AIM&apos;s regenerative network and receive orders from providers nationwide.</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#1E3A8A] font-semibold group-hover:translate-x-2 transition-transform">Apply to Join Network →</span>
                </div>
              </div>
            </Link>
          </div>
        </div>


        {/* Bottom section */}
        <div className="mt-auto z-10">
          {/* Footer */}
          <div className="text-center py-3 text-white text-xs">
            By invitation only • Built exclusively for AIM Medical Technologies
          </div>
        </div>
    </div>
  );
}
