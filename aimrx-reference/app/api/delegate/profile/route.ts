import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * Delegate-only profile endpoint.
 *
 * GET   /api/delegate/profile  → returns the calling assistant's own
 *                                physical/billing address (or empty defaults
 *                                if no row exists yet).
 * PATCH /api/delegate/profile  → upserts physical_address and/or
 *                                billing_address for the calling assistant.
 *
 * STRICT ISOLATION: this endpoint reads and writes ONLY the
 * `delegate_profiles` table. It never touches `providers` or `delegations`.
 */

type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

function isCompleteAddress(v: unknown): v is Address {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.street === "string" && a.street.trim().length > 0 &&
    typeof a.city === "string" && a.city.trim().length > 0 &&
    typeof a.state === "string" && a.state.trim().length > 0 &&
    typeof a.zipCode === "string" && a.zipCode.trim().length > 0 &&
    typeof a.country === "string" && a.country.trim().length > 0
  );
}

export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("delegate_profiles")
    .select("delegate_user_id, physical_address, billing_address, updated_at")
    .eq("delegate_user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load profile", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    profile: data ?? {
      delegate_user_id: user.id,
      physical_address: null,
      billing_address: null,
      updated_at: null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const input = body as {
    physical_address?: unknown;
    billing_address?: unknown;
  };

  // Allow partial writes: only validate fields that were sent. A field may be
  // either a complete address object (saved) or explicitly null (cleared).
  const update: {
    physical_address?: Address | null;
    billing_address?: Address | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if ("physical_address" in input) {
    if (input.physical_address === null) {
      update.physical_address = null;
    } else if (isCompleteAddress(input.physical_address)) {
      update.physical_address = input.physical_address;
    } else {
      return NextResponse.json(
        {
          error:
            "physical_address must include street, city, state, zipCode, and country (or be null)",
        },
        { status: 400 },
      );
    }
  }

  if ("billing_address" in input) {
    if (input.billing_address === null) {
      update.billing_address = null;
    } else if (isCompleteAddress(input.billing_address)) {
      update.billing_address = input.billing_address;
    } else {
      return NextResponse.json(
        {
          error:
            "billing_address must include street, city, state, zipCode, and country (or be null)",
        },
        { status: 400 },
      );
    }
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json(
      { error: "No address fields provided" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("delegate_profiles")
    .upsert(
      { delegate_user_id: user.id, ...update },
      { onConflict: "delegate_user_id" },
    )
    .select("delegate_user_id, physical_address, billing_address, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save profile", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}
