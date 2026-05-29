import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import {
  uploadPrescriptionPdf,
  getPrescriptionPdfUrl,
} from "@core/services/storage/prescriptionPdfStorage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: prescriptionId } = await params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: prescription, error: rxError } = await adminClient
      .from("prescriptions")
      .select("id, patient_id, prescriber_id, pdf_storage_path")
      .eq("id", prescriptionId)
      .single();

    if (rxError || !prescription) {
      console.error("Prescription not found:", rxError);
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (prescription.pdf_storage_path) {
      return NextResponse.json(
        { success: false, error: "PDF already uploaded for this prescription" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const result = await uploadPrescriptionPdf(
      adminClient,
      file,
      prescription.patient_id,
      prescriptionId,
      user.id
    );

    // Manning incident, Task #65 (May 9 2026): record the size of the
    // FIRST PDF that ever lands in storage for this prescription, plus
    // the AUTHORIZING provider's identity (via the shared resolver, NOT
    // prescription.prescriber_id which on delegate rows is the assistant).
    // This is the single search ("PRESCRIPTION_PDF_INITIAL_RESOLVED")
    // that proves a brand-new submission shipped a healthy ≥200KB PDF
    // on the very first attempt — no janitor-heal cycle, no 15-min delay.
    try {
      const sizeBytes = file.size ?? 0;
      const { data: rxAfter } = await adminClient
        .from("prescriptions")
        .select("submitted_by_delegation_id, prescriber_id")
        .eq("id", prescriptionId)
        .maybeSingle();
      const { resolveAuthorizingProvider } = await import(
        "@core/services/authorizing-provider"
      );
      const resolved = rxAfter
        ? await resolveAuthorizingProvider(adminClient, {
            prescriberId: rxAfter.prescriber_id,
            delegationId: rxAfter.submitted_by_delegation_id ?? null,
          })
        : null;
      await adminClient.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        user_name: user.email ?? "provider",
        action: "PRESCRIPTION_PDF_INITIAL_RESOLVED",
        details:
          `prescriptionId=${prescriptionId} ` +
          `viaDelegation=${resolved?.viaDelegation ?? false} ` +
          `delegationId=${resolved?.delegationId ?? "none"} ` +
          `prescriberUserId=${prescription.prescriber_id} ` +
          `authProviderUserId=${resolved?.provider.user_id ?? "unresolved"} ` +
          `pdfSizeBytes=${sizeBytes} ` +
          `uploadOk=${result.success === true}`,
        status: result.success ? "info" : "warning",
      });
    } catch (logErr) {
      console.error(
        "[pdf-upload] PRESCRIPTION_PDF_INITIAL_RESOLVED log failed (non-fatal):",
        logErr instanceof Error ? logErr.message : logErr,
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      document_id: result.documentId,
      storage_path: result.storagePath,
      url: result.signedUrl,
    });
  } catch (error) {
    console.error("Error uploading prescription PDF:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload PDF" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { id: prescriptionId } = await params;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: prescription, error } = await adminClient
      .from("prescriptions")
      .select("pdf_storage_path, prescriber_id, patient_id")
      .eq("id", prescriptionId)
      .single();

    if (error || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin" || roleRow?.role === "super_admin";
    const isPrescriber = prescription.prescriber_id === user.id;
    const isPatient = prescription.patient_id === user.id;

    if (!isAdmin && !isPrescriber && !isPatient) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!prescription.pdf_storage_path) {
      return NextResponse.json(
        { success: false, error: "No PDF attached to this prescription" },
        { status: 404 }
      );
    }

    const result = await getPrescriptionPdfUrl(
      adminClient,
      prescription.pdf_storage_path,
      60 * 60 * 24
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, error: "PDF file not found in storage. It may need to be re-uploaded." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error("Error getting prescription PDF URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get PDF URL" },
      { status: 500 }
    );
  }
}
