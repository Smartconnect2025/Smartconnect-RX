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

## T005 delegate — DONE
All 24 files NEW, copied wholesale (app/api/delegate, provider/delegations, admin/delegations, core/lib/delegations/{acting-provider,agreement,validate}.ts, (features)/delegate/*, features/delegate-profile/*). Tables existed. Typecheck clean.

## T006 cron — PARTIAL (architecture divergence found)
SmartConnect uses pharmacy-dispatcher.ts (multi-pharmacy + PioneerRX custom); AimRx uses submit-to-pharmacy-core.ts (DigitalRx). SmartConnect digitalrx-helpers.ts is a LEANER custom version missing isForwardStatusTransition/STATUS_ORDINAL/unrecognizedStatus.
MERGED 5 safe jobs into core/cron/index.ts (preserved SmartConnect custom api-health-check + prescription-status-sync, added isProduction gate): payment-reconcile, webhook-monitor, payment-daily-sweep (inlined JANITOR_RECOVERABLE_STATUSES=["pending","processing","expired"]), trusted-devices-cleanup, payment-link-fallback.
DEFERRED + FLAG TO USER: payment-janitor (Cohort F re-submits via AimRx submitPrescriptionToPharmacy → bypasses SmartConnect dispatcher) and digitalrx-reconcile (needs AimRx-diverged digitalrx-helpers API). Both need adaptation+testing+sign-off.

## T007 admin tools — PARTIAL (DONE except 1 deferred)
COPIED + typecheck clean: app/api/admin/{dashboard-metrics,webhook-monitor,digitalrx-debug,fix-grouped-payments}/route.ts, app/api/webhook/digitalrx/test/route.ts. Fixed digitalrx-debug null-safety (backend.storeId ?? "").
NOT TOUCHED: app/api/webhook/digitalrx/route.ts (SmartConnect customized — differs).
DEFERRED: app/api/admin/digitalrx-reconcile-now (imports deferred digitalrx-reconcile cron job).

## T004 provider-profile UI — DONE (delegated to subagent, verified)
Full app typecheck = 0 errors. Live app boots clean. New: AchSection.tsx, ProviderAssistanceTab.tsx, app/(features)/provider/provider-assistance/page.tsx. Hand-merged ProfileForm (18 data-testids preserved, custom Card address grid kept, defaultShippingFee kept, AchSection at form end, NPI verify + delegate-view read-only added), service (added updateAchInfo/verifyNpi, kept _section API), NPISection/MedicalLicenseSection NPI verify UI. ContactInfoSection defaultShippingFee PRESERVED (not removed).

## STATUS / NEXT
Live site NOT pushed yet (untouched). Done: T001,T002,T003,T004,T005, T006(5/7 jobs), T007(5/6 tools). 
NEEDS USER DECISION before continuing: (1) push merged work to GitHub->Render (live deploy consent); (2) deferred submission-coupled items (payment-janitor, digitalrx-reconcile, digitalrx-reconcile-now) — adapt to SmartConnect pharmacy-dispatcher or leave out; (3) T008 MFA needs explicit sign-off + coexistence plan (otplib live users vs twilio).
