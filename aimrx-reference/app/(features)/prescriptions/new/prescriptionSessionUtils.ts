const PRESCRIPTION_SESSION_KEYS = [
  "prescriptionFormData",
  "selectedPatientId",
  "encounterId",
  "appointmentId",
  "prescriptionPdfData",
  "prescriptionPdfName",
  "prescriptionCart",
  "cartShippingFee",
  "cartOversightFees",
] as const;

const LEGACY_KEYS = ["prescriptionData", "prescriptionDraft"] as const;

export interface CartItem {
  id: string;
  medication: string;
  strength: string;
  dosageAmount?: string;
  dosageUnit?: string;
  vialSize?: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes: string;
  patientPrice: string;
  selectedPharmacyId: string;
  selectedPharmacyName: string;
  selectedPharmacyColor: string;
  selectedMedicationId: string;
  refillFrequencyDays?: string;
}

export function getCart(): CartItem[] {
  try {
    const data = sessionStorage.getItem("prescriptionCart");
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  cart.push(item);
  sessionStorage.setItem("prescriptionCart", JSON.stringify(cart));
  return cart;
}

export function removeFromCart(itemId: string): CartItem[] {
  const cart = getCart().filter((item) => item.id !== itemId);
  sessionStorage.setItem("prescriptionCart", JSON.stringify(cart));
  return cart;
}

export function clearCart(): void {
  sessionStorage.removeItem("prescriptionCart");
  sessionStorage.removeItem("cartShippingFee");
  sessionStorage.removeItem("cartOversightFees");
}

export function getCartShippingFee(): string {
  return sessionStorage.getItem("cartShippingFee") || "0";
}

export function setCartShippingFee(fee: string): void {
  sessionStorage.setItem("cartShippingFee", fee);
}

export function getCartOversightFees(): Array<{ fee: string; reason: string }> {
  try {
    const data = sessionStorage.getItem("cartOversightFees");
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCartOversightFees(
  fees: Array<{ fee: string; reason: string }>,
): void {
  sessionStorage.setItem("cartOversightFees", JSON.stringify(fees));
}

export function clearPrescriptionSession(options?: {
  preserveEncounterContext?: boolean;
  preserveCatalogSelection?: boolean;
}) {
  for (const key of PRESCRIPTION_SESSION_KEYS) {
    if (
      options?.preserveEncounterContext &&
      (key === "encounterId" || key === "appointmentId")
    ) {
      continue;
    }
    if (
      options?.preserveCatalogSelection &&
      key === "prescriptionFormData"
    ) {
      continue;
    }
    sessionStorage.removeItem(key);
  }
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
  }
}
