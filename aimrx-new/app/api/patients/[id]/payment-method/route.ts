import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/supabase";
import { getUser } from "@core/auth";

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  const Stripe = (await import("stripe")).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
  });
}

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: "Payment service is not configured" },
        { status: 503 }
      );
    }

    const stripe = await getStripe();
    const supabase = await createClient();

    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole);
    if (!isAdmin) {
      const { data: patientCheck } = await supabase
        .from("patients")
        .select("id")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (!patientCheck) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    }

    const { paymentMethodId } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "Payment method ID is required" },
        { status: 400 }
      );
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email, stripe_customer_id")
      .eq("id", params.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    let stripeCustomerId = patient.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: patient.email,
        name: `${patient.first_name} ${patient.last_name}`,
        metadata: {
          patient_id: patient.id,
        },
      });

      stripeCustomerId = customer.id;

      const { error: updateError } = await supabase
        .from("patients")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", params.id);

      if (updateError) {
        console.error("Error updating patient with Stripe customer ID:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to save Stripe customer ID" },
          { status: 500 }
        );
      }
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return NextResponse.json({
      success: true,
      stripeCustomerId,
      message: "Payment method saved successfully",
    });
  } catch (error: unknown) {
    console.error("Error saving payment method:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save payment method";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: "Payment service is not configured" },
        { status: 503 }
      );
    }

    const stripe = await getStripe();
    const supabase = await createClient();

    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole);
    if (!isAdmin) {
      const { data: patientCheck } = await supabase
        .from("patients")
        .select("id")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (!patientCheck) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("stripe_customer_id")
      .eq("id", params.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    if (!patient.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        hasPaymentMethod: false,
      });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: patient.stripe_customer_id,
      type: "card",
    });

    return NextResponse.json({
      success: true,
      hasPaymentMethod: paymentMethods.data.length > 0,
      paymentMethod: paymentMethods.data[0]
        ? {
            last4: paymentMethods.data[0].card?.last4,
            brand: paymentMethods.data[0].card?.brand,
            exp_month: paymentMethods.data[0].card?.exp_month,
            exp_year: paymentMethods.data[0].card?.exp_year,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("Error checking payment method:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to check payment method";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
