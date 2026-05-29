"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@core/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Forced first-login password change for assistants.
 * Middleware redirects here whenever auth.user.user_metadata.must_change_password
 * is true. Once the API call succeeds, the flag is cleared and we navigate to
 * /delegate (or wherever the assistant was originally headed).
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/delegate/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);

      // Refresh the local session so the cleared user_metadata flag propagates
      // to subsequent middleware checks immediately.
      await supabase.auth.refreshSession().catch(() => {});

      toast.success("Password updated.");
      // Next middleware pass will redirect to acknowledgment if needed,
      // otherwise to the delegate dashboard.
      router.replace("/delegate");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#00AEEF] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="text-center">
          <ShieldCheck className="w-10 h-10 text-[#1E3A8A] mx-auto" />
          <h1 className="mt-2 text-xl font-bold text-gray-900">
            Set your password
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            For your security, please change the temporary password sent in
            your welcome email before continuing.
          </p>
          {email && (
            <p className="text-xs text-gray-500 mt-2">
              Signed in as <span className="font-medium">{email}</span>
            </p>
          )}
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor="current">Temporary password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              data-testid="input-new-password"
            />
            <p className="text-xs text-gray-500">
              Minimum 10 characters. Must include at least 3 of: uppercase,
              lowercase, digit, symbol.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              data-testid="input-confirm-password"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#1E3A8A] hover:bg-[#1e3a8a]/90"
            disabled={submitting}
            data-testid="button-submit-change-password"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
