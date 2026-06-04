# RedSail / Emporos OIDC — signing key rotation runbook

The integrator OIDC server signs every RedSail/Emporos token with one **current**
private key (`REDSAIL_OIDC_PRIVATE_KEY`) and publishes the matching public key at
the JWKS endpoint (`/api/redsail/oidc/jwks`). Rotating that key — for routine
hygiene or a suspected leak — can be done with **zero downtime** by overlapping
the old and new public keys during a rollover window.

Tokens are short-lived (`REDSAIL_OIDC_TOKEN_TTL_SECONDS`, default 3600s = 1h).
Any token signed before the swap stays valid until it expires, so the overlap
window only needs to be **longer than one token TTL** (plus the JWKS cache
`max-age` of 5 min, plus any clock skew). A 24-hour window is a safe default.

## Rotate

1. **Generate a new RSA key pair** (PKCS#8 PEM). For example:
   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out new.pem
   openssl pkey -in new.pem -pubout -out new.pub.pem   # public, for the overlap
   ```
   Keep the old private key's PEM around for step 2 (public part is enough).

2. **Set the previous public key as secondary.** Put the OLD key's public (SPKI)
   PEM — or its private (PKCS#8) PEM; only the public part is used — into
   `REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS`. Multiple PEM blocks may be concatenated
   in this one var; the whole value may also be base64-encoded for single-line
   env storage.

3. **Swap in the new current key.** Set `REDSAIL_OIDC_PRIVATE_KEY` to the NEW
   private key PEM (or base64 of it). Redeploy / restart.

   After restart: new tokens are signed with the new key, the JWKS publishes
   **both** public keys (each by its own `kid`), and in-flight tokens signed with
   the old key keep verifying.

4. **Wait out the rollover window** (≥ one token TTL; 24h is safe).

5. **Retire the old key.** Remove `REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS` (or drop
   just the retired block if you are juggling more than one). Redeploy / restart.
   The JWKS now publishes only the new key and old tokens no longer verify.

## Notes

- The `kid` is derived deterministically from each key (RFC 7638 JWK
  thumbprint), so it changes with the key and never needs to be set by hand.
- `REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS` is verify/publish only — it never signs.
  An unparseable previous key is logged and skipped, not fatal, so a typo there
  cannot take down token issuance with the current key.
- Verify a rollover end-to-end offline with the self-test (covers the dual-key
  case): `npx tsx scripts/redsail-oidc-selftest.ts`.
