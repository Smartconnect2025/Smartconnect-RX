import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getActivePaymentConfig } from "@/core/services/pharmacyPaymentConfigService";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pharmacyId = request.nextUrl.searchParams.get("pharmacyId");
    if (!pharmacyId) {
      return NextResponse.json(
        { error: "pharmacyId is required" },
        { status: 400 },
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = userRole?.role;

    if (role !== "admin") {
      if (role === "provider") {
        const { data: providerLink } = await supabase
          .from("provider_pharmacy_links")
          .select("provider_id")
          .eq("provider_id", user.id)
          .eq("pharmacy_id", pharmacyId)
          .single();

        if (!providerLink) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        const { data: pharmacyAdmin } = await supabase
          .from("pharmacy_admins")
          .select("id")
          .eq("user_id", user.id)
          .eq("pharmacy_id", pharmacyId)
          .single();

        if (!pharmacyAdmin) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const config = await getActivePaymentConfig(pharmacyId);

    if (!config) {
      return NextResponse.json({
        success: true,
        configured: false,
        gateway: null,
      });
    }

    const responseData: Record<string, unknown> = {
      success: true,
      configured: true,
      gateway: config.gateway,
      environment: config.environment,
    };

    if (config.gateway === "stripe" && config.stripePublishableKey) {
      responseData.stripePublishableKey = config.stripePublishableKey;
    } else if (config.gateway === "stripe") {
      const { envConfig: ec } = await import("@/core/config/envConfig");
      if (ec.STRIPE_PUBLISHABLE_KEY) {
        responseData.stripePublishableKey = ec.STRIPE_PUBLISHABLE_KEY;
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[PHARMACY-GATEWAY] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
