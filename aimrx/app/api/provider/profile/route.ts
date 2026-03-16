import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const adminClient = createAdminClient();

    const { data: provider } = await adminClient
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.physical_address !== undefined) updateData.physical_address = body.physical_address;
    if (body.billing_address !== undefined) updateData.billing_address = body.billing_address;
    if (body.tax_id !== undefined) updateData.tax_id = body.tax_id;
    if (body.payment_details !== undefined) updateData.payment_details = body.payment_details;
    if (body.payment_method !== undefined) updateData.payment_method = body.payment_method;
    if (body.payment_schedule !== undefined) updateData.payment_schedule = body.payment_schedule;

    const { error: updateError } = await adminClient
      .from("providers")
      .update(updateData)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating provider profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Provider profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    const { data: provider, error } = await adminClient
      .from("providers")
      .select("physical_address, billing_address, tax_id, payment_details, payment_method, payment_schedule")
      .eq("user_id", user.id)
      .single();

    if (error || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("Provider profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
