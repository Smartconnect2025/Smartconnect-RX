import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@core/config";

/**
 * GET /api/prescriptions/billing-info?ids=<csv>
 *
 * Returns the minimal prescription + patient data needed by the
 * "Collect Payment" step of the wizard. Uses the admin client so RLS on
 * `prescriptions` and `patients` does not block delegate-role users
 * (Provider Assistants).
 *
 * Authorization: caller must be an admin, or a provider/delegate whose
 * own clinic owns every requested prescription.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids") || "";
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const supabaseAuth = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only auth here.
          },
        },
      },
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;

    // Authorization for provider/delegate: prescription's prescriber_id
    // must belong to a provider in the caller's own clinic. Admins skip
    // this check.
    if (role !== "admin") {
      if (role !== "provider" && role !== "delegate") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: ownProv } = await adminClient
        .from("providers")
        .select("id, company_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownProv?.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      let allowedUserIds: string[] = [user.id];
      if (ownProv.company_name) {
        const { data: clinicRows } = await adminClient
          .from("providers")
          .select("user_id")
          .eq("company_name", ownProv.company_name);
        allowedUserIds = Array.from(
          new Set(
            (clinicRows || [])
              .map((r) => r.user_id as string | null)
              .filter((v): v is string => !!v)
              .concat([user.id]),
          ),
        );
      }

      const { data: ownership } = await adminClient
        .from("prescriptions")
        .select("id, prescriber_id")
        .in("id", ids);
      const allOwned =
        (ownership || []).length === ids.length &&
        (ownership || []).every(
          (r) =>
            r.prescriber_id && allowedUserIds.includes(r.prescriber_id as string),
        );
      if (!allOwned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await adminClient
      .from("prescriptions")
      .select(
        `
        id,
        medication,
        patient_price,
        profit_cents,
        shipping_fee_cents,
        payment_status,
        patient:patients(first_name, last_name, email)
      `,
      )
      .in("id", ids);

    if (error) throw error;
    return NextResponse.json({ prescriptions: data || [] });
  } catch (err) {
    console.error("GET /api/prescriptions/billing-info failed:", err);
    return NextResponse.json(
      { error: "Failed to load prescription details" },
      { status: 500 },
    );
  }
}
