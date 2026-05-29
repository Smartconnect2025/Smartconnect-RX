import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];

async function verifyPatientAccess(userId: string, userRole: string | null, patientId: string, adminClient: Awaited<ReturnType<typeof createAdminClient>>) {
  if (userRole && ["admin", "super_admin"].includes(userRole)) {
    return true;
  }

  const { data: patient, error: patientError } = await adminClient
    .from("patients")
    .select("id, provider_id, user_id")
    .eq("id", patientId)
    .single();

  if (patientError || !patient) {
    console.error("verifyPatientAccess: patient lookup failed", patientError?.message);
    return false;
  }

  if (patient.user_id === userId) return true;

  const { data: providerRow } = await adminClient
    .from("providers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (providerRow) {
    if (patient.provider_id === providerRow.id) return true;

    const { data: mapping } = await adminClient
      .from("provider_patient_mappings")
      .select("id")
      .eq("provider_id", providerRow.id)
      .eq("patient_id", patientId)
      .limit(1);

    if (mapping && mapping.length > 0) return true;
  }

  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params;

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    const hasAccess = await verifyPatientAccess(user.id, userRole, patientId, adminClient);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
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

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `File type ${file.type} not supported. Allowed types: PNG, JPEG, PDF`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is 10MB`,
        },
        { status: 400 }
      );
    }

    let fileType = "other";
    if (file.type.startsWith("image/")) {
      fileType = "image";
    } else if (file.type === "application/pdf") {
      fileType = "pdf";
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const storagePath = `patient-documents/${patientId}/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from("patient-files")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file to storage:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload file",
          details: uploadError.message,
        },
        { status: 500 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("patient-files")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Error creating signed URL:", signedUrlError);
      await adminClient.storage.from("patient-files").remove([storagePath]);
      return NextResponse.json(
        { success: false, error: "Failed to generate file URL" },
        { status: 500 }
      );
    }

    const fileUrl = signedUrlData.signedUrl;

    const { data: document, error: dbError } = await adminClient
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        name: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size: file.size,
        file_url: fileUrl,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving document metadata:", dbError);
      await adminClient.storage.from("patient-files").remove([storagePath]);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to save document metadata",
          details: dbError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("Error in document upload:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload document",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params;

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    const hasAccess = await verifyPatientAccess(user.id, userRole, patientId, adminClient);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const { data: documents, error } = await adminClient
      .from("patient_documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch documents",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const documentsWithFreshUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        if (doc.storage_path) {
          const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
            .from("patient-files")
            .createSignedUrl(doc.storage_path, 60 * 60 * 24);

          if (!signedUrlError && signedUrlData?.signedUrl) {
            return { ...doc, file_url: signedUrlData.signedUrl };
          }
        }
        return doc;
      })
    );

    return NextResponse.json({
      success: true,
      documents: documentsWithFreshUrls,
    });
  } catch (error) {
    console.error("Error in get documents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch documents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params;

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    const hasAccess = await verifyPatientAccess(user.id, userRole, patientId, adminClient);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "Document ID required" },
        { status: 400 }
      );
    }

    const { data: document, error: fetchError } = await adminClient
      .from("patient_documents")
      .select("*")
      .eq("id", documentId)
      .eq("patient_id", patientId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const { error: storageError } = await adminClient.storage
      .from("patient-files")
      .remove([document.storage_path]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
    }

    const { error: deleteError } = await adminClient
      .from("patient_documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      console.error("Error deleting document record:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete document",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete document",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
