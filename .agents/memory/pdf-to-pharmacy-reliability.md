---
name: PDF-to-pharmacy reliability invariants
description: How the Rx PDF is attached to pharmacy pushes and the constraints any change to that path must keep.
---

# Reliable PDF-to-pharmacy

The Rx PDF is attached to the pharmacy API request (DigitalRx `PDFFile`, PioneerRx
script image) in `submit-to-pharmacy/route.ts`. Two hard invariants govern this path:

1. **PDF work must never block, delay, or error the pharmacy push or the order.**
   Pay-on-terms orders run the ENTIRE chain (create → mark-paid → submit-to-pharmacy
   → pharmacy API) synchronously inside the provider's submit request, so any await
   here adds to their wait. Therefore every PDF step on this path is BOTH best-effort
   (try/catch or a never-rejecting wrapper) AND timeboxed (`withPdfTimeout` race). If
   generation/download exceeds budget, submit WITHOUT the PDF. **Never add an
   un-timeboxed await of PDF work to this path.**

2. **Proof-of-send (`pdf_push_confirmed_at`) is written in a SEPARATE best-effort
   UPDATE, after the critical status update succeeds** — never folded into the update
   that sets `queue_id`/`status=submitted`.
   **Why:** if that column is missing in an environment (migration lag on a Render
   prod deploy) or the write fails, the order's submitted state and 200 response must
   not be at risk.

**Why on-demand generation exists:** the PDF is normally stored fire-and-forget at
order-submit time, but pay-on-terms auto-submits immediately and wins that race,
leaving `pdf_storage_path` empty (previously NULL was sent to the pharmacy). So
`submit-to-pharmacy` generates the PDF IN MEMORY (base64, via
`generatePrescriptionPdfBase64`) on demand before building the payload and attaches
it directly. It does NOT persist it.

**Why in-memory / no-store (do not regress this):** persisting an on-demand server
PDF would set `pdf_storage_path`, which makes the provider's later fire-and-forget
custom upload get rejected ("already uploaded"), silently discarding their document.
Generating in-memory leaves `pdf_storage_path` free, so all three hold at once: the
pharmacy still gets a valid PDF, the custom upload still succeeds (viewer shows the
custom doc), and PDF *storage* stays off the synchronous submit path (invariant #1).
The signal `client_pdf_upload` is request-only (never persisted), so submit-to-pharmacy
cannot tell custom-vs-not at push time — in-memory generation is correct for BOTH
cases, which is why it doesn't need that signal.
The CARD path is unaffected: submit runs after the custom upload completed, so
`pdf_storage_path` is already set and that stored PDF is downloaded and used.
Caveat (unavoidable): for pay-on-terms + custom PDF the pharmacy receives the SERVER
PDF, because the custom file isn't uploaded yet at push time — still strictly better
than the old NULL.
