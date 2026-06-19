---
name: Order flow — simulation/test mode gates
description: How to tell a real vs simulated pharmacy submission and what gates "going live"
---

The full order→pharmacy flow is plumbed and works end-to-end: submit → PDF generated/stored → `submit-to-pharmacy` retrieves/regenerates the PDF and attaches it base64 → pharmacy returns a queue_id → status/order_progress advance → tracking assigned. BUT the environment runs in TEST/SIMULATION end-to-end, so nothing reaches a real pharmacy.

How to tell a send is simulated, not real:
- prescription `queue_id` has a `SIM-TX-` prefix → simulated PioneerRx transaction.
- server log prints `[pioneerrx] SIMULATION MODE IS ACTIVE` whenever PIONEERRX_SIMULATION_MODE != false.
- shipping `tracking_number` `EZ1000000001` = EasyPost TEST tracker (EASYPOST_TEST_API_KEY).
- `system_logs` action `API_HEALTH_CHECK` is the live status board for every integration (Supabase/Stripe/PioneerRx/DigitalRx).

`pdf_push_confirmed_at` set = proof the PDF was successfully attached to the outbound call (only written on successful attach).

Gates to actually send to a real pharmacy:
- PioneerRx: PIONEERRX_SIMULATION_MODE=false + live creds.
- DigitalRx: per-pharmacy API key is stored ENCRYPTED; "Failed to decrypt API key" (seen for "DigitalRx — Greenwich") means that integration can't send until the key is re-saved with the correct decryption secret.

**Why:** user asked to confirm orders really go out; everything looked "working" (status picked_up, tracking present) but was simulated.
**How to apply:** when verifying real sends, check queue_id prefix + API_HEALTH_CHECK, not just status progression.
