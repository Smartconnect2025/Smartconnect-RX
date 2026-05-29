"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Preferences {
  notify_submitted: boolean;
  notify_billing: boolean;
  notify_processing: boolean;
  notify_shipped: boolean;
  notify_delivered: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  notify_submitted: true,
  notify_billing: false,
  notify_processing: true,
  notify_shipped: true,
  notify_delivered: true,
};

const PREFERENCE_LABELS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: "notify_submitted", label: "Submitted", description: "When a prescription is submitted to the pharmacy" },
  { key: "notify_processing", label: "Processing", description: "When the pharmacy starts compounding" },
  { key: "notify_shipped", label: "Shipped", description: "When the prescription is shipped to the patient" },
  { key: "notify_delivered", label: "Delivered", description: "When the patient receives their medication" },
  { key: "notify_billing", label: "Billing Updates", description: "Payment and billing status changes" },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/provider/notification-preferences");
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences(data.preferences);
          }
        } else {
          toast.error("Could not load notification preferences");
        }
      } catch {
        toast.error("Could not load notification preferences");
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleToggle = async (key: keyof Preferences) => {
    const previous = { ...preferences };
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    setSaving(true);

    try {
      const response = await fetch("/api/provider/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!response.ok) {
        setPreferences(previous);
        toast.error("Failed to save preference");
      }
    } catch {
      setPreferences(previous);
      toast.error("Failed to save preference");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#1E3A8A]" />
            Notification Preferences
          </h2>
        </div>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm" data-testid="notification-preferences">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#1E3A8A]" />
          Notification Preferences
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which prescription status changes you want to be notified about
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {PREFERENCE_LABELS.map((pref) => (
            <label
              key={pref.key}
              className="flex items-start gap-3 cursor-pointer group"
              data-testid={`toggle-${pref.key}`}
            >
              <div className="pt-0.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[pref.key]}
                  onClick={() => handleToggle(pref.key)}
                  disabled={saving}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    preferences[pref.key]
                      ? "bg-[#1E3A8A]"
                      : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
                      preferences[pref.key]
                        ? "translate-x-[18px]"
                        : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>
            </label>
          ))}
        </div>

        {saving && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </p>
        )}
      </div>
    </div>
  );
}
