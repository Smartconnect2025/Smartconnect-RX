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
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Eye,
  EyeOff,
  TestTube,
  Shield,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentConfig {
  id: string;
  pharmacyId: string;
  gateway: "stripe" | "authorizenet";
  isActive: boolean;
  environment: string;
  label: string | null;
  stripePublishableKey?: string;
  stripeSecretKeyMasked?: string;
  stripeWebhookSecretMasked?: string;
  authnetApiLoginIdMasked?: string;
  authnetTransactionKeyMasked?: string;
  authnetSignatureKeyMasked?: string;
  hasStripeKeys: boolean;
  hasAuthnetKeys: boolean;
}

export default function PharmacyPaymentSettingsPage() {
  const { user } = useUser();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const queryPharmacyId = searchParams.get("pharmacyId");
  const [pharmacyId, setPharmacyId] = useState<string | null>(queryPharmacyId);

  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const autoScope = async () => {
      if (pharmacyId || !user?.id) return;
      const { data } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.pharmacy_id) {
        setPharmacyId(data.pharmacy_id);
      }
    };
    autoScope();
  }, [user?.id, pharmacyId, supabase]);

  const [gateway, setGateway] = useState<"stripe" | "authorizenet">("stripe");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");

  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");

  const [authnetApiLoginId, setAuthnetApiLoginId] = useState("");
  const [authnetTransactionKey, setAuthnetTransactionKey] = useState("");
  const [authnetSignatureKey, setAuthnetSignatureKey] = useState("");

  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [shippingStandardDollars, setShippingStandardDollars] = useState("40.00");
  const [shippingRefrigeratedDollars, setShippingRefrigeratedDollars] = useState("55.00");
  const [shippingRateLoading, setShippingRateLoading] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);

  const fetchConfigs = useCallback(async () => {
    if (!pharmacyId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/pharmacy-payment-config?pharmacyId=${pharmacyId}`,
        { credentials: "include" },
      );
      const data = await response.json();
      if (data.success) {
        setConfigs(data.configs || []);
      }
    } catch {
      toast.error("Failed to load payment settings");
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  const fetchShippingRate = useCallback(async () => {
    if (!pharmacyId) return;
    try {
      setShippingRateLoading(true);
      const response = await fetch(`/api/pharmacies/shipping-options?pharmacyId=${pharmacyId}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (data.success && data.options) {
        const standard = data.options.find((o: any) => o.id === "standard_overnight");
        const refrigerated = data.options.find((o: any) => o.id === "refrigerated_overnight");
        if (standard) setShippingStandardDollars((standard.price_cents / 100).toFixed(2));
        if (refrigerated) setShippingRefrigeratedDollars((refrigerated.price_cents / 100).toFixed(2));
      }
    } catch {
    } finally {
      setShippingRateLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    fetchConfigs();
    fetchShippingRate();
  }, [fetchConfigs, fetchShippingRate]);

  const handleSaveShippingRates = async () => {
    if (!pharmacyId) return;
    const standardCents = Math.round(parseFloat(shippingStandardDollars || "0") * 100);
    const refrigeratedCents = Math.round(parseFloat(shippingRefrigeratedDollars || "0") * 100);
    if (isNaN(standardCents) || standardCents < 0 || isNaN(refrigeratedCents) || refrigeratedCents < 0) {
      toast.error("Please enter valid shipping rates");
      return;
    }
    try {
      setSavingShipping(true);
      const response = await fetch(`/api/pharmacies/shipping-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pharmacyId,
          standard_overnight_cents: standardCents,
          refrigerated_overnight_cents: refrigeratedCents,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Shipping rates saved");
      } else {
        toast.error(data.error || "Failed to save shipping rates");
      }
    } catch {
      toast.error("Failed to save shipping rates");
    } finally {
      setSavingShipping(false);
    }
  };

  const activeConfig = configs.find((c) => c.isActive);

  const handleSave = async () => {
    if (!pharmacyId) return;

    if (gateway === "stripe" && (!stripeSecretKey || !stripePublishableKey)) {
      toast.error("Stripe Secret Key and Publishable Key are required");
      return;
    }

    if (gateway === "authorizenet" && (!authnetApiLoginId || !authnetTransactionKey)) {
      toast.error("API Login ID and Transaction Key are required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/admin/pharmacy-payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pharmacyId,
          gateway,
          environment,
          stripeSecretKey: gateway === "stripe" ? stripeSecretKey : undefined,
          stripePublishableKey: gateway === "stripe" ? stripePublishableKey : undefined,
          stripeWebhookSecret: gateway === "stripe" ? stripeWebhookSecret || undefined : undefined,
          authnetApiLoginId: gateway === "authorizenet" ? authnetApiLoginId : undefined,
          authnetTransactionKey: gateway === "authorizenet" ? authnetTransactionKey : undefined,
          authnetSignatureKey: gateway === "authorizenet" ? authnetSignatureKey || undefined : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message || "Payment configuration saved");
        setStripeSecretKey("");
        setStripePublishableKey("");
        setStripeWebhookSecret("");
        setAuthnetApiLoginId("");
        setAuthnetTransactionKey("");
        setAuthnetSignatureKey("");
        await fetchConfigs();
      } else {
        toast.error(data.error || "Failed to save configuration");
      }
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);

    if (gateway === "stripe" && !stripeSecretKey) {
      toast.error("Enter your Stripe Secret Key to test");
      return;
    }

    if (gateway === "authorizenet" && (!authnetApiLoginId || !authnetTransactionKey)) {
      toast.error("Enter your API Login ID and Transaction Key to test");
      return;
    }

    try {
      setTesting(true);
      const response = await fetch("/api/admin/pharmacy-payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pharmacyId,
          gateway,
          action: "test",
          environment,
          stripeSecretKey: gateway === "stripe" ? stripeSecretKey : undefined,
          authnetApiLoginId: gateway === "authorizenet" ? authnetApiLoginId : undefined,
          authnetTransactionKey: gateway === "authorizenet" ? authnetTransactionKey : undefined,
        }),
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message || data.error || "Test completed",
      });
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
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
        <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure payment processing for your pharmacy. Payments will go directly to your merchant account.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {activeConfig && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg">Active Configuration</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {activeConfig.gateway === "stripe" ? "Stripe" : "Authorize.Net"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {activeConfig.environment}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {activeConfig.gateway === "stripe" ? (
                    <>
                      <div>
                        <span className="text-gray-500">Publishable Key:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.stripePublishableKey || "—"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Secret Key:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.stripeSecretKeyMasked || "—"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Webhook Secret:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.stripeWebhookSecretMasked || "Not set"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-gray-500">API Login ID:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.authnetApiLoginIdMasked || "—"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Transaction Key:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.authnetTransactionKeyMasked || "—"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Signature Key:</span>
                        <p className="font-mono text-xs mt-1">{activeConfig.authnetSignatureKeyMasked || "Not set"}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>{activeConfig ? "Update Configuration" : "Set Up Payment Processing"}</CardTitle>
              </div>
              <CardDescription>
                {activeConfig
                  ? "Update your payment gateway credentials. Saving will replace the current configuration."
                  : "Choose your payment gateway and enter your merchant credentials."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Gateway</Label>
                  <Select value={gateway} onValueChange={(v) => setGateway(v as "stripe" | "authorizenet")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="authorizenet">Authorize.Net</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                      <SelectItem value="production">Production (Live)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {gateway === "stripe" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripePublishableKey">Publishable Key *</Label>
                    <Input
                      id="stripePublishableKey"
                      placeholder="pk_test_... or pk_live_..."
                      value={stripePublishableKey}
                      onChange={(e) => setStripePublishableKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stripeSecretKey">Secret Key *</Label>
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
                      id="stripeSecretKey"
                      type={showSecrets ? "text" : "password"}
                      placeholder="sk_test_... or sk_live_..."
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripeWebhookSecret">Webhook Signing Secret (Optional)</Label>
                    <Input
                      id="stripeWebhookSecret"
                      type={showSecrets ? "text" : "password"}
                      placeholder="whsec_..."
                      value={stripeWebhookSecret}
                      onChange={(e) => setStripeWebhookSecret(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for webhook signature verification. Find this in your Stripe dashboard under Webhooks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="authnetApiLoginId">API Login ID *</Label>
                    <Input
                      id="authnetApiLoginId"
                      placeholder="Your API Login ID"
                      value={authnetApiLoginId}
                      onChange={(e) => setAuthnetApiLoginId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="authnetTransactionKey">Transaction Key *</Label>
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
                      id="authnetTransactionKey"
                      type={showSecrets ? "text" : "password"}
                      placeholder="Your Transaction Key"
                      value={authnetTransactionKey}
                      onChange={(e) => setAuthnetTransactionKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authnetSignatureKey">Signature Key (Optional)</Label>
                    <Input
                      id="authnetSignatureKey"
                      type={showSecrets ? "text" : "password"}
                      placeholder="Your Signature Key"
                      value={authnetSignatureKey}
                      onChange={(e) => setAuthnetSignatureKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for webhook signature verification. Find this in your Authorize.Net Merchant Interface under Settings.
                    </p>
                  </div>
                </div>
              )}

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    testResult.success
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || testing}
                  className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  Save Configuration
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Security Notice</p>
                    <p>
                      All credentials are encrypted at rest using AES-256-GCM encryption.
                      Payments go directly to your merchant account. SmartConnect RX never
                      stores or has access to patient payment card information.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                <CardTitle>Shipping Options</CardTitle>
              </div>
              <CardDescription>
                Set the delivery fees for each shipping method. Providers will select one of these options when creating prescriptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {shippingRateLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 border border-gray-200 rounded-lg">
                      <Label htmlFor="standardRate" className="text-sm font-semibold">Standard Overnight</Label>
                      <p className="text-xs text-muted-foreground">Regular overnight delivery for non-temperature-sensitive items.</p>
                      <div className="relative max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="standardRate"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={shippingStandardDollars}
                          onChange={(e) => setShippingStandardDollars(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 p-4 border border-blue-200 rounded-lg bg-blue-50/30">
                      <Label htmlFor="refrigeratedRate" className="text-sm font-semibold">Refrigerated Overnight</Label>
                      <p className="text-xs text-muted-foreground">Cold-chain overnight delivery for temperature-sensitive medications.</p>
                      <div className="relative max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="refrigeratedRate"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={shippingRefrigeratedDollars}
                          onChange={(e) => setShippingRefrigeratedDollars(e.target.value)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleSaveShippingRates}
                      disabled={savingShipping}
                      className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                    >
                      {savingShipping ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save Shipping Rates
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      These rates will appear as selectable options when providers create prescriptions.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
