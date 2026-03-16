"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Copy, Check, KeyRound, Smartphone, Mail } from "lucide-react";
import QRCode from "qrcode";

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const part1 = Math.random().toString(36).substring(2, 7).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 7).toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

export default function MFAEnrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [factorId, setFactorId] = useState<string>("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [step, setStep] = useState<"scan" | "verify" | "codes">("scan");
  const supabase = createClient();
  const redirectUrl = decodeURIComponent(searchParams.get("redirect") || "/");

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to set up MFA");
        router.push("/auth/login");
        return;
      }

      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      if (existingFactors?.all) {
        for (const factor of existingFactors.all) {
          if (factor.factor_type === "totp" && (factor.status as string) !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          }
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "AIM RX",
      });
      if (error) throw error;
      if (data) {
        setFactorId(data.id);
        setSecret(data.totp.secret);
        const qrCodeDataUrl = await QRCode.toDataURL(data.totp.uri);
        setQrCode(qrCodeDataUrl);
      }
    } catch (error) {
      console.error("MFA enrollment error:", error);
      toast.error("Failed to set up MFA. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCodesCopied(true);
    toast.success("Recovery codes copied!");
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const verifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) {
        console.error("Challenge error:", challengeError);
        throw new Error("Failed to create challenge. Please refresh and try again.");
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });
      if (verifyError) {
        console.error("Verify error:", verifyError);
        throw new Error("Invalid code. Make sure you're entering the current 6-digit code from your authenticator app.");
      }

      const codes = generateRecoveryCodes();
      setRecoveryCodes(codes);
      setStep("codes");
      await fetch("/api/auth/mfa/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCodes: codes }),
      });
      toast.success("Two-factor authentication enabled!");
    } catch (error) {
      console.error("MFA verification error:", error);
      toast.error(error instanceof Error ? error.message : "Verification failed. Please try again.");
      setVerificationCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6" data-testid="step-indicator">
      {["scan", "verify", "codes"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            step === s ? "bg-[#00AEEF] text-white scale-110" :
            ["scan", "verify", "codes"].indexOf(step) > i ? "bg-green-500 text-white" :
            "bg-gray-200 text-gray-500"
          }`}>
            {["scan", "verify", "codes"].indexOf(step) > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          {i < 2 && <div className={`w-8 h-0.5 ${["scan", "verify", "codes"].indexOf(step) > i ? "bg-green-500" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="w-full max-w-sm z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6">

          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#00AEEF] to-[#1E3A8A] rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900" data-testid="text-mfa-title">
              {step === "codes" ? "Save Recovery Codes" : "Set Up Authenticator"}
            </h1>
          </div>

          {stepIndicator}

          {isLoading && !qrCode ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00AEEF] mx-auto"></div>
              <p className="text-sm text-gray-500 mt-3">Setting up...</p>
            </div>
          ) : step === "scan" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <Smartphone className="w-5 h-5 text-[#1E3A8A] mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">
                  Open your authenticator app and scan this QR code.
                </p>
              </div>

              {qrCode && (
                <div className="bg-white rounded-lg p-4 text-center border-2 border-gray-100">
                  <img src={qrCode} alt="QR Code" className="mx-auto w-40 h-40" data-testid="img-qr-code" />
                </div>
              )}

              {showManualKey && secret ? (
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Manual entry key:</Label>
                  <div className="flex gap-1.5">
                    <Input value={secret} readOnly className="font-mono text-xs flex-1 h-9" data-testid="input-secret-key" />
                    <Button type="button" variant="outline" size="icon" onClick={copySecret} className="shrink-0 h-9 w-9" data-testid="button-copy-secret">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowManualKey(true)} className="text-xs text-[#00AEEF] hover:underline w-full text-center" data-testid="button-show-manual">
                  Can't scan? Enter key manually
                </button>
              )}

              <Button
                className="w-full h-10 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold text-sm"
                onClick={() => setStep("verify")}
                data-testid="button-next-verify"
              >
                I've Scanned It — Next
              </Button>

              <div className="border-t border-gray-100 pt-3">
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
                  data-testid="button-switch-email"
                >
                  <Mail className="w-4 h-4" />
                  I&apos;d prefer email verification instead
                </button>
              </div>
            </div>
          ) : step === "verify" ? (
            <form onSubmit={verifyAndEnable} className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <KeyRound className="w-5 h-5 text-[#1E3A8A] mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">
                  Enter the 6-digit code shown in your authenticator app.
                </p>
              </div>

              <div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className="h-14 text-center text-3xl tracking-[0.4em] font-mono"
                  autoComplete="off"
                  autoFocus
                  data-testid="input-verification-code"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold text-sm"
                disabled={isLoading || verificationCode.length !== 6}
                data-testid="button-verify-enable"
              >
                {isLoading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Verifying...</>
                ) : "Verify"}
              </Button>

              <button type="button" onClick={() => setStep("scan")} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center" data-testid="button-back-scan">
                Back to QR code
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <KeyRound className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Save these codes now. They won't be shown again. Use them if you lose access to your authenticator app.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {recoveryCodes.map((code, index) => (
                    <div key={index} className="font-mono text-xs text-center bg-white rounded px-2 py-1.5 border border-gray-100" data-testid={`text-recovery-code-${index}`}>
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full h-9 text-sm" onClick={copyRecoveryCodes} data-testid="button-copy-codes">
                {codesCopied ? <><Check className="h-3.5 w-3.5 mr-2" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-2" /> Copy All Codes</>}
              </Button>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={codesAcknowledged} onChange={(e) => setCodesAcknowledged(e.target.checked)} className="rounded border-gray-300" data-testid="checkbox-acknowledge" />
                <span className="text-xs text-gray-600">I've saved my recovery codes</span>
              </label>

              <Button
                type="button"
                className="w-full h-10 bg-[#00AEEF] hover:bg-[#0098D4] text-white font-semibold text-sm"
                onClick={async () => {
                  let targetUrl = redirectUrl && redirectUrl !== "/" ? redirectUrl : null;
                  if (!targetUrl) {
                    try {
                      const { data: { user: u } } = await supabase.auth.getUser();
                      if (u) {
                        const { data: rd } = await supabase.from("user_roles").select("role").eq("user_id", u.id).single();
                        const r = rd?.role;
                        if (r === "admin" || r === "super_admin" || r === "pharmacy_admin") targetUrl = "/admin";
                        else if (r === "provider") targetUrl = "/prescriptions";
                        else targetUrl = "/dashboard";
                      }
                    } catch {}
                    if (!targetUrl) {
                      try {
                        const meRes = await fetch("/api/auth/me");
                        if (meRes.ok) {
                          const meData = await meRes.json();
                          if (meData.role === "admin" || meData.role === "super_admin" || meData.role === "pharmacy_admin") targetUrl = "/admin";
                          else if (meData.role === "provider") targetUrl = "/prescriptions";
                          else targetUrl = "/dashboard";
                        }
                      } catch {}
                    }
                  }
                  try { localStorage.setItem("last_activity", Date.now().toString()); } catch {}
                  window.location.href = targetUrl || "/dashboard";
                }}
                disabled={!codesAcknowledged}
                data-testid="button-continue"
              >
                Continue to AIM RX
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
