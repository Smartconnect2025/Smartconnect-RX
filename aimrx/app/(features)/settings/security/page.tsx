"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, AlertCircle, Mail, Smartphone } from "lucide-react";

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [mfaMethod, setMfaMethod] = useState<string>("email");
  const [isSavingPref, setIsSavingPref] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkMFAStatus();
    fetchMfaPreference();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: factorsData, error } = await supabase.auth.mfa.listFactors();

      if (error) throw error;

      const totpFactors = factorsData?.totp || [];
      setFactors(totpFactors as MFAFactor[]);
      setMfaEnabled(totpFactors.some((f) => f.status === "verified"));
    } catch (error) {
      console.error("Error checking MFA status:", error);
      toast.error("Failed to load security settings");
    }
  };

  const fetchMfaPreference = async () => {
    try {
      const res = await fetch("/api/auth/mfa/preference");
      if (res.ok) {
        const data = await res.json();
        setMfaMethod(data.mfa_method || "email");
      }
    } catch (error) {
      console.error("Error fetching MFA preference:", error);
    }
  };

  const updateMfaPreference = async (method: string) => {
    setIsSavingPref(true);
    try {
      const res = await fetch("/api/auth/mfa/preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_method: method }),
      });
      if (res.ok) {
        setMfaMethod(method);
        toast.success(`Default MFA method changed to ${method === "email" ? "email code" : "authenticator app"}`);
      } else {
        toast.error("Failed to update preference");
      }
    } catch (error) {
      console.error("Error updating MFA preference:", error);
      toast.error("Failed to update preference");
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleEnableMFA = () => {
    router.push("/auth/mfa-enroll");
  };

  const handleDisableMFA = async (factorId: string) => {
    if (!confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      toast.success("Two-factor authentication disabled successfully");
      await checkMFAStatus();
    } catch (error) {
      console.error("Error disabling MFA:", error);
      toast.error("Failed to disable MFA. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Settings</h1>
          <p className="text-gray-600">Manage your account security and two-factor authentication</p>
        </div>

        {/* MFA Status Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mfaEnabled ? "bg-green-100" : "bg-orange-100"}`}>
              <Shield className={`w-6 h-6 ${mfaEnabled ? "text-green-600" : "text-orange-600"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
                {mfaEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    <XCircle className="w-3 h-3" />
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Add an extra layer of security to your account by requiring a verification code from your authenticator app when signing in.
              </p>

              {!mfaEnabled ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <div className="flex gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-blue-900 mb-1">Secure your account</h3>
                      <p className="text-sm text-blue-700">
                        Two-factor authentication is strongly recommended for all users, especially healthcare providers handling sensitive patient information.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {mfaEnabled ? (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const verifiedFactor = factors.find((f) => f.status === "verified");
                    if (verifiedFactor) {
                      handleDisableMFA(verifiedFactor.id);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? "Disabling..." : "Disable MFA"}
                </Button>
              ) : (
                <Button
                  onClick={handleEnableMFA}
                  className="bg-[#00AEEF] hover:bg-[#0098D4]"
                >
                  Enable Two-Factor Authentication
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Default MFA Method */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Default Verification Method</h2>
              <p className="text-sm text-gray-600 mb-4">
                Choose how you want to verify your identity when signing in. You can always switch methods at login time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => updateMfaPreference("email")}
                  disabled={isSavingPref}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    mfaMethod === "email"
                      ? "border-[#00AEEF] bg-blue-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  data-testid="button-pref-email"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    mfaMethod === "email" ? "bg-[#00AEEF] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${mfaMethod === "email" ? "text-gray-900" : "text-gray-700"}`}>
                      Email Code
                    </p>
                    <p className="text-xs text-gray-500">6-digit code sent to your email</p>
                  </div>
                  {mfaMethod === "email" && (
                    <CheckCircle className="w-5 h-5 text-[#00AEEF] ml-auto" />
                  )}
                </button>

                <button
                  onClick={() => updateMfaPreference("totp")}
                  disabled={isSavingPref}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    mfaMethod === "totp"
                      ? "border-[#00AEEF] bg-blue-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  data-testid="button-pref-totp"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    mfaMethod === "totp" ? "bg-[#00AEEF] text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${mfaMethod === "totp" ? "text-gray-900" : "text-gray-700"}`}>
                      Authenticator App
                    </p>
                    <p className="text-xs text-gray-500">Code from Google Authenticator, Authy, etc.</p>
                  </div>
                  {mfaMethod === "totp" && (
                    <CheckCircle className="w-5 h-5 text-[#00AEEF] ml-auto" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Active Factors */}
        {factors.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Authentication Methods</h3>
            <div className="space-y-3">
              {factors.map((factor) => (
                <div key={factor.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">{factor.friendly_name}</p>
                      <p className="text-sm text-gray-500">
                        {factor.factor_type.toUpperCase()} • Added {new Date(factor.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    factor.status === "verified"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {factor.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Back Button */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
