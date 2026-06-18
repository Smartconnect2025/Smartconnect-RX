import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import {
  buildAgreementText,
  hashAgreement,
  CURRENT_AGREEMENT_VERSION,
} from "@core/lib/delegations/agreement";

/**
 * GET /api/provider/delegations
 * Returns delegations for the calling provider, ordered by created_at desc.
 *
 * POST /api/provider/delegations
 * Provider creates a request for an assistant. Body:
 *   {
 *     delegate_first_name: string,
 *     delegate_last_name: string,
 *     delegate_email: string,
 *     delegate_phone?: string,
 *     delegate_title: string,        // free-text label
 *     scope_refills: boolean,
 *     scope_new_rx: boolean,
 *     password: string,              // step-up: the provider's current password
 *   }
 * Server captures: provider's signature snapshot (from providers.signature_url),
 * agreement text + sha256 + version, IP, timestamp. Status defaults to
 * 'pending_admin' so the admin "Provider Assistance" tab picks it up.
 */
export async function GET() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "provider") {
    return NextResponse.json(
      { error: "Provider access required" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  // Resolve provider row for this user
  const { data: provider, error: provErr } = await supabase
    .from("providers")
    .select("id, npi_number, first_name, last_name, signature_url, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (provErr) {
    return NextResponse.json(
      { error: "Failed to load provider profile", details: provErr.message },
      { status: 500 },
    );
  }
  if (!provider) {
    return NextResponse.json(
      { error: "No provider record linked to this account" },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("delegations")
    .select(
      "id, delegate_first_name, delegate_last_name, delegate_email, delegate_phone, delegate_title, delegate_user_id, scope_refills, scope_new_rx, status, created_at, admin_action_at, admin_rejection_reason, delegate_signed_at, revoked_at, revoke_reason",
    )
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load delegations", details: error.message },
      { status: 500 },
    );
  }

  // Sub-lookup each provisioned assistant's own providers row so the UI can
  // show the currently-assigned tier on each card. The supervising provider
  // (this caller) can set this override from the same card via
  // POST /api/provider/delegations/[id]/tier.
  const delegations = data ?? [];
  const delegateUserIds = delegations
    .map((d) => d.delegate_user_id)
    .filter((id): id is string => Boolean(id));

  const assistantProviderMap = new Map<
    string,
    {
      id: string;
      tier_code: string | null;
      tier_name: string | null;
      discount_percentage: number | null;
      // Mirrors the assistant's own providers.pay_on_terms onto the
      // provider's Provider Assistance tab so the supervising provider
      // can see and toggle whether her assistant's orders bypass the
      // patient payment flow.
      pay_on_terms: boolean;
    }
  >();
  if (delegateUserIds.length > 0) {
    const { data: assistantProviders } = await supabase
      .from("providers")
      .select("id, user_id, tier_level, pay_on_terms")
      .in("user_id", delegateUserIds);

    const distinctTierCodes = Array.from(
      new Set(
        (assistantProviders ?? [])
          .map((p) => p.tier_level)
          .filter((c): c is string => Boolean(c)),
      ),
    );
    const tierMetaMap = new Map<
      string,
      { tier_name: string; discount_percentage: number }
    >();
    if (distinctTierCodes.length > 0) {
      const { data: tiersData } = await supabase
        .from("tiers")
        .select("tier_code, tier_name, discount_percentage")
        .in("tier_code", distinctTierCodes);
      (tiersData ?? []).forEach((t) => {
        if (t.tier_code) {
          tierMetaMap.set(t.tier_code, {
            tier_name: t.tier_name,
            discount_percentage: parseFloat(
              String(t.discount_percentage ?? "0"),
            ),
          });
        }
      });
    }

    (assistantProviders ?? []).forEach((p) => {
      if (p.user_id) {
        const meta = p.tier_level ? tierMetaMap.get(p.tier_level) ?? null : null;
        assistantProviderMap.set(p.user_id, {
          id: p.id,
          tier_code: p.tier_level ?? null,
          tier_name: meta?.tier_name ?? null,
          discount_percentage: meta?.discount_percentage ?? null,
          pay_on_terms: p.pay_on_terms === true,
        });
      }
    });
  }

  const enriched = delegations.map((d) => ({
    ...d,
    assistant_provider:
      d.delegate_user_id && assistantProviderMap.has(d.delegate_user_id)
        ? assistantProviderMap.get(d.delegate_user_id)
        : null,
  }));

  return NextResponse.json({
    delegations: enriched,
    provider: {
      id: provider.id,
      npi_number: provider.npi_number,
      first_name: provider.first_name,
      last_name: provider.last_name,
      has_signature: !!provider.signature_url,
      is_active: provider.is_active,
    },
  });
}

interface CreateBody {
  delegate_first_name?: string;
  delegate_last_name?: string;
  delegate_email?: string;
  delegate_phone?: string;
  delegate_title?: string;
  scope_refills?: boolean;
  scope_new_rx?: boolean;
  password?: string;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user || !user.email) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "provider") {
    return NextResponse.json(
      { error: "Provider access required" },
      { status: 403 },
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Field validation
  const firstName = body.delegate_first_name?.trim();
  const lastName = body.delegate_last_name?.trim();
  const email = body.delegate_email?.trim().toLowerCase();
  const phone = body.delegate_phone?.trim() || null;
  const title = body.delegate_title?.trim();
  const scopeRefills = body.scope_refills === true;
  const scopeNewRx = body.scope_new_rx === true;
  const password = body.password ?? "";

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Assistant first and last name are required" },
      { status: 400 },
    );
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "A valid assistant email is required" },
      { status: 400 },
    );
  }
  if (!title || title.length < 2) {
    return NextResponse.json(
      { error: "A title/role label is required (e.g. \"Office Nurse\")" },
      { status: 400 },
    );
  }
  if (!scopeRefills && !scopeNewRx) {
    return NextResponse.json(
      { error: "At least one scope (refills or new prescriptions) is required" },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json(
      {
        error:
          "Re-enter your AimRx password to confirm this authorization (step-up auth)",
      },
      { status: 400 },
    );
  }

  // Step-up auth: re-verify the provider's password.
  const supabase = createAdminClient();
  // Build a transient client from anon key so signInWithPassword does not
  // disturb the caller's existing session.
  const { createClient } = await import("@supabase/supabase-js");
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: stepUpError } = await anonClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (stepUpError) {
    return NextResponse.json(
      { error: "Password did not match. Please try again." },
      { status: 401 },
    );
  }
  // Discard the transient session locally only. NEVER call signOut() with no
  // args here — Supabase's default scope is "global", which would revoke the
  // refresh token server-side and kill the provider's real browser session
  // (causing an immediate "Session expired" redirect right after submitting
  // an assistant for approval).
  await anonClient.auth.signOut({ scope: "local" }).catch(() => {});

  // Resolve provider for this user
  const { data: provider, error: provErr } = await supabase
    .from("providers")
    .select(
      "id, npi_number, first_name, last_name, signature_url, is_active, user_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (provErr || !provider) {
    return NextResponse.json(
      { error: "No active provider record linked to this account" },
      { status: 404 },
    );
  }
  if (!provider.is_active) {
    return NextResponse.json(
      {
        error:
          "Your provider account is not active. Complete profile and verification before requesting an assistant.",
      },
      { status: 403 },
    );
  }
  if (!provider.npi_number) {
    return NextResponse.json(
      {
        error:
          "An NPI is required on your profile before authorizing an assistant.",
      },
      { status: 400 },
    );
  }
  if (!provider.signature_url) {
    return NextResponse.json(
      {
        error:
          "Your signature is required on your profile before authorizing an assistant.",
      },
      { status: 400 },
    );
  }

  // Build + hash the agreement text the provider just consented to.
  const providerName =
    `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name ?? ""} ${provider.last_name ?? ""}`.trim() ||
    "Provider";
  const delegateName = `${firstName} ${lastName}`;
  const agreementText = buildAgreementText({
    providerName,
    providerNpi: provider.npi_number,
    delegateName,
    delegateTitle: title,
    scopeRefills,
    scopeNewRx,
  });
  const agreementHash = hashAgreement(agreementText);

  const ip = getClientIp(request);
  const now = new Date().toISOString();

  // Insert (service-role bypasses RLS). The unique-active partial index will
  // surface a duplicate as a 23505 — we translate to a friendly 409.
  const { data: created, error: insertErr } = await supabase
    .from("delegations")
    .insert({
      delegate_first_name: firstName,
      delegate_last_name: lastName,
      delegate_email: email,
      delegate_phone: phone,
      delegate_title: title,
      provider_id: provider.id,
      scope_refills: scopeRefills,
      scope_new_rx: scopeNewRx,
      status: "pending_admin",
      agreement_version: CURRENT_AGREEMENT_VERSION,
      agreement_text_hash: agreementHash,
      agreement_text_snapshot: agreementText,
      provider_signature_url: provider.signature_url,
      provider_signed_at: now,
      provider_signed_ip: ip,
    })
    .select("id")
    .single();

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json(
        {
          error:
            "An active or pending request already exists for that email. Revoke it first if you want to start over.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to submit request", details: insertErr.message },
      { status: 500 },
    );
  }

  // Audit (non-fatal)
  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "DELEGATION_REQUESTED",
      details: `Provider ${providerName} requested assistant ${delegateName} (${email}, ${title}) — delegation ${created.id}`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json(
    {
      success: true,
      delegationId: created.id,
      message:
        "Request submitted. An administrator will review and create the account shortly.",
    },
    { status: 201 },
  );
}
