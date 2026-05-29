"use client";

import { BillingTab } from "../billing";
import {
  BillingGroup,
  CreateBillingDiagnosisData,
  CreateBillingGroupData,
} from "../../types/billing.types";

interface BillingTabWrapperProps {
  encounterId: string;
  userId: string;
  isFinalized: boolean;
  billingGroups: BillingGroup[];
  setBillingGroups: React.Dispatch<React.SetStateAction<BillingGroup[]>>;
  billingLoading: boolean;
  setBillingLoading: React.Dispatch<React.SetStateAction<boolean>>;
  billingError: string | null;
  setBillingError: React.Dispatch<React.SetStateAction<string | null>>;
  localBillingChanges: {
    procedureCodes: Record<string, { code: string; description: string }>;
    modifiers: Record<string, string>;
    diagnoses: {
      added: Array<{ groupId: string; diagnosis: CreateBillingDiagnosisData }>;
      removed: string[];
      primaryToggles: Array<{
        dxId: string;
        groupId: string;
        isPrimary: boolean;
      }>;
    };
    billingGroups: {
      added: Array<CreateBillingGroupData>;
      removed: string[];
    };
  };
  setLocalBillingChanges: React.Dispatch<
    React.SetStateAction<{
      procedureCodes: Record<string, { code: string; description: string }>;
      modifiers: Record<string, string>;
      diagnoses: {
        added: Array<{
          groupId: string;
          diagnosis: CreateBillingDiagnosisData;
        }>;
        removed: string[];
        primaryToggles: Array<{
          dxId: string;
          groupId: string;
          isPrimary: boolean;
        }>;
      };
      billingGroups: {
        added: Array<CreateBillingGroupData>;
        removed: string[];
      };
    }>
  >;
}

export function BillingTabWrapper(props: BillingTabWrapperProps) {
  return <BillingTab {...props} />;
}
