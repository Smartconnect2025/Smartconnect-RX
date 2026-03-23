import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET() {
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
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Provider profile fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
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

    const { data: existing } = await adminClient
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const section = body._section || "payment";

    if (section === "personal") {
      const updateData: Record<string, unknown> = {
        avatar_url: body.avatar_url,
        signature_url: body.signature_url || null,
        npi_number: body.npi_number || null,
        company_name: body.company_name || null,
        medical_licenses: body.medical_licenses || null,
        licensed_states: body.licensed_states || null,
        tax_id: body.tax_id || null,
        payment_method: body.payment_method || null,
        payment_schedule: body.payment_schedule || null,
        payment_details: body.payment_details || null,
        default_shipping_fee: body.default_shipping_fee ?? null,
        updated_at: new Date().toISOString(),
      };

      if (body.physical_address !== undefined) updateData.physical_address = body.physical_address;
      if (body.billing_address !== undefined) updateData.billing_address = body.billing_address;

      if (existing) {
        const { data: result, error: updateError } = await adminClient
          .from("providers")
          .update(updateData)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating personal info:", updateError);
          return NextResponse.json({ error: "Failed to update personal info", details: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      } else {
        const { data: result, error: insertError } = await adminClient
          .from("providers")
          .insert({ user_id: user.id, ...updateData, created_at: new Date().toISOString() })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating personal info:", insertError);
          return NextResponse.json({ error: "Failed to create personal info", details: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      }
    }

    if (section === "professional") {
      const updateData: Record<string, unknown> = {
        npi_number: body.npi_number || null,
        dea_number: body.dea_number || null,
        specialties: body.specialties || null,
        medical_licenses: body.medical_licenses || null,
        board_certifications: body.board_certifications || null,
        education_training: body.education_training || null,
        languages_spoken: body.languages_spoken || null,
        professional_associations: body.professional_associations || null,
        years_of_experience: body.years_of_experience,
        professional_bio: body.professional_bio,
        specialty: body.specialty || null,
        licensed_states: body.licensed_states || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { data: result, error: updateError } = await adminClient
          .from("providers")
          .update(updateData)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating professional info:", updateError);
          return NextResponse.json({ error: "Failed to update professional info", details: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      } else {
        const { data: result, error: insertError } = await adminClient
          .from("providers")
          .insert({ user_id: user.id, ...updateData, created_at: new Date().toISOString() })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating professional info:", insertError);
          return NextResponse.json({ error: "Failed to create professional info", details: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      }
    }

    if (section === "practice") {
      const updateData: Record<string, unknown> = {
        services_offered: body.services_offered || null,
        insurance_plans_accepted: body.insurance_plans_accepted || null,
        hospital_affiliations: body.hospital_affiliations || null,
        service_types: body.service_types || null,
        insurance_plans: body.insurance_plans || null,
        updated_at: new Date().toISOString(),
      };

      if (body.practice_address !== undefined) updateData.practice_address = body.practice_address;

      if (existing) {
        const { data: result, error: updateError } = await adminClient
          .from("providers")
          .update(updateData)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating practice details:", updateError);
          return NextResponse.json({ error: "Failed to update practice details", details: updateError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      } else {
        const { data: result, error: insertError } = await adminClient
          .from("providers")
          .insert({ user_id: user.id, ...updateData, created_at: new Date().toISOString() })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating practice details:", insertError);
          return NextResponse.json({ error: "Failed to create practice details", details: insertError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, provider: result });
      }
    }

    if (section === "avatar") {
      const { data: result, error: updateError } = await adminClient
        .from("providers")
        .update({ avatar_url: body.avatar_url, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating avatar:", updateError);
        return NextResponse.json({ error: "Failed to update avatar", details: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, provider: result });
    }

    if (section === "create") {
      if (existing) {
        const { data: result } = await adminClient
          .from("providers")
          .select("*")
          .eq("user_id", user.id)
          .single();
        return NextResponse.json({ success: true, provider: result });
      }

      const { data: result, error: insertError } = await adminClient
        .from("providers")
        .insert({
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating provider profile:", insertError);
        return NextResponse.json({ error: "Failed to create provider profile", details: insertError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, provider: result });
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
