import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";
import { getUser } from "@/core/auth/get-user";
import { testPioneerRxConnection, type PioneerRxBackend } from "@/app/api/prescriptions/_shared/pioneerrx-helpers";

export async function POST(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user || !["admin", "super_admin"].includes(userRole || "")) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { backendId, pharmacyId } = body;

    if (!backendId && !pharmacyId) {
      return NextResponse.json({ success: false, error: "backendId or pharmacyId is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    let query = supabaseAdmin
      .from("pharmacy_backends")
      .select("id, pharmacy_id, api_key_encrypted, api_url, store_id, location_id, system_type");

    if (backendId) {
      query = query.eq("id", backendId);
    } else {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: backend, error: backendError } = await query
      .eq("system_type", "PioneerRx")
      .eq("is_active", true)
      .single();

    if (backendError || !backend) {
      return NextResponse.json({ success: false, error: "PioneerRx backend not found" }, { status: 404 });
    }

    const rawKey = isEncrypted(backend.api_key_encrypted)
      ? decryptApiKey(backend.api_key_encrypted)
      : backend.api_key_encrypted;

    const parts = rawKey.split("|");
    const apiKey = parts[0];
    const sharedSecret = parts.length >= 2 ? parts[1] : "";
    const employeeId = parts.length >= 3 ? parts[2] : null;

    if (!sharedSecret) {
      return NextResponse.json({
        success: false,
        error: "Shared secret not configured — expected 'apiKey|sharedSecret' format in api_key_encrypted",
      });
    }

    if (!backend.api_url) {
      return NextResponse.json({ success: false, error: "API URL not configured for this PioneerRx backend" });
    }

    const prxBackend: PioneerRxBackend = {
      apiKey,
      sharedSecret,
      baseUrl: backend.api_url.replace(/\/+$/, ""),
      storeId: backend.store_id,
      locationId: backend.location_id,
      employeeId,
    };

    let outboundIp = "unknown";
    try {
      const ipResp = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
      const ipData = await ipResp.json();
      outboundIp = ipData.ip;
    } catch {
      try {
        const ipResp = await fetch("https://ifconfig.me/ip", { signal: AbortSignal.timeout(5000) });
        outboundIp = (await ipResp.text()).trim();
      } catch { /* ignore */ }
    }

    const result = await testPioneerRxConnection(prxBackend);

    return NextResponse.json({
      ...result,
      outboundIp,
      apiUrl: prxBackend.baseUrl,
      apiKeyPrefix: apiKey.substring(0, 12) + "...",
      hasSharedSecret: sharedSecret.length > 0,
      employeeId: employeeId || "default (2005)",
      storeId: backend.store_id || "not set",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
