"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

interface ConsentFormProps {
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function ConsentForm({ onSubmit, isSubmitting }: ConsentFormProps) {
  const router = useRouter();
  const [consentChecked, setConsentChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [communicationChecked, setCommunicationChecked] = useState(false);

  const canSubmit = consentChecked && privacyChecked;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      await onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
          Terms & Consent
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Please review and accept the following terms to complete your registration.
        </p>
      </div>

      <div className="space-y-4">
        {/* Terms of Service */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              className="mt-1"
            />
            <div>
              <Label htmlFor="consent" className="font-medium cursor-pointer">
                Terms of Service *
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                I acknowledge that I have read, understand, and agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  className="text-[#1E3A8A] hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and understand that my use of this platform is subject to these terms.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy"
              checked={privacyChecked}
              onCheckedChange={(checked) => setPrivacyChecked(checked === true)}
              className="mt-1"
            />
            <div>
              <Label htmlFor="privacy" className="font-medium cursor-pointer">
                Privacy Policy & HIPAA Authorization *
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                I acknowledge that I have read and understand the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  className="text-[#1E3A8A] hover:underline"
                >
                  Privacy Policy
                </a>{" "}
                and authorize the collection, use, and disclosure of my protected
                health information as described therein.
              </p>
            </div>
          </div>
        </div>

        {/* Communication Preferences (Optional) */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="communication"
              checked={communicationChecked}
              onCheckedChange={(checked) =>
                setCommunicationChecked(checked === true)
              }
              className="mt-1"
            />
            <div>
              <Label htmlFor="communication" className="font-medium cursor-pointer">
                Communication Preferences (Optional)
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                I would like to receive promotional emails, newsletters, and updates
                about new services and features. I understand I can unsubscribe at
                any time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Almost done!
            </p>
            <p className="text-sm text-green-700 mt-1">
              By clicking &quot;Complete Registration&quot;, you confirm that all the
              information you have provided is accurate and complete.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/intake/insurance")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 min-w-[180px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            "Complete Registration"
          )}
        </Button>
      </div>
    </form>
  );
}
