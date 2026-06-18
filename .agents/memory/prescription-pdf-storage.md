---
name: Prescription PDF storage bucket
description: Why the "View Prescription PDF" button never appeared, and the storage bucket the PDF flow depends on.
---

# Prescription PDF storage (patient-files bucket)

The "View Prescription PDF" button is gated on `prescriptions.pdf_storage_path`
being set. That column is only set when the client (step3 submit flow) POSTs the
generated PDF to `/api/prescriptions/[id]/pdf`, which calls `uploadPrescriptionPdf`
→ Supabase Storage bucket **`patient-files`** → `patient_documents` insert →
`prescriptions.pdf_storage_path` update.

**Root cause of "I never see the PDF":** the `patient-files` bucket did **not
exist** in the Supabase project. Every upload failed with `Bucket not found`.
The client swallows that error (only a `toast.warning`), the order still
completes, but `pdf_storage_path` stays null → the gated button never renders
anywhere (modal, step4, admin). Symptom looks like a UI bug; it's missing infra.

**Why:** buckets are project infra, not created by app code or migrations. The
code assumed `patient-files` existed.

**How to apply / fix:** create the bucket once (service role):
`supabase.storage.createBucket("patient-files", { public: false, fileSizeLimit: 10485760 })`.
Keep it **private** (PHI; served only via 24h signed URLs) and 10MB (matches both
the prescription and patient-documents app-side validation). The app reads/writes
it with the **service-role** admin client (`createAdminClient`), so RLS is
bypassed and no storage policies are needed for the app flow.

**Scope:** the same Supabase project backs dev AND the Render production app
(same `NEXT_PUBLIC_SUPABASE_URL`), so creating the bucket fixes both at once — no
code change or deploy required. Existing orders created before the bucket existed
stay PDF-less (not backfilled); only new orders get a stored PDF.
