import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";
import { encryptApiKey } from "@core/security/encryption";

const FMV_DISCLOSURE_VERSION = "2026-05-18-v1";

interface AchInput {
  bank_name?: string | null;
  account_holder?: string | null;
  routing_number?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  fmv_disclosure_accepted?: boolean;
}

function sanitizeDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: provider } = await adminClient
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const { data: ach } = await adminClient
      .from("provider_ach_info")
      .select(
        "bank_name, account_holder, account_last4, account_type, fmv_disclosure_accepted_at, fmv_disclosure_version, updated_at"
      )
      .eq("provider_id", provider.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      ach: ach || null,
      fmv_disclosure_version: FMV_DISCLOSURE_VERSION,
    });
  } catch (error) {
    console.error("Provider ACH fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = (await request.json()) as AchInput;
    const adminClient = createAdminClient();

    const { data: provider } = await adminClient
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const routing = sanitizeDigits(body.routing_number);
    const account = sanitizeDigits(body.account_number);
    const accountType = body.account_type?.trim() || null;

    if (routing && routing.length !== 9) {
      return NextResponse.json(
        { error: "Routing number must be 9 digits" },
        { status: 400 }
      );
    }
    if (account && account.length < 4) {
      return NextResponse.json(
        { error: "Account number must be at least 4 digits" },
        { status: 400 }
      );
    }
    if (accountType && !["checking", "savings"].includes(accountType)) {
      return NextResponse.json(
        { error: "Account type must be checking or savings" },
        { status: 400 }
      );
    }

    const updateRow: Record<string, unknown> = {
      provider_id: provider.id,
      bank_name: body.bank_name?.trim() || null,
      account_holder: body.account_holder?.trim() || null,
      account_type: accountType,
      updated_at: new Date().toISOString(),
    };

    if (routing) {
      updateRow.routing_encrypted = encryptApiKey(routing);
    }
    if (account) {
      updateRow.account_encrypted = encryptApiKey(account);
      updateRow.account_last4 = account.slice(-4);
    }

    if (body.fmv_disclosure_accepted) {
      updateRow.fmv_disclosure_accepted_at = new Date().toISOString();
      updateRow.fmv_disclosure_version = FMV_DISCLOSURE_VERSION;
    }

    const { error: upsertError } = await adminClient
      .from("provider_ach_info")
      .upsert(updateRow, { onConflict: "provider_id" });

    if (upsertError) {
      console.error("Error upserting provider ACH:", upsertError);
      return NextResponse.json({ error: "Failed to save ACH info" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Provider ACH save error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
