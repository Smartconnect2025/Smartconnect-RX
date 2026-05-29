import crypto from "crypto";

const HASH_VERSION = "v1";

function getPepper(): string {
  const pepper =
    process.env.MFA_RECOVERY_HMAC_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!pepper) {
    throw new Error(
      "MFA recovery code pepper is not configured (set MFA_RECOVERY_HMAC_SECRET or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return pepper;
}

export function normalizeRecoveryCode(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(userId: string, normalizedCode: string): string {
  if (!userId) throw new Error("userId required to hash recovery code");
  if (!normalizedCode || normalizedCode.length < 6) {
    throw new Error("normalized recovery code too short to hash");
  }
  return (
    HASH_VERSION +
    ":" +
    crypto
      .createHmac("sha256", getPepper())
      .update(`mfa-recovery:${userId}:${normalizedCode}`)
      .digest("hex")
  );
}

export function isHashedRecoveryCode(value: string): boolean {
  return typeof value === "string" && value.startsWith(HASH_VERSION + ":");
}
