-- Architect follow-up (May 18 2026): add DB-level CHECK constraints that catch
-- accidental plaintext storage in the encrypted ACH columns. Pattern matches
-- AES-256-GCM hex format used by core/security/encryption.ts:
--   iv (16 bytes = 32 hex) : authTag (16 bytes = 32 hex) : ciphertext (>=2 hex)
-- Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_ach_routing_encrypted_format_check'
      AND conrelid = 'provider_ach_info'::regclass
  ) THEN
    ALTER TABLE provider_ach_info
      ADD CONSTRAINT provider_ach_routing_encrypted_format_check
      CHECK (
        routing_encrypted IS NULL
        OR routing_encrypted ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]{2,}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_ach_account_encrypted_format_check'
      AND conrelid = 'provider_ach_info'::regclass
  ) THEN
    ALTER TABLE provider_ach_info
      ADD CONSTRAINT provider_ach_account_encrypted_format_check
      CHECK (
        account_encrypted IS NULL
        OR account_encrypted ~ '^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]{2,}$'
      );
  END IF;
END $$;
