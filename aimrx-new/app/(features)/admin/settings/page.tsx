"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Send,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PharmacyBackend {
  id: string;
  pharmacy_id: string;
  store_id: string;
  api_key_encrypted: string;
  is_active: boolean;
  pharmacies: {
    name: string;
  } | null;
}

export default function AdminSettingsPage() {
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingH2H, setIsTestingH2H] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [pharmacyBackends, setPharmacyBackends] = useState<PharmacyBackend[]>(
    [],
  );
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [decryptingId, setDecryptingId] = useState<string | null>(null);
  const [decryptedKeys, setDecryptedKeys] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    // Set webhook URL based on current domain
    if (typeof window !== "undefined") {
      const baseUrl = window.location.origin;
      setWebhookUrl(`${baseUrl}/api/webhook/digitalrx`);
    }

    // Load pharmacy backends from database
    loadPharmacyBackends();
  }, []);

  const loadPharmacyBackends = async () => {
    try {
      const response = await fetch("/api/admin/pharmacy-backends");
      const result = await response.json();

      if (!result.success) {
        console.error("Failed to load pharmacy backends:", result.error);
        setPharmacyBackends([]);
        return;
      }

      const backends = (result.backends || []).map(
        (backend: {
          id: string;
          pharmacy_id: string;
          store_id: string;
          api_key_encrypted: string;
          is_active: boolean;
          pharmacy?: { name: string };
        }) => ({
          id: backend.id,
          pharmacy_id: backend.pharmacy_id,
          store_id: backend.store_id,
          api_key_encrypted: backend.api_key_encrypted,
          is_active: backend.is_active,
          pharmacies: backend.pharmacy ? { name: backend.pharmacy.name } : null,
        }),
      );

      setPharmacyBackends(backends);
    } catch (error) {
      console.error("Error loading pharmacy backends:", error);
      setPharmacyBackends([]);
    }
  };

  const maskPharmacyKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  const toggleShowKey = (backendId: string) => {
    setShowKeys((prev) => ({ ...prev, [backendId]: !prev[backendId] }));
  };

  const handleDecryptKey = async (backendId: string) => {
    // If already decrypted, toggle visibility
    if (decryptedKeys[backendId]) {
      setDecryptedKeys((prev) => {
        const newKeys = { ...prev };
        delete newKeys[backendId];
        return newKeys;
      });
      return;
    }

    setDecryptingId(backendId);

    try {
      const response = await fetch("/api/admin/pharmacy-backends/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backendId }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error("Decryption failed", {
          description: result.error || "Could not decrypt API key",
        });
        return;
      }

      setDecryptedKeys((prev) => ({
        ...prev,
        [backendId]: result.decryptedKey,
      }));

      toast.success("API Key decrypted", {
        description: result.wasEncrypted
          ? "Key was successfully decrypted from AES-256-GCM"
          : "Key was stored in plain text (legacy)",
      });
    } catch (error) {
      toast.error("Decryption failed", {
        description:
          error instanceof Error ? error.message : "Could not decrypt API key",
      });
    } finally {
      setDecryptingId(null);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied!", {
      description: "Paste this into your DigitalRx dashboard",
    });
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);

    try {
      const response = await fetch("/api/webhook/digitalrx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queue_id: "RX-TEST-9999",
          new_status: "shipped",
          tracking_number: "1Z999AA10123456784",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Webhook test successful!", {
          description: "Status update received and processed",
          icon: <CheckCircle2 className="h-5 w-5" />,
        });
      } else {
        toast.warning("Test sent, but prescription not found", {
          description: "Create a prescription first to test with real data",
        });
      }
    } catch {
      toast.error("Webhook test failed", {
        description: "Could not connect to webhook endpoint",
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleTestH2H = async () => {
    setIsTestingH2H(true);

    try {
      toast.info("Testing H2H DigitalRx connection...", {
        description: "This is a connectivity test only",
      });

      const DIGITALRX_API_KEY = process.env.NEXT_PUBLIC_DIGITALRX_API_KEY || "";
      const DIGITALRX_BASE_URL =
        process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
        "https://www.dbswebserver.com/DBSRestApi/API";

      const testPayload = {
        StoreID: "190190",
        VendorName: "SmartRx Test",
        Patient: {
          FirstName: "Test",
          LastName: "Patient",
          DOB: "1980-01-01",
          Sex: "M",
        },
        Doctor: {
          DoctorFirstName: "Test",
          DoctorLastName: "Doctor",
          DoctorNpi: "1234567890",
        },
        RxClaim: {
          RxNumber: `TEST-${Date.now()}`,
          DrugName: "Test Medication",
          Qty: "30",
          DateWritten: new Date().toISOString().split("T")[0],
        },
      };

      const response = await fetch(`${DIGITALRX_BASE_URL}/RxWebRequest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: DIGITALRX_API_KEY,
        },
        body: JSON.stringify(testPayload),
      });

      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "H2H_CONNECTION_TEST",
          details: `Connection test to DigitalRx API - Status: ${response.status}`,
          status: response.ok ? "success" : "info",
          user_name: "Admin",
        }),
      });

      if (response.ok) {
        toast.success("H2H DigitalRx connection successful!", {
          description: `API responded with status ${response.status}`,
          icon: <CheckCircle2 className="h-5 w-5" />,
          duration: 5000,
        });
      } else {
        toast.warning("H2H DigitalRx connection test completed", {
          description: `Status ${response.status} - Check API logs for details`,
          duration: 5000,
        });
      }
    } catch (error) {
      await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "H2H_CONNECTION_TEST",
          details: `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: "info",
          user_name: "Admin",
        }),
      }).catch(() => {});

      toast.info("H2H DigitalRx connection test completed", {
        description: "Could not reach API - Check API logs for details",
      });
    } finally {
      setIsTestingH2H(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          DigitalRx Integration Settings
        </h1>
      </div>

      {/* Pharmacy API Keys Section */}
      <div className="bg-white border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">
              Pharmacy API Configurations
            </h2>
          </div>
          <Button
            onClick={handleTestH2H}
            disabled={isTestingH2H}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
          >
            {isTestingH2H ? (
              <>
                <div className="mr-2 h-4 w-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></div>
                Testing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Test H2H Connection
              </>
            )}
          </Button>
        </div>

        {pharmacyBackends.length > 0 ? (
          <div className="space-y-3">
            {pharmacyBackends.map((backend) => (
              <div
                key={backend.id}
                className={`p-4 rounded-lg border ${
                  backend.is_active
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">
                        {backend.pharmacies?.name || "Unknown Pharmacy"}
                      </h3>
                      {backend.is_active && (
                        <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium">Store ID:</span>{" "}
                        {backend.store_id}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Encrypted API Key:</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border">
                          {showKeys[backend.id]
                            ? backend.api_key_encrypted
                            : maskPharmacyKey(backend.api_key_encrypted)}
                        </code>
                        <button
                          onClick={() => toggleShowKey(backend.id)}
                          className="text-gray-500 hover:text-gray-700"
                          title="Show/hide encrypted value"
                        >
                          {showKeys[backend.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {/* Decrypted Key Display */}
                      {decryptedKeys[backend.id] && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-medium text-green-700">
                            Decrypted:
                          </span>
                          <code className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-300">
                            {decryptedKeys[backend.id]}
                          </code>
                        </div>
                      )}
                      {/* Decrypt Button */}
                      <div className="mt-2">
                        <Button
                          onClick={() => handleDecryptKey(backend.id)}
                          disabled={decryptingId === backend.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          {decryptingId === backend.id ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Decrypting...
                            </>
                          ) : decryptedKeys[backend.id] ? (
                            <>
                              <EyeOff className="mr-1 h-3 w-3" />
                              Hide Decrypted
                            </>
                          ) : (
                            <>
                              <KeyRound className="mr-1 h-3 w-3" />
                              Decrypt
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pharmacy backends configured</p>
            <p className="text-sm">
              Go to Pharmacy Management to add a pharmacy with DigitalRx
              integration
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900">
              API Keys are Encrypted
            </p>
            <p className="text-sm text-blue-700">
              API keys are stored encrypted in the database using AES-256-GCM
              encryption. They are only decrypted server-side when needed to
              make API calls. Manage API keys in Pharmacy Management.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Configuration Section */}
      <div className="bg-white border border-border rounded-lg p-6 space-y-6 mt-6">
        <div className="flex items-center gap-2 pb-4 border-b">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Webhook Configuration</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input
                id="webhook-url"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm bg-gray-50"
              />
              <Button
                variant="outline"
                onClick={handleCopyWebhookUrl}
                className="whitespace-nowrap"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste this URL into your DigitalRx dashboard to receive automatic
              status updates
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleTestWebhook}
              disabled={isTestingWebhook}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {isTestingWebhook ? (
                <>
                  <div className="mr-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Testing Webhook...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Test Webhook
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-900">
              How Webhooks Work
            </p>
            <p className="text-sm text-green-700">
              When DigitalRx or your pharmacy updates a prescription status
              (approved, packed, shipped, delivered), they will send a POST
              request to this webhook URL. The system automatically updates the
              prescription in real-time without any manual intervention.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h3 className="font-semibold text-sm text-gray-700">
            Expected Payload Format
          </h3>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-green-400 font-mono">
              {`{
  "queue_id": "RX-ABC123-4567",
  "new_status": "shipped",
  "tracking_number": "1Z999AA10123456784"
}`}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Valid statuses: submitted, billing, approved, packed, shipped,
            delivered
          </p>
        </div>
      </div>
    </div>
  );
}
