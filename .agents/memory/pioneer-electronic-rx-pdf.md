---
name: Pioneer Electronic Rx PDF pipeline
description: How the signed Electronic Rx PDF is generated in the provider portal and delivered to PioneerRx.
---

The Electronic Rx PDF for PioneerRx is generated **client-side in the provider portal** (prescriptions/new/step3) via `generatePrescriptionPdf`, uploaded to `/api/prescriptions/[id]/pdf` (stored at `prescriptions.pdf_storage_path`, bucket `patient-files`) BEFORE payment. It is generated for every pharmacy backend — there is no Greenwich-only branching in the portal flow.

**Signature** comes from `providers.signature_url` (saved profile signature, captured via SignatureSection / react-signature-canvas) and is drawn into the PDF. There is no per-prescription signature step.

**Delivery to Pioneer:** `submit-to-pharmacy` → `submitToPioneerRx` reads the stored PDF, base64-encodes it, and `submitPioneerRxEScript` sends it as the `ScriptImage` param. The PDF is **supplementary/optional** — Pioneer's primary intake is the structured EScript params (PatientID/WrittenByID resolved or auto-registered, Directions, Quantity, NDC, refills, DAW). NPI/DEA travel in the structured EScript (from `providers.npi_number` / `dea_number`), NOT only on the PDF.

**Why this matters:** when "matching Pioneer's spec" for the PDF, remember the PDF is an image attachment; field-level ingestion is driven by the EScript params. Adding fields to the PDF (e.g. DEA) is cosmetic/completeness for the human-readable image, separate from what Pioneer parses.
