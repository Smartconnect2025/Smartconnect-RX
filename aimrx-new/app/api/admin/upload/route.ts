import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { createServerClient } from "@core/supabase/server";
import { getPharmacyAdminScope } from "@core/auth/api-guards";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
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

    const adminClient = createAdminClient();

    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const scope = await getPharmacyAdminScope(user.id);
    const isAdmin = userRole?.role === "admin" || userRole?.role === "super_admin";
    const isPharmacyAdmin = scope.isPharmacyAdmin;

    if (!isAdmin && !isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    if (isPharmacyAdmin && !scope.pharmacyId) {
      return NextResponse.json(
        { success: false, error: "Pharmacy admin has no linked pharmacy" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const entityId = formData.get("entityId") as string;
    const entityName = formData.get("entityName") as string;

    if (!file || !type) {
      return NextResponse.json(
        { success: false, error: "Missing file or type" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPG, PNG, WebP" },
        { status: 400 }
      );
    }

    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size: 3MB" },
        { status: 400 }
      );
    }

    if (type === "category" && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only platform admins can upload category images" },
        { status: 403 }
      );
    }

    if (type === "medication" && isPharmacyAdmin && !isAdmin && entityId) {
      const { data: med } = await adminClient
        .from("pharmacy_medications")
        .select("pharmacy_id")
        .eq("id", entityId)
        .single();

      if (!med || med.pharmacy_id !== scope.pharmacyId) {
        return NextResponse.json(
          { success: false, error: "You can only upload images for your pharmacy's medications" },
          { status: 403 }
        );
      }
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const safeName = (entityName || "image")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 30);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

    let bucket: string;
    let filePath: string;

    if (type === "medication") {
      bucket = "medication-images";
      filePath = `medications/${safeName}-${timestamp}-${randomId}.${ext}`;
    } else if (type === "category") {
      bucket = "category-images";
      filePath = `categories/${safeName}-${timestamp}-${randomId}.${ext}`;
    } else if (type === "pharmacy-logo") {
      if (!entityId) {
        return NextResponse.json(
          { success: false, error: "entityId (pharmacy ID) is required for pharmacy-logo uploads" },
          { status: 400 }
        );
      }
      if (isPharmacyAdmin && !isAdmin) {
        if (entityId !== scope.pharmacyId) {
          return NextResponse.json(
            { success: false, error: "You can only upload a logo for your own pharmacy" },
            { status: 403 }
          );
        }
      }
      bucket = "pharmacy-logos";
      filePath = `logos/${safeName}-${timestamp}-${randomId}.${ext}`;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid upload type. Use 'medication', 'category', or 'pharmacy-logo'" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: buckets } = await adminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b: { name: string }) => b.name === bucket);
    if (!bucketExists) {
      const { error: createBucketError } = await adminClient.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 3 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      if (createBucketError && !createBucketError.message?.includes("already exists")) {
        console.error("Bucket creation error:", createBucketError);
        return NextResponse.json(
          { success: false, error: `Storage setup failed: ${createBucketError.message}` },
          { status: 500 }
        );
      }
    }

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = adminClient.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    if (type === "medication" && entityId) {
      const { error: updateError } = await adminClient
        .from("pharmacy_medications")
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId);

      if (updateError) {
        console.error("DB update error, cleaning up uploaded file:", updateError);
        await adminClient.storage.from(bucket).remove([filePath]);
        return NextResponse.json(
          { success: false, error: "Failed to save image. Please try again." },
          { status: 500 }
        );
      }
    } else if (type === "category" && entityId) {
      const { error: updateError } = await adminClient
        .from("categories")
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", parseInt(entityId));

      if (updateError) {
        console.error("DB update error, cleaning up uploaded file:", updateError);
        await adminClient.storage.from(bucket).remove([filePath]);
        return NextResponse.json(
          { success: false, error: "Failed to save image. Please try again." },
          { status: 500 }
        );
      }
    } else if (type === "pharmacy-logo" && entityId) {
      const { data: updatedRows, error: updateError } = await adminClient
        .from("pharmacies")
        .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId)
        .select("id");

      if (updateError) {
        console.error("DB update error, cleaning up uploaded file:", updateError);
        await adminClient.storage.from(bucket).remove([filePath]);
        return NextResponse.json(
          { success: false, error: "Failed to save logo. Please try again." },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        await adminClient.storage.from(bucket).remove([filePath]);
        return NextResponse.json(
          { success: false, error: "Pharmacy not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
