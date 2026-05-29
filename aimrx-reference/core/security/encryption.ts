import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "[SECURITY] ENCRYPTION_KEY not set — using development fallback. " +
      "Set ENCRYPTION_KEY env var for production security."
    );
    return crypto
      .createHash("sha256")
      .update("rxportal-dev-encryption-key-do-not-use-in-production")
      .digest("hex");
  }
  return key;
}

export function encryptApiKey(plaintext: string): string {
  try {
    const encryptionKey = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(encryptionKey, "hex"),
      iv
    );

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Error encrypting API key:", error);
    throw new Error("Failed to encrypt API key");
  }
}

export function decryptApiKey(encryptedData: string): string {
  try {
    const encryptionKey = getEncryptionKey();
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(encryptionKey, "hex"),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Error decrypting API key:", error);
    throw new Error("Failed to decrypt API key");
  }
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return (
    parts.length === 3 &&
    parts.every((part) => /^[0-9a-f]+$/i.test(part))
  );
}

export function ensureEncrypted(apiKey: string): string {
  if (isEncrypted(apiKey)) {
    return apiKey;
  }
  return encryptApiKey(apiKey);
}
