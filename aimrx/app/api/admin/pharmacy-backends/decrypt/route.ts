import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { isEncrypted, decryptApiKey } from "@core/security/encryption";

/**
 * POST /api/admin/pharmacy-backends/decrypt
 * Decrypts an API key for testing/verification purposes (admin only)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  try {
    // Get current user
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

    // Check if user is admin or platform owner
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

    const { backendId } = await request.json();

    if (!backendId) {
      return NextResponse.json(
        { success: false, error: "Backend ID is required" },
        { status: 400 }
      );
    }

    // Fetch the encrypted API key
    const { data: backend, error: backendError } = await supabase
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

    // Check if it's encrypted and decrypt
    let decryptedKey: string;
    let wasEncrypted: boolean;

    if (isEncrypted(encryptedKey)) {
      decryptedKey = decryptApiKey(encryptedKey);
      wasEncrypted = true;
    } else {
      // Not encrypted - return as-is (legacy data)
      decryptedKey = encryptedKey;
      wasEncrypted = false;
    }

    // Log this action for audit purposes
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email || "unknown@example.com",
      user_name: user.email?.split("@")[0] || "Admin",
      action: "API_KEY_DECRYPTED",
      details: `Admin decrypted API key for backend ${backendId} (was encrypted: ${wasEncrypted})`,
      status: "info",
    });

    // Mask the key for security - only show first 8 and last 4 characters
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
