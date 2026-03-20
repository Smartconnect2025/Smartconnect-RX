import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";
import crypto from "crypto";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST(request: NextRequest) {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { backendId } = body;

    if (!backendId) {
      return NextResponse.json(
        { success: false, error: "Backend ID is required" },
        { status: 400 },
      );
    }

    const { data: backend, error: backendError } = await supabase
      .from("pharmacy_backends")
      .select("api_key_encrypted, api_url, store_id, system_type")
      .eq("id", backendId)
      .eq("system_type", "PioneerRx")
      .single();

    if (backendError || !backend) {
      return NextResponse.json(
        { success: false, error: "Pioneer RX backend not found" },
        { status: 404 },
      );
    }

    const rawKey = isEncrypted(backend.api_key_encrypted)
      ? decryptApiKey(backend.api_key_encrypted)
      : backend.api_key_encrypted;

    let apiKey = rawKey;
    let sharedSecret = "";
    const pipeIndex = rawKey.indexOf("|");
    if (pipeIndex > 0 && pipeIndex < rawKey.length - 1) {
      apiKey = rawKey.substring(0, pipeIndex);
      sharedSecret = rawKey.substring(pipeIndex + 1);
    }

    if (!sharedSecret) {
      return NextResponse.json({
        success: false,
        error: "Shared secret not configured — cannot authenticate with Pioneer RX",
      });
    }

    if (!backend.api_url) {
      return NextResponse.json({
        success: false,
        error: "API URL not configured for this Pioneer RX backend",
      });
    }

    const timestamp = new Date().toISOString();
    const saltedValue = timestamp + sharedSecret;
    const encoded = Buffer.from(saltedValue, "utf16le");
    const signature = crypto
      .createHash("sha512")
      .update(encoded)
      .digest("base64");

    const testUrl = `${backend.api_url.replace(/\/+$/, "")}/api/v1/Test/IsAvailableWithAuth`;

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "prx-api-key": apiKey,
        "prx-timestamp": timestamp,
        "prx-signature": signature,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "Pioneer RX API is reachable and credentials are valid",
        status: response.status,
      });
    } else {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json({
        success: false,
        error: `Pioneer RX responded with status ${response.status}${errorText ? `: ${errorText.substring(0, 200)}` : ""}`,
        status: response.status,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("timeout") || message.includes("abort")) {
      return NextResponse.json({
        success: false,
        error: "Connection timed out — Pioneer RX API may be unreachable. Check IP whitelisting.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Connection test failed: ${message}`,
      },
      { status: 500 },
    );
  }
}
