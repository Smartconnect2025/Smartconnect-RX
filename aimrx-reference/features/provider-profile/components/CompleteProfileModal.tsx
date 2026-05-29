"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserCog, FileText, PenLine, ArrowRight } from "lucide-react";

interface CompleteProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: {
    npi: boolean;
    medicalLicense: boolean;
    signature: boolean;
  };
}

export function CompleteProfileModal({
  open,
  onOpenChange,
  missingFields,
}: CompleteProfileModalProps) {
  const router = useRouter();

  const handleCompleteProfile = () => {
    onOpenChange(false);
    router.push("/provider/profile?tab=professional");
  };

  const missingItems = [];
  if (missingFields.npi) {
    missingItems.push({ label: "NPI Number", icon: UserCog });
  }
  if (missingFields.medicalLicense) {
    missingItems.push({ label: "Medical License", icon: FileText });
  }
  if (missingFields.signature) {
    missingItems.push({ label: "Signature", icon: PenLine });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Complete Your Profile</DialogTitle>
          </div>
          <DialogDescription className="text-base text-gray-600">
            To create prescriptions, you need to complete your professional information.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Missing information:</p>
          <ul className="space-y-2">
            {missingItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <item.icon className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={handleCompleteProfile}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Complete Profile
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-gray-500 hover:text-gray-700"
          >
            Remind Me Later
          </Button>
        </div>

        <p className="mt-4 text-xs text-center text-gray-500">
          Your NPI, medical license, and signature are required for compliance and to issue valid prescriptions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
