"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, CheckCircle, XCircle, AlertCircle, Smartphone } from "lucide-react";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupDate, setMfaSetupDate] = useState<string | null>(null);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const res = await fetch("/api/mfa/status", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.mfaEnabled);
        setMfaSetupDate(data.verifiedAt || null);
      }
    } catch (error) {
      console.error("Error checking MFA status:", error);
      toast.error("Failed to load security settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableMFA = () => {
    router.push("/auth/mfa-setup");
  };

  const handleDisableMFA = async () => {
    if (!confirm("Are you sure you want to disable two-factor authentication? This will make your account less secure.")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        credentials: "same-origin",
      });

      if (res.ok) {
        setMfaEnabled(false);
        toast.success("Two-factor authentication disabled successfully");
      } else {
        toast.error("Failed to disable MFA. Please try again.");
      }
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security Settings</h1>
          <p className="text-gray-600">Manage your account security and two-factor authentication</p>
        </div>

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
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Smartphone className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Authenticator App (TOTP)</p>
                      <p className="text-sm text-gray-500">
                        {mfaSetupDate ? `Enabled on ${new Date(mfaSetupDate).toLocaleDateString()}` : "Active"}
                      </p>
                    </div>
                    <span className="ml-auto px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      Verified
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDisableMFA}
                    disabled={isLoading}
                  >
                    {isLoading ? "Disabling..." : "Disable MFA"}
                  </Button>
                </div>
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
