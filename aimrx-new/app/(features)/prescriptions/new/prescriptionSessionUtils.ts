const PRESCRIPTION_SESSION_KEYS = [
  "prescriptionFormData",
  "prescriptionCart",
  "prescriptionSharedFees",
  "cartFeeFlags",
  "selectedPatientId",
  "encounterId",
  "appointmentId",
  "prescriptionPdfData",
  "prescriptionPdfName",
  "submittedPrescriptionIds",
] as const;

const LEGACY_KEYS = ["prescriptionData", "prescriptionDraft"] as const;

export interface CartItem {
  medication: string;
  vialSize: string;
  dosageAmount: string;
  dosageUnit: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes: string;
  patientPrice: string;
  strength: string;
  selectedPharmacyId: string;
  selectedPharmacyName: string;
  selectedPharmacyColor: string;
  selectedMedicationId: string;
  refillFrequencyDays: string;
}

export interface SharedFees {
  shippingFee: string;
  oversightFees: Array<{ fee: string; reason: string }>;
}

export interface CartFeeFlags {
  showDeliveryFee: boolean;
  showTechnologyFee: boolean;
  showProviderFee: boolean;
}

const DEFAULT_CART_FEE_FLAGS: CartFeeFlags = {
  showDeliveryFee: true,
  showTechnologyFee: true,
  showProviderFee: true,
};

export function getCartFeeFlags(): CartFeeFlags {
  try {
    const raw = sessionStorage.getItem("cartFeeFlags");
    if (!raw) return { ...DEFAULT_CART_FEE_FLAGS };
    const parsed = JSON.parse(raw);
    return {
      showDeliveryFee: parsed.showDeliveryFee !== false,
      showTechnologyFee: parsed.showTechnologyFee !== false,
      showProviderFee: parsed.showProviderFee !== false,
    };
  } catch {
    return { ...DEFAULT_CART_FEE_FLAGS };
  }
}

export function setCartFeeFlags(flags: CartFeeFlags): void {
  sessionStorage.setItem("cartFeeFlags", JSON.stringify(flags));
}

export function getCart(): CartItem[] {
  try {
    const raw = sessionStorage.getItem("prescriptionCart");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]) {
  sessionStorage.setItem("prescriptionCart", JSON.stringify(cart));
}

export function getSharedFees(): SharedFees {
  try {
    const raw = sessionStorage.getItem("prescriptionSharedFees");
    if (!raw) return { shippingFee: "25.00", oversightFees: [] };
    return JSON.parse(raw);
  } catch {
    return { shippingFee: "25.00", oversightFees: [] };
  }
}

export function saveSharedFees(fees: SharedFees) {
  sessionStorage.setItem("prescriptionSharedFees", JSON.stringify(fees));
}

export function clearPrescriptionSession(options?: {
  preserveEncounterContext?: boolean;
  preserveFormData?: boolean;
}) {
  for (const key of PRESCRIPTION_SESSION_KEYS) {
    if (
      options?.preserveEncounterContext &&
      (key === "encounterId" || key === "appointmentId")
    ) {
      continue;
    }
    if (options?.preserveFormData && key === "prescriptionFormData") {
      continue;
    }
    sessionStorage.removeItem(key);
  }
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
  }
}
