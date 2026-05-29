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

## Branding cross-wiring (CRITICAL — user flagged "don't mix the two systems")
When copying AimRx route code into SmartConnect, swap user-facing AimRx branding to SmartConnect:
- Logos: app.aimrx.com/logo-header.png -> app.smartconnects.com/logo-header.png (SmartConnect public/logo-header.png exists)
- Brand name "AIM Rx"/"AIM Rx Reports" -> "SmartConnect RX"/"SmartConnect RX Reports"
- Email subjects "[AIM Rx]" -> "[SmartConnect RX]"; footer links app.aimrx.com -> app.smartconnects.com
- Export filenames aimrx-*.pdf/.csv -> smartconnect-*
DO NOT change (NOT branding):
- DB column `aimrx_site_pricing_cents` (real column in pharmacy_medications, verified exists)
- FROM_EMAIL fallback `process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com"` — this is SmartConnect's OWN existing convention (its other routes use same pattern); SENDGRID_FROM_EMAIL is set in prod so fallback never used live. Changing risks SendGrid sender-verification breakage.
Code connections are safe: copied code uses @core/* aliases -> SmartConnect's own envConfig/Supabase/keys. No AimRx DB/credentials cross-wired.

## DB reality (corrects earlier "missing tables" notes)
Live SmartConnect DB (pxehuvreezdpiusgwbct) already HAS most tables thought missing: provider_ach_info, delegations, delegate_profiles, trusted_devices, provider_pharmacy_links, pay_on_terms_email_recipients, pay_on_terms_email_schedule, pharmacy_admins, app_settings, user_roles, tiers, payment_transactions, mfa_codes, pharmacy_payment_configs.
Only confirmed-created-by-us: prescription_refunds (ran via Supabase SQL Editor — table+RLS only, no backfill; ensureRefundRowsExist creates rows on demand).
Method that works for DDL: Supabase Dashboard SQL Editor (no password needed). REST/service-role for verification.
