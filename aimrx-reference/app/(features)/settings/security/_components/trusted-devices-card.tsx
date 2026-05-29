"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Laptop, Smartphone } from "lucide-react";

interface TrustedDeviceView {
  id: string;
  deviceName: string;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  isCurrent: boolean;
}

interface ListResponse {
  devices: TrustedDeviceView[];
  currentDeviceId: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isMobileDevice(name: string): boolean {
  return /iOS|iPadOS|Android/i.test(name);
}

export default function TrustedDevicesCard() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<TrustedDeviceView[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TrustedDeviceView | null>(
    null,
  );
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/auth/trusted-devices", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as ListResponse;
      setDevices(data.devices ?? []);
    } catch (err) {
      console.error("[trusted-devices-card] fetch failed", err);
      toast.error("Failed to load trusted devices");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDevices();
  }, []);

  const handleRevoke = async (device: TrustedDeviceView) => {
    setPendingId(device.id);
    try {
      const res = await fetch(`/api/auth/trusted-devices/${device.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as {
        success: boolean;
        clearedCurrent?: boolean;
      };
      if (data.clearedCurrent) {
        toast.success(
          "This device is no longer trusted. You'll need to verify next time you sign in.",
        );
      } else {
        toast.success(`Signed out ${device.deviceName}`);
      }
      await fetchDevices();
    } catch (err) {
      console.error("[trusted-devices-card] revoke failed", err);
      toast.error("Failed to sign out this device");
    } finally {
      setPendingId(null);
      setConfirmTarget(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const res = await fetch("/api/auth/trusted-devices/revoke-others", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as { revokedCount: number };
      if (data.revokedCount === 0) {
        toast.success("No other devices to sign out");
      } else if (data.revokedCount === 1) {
        toast.success("Signed out 1 other device");
      } else {
        toast.success(`Signed out ${data.revokedCount} other devices`);
      }
      await fetchDevices();
    } catch (err) {
      console.error("[trusted-devices-card] revoke-others failed", err);
      toast.error("Failed to sign out other devices");
    } finally {
      setRevokingOthers(false);
      setConfirmRevokeOthers(false);
    }
  };

  const showRevokeOthersButton = !loading && devices.length >= 2;

  return (
    <Card className="p-6 mb-6" data-testid="card-trusted-devices">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <Laptop className="w-6 h-6 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Trusted Devices
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Browsers you&apos;ve marked as trusted skip the verification code at
            sign-in for 90 days. Sign out any device you don&apos;t recognize.
          </p>

          {loading ? (
            <div className="space-y-3" data-testid="trusted-devices-loading">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : devices.length === 0 ? (
            <div
              className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
              data-testid="trusted-devices-empty"
            >
              You don&apos;t have any trusted devices yet. The next time you
              sign in, check &quot;Remember this device for 90 days&quot; to add
              one.
            </div>
          ) : (
            <>
              {showRevokeOthersButton && (
                <div className="mb-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmRevokeOthers(true)}
                    disabled={revokingOthers}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    data-testid="button-revoke-others"
                  >
                    {revokingOthers
                      ? "Signing out..."
                      : "Sign out all other devices"}
                  </Button>
                </div>
              )}
              <div className="space-y-3" data-testid="trusted-devices-list">
                {devices.map((d) => {
                const Icon = isMobileDevice(d.deviceName)
                  ? Smartphone
                  : Laptop;
                return (
                  <div
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    data-testid={`trusted-device-${d.id}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="font-medium text-gray-900 truncate"
                            data-testid={`trusted-device-name-${d.id}`}
                          >
                            {d.deviceName}
                          </p>
                          {d.isCurrent && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                              data-testid={`trusted-device-current-${d.id}`}
                            >
                              This device
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs text-gray-500 mt-1"
                          data-testid={`trusted-device-lastused-${d.id}`}
                        >
                          Last used {formatDate(d.lastUsedAt)}
                        </p>
                        <p
                          className="text-xs text-gray-500"
                          data-testid={`trusted-device-ip-${d.id}`}
                        >
                          IP: {d.ip ?? "Unknown"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmTarget(d)}
                      disabled={pendingId === d.id}
                      data-testid={`button-revoke-device-${d.id}`}
                    >
                      {pendingId === d.id
                        ? "Signing out..."
                        : "Sign out this device"}
                    </Button>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmRevokeOthers}
        onOpenChange={(open) => {
          if (!open && !revokingOthers) setConfirmRevokeOthers(false);
        }}
      >
        <AlertDialogContent data-testid="dialog-confirm-revoke-others">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
            <AlertDialogDescription>
              Every other browser you&apos;ve trusted will need a verification
              code at its next sign-in. You&apos;ll stay signed in here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={revokingOthers}
              data-testid="button-cancel-revoke-others"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevokeOthers()}
              disabled={revokingOthers}
              data-testid="button-confirm-revoke-others"
            >
              Sign out others
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && pendingId === null) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-confirm-revoke">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.isCurrent
                ? "This is the device you're using right now. After confirming, this browser will need a verification code at the next sign-in."
                : `${confirmTarget?.deviceName ?? "This device"} will need a verification code at the next sign-in.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={pendingId !== null}
              data-testid="button-cancel-revoke"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) void handleRevoke(confirmTarget);
              }}
              disabled={pendingId !== null}
              data-testid="button-confirm-revoke"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
