import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { envConfig } from "@core/config";
import { cookies } from "next/headers";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

// PUT - Update medication
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in server components
            }
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const body = await request.json();
    const { id } = params;

    const { data, error } = await supabase
      .from("medication_catalog")
      .update({
        medication_name: body.medication_name,
        vial_size: body.vial_size || null,
        dosage_amount: body.dosage_amount || null,
        dosage_unit: body.dosage_unit || null,
        form: body.form || null,
        quantity: body.quantity || null,
        refills: body.refills || null,
        sig: body.sig || null,
        pharmacy_notes: body.pharmacy_notes || null,
        patient_price: body.patient_price || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating medication:", error);
      return NextResponse.json(
        { error: "Failed to update medication" },
        { status: 500 }
      );
    }

    return NextResponse.json({ medication: data });
  } catch (error) {
    console.error("Error in PUT /api/medication-catalog/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete medication
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      envConfig.NEXT_PUBLIC_SUPABASE_URL,
      envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in server components
            }
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demoCheck2 = await requireNonDemo();
    if (!demoCheck2.success) return createGuardErrorResponse(demoCheck2);

    const { id } = params;

    const { error } = await supabase
      .from("medication_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting medication:", error);
      return NextResponse.json(
        { error: "Failed to delete medication" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/medication-catalog/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
