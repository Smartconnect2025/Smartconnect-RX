import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import {
  submitPrescriptionToPharmacy,
  newRequestId,
} from "@/app/api/prescriptions/_shared/submit-to-pharmacy-core";

/**
 * POST /api/prescriptions/[id]/submit-to-pharmacy
 *
 * Thin HTTP wrapper around the shared submit-to-pharmacy core (see
 * app/api/prescriptions/_shared/submit-to-pharmacy-core.ts).
 *
 * Auth: requires either an authenticated provider/admin or the
 * INTERNAL_API_SECRET header. The HEAVY lifting (DigitalRx fetch,
 * PDF download, claim guard, system_logs) lives in the core module
 * so direct in-process callers (mark-paid, payment-janitor cohort F)
 * can bypass the HTTP hop and the cascading-serverless-timeout that
 * caused the May 4 2026 Felicia silent-fail incident.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: prescriptionId } = await params;

    // ─── Auth ───────────────────────────────────────────────────────
    const internalSecret = request.headers.get("x-internal-secret");
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    let isInternalCall = false;

    if (configuredSecret && configuredSecret.length > 0) {
      if (internalSecret === configuredSecret) {
        isInternalCall = true;
      } else if (internalSecret) {
        return NextResponse.json(
          { success: false, error: "Invalid internal secret" },
          { status: 403 },
        );
      }
    } else if (internalSecret !== undefined && internalSecret !== null) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "⚠️ [submit-to-pharmacy] INTERNAL_API_SECRET not configured in production — rejecting internal call.",
        );
      } else {
        console.warn(
          "⚠️ [submit-to-pharmacy] INTERNAL_API_SECRET not configured — accepting internal call in dev mode.",
        );
        isInternalCall = true;
      }
    }

    let isAdmin = false;
    let authenticatedUserId: string | null = null;
    let callerLabel = "internal-secret";
    if (!isInternalCall) {
      const { user, userRole } = await getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      if (
        !userRole ||
        (userRole !== "provider" &&
          userRole !== "delegate" &&
          userRole !== "admin" &&
          userRole !== "super_admin")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Only providers and admins can submit to pharmacy",
          },
          { status: 403 },
        );
      }
      isAdmin = userRole === "admin" || userRole === "super_admin";
      authenticatedUserId = user.id;
      callerLabel = isAdmin ? "admin-ui" : "provider-ui";
    }

    const supabaseAdmin = createAdminClient();

    const result = await submitPrescriptionToPharmacy(
      supabaseAdmin,
      prescriptionId,
      {
        isInternalCall,
        isAdmin,
        authenticatedUserId,
        requestId: newRequestId(),
        callerLabel,
      },
    );

    if (result.ok) {
      return NextResponse.json(
        {
          success: true,
          message:
            result.code === "already_submitted"
              ? "Prescription already submitted"
              : "Submitted to pharmacy",
          queue_id: result.queueId,
        },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        ...(result.queueId ? { queue_id: result.queueId } : {}),
        ...(result.details !== undefined ? { details: result.details } : {}),
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    // The shared core has its own outer try/catch — this is the route-
    // level safety net for auth/parsing errors only.
    console.error(
      "[submit-to-pharmacy route] uncaught:",
      error instanceof Error ? error.stack : error,
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
