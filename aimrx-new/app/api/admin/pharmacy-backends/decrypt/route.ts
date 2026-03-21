import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { isEncrypted, decryptApiKey } from "@core/security/encryption";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  try {
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

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "This action is restricted to platform administrators" },
        { status: 403 }
      );
    }

    const { backendId } = await request.json();

    if (!backendId) {
      return NextResponse.json(
        { success: false, error: "Backend ID is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: backend, error: backendError } = await adminClient
      .from("pharmacy_backends")
      .select("api_key_encrypted")
      .eq("id", backendId)
      .single();

    if (backendError || !backend) {
      return NextResponse.json(
        { success: false, error: "Backend not found" },
        { status: 404 }
      );
    }

    const encryptedKey = backend.api_key_encrypted;

    let decryptedKey: string;
    let wasEncrypted: boolean;

    if (isEncrypted(encryptedKey)) {
      decryptedKey = decryptApiKey(encryptedKey);
      wasEncrypted = true;
    } else {
      decryptedKey = encryptedKey;
      wasEncrypted = false;
    }

    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email || "unknown@example.com",
      user_name: user.email?.split("@")[0] || "Admin",
      action: "API_KEY_DECRYPTED",
      details: `Admin decrypted API key for backend ${backendId} (was encrypted: ${wasEncrypted})`,
      status: "info",
    });

    const maskedKey =
      decryptedKey.length > 12
        ? `${decryptedKey.substring(0, 8)}...${decryptedKey.substring(decryptedKey.length - 4)}`
        : "****";

    return NextResponse.json({
      success: true,
      decryptedKey: maskedKey,
      wasEncrypted,
    });
  } catch (error) {
    console.error("Error decrypting API key:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Decryption failed",
      },
      { status: 500 }
    );
  }
}
