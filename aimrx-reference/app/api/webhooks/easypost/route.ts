import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { applyTrackingUpdate } from "../../prescriptions/_shared/tracking-sync";
import crypto from "crypto";

const EASYPOST_WEBHOOK_SECRET = process.env.EASYPOST_WEBHOOK_SECRET || process.env.EASYPOST_API_KEY;

function verifyWebhook(rawBody: Buffer, hmacHeader: string | null): boolean {
  if (!EASYPOST_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("[webhook/easypost] No EASYPOST_WEBHOOK_SECRET or EASYPOST_API_KEY set — cannot verify");
      return false;
    }
    console.warn("[webhook/easypost] No webhook secret configured (dev mode) — accepting event");
    return true;
  }

  if (!hmacHeader) {
    console.error("[webhook/easypost] No x-hmac-signature header present — rejecting");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", EASYPOST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const providedSignature = hmacHeader.replace(/^hmac-sha256-hex=/, "");

    if (expectedSignature.length !== providedSignature.length) {
      console.error(`[webhook/easypost] Signature length mismatch: expected ${expectedSignature.length}, got ${providedSignature.length}`);
      return false;
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedSignature, "hex"),
    );

    if (!valid) {
      console.error(`[webhook/easypost] HMAC mismatch. Expected prefix: ${expectedSignature.slice(0, 12)}..., Got prefix: ${providedSignature.slice(0, 12)}...`);
    }

    return valid;
  } catch (err) {
    console.error(`[webhook/easypost] Verification error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBodyBuffer = Buffer.from(await request.arrayBuffer());
    const hmacHeader = request.headers.get("x-hmac-signature");

    if (!verifyWebhook(rawBodyBuffer, hmacHeader)) {
      console.error("[webhook/easypost] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBodyBuffer.toString("utf-8"));

    if (body.description !== "tracker.updated" && body.description !== "tracker.created") {
      return NextResponse.json({ ok: true });
    }

    const tracker = body.result;
    if (!tracker) {
      return NextResponse.json({ ok: true });
    }

    const trackerId = tracker.id;
    const trackingCode = tracker.tracking_code;

    if (!trackerId && !trackingCode) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminClient();

    let prescription;

    if (trackerId) {
      const { data } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("easypost_tracker_id", trackerId)
        .single();
      prescription = data;
    }

    if (!prescription && trackingCode) {
      const { data } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("tracking_number", trackingCode)
        .single();
      prescription = data;
    }

    if (!prescription) {
      console.warn(
        `[webhook/easypost] No prescription found for tracker ${trackerId} / tracking ${trackingCode}`,
      );
      return NextResponse.json({ ok: true });
    }

    const result = await applyTrackingUpdate(
      prescription.id,
      tracker,
      "easypost-webhook",
    );

    if (result.updated) {
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@easypost.com",
        user_name: "EasyPost Webhook",
        action: "EASYPOST_TRACKING_UPDATE",
        details: `Tracking updated for prescription ${prescription.id}: ${tracker.status || "unknown"}`,
        status: "success",
      });
    }

    return NextResponse.json({ ok: true, updated: result.updated });
  } catch (error) {
    console.error("[webhook/easypost] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
