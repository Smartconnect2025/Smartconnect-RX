import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

const DEFAULT_STANDARD_CENTS = 4000;
const DEFAULT_REFRIGERATED_CENTS = 5500;

function buildOptions(standardCents: number, refrigeratedCents: number) {
  return [
    { id: "standard_overnight", label: "Standard Overnight", price_cents: standardCents },
    { id: "refrigerated_overnight", label: "Refrigerated Overnight", price_cents: refrigeratedCents },
  ];
}

async function getShippingConfig(pharmacyId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pharmacy_payment_configs")
    .select("stripe_publishable_key")
    .eq("pharmacy_id", pharmacyId)
    .eq("gateway", "shipping_config")
    .maybeSingle();

  if (data?.stripe_publishable_key) {
    try {
      const config = JSON.parse(data.stripe_publishable_key);
      return {
        standard: config.standard_overnight_cents ?? DEFAULT_STANDARD_CENTS,
        refrigerated: config.refrigerated_overnight_cents ?? DEFAULT_REFRIGERATED_CENTS,
      };
    } catch {}
  }
  return { standard: DEFAULT_STANDARD_CENTS, refrigerated: DEFAULT_REFRIGERATED_CENTS };
}

export async function GET(request: NextRequest) {
  try {
    const pharmacyId = request.nextUrl.searchParams.get("pharmacyId");
    if (!pharmacyId) {
      return NextResponse.json({ success: true, options: buildOptions(DEFAULT_STANDARD_CENTS, DEFAULT_REFRIGERATED_CENTS) });
    }

    const config = await getShippingConfig(pharmacyId);
    return NextResponse.json({ success: true, options: buildOptions(config.standard, config.refrigerated) });
  } catch {
    return NextResponse.json({ success: true, options: buildOptions(DEFAULT_STANDARD_CENTS, DEFAULT_REFRIGERATED_CENTS) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pharmacyId, standard_overnight_cents, refrigerated_overnight_cents } = body;

    if (!pharmacyId) {
      return NextResponse.json({ success: false, error: "pharmacyId is required" }, { status: 400 });
    }

    const standardCents = typeof standard_overnight_cents === "number" ? standard_overnight_cents : DEFAULT_STANDARD_CENTS;
    const refrigeratedCents = typeof refrigerated_overnight_cents === "number" ? refrigerated_overnight_cents : DEFAULT_REFRIGERATED_CENTS;

    const configJson = JSON.stringify({
      standard_overnight_cents: standardCents,
      refrigerated_overnight_cents: refrigeratedCents,
    });

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("pharmacy_payment_configs")
      .select("id")
      .eq("pharmacy_id", pharmacyId)
      .eq("gateway", "shipping_config")
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("pharmacy_payment_configs")
        .update({
          stripe_publishable_key: configJson,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("pharmacy_payment_configs")
        .insert({
          pharmacy_id: pharmacyId,
          gateway: "shipping_config",
          is_active: true,
          environment: "production",
          stripe_publishable_key: configJson,
        });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to save" }, { status: 500 });
  }
}
