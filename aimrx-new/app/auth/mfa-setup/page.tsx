"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Copy, Check, ShieldCheck, QrCode, KeyRound } from "lucide-react";

type Step = "loading" | "qr" | "recovery" | "done";

export default function MFASetupPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [step, setStep] = useState<Step>("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alreadyEnabled, setAlreadyEnabled] = useState(false);
  const [showCodeOnly, setShowCodeOnly] = useState(false);

  useEffect(() => {
    async function startSetup() {
      try {
        const res = await fetch("/api/mfa/setup", {
          method: "POST",
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to start MFA setup");
        }
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setAlreadyEnabled(data.alreadyEnabled || false);
        setStep("qr");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start MFA setup");
      }
    }
    startSetup();
  }, []);

  async function handleVerify() {
    if (code.length < 6) return;
    setIsVerifying(true);
    try {
      const endpoint = alreadyEnabled ? "/api/mfa/verify" : "/api/mfa/verify-setup";
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid code");
      }

      try {
        localStorage.setItem("last_activity", Date.now().toString());
        localStorage.removeItem("inactivity_logout");
      } catch {}

      if (alreadyEnabled) {
        toast.success("Authentication successful!");
        setStep("done");
        window.location.href = redirect;
      } else {
        setRecoveryCodes(data.recoveryCodes || []);
        setStep("recovery");
        toast.success("MFA enabled successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  }

  function handleCopyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    toast.success("Recovery codes copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleContinue() {
    setStep("done");
    window.location.href = redirect;
  }

  if (step === "loading" || step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF]">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#00AEEF]" />
          <p className="mt-4 text-gray-600">
            {step === "loading" ? "Setting up two-factor authentication..." : "Redirecting..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {step === "qr" && (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#00AEEF]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <QrCode className="h-7 w-7 text-[#00AEEF]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
              <p className="text-sm text-gray-600 mt-2">
                {alreadyEnabled
                  ? "Scan the QR code with your authenticator app, or enter your 6-digit code below."
                  : "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)"}
              </p>
            </div>

            {!showCodeOnly && (
              <>
                <div className="flex justify-center mb-4">
                  {qrCode && (
                    <img
                      src={qrCode}
                      alt="MFA QR Code"
                      className="w-48 h-48 border-2 border-gray-100 rounded-lg"
                    />
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 text-center mb-2">
                    Or enter this code manually:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <code className="text-sm font-mono text-gray-800 break-all select-all">
                      {secret}
                    </code>
                  </div>
                </div>
              </>
            )}

            {alreadyEnabled && !showCodeOnly && (
              <div className="mb-4 text-center">
                <button
                  onClick={() => setShowCodeOnly(true)}
                  className="text-sm text-[#00AEEF] hover:underline flex items-center gap-1 mx-auto"
                >
                  <KeyRound className="w-4 h-4" />
                  I already have my code
                </button>
              </div>
            )}

            {showCodeOnly && (
              <div className="mb-4 text-center">
                <button
                  onClick={() => setShowCodeOnly(false)}
                  className="text-sm text-[#00AEEF] hover:underline flex items-center gap-1 mx-auto"
                >
                  <QrCode className="w-4 h-4" />
                  Show QR code
                </button>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Enter the 6-digit code from your app{alreadyEnabled ? " or an 8-character recovery code" : ""}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                autoFocus
                autoComplete="one-time-code"
              />
              <Button
                onClick={handleVerify}
                disabled={code.length < 6 || isVerifying}
                className="w-full h-12 text-lg font-bold bg-[#00AEEF] hover:bg-[#0098D4] text-white"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/auth/login"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Back to Sign In
              </a>
            </div>
          </>
        )}

        {step === "recovery" && (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Save Your Recovery Codes</h2>
              <p className="text-sm text-gray-600 mt-2">
                Store these codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((rc, i) => (
                  <code
                    key={i}
                    className="bg-white px-3 py-2 rounded text-sm font-mono text-center border border-amber-100"
                  >
                    {rc}
                  </code>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleCopyRecoveryCodes}
                className="w-full h-11"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Codes
                  </>
                )}
              </Button>
              <Button
                onClick={handleContinue}
                className="w-full h-12 text-lg font-bold bg-[#00AEEF] hover:bg-[#0098D4] text-white"
              >
                Continue to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
