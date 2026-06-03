import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import {
  getRedsailConfigsForPharmacy,
  upsertRedsailConfig,
  setRedsailActive,
  maskCredential,
  type RedsailEnvironment,
} from "@/core/services/redsailPaymentConfigService";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

const VALID_ENVIRONMENTS: RedsailEnvironment[] = ["ftr1", "prv", "production"];
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function authorize(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const scope = await getPharmacyAdminScope(user.id);

  return { user, userRole, scope };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const { userRole, scope } = auth;

    let pharmacyId = request.nextUrl.searchParams.get("pharmacyId");
    if (scope.isPharmacyAdmin) pharmacyId = scope.pharmacyId;

    if (!pharmacyId) {
      return NextResponse.json({ error: "pharmacyId is required" }, { status: 400 });
    }
    if (userRole?.role !== "admin" && !scope.isPharmacyAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await getRedsailConfigsForPharmacy(pharmacyId);

    const masked = configs.map((c) => ({
      id: c.id,
      pharmacyId: c.pharmacyId,
      environment: c.environment,
      isActive: c.isActive,
      isConnected: c.isConnected,
      label: c.label,
      tenantId: c.tenantId,
      siteId: c.siteId,
      stationId: c.stationId,
      oidcClientId: c.oidcClientId,
      oidcClientSecretMasked: maskCredential(c.oidcClientSecret),
      webhookAudience: c.webhookAudience,
      apiBaseUrl: c.apiBaseUrl,
      hasCredentials: !!(c.tenantId && c.oidcClientId && c.oidcClientSecret),
    }));

    return NextResponse.json({ success: true, configs: masked });
  } catch (error) {
    console.error("[REDSAIL-PAYMENT-CONFIG] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const { userRole, scope } = auth;

    const body = await request.json();
    const { environment, label, deactivate } = body;
    let pharmacyId = body.pharmacyId;
    if (scope.isPharmacyAdmin) pharmacyId = scope.pharmacyId;

    if (!pharmacyId) {
      return NextResponse.json({ error: "pharmacyId is required" }, { status: 400 });
    }
    if (userRole?.role !== "admin" && !scope.isPharmacyAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (deactivate) {
      const result = await setRedsailActive(pharmacyId, false);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to deactivate RedSail" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, message: "RedSail Pay switched off" });
    }

    if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
      return NextResponse.json(
        { error: "environment must be 'ftr1', 'prv', or 'production'" },
        { status: 400 },
      );
    }

    if (body.tenantId && !GUID_REGEX.test(body.tenantId)) {
      return NextResponse.json(
        { error: "Tenant ID must be a valid GUID (provided by RedSail)" },
        { status: 400 },
      );
    }

    const result = await upsertRedsailConfig({
      pharmacyId,
      environment: environment || "ftr1",
      label,
      tenantId: body.tenantId,
      siteId: body.siteId,
      stationId: body.stationId,
      oidcClientId: body.oidcClientId,
      oidcClientSecret: body.oidcClientSecret,
      webhookAudience: body.webhookAudience,
      apiBaseUrl: body.apiBaseUrl,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save RedSail configuration" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      configId: result.configId,
      message:
        "RedSail configuration saved. It stays switched off until you verify the connection.",
    });
  } catch (error) {
    console.error("[REDSAIL-PAYMENT-CONFIG] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const { userRole, scope } = auth;

    const body = await request.json();
    const { action } = body;
    let pharmacyId = body.pharmacyId;
    if (scope.isPharmacyAdmin) pharmacyId = scope.pharmacyId;

    if (!pharmacyId) {
      return NextResponse.json({ error: "pharmacyId is required" }, { status: 400 });
    }
    if (userRole?.role !== "admin" && !scope.isPharmacyAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "test") {
      // Format/readiness validation. A real connection check requires the
      // Emporos .NET SDK + provisioned credentials, which are not yet available,
      // so we validate that everything needed is present and well-formed and
      // report clearly that live verification is pending RedSail provisioning.
      const missing: string[] = [];
      if (!body.tenantId) missing.push("Tenant ID");
      if (!body.oidcClientId) missing.push("Client ID");
      if (!body.oidcClientSecret) missing.push("Client Secret");

      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required field(s): ${missing.join(", ")}`,
          },
          { status: 400 },
        );
      }

      if (!GUID_REGEX.test(body.tenantId)) {
        return NextResponse.json(
          { success: false, error: "Tenant ID must be a valid GUID (provided by RedSail)" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "All required details are present and correctly formatted. Live verification with RedSail will run automatically once their credentials and software access are connected.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[REDSAIL-PAYMENT-CONFIG] PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
