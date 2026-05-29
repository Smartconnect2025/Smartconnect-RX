import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { validateDelegatedAction } from "@/core/lib/delegations/validate";

/**
 * GET /api/delegate/providers/[providerId]/patients
 *
 * Returns the patient panel for a provider the delegate is authorized for.
 * Re-validates the delegation on every call. The provider can have either
 * scope_refills or scope_new_rx (we accept either here — scope is enforced
 * again at submit time).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
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

  const { providerId } = await params;

  // Try refill scope first, then new_rx — either is sufficient to view the
  // patient list.
  let validation = await validateDelegatedAction({
    delegateUserId: user.id,
    providerId,
    action: "submit_refill",
  });
  if (!validation.allowed) {
    validation = await validateDelegatedAction({
      delegateUserId: user.id,
      providerId,
      action: "submit_new_rx",
    });
  }
  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("provider_patient_mappings")
    .select(
      `patients:patient_id (id, first_name, last_name, date_of_birth, email, phone)`,
    )
    .eq("provider_id", providerId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load patients", details: error.message },
      { status: 500 },
    );
  }

  type Row = {
    patients:
      | {
          id: string;
          first_name: string | null;
          last_name: string | null;
          date_of_birth: string | null;
          email: string | null;
          phone: string | null;
        }
      | Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          date_of_birth: string | null;
          email: string | null;
          phone: string | null;
        }>
      | null;
  };

  const patients = ((data ?? []) as Row[])
    .map((r) => (Array.isArray(r.patients) ? r.patients[0] : r.patients))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return NextResponse.json({ patients });
}
