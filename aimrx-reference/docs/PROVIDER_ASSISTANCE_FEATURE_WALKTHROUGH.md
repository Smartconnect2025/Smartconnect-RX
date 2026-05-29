# Provider Assistance — Feature Walkthrough

**AIM Rx Portal · `app.aimrx.com`**

A complete, screen-by-screen guide to the new **Provider Assistance** workflow: how a supervising provider authorizes an assistant, how an administrator approves and provisions the assistant's account, how the assistant gets onboarded, how the administrator controls pricing and billing terms for that assistant, and how the administrator monitors every prescription the assistant submits.

---

## At a glance

> **What this feature does**
> Lets a licensed provider (MD, DO, NP, PA) delegate prescription submission to a trusted team member (nurse, medical assistant, office manager). The provider remains the legal prescriber on every order. The administrator stays in full control of pricing, billing terms, and audit visibility.

| Role | Can do |
|---|---|
| **Supervising provider** | Request, view, and revoke assistants. *Cannot* set fees or billing terms. |
| **Assistant (delegate)** | Submit prescriptions on the supervising provider's behalf, after legally acknowledging the role. |
| **Administrator / Super-admin** | Approve or reject every request, set pricing tier per assistant, enable deferred billing per assistant, and monitor all activity. |

**Audit trail captured automatically:** the supervising provider's signature, the agreement text hash, the timestamp, the assistant's first-login signature, and the delegation ID stamped on every prescription the assistant submits.

---

## Phase 1 — Provider Requests an Assistant

### Where it happens
- **URL:** `https://app.aimrx.com/provider/provider-assistance`
- **Who:** the supervising provider, signed in to her own AIM Rx account.

### Step-by-step

**1.1** The provider opens her **Provider Assistance** tab from the provider header.

> 📸 **Screenshot 1.1** — Provider Assistance tab, empty state with "Request New Assistant" button.

**1.2** The provider clicks the blue **Request New Assistant** button at the top right.
A dialog titled **"Request a New Assistant"** opens.

> 📸 **Screenshot 1.2** — The "Request a New Assistant" dialog open over the page.

**1.3** The provider fills in the assistant's details:

| Field | Notes |
|---|---|
| **First name** | Required |
| **Last name** | Required |
| **Email** | Required — this becomes the assistant's login |
| **Phone** | Optional |
| **Title / Role** | Required (e.g. *"Office Nurse"*, *"Medical Assistant"*) |
| **Scope** | Two checkboxes: ☐ *May submit prescription refills* / ☐ *May submit new prescriptions* |

> 📸 **Screenshot 1.3** — The form mid-fill, showing the personal details and scope checkboxes.

**1.4** Below the form an **Authorization Summary** is generated dynamically. It restates the legal relationship between the provider and the assistant in plain English.

The provider must:
- Tick the **acknowledgment** checkbox: *"I have read and agree to the authorization terms above."*
- **Re-enter her AIM Rx password** (a step-up authentication, so a stolen session cannot create a delegation).

> 📸 **Screenshot 1.4** — The authorization summary, acknowledgment checkbox, and password re-entry field.

**1.5** The provider clicks **Submit Request**. A confirmation toast appears, the dialog closes, and the new request appears on the page with the badge **"Awaiting Admin"**.

> 📸 **Screenshot 1.5** — The Provider Assistance tab now showing the pending request card with the "Awaiting Admin" badge.

### What happens behind the scenes
- A `delegations` row is created with status `pending_admin`.
- The provider's signature image and the SHA-256 hash of the agreement text she signed are snapshotted onto the row — immutable evidence.
- A `DELEGATION_REQUESTED` entry is written to the system audit log.
- The provider can **revoke** the request herself at any moment, even before admin review.

---

## Phase 2 — Administrator Reviews and Approves

### Where it happens
- **URL:** `https://app.aimrx.com/admin/provider-assistance`
- **Who:** any administrator or super-administrator.

### Step-by-step

**2.1** The administrator opens the **Provider Assistance** page from the admin sidebar. Pending requests appear at the top.

> 📸 **Screenshot 2.1** — Admin Provider Assistance page with at least one card in "Awaiting Admin" status.

Each request card shows:
- Assistant's full name and email
- Authorizing provider's name and **NPI**
- Delegation **scope** (refills / new prescriptions)
- The provider's captured **signature**
- The exact **agreement text** the provider signed
- Status badge

**2.2** The administrator clicks **Approve**. A small dialog opens that lets her **generate a temporary password** for the assistant (one click, cryptographically strong).

