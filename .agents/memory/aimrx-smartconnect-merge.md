---
name: AimRx -> SmartConnect feature merge
description: Durable constraints for merging AimRx upstream code into the live SmartConnect RX app
---

# AimRx → SmartConnect merge

SmartConnect RX forked from AimRx; both share near-identical structure (app/components/contexts/core/features/hooks/lib/utils). Reference code lives read-only at `/home/runner/workspace/aimrx-reference`; live app at `/home/runner/workspace/aimrx-new`. No shared git ancestry (history stripped from reference) so a 3-way git merge is NOT possible — must cherry-pick files.

## MFA conflict — DO NOT blind-copy auth
- SmartConnect (LIVE): app-based TOTP via `otplib`, endpoints at `app/api/mfa/*`. Real users are enrolled here NOW.
- AimRx (upstream): SMS-based via `twilio`, endpoints at `app/api/auth/mfa/*` (+ recovery codes, trusted devices).
- **Why:** copying AimRx auth wipes/locks out live users mid-flight. Treat MFA as the LAST, most delicate feature; needs a migration/coexistence plan, not a file copy.

## Dependency delta (reference vs live)
- AimRx adds `twilio` (SMS MFA + api-health). Only install when bringing those features.
- AimRx bumps `@types/pg` ^8.18→^8.20 (harmless).
- SmartConnect-only dep: `otplib` (old MFA) — keep.

## Protected SmartConnect customizations (never overwrite)
pioneerrx-helpers, shipping-options, pharmacy-branding, pharmacy-payment-settings, westside-import, pioneer-test, old MFA (`app/api/mfa/*`). 53 files only-in-SmartConnect.

## Layers (a code merge cannot break live data/secrets)
CODE=Git (Render runs it, source of truth), DATA=Supabase (separate, not in git), SECRETS=Render/Replit (not in git). DBs verified already AHEAD of code for new-feature tables.

## Merge scope snapshot
~148 new files, ~294 changed, ~53 SmartConnect-only. 8 feature groups: new MFA, delegate accounts, pay-on-terms, refunds reporting, provider profile+ACH, cron jobs, admin tools, tiers/pricing. User approved ALL. Do safest self-contained first, MFA last; build+test after each batch before pushing.
