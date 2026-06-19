---
name: Prescription PDF reliability invariant
description: How the Electronic Rx PDF is stored/served and the hard rule that it must never touch the order-submit path.
---

# Prescription PDF reliability

**Rule:** Electronic Rx PDF generation/upload must NEVER be on the order-submit
critical path. Submission must never be blocked, delayed, or errored by PDF work.

**Why:** Hard product constraint — a failed/slow PDF must not lose or stall a
real prescription order (revenue + patient care). Previously the client awaited
jsPDF generation+upload before navigating, coupling PDF failures to the order UX.

**How it works now (keep consistent):**
- Primary path: `submit/route.ts` fires `generateAndStorePrescriptionPdf` as
  fire-and-forget (`void ...catch(console.error)`) right after the prescription
  insert, before EVERY return branch (incl. pay-on-terms early returns).
- Durability net: `GET /api/prescriptions/[id]/pdf` regenerates + stores on
  demand whenever `pdf_storage_path` is null.
- `generateAndStorePrescriptionPdf` is idempotent: if `pdf_storage_path` is
  already set it returns the existing signed URL without regenerating (guards the
  submit-time-background vs on-demand-GET duplicate race).
- Custom provider-uploaded PDFs (`pdfInfo`) are signaled by the
  `client_pdf_upload` request flag → server SKIPS generation so it can't
  overwrite the custom upload; the client upload is best-effort and non-blocking
  (`void uploadCustomPdf`). If lost, GET fallback regenerates a valid PDF.

**Size floor:** `MIN_PDF_BYTES = 3000` in `generateAndStorePdf.ts`. Measured
smallest *healthy* generated PDF is ~6440 bytes (empty-field, printed-name
fallback when no signature image). Never set the floor at/above ~6440 — the
generator intentionally falls back to a printed provider name (small but valid)
when a signature image can't render, and that must not be rejected.

**Do NOT** re-introduce awaited client-side PDF generation in step3, or await
the PDF store before the submit response / before `router.push`.