> 📸 **Screenshot 2.2** — The Approve dialog showing the auto-generated temporary password and the "Send Welcome Email" confirmation.

> Alternative: clicking **Reject** opens a dialog asking for a rejection reason that will be displayed to the provider.

**2.3** The administrator confirms. The system performs four actions atomically:

1. **Creates the assistant's login** in Supabase Auth (email = assistant's email).
2. **Assigns the `delegate` role** in `user_roles`.
3. **Provisions a `providers` row** for the assistant — this is what makes them able to use the prescriber terminal under the supervising provider's NPI.
4. **Updates the delegation** to status `pending_delegate` (waiting for the assistant's first login).

**2.4** A welcome email is sent automatically.

> ✉️ **Email sent**
> **Subject:** *Welcome to AIM RX Portal — Your Provider Assistance Account*
> **Contains:** Portal URL, the assistant's username (their email), and the **one-time temporary password**. The assistant will be forced to change it on first login.

> 📸 **Screenshot 2.4** — The welcome email as it arrives in the assistant's inbox.

---

## Phase 3 — Assistant First-Time Login & Profile Setup

### Step-by-step

**3.1** The assistant opens the portal URL from the welcome email and signs in with her email + temporary password at `/auth/login`.

> 📸 **Screenshot 3.1** — The AIM Rx login screen.

**3.2** Because the account is flagged `must_change_password`, she is redirected immediately to `/auth/change-password` and required to set a new password that meets the policy (length, character classes).

> 📸 **Screenshot 3.2** — The forced-password-change screen.

**3.3** Next, multi-factor authentication is enrolled. She scans the QR code with any authenticator app (Google Authenticator, Authy, 1Password, etc.) and confirms a 6-digit code.

> 📸 **Screenshot 3.3** — The MFA enrollment screen with the QR code.

**3.4** She lands on the **Provider Assistance — Assistant Acknowledgment** page (`/auth/first-login-acknowledgment`). This is the legal counterpart to the agreement her supervising provider signed. The full text is displayed; she signs her name on a signature pad and clicks **Sign & Continue**.

> 📸 **Screenshot 3.4** — The assistant acknowledgment page with the signed signature pad.

> The delegation now flips from `pending_delegate` → `active`. From this moment, every prescription she submits is legally attributable to her supervising provider, with her own signature on file.

**3.5** She completes her profile at `/delegate/profile`:
- **Physical address** (street, city, state, zip, country)
- **Billing address** (same fields; "same as physical" shortcut)

> 📸 **Screenshot 3.5** — The assistant's profile form completed.

**3.6** She is now ready to submit prescriptions. The interface she sees is the standard prescriber terminal, but every order she submits is automatically tagged with her `delegation_id` and stored against her supervising provider as the legal prescriber.

> 📸 **Screenshot 3.6** — The assistant's prescriber terminal home screen.

---

## Phase 4 — Administrator Sets Pricing & Billing Terms

This is where the administrator decides **what the patient pays** and **how the practice is billed** for everything the assistant submits. Both controls are admin-only — neither the supervising provider nor the assistant can change them.

### Where it happens
- **URL:** `https://app.aimrx.com/admin/provider-assistance`
- **Who:** administrator or super-administrator.

Each active assistant card shows two control panels.

### 4A — Per-Assistant Pricing Tier

> 📸 **Screenshot 4A** — The Pricing Tier dropdown on an assistant's card, expanded to show the tier choices.

- **Label:** *"Per-Assistant Pricing Tier"*
- **Control:** dropdown showing every tier defined in the catalogue (e.g. *Default*, *Tier 1*, *Tier 2*, *Tier 3*, *Free Sample*, etc.).
- **Action:** select a tier and click **Save**.

**Behavior**
- When a tier is **set**, every prescription that assistant submits is priced at that tier's rates — regardless of the supervising provider's own tier.
- When set to **Unassigned (default)**, the assistant inherits the supervising provider's tier — the original behavior, so existing assistants are unaffected.
- The price is locked at the moment of submission and stays consistent on the patient receipt, the SMS payment link, and the pharmacy invoice.

### 4B — Mark Orders Paid on Terms (Deferred Billing)

> 📸 **Screenshot 4B** — The "Mark orders Paid on Terms" amber panel with the toggle visible.

- **Label:** *"Mark orders Paid on Terms"*
- **Control:** a toggle switch labelled *"Bypass patient payment / Normal patient payment"*.
- **Action:** flip and click **Save**.

**Behavior — when the toggle is ON for an assistant:**
- Every order that assistant submits is **automatically marked as paid** the moment it is created.
- The order is transmitted **straight to the pharmacy** — no patient payment link, no SMS, no email receipt is sent to the patient.
- Orders are aggregated for **monthly invoicing** to the practice (one card on file or net-terms billing).
- A monthly **Pay-on-Terms statement email** is sent automatically to the practice's billing contact at the start of each billing window, with a CSV attachment listing every order in the period and the running total.

> 📸 **Screenshot 4C** — A sample monthly Pay-on-Terms statement email with the CSV attachment.

### Why both controls are admin-only
The supervising provider used to see these same controls on her own page. They have been removed from the provider's view (April 2026 release) so a provider cannot grant herself a discount or defer her own billing. Pricing and billing-term decisions sit exclusively with the administrator and super-administrator.

---

## Phase 5 — Administrator Monitors Assistant Activity

The administrator has full, audit-grade visibility into every prescription an assistant submits.

### Where it happens
- **URL:** `https://app.aimrx.com/admin/prescriptions`
- **Who:** administrator or super-administrator.

### What the administrator sees

**5.1** The main prescriptions table lists every order in the system. The column **Prescriber** shows the supervising provider's name (the legal prescriber), and a small badge or sub-line indicates *"Submitted by: Jane Smith (Office Nurse)"* whenever the order originated from a delegate.

> 📸 **Screenshot 5.1** — Admin prescriptions table with at least one row clearly showing both the supervising provider and the assistant who submitted it.

**5.2** The administrator can **filter or search** by provider name or assistant name in the search bar to isolate one team's activity.

> 📸 **Screenshot 5.2** — The search bar filtered to a single assistant's name, showing only her submissions.

**5.3** Clicking a single prescription opens the **detail view**, which includes the full audit panel:

- The supervising provider (legal prescriber, NPI, signature on file)
- The assistant who submitted (name, title, email)
- The active delegation ID
- Submission timestamp (Eastern Time)
- Patient details, drug, dose, payment status, fulfillment status, pharmacy receipt
- Pricing tier applied at submission
- Whether the order was billed normally or **Paid on Terms**

> 📸 **Screenshot 5.3** — Prescription detail page, expanded audit section showing the delegation chain (provider → assistant) and the pricing/billing flags.

**5.4** Activity exports: from the same admin tab, the administrator can **Export CSV** for any time period. The export is RFC 4180-compliant, UTF-8, and tab-aware — choosing the *Pay-on-Terms* tab exports only the deferred-billing orders for that period; choosing *Overview* or *Details* exports the full prescriptions list.

> 📸 **Screenshot 5.4** — The CSV export button and the resulting downloaded file opened in Excel.

---

## Compliance & Audit Summary

| What is captured | Where it lives | Why it matters |
|---|---|---|
| Provider's signature at request time | `delegations.provider_signature` | Proof that the supervising provider personally authorized the delegation |
| SHA-256 hash of the agreement text | `delegations.agreement_text_hash` | Tamper-evident proof of *what* she agreed to |
| Assistant's signature at first login | `delegations.delegate_signature` | Proof that the assistant accepted the role and its responsibilities |
| Step-up password re-entry on request | Supabase Auth | A stolen session alone cannot create a delegation |
| Forced password change + MFA on first login | Supabase Auth | The temporary password is single-use |
| `submitted_by_delegation_id` on every prescription | `prescriptions` table | Every order traces back to the exact assistant *and* the active delegation |
| Status transitions | `delegations.status` (`pending_admin → pending_delegate → active → revoked`) | Full lifecycle is recorded |
| Revocation reason | `delegations.revoke_reason` | Provider or admin can revoke at any time, with reason captured |

---

## Quick reference — URLs

| Audience | Page | URL |
|---|---|---|
| Provider | Request / view / revoke assistants | `/provider/provider-assistance` |
| Admin | Approve, set tier, set pay-on-terms | `/admin/provider-assistance` |
| Admin | All prescription activity (incl. assistants) | `/admin/prescriptions` |
| Assistant | Login | `/auth/login` |
| Assistant | Forced password change | `/auth/change-password` |
| Assistant | First-login legal acknowledgment | `/auth/first-login-acknowledgment` |
| Assistant | Profile setup | `/delegate/profile` |

---

*Document version: 1.0 — April 2026*
*Prepared for customer review of the Provider Assistance feature on AIM Rx Portal.*
