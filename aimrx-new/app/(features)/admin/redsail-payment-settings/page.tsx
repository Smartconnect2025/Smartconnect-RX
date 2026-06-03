"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { toast } from "sonner";

type RedsailEnvironment = "ftr1" | "prv" | "production";

interface RedsailConfig {
  id: string;
  pharmacyId: string;
  environment: RedsailEnvironment;
  isActive: boolean;
  isConnected: boolean;
  label: string | null;
  tenantId?: string;
  siteId?: string;
  stationId?: string;
  oidcClientId?: string;
  oidcClientSecretMasked?: string;
  webhookAudience?: string;
  apiBaseUrl?: string;
  hasCredentials: boolean;
}

const ENV_LABELS: Record<RedsailEnvironment, string> = {
  ftr1: "FTR1 — Sandbox (Testing)",
  prv: "Preview",
  production: "Production (Live)",
};

export default function RedsailPaymentSettingsPage() {
  const { user } = useUser();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const queryPharmacyId = searchParams.get("pharmacyId");
  const [pharmacyId, setPharmacyId] = useState<string | null>(queryPharmacyId);

  const [config, setConfig] = useState<RedsailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [environment, setEnvironment] = useState<RedsailEnvironment>("ftr1");
  const [label, setLabel] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [stationId, setStationId] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [webhookAudience, setWebhookAudience] = useState("");

  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const autoScope = async () => {
      if (pharmacyId || !user?.id) return;
      const { data } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.pharmacy_id) setPharmacyId(data.pharmacy_id);
    };
    autoScope();
  }, [user?.id, pharmacyId, supabase]);

  const fetchConfig = useCallback(async () => {
    if (!pharmacyId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/redsail-payment-config?pharmacyId=${pharmacyId}`,
        { credentials: "include" },
      );
      const data = await response.json();
      if (data.success) {
        const existing: RedsailConfig | undefined = (data.configs || [])[0];
        setConfig(existing || null);
        if (existing) {
          setEnvironment(existing.environment);
          setLabel(existing.label || "");
          setTenantId(existing.tenantId || "");
          setSiteId(existing.siteId || "");
          setStationId(existing.stationId || "");
          setOidcClientId(existing.oidcClientId || "");
          setWebhookAudience(existing.webhookAudience || "");
        }
      }
    } catch {
      toast.error("Failed to load RedSail settings");
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!pharmacyId) return;
    try {
      setSaving(true);
      const response = await fetch("/api/admin/redsail-payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pharmacyId,
          environment,
          label: label || undefined,
          tenantId: tenantId || undefined,
          siteId: siteId || undefined,
          stationId: stationId || undefined,
          oidcClientId: oidcClientId || undefined,
          oidcClientSecret: oidcClientSecret || undefined,
          webhookAudience: webhookAudience || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || "RedSail configuration saved");
        setOidcClientSecret("");
        await fetchConfig();
      } else {
        toast.error(data.error || "Failed to save configuration");
      }
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!pharmacyId) return;
    setTestResult(null);
    try {
      setTesting(true);
      const response = await fetch("/api/admin/redsail-payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pharmacyId,
          action: "test",
          environment,
          tenantId,
          oidcClientId,
          // Use the freshly typed secret if present, else rely on the stored one.
          oidcClientSecret: oidcClientSecret || config?.oidcClientSecretMasked,
        }),
      });
      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Check completed",
      });
    } catch {
      setTestResult({ success: false, message: "Connection check failed" });
    } finally {
      setTesting(false);
    }
  };

  if (!pharmacyId) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <p>No pharmacy selected. Please navigate here from your pharmacy management page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RedSail Pay</h1>
        <p className="text-gray-600 mt-1">
          Connect RedSail Pay (Emporos Payments) for patient prescription payments.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          RedSail Pay stays <strong>switched off</strong> until you save your details and the
          connection is verified. Your current live payment processing is not affected. You&apos;ll
          get the Tenant ID, Client ID, and Client Secret below from your RedSail representative.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {config && (
            <Card className={config.isActive && config.isConnected ? "border-green-200 bg-green-50" : "border-gray-200"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.isActive && config.isConnected ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    <CardTitle className="text-lg">Current Status</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ENV_LABELS[config.environment]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        config.isActive && config.isConnected
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }
                    >
                      {config.isActive && config.isConnected ? "Live" : "Not connected"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Tenant ID:</span>
                    <p className="font-mono text-xs mt-1 break-all">{config.tenantId || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Client ID:</span>
                    <p className="font-mono text-xs mt-1 break-all">{config.oidcClientId || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Client Secret:</span>
                    <p className="font-mono text-xs mt-1">{config.oidcClientSecretMasked || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Site / Station:</span>
                    <p className="font-mono text-xs mt-1">
                      {config.siteId || "—"} / {config.stationId || "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>{config ? "Update RedSail Details" : "Set Up RedSail Pay"}</CardTitle>
              </div>
              <CardDescription>
                Enter the details provided by your RedSail representative.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as RedsailEnvironment)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ftr1">{ENV_LABELS.ftr1}</SelectItem>
                      <SelectItem value="prv">{ENV_LABELS.prv}</SelectItem>
                      <SelectItem value="production">{ENV_LABELS.production}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Label (Optional)</Label>
                  <Input
                    id="label"
                    placeholder="e.g. Main store register"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant ID *</Label>
                <Input
                  id="tenantId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The unique account ID (a GUID) RedSail assigns to your pharmacy.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site ID (Optional)</Label>
                  <Input
                    id="siteId"
                    placeholder="Store / location ID"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stationId">Station ID (Optional)</Label>
                  <Input
                    id="stationId"
                    placeholder="Register / station ID"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="oidcClientId">Client ID *</Label>
                <Input
                  id="oidcClientId"
                  placeholder="Your RedSail client ID"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="oidcClientSecret">Client Secret *</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="h-6 px-2 text-xs"
                  >
                    {showSecrets ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showSecrets ? "Hide" : "Show"}
                  </Button>
                </div>
                <Input
                  id="oidcClientSecret"
                  type={showSecrets ? "text" : "password"}
                  placeholder={config?.oidcClientSecretMasked ? "•••• (leave blank to keep current)" : "Your RedSail client secret"}
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookAudience">Webhook Audience (Optional)</Label>
                <Input
                  id="webhookAudience"
                  placeholder="payments-domain"
                  value={webhookAudience}
                  onChange={(e) => setWebhookAudience(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify payment confirmation messages from RedSail. Leave blank if unsure.
                </p>
              </div>

              {testResult && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    testResult.success
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Configuration
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Check Details
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
