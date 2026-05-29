import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    const userRole = roleRow?.role || null;

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    let pharmacyId: string | null = null;
    const { data: adminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminLink?.pharmacy_id) {
      pharmacyId = adminLink.pharmacy_id;
    }

    let query = supabase
      .from("prescriptions")
      .select(`
        id,
        queue_id,
        submitted_at,
        submitted_to_pharmacy_at,
        updated_at,
        medication,
        dosage,
        quantity,
        refills,
        sig,
        status,
        payment_status,
        tracking_number,
        prescriber_id,
        pharmacy_id,
        pdf_storage_path,
        pdf_push_confirmed_at,
        pdf_validation_error,
        fedex_status,
        estimated_delivery,
        patient_price,
        shipping_fee_cents,
        profit_cents,
        patient_id,
        has_custom_address,
        custom_address,
        patient:patients(first_name, last_name, email, physical_address),
        pharmacy:pharmacies(name, primary_color),
        payment_transactions(id, payment_token)
      `)
      .order("submitted_at", { ascending: false });

    const includeCancelled = request.nextUrl.searchParams.get("includeCancelled") === "true";
    if (includeCancelled) {
      query = query.eq("status", "cancelled");
    } else {
      query = query.neq("status", "cancelled");
    }

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: prescriptionsData, error: prescriptionsError } = await query;

    let groupIdLookup: Record<string, string> = {};
    try {
      const { data: groupRows } = await supabase
        .from("prescriptions")
        .select("id, order_group_id")
        .not("order_group_id", "is", null);
      if (groupRows) {
        for (const row of groupRows as { id: string; order_group_id: string }[]) {
          groupIdLookup[row.id] = row.order_group_id;
        }
      }
    } catch (e) {
      console.error("order_group_id lookup error:", e);
    }

    if (prescriptionsError) {
      console.error("Error loading prescriptions:", prescriptionsError);
      return NextResponse.json({ error: prescriptionsError.message }, { status: 500 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // PAYMENT-LEDGER ENRICHMENT (Greenwich/Rahmany incident, May 2026)
    // ──────────────────────────────────────────────────────────────────────
    // For each rx in a group, compute the actual amount collected (from
    // settled payment_transactions, NOT from prescriptions.total_paid_cents
    // which is corrupt for some legacy rows). The admin grid uses this to
    // show a red "Paid $X / Owed $Y" mismatch badge under the Price column
    // when an under-collection is detected.
    const allGroupIds = [
      ...new Set(Object.values(groupIdLookup).filter(Boolean)),
    ];

    const groupPaidCentsLookup: Record<string, number> = {};
    if (allGroupIds.length > 0) {
      const { data: settledTxs } = await supabase
        .from("payment_transactions")
        .select("order_group_id, total_amount_cents, refund_amount_cents, payment_status")
        .in("order_group_id", allGroupIds)
        .eq("payment_status", "completed");

      if (settledTxs) {
        for (const tx of settledTxs) {
          if (!tx.order_group_id) continue;
          const net = (tx.total_amount_cents || 0) - (tx.refund_amount_cents || 0);
          groupPaidCentsLookup[tx.order_group_id] =
            (groupPaidCentsLookup[tx.order_group_id] || 0) + Math.max(0, net);
        }
      }
    }

    const prescriberIds = [
      ...new Set((prescriptionsData || []).map((rx) => rx.prescriber_id)),
    ].filter(Boolean);

    let providerMap = new Map<string, { prefix: string; first_name: string; last_name: string }>();

    if (prescriberIds.length > 0) {
      const { data: providersData } = await supabase
        .from("providers")
        .select("user_id, prefix, first_name, last_name, email")
        .in("user_id", prescriberIds);

      providerMap = new Map(
        providersData?.map((p) => [p.user_id, p]) || []
      );
    }

    const HIDDEN_TEST_LASTNAMES = ["harton", "one", "testing", "test 1"];
    const HIDDEN_TEST_FIRSTNAMES_LASTNAMES = [["aimrx", "test"], ["p1", "one"], ["p2", "testing"], ["test", "test 1"], ["test", "test"]];
    // Word-boundary regex backstop added May 5, 2026 — mirrors the
    // isTestPatient() helper from core/cron/jobs/digitalrx-reconcile.ts
    // (the established project rule: never surface test patients).
    // Catches first/last name starting with "test" (Test Test, Test Patient,
    // Testing Account, etc.) and exact "aimrx" without needing to maintain
    // the hard-coded list above. Hard-coded list is kept for legacy entries.
    const isTestPatientName = (firstName?: string, lastName?: string): boolean => {
      const fn = (firstName || "").toLowerCase().trim();
      const ln = (lastName || "").toLowerCase().trim();
      if (/\btest/i.test(fn) || /\btest/i.test(ln)) return true;
      if (fn === "aimrx" || ln === "aimrx") return true;
      return false;
    };
    // RE-INSTATED joseph+6@smartconnects.com (PA Joseph Sughayer) on May 1, 2026
    // per Joseph's request — needed for system-check / audit visibility on the
    // admin Incoming Prescriptions page. Was previously hidden as demo noise.
    // "providerassitant" stays hidden (genuine internal test account).
    const HIDDEN_PROVIDER_LASTNAMES = ["providerassitant"];
    // EMAIL-BASED HIDE LIST added May 1, 2026. Email is the unique
    // handle so test joseph+XXXX provider accounts can be hidden
    // without affecting any legitimate provider record. Add new test
    // emails here as Joseph creates more dev/QA accounts.
    const HIDDEN_PROVIDER_EMAILS = [
      "joseph+01234@smartconnects.com",  // Dr. TEST Sughayer (test prov)
      "jospeh+40@smartconnects.com",     // Joseph Test (test prov, typo'd email)
      "joseph+123456@smartconnects.com", // proider test2 (test prov)
      "joseph+101010@smartconnects.com", // TEST TEST (test prov)
      "joseph+5000@smartconnects.com",   // TEST PROVIDER Assistance (test prov)
      "joseph+6@smartconnects.com",      // PA Joseph Sughayer (test prov)
    ];

    // ─── PDF HEALTH BADGE LOOKUP ── Trevor Haynes incident, May 7-8 2026.
    //
    // For Greenwich-pharmacy submitted rows, batch-resolve the PDF size
    // from storage.objects so the admin grid can show a green/red badge
    // under the Queue ID. Joseph's hard rule (May 8 2026): "always green,
    // never red on the table" — server-side auto-heal in submit-to-
    // pharmacy-core makes this so. The badge here is the visible proof
    // that every Greenwich submission has a proper Electronic Rx behind
    // it; if anything ever shows red, that's a real bug surfaced.
    //
    // Detection rule mirrors HEALTHY_PDF_MIN_BYTES (200KB) in
    // core/services/regenerate-stale-pdf.ts. Image-only "JPEG-in-PDF"
    // wrappers from the Step 1 file picker are 73-124KB; every legit
    // Electronic Rx is >= 593KB.
    const GREENWICH_PHARMACY_ID_FOR_BADGE = "59623278-013e-407f-96af-b164144bdbc7";
    const PDF_HEALTH_MIN_BYTES = 200_000;
    const greenwichPdfPaths = (prescriptionsData || [])
      .filter(
        (rx) =>
          rx.pharmacy_id === GREENWICH_PHARMACY_ID_FOR_BADGE &&
          typeof rx.pdf_storage_path === "string" &&
          rx.pdf_storage_path.length > 0,
      )
      .map((rx) => rx.pdf_storage_path as string);

    // Track whether the size lookup itself succeeded. If it failed
    // (transient storage outage, perms hiccup, payload limit, etc.) we
    // MUST NOT paint every Greenwich row red — Joseph's rule is "table
    // only ever shows green; red is reserved for real auto-heal failures
    // that the operator needs to chase." On lookup failure we degrade
    // to "na" (no badge) instead of false-positive "bad".
    //
    // IMPORTANT: Supabase PostgREST only exposes the `public` and
    // `graphql_public` schemas by default — `.schema("storage")` returns
    // PGRST106 ("Invalid schema: storage") even with the service role.
    // So we read storage.objects via a direct postgres connection
    // (per the project's "raw psql via $SUPABASE_DATABASE_URL" pattern
    // documented in replit.md). One short-lived connection per request,
    // closed in finally so we don't leak under load.
    const pdfSizeByPath = new Map<string, number>();
    let pdfSizeLookupOk = true;
    if (greenwichPdfPaths.length > 0) {
      const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
      if (!dbUrl) {
        pdfSizeLookupOk = false;
        console.error("PDF health badge lookup skipped: no SUPABASE_DATABASE_URL");
      } else {
        let sql: ReturnType<typeof postgres> | null = null;
        try {
          sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 5 });
          const rows = await sql<{ name: string; size: string | number | null }[]>`
            SELECT name, (metadata->>'size')::bigint AS size
            FROM storage.objects
            WHERE bucket_id = 'patient-files'
              AND name = ANY(${greenwichPdfPaths})
          `;
          for (const row of rows) {
            const n = typeof row.size === "number" ? row.size : row.size != null ? Number(row.size) : NaN;
            if (Number.isFinite(n)) pdfSizeByPath.set(row.name, n);
          }
        } catch (err) {
          pdfSizeLookupOk = false;
          console.error("PDF health badge lookup threw (non-fatal):", err);
        } finally {
          if (sql) {
            try { await sql.end({ timeout: 1 }); } catch { /* ignore */ }
          }
        }
      }
    }

    // Three-class detector (May 8 2026 — Joseph clarified the badge must
    // catch every failure mode, not just size):
    //   bug #1 size       — PDF in storage is image-only / < 200 KB
    //   bug #2 race       — PDF on our side is fine but pdf_push_confirmed_at
    //                       is NULL on a submitted+ row → Greenwich never
    //                       received it (Wicks/Welzel/Vogt/Province/etc.)
    //   bug #3 content    — pdf_validation_error is set (e.g. catalog
    //                       missing → no AIM prefix → Robinson)
    //
    // Joseph's rule: "any layer fails = red". So storage-lookup failure
    // also flips to red (was previously degraded to "na" — that hid the
    // problem instead of surfacing it).
    const computePdfHealth = (
      pharmacyId: string | null | undefined,
      pdfPath: string | null | undefined,
      status: string | null | undefined,
      pushConfirmedAt: string | null | undefined,
      validationError: string | null | undefined,
    ): { state: "ok" | "bad" | "na"; reason: string | null } => {
      // Only Greenwich gets a badge — other pharmacies' format expectations
      // are not in scope.
      if (pharmacyId !== GREENWICH_PHARMACY_ID_FOR_BADGE) return { state: "na", reason: null };
      // Pre-submission rows: nothing to evaluate yet.
      if (!status || status === "pending_payment" || status === "payment_received" || status === "submitting_to_pharmacy" || status === "cancelled" || status === "rejected") {
        return { state: "na", reason: null };
      }
      // bug #3 content
      if (validationError) return { state: "bad", reason: `content:${validationError}` };
      // bug #2 race victim — submitted+ but PDF push never confirmed.
      // Backfilled rows pre-May-8 will all hit this initially; that's
      // intentional, the operator should resend or manually confirm.
      if (!pushConfirmedAt) return { state: "bad", reason: "no_push_confirmation" };
      // Storage lookup failed → red (was previously "na"; Joseph: any
      // layer failing means the operator must see it).
      if (!pdfSizeLookupOk) return { state: "bad", reason: "storage_lookup_failed" };
      if (!pdfPath) return { state: "bad", reason: "no_storage_path" };
      const size = pdfSizeByPath.get(pdfPath);
      if (size === undefined) return { state: "bad", reason: "storage_row_missing" };
      if (size < PDF_HEALTH_MIN_BYTES) return { state: "bad", reason: `size_${size}b_below_${PDF_HEALTH_MIN_BYTES}` };
      return { state: "ok", reason: null };
    };

    const formatted = (prescriptionsData || [])
      .filter((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        if (patient) {
          const p = patient as { first_name: string; last_name: string };
          if (HIDDEN_TEST_LASTNAMES.includes(p.last_name?.toLowerCase())) return false;
          const fn = p.first_name?.toLowerCase() || "";
          const ln = p.last_name?.toLowerCase() || "";
          if (HIDDEN_TEST_FIRSTNAMES_LASTNAMES.some(([f, l]) => fn === f && ln === l)) return false;
          if (isTestPatientName(p.first_name, p.last_name)) return false;
        }
        const provider = providerMap.get(rx.prescriber_id) as { last_name?: string; email?: string } | undefined;
        if (provider && HIDDEN_PROVIDER_LASTNAMES.includes(provider.last_name?.toLowerCase() || "")) return false;
        if (provider?.email && HIDDEN_PROVIDER_EMAILS.includes(provider.email.toLowerCase())) return false;
        return true;
      })
      .map((rx) => {
      const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
      const provider = providerMap.get(rx.prescriber_id);
      const pharmacy = Array.isArray(rx.pharmacy) ? rx.pharmacy[0] : rx.pharmacy;

      return {
        id: rx.id,
        queueId: rx.queue_id || "N/A",
        submittedAt: rx.submitted_at,
        sentToPharmacyAt: rx.submitted_to_pharmacy_at,
        statusUpdatedAt: rx.updated_at,
        providerName: provider
          ? `${provider.prefix || "Dr."} ${provider.first_name} ${provider.last_name}`
          : "Unknown Provider",
        patientName: patient
          ? `${(patient as { first_name: string; last_name: string; email?: string }).first_name} ${(patient as { first_name: string; last_name: string; email?: string }).last_name}`
          : "Unknown Patient",
        patientEmail: (patient as { first_name: string; last_name: string; email?: string })?.email || null,
        medication: rx.medication,
        strength: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        sig: rx.sig,
        status: rx.status || "submitted",
        paymentStatus: rx.payment_status,
        // patient_price is a Postgres numeric column → supabase-js
        // serializes it as a STRING ("120.00"). Coerce to a real number
        // here at the API boundary so every downstream consumer can
        // safely do arithmetic on it without string-concat bugs (see
        // utils/money.ts and the May 1 2026 Greenwich/Rahmany incident).
        patientPrice: rx.patient_price != null ? Number(rx.patient_price) : null,
        shippingFeeCents: Number(rx.shipping_fee_cents) || 0,
        profitCents: Number(rx.profit_cents) || 0,
        submissionGroupId: groupIdLookup[rx.id] || null,
        trackingNumber: rx.tracking_number,
        pharmacyName: (pharmacy as { name?: string })?.name,
        pharmacyColor: (pharmacy as { primary_color?: string })?.primary_color,
        carrierStatus: rx.fedex_status,
        estimatedDelivery: rx.estimated_delivery,
        patientId: rx.patient_id,
        hasCustomAddress: rx.has_custom_address || false,
        customAddress: rx.custom_address as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null,
        patientAddress: (() => {
          const p = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
          return (p as { physical_address?: unknown })?.physical_address as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null || null;
        })(),
        paymentToken: (() => {
          const txs = (rx as any).payment_transactions;
          if (Array.isArray(txs) && txs.length > 0) return txs[0].payment_token;
          return null;
        })(),
        paymentTransactionId: (() => {
          const txs = (rx as any).payment_transactions;
          if (Array.isArray(txs) && txs.length > 0) return txs[0].id;
          return null;
        })(),
        // Net settled amount for this rx's group (Greenwich/Rahmany incident
        // remediation, May 2026). null when the rx is not part of a group.
        groupPaidCents: (() => {
          const gid = groupIdLookup[rx.id];
          if (!gid) return null;
          return groupPaidCentsLookup[gid] ?? 0;
        })(),
        // Greenwich PDF health badge (Trevor incident, May 7-8 2026;
        // expanded May 8 2026 to cover race victims + content errors).
        // "ok"  = healthy on every layer (size + push confirmed + content)
        // "bad" = ANY layer failed; pdfHealthReason explains which one
        // "na"  = not applicable (non-Greenwich or pre-submission)
        ...(() => {
          const h = computePdfHealth(
            rx.pharmacy_id,
            rx.pdf_storage_path,
            rx.status,
            (rx as { pdf_push_confirmed_at?: string | null }).pdf_push_confirmed_at,
            (rx as { pdf_validation_error?: string | null }).pdf_validation_error,
          );
          return { pdfHealth: h.state, pdfHealthReason: h.reason };
        })(),
      };
    });

    return NextResponse.json({ prescriptions: formatted });
  } catch (error) {
    console.error("Error in admin prescriptions API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

