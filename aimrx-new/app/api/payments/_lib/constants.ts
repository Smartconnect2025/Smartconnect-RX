/**
 * Shared timing constants for the payment hot path and the
 * payment-janitor cron.
 *
 * STALE_PROCESSING_MS (60s)
 *   Hot-path threshold. A row stuck in 'processing' for longer than this
 *   is considered an abandoned attempt (closed tab, network drop, deploy
 *   in the middle of a charge). Authorize.Net's hosted page redirects
 *   back to us within seconds on success or failure, so 60s is well past
 *   any legitimate in-flight charge while still giving providers
 *   near-instant recovery to retry after a hiccup.
 *
 * CHARGE_IN_FLIGHT_MS (60s)
 *   Window during which a charge_attempt_started_at on the row blocks
 *   any re-lease, release, or stale-claim. While the gateway might still
 *   be talking to us, we MUST refuse any state mutation that could lead
 *   to a second charge being issued for the same intent.
 *
 * JANITOR_STALE_PROCESSING_MS (30 min)
 *   Cron threshold. After 30 minutes the gateway has either responded or
 *   definitively failed; the row is safe for the janitor to drive
 *   through verify-and-complete (which will itself decide the outcome).
 */
export const STALE_PROCESSING_MS = 60 * 1000;
export const CHARGE_IN_FLIGHT_MS = 60 * 1000;
export const JANITOR_STALE_PROCESSING_MS = 30 * 60 * 1000;
